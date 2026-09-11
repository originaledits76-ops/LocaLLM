/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Check, MessageSquare, Trash2, Sparkles, AlertCircle, Layers } from 'lucide-react';
import { ModelInfo, ModelRecommendation, ModelRuntimeState } from '../types';

interface ModelCatalogProps {
  recommendations: ModelRecommendation[];
  runtimeStates: Record<string, ModelRuntimeState>;
  activeModelId: string | null;
  onInstall: (modelId: string) => void;
  onCancelInstall: (modelId: string) => void;
  onUninstall: (modelId: string) => void;
  onLaunchChat: (modelId: string) => void;
}

type FilterType = 'recommended' | 'modest' | 'all' | 'installed';

export const ModelCatalog: React.FC<ModelCatalogProps> = ({
  recommendations,
  runtimeStates,
  activeModelId,
  onInstall,
  onCancelInstall,
  onUninstall,
  onLaunchChat
}) => {
  const [filter, setFilter] = useState<FilterType>('recommended');

  const filteredRecommendations = recommendations.filter((rec) => {
    const isInstalled = runtimeStates[rec.model.id]?.status === 'ready' || runtimeStates[rec.model.id]?.status === 'active';
    if (filter === 'installed') return isInstalled;
    if (filter === 'modest') {
      return (
        rec.model.bitPrecision === '2-bit' ||
        rec.model.bitPrecision === '3-bit' ||
        rec.model.parameterCount === '135M' ||
        rec.model.parameterCount === '0.5B'
      );
    }
    if (filter === 'recommended') return rec.level === 'perfect' || rec.level === 'comfortable';
    return true; // 'all'
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-black">
            Available Models
          </h2>
          <p className="text-xs text-zinc-500">
            Select an openweight model to run locally on your device
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 p-1 rounded-full liquid-glass border border-black/[0.06] w-full sm:w-auto overflow-x-auto justify-between sm:justify-start">
          <button
            onClick={() => setFilter('recommended')}
            className={`flex-1 sm:flex-none text-center px-3 py-1.5 sm:py-1 text-xs font-medium rounded-full transition-all min-h-[36px] sm:min-h-0 flex items-center justify-center whitespace-nowrap ${
              filter === 'recommended'
                ? 'bg-black text-white shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Recommended
          </button>
          <button
            onClick={() => setFilter('modest')}
            className={`flex-1 sm:flex-none text-center px-3 py-1.5 sm:py-1 text-xs font-medium rounded-full transition-all min-h-[36px] sm:min-h-0 flex items-center justify-center whitespace-nowrap ${
              filter === 'modest'
                ? 'bg-amber-500 text-white shadow-xs font-semibold'
                : 'text-amber-800 bg-amber-50/80 hover:bg-amber-100'
            }`}
          >
            ⚡ 2-Bit &amp; 3-Bit (Fast)
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:flex-none text-center px-3 py-1.5 sm:py-1 text-xs font-medium rounded-full transition-all min-h-[36px] sm:min-h-0 flex items-center justify-center whitespace-nowrap ${
              filter === 'all'
                ? 'bg-black text-white shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('installed')}
            className={`flex-1 sm:flex-none text-center px-3 py-1.5 sm:py-1 text-xs font-medium rounded-full transition-all min-h-[36px] sm:min-h-0 flex items-center justify-center whitespace-nowrap ${
              filter === 'installed'
                ? 'bg-black text-white shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-black'
            }`}
          >
            Installed
          </button>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {filteredRecommendations.map((rec) => {
          const { model, level, isBestPick } = rec;
          const runtime = runtimeStates[model.id] || {
            status: 'not_installed',
            progress: 0,
            statusMessage: '',
            downloadedBytes: 0,
            totalBytes: 0
          };

          const isInstalled = runtime.status === 'ready' || runtime.status === 'active';
          const isDownloading = runtime.status === 'downloading' || runtime.status === 'loading';
          const isActive = activeModelId === model.id && runtime.status === 'active';

          return (
            <div
              key={model.id}
              id={`model-card-${model.id.replace(/[^a-zA-Z0-9]/g, '-')}`}
              className={`liquid-glass-card rounded-3xl p-5 flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-black ring-1 ring-black'
                  : 'hover:border-black/30'
              }`}
            >
              <div>
                {/* Top Row: Title & Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-black tracking-tight">
                        {model.name}
                      </h3>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-zinc-500 font-mono">
                        {model.creator}
                      </p>
                      {model.bitPrecision === '2-bit' && (
                        <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-900 rounded border border-amber-300">
                          ⚡ 2-Bit Ultra Fast
                        </span>
                      )}
                      {model.bitPrecision === '3-bit' && (
                        <span className="px-1.5 py-0.2 text-[10px] font-bold bg-indigo-100 text-indigo-900 rounded border border-indigo-300">
                          ⚡ 3-Bit Speed
                        </span>
                      )}
                      {model.engineType === 'webllm' && (
                        <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                          WebLLM Turbo
                        </span>
                      )}
                    </div>
                  </div>

                  {isBestPick ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black text-white shadow-xs">
                      <Sparkles className="w-3 h-3" />
                      Best Fit
                    </span>
                  ) : level === 'perfect' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-black/20 bg-white/70 text-black">
                      Smooth
                    </span>
                  ) : level === 'comfortable' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100/80 text-zinc-700">
                      Comfortable
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-zinc-400 border border-zinc-200">
                      Demanding
                    </span>
                  )}
                </div>

                {/* Tagline */}
                <p className="text-xs text-zinc-600 mt-2.5 line-clamp-2">
                  {model.tagline}
                </p>

                {/* Clean Specs Row */}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] font-mono text-zinc-500">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100/70 text-black">
                    {model.parameterCount}
                  </span>
                  <span>•</span>
                  <span>{model.quantization}</span>
                  <span>•</span>
                  <span>{model.downloadSizeMB} MB</span>
                  <span>•</span>
                  <span>Min {model.minRamGB}GB RAM</span>
                </div>
              </div>

              {/* Bottom Action Area */}
              <div className="mt-4 pt-3 border-t border-black/[0.06]">
                {isDownloading ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-700 font-medium truncate max-w-[220px]" title={runtime.statusMessage || `Downloading ${model.name}`}>
                        {runtime.statusMessage || `Downloading ${model.name}...`}
                      </span>
                      <span className="font-semibold text-black shrink-0">{runtime.progress}%</span>
                    </div>

                    {/* Progress Bar with smooth, non-jittering transition */}
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden relative">
                      <div
                        className="h-full bg-black transition-[width] duration-200 ease-out rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, runtime.progress))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                      <span>
                        {(() => {
                          const totalMB = Math.max(
                            model.downloadSizeMB,
                            runtime.totalBytes ? Math.round(runtime.totalBytes / (1024 * 1024)) : model.downloadSizeMB
                          );
                          const loadedMB = runtime.downloadedBytes
                            ? Math.min(totalMB, Number((runtime.downloadedBytes / (1024 * 1024)).toFixed(1)))
                            : 0;
                          return loadedMB > 0 ? `${loadedMB.toFixed(1)} / ${totalMB} MB` : `~${totalMB} MB total`;
                        })()}
                      </span>
                      <button
                        onClick={() => onCancelInstall(model.id)}
                        className="text-xs text-black underline hover:no-underline font-mono cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : isInstalled ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-black">
                      <Check className="w-3.5 h-3.5" />
                      <span>Ready in Cache</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        id={`uninstall-btn-${model.id}`}
                        onClick={() => onUninstall(model.id)}
                        className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-full border border-black/10 hover:border-black text-zinc-400 hover:text-black transition-colors shrink-0"
                        title="Delete from cache"
                        aria-label="Delete model from cache"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        id={`chat-btn-${model.id}`}
                        onClick={() => onLaunchChat(model.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-black text-white hover:bg-zinc-800 transition-all shadow-xs min-h-[40px]"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    id={`install-btn-${model.id}`}
                    onClick={() => onInstall(model.id)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs font-semibold bg-black text-white hover:bg-zinc-800 transition-all shadow-xs min-h-[44px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download ({model.downloadSizeMB} MB)</span>
                  </button>
                )}

                {runtime.error && (
                  <div className="mt-2 p-2 rounded-xl bg-zinc-100 text-xs text-black flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{runtime.error}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredRecommendations.length === 0 && (
        <div className="text-center py-10 liquid-glass-card rounded-3xl">
          <Layers className="w-6 h-6 mx-auto text-zinc-400 mb-1.5" />
          <p className="text-sm font-medium text-black">No models in this category</p>
          <button
            onClick={() => setFilter('recommended')}
            className="mt-3 px-3.5 py-1 rounded-full text-xs font-semibold bg-black text-white"
          >
            Show Recommended
          </button>
        </div>
      )}
    </div>
  );
};
