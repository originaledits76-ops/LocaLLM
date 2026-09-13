/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Download,
  Check,
  HardDrive,
  Database,
  Zap,
  Sparkles,
  ShieldCheck,
  X,
  AlertCircle,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { ModelInfo, ModelRuntimeState } from '../types';
import { WebGpuLiveStatus } from './WebGpuLiveStatus';

interface ModelInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ModelInfo;
  runtimeState?: ModelRuntimeState;
  onInstall: (modelId: string) => void;
  onCancelInstall: (modelId: string) => void;
  onUninstall: (modelId: string) => void;
  onStartChat: (modelId: string) => void;
  onOpenWebGpuGuide: () => void;
}

export const ModelInstallModal: React.FC<ModelInstallModalProps> = ({
  isOpen,
  onClose,
  model,
  runtimeState,
  onInstall,
  onCancelInstall,
  onUninstall,
  onStartChat,
  onOpenWebGpuGuide
}) => {
  if (!isOpen) return null;

  const status = runtimeState?.status || 'not_installed';
  const isDownloading = status === 'downloading';
  const isReady = status === 'ready' || status === 'active';
  const isError = status === 'error';

  const progress = runtimeState?.progress || 0;
  const downloadedMB = runtimeState?.downloadedBytes
    ? (runtimeState.downloadedBytes / (1024 * 1024)).toFixed(1)
    : (progress * (model.downloadSizeMB / 100)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-[28px] max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 space-y-5 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        {/* Header with Title and Close button */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#18181b] text-[#c7f43a] flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-zinc-900 font-display tracking-tight">
                  {model.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#edf9d5] text-zinc-900 border border-black/10">
                  {model.quantization}
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                On-device private inference stored exclusively in IndexedDB
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live WebGPU Status Notification inside Modal */}
        <div className="pt-1">
          <WebGpuLiveStatus onOpenGuideModal={onOpenWebGpuGuide} />
        </div>

        {/* Comprehensive Model Details Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
              Model Specifications &amp; Storage Target
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            {/* Model Name & Creator */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Creator
              </span>
              <span className="font-bold text-zinc-900 truncate block mt-0.5">
                {model.creator}
              </span>
            </div>

            {/* Model Size */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Download / Disk
              </span>
              <span className="font-bold text-zinc-900 truncate block mt-0.5">
                ~{model.downloadSizeMB} MB
              </span>
            </div>

            {/* Parameters */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Parameters
              </span>
              <span className="font-bold text-zinc-900 truncate block mt-0.5">
                {model.parameterCount} (Dense)
              </span>
            </div>

            {/* Storage Backend: IndexedDB */}
            <div className="p-3 rounded-2xl bg-[#edf9d5]/80 border border-black/10 sm:col-span-2">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[11px]">
                <Database className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Storage Target: IndexedDB (Persistent)</span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1 leading-snug">
                Stored directly in browser IndexedDB (<code>tvmjs</code> database). Bypasses volatile browser Cache API to ensure persistent offline availability.
              </p>
            </div>

            {/* Context Window */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Context Window
              </span>
              <span className="font-bold text-zinc-900 truncate block mt-0.5">
                {model.contextLength.toLocaleString()} tokens
              </span>
            </div>

            {/* RAM / VRAM */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                RAM / VRAM
              </span>
              <span className="font-bold text-zinc-900 truncate block mt-0.5">
                {model.minRamGB}GB min • {model.recommendedRamGB}GB rec
              </span>
            </div>

            {/* Privacy */}
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70 sm:col-span-2">
              <div className="flex items-center gap-1.5 text-zinc-900 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Zero Server Uploads &amp; Complete Privacy</span>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1 leading-snug">
                All token completions occur directly in your browser tab using local compute shaders. No prompt or chat history is transmitted to any cloud API.
              </p>
            </div>
          </div>
        </div>

        {/* Installation Progress & Action Container */}
        <div className="space-y-3 pt-1">
          {isDownloading && (
            <div className="space-y-2 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-zinc-800 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>Installing {model.name} to IndexedDB...</span>
                </span>
                <span className="font-mono text-zinc-900">{progress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-zinc-200 overflow-hidden relative">
                <div
                  className="h-full bg-[#18181b] transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-0.5">
                <span className="truncate max-w-[280px]">
                  {runtimeState?.statusMessage || 'Downloading weights shard...'}
                </span>
                <span>
                  {downloadedMB} / {model.downloadSizeMB} MB
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onCancelInstall(model.id)}
                  className="px-3.5 py-1.5 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold transition-colors"
                >
                  Cancel Installation
                </button>
              </div>
            </div>
          )}

          {isReady && (
            <div className="p-4 rounded-2xl bg-[#edf9d5] border border-black/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#18181b] text-[#c7f43a] flex items-center justify-center font-bold">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-900">
                    Model Installed &amp; Ready in IndexedDB
                  </h4>
                  <p className="text-[11px] text-zinc-600">
                    Weights cached permanently in local database. Zero network download required.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUninstall(model.id)}
                className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-white/80 transition-colors"
                title="Uninstall from IndexedDB"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {isError && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>Installation Failed</span>
              </div>
              <p className="text-[11px] text-red-700">
                {runtimeState?.error || 'Could not download model weights to IndexedDB. Please check your internet connection and try again.'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {!isReady ? (
              <button
                type="button"
                disabled={isDownloading}
                onClick={() => onInstall(model.id)}
                className={`flex-1 py-3.5 px-5 rounded-full font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${
                  isDownloading
                    ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                    : 'bg-[#18181b] hover:bg-zinc-800 text-white hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {isDownloading
                    ? `Installing to IndexedDB (${progress}%)...`
                    : `Install Model to IndexedDB (~${model.downloadSizeMB} MB)`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onStartChat(model.id);
                  onClose();
                }}
                className="flex-1 py-3.5 px-5 rounded-full bg-[#18181b] hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <span>Start Chatting with Qwen 2.5</span>
                <ArrowRight className="w-4 h-4 text-[#c7f43a]" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition-colors"
            >
              {isReady ? 'Close' : 'Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
