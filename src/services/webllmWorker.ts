/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// Hook WebLLM handler to worker postMessage event loop
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
