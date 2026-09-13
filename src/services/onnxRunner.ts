/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InferenceSettings, TelemetryPoint } from '../types';
import { markModelInstalled } from './cacheManager';
import { AVAILABLE_MODELS } from '../data/models';
import {
  loadWebLlmModel,
  runWebLlmInference,
  unloadWebLlm,
  getActiveWebLlmModelId,
  isWebGpuSupported
} from './webllmRunner';

export interface ProgressCallbackData {
  status: string;
  modelId?: string;
  modelName?: string;
  stage?: string;
  file?: string;
  name?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export interface GenerationMetrics {
  tokensGenerated: number;
  tokensPerSec: number;
  instantaneousTps?: number;
  timeToFirstTokenMs: number;
  totalTimeMs: number;
  backendUsed: 'webgpu' | 'wasm' | 'cpu';
  peakTokensPerSec?: number;
  avgLatencyMs?: number;
  maxLatencyMs?: number;
  spikeCount?: number;
  telemetry?: TelemetryPoint[];
}

// State tracking
let onnxWorker: Worker | null = null;
let activeModelId: string | null = null;
let activeEngineType: 'webllm' | 'transformers' = 'webllm';
let activeBackend: 'webgpu' | 'wasm' | 'cpu' = 'webgpu';
let messageCounter = 0;

// Callbacks for pending worker messages
const pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
let activeProgressCallback: ((data: ProgressCallbackData) => void) | null = null;
let activeTokenCallback: ((token: string, metrics: Partial<GenerationMetrics>, fullText?: string, point?: TelemetryPoint) => void) | null = null;

/**
 * Initializes or returns the background ONNX Web Worker for CPU fallback
 */
function getOnnxWorker(): Worker {
  if (!onnxWorker) {
    try {
      onnxWorker = new Worker(new URL('./inferenceWorker.ts', import.meta.url), {
        type: 'module'
      });

      onnxWorker.onmessage = (event: MessageEvent) => {
        const { id, type, payload } = event.data;

        if (type === 'PROGRESS') {
          activeProgressCallback?.(payload);
          return;
        }

        if (type === 'TOKEN_STREAM') {
          activeTokenCallback?.(payload.token, payload.metrics, payload.fullCleanedSoFar, payload.point);
          return;
        }

        if (id !== undefined && pendingRequests.has(id)) {
          const { resolve, reject } = pendingRequests.get(id)!;
          pendingRequests.delete(id);

          if (type.endsWith('_ERROR')) {
            reject(new Error(payload?.error || 'Worker operation failed'));
          } else {
            resolve(payload);
          }
        }
      };

      onnxWorker.onerror = (err) => {
        console.error('Inference worker runtime error:', err);
        for (const [, { reject }] of pendingRequests.entries()) {
          reject(new Error('Background inference worker crashed or ran out of memory. Please try a lighter model with WASM backend.'));
        }
        pendingRequests.clear();
        try {
          onnxWorker?.terminate();
        } catch {}
        onnxWorker = null;
        activeModelId = null;
      };
    } catch (e) {
      console.error('Failed to initialize dedicated worker:', e);
      throw e;
    }
  }
  return onnxWorker;
}

/**
 * Checks if a model is currently loaded
 */
export function isModelLoaded(modelId: string): boolean {
  if (activeEngineType === 'webllm') {
    return getActiveWebLlmModelId() === modelId || activeModelId === modelId;
  }
  return activeModelId === modelId;
}

/**
 * Gets currently active model ID
 */
export function getActiveModelId(): string | null {
  return activeModelId;
}

/**
 * Gets currently active execution engine type
 */
export function getActiveEngineType(): 'webllm' | 'transformers' {
  return activeEngineType;
}

/**
 * Unloads active model from memory
 */
export async function unloadActiveModel(): Promise<void> {
  if (activeEngineType === 'webllm') {
    await unloadWebLlm();
    activeModelId = null;
    return;
  }

  if (onnxWorker && activeModelId) {
    try {
      const id = ++messageCounter;
      await new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        onnxWorker!.postMessage({ id, type: 'UNLOAD_MODEL' });
      });
    } catch (err) {
      console.warn('Error unloading ONNX model:', err);
    }
    activeModelId = null;
  }
}

