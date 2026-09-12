/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatMessage, DeviceSpecs, InferenceSettings } from '../types';
import { InstalledModelRecord } from './cacheManager';

const DB_NAME = 'Aidora_Local_AI_DB';
const DB_VERSION = 1;

export interface ChatSession {
  id: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes and returns the single IndexedDB database connection instance
 */
export function getIDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Chat Sessions Store
        if (!db.objectStoreNames.contains('chat_sessions')) {
          const sessionStore = db.createObjectStore('chat_sessions', { keyPath: 'id' });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 2. Chat Messages Store
        if (!db.objectStoreNames.contains('chat_messages')) {
          const msgStore = db.createObjectStore('chat_messages', { keyPath: 'id' });
          msgStore.createIndex('sessionId', 'sessionId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 3. Installed Model Records Store
        if (!db.objectStoreNames.contains('installed_models')) {
          db.createObjectStore('installed_models', { keyPath: 'modelId' });
        }

        // 4. Hardware Diagnostic Specs Cache
        if (!db.objectStoreNames.contains('hardware_specs')) {
          db.createObjectStore('hardware_specs', { keyPath: 'id' });
        }

        // 5. Application Inference Settings
        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

/* ==========================================================================
   INSTALLED MODELS INDEXEDDB STORAGE
   ========================================================================== */

export async function idbGetInstalledModels(): Promise<Record<string, InstalledModelRecord>> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('installed_models', 'readonly');
      const store = tx.objectStore('installed_models');
      const request = store.getAll();

      request.onsuccess = () => {
        const list: InstalledModelRecord[] = request.result || [];
        const records: Record<string, InstalledModelRecord> = {};
        for (const item of list) {
          records[item.modelId] = item;
        }
        resolve(records);
      };

      request.onerror = () => {
        resolve({});
      };
    });
  } catch (err) {
    console.warn('IDB get installed models error:', err);
    return {};
  }
}

export async function idbSaveInstalledModel(record: InstalledModelRecord): Promise<void> {
  try {
    const db = await getIDB();
    const tx = db.transaction('installed_models', 'readwrite');
    const store = tx.objectStore('installed_models');
    store.put(record);
  } catch (err) {
    console.warn('IDB save installed model error:', err);
  }
}

export async function idbRemoveInstalledModel(modelId: string): Promise<void> {
  try {
    const db = await getIDB();
    const tx = db.transaction('installed_models', 'readwrite');
    const store = tx.objectStore('installed_models');
    store.delete(modelId);
  } catch (err) {
    console.warn('IDB remove installed model error:', err);
  }
}

/* ==========================================================================
   CHAT MESSAGES & SESSIONS INDEXEDDB STORAGE
   ========================================================================== */

export async function idbGetMessagesForSession(sessionId: string): Promise<ChatMessage[]> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('chat_messages', 'readonly');
      const store = tx.objectStore('chat_messages');
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => {
        const msgs: ChatMessage[] = request.result || [];
        // Sort chronologically
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        resolve(msgs);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('IDB get messages error:', err);
    return [];
  }
}

export async function idbGetAllMessages(): Promise<ChatMessage[]> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('chat_messages', 'readonly');
      const store = tx.objectStore('chat_messages');
      const request = store.getAll();

      request.onsuccess = () => {
        const msgs: ChatMessage[] = request.result || [];
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        resolve(msgs);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('IDB get all messages error:', err);
    return [];
  }
}

export async function idbSaveMessage(msg: ChatMessage & { sessionId?: string }): Promise<void> {
  try {
    const db = await getIDB();
    const tx = db.transaction('chat_messages', 'readwrite');
    const store = tx.objectStore('chat_messages');
    store.put({
      ...msg,
      sessionId: msg.sessionId || 'default_session'
    });
  } catch (err) {
    console.warn('IDB save message error:', err);
  }
}

export async function idbSaveMessages(msgs: Array<ChatMessage & { sessionId?: string }>): Promise<void> {
  try {
    const db = await getIDB();
    const tx = db.transaction('chat_messages', 'readwrite');
    const store = tx.objectStore('chat_messages');
    for (const msg of msgs) {
      store.put({
        ...msg,
        sessionId: msg.sessionId || 'default_session'
      });
    }
  } catch (err) {
    console.warn('IDB save messages error:', err);
  }
}

export async function idbClearMessagesForSession(sessionId: string = 'default_session'): Promise<void> {
  try {
    const db = await getIDB();
    const tx = db.transaction('chat_messages', 'readwrite');
    const store = tx.objectStore('chat_messages');
    const index = store.index('sessionId');
    const request = index.openKeyCursor(IDBKeyRange.only(sessionId));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursor>).result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  } catch (err) {
    console.warn('IDB clear session messages error:', err);
  }
}

export async function idbClearAllMessages(): Promise<void> {
  try {
    const db = await getIDB();
    const tx = db.transaction('chat_messages', 'readwrite');
    const store = tx.objectStore('chat_messages');
    store.clear();
  } catch (err) {
    console.warn('IDB clear all messages error:', err);
  }
}

/* ==========================================================================
   HARDWARE SPECS INDEXEDDB STORAGE
   ========================================================================== */

export async function idbGetCachedSpecs(): Promise<DeviceSpecs | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('hardware_specs', 'readonly');
      const store = tx.objectStore('hardware_specs');
      const request = store.get('current_device_profile');

      request.onsuccess = () => {
        resolve(request.result?.specs || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function idbSaveCachedSpecs(specs: DeviceSpecs): Promise<void> {
  try {
    const db = await getIDB();
    const tx = db.transaction('hardware_specs', 'readwrite');
    const store = tx.objectStore('hardware_specs');
    store.put({ id: 'current_device_profile', specs, savedAt: Date.now() });
  } catch (err) {
    console.warn('IDB save specs error:', err);
  }
}

/* ==========================================================================
   APPLICATION SETTINGS INDEXEDDB STORAGE
   ========================================================================== */

export async function idbGetSettings(): Promise<InferenceSettings | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction('app_settings', 'readonly');
      const store = tx.objectStore('app_settings');
      const request = store.get('user_settings');

      request.onsuccess = () => {
        resolve(request.result?.settings || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function idbSaveSettings(settings: InferenceSettings): Promise<void> {
  try {
    const db = await getIDB();
    const tx = db.transaction('app_settings', 'readwrite');
    const store = tx.objectStore('app_settings');
    store.put({ id: 'user_settings', settings, updatedAt: Date.now() });
  } catch (err) {
    console.warn('IDB save settings error:', err);
  }
}
