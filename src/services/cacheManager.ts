/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  idbGetInstalledModels,
  idbSaveInstalledModel,
  idbRemoveInstalledModel
} from './db';
import { isModelInIndexedDB, removeModelFromIndexedDB } from './webllmRunner';

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
  'SmolLM2-135M-Instruct-q4f16_1-MLC': 'SmolLM2-135M-Instruct-q0f16-MLC',
};

/**
 * Retrieves registry of installed models from IndexedDB (with fallback to localStorage)
 */
export async function getInstalledModelRecordsAsync(): Promise<Record<string, InstalledModelRecord>> {
  const idbRecords = await idbGetInstalledModels();
  const localRecords = getInstalledModelRecords();

  const combined = { ...localRecords, ...idbRecords };

  let hasMigration = false;
  for (const [oldId, newId] of Object.entries(ID_MIGRATIONS)) {
    if (combined[oldId]) {
      combined[newId] = { ...combined[oldId], modelId: newId };
      delete combined[oldId];
      hasMigration = true;
    }
  }

  if (hasMigration) {
    try {
      localStorage.setItem(INSTALLED_MODELS_KEY, JSON.stringify(combined));
    } catch {}
  }

  return combined;
}

/**
 * Retrieves registry of installed models synchronously from localStorage
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
 * Marks a model as installed in both IndexedDB and localStorage
 */
export async function markModelInstalled(modelId: string, sizeMB: number): Promise<void> {
  const record: InstalledModelRecord = {
    modelId,
    installedAt: Date.now(),
    sizeMB,
    lastUsedAt: Date.now()
  };

  // 1. IndexedDB
  await idbSaveInstalledModel(record);

  // 2. localStorage
  const records = getInstalledModelRecords();
  records[modelId] = record;
  try {
    localStorage.setItem(INSTALLED_MODELS_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save installed model registry:', err);
  }
}

/**
 * Updates the last used timestamp for a model
 */
export async function touchModelUsage(modelId: string): Promise<void> {
  const records = await getInstalledModelRecordsAsync();
  if (records[modelId]) {
    records[modelId].lastUsedAt = Date.now();
    await idbSaveInstalledModel(records[modelId]);
    try {
      localStorage.setItem(INSTALLED_MODELS_KEY, JSON.stringify(records));
    } catch {
      // ignore
    }
  }
}

/**
 * Verifies if a model is physically present in IndexedDB
 */
export async function verifyModelInIndexedDB(modelId: string, webLlmId?: string): Promise<boolean> {
  // 1. Check WebLLM's tvmjs IndexedDB store
  const targetWebLlmId = webLlmId || (modelId.includes('-MLC') ? modelId : 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
  const inWebLlmIdb = await isModelInIndexedDB(targetWebLlmId);
  if (inWebLlmIdb) return true;

  // 2. Check application's installed models store in IndexedDB
  const records = await idbGetInstalledModels();
  return Boolean(records[modelId] || records[targetWebLlmId]);
}

/**
 * Removes a model from local tracking and purges its IndexedDB storage
 */
export async function uninstallModel(modelId: string): Promise<boolean> {
  // 1. Remove from Application IndexedDB
  await idbRemoveInstalledModel(modelId);

  // 2. Remove from WebLLM IndexedDB store
  await removeModelFromIndexedDB(modelId);
  if (!modelId.includes('-MLC')) {
    await removeModelFromIndexedDB('Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
  }

  // 3. Remove from localStorage
  const records = getInstalledModelRecords();
  delete records[modelId];
  delete records['Qwen2.5-1.5B-Instruct-q4f16_1-MLC'];
  try {
    localStorage.setItem(INSTALLED_MODELS_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }

  // 4. Clean cache if any stray CacheStorage exists (ensure zero Cache API residue)
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.includes('transformers') || name.includes('onnx') || name.includes('huggingface') || name.includes('webllm')) {
          await caches.delete(name);
        }
      }
    }
  } catch (err) {
    console.warn('Error purging cache items:', err);
  }

  return true;
}
