/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pipeline, env, TextStreamer } from '@huggingface/transformers';

// Configure environment inside Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

// Safe ONNX Runtime Web configuration:
// Enable multi-threading & SIMD acceleration
const isIsolated = typeof self !== 'undefined' && Boolean((self as any).crossOriginIsolated);
const availableCores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;

if (env.backends?.onnx?.wasm) {
  // Use optimal thread count (between 2 and 8)
  env.backends.onnx.wasm.numThreads = Math.min(8, Math.max(2, isIsolated ? availableCores : Math.min(availableCores, 4)));
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.simd = true;
}

let activeGenerator: any = null;
let activeModelId: string | null = null;
let activeBackend: 'webgpu' | 'wasm' | 'cpu' = 'wasm';
let isAborted = false;

const STOP_SEQUENCES = [
  '<|im_end|>',
  '<|endoftext|>',
  '<|eot_id|>',
  '<|end_of_text|>',
  '</s>',
  '<end_of_turn>',
  '<start_of_turn>',
  '<|im_start|>',
  '<eos>'
];

// Helper to detect degenerate repetition loops (hallucinating same words/phrases)
function hasRepetitionLoop(text: string): boolean {
  if (text.length < 40) return false;
  
  // 1. Check repeated phrases / word sequences (3 to 6 words)
  const words = text.trim().split(/\s+/);
  if (words.length >= 9) {
    for (const phraseLen of [3, 4, 5, 6]) {
      if (words.length >= phraseLen * 3) {
        const p1 = words.slice(-phraseLen).join(' ').toLowerCase();
        const p2 = words.slice(-phraseLen * 2, -phraseLen).join(' ').toLowerCase();
        const p3 = words.slice(-phraseLen * 3, -phraseLen * 2).join(' ').toLowerCase();
        if (p1 === p2 && p2 === p3 && p1.length > 8) {
          return true;
        }
      }
    }
  }

  // 2. Check repeated substring patterns (10 to 40 characters)
  for (let len = 10; len <= 40; len++) {
    if (text.length >= len * 3) {
      const s1 = text.slice(-len);
      const s2 = text.slice(-len * 2, -len);
      const s3 = text.slice(-len * 3, -len * 2);
      if (s1 === s2 && s2 === s3) {
        return true;
      }
    }
  }

  return false;
}

function cleanStopSequences(text: string): { cleaned: string; hasStop: boolean } {
  let cleaned = text;
  let hasStop = false;
  for (const stopSeq of STOP_SEQUENCES) {
    const idx = cleaned.indexOf(stopSeq);
    if (idx !== -1) {
      cleaned = cleaned.substring(0, idx);
      hasStop = true;
    }
  }
  return { cleaned: cleaned.trimEnd(), hasStop };
}

function formatPrompt(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  modelId: string,
  systemPrompt?: string
): string {
  const fullMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // Preserve multi-turn conversation context history up to 24 turns
  const maxTurns = 24;
  const recentMessages = messages.length > maxTurns 
    ? [...messages.slice(0, 2), ...messages.slice(- (maxTurns - 2))]
    : messages;

  for (const m of recentMessages) {
    if (m.role !== 'system' && m.content.trim()) {
      fullMessages.push({
        role: m.role,
        content: m.content.trim()
      });
    }
  }

  const lowerId = modelId.toLowerCase();

  // Gemma 3 & Gemma 2 format:
  // Note: Gemma does not support a separate system role. System instructions are prepended to the first user turn.
  if (lowerId.includes('gemma')) {
    let prompt = '';
    let isFirstUser = true;
    for (const m of fullMessages) {
      if (m.role === 'user') {
        const text = (isFirstUser && systemPrompt && systemPrompt.trim())
          ? `${systemPrompt.trim()}\n\n${m.content}`
          : m.content;
        prompt += `<start_of_turn>user\n${text}<end_of_turn>\n`;
        isFirstUser = false;
      } else if (m.role === 'assistant') {
        prompt += `<start_of_turn>model\n${m.content}<end_of_turn>\n`;
      }
    }
    if (isFirstUser && systemPrompt && systemPrompt.trim()) {
      prompt += `<start_of_turn>user\n${systemPrompt.trim()}<end_of_turn>\n`;
    }
    prompt += '<start_of_turn>model\n';
    return prompt;
  }

  // Check if tokenizer supports apply_chat_template for other models
  const tokenizer = activeGenerator?.tokenizer;
  if (tokenizer && typeof tokenizer.apply_chat_template === 'function') {
    try {
      const chatInput = systemPrompt && systemPrompt.trim() 
        ? [{ role: 'system', content: systemPrompt.trim() }, ...fullMessages]
        : fullMessages;
      const templated = tokenizer.apply_chat_template(chatInput, {
        tokenize: false,
        add_generation_prompt: true
      });
      if (templated && typeof templated === 'string' && templated.length > 0) {
        return templated;
      }
    } catch (e) {
      console.warn('apply_chat_template failed in worker, using model-specific formatter:', e);
    }
  }

  // Standard ChatML format (Bonsai 1.7B, Qwen, etc.)
  let prompt = '';
  if (systemPrompt && systemPrompt.trim()) {
    prompt += `<|im_start|>system\n${systemPrompt.trim()}<|im_end|>\n`;
  }
  for (const m of fullMessages) {
    prompt += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
  }
  prompt += '<|im_start|>assistant\n';
  return prompt;
}

