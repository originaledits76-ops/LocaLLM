/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const INSTALLED_MODELS_KEY = 'local_models_installed_registry_v1';

export interface InstalledModelRecord {
  modelId: string;
  installedAt: number;
  sizeMB: number;
  lastUsedAt?: number;
}

const ID_MIGRATIONS: Record<string, string> = {
  'onnx-community/SmolLM2-135M-Instruct': 'onnx-community/SmolLM2-135M-Instruct-ONNX',
  'onnx-community/SmolLM2-360M-Instruct': 'onnx-community/SmolLM2-360M-Instruct-ONNX',
  'onnx-community/Llama-3.2-1B-Instruct': 'onnx-community/Llama-3.2-1B-Instruct-ONNX',
};

/**
 * Retrieves registry of installed models from localStorage
 */
export function getInstalledModelRecords(): Record<string, InstalledModelRecord> {
  try {
    const raw = localStorage.getItem(INSTALLED_MODELS_KEY);
    if (!raw) return {};
    const parsed: Record<string, InstalledModelRecord> = JSON.parse(raw);
    let hasMigration = false;
    for (const [oldId, newId] of Object.entries(ID_MIGRATIONS)) {
      if (parsed[oldId]) {
        parsed[newId] = { ...parsed[oldId], modelId: newId };
        delete parsed[oldId];
        hasMigration = true;
      }
    }
    if (hasMigration) {
      try {
        localStorage.setItem(INSTALLED_MODELS_KEY, JSON.stringify(parsed));
      } catch {
        // ignore
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

/**
 * Marks a model as installed
 */
export function markModelInstalled(modelId: string, sizeMB: number): void {
  const records = getInstalledModelRecords();
  records[modelId] = {
    modelId,
    installedAt: Date.now(),
    sizeMB,
    lastUsedAt: Date.now()
  };
  try {
    localStorage.setItem(INSTALLED_MODELS_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save installed model registry:', err);
  }
}

/**
 * Updates the last used timestamp for a model
 */
export function touchModelUsage(modelId: string): void {
  const records = getInstalledModelRecords();
  if (records[modelId]) {
    records[modelId].lastUsedAt = Date.now();
    try {
      localStorage.setItem(INSTALLED_MODELS_KEY, JSON.stringify(records));
    } catch {
      // ignore
    }
  }
}

/**
 * Removes a model from local tracking and attempts to purge its cached entries
 */
export async function uninstallModel(modelId: string): Promise<boolean> {
  // 1. Remove from registry
  const records = getInstalledModelRecords();
  delete records[modelId];
  try {
    localStorage.setItem(INSTALLED_MODELS_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }

  // 2. Clean cache if CacheStorage is supported
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.includes('transformers') || name.includes('onnx') || name.includes('huggingface')) {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          for (const req of requests) {
            if (req.url.includes(modelId.replace('/', '%2F')) || req.url.includes(modelId)) {
              await cache.delete(req);
            }
          }
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('Error purging cache items:', err);
    return true;
  }
}
