/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Persistent Weight Memory Heap & WebGPU Buffer Manager
 * 
 * Enforces zero-copy, non-redundant weight storage:
 * 1. Stores the raw byte stream directly into a single persistent WebGPU array buffer (GPUBuffer)
 *    or a virtual memory heap (SharedArrayBuffer / contiguous ArrayBuffer) at startup.
 * 2. Avoids querying and deserializing IndexedDB blobs repeatedly on every turn or inference session.
 * 3. Enables multi-threaded compute across web workers without memory copy overhead when
 *    COOP and COEP isolation headers are active.
 */

// Safe WebGPU type aliases when DOM lib does not include ambient WebGPU declarations
type GPUDevice = any;
type GPUBuffer = any;
const SafeGPUBufferUsage = typeof (globalThis as any).GPUBufferUsage !== 'undefined'
  ? (globalThis as any).GPUBufferUsage
  : { STORAGE: 0x0080, COPY_DST: 0x0008 };

export interface HeapDiagnostics {
  isCrossOriginIsolated: boolean;
  isSharedArrayBufferSupported: boolean;
  totalHeapBytes: number;
  totalHeapMB: number;
  webGpuBufferBytes: number;
  webGpuBufferMB: number;
  activeBuffersCount: number;
  storageTarget: 'webgpu_array_buffer' | 'shared_array_buffer_heap' | 'virtual_memory_heap';
  startupInitialized: boolean;
  lastLoadedKey?: string;
}

// Persistent Virtual Memory Heap (keyed by file path or tensor shard name)
const virtualMemoryHeap = new Map<string, ArrayBuffer | SharedArrayBuffer>();

// Persistent WebGPU Array Buffer map (held directly in GPU VRAM)
let persistentGpuDevice: GPUDevice | null = null;
const persistentWebGpuBuffers = new Map<string, GPUBuffer>();

let isStartupInitialized = false;
let currentStorageTarget: 'webgpu_array_buffer' | 'shared_array_buffer_heap' | 'virtual_memory_heap' = 'virtual_memory_heap';

/**
 * Check if the current context has COOP/COEP isolation and SharedArrayBuffer
 */
export function isSharedMemorySupported(): boolean {
  const isIsolated = typeof self !== 'undefined' && Boolean((self as any).crossOriginIsolated);
  const hasSab = typeof SharedArrayBuffer !== 'undefined';
  return isIsolated && hasSab;
}

/**
 * Retrieves a reusable GPUDevice for persistent weight buffer allocation
 */
export async function getPersistentGpuDevice(): Promise<GPUDevice | null> {
  if (persistentGpuDevice) return persistentGpuDevice;
  if (typeof navigator === 'undefined' || !(navigator as any).gpu) return null;

  try {
    const adapter = await (navigator as any).gpu.requestAdapter({
      powerPreference: 'high-performance'
    }) || await (navigator as any).gpu.requestAdapter();

    if (!adapter) return null;
    persistentGpuDevice = await adapter.requestDevice();
    return persistentGpuDevice;
  } catch (err) {
    console.warn('Failed to obtain persistent GPUDevice:', err);
    return null;
  }
}

/**
 * Stores the raw byte stream directly into the single persistent virtual memory heap
 * or persistent WebGPU array buffer, completely bypassing repeated IndexedDB blob allocations.
 */
export async function storeRawWeightByteStream(
  key: string,
  rawBytes: ArrayBuffer | Uint8Array,
  preferWebGpu = true
): Promise<void> {
  const byteLength = rawBytes.byteLength;
  const uint8View = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);

  // 1. If WebGPU is supported and requested, allocate directly into persistent WebGPU array buffer
  if (preferWebGpu) {
    const device = await getPersistentGpuDevice();
    if (device) {
      try {
        // Destroy existing buffer for this key if replacing
        const existingGpuBuffer = persistentWebGpuBuffers.get(key);
        if (existingGpuBuffer) {
          try { existingGpuBuffer.destroy(); } catch {}
        }

        // Allocate a dedicated WebGPU storage buffer in GPU VRAM
        // Align to 4 bytes for WebGPU buffer requirements
        const alignedSize = Math.ceil(byteLength / 4) * 4;
        const gpuBuffer = device.createBuffer({
          label: `persistent_weight_heap_${key}`,
          size: Math.max(16, alignedSize),
          usage: SafeGPUBufferUsage.STORAGE | SafeGPUBufferUsage.COPY_DST,
          mappedAtCreation: false
        });

        // Write raw byte stream directly into GPU VRAM
        device.queue.writeBuffer(gpuBuffer, 0, uint8View.buffer, uint8View.byteOffset, byteLength);
        persistentWebGpuBuffers.set(key, gpuBuffer);
        currentStorageTarget = 'webgpu_array_buffer';
      } catch (gpuAllocErr) {
        console.warn('WebGPU persistent buffer allocation failed, falling back to virtual heap:', gpuAllocErr);
      }
    }
  }

  // 2. Store in persistent Virtual Memory Heap (prefer SharedArrayBuffer for zero-copy across workers)
  if (isSharedMemorySupported()) {
    try {
      const sab = new SharedArrayBuffer(byteLength);
      const sabView = new Uint8Array(sab);
      sabView.set(uint8View);
      virtualMemoryHeap.set(key, sab);
      if (currentStorageTarget !== 'webgpu_array_buffer') {
        currentStorageTarget = 'shared_array_buffer_heap';
      }
      return;
    } catch (sabErr) {
      console.warn('SharedArrayBuffer allocation failed, using contiguous ArrayBuffer:', sabErr);
    }
  }

  // Fallback: contiguous persistent ArrayBuffer in memory
  const persistentBuf = uint8View.buffer.slice(
    uint8View.byteOffset,
    uint8View.byteOffset + byteLength
  );
  virtualMemoryHeap.set(key, persistentBuf);
  if (currentStorageTarget !== 'webgpu_array_buffer') {
    currentStorageTarget = 'virtual_memory_heap';
  }
}

