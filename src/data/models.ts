/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelInfo } from '../types';

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'SmolLM2-135M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 135M Turbo (WebLLM)',
    tagline: 'Ultra-fast WebLLM WebGPU engine achieving 60-120+ tokens/sec with near-zero latency.',
    parameterCount: '135M',
    quantization: 'WebGPU q4f16_1 (TVM Shader)',
    downloadSizeMB: 120,
    minRamGB: 2,
    recommendedRamGB: 4,
    minCores: 2,
    contextLength: 2048,
    license: 'Apache-2.0',
    creator: 'Hugging Face / MLC-AI',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    webLlmModelId: 'SmolLM2-135M-Instruct-q4f16_1-MLC',
    systemPromptDefault: 'You are a concise, helpful, and friendly local AI assistant running directly in the browser via WebLLM WebGPU hardware acceleration.',
    samplePrompts: [
      'Explain how a neural network learns in 3 bullet points.',
      'Write a Python function to check if a string is a palindrome.',
      'Give me 5 creative ideas for a minimalist workspace.'
    ]
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 0.5B Turbo (WebLLM)',
    tagline: 'High-speed reasoning and code model compiled to native WebGPU shaders for peak throughput.',
    parameterCount: '0.5B',
    quantization: 'WebGPU q4f16_1 (TVM Shader)',
    downloadSizeMB: 340,
    minRamGB: 3,
    recommendedRamGB: 6,
    minCores: 4,
    contextLength: 4096,
    license: 'Apache-2.0',
    creator: 'Alibaba Cloud / MLC-AI',
    recommendedTiers: ['balanced', 'high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    webLlmModelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    systemPromptDefault: 'You are Qwen 2.5, an advanced openweight language model running locally on-device in the browser with WebLLM acceleration.',
    samplePrompts: [
      'Write a TypeScript interface and validator for a user profile.',
      'Summarize the core trade-offs of client-side vs server-side rendering.',
      'Compose a haiku about running artificial intelligence offline.'
    ]
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Turbo (WebLLM)',
    tagline: 'State-of-the-art 1B parameter model with WebLLM GPU shader kernels for fast, rich answers.',
    parameterCount: '1B',
    quantization: 'WebGPU q4f16_1 (TVM Shader)',
    downloadSizeMB: 680,
    minRamGB: 4,
    recommendedRamGB: 8,
    minCores: 4,
    contextLength: 4096,
    license: 'Llama 3.2 Community',
    creator: 'Meta / MLC-AI',
    recommendedTiers: ['balanced', 'high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    systemPromptDefault: 'You are Llama 3.2, an intelligent assistant running entirely locally inside this web browser with WebLLM GPU acceleration.',
    samplePrompts: [
      'Analyze the philosophical concept of Occam\'s razor with a practical example.',
      'Write a clean, modular React hook for debouncing search input.',
      'Outline a 4-week beginner marathon training schedule.'
    ]
  },
  {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 360M Turbo (WebLLM)',
    tagline: 'Balanced compact model delivering high conversational coherence with instantaneous response.',
    parameterCount: '360M',
    quantization: 'WebGPU q4f16_1 (TVM Shader)',
    downloadSizeMB: 230,
    minRamGB: 3,
    recommendedRamGB: 4,
    minCores: 2,
    contextLength: 2048,
    license: 'Apache-2.0',
    creator: 'Hugging Face / MLC-AI',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    webLlmModelId: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    systemPromptDefault: 'You are a helpful and intelligent local AI model running locally in the browser with WebLLM acceleration.',
    samplePrompts: [
      'Draft a polite email asking for a status update on a project.',
      'What are the primary differences between CPU and GPU compute?',
      'Suggest 3 quick nutritious dinner recipes with 5 ingredients or fewer.'
    ]
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC',
    name: 'DeepSeek R1 Distill 1.5B Turbo (WebLLM)',
    tagline: 'Reasoning-distilled model capable of chain-of-thought problem solving running on WebGPU.',
    parameterCount: '1.5B',
    quantization: 'WebGPU q4f16_1 (TVM Shader)',
    downloadSizeMB: 920,
    minRamGB: 6,
    recommendedRamGB: 10,
    minCores: 6,
    contextLength: 4096,
    license: 'MIT',
    creator: 'DeepSeek / MLC-AI',
    recommendedTiers: ['high'],
    preferredBackend: 'webgpu',
    dtype: 'q4f16',
    engineType: 'webllm',
    webLlmModelId: 'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC',
    systemPromptDefault: 'You are a local reasoning assistant. Think through problems step by step before arriving at answers.',
    samplePrompts: [
      'Solve this riddle: If 3 cats catch 3 mice in 3 minutes, how many cats do you need to catch 100 mice in 100 minutes?',
      'Explain how public-key cryptography (RSA) functions mathematically.',
      'Refactor a nested asynchronous loop into a concurrent stream with backpressure.'
    ]
  },
  {
    id: 'onnx-community/SmolLM2-135M-Instruct-ONNX',
    name: 'SmolLM2 135M (CPU WASM / ONNX)',
    tagline: 'Universal multi-threaded CPU WASM engine fallback for devices without WebGPU hardware.',
    parameterCount: '135M',
    quantization: 'ONNX q4 (WASM Multi-thread)',
    downloadSizeMB: 185,
    minRamGB: 2,
    recommendedRamGB: 4,
    minCores: 2,
    contextLength: 2048,
    license: 'Apache-2.0',
    creator: 'Hugging Face TB',
    recommendedTiers: ['entry', 'balanced', 'high'],
    preferredBackend: 'wasm',
    dtype: 'q4',
    engineType: 'transformers',
    systemPromptDefault: 'You are a concise, helpful, and friendly local AI assistant running directly in the user\'s web browser via ONNX Runtime.',
    samplePrompts: [
      'Explain how a neural network learns in 3 bullet points.',
      'Write a Python function to check if a string is a palindrome.',
      'Give me 5 creative ideas for a minimalist workspace.'
    ]
  }
];