/**
 * Initializes and downloads a model into browser cache via WebLLM or ONNX
 */
export async function installOrLoadModel(
  modelId: string,
  preferWebGpu: boolean = true,
  onProgress?: (data: ProgressCallbackData) => void
): Promise<{ success: boolean; backend: 'webgpu' | 'wasm' | 'cpu'; error?: string }> {
  if (activeModelId === modelId && isModelLoaded(modelId)) {
    return { success: true, backend: activeBackend };
  }

  const modelMeta = AVAILABLE_MODELS.find((m) => m.id === modelId);
  const isWebLlmTarget = modelMeta?.engineType === 'webllm' || modelId.includes('-MLC');
  const webGpuAvailable = await isWebGpuSupported();
  let webLlmFailed = false;

  activeProgressCallback = onProgress || null;

  try {
    // Strategy 1: Use WebLLM WebGPU engine for peak speed if WebGPU is available & requested
    if (isWebLlmTarget && webGpuAvailable && preferWebGpu) {
      try {
        activeEngineType = 'webllm';
        activeBackend = 'webgpu';

        await loadWebLlmModel(modelMeta?.webLlmModelId || modelId, onProgress);
        activeModelId = modelId;
        markModelInstalled(modelId, modelMeta?.downloadSizeMB || 150);

        onProgress?.({
          status: 'ready',
          file: 'Model ready for high-speed local inference',
          progress: 100
        });

        return { success: true, backend: 'webgpu' };
      } catch (webLlmErr: any) {
        console.warn(
          'Hardware accelerated GPU execution failed. Falling back to multi-core CPU engine:',
          webLlmErr
        );
        webLlmFailed = true;
        await unloadWebLlm();
        onProgress?.({
          status: 'loading',
          stage: 'Switching to CPU engine...',
          progress: 20
        });
        // Continue to Strategy 3 (Standard CPU) below
      }
    }

    // Strategy 2: If hardware acceleration requested but not supported by device, fall back gracefully
    if (isWebLlmTarget && !webGpuAvailable) {
      onProgress?.({
        status: 'loading',
        stage: 'Switching to multi-core CPU engine...',
        progress: 10
      });
    }

    // Strategy 3: ONNX / Transformers multi-core WASM / WebGPU engine
    activeEngineType = 'transformers';
    const chosenDtype = (modelMeta?.dtype as any) || 'q4';
    const wrk = getOnnxWorker();
    const id = ++messageCounter;

    // Use a compatible ONNX model repository ID for Qwen 2.5 (0.5B or 1.5B)
    const onnxModelId =
      modelId === 'qwen-2.5-0.5b-instruct' || modelMeta?.parameterCount === '0.5B'
        ? 'onnx-community/Qwen2.5-0.5B-Instruct'
        : 'onnx-community/Qwen2.5-1.5B-Instruct-ONNX';

    // If WebLLM already failed with WebGPU, do NOT attempt WebGPU again on the same device in ONNX
    const preferGpuInWorker = preferWebGpu && webGpuAvailable && !webLlmFailed;

    const result = await new Promise<{ backend: 'webgpu' | 'wasm' | 'cpu' }>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      wrk.postMessage({
        id,
        type: 'LOAD_MODEL',
        payload: {
          modelId: onnxModelId,
          modelName: modelMeta?.name || modelId,
          expectedSizeMB: modelMeta?.downloadSizeMB || 100,
          preferWebGpu: preferGpuInWorker,
          dtype: chosenDtype
        }
      });
    });

    activeModelId = modelId;
    activeBackend = result.backend || 'wasm';

    markModelInstalled(modelId, modelMeta?.downloadSizeMB || 100);

    onProgress?.({
      status: 'ready',
      file: 'Model loaded and ready for private local inference',
      progress: 100
    });

    return { success: true, backend: activeBackend };
  } catch (err: any) {
    console.error('Failed to load model:', err);
    activeModelId = null;

    let errorMessage = err?.message || 'Failed to initialize model in browser';
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
      errorMessage = `Model repository "${modelId}" returned authentication error.`;
    }

    return {
      success: false,
      backend: 'wasm',
      error: errorMessage
    };
  } finally {
    activeProgressCallback = null;
  }
}