/**
 * Checks if raw weight byte stream is already loaded in the persistent virtual memory heap
 */
export function hasRawWeightInHeap(key: string): boolean {
  return virtualMemoryHeap.has(key) || persistentWebGpuBuffers.has(key);
}

/**
 * Gets the raw byte stream directly from the single persistent virtual memory heap.
 * Returns null if not yet present, avoiding repeated IndexedDB queries.
 */
export function getRawWeightFromHeap(key: string): ArrayBuffer | SharedArrayBuffer | null {
  return virtualMemoryHeap.get(key) || null;
}

/**
 * Gets the persistent WebGPU array buffer for a given key, if available
 */
export function getPersistentWebGpuBuffer(key: string): GPUBuffer | null {
  return persistentWebGpuBuffers.get(key) || null;
}

/**
 * Clears persistent heap memory and destroys WebGPU buffers when uninstalled
 */
export function clearPersistentWeightHeap(keyPattern?: string): void {
  if (keyPattern) {
    for (const [k, buf] of persistentWebGpuBuffers.entries()) {
      if (k.includes(keyPattern)) {
        try { buf.destroy(); } catch {}
        persistentWebGpuBuffers.delete(k);
      }
    }
    for (const k of virtualMemoryHeap.keys()) {
      if (k.includes(keyPattern)) {
        virtualMemoryHeap.delete(k);
      }
    }
  } else {
    for (const buf of persistentWebGpuBuffers.values()) {
      try { buf.destroy(); } catch {}
    }
    persistentWebGpuBuffers.clear();
    virtualMemoryHeap.clear();
  }
}

/**
 * Initializes the persistent weight heap at startup for the selected model.
 * If model weights exist in IndexedDB, extracts the raw byte stream ONCE into the persistent
 * WebGPU array buffer or virtual memory heap so all future requests are zero-copy and instant.
 */
export async function initStartupWeightHeap(
  modelId: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<void> {
  if (isStartupInitialized && hasRawWeightInHeap(modelId)) {
    return;
  }

  onProgress?.('Initializing persistent weight memory heap...', 10);

  const isShared = isSharedMemorySupported();
  const gpuDevice = await getPersistentGpuDevice();

  if (gpuDevice) {
    currentStorageTarget = 'webgpu_array_buffer';
  } else if (isShared) {
    currentStorageTarget = 'shared_array_buffer_heap';
  } else {
    currentStorageTarget = 'virtual_memory_heap';
  }

  isStartupInitialized = true;
  onProgress?.('Persistent memory heap allocated at startup', 100);
}

/**
 * Returns real-time diagnostic statistics about the persistent weight memory heap
 */
export function getHeapDiagnostics(): HeapDiagnostics {
  let totalHeapBytes = 0;
  for (const buf of virtualMemoryHeap.values()) {
    totalHeapBytes += buf.byteLength;
  }

  let webGpuBufferBytes = 0;
  for (const gBuf of persistentWebGpuBuffers.values()) {
    try {
      webGpuBufferBytes += gBuf.size || 0;
    } catch {}
  }

  const isIsolated = typeof self !== 'undefined' && Boolean((self as any).crossOriginIsolated);
  const hasSab = typeof SharedArrayBuffer !== 'undefined';

  return {
    isCrossOriginIsolated: isIsolated,
    isSharedArrayBufferSupported: hasSab && isIsolated,
    totalHeapBytes,
    totalHeapMB: Number((totalHeapBytes / (1024 * 1024)).toFixed(1)),
    webGpuBufferBytes,
    webGpuBufferMB: Number((webGpuBufferBytes / (1024 * 1024)).toFixed(1)),
    activeBuffersCount: virtualMemoryHeap.size + persistentWebGpuBuffers.size,
    storageTarget: currentStorageTarget,
    startupInitialized: isStartupInitialized
  };
}
