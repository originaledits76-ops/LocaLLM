/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Download, Check, MessageSquare, Trash2, Sparkles, Database, Zap, ShieldCheck, HardDrive, RefreshCw } from 'lucide-react';
import { ModelInfo, ModelRecommendation, ModelRuntimeState } from '../types';
import { WebGpuLiveStatus } from './WebGpuLiveStatus';

interface ModelCatalogProps {
  recommendations: ModelRecommendation[];
  runtimeStates: Record<string, ModelRuntimeState>;
  activeModelId: string | null;
  onInstall: (modelId: string) => void;
  onCancelInstall: (modelId: string) => void;
  onUninstall: (modelId: string) => void;
  onLaunchChat: (modelId: string) => void;
  onOpenWebGpuGuide?: () => void;
}

export const ModelCatalog: React.FC<ModelCatalogProps> = ({
  recommendations,
  runtimeStates,
  activeModelId,
  onInstall,
  onCancelInstall,
  onUninstall,
  onLaunchChat,
  onOpenWebGpuGuide
}) => {
  const targetRec = recommendations[0];
  const model = targetRec?.model;

  if (!model) return null;

  const runtime = runtimeStates[model.id] || {
    status: 'not_installed',
    progress: 0,
    statusMessage: '',
    downloadedBytes: 0,
    totalBytes: 0
  };

  const isInstalled = runtime.status === 'ready' || runtime.status === 'active';
  const isDownloading = runtime.status === 'downloading' || runtime.status === 'loading';

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header Banner Card */}
      <div className="aidora-card-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
          <div>
            <h2 className="text-xl font-extrabold text-zinc-900 font-display tracking-tight">
              Active Model: {model.name}
            </h2>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              100% on-device private inference stored in IndexedDB with WebGPU acceleration
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#edf9d5] text-zinc-900 border border-black/10">
              {model.quantization}
            </span>
          </div>
        </div>

        {/* Live WebGPU Hardware Status Banner */}
        <WebGpuLiveStatus onOpenGuideModal={onOpenWebGpuGuide} />

        {/* Storage Architecture Highlight Card */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#18181b] text-[#c7f43a] flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900">IndexedDB Storage Target</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold">
                Zero Cache API
              </span>
            </div>
            <p className="text-zinc-600 leading-relaxed">
              Model weight shards (~{model.downloadSizeMB} MB) and WASM binaries are stored directly in your browser's persistent IndexedDB database (<code>tvmjs</code> store), eliminating cache eviction risks and ensuring offline reliability.
            </p>
          </div>
        </div>
      </div>

      {/* Model Detail Card */}
      <div className="aidora-card-white p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
              Default Inference Engine
            </span>
            <h3 className="text-lg font-bold text-zinc-900 font-display mt-0.5">
              {model.name}
            </h3>
            <p className="text-xs text-zinc-600 mt-1 max-w-xl">
              {model.tagline}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-sm font-extrabold text-zinc-900 font-mono block">
              ~{model.downloadSizeMB} MB
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              IndexedDB footprint
            </span>
          </div>
        </div>

        {/* Spec Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Parameters</span>
            <span className="font-bold text-zinc-900 mt-0.5 block">{model.parameterCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Precision</span>
            <span className="font-bold text-zinc-900 mt-0.5 block">4-Bit (Q4F16)</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Context</span>
            <span className="font-bold text-zinc-900 mt-0.5 block">{model.contextLength.toLocaleString()} tokens</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">License</span>
            <span className="font-bold text-zinc-900 mt-0.5 block">{model.license}</span>
          </div>
        </div>

        {/* Installation & Action Bar */}
        {isDownloading ? (
          <div className="space-y-2 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-zinc-800">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Downloading to IndexedDB...</span>
              </span>
              <span className="font-mono text-zinc-900">{runtime.progress}%</span>
            </div>

            <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
              <div
                className="h-full bg-[#18181b] transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(5, runtime.progress)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-0.5">
              <span className="truncate max-w-[280px]">
                {runtime.statusMessage || 'Downloading weights...'}
              </span>
              <span>
                {((runtime.downloadedBytes || 0) / (1024 * 1024)).toFixed(1)} / {model.downloadSizeMB} MB
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onCancelInstall(model.id)}
                className="px-3 py-1 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              {isInstalled ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-[#edf9d5] px-3 py-1.5 rounded-full border border-black/10">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Installed in IndexedDB</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold bg-zinc-100 px-3 py-1.5 rounded-full">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Not Installed</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {isInstalled && (
                <button
                  type="button"
                  onClick={() => onUninstall(model.id)}
                  className="p-2.5 rounded-full bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-600 transition-colors"
                  title="Uninstall from IndexedDB"
                  aria-label="Uninstall from IndexedDB"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {isInstalled ? (
                <button
                  type="button"
                  onClick={() => onLaunchChat(model.id)}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-full bg-[#18181b] hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-105"
                >
                  <MessageSquare className="w-4 h-4 text-[#c7f43a]" />
                  <span>Start Chatting</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onInstall(model.id)}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-full bg-[#18181b] hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-105"
                >
                  <Download className="w-4 h-4 text-[#c7f43a]" />
                  <span>Install to IndexedDB ({model.downloadSizeMB} MB)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
