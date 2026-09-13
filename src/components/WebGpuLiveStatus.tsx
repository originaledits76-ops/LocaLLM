/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Zap,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  X,
  Cpu,
  Layers,
  Database,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import {
  checkLiveWebGpu,
  subscribeWebGpuStatus,
  WebGpuStatusInfo
} from '../services/webgpuStatus';

interface WebGpuLiveStatusProps {
  compact?: boolean;
  onOpenGuideModal?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const WebGpuLiveStatus: React.FC<WebGpuLiveStatusProps> = ({
  compact = false,
  onOpenGuideModal,
  isOpen,
  onClose
}) => {
  const [status, setStatus] = useState<WebGpuStatusInfo | null>(null);
  const [showInternalModal, setShowInternalModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const isModalVisible = isOpen !== undefined ? isOpen : showInternalModal;

  const handleCloseModal = () => {
    if (onClose) {
      onClose();
    } else {
      setShowInternalModal(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeWebGpuStatus((newStatus) => {
      setStatus(newStatus);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const updated = await checkLiveWebGpu(true);
    setStatus(updated);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch {}
  };

  const isEnabled = Boolean(status?.enabled);
  const isUsed = Boolean(status?.activeInUse);

  const openGuide = () => {
    if (onOpenGuideModal) {
      onOpenGuideModal();
    } else {
      setShowInternalModal(true);
    }
  };

  return (
    <>
      {/* Live Status Badge / Pill */}
      {compact ? (
        <button
          type="button"
          onClick={openGuide}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-2xs ${
            isEnabled
              ? isUsed
                ? 'bg-[#18181b] text-[#c7f43a] hover:bg-zinc-800 border border-zinc-700'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
          }`}
          title={isEnabled ? (isUsed ? 'WebGPU: Enabled & Actively In Use' : 'WebGPU: Enabled & Ready') : 'WebGPU: Disabled / Unavailable. Click to enable!'}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isEnabled
                ? isUsed
                  ? 'bg-[#c7f43a]'
                  : 'bg-emerald-500'
                : 'bg-amber-500'
            }`}
          />
          <span className="font-mono uppercase tracking-wider text-[11px]">
            {isEnabled
              ? isUsed
                ? 'WebGPU: Active'
                : 'WebGPU: Ready'
              : 'WebGPU: Disabled'}
          </span>
          {!isEnabled && (
            <span className="bg-amber-500 text-white rounded px-1 text-[9px] font-bold">
              Enable
            </span>
          )}
        </button>
      ) : (
        <div
          className={`rounded-2xl p-4 transition-all border ${
            isEnabled
              ? 'bg-white border-zinc-200 shadow-2xs'
              : 'bg-amber-50/90 border-amber-300 shadow-sm'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isEnabled
                    ? 'bg-[#18181b] text-[#c7f43a]'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {isEnabled ? (
                  <Zap className="w-5 h-5 fill-current" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isEnabled
                        ? isUsed
                          ? 'bg-[#c7f43a]'
                          : 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <h3 className="font-bold text-sm text-zinc-900 font-display">
                    {isEnabled ? (
                      isUsed ? (
                        <span className="text-emerald-700">WebGPU: Enabled &amp; Actively In Use</span>
                      ) : (
                        <span className="text-emerald-700">WebGPU: Enabled &amp; Ready</span>
                      )
                    ) : (
                      <span className="text-amber-800">WebGPU: Disabled / Unavailable</span>
                    )}
                  </h3>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                    Live Status
                  </span>
                </div>

                <p className="text-xs text-zinc-600 mt-0.5">
                  {isEnabled
                    ? status?.adapterName
                      ? `Hardware GPU Adapter: ${status.adapterName}`
                      : 'Hardware GPU Acceleration active for Qwen 2.5 on-device inference.'
                    : 'WebGPU acceleration is currently turned off or unsupported in your browser. Inference will fall back to slower CPU mode.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
                title="Re-check WebGPU Status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {!isEnabled ? (
                <button
                  type="button"
                  onClick={openGuide}
                  className="px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>How to Enable WebGPU</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openGuide}
                  className="px-3.5 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs transition-colors"
                >
                  Hardware Info
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guide / Details Modal */}
      {isModalVisible && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-2xl border border-zinc-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isEnabled ? 'bg-[#18181b] text-[#c7f43a]' : 'bg-amber-500 text-white'
                  }`}
                >
                  {isEnabled ? <Zap className="w-5 h-5 fill-current" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-zinc-900 font-display">
                    {isEnabled ? 'WebGPU Hardware Status' : 'Enable WebGPU Acceleration'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {isEnabled ? 'High-Performance Shaders Active' : 'Action Required for Fast Local Inference'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isEnabled ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#edf9d5] border border-black/10 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>WebGPU is fully enabled and ready!</span>
                  </div>
                  <p className="text-zinc-700 leading-relaxed">
                    Your browser has initialized a direct WebGPU compute adapter. Model weights for Qwen 2.5 1.5B will execute using hardware matrix acceleration inside your device's GPU shaders, loaded directly from IndexedDB.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-500">GPU Adapter:</span>
                    <span className="font-bold text-zinc-900 text-right">{status?.adapterName || 'Hardware GPU'}</span>
                  </div>
                  {status?.vendor && (
                    <div className="flex justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                      <span className="font-semibold text-zinc-500">Vendor:</span>
                      <span className="font-bold text-zinc-900">{status.vendor}</span>
                    </div>
                  )}
                  {status?.architecture && (
                    <div className="flex justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                      <span className="font-semibold text-zinc-500">Architecture:</span>
                      <span className="font-bold text-zinc-900">{status.architecture}</span>
                    </div>
                  )}
                  <div className="flex justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-500">Storage Backend:</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <Database className="w-3.5 h-3.5" />
                      IndexedDB (Local TVM Database)
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-500">Active Inference Engine:</span>
                    <span className="font-bold text-zinc-900">
                      {isUsed ? 'WebGPU Shader Execution (In Use)' : 'WebLLM TVM Worker (Ready)'}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-500">Weight Storage Mode:</span>
                    <span className="font-bold text-zinc-900 flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                      Single Persistent WebGPU Array Buffer
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-500">COOP & COEP Isolation:</span>
                    <span className={`font-bold flex items-center gap-1 ${status?.isCrossOriginIsolated ? 'text-emerald-700' : 'text-zinc-600'}`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {status?.isCrossOriginIsolated ? 'Active (same-origin / require-corp)' : 'Standard Headers'}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="font-semibold text-zinc-500">SharedArrayBuffer Zero-Copy:</span>
                    <span className={`font-bold ${status?.hasSharedArrayBuffer ? 'text-emerald-700' : 'text-zinc-600'}`}>
                      {status?.hasSharedArrayBuffer ? 'Enabled (Multi-threaded Wasm)' : 'Available via Wasm Worker'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    WebGPU is currently disabled in this browser
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Inference is operating via CPU WASM mode. Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP) headers are active to enable zero-copy multi-threaded compute across web workers.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2 text-zinc-700">
                  <div className="flex items-center gap-2 font-bold text-zinc-900">
                    <Cpu className="w-4 h-4 text-zinc-800" />
                    <span>Active WASM CPU Fallback Architecture</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">COOP & COEP Isolation:</span>
                      <span className="font-bold text-emerald-700">same-origin / require-corp (Active)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">SharedArrayBuffer:</span>
                      <span className="font-bold text-emerald-700">
                        {status?.hasSharedArrayBuffer ? 'Enabled (Zero-Copy Multi-Threading)' : 'Supported'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Weight Storage:</span>
                      <span className="font-bold text-zinc-900">Persistent Virtual Memory Heap at Startup</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 pt-1 leading-normal border-t border-zinc-200">
                      Model weight raw byte streams are stored directly in a persistent virtual memory heap upon startup, completely bypassing repeated IndexedDB blob allocations.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">
                    How to enable WebGPU:
                  </h4>

                  {/* Step 1 */}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-zinc-900">
                      <span>1. Google Chrome / Microsoft Edge / Brave</span>
                    </div>
                    <p className="text-[11px] text-zinc-600">
                      Open browser settings and ensure <strong>"Use graphics acceleration when available"</strong> is toggled ON (under System).
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                    <div className="flex items-center justify-between font-bold text-zinc-900">
                      <span>2. Enable WebGPU Flag in URL Bar</span>
                    </div>
                    <p className="text-[11px] text-zinc-600">
                      Copy and paste this URL into your browser address bar:
                    </p>
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-200 font-mono text-[11px] text-zinc-800">
                      <span className="truncate">chrome://flags/#enable-unsafe-webgpu</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('chrome://flags/#enable-unsafe-webgpu')}
                        className="px-2 py-1 rounded bg-white hover:bg-zinc-100 font-sans font-bold text-[10px] shrink-0 flex items-center gap-1"
                      >
                        {copiedText === 'chrome://flags/#enable-unsafe-webgpu' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>Copy</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Set this flag to <strong>Enabled</strong> and click <strong>Relaunch</strong>.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-zinc-900">
                      <span>3. Apple Safari (macOS / iOS)</span>
                    </div>
                    <p className="text-[11px] text-zinc-600">
                      In Safari &gt; <strong>Settings</strong> &gt; <strong>Advanced</strong> &gt; check <strong>"Show features for web developers"</strong>. Then go to the <strong>Develop</strong> menu &gt; <strong>Feature Flags</strong> &gt; enable <strong>WebGPU</strong>.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex-1 py-3 rounded-full bg-[#18181b] hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-test WebGPU Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-3 rounded-full bg-zinc-100 hover:bg-zinc-200 font-bold text-zinc-800 text-xs transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
