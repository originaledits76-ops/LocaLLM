/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AVAILABLE_MODELS } from '../data/models';
import { DeviceSpecs, DeviceTier, ModelInfo, ModelRecommendation } from '../types';

/**
 * Runs a micro-benchmark measuring floating-point operations in JavaScript
 * Runs for ~100-150ms without blocking UI.
 */
export async function runMicroBenchmark(): Promise<{ score: number; opsPerSec: number }> {
  return new Promise((resolve) => {
    // Run on next tick to avoid blocking render
    setTimeout(() => {
      const startTime = performance.now();
      const targetDuration = 120; // 120ms benchmark window
      let ops = 0;
      let acc = 1.0;

      // Tight loop calculating FP math & array access
      while (performance.now() - startTime < targetDuration) {
        for (let i = 0; i < 20000; i++) {
          acc = (acc * 1.00013 + Math.sin(i)) % 1000;
        }
        ops += 20000;
      }

      const elapsed = performance.now() - startTime;
      const opsPerSec = Math.round((ops / (elapsed / 1000)));

      // Baseline scaling: 100M ops/sec ~ 50 score, 300M+ ops/sec ~ 90+ score
      const normalizedScore = Math.min(100, Math.max(15, Math.round((opsPerSec / 3500000) * 100)));

      // Avoid unused variable warning
      if (acc === 0) console.log(acc);

      resolve({
        score: normalizedScore,
        opsPerSec
      });
    }, 20);
  });
}

/**
 * Detects device hardware specifications using web APIs
 */
export async function scanDeviceHardware(customRamGB?: number): Promise<DeviceSpecs> {
  const nav = navigator as unknown as {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    gpu?: {
      requestAdapter: () => Promise<{
        info?: { vendor?: string; architecture?: string; description?: string };
        limits?: Record<string, unknown>;
      } | null>;
    };
    userAgent?: string;
    platform?: string;
  };

  // 1. CPU cores
  const cpuCores = nav.hardwareConcurrency || 4;

  // 2. RAM estimation
  let ramDetected = false;
  let ramGB = 4; // default conservative estimate

  if (typeof customRamGB === 'number' && customRamGB > 0) {
    ramGB = customRamGB;
    ramDetected = true;
  } else if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0) {
    ramGB = nav.deviceMemory;
    ramDetected = true;
  } else {
    // Heuristic based on core count
    if (cpuCores >= 8) ramGB = 8;
    else if (cpuCores >= 4) ramGB = 4;
    else ramGB = 2;
  }

  // 3. WebGPU check
  let webGpuAvailable = false;
  let webGpuAdapterName: string | null = null;

  try {
    if (nav.gpu && typeof (nav.gpu as any).requestAdapter === 'function') {
      let adapter = null;
      try {
        adapter = await (nav.gpu as any).requestAdapter({ powerPreference: 'high-performance' });
      } catch {
        adapter = null;
      }
      if (!adapter) {
        try {
          adapter = await (nav.gpu as any).requestAdapter();
        } catch {
          adapter = null;
        }
      }
      if (!adapter) {
        try {
          adapter = await (nav.gpu as any).requestAdapter({ powerPreference: 'low-power' });
        } catch {
          adapter = null;
        }
      }

      if (adapter) {
        webGpuAvailable = true;
        const info = (adapter as unknown as { info?: { architecture?: string; description?: string; vendor?: string } }).info;
        if (info && (info.description || info.architecture || info.vendor)) {
          webGpuAdapterName = [info.vendor, info.architecture, info.description].filter(Boolean).join(' ') || 'Hardware GPU Accelerator';
        } else {
          webGpuAdapterName = 'Hardware GPU Accelerator';
        }
      }
    }
  } catch {
    webGpuAvailable = false;
  }

  // 4. WebGL renderer check
  let webGlRenderer: string | null = null;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        webGlRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      } else {
        webGlRenderer = gl.getParameter(gl.RENDERER);
      }
    }
  } catch {
    webGlRenderer = null;
  }

  // 5. Storage estimate
  let storageQuotaMB: number | null = null;
  let storageUsageMB: number | null = null;
  try {
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) {
        storageQuotaMB = Math.round(estimate.quota / (1024 * 1024));
      }
      if (estimate.usage) {
        storageUsageMB = Math.round(estimate.usage / (1024 * 1024));
      }
    }
  } catch {
    // Ignore storage quota error
  }

  // 6. OS Name
  const userAgent = navigator.userAgent || '';
  let osName = 'Desktop';
  if (/Mac/i.test(userAgent)) osName = 'macOS';
  else if (/Win/i.test(userAgent)) osName = 'Windows';
  else if (/Linux/i.test(userAgent)) osName = 'Linux';
  else if (/Android/i.test(userAgent)) osName = 'Android';
  else if (/iPhone|iPad/i.test(userAgent)) osName = 'iOS';

  // 7. Micro benchmark
  const { score: benchmarkScore, opsPerSec: benchmarkOpsPerSec } = await runMicroBenchmark();

  // 8. Device tier classification
  let deviceTier: DeviceTier = 'entry';
  if ((ramGB >= 8 && cpuCores >= 6) || (webGpuAvailable && ramGB >= 6)) {
    deviceTier = 'high';
  } else if (ramGB >= 4 && cpuCores >= 4) {
    deviceTier = 'balanced';
  } else {
    deviceTier = 'entry';
  }

  return {
    ramGB,
    ramDetected,
    cpuCores,
    webGpuAvailable,
    webGpuAdapterName,
    webGlRenderer,
    storageQuotaMB,
    storageUsageMB,
    benchmarkScore,
    benchmarkOpsPerSec,
    deviceTier,
    osName
  };
}

