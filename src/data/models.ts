/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInfo } from '../types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'smollm2-135m-instruct',
    name: 'SmolLM2 135M Instruct',
    tagline: 'Ultra-compact 135M parameter edge model by Hugging Face TB. Ultra-fast, minimal memory footprint (~135MB), and optimized for NPUs, low-resource devices, and ≤2GB RAM.',
    parameterCount: '135M',
    quantization: '4-Bit Quantized (ONNX / WebGPU / NPU)',
    bitPrecision: '4-bit',
    downloadSizeMB: 135,
    minRamGB: 0.5,
    recommendedRamGB: 1,
    minCores: 2,
    contextLength: 2048,
    license: 'Apache-2.0',
    creator: 'Hugging Face (TB Team)',
    recommendedTiers: ['entry', 'balanced'],
    preferredBackend: 'auto',
    supportsNpu: true,
    dtype: 'q4',
    engineType: 'transformers',
    onnxModelId: 'onnx-community/SmolLM2-135M-Instruct-ONNX',
    webLlmModelId: 'SmolLM2-135M-Instruct-q0f16-MLC',
    systemPromptDefault: 'You are SmolLM2 (135M), an ultra-compact, lightning-fast on-device AI assistant.',
    samplePrompts: [
      'Write a clean JavaScript debounce helper function.',
      'Explain how NPUs differ from GPUs for local AI inference.',
      'Give me 3 tips for efficient learning.',
      'What are the advantages of ultra-compact language models?'
    ]
  },
  {
    id: 'qwen-2.5-0.5b-instruct',
    name: 'Qwen 2.5 0.5B Instruct',
    tagline: 'Ultra-lightweight 0.5B instruction-tuned model by Alibaba Cloud. Fast, low memory footprint, and specifically recommended for devices with ≤4GB RAM.',
    parameterCount: '0.5B',
    quantization: '4-Bit Quantized (q4f16_1)',
    bitPrecision: '4-bit',
    downloadSizeMB: 390,
    minRamGB: 1,
    recommendedRamGB: 2,
    minCores: 2,
    contextLength: 4096,
    license: 'Apache-2.0',
    creator: 'Alibaba Cloud (Qwen Team)',
    recommendedTiers: ['entry', 'balanced'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    onnxModelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    webLlmModelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    systemPromptDefault: 'You are Qwen 2.5 (0.5B), an efficient, concise, and helpful AI assistant running privately on-device in the browser.',
    samplePrompts: [
      'Write a clean JavaScript debounce helper function.',
      'Explain in simple terms how WebGPU speeds up AI in the browser.',
      'Provide 3 actionable tips to improve daily productivity.',
      'What are the advantages of running small language models on-device?'
    ]
  },
  {
    id: 'qwen-2.5-1.5b-instruct',
    name: 'Qwen 2.5 1.5B Instruct',
    tagline: 'High-capability 1.5B instruction-tuned model with deeper reasoning and analytical depth. Recommended for devices with >4GB RAM.',
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
    recommendedTiers: ['balanced', 'high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    onnxModelId: 'onnx-community/Qwen2.5-1.5B-Instruct',
    webLlmModelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    systemPromptDefault: 'You are Qwen 2.5 (1.5B), a helpful, precise, and intelligent AI assistant running locally and privately on-device in the browser.',
    samplePrompts: [
      'Write a fast TypeScript debounce function with cleanup.',
      'Explain how WebGPU compute shaders accelerate neural network inference.',
      'Give me 5 practical tips for staying focused during deep work sessions.',
      'Analyze the key architectural improvements in Qwen 2.5 compared to earlier models.'
    ]
  }
];
