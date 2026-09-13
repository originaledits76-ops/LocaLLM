/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getHeapDiagnostics, HeapDiagnostics } from './weightMemoryHeap';

export interface WebGpuStatusInfo {
  supported: boolean;
  enabled: boolean;
  activeInUse: boolean;
  adapterName: string | null;
  vendor?: string;
  architecture?: string;
  description?: string;
  maxBufferSizeMB?: number;
  reasonDisabled?: string;
  isCrossOriginIsolated: boolean;
  hasSharedArrayBuffer: boolean;
  heapDiagnostics: HeapDiagnostics;
  npuAvailable: boolean;
  npuName: string | null;
  npuActive: boolean;
  npuBackend?: 'webnn' | 'hardware' | null;
  lastChecked: number;
}

let cachedStatus: WebGpuStatusInfo | null = null;
let activeInUseState = false;
let activeNpuState = false;
const listeners = new Set<(status: WebGpuStatusInfo) => void>();

/**
 * Check if hardware NPU is available via WebNN API or neural coprocessor
 */
async function checkNpuAvailability(): Promise<{ available: boolean; name: string | null; backend: 'webnn' | 'hardware' | null }> {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (!nav) return { available: false, name: null, backend: null };

    // Check W3C WebNN API
    if (nav.ml && typeof nav.ml.createContext === 'function') {
      try {
        const ctx = await nav.ml.createContext({ deviceType: 'npu' });
        if (ctx) {
          return { available: true, name: 'WebNN Dedicated Hardware NPU', backend: 'webnn' };
        }
      } catch {
        try {
          const lowPowerCtx = await nav.ml.createContext({ powerPreference: 'low-power' });
          if (lowPowerCtx) {
            return { available: true, name: 'WebNN Neural Engine (Low-Power)', backend: 'webnn' };
          }
        } catch {
          // not active
        }
      }
    }

    // Check GPU adapter for NPU / Neural keywords
    if (nav.gpu && typeof nav.gpu.requestAdapter === 'function') {
      try {
        const lowPowerAdapter = await nav.gpu.requestAdapter({ powerPreference: 'low-power' });
        if (lowPowerAdapter?.info) {
          const info = lowPowerAdapter.info;
          const desc = [info.vendor, info.architecture, info.description].filter(Boolean).join(' ');
          if (/npu|neural|vpu|ai boost|hexagon|ane|directml|ryzen ai/i.test(desc)) {
            return { available: true, name: desc || 'Hardware Neural Processing Unit', backend: 'hardware' };
          }
        }
      } catch {
        // ignore
      }
    }

    if (nav.webnn || (typeof window !== 'undefined' && (window as any).webnn)) {
      return { available: true, name: 'WebNN DirectML Neural Accelerator', backend: 'webnn' };
    }
  } catch (err) {
    console.warn('NPU check notice:', err);
  }
  return { available: false, name: null, backend: null };
}

/**
 * Perform a live check of WebGPU availability and hardware capabilities
 */