/**
 * Calculates model recommendations tailored specifically to the measured device specs
 */
export function evaluateModelRecommendations(
  specs: DeviceSpecs,
  models: ModelInfo[] = AVAILABLE_MODELS
): ModelRecommendation[] {
  return models.map((model) => {
    let score = 50;
    let level: ModelRecommendation['level'] = 'comfortable';
    const reasons: string[] = [];

    // RAM factor & Hardware Matching
    if (specs.ramGB <= 4) {
      if (model.id === 'qwen-2.5-0.5b-instruct' || model.parameterCount === '0.5B') {
        score += 40;
        reasons.unshift(`Recommended for ${specs.ramGB}GB RAM: Ultra-compact footprint prevents browser tab out-of-memory pressure`);
      } else {
        score -= 15;
        reasons.push(`Requires more memory than recommended for ${specs.ramGB}GB RAM systems`);
      }
    } else {
      // Devices with >4GB RAM (e.g. 6GB, 8GB, 16GB+)
      if (model.id === 'qwen-2.5-1.5b-instruct' || model.parameterCount === '1.5B') {
        score += 40;
        reasons.unshift(`Recommended for ${specs.ramGB}GB RAM: Higher reasoning capability with abundant memory headroom`);
      } else {
        score += 15;
        reasons.push(`Lightweight and fast, though 1.5B offers richer intelligence on your ${specs.ramGB}GB RAM device`);
      }
    }

    if (specs.ramGB >= model.recommendedRamGB) {
      score += 15;
      reasons.push(`${specs.ramGB}GB RAM exceeds recommendation (${model.recommendedRamGB}GB)`);
    } else if (specs.ramGB >= model.minRamGB) {
      score += 5;
      reasons.push(`Meets minimum ${model.minRamGB}GB RAM requirement`);
    } else {
      score -= 30;
      reasons.push(`May exceed available browser memory (Needs ${model.minRamGB}GB)`);
    }

    // CPU Cores factor
    if (specs.cpuCores >= model.minCores + 2) {
      score += 20;
      reasons.push(`Multi-core CPU (${specs.cpuCores} threads) enables swift token synthesis`);
    } else if (specs.cpuCores >= model.minCores) {
      score += 5;
    } else {
      score -= 20;
      reasons.push(`Higher core count recommended for optimal latency`);
    }

    // WebGPU factor
    if (specs.webGpuAvailable) {
      score += 15;
      if (model.preferredBackend === 'webgpu') {
        score += 10;
        reasons.push('Hardware WebGPU acceleration detected for rapid matrix operations');
      }
    } else if (model.preferredBackend === 'webgpu') {
      score -= 10;
      reasons.push('Will execute via CPU WASM (WebGPU recommended for peak speed)');
    }

    // Download size & storage
    if (specs.storageQuotaMB && specs.storageQuotaMB > model.downloadSizeMB * 3) {
      score += 10;
    }

    // Benchmark score weighting
    if (specs.benchmarkScore > 65) {
      score += 10;
    } else if (specs.benchmarkScore < 40 && model.downloadSizeMB > 400) {
      score -= 15;
    }

    // Clamp score
    score = Math.max(10, Math.min(99, score));

    if (score >= 75) {
      level = 'perfect';
    } else if (score >= 50) {
      level = 'comfortable';
    } else if (score >= 35) {
      level = 'demanding';
    } else {
      level = 'unsupported';
    }

    return {
      model,
      level,
      score,
      reason: reasons.join(' • '),
      isBestPick: false
    };
  }).sort((a, b) => b.score - a.score)
  .map((rec, index) => ({
    ...rec,
    isBestPick: index === 0 // Top-scoring model is the recommended best pick
  }));
}
