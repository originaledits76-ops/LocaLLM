/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Zap, AlertTriangle, ChevronRight, X, Sparkles, HelpCircle } from 'lucide-react';
import { isWebGpuSupported } from '../services/webllmRunner';

export const HardwareOptimizationBanner: React.FC = () => {
  const [hasWebGpu, setHasWebGpu] = useState<boolean | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showExplanationModal, setShowExplanationModal] = useState(false);

  useEffect(() => {
    isWebGpuSupported().then((supported) => {
      setHasWebGpu(supported);
    });
  }, []);

  if (hasWebGpu === null || isDismissed) {
    return null;
  }

  return (
    <>
      <div
        className={`px-3 py-2 border-b text-xs transition-colors flex items-center justify-between gap-2 ${
          hasWebGpu
            ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-900'
            : 'bg-amber-50/95 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
          {hasWebGpu ? (
            <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}

          <div className="flex-1 truncate">
            {hasWebGpu ? (
              <span>
                <strong className="font-semibold">WebGPU Hardware Acceleration Active:</strong> Compiled GPU shaders enabled for max token throughput.
              </span>
            ) : (
              <span>
                <strong className="font-semibold">Running in CPU WASM Emulation Mode (~0.6-2 tok/s):</strong> Mobile WebGPU is inactive in this browser session.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowExplanationModal(true)}
            className="underline font-semibold hover:opacity-80 shrink-0 flex items-center gap-0.5 text-[11px]"
          >
            <span>{hasWebGpu ? 'Why so fast?' : 'How to get 10-30x speed'}</span>
            <ChevronRight className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-black/5 rounded-md shrink-0 ml-1 text-zinc-500"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Speed & Acceleration Explanation Modal */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-black/10 text-left relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowExplanationModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-zinc-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center shadow-sm">
                <Zap className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-black tracking-tight">
                  Mobile Hardware Acceleration Guide
                </h3>
                <p className="text-xs text-zinc-500">
                  Why native apps (like PocketPal) differ from Web Browsers
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-zinc-700 leading-relaxed mt-4">
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
                <h4 className="font-bold text-black mb-1 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-zinc-700" />
                  Why PocketPal AI is faster natively:
                </h4>
                <p>
                  PocketPal AI is a compiled native Android/iOS app using C++ llama.cpp with direct ARM64 NEON &amp; Vulkan GPU instructions. Web browsers execute inside a sandboxed environment and require <strong>WebGPU</strong> to access your phone&apos;s GPU chip.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <h4 className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  How to unlock maximum speed on your Phone:
                </h4>
                <ol className="list-decimal pl-4 space-y-1.5 text-emerald-900">
                  <li>
                    <strong>Android Chrome:</strong> Open <code className="bg-white/80 px-1 py-0.5 rounded font-mono border border-emerald-300">chrome://flags/#enable-unsafe-webgpu</code> and set it to <strong>Enabled</strong>, then restart Chrome.
                  </li>
                  <li>
                    <strong>iOS Safari (iOS 17+):</strong> Go to iOS Settings &rarr; Safari &rarr; Advanced &rarr; Feature Flags &rarr; enable <strong>WebGPU</strong>.
                  </li>
                  <li>
                    <strong>Select WebLLM Models:</strong> Choose <em>SmolLM2 135M Turbo</em>, <em>Qwen 2.5 0.5B Turbo</em>, or <em>Gemma 2 2B Turbo</em> in the model catalog for compiled WebGPU shaders.
                  </li>
                  <li>
                    <strong>Open in New Tab:</strong> In iframe previews, WebGPU can be throttled by security sandboxes. Open the app directly in a full browser tab.
                  </li>
                </ol>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
                <h4 className="font-bold text-black mb-1">Current Browser Status:</h4>
                <div className="flex items-center justify-between py-1 border-b border-zinc-200 font-mono text-[11px]">
                  <span>WebGPU API:</span>
                  <span className={hasWebGpu ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                    {hasWebGpu ? 'AVAILABLE (GPU SHADERS READY)' : 'DISABLED / NOT SUPPORTED'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 font-mono text-[11px]">
                  <span>Active Engine:</span>
                  <span>{hasWebGpu ? 'WebLLM WebGPU Native Shaders' : 'Multi-Core WASM SIMD Fallback'}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowExplanationModal(false)}
                className="px-4 py-2 rounded-full bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