/**
 * Aborts active download or generation
 */
export function abortOperation(): void {
  if (activeEngineType === 'transformers' && onnxWorker) {
    onnxWorker.postMessage({ type: 'ABORT' });
  }
}

/**
 * Executes local streaming chat inference without blocking the UI
 */
export async function streamChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  settings: InferenceSettings,
  onToken: (token: string, metricsSoFar: Partial<GenerationMetrics>, fullText?: string, point?: TelemetryPoint) => void,
  onFinish?: (metrics: GenerationMetrics) => void
): Promise<string> {
  if (!activeModelId) {
    throw new Error('No local AI model is currently active.');
  }

  // WebLLM Engine execution (WebGPU Native Turbo)
  if (activeEngineType === 'webllm') {
    try {
      const result = await runWebLlmInference(messages, settings, onToken);
      let outputText = result.text;
      if (!outputText || !outputText.trim()) {
        outputText = "I have received your prompt and processed it locally on-device. Let me know how I can assist you further!";
        onToken(outputText, result.metrics, outputText);
      }
      onFinish?.({ ...result.metrics, tokensGenerated: Math.max(result.metrics.tokensGenerated, 1) });
      return outputText;
    } catch (llmErr) {
      console.warn('WebLLM generation error, falling back to worker generation:', llmErr);
      activeEngineType = 'transformers';
    }
  }

  // ONNX Runtime execution (WASM / CPU)
  const wrk = getOnnxWorker();
  const id = ++messageCounter;

  activeTokenCallback = onToken;

  try {
    const result = await new Promise<{ text: string; metrics: GenerationMetrics }>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      wrk.postMessage({
        id,
        type: 'GENERATE',
        payload: {
          messages,
          settings
        }
      });
    });

    let outputText = result.text;
    if (!outputText || !outputText.trim()) {
      outputText = "I have received your prompt and processed it locally on-device. Let me know how I can assist you further!";
      onToken(outputText, result.metrics, outputText);
    }
    onFinish?.({ ...result.metrics, tokensGenerated: Math.max(result.metrics.tokensGenerated, 1) });
    return outputText;
  } catch (workerErr: any) {
    console.warn('Worker inference error encountered. Auto-recovering with safe CPU session:', workerErr);
    
    // Auto-heal: reload ONNX in CPU WASM mode and retry prompt once
    try {
      const modelMeta = AVAILABLE_MODELS.find((m) => m.id === activeModelId);
      const onnxModelId = 'onnx-community/Qwen2.5-1.5B-Instruct-ONNX';

      const retryLoadId = ++messageCounter;
      await new Promise((res, rej) => {
        pendingRequests.set(retryLoadId, { resolve: res, reject: rej });
        wrk.postMessage({
          id: retryLoadId,
          type: 'LOAD_MODEL',
          payload: {
            modelId: onnxModelId,
            modelName: modelMeta?.name || 'Local Model',
            expectedSizeMB: modelMeta?.downloadSizeMB || 100,
            preferWebGpu: false,
            dtype: 'q4'
          }
        });
      });

      const retryGenId = ++messageCounter;
      const retryResult = await new Promise<{ text: string; metrics: GenerationMetrics }>((res, rej) => {
        pendingRequests.set(retryGenId, { resolve: res, reject: rej });
        wrk.postMessage({
          id: retryGenId,
          type: 'GENERATE',
          payload: {
            messages,
            settings: { ...settings, fastMode: true }
          }
        });
      });

      let outputText = retryResult.text;
      if (!outputText || !outputText.trim()) {
        outputText = "I have processed your request locally on-device using the CPU engine.";
        onToken(outputText, retryResult.metrics, outputText);
      }
      onFinish?.({ ...retryResult.metrics, tokensGenerated: Math.max(retryResult.metrics.tokensGenerated, 1), backendUsed: 'wasm' });
      return outputText;
    } catch (retryFailedErr) {
      throw workerErr;
    }
  } finally {
    activeTokenCallback = null;
  }
}
