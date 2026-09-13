/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  lastChecked: number;
}

let cachedStatus: WebGpuStatusInfo | null = null;
let activeInUseState = false;
const listeners = new Set<(status: WebGpuStatusInfo) => void>();

/**
 * Perform a live check of WebGPU availability and hardware capabilities
 */
export async function checkLiveWebGpu(forceRefresh = false): Promise<WebGpuStatusInfo> {
  if (cachedStatus && !forceRefresh && Date.now() - cachedStatus.lastChecked < 4000) {
    return { ...cachedStatus, activeInUse: activeInUseState };
  }

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;

  if (!nav || !nav.gpu) {
    const status: WebGpuStatusInfo = {
      supported: false,
      enabled: false,
      activeInUse: false,
      adapterName: null,
      reasonDisabled: 'WebGPU API is not supported or is disabled in your current browser.',
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
      lastChecked: Date.now()
    };
    cachedStatus = status;
    notifyListeners(status);
    return status;
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