export async function checkLiveWebGpu(forceRefresh = false): Promise<WebGpuStatusInfo> {
  const isIsolated = typeof self !== 'undefined' && Boolean((self as any).crossOriginIsolated);
  const hasSab = typeof SharedArrayBuffer !== 'undefined';
  const heapDiagnostics = getHeapDiagnostics();
  const npuInfo = await checkNpuAvailability();

  if (cachedStatus && !forceRefresh && Date.now() - cachedStatus.lastChecked < 4000) {
    return {
      ...cachedStatus,
      activeInUse: activeInUseState,
      npuActive: activeNpuState,
      npuAvailable: npuInfo.available,
      npuName: npuInfo.name,
      npuBackend: npuInfo.backend,
      isCrossOriginIsolated: isIsolated,
      hasSharedArrayBuffer: hasSab && isIsolated,
      heapDiagnostics
    };
  }

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;

  if (!nav || !nav.gpu) {
    const status: WebGpuStatusInfo = {
      supported: false,
      enabled: false,
      activeInUse: false,
      adapterName: null,
      reasonDisabled: 'WebGPU API is not supported or is disabled in your current browser.',
      isCrossOriginIsolated: isIsolated,
      hasSharedArrayBuffer: hasSab && isIsolated,
      heapDiagnostics,
      npuAvailable: npuInfo.available,
      npuName: npuInfo.name,
      npuActive: activeNpuState,
      npuBackend: npuInfo.backend,
      lastChecked: Date.now()
    };
    cachedStatus = status;
    notifyListeners(status);
    return status;
  }

  try {
    let adapter = null;
    try {
      adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
    } catch {
      adapter = null;
    }

    if (!adapter) {
      try {
        adapter = await nav.gpu.requestAdapter();
      } catch {
        adapter = null;
      }
    }

    if (!adapter) {
      const status: WebGpuStatusInfo = {
        supported: true,
        enabled: false,
        activeInUse: false,
        adapterName: null,
        reasonDisabled: 'WebGPU adapter could not be initialized. Hardware acceleration may be disabled in browser settings or flags.',
        isCrossOriginIsolated: isIsolated,
        hasSharedArrayBuffer: hasSab && isIsolated,
        heapDiagnostics,
        npuAvailable: npuInfo.available,
        npuName: npuInfo.name,
        npuActive: activeNpuState,
        npuBackend: npuInfo.backend,
        lastChecked: Date.now()
      };
      cachedStatus = status;
      notifyListeners(status);
      return status;
    }

    // Extract adapter information
    const adapterInfo = adapter.info || {};
    const vendor = adapterInfo.vendor || '';
    const architecture = adapterInfo.architecture || '';
    const description = adapterInfo.description || '';
    const adapterName = [vendor, architecture, description].filter(Boolean).join(' ') || 'Hardware GPU Adapter';

    let maxBufferSizeMB: number | undefined;
    if (adapter.limits && adapter.limits.maxBufferSize) {
      maxBufferSizeMB = Math.round(adapter.limits.maxBufferSize / (1024 * 1024));
    }

    const status: WebGpuStatusInfo = {
      supported: true,
      enabled: true,
      activeInUse: activeInUseState,
      adapterName,
      vendor,
      architecture,
      description,
      maxBufferSizeMB,
      isCrossOriginIsolated: isIsolated,
      hasSharedArrayBuffer: hasSab && isIsolated,
      heapDiagnostics,
      npuAvailable: npuInfo.available,
      npuName: npuInfo.name,
      npuActive: activeNpuState,
      npuBackend: npuInfo.backend,
      lastChecked: Date.now()
    };
    cachedStatus = status;
    notifyListeners(status);
    return status;
  } catch (err: any) {
    const status: WebGpuStatusInfo = {
      supported: true,
      enabled: false,
      activeInUse: false,
      adapterName: null,
      reasonDisabled: err?.message || 'Error acquiring WebGPU hardware adapter.',
      isCrossOriginIsolated: isIsolated,
      hasSharedArrayBuffer: hasSab && isIsolated,
      heapDiagnostics,
      npuAvailable: npuInfo.available,
      npuName: npuInfo.name,
      npuActive: activeNpuState,
      npuBackend: npuInfo.backend,
      lastChecked: Date.now()
    };
    cachedStatus = status;
    notifyListeners(status);
    return status;
  }
}

/**
 * Mark whether NPU is actively in use for inference
 */
export function setNpuActiveInUse(inUse: boolean) {
  activeNpuState = inUse;
  if (cachedStatus) {
    cachedStatus = { ...cachedStatus, npuActive: inUse };
    notifyListeners(cachedStatus);
  }
}

/**
 * Mark whether WebGPU is actively in use for inference
 */
export function setWebGpuActiveInUse(inUse: boolean) {
  activeInUseState = inUse;
  if (cachedStatus) {
    cachedStatus = { ...cachedStatus, activeInUse: inUse };
    notifyListeners(cachedStatus);
  } else {
    checkLiveWebGpu();
  }
}

/**
 * Subscribe to WebGPU status updates
 */
export function subscribeWebGpuStatus(callback: (status: WebGpuStatusInfo) => void): () => void {
  listeners.add(callback);
  if (cachedStatus) {
    callback(cachedStatus);
  } else {
    checkLiveWebGpu();
  }
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners(status: WebGpuStatusInfo) {
  listeners.forEach((cb) => {
    try {
      cb(status);
    } catch {}
  });
}