self.onmessage = async (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  switch (type) {
    case 'LOAD_MODEL': {
      try {
        const { modelId, preferWebGpu, dtype, expectedSizeMB, modelName } = payload;
        const targetModelName = modelName || modelId;
        const targetExpectedBytes = (expectedSizeMB || 100) * 1024 * 1024;

        if (activeModelId === modelId && activeGenerator) {
          self.postMessage({ id, type: 'LOAD_SUCCESS', payload: { backend: activeBackend } });
          return;
        }

        // Free previous pipeline memory
        if (activeGenerator) {
          try {
            if (typeof activeGenerator.dispose === 'function') {
              await activeGenerator.dispose();
            }
          } catch (err) {
            console.warn('Error disposing previous generator:', err);
          }
          activeGenerator = null;
          activeModelId = null;
        }

        isAborted = false;

        let device: 'webgpu' | 'wasm' = 'wasm';
        let chosenDtype: string = 'q4';

        if (preferWebGpu && typeof navigator !== 'undefined' && (navigator as any).gpu) {
          try {
            const adapter = await (navigator as any).gpu.requestAdapter();
            if (adapter) {
              device = 'webgpu';
              chosenDtype = 'q4f16';
            }
          } catch (gpuCheckErr) {
            console.warn('WebGPU adapter check failed:', gpuCheckErr);
            device = 'wasm';
            chosenDtype = 'q4';
          }
        } else {
          device = 'wasm';
          chosenDtype = 'q4';
        }

        // Track multi-file download progress to prevent jitter across files
        const fileProgressMap = new Map<string, { loaded: number; total: number; done: boolean }>();
        let monotonicProgress = 5;
        let lastReportedTime = 0;
        let lastReportedProgress = 5;

        self.postMessage({
          type: 'PROGRESS',
          payload: {
            status: 'initiate',
            modelId,
            modelName: targetModelName,
            stage: 'Connecting to Hugging Face repository...',
            progress: 5,
            loaded: 0,
            total: targetExpectedBytes
          }
        });

        const makeProgressCallback = () => {
          return (p: any) => {
            if (isAborted) throw new Error('Installation aborted');
            const now = performance.now();
            const fileName = (p.file || '').trim();
            const isFileDone = p.status === 'done';

            if (fileName) {
              const existing = fileProgressMap.get(fileName) || { loaded: 0, total: 0, done: false };
              let itemTotal = typeof p.total === 'number' && p.total > 0 ? p.total : existing.total;
              let itemLoaded = typeof p.loaded === 'number' ? p.loaded : existing.loaded;

              if (isFileDone && itemTotal > 0) {
                itemLoaded = itemTotal;
              } else if (typeof p.progress === 'number' && itemTotal > 0) {
                itemLoaded = Math.max(itemLoaded, Math.round((p.progress / 100) * itemTotal));
              }

              fileProgressMap.set(fileName, {
                loaded: itemLoaded,
                total: itemTotal,
                done: isFileDone || existing.done
              });
            }

            // Aggregate loaded bytes across all constituent model files
            let totalLoadedBytes = 0;
            let sumKnownTotals = 0;
            for (const item of fileProgressMap.values()) {
              totalLoadedBytes += item.loaded;
              sumKnownTotals += item.total;
            }

            // Dynamic upper bound that adjusts if actual payload exceeds initial estimate
            const totalReferenceBytes = Math.max(targetExpectedBytes, sumKnownTotals, totalLoadedBytes);
            const safeLoadedBytes = Math.min(totalLoadedBytes, totalReferenceBytes);

            let computedPercent = 5;
            if (totalReferenceBytes > 0) {
              // Scale byte progress smoothly from 5% to 94% (saving final % for session compilation)
              const ratio = Math.min(1, safeLoadedBytes / totalReferenceBytes);
              computedPercent = Math.round(5 + ratio * 89);
            } else if (typeof p.progress === 'number') {
              if (fileName.includes('.onnx')) {
                computedPercent = Math.round(15 + p.progress * 0.77);
              } else {
                computedPercent = Math.min(15, Math.round(5 + p.progress * 0.1));
              }
            }

            // Strictly monotonic progress: NEVER decrease or jump back down
            monotonicProgress = Math.max(monotonicProgress, Math.min(95, computedPercent));

            // Stable human-friendly stage description (never erratic filenames)
            let stageDescription = 'Downloading model files...';
            if (fileName.includes('.onnx')) {
              stageDescription = 'Downloading model weights...';
            } else if (fileName.includes('tokenizer')) {
              stageDescription = 'Downloading tokenizer...';
            } else if (fileName.includes('config')) {
              stageDescription = 'Reading configuration...';
            } else if (monotonicProgress >= 90) {
              stageDescription = 'Compiling ONNX runtime session...';
            }

            const isDoneOrMilestone = monotonicProgress === 100 || isFileDone;
            if (
              isDoneOrMilestone ||
              (now - lastReportedTime > 120 && monotonicProgress > lastReportedProgress)
            ) {
              lastReportedTime = now;
              lastReportedProgress = monotonicProgress;

              self.postMessage({
                type: 'PROGRESS',
                payload: {
                  status: p.status || 'downloading',
                  modelId,
                  modelName: targetModelName,
                  stage: stageDescription,
                  progress: monotonicProgress,
                  loaded: safeLoadedBytes,
                  total: totalReferenceBytes
                }
              });
            }
          };
        };

        let loadedGen: any = null;
        let backendUsed: 'webgpu' | 'wasm' | 'cpu' = device;

        if (device === 'webgpu') {
          try {
            // Tier 1: Native WebGPU with q4f16 (hardware accelerated FP16 tensor cores)
            loadedGen = await pipeline('text-generation', modelId, {
              device: 'webgpu',
              dtype: chosenDtype as any,
              progress_callback: makeProgressCallback()
            });
            backendUsed = 'webgpu';
          } catch (gpuErr1: any) {
            console.warn('WebGPU with q4f16 encountered issue, trying WebGPU with q4:', gpuErr1);
            try {
              // Tier 2: WebGPU with q4 (in case model has custom layer norm fusions)
              loadedGen = await pipeline('text-generation', modelId, {
                device: 'webgpu',
                dtype: 'q4',
                progress_callback: makeProgressCallback()
              });
              backendUsed = 'webgpu';
            } catch (gpuErr2: any) {
              console.warn('WebGPU pipeline failed, gracefully falling back to CPU WASM engine:', gpuErr2);
              self.postMessage({
                type: 'PROGRESS',
                payload: {
                  status: 'fallback',
                  modelId,
                  modelName: targetModelName,
                  stage: 'Initializing CPU WASM engine fallback...',
                  progress: Math.max(monotonicProgress, 50),
                  loaded: targetExpectedBytes * 0.5,
                  total: targetExpectedBytes
                }
              });

              // Tier 3: Universal safe CPU WASM engine with q4
              backendUsed = 'wasm';
              loadedGen = await pipeline('text-generation', modelId, {
                device: 'wasm',
                dtype: 'q4',
                progress_callback: makeProgressCallback()
              });
            }
          }
        } else {
          // Device is WASM: Strictly use 'q4' (WASM CPU does not support q4f16)
          backendUsed = 'wasm';
          loadedGen = await pipeline('text-generation', modelId, {
            device: 'wasm',
            dtype: 'q4',
            progress_callback: makeProgressCallback()
          });
        }

        activeGenerator = loadedGen;
        activeModelId = modelId;
        activeBackend = backendUsed;

        self.postMessage({
          type: 'PROGRESS',
          payload: {
            status: 'ready',
            modelId,
            modelName: targetModelName,
            stage: 'Model ready for private inference',
            progress: 100,
            loaded: targetExpectedBytes,
            total: targetExpectedBytes
          }
        });

        self.postMessage({ id, type: 'LOAD_SUCCESS', payload: { backend: backendUsed } });
      } catch (err: any) {
        console.error('Worker load error:', err);
        activeGenerator = null;
        activeModelId = null;
        self.postMessage({
          id,
          type: 'LOAD_ERROR',
          payload: { error: err?.message || 'Failed to initialize model in worker' }
        });
      }
      break;
    }

    case 'UNLOAD_MODEL': {
      if (activeGenerator) {
        try {
          if (typeof activeGenerator.dispose === 'function') {
            await activeGenerator.dispose();
          }
        } catch (e) {
          console.warn('Worker dispose error:', e);
        }
        activeGenerator = null;
        activeModelId = null;
      }
      self.postMessage({ id, type: 'UNLOAD_SUCCESS' });
      break;
    }

    case 'ABORT': {
      isAborted = true;
      break;
    }

    case 'GENERATE': {
      if (!activeGenerator || !activeModelId) {
        self.postMessage({
          id,
          type: 'GENERATE_ERROR',
          payload: { error: 'No model loaded in inference worker.' }
        });
        return;
      }

      isAborted = false;
      const { messages, settings } = payload;
      const startTime = performance.now();
      let firstTokenTime: number | null = null;
      let lastTokenTime = startTime;
      let tokenCount = 0;
      let accumulatedRaw = '';
      let stoppedEarly = false;
      const recentLatencies: number[] = [];
      const telemetryPoints: Array<{
        tokenIndex: number;
        timeMs: number;
        interTokenLatencyMs: number;
        tps: number;
        cumulativeTps: number;
        isSpike: boolean;
      }> = [];

      const promptText = formatPrompt(messages, activeModelId, settings?.systemPrompt);
      const tokenizer = activeGenerator.tokenizer;

      const streamer = new TextStreamer(tokenizer, {
        skip_prompt: true,
        callback_function: (token: string) => {
          if (isAborted || stoppedEarly) return;

          const now = performance.now();
          if (firstTokenTime === null) {
            firstTokenTime = now;
          }

          // Compute inter-token latency (ms since previous token or prompt evaluation)
          const interTokenLatency = tokenCount === 0 
            ? Math.max(1, Math.round(now - startTime))
            : Math.max(1, Math.round(now - lastTokenTime));
          lastTokenTime = now;

          accumulatedRaw += token;
          tokenCount++;

          // Running average of recent latencies (excluding prompt ingestion token 1 for accurate steady-state spike threshold)
          if (tokenCount > 1) {
            recentLatencies.push(interTokenLatency);
          }

          const runningAvgLatency = recentLatencies.length > 0 
            ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length 
            : interTokenLatency;

          // Latency spike detection: noticeably higher than moving average (or > 120ms)
          const isSpike = tokenCount > 2 && (interTokenLatency > Math.max(65, runningAvgLatency * 1.65));

          const elapsedSec = (now - startTime) / 1000;
          const cumulativeTps = elapsedSec > 0 ? Math.round((tokenCount / elapsedSec) * 10) / 10 : 0;
          const instantaneousTps = interTokenLatency > 0 ? Math.round((1000 / interTokenLatency) * 10) / 10 : cumulativeTps;

          const point = {
            tokenIndex: tokenCount,
            timeMs: Math.round(now - startTime),
            interTokenLatencyMs: interTokenLatency,
            tps: instantaneousTps,
            cumulativeTps,
            isSpike
          };
          telemetryPoints.push(point);

          // Check if any stop sequence occurred
          const { cleaned, hasStop } = cleanStopSequences(accumulatedRaw);
          if (hasStop) {
            stoppedEarly = true;
            isAborted = true;
          }

          // Guard against runaway hallucinated repetition loops
          if (hasRepetitionLoop(accumulatedRaw)) {
            console.warn('Repetition loop detected in worker stream, terminating early.');
            stoppedEarly = true;
            isAborted = true;
          }

          self.postMessage({
            type: 'TOKEN_STREAM',
            payload: {
              token,
              fullCleanedSoFar: cleaned,
              point,
              metrics: {
                tokensGenerated: tokenCount,
                tokensPerSec: cumulativeTps,
                instantaneousTps,
                timeToFirstTokenMs: firstTokenTime ? Math.round(firstTokenTime - startTime) : 0,
                backendUsed: activeBackend,
                interTokenLatencyMs: interTokenLatency,
                avgLatencyMs: Math.round(runningAvgLatency),
                maxLatencyMs: recentLatencies.length > 0 ? Math.max(...recentLatencies) : interTokenLatency,
                spikeCount: telemetryPoints.filter(p => p.isSpike).length
              }
            }
          });
        }
      });

      try {
        const isFastMode = settings?.fastMode ?? true;
        const temperature = typeof settings?.temperature === 'number' ? settings.temperature : 0.6;
        const topP = typeof settings?.topP === 'number' ? settings.topP : 0.9;
        const topK = typeof settings?.topK === 'number' ? settings.topK : 40;
        const maxNewTokens = typeof settings?.maxTokens === 'number' && settings.maxTokens > 0 ? settings.maxTokens : 2048;

        // Optimized decoding configuration:
        // 1. use_cache: true leverages past_key_values tensor caching for O(1) step computation
        // 2. num_beams: 1 prevents multi-beam duplication overhead
        // 3. repetition_penalty: 1.18 prevents repetitive loops on low-bit models
        // 4. do_sample: false when temperature <= 0.1 or in fast mode
        const doSample = !isFastMode && temperature > 0.15;

        const generationOptions: any = {
          max_new_tokens: maxNewTokens,
          use_cache: true,
          num_beams: 1,
          return_full_text: false,
          repetition_penalty: 1.18,
          no_repeat_ngram_size: 4,
          streamer
        };

        if (doSample) {
          generationOptions.do_sample = true;
          generationOptions.temperature = Math.max(0.1, Math.min(temperature, 1.2));
          generationOptions.top_p = topP;
          generationOptions.top_k = Math.min(topK, 40);
        } else {
          generationOptions.do_sample = false;
        }

        await activeGenerator(promptText, generationOptions);

        const totalTimeMs = Math.round(performance.now() - startTime);
        const elapsedSec = totalTimeMs / 1000;
        const finalTokensPerSec = elapsedSec > 0 ? Math.round((tokenCount / elapsedSec) * 10) / 10 : 0;
        const avgLatency = recentLatencies.length > 0 
          ? Math.round(recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length) 
          : 0;
        const maxLatency = recentLatencies.length > 0 ? Math.max(...recentLatencies) : 0;
        const peakTps = telemetryPoints.length > 0 
          ? Math.max(...telemetryPoints.map((p) => p.tps)) 
          : finalTokensPerSec;
        const spikeCount = telemetryPoints.filter((p) => p.isSpike).length;

        const { cleaned: finalText } = cleanStopSequences(accumulatedRaw);

        self.postMessage({
          id,
          type: 'GENERATE_SUCCESS',
          payload: {
            text: finalText,
            metrics: {
              tokensGenerated: tokenCount,
              tokensPerSec: finalTokensPerSec,
              instantaneousTps: finalTokensPerSec,
              timeToFirstTokenMs: firstTokenTime ? Math.round(firstTokenTime - startTime) : totalTimeMs,
              totalTimeMs,
              backendUsed: activeBackend,
              peakTokensPerSec: peakTps,
              avgLatencyMs: avgLatency,
              maxLatencyMs: maxLatency,
              spikeCount,
              telemetry: telemetryPoints
            }
          }
        });
      } catch (genErr: any) {
        if (isAborted || stoppedEarly) {
          const { cleaned: finalText } = cleanStopSequences(accumulatedRaw);
          const totalTimeMs = Math.round(performance.now() - startTime);
          const elapsedSec = totalTimeMs / 1000;
          const finalTokensPerSec = elapsedSec > 0 ? Math.round((tokenCount / elapsedSec) * 10) / 10 : 0;
          const avgLatency = recentLatencies.length > 0 
            ? Math.round(recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length) 
            : 0;
          const maxLatency = recentLatencies.length > 0 ? Math.max(...recentLatencies) : 0;
          const peakTps = telemetryPoints.length > 0 
            ? Math.max(...telemetryPoints.map((p) => p.tps)) 
            : finalTokensPerSec;

          self.postMessage({
            id,
            type: 'GENERATE_SUCCESS',
            payload: {
              text: finalText,
              metrics: {
                tokensGenerated: tokenCount,
                tokensPerSec: finalTokensPerSec,
                instantaneousTps: finalTokensPerSec,
                timeToFirstTokenMs: firstTokenTime ? Math.round(firstTokenTime - startTime) : 0,
                totalTimeMs,
                backendUsed: activeBackend,
                peakTokensPerSec: peakTps,
                avgLatencyMs: avgLatency,
                maxLatencyMs: maxLatency,
                spikeCount: telemetryPoints.filter((p) => p.isSpike).length,
                telemetry: telemetryPoints
              }
            }
          });
          return;
        }

        console.error('Generation execution error:', genErr);
        self.postMessage({
          id,
          type: 'GENERATE_ERROR',
          payload: { error: genErr?.message || 'Inference execution failed' }
        });
      }
      break;
    }

    default:
      break;
  }
};
