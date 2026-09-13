/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInfo } from '../types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  // ----------------------------------------------------
  // Bonsai 1.7B Family (PrismML / BitNet Edge Architecture)
  // ----------------------------------------------------
  {
    id: 'bonsai-1.7b-2bit',
    name: 'Bonsai 1.7B 2-Bit Ultra',
    tagline: 'PrismML ultra-compressed 2-Bit edge architecture for instantaneous private inference on mobile & entry devices.',
    parameterCount: '1.7B',
    quantization: '2-Bit Quantized',
    bitPrecision: '2-bit',
    downloadSizeMB: 380,
    minRamGB: 2,
    recommendedRamGB: 3,
    minCores: 2,
    contextLength: 4096,
    license: 'Apache-2.0',
    creator: 'PrismML',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'auto',
    dtype: 'q4',
    engineType: 'webllm',
    webLlmModelId: 'Qwen3-1.7B-q4f16_1-MLC',
    systemPromptDefault: 'You are Bonsai, an ultra-efficient on-device AI assistant created by PrismML running 100% privately in the browser.',
    samplePrompts: [
      'Explain how 1-bit and 2-bit quantization work in neural networks.',
      'Write a fast TypeScript debounce function with cleanup.',
      'Give me 3 practical morning productivity tips.'
    ]
  },
  {
    id: 'bonsai-1.7b-3bit',
    name: 'Bonsai 1.7B 3-Bit Speed',
    tagline: 'Ternary 3-Bit balance delivering fast inference speed with strong conversational coherence and zero repetition.',
    parameterCount: '1.7B',
    quantization: '3-Bit Quantized',
    bitPrecision: '3-bit',
    downloadSizeMB: 540,
    minRamGB: 2,
    recommendedRamGB: 4,
    minCores: 2,
    contextLength: 4096,
    license: 'Apache-2.0',
    creator: 'PrismML',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'auto',
    dtype: 'q4',
    engineType: 'webllm',
    webLlmModelId: 'Qwen3-1.7B-q4f16_1-MLC',
    systemPromptDefault: 'You are Bonsai, an efficient local language model developed by PrismML running directly on device.',
    samplePrompts: [
      'Summarize the core principles of edge AI and local inference.',
      'Write a Python function to validate and normalize URLs.',
      'List 5 high-protein vegetarian meal prep ideas.'
    ]
  },
  {
    id: 'bonsai-1.7b-4bit',
    name: 'Bonsai 1.7B 4-Bit Turbo',
    tagline: 'Full 4-Bit precision maximizing conversational coherence, code synthesis, and deep multi-turn reasoning.',
    parameterCount: '1.7B',
    quantization: '4-Bit Quantized',
    bitPrecision: '4-bit',
    downloadSizeMB: 720,
    minRamGB: 3,
    recommendedRamGB: 6,
    minCores: 4,
    contextLength: 4096,
    license: 'Apache-2.0',
    creator: 'PrismML',
    recommendedTiers: ['balanced', 'high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    webLlmModelId: 'Qwen3-1.7B-q4f16_1-MLC',
    systemPromptDefault: 'You are Bonsai, an advanced open-weights assistant by PrismML executing locally inside this web browser.',
    samplePrompts: [
      'Write a clean React custom hook for managing IndexedDB storage.',
      'Compare BitNet ternary weights with standard int4 matrix operations.',
      'Draft a detailed 3-day travel itinerary for Kyoto, Japan.'
    ]
  },

  // ----------------------------------------------------
  // Gemma 3 1B Family (Google Gemma 3 Architecture)
  // ----------------------------------------------------
  {
    id: 'gemma-3-1b-2bit',
    name: 'Gemma 3 1B 2-Bit Ultra',
    tagline: 'Google Gemma 3 1B compressed with 2-bit quantization for minimal VRAM footprint and rapid token throughput.',
    parameterCount: '1B',
    quantization: '2-Bit Quantized',
    bitPrecision: '2-bit',
    downloadSizeMB: 420,
    minRamGB: 2,
    recommendedRamGB: 3,
    minCores: 2,
    contextLength: 4096,
    license: 'Gemma Terms of Use',
    creator: 'Google',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'auto',
    dtype: 'q4',
    engineType: 'webllm',
    webLlmModelId: 'gemma3-1b-it-q4f16_1-MLC',
    systemPromptDefault: 'You are Gemma 3, a concise and intelligent on-device model developed by Google running locally.',
    samplePrompts: [
      'Explain how self-attention mechanisms work in transformer models.',
      'Write a JavaScript function to format large numbers with commas.',
      'What are 3 effective techniques for reducing cognitive fatigue?'
    ]
  },
  {
    id: 'gemma-3-1b-3bit',
    name: 'Gemma 3 1B 3-Bit Speed',
    tagline: 'Calibrated 3-bit quantization balancing token streaming speed and deep conversational comprehension.',
    parameterCount: '1B',
    quantization: '3-Bit Quantized',
    bitPrecision: '3-bit',
    downloadSizeMB: 590,
    minRamGB: 2,
    recommendedRamGB: 4,
    minCores: 2,
    contextLength: 4096,
    license: 'Gemma Terms of Use',
    creator: 'Google',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'auto',
    dtype: 'q4',
    engineType: 'webllm',
    webLlmModelId: 'gemma3-1b-it-q4f16_1-MLC',
    systemPromptDefault: 'You are Gemma 3, an advanced language model from Google running privately in the browser.',
    samplePrompts: [
      'Explain the difference between synchronous and asynchronous execution in Node.js.',
      'Write a Python script to find all duplicate files in a directory.',
      'Summarize the core benefits of on-device AI privacy.'
    ]
  },
  {
    id: 'gemma-3-1b-4bit',
    name: 'Gemma 3 1B 4-Bit Turbo',
    tagline: 'Official 4-Bit Gemma 3 with hardware WebGPU acceleration for rich coding and multi-turn reasoning.',
    parameterCount: '1B',
    quantization: '4-Bit Quantized',
    bitPrecision: '4-bit',
    downloadSizeMB: 750,
    minRamGB: 3,
    recommendedRamGB: 6,
    minCores: 4,
    contextLength: 4096,
    license: 'Gemma Terms of Use',
    creator: 'Google',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    webLlmModelId: 'gemma3-1b-it-q4f16_1-MLC',
    systemPromptDefault: 'You are Gemma 3, a state-of-the-art open model from Google running directly on-device in this browser.',
    samplePrompts: [
      'Analyze how FlashAttention optimizes memory bandwidth during inference.',
      'Write a Python function to solve the Longest Substring Without Repeating Characters.',
      'Compose a short poem about local computing without cloud servers.'
    ]
  }
];

