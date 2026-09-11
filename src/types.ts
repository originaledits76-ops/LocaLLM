/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DeviceTier = 'entry' | 'balanced' | 'high';

export interface DeviceSpecs {
  ramGB: number;
  ramDetected: boolean;
  cpuCores: number;
  webGpuAvailable: boolean;
  webGpuAdapterName: string | null;
  webGlRenderer: string | null;
  storageQuotaMB: number | null;
  storageUsageMB: number | null;
  benchmarkScore: number; // 0 - 100
  benchmarkOpsPerSec: number;
  deviceTier: DeviceTier;
  osName: string;
}

export type ModelRecommendationLevel = 'perfect' | 'comfortable' | 'demanding' | 'unsupported';

export type EngineType = 'webllm' | 'transformers';

export interface ModelInfo {
  id: string; // Model id e.g. 'Llama-3.2-1B-Instruct-q4f16_1-MLC' or HuggingFace hub id
  name: string;
  tagline: string;
  parameterCount: string;
  quantization: string; // e.g. 'WebGPU q4f16_1 (TVM Shader)' or 'ONNX q4'
  downloadSizeMB: number;
  minRamGB: number;
  recommendedRamGB: number;
  minCores: number;
  contextLength: number;
  license: string;
  creator: string;
  recommendedTiers: DeviceTier[];
  preferredBackend: 'webgpu' | 'wasm' | 'auto';
  systemPromptDefault: string;
  samplePrompts: string[];
  bitPrecision?: '2-bit' | '3-bit' | '4-bit' | 'fp16';
  dtype: 'q2' | 'q3' | 'q4' | 'q4f16' | 'q0f16' | 'q8' | 'fp32';
  engineType?: EngineType;
  webLlmModelId?: string;
}

export interface ModelRecommendation {
  model: ModelInfo;
  level: ModelRecommendationLevel;
  score: number; // 0 - 100
  reason: string;
  isBestPick: boolean;
}

export type InstallStatus = 'not_installed' | 'downloading' | 'ready' | 'loading' | 'active' | 'error';

export interface DownloadProgress {
  file: string;
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  speedMBps?: number;
}

export interface ModelRuntimeState {
  status: InstallStatus;
  progress: number; // 0 - 100
  statusMessage: string;
  activeFile?: string;
  downloadedBytes: number;
  totalBytes: number;
  error?: string | null;
  lastLoadedAt?: number;
}

export interface TelemetryPoint {
  tokenIndex: number;
  timeMs: number;
  interTokenLatencyMs: number;
  tps: number;
  cumulativeTps: number;
  isSpike?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelId: string;
  metrics?: {
    tokensGenerated?: number;
    tokensPerSec?: number;
    instantaneousTps?: number;
    timeToFirstTokenMs?: number;
    totalTimeMs?: number;
    backendUsed?: 'webgpu' | 'wasm' | 'cpu';
    peakTokensPerSec?: number;
    avgLatencyMs?: number;
    maxLatencyMs?: number;
    spikeCount?: number;
    telemetry?: TelemetryPoint[];
  };
}

export interface InferenceSettings {
  maxTokens: number;
  temperature: number;
  topP: number;
  topK?: number;
  fastMode?: boolean;
  systemPrompt: string;
  preferWebGpu: boolean;
  quantizationPreference?: 'auto' | '2bit' | '3bit' | '4bit';
  engine?: 'auto' | 'webllm' | 'transformers';
}
