/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateWebWorkerMLCEngine,
  MLCEngineInterface,
  InitProgressReport,
  ChatCompletionMessageParam,
  prebuiltAppConfig
} from '@mlc-ai/web-llm';
import { InferenceSettings, TelemetryPoint } from '../types';
import { GenerationMetrics, ProgressCallbackData } from './onnxRunner';

let webLlmEngine: MLCEngineInterface | null = null;
let activeWebLlmModelId: string | null = null;
let workerInstance: Worker | null = null;

/**
 * Check if WebGPU is available and meets the 32KB workgroup storage required by WebLLM shaders
 */
export async function isWebGpuSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
    return false;
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    if (!adapter) return false;
    
    // Check if the GPU supports the minimum 32KB workgroup storage size required by TVM / MLC shaders
    const workgroupLimit = adapter.limits?.maxComputeWorkgroupStorageSize || 0;
    if (workgroupLimit > 0 && workgroupLimit < 32768) {
      console.warn(
        `WebGPU adapter detected (${adapter.info?.vendor || 'mobile GPU'}) but maxComputeWorkgroupStorageSize is ${workgroupLimit} bytes (32768 required for WebLLM shaders). Falling back to WASM engine.`
      );
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Unloads active WebLLM engine and frees worker memory
 */
export async function unloadWebLlm(): Promise<void> {
  if (webLlmEngine) {
    try {
      await webLlmEngine.unload();
    } catch {}
    webLlmEngine = null;
    activeWebLlmModelId = null;
  }
  if (workerInstance) {
    try {
      workerInstance.terminate();
    } catch {}
    workerInstance = null;
  }
}

/**
 * Initializes or reloads a model using WebLLM WebGPU Engine
 */
export async function loadWebLlmModel(
  modelId: string,
  onProgress?: (data: ProgressCallbackData) => void
): Promise<void> {
  if (webLlmEngine && activeWebLlmModelId === modelId) {
    onProgress?.({
      status: 'ready',
      modelId,
      stage: 'Model already cached in WebGPU VRAM memory',
      progress: 100
    });
    return;
  }

  // Terminate previous engine if model is switching
  if (webLlmEngine) {
    try {
      await webLlmEngine.unload();
    } catch {}
    webLlmEngine = null;
    activeWebLlmModelId = null;
  }

  if (workerInstance) {
    try {
      workerInstance.terminate();
    } catch {}
    workerInstance = null;
  }

  onProgress?.({
    status: 'loading',
    modelId,
    stage: 'Initializing WebGPU shader compilation & MLC engine...',
    progress: 5
  });

  workerInstance = new Worker(new URL('./webllmWorker.ts', import.meta.url), {
    type: 'module'
  });

  const progressCallback = (report: InitProgressReport) => {
    // Parse progress report text and ratio
    const progressPercent = Math.min(100, Math.max(0, Math.round(report.progress * 100)));
    onProgress?.({
      status: progressPercent >= 100 ? 'ready' : 'downloading',
      modelId,
      stage: report.text,
      progress: progressPercent
    });
  };

  try {
    webLlmEngine = await CreateWebWorkerMLCEngine(
      workerInstance,
      modelId,
      {
        appConfig: prebuiltAppConfig,
        initProgressCallback: progressCallback,
        logLevel: 'WARN'
      }
    );
    activeWebLlmModelId = modelId;

    onProgress?.({
      status: 'ready',
      modelId,
      stage: 'WebLLM WebGPU engine active and ready for inference!',
      progress: 100
    });
  } catch (error: any) {
    console.error('WebLLM failed to load model:', error);
    if (workerInstance) {
      try {
        workerInstance.terminate();
      } catch {}
      workerInstance = null;
    }
    webLlmEngine = null;
    activeWebLlmModelId = null;
    throw error;
  }
}

/**
 * Runs streaming text generation using WebLLM
 */
export async function runWebLlmInference(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  settings: InferenceSettings,
  onTokenStream?: (token: string, metrics: Partial<GenerationMetrics>, fullText: string, point?: TelemetryPoint) => void
): Promise<{ text: string; metrics: GenerationMetrics }> {
  if (!webLlmEngine) {
    throw new Error('WebLLM Engine is not initialized. Call loadWebLlmModel first.');
  }

  const startTime = performance.now();
  let firstTokenTime: number | null = null;
  let tokenCount = 0;
  let fullAccumulatedText = '';
  const telemetry: TelemetryPoint[] = [];
  let lastTokenTimestamp = startTime;
  let spikeCount = 0;
  let totalLatencySum = 0;
  let maxLatency = 0;

  const chatMessages: ChatCompletionMessageParam[] = [];

  // Inject system prompt
  if (settings.systemPrompt?.trim()) {
    chatMessages.push({
      role: 'system',
      content: settings.systemPrompt.trim()
    });
  }

  for (const m of messages) {
    chatMessages.push({
      role: m.role,
      content: m.content
    });
  }

  const completion = await webLlmEngine.chat.completions.create({
    messages: chatMessages,
    temperature: settings.fastMode ? 0.05 : Math.max(0.1, Math.min(settings.temperature, 1.2)),
    top_p: settings.topP || 0.9,
    max_tokens: settings.maxTokens || 512,
    stream: true
  });

  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (!delta) continue;

    const now = performance.now();
    if (firstTokenTime === null) {
      firstTokenTime = now;
    }

    tokenCount++;
    fullAccumulatedText += delta;

    const interTokenLatency = now - lastTokenTimestamp;
    lastTokenTimestamp = now;

    if (tokenCount > 1) {
      totalLatencySum += interTokenLatency;
      if (interTokenLatency > maxLatency) {
        maxLatency = interTokenLatency;
      }
      if (interTokenLatency > 150) {
        spikeCount++;
      }
    }

    const elapsedTotal = (now - startTime) / 1000;
    const elapsedSinceFirst = (now - firstTokenTime) / 1000;
    const cumulativeTps = elapsedSinceFirst > 0 ? tokenCount / elapsedSinceFirst : tokenCount / (elapsedTotal || 0.01);
    const instantaneousTps = interTokenLatency > 0 ? 1000 / interTokenLatency : cumulativeTps;

    const point: TelemetryPoint = {
      tokenIndex: tokenCount,
      timeMs: Math.round(now - startTime),
      interTokenLatencyMs: Math.round(interTokenLatency),
      tps: Number(instantaneousTps.toFixed(1)),
      cumulativeTps: Number(cumulativeTps.toFixed(1)),
      isSpike: interTokenLatency > 150
    };
    telemetry.push(point);

    onTokenStream?.(
      delta,
      {
        tokensGenerated: tokenCount,
        tokensPerSec: Number(cumulativeTps.toFixed(1)),
        instantaneousTps: Number(instantaneousTps.toFixed(1)),
        timeToFirstTokenMs: Math.round(firstTokenTime - startTime),
        totalTimeMs: Math.round(now - startTime),
        backendUsed: 'webgpu'
      },
      fullAccumulatedText,
      point
    );
  }

  const endTime = performance.now();
  const totalDurationSec = (endTime - (firstTokenTime || startTime)) / 1000;
  const overallTps = totalDurationSec > 0 ? tokenCount / totalDurationSec : 0;
  const avgLatency = tokenCount > 1 ? totalLatencySum / (tokenCount - 1) : (endTime - startTime);

  let peakTps = 0;
  for (const p of telemetry) {
    if (p.tps > peakTps && p.tps < 300) {
      peakTps = p.tps;
    }
  }

  const finalMetrics: GenerationMetrics = {
    tokensGenerated: tokenCount,
    tokensPerSec: Number(overallTps.toFixed(1)),
    timeToFirstTokenMs: firstTokenTime ? Math.round(firstTokenTime - startTime) : Math.round(endTime - startTime),
    totalTimeMs: Math.round(endTime - startTime),
    backendUsed: 'webgpu',
    peakTokensPerSec: Number((peakTps || overallTps).toFixed(1)),
    avgLatencyMs: Math.round(avgLatency),
    maxLatencyMs: Math.round(maxLatency),
    spikeCount,
    telemetry
  };

  return {
    text: fullAccumulatedText,
    metrics: finalMetrics
  };
}

export function getActiveWebLlmModelId(): string | null {
  return activeWebLlmModelId;
}
