/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { InferenceSettings } from '../types';

interface ModelSettingsModalProps {
  isOpen: boolean;
  settings: InferenceSettings;
  defaultSystemPrompt: string;
  onClose: () => void;
  onSave: (newSettings: InferenceSettings) => void;
}

export const ModelSettingsModal: React.FC<ModelSettingsModalProps> = ({
  isOpen,
  settings,
  defaultSystemPrompt,
  onClose,
  onSave
}) => {
  const [localSettings, setLocalSettings] = React.useState<InferenceSettings>(settings);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    setLocalSettings({
      temperature: 0.7,
      maxTokens: 256,
      topP: 0.9,
      topK: 40,
      fastMode: true,
      systemPrompt: defaultSystemPrompt,
      preferWebGpu: true
    });
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white border border-black/10 p-5 sm:p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/10 shrink-0">
          <div>
            <h3 className="text-base font-bold text-black tracking-tight">
              Inference Parameters
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tune local ONNX Runtime decoding behaviors
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-black transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Controls - Scrollable */}
        <div className="space-y-4 text-xs overflow-y-auto py-3 pr-1">
          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-black">Temperature</label>
              <span className="font-mono text-zinc-500 font-medium">
                {localSettings.temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={localSettings.temperature}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, temperature: parseFloat(e.target.value) })
              }
              className="w-full accent-black cursor-pointer h-2"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>0.0 (Deterministic)</span>
              <span>0.7 (Balanced)</span>
              <span>1.5 (Creative)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-black">Max Tokens</label>
              <span className="font-mono text-zinc-500 font-medium">
                {localSettings.maxTokens}
              </span>
            </div>
            <input
              type="range"
              min={64}
              max={1024}
              step={32}
              value={localSettings.maxTokens}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, maxTokens: parseInt(e.target.value, 10) })
              }
              className="w-full accent-black cursor-pointer h-2"
            />
            <p className="text-[10px] text-zinc-400">
              Upper bound for response length. Lower values generate faster.
            </p>
          </div>

          {/* Top-P */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-black">Top P (Nucleus Sampling)</label>
              <span className="font-mono text-zinc-500 font-medium">
                {localSettings.topP.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={localSettings.topP}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, topP: parseFloat(e.target.value) })
              }
              className="w-full accent-black cursor-pointer h-2"
            />
          </div>

          {/* System Prompt */}
          <div className="space-y-1.5">
            <label className="font-semibold text-black">System Instructions</label>
            <textarea
              rows={3}
              value={localSettings.systemPrompt}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, systemPrompt: e.target.value })
              }
              className="w-full p-2.5 rounded-xl border border-black/15 bg-zinc-50 text-xs text-black focus:outline-none focus:border-black font-mono leading-relaxed resize-none"
              placeholder="System prompt instructions..."
            />
          </div>

          {/* Fast Mode (Greedy / KV Cache optimization) */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 bg-zinc-50">
            <div className="pr-2">
              <p className="font-semibold text-black">High-Speed Fast Mode</p>
              <p className="text-[10px] text-zinc-500">
                Optimized greedy decoding & KV tensor cache for 4–15+ tokens/sec on CPU & mobile.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.fastMode ?? true}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, fastMode: e.target.checked })
              }
              className="w-5 h-5 accent-black cursor-pointer rounded shrink-0"
            />
          </div>

          {/* Prefer WebGPU */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 bg-zinc-50">
            <div className="pr-2">
              <p className="font-semibold text-black">Prefer WebGPU Acceleration</p>
              <p className="text-[10px] text-zinc-500">
                Uses GPU shader matrices when browser supports it, with WASM fallback.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.preferWebGpu}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, preferWebGpu: e.target.checked })
              }
              className="w-5 h-5 accent-black cursor-pointer rounded shrink-0"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-black/10 shrink-0 gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-black font-medium transition-colors py-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-black/15 hover:border-black text-xs font-medium text-black transition-colors min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-full bg-black text-white hover:bg-zinc-800 text-xs font-semibold transition-colors min-h-[38px]"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
