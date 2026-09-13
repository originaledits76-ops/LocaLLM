/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInfo } from '../types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'qwen-2.5-1.5b-instruct',
    name: 'Qwen 2.5 1.5B Instruct',
    tagline: 'High-capability 1.5B instruction-tuned model by Alibaba Cloud, running 100% on-device with WebGPU & IndexedDB storage.',
    parameterCount: '1.5B',
    quantization: '4-Bit Quantized (q4f16_1)',
    bitPrecision: '4-bit',
    downloadSizeMB: 980,
    minRamGB: 2,
    recommendedRamGB: 4,
    minCores: 4,
    contextLength: 4096,
    license: 'Apache-2.0',
    creator: 'Alibaba Cloud (Qwen Team)',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    webLlmModelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    systemPromptDefault: 'You are Qwen 2.5, a helpful, precise, and intelligent AI assistant running locally and privately on-device in the browser.',
    samplePrompts: [
      'Write a fast TypeScript debounce function with cleanup.',
      'Explain how WebGPU compute shaders accelerate neural network inference.',
      'Give me 5 practical tips for staying focused during deep work sessions.',
      'Analyze the key architectural improvements in Qwen 2.5 compared to earlier models.'
    ]
  }
];
