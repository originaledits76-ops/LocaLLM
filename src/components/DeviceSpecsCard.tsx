/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Cpu, HardDrive, Zap, RefreshCw, Sliders, Gauge } from 'lucide-react';
import { DeviceSpecs } from '../types';

interface DeviceSpecsCardProps {
  specs: DeviceSpecs | null;
  isLoading: boolean;
  onRescan: (customRam?: number) => void;
}

export const DeviceSpecsCard: React.FC<DeviceSpecsCardProps> = ({
  specs,
  isLoading,
  onRescan
}) => {
  const [showTuning, setShowTuning] = useState(false);
  const [manualRam, setManualRam] = useState<number>(specs?.ramGB || 8);

  const handleApplyCustomRam = () => {
    onRescan(manualRam);
    setShowTuning(false);
  };

  return (
    <div id="device-specs-container" className="liquid-glass-card rounded-3xl p-4 sm:p-6 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-black text-white flex items-center justify-center shadow-xs shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-black">
              Hardware Diagnostics
            </h2>
            <p className="text-xs text-zinc-500 font-mono">
              {specs?.osName || 'System'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            id="toggle-tuning-button"
            onClick={() => setShowTuning(!showTuning)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full border border-black/10 hover:border-black text-black bg-white/60 hover:bg-white transition-all shadow-xs min-h-[38px]"
          >
            <Sliders className="w-3 h-3" />
            <span>{showTuning ? 'Done' : 'Adjust RAM'}</span>
          </button>

          <button
            id="rescan-specs-button"
            onClick={() => onRescan()}
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full bg-black text-white hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-xs min-h-[38px]"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Scanning' : 'Re-run'}</span>
          </button>
        </div>
      </div>

      {/* Manual RAM Selector Drawer */}
      {showTuning && (
        <div className="my-4 p-3 sm:p-4 rounded-2xl bg-white/70 border border-black/[0.06] backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
            <span className="text-xs font-medium text-black">Select Physical RAM</span>
            <span className="text-[11px] text-zinc-400 font-mono">Browsers cap auto-detection at 8 GB</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[4, 8, 16, 24, 32, 64].map((gb) => (
              <button
                key={gb}
                type="button"
                onClick={() => setManualRam(gb)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all min-h-[36px] ${
                  manualRam === gb
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-white/80 text-zinc-700 border-black/10 hover:border-black'
                }`}
              >
                {gb} GB
              </button>
            ))}

            <button
              onClick={handleApplyCustomRam}
              className="ml-auto px-4 py-1.5 rounded-full bg-black text-white font-medium text-xs hover:bg-zinc-800 transition-colors shadow-xs min-h-[36px]"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Hardware Metrics Grid - Minimalist Glass Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4">
        {/* RAM */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/60 border border-black/[0.05] hover:border-black/20 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider">RAM</span>
            <HardDrive className="w-3.5 h-3.5 text-zinc-700" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-black">
            {specs ? `${specs.ramGB} GB` : '—'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-0.5">
            {specs?.ramDetected ? 'Hardware' : 'Assigned'}
          </div>
        </div>

        {/* CPU */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/60 border border-black/[0.05] hover:border-black/20 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider">CPU Cores</span>
            <Cpu className="w-3.5 h-3.5 text-zinc-700" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-black">
            {specs ? specs.cpuCores : '—'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-0.5">
            Threads
          </div>
        </div>

        {/* Acceleration */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/60 border border-black/[0.05] hover:border-black/20 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider">Backend</span>
            <Zap className="w-3.5 h-3.5 text-zinc-700" />
          </div>
          <div className="text-lg sm:text-xl font-bold tracking-tight text-black">
            {specs?.webGpuAvailable ? 'WebGPU' : 'WASM'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
            {specs?.webGpuAvailable ? 'Accelerated' : 'CPU Execution'}
          </div>
        </div>

        {/* Benchmark Score */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/60 border border-black/[0.05] hover:border-black/20 transition-all">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider">Benchmark</span>
            <Gauge className="w-3.5 h-3.5 text-zinc-700" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-black">
            {specs ? `${specs.benchmarkScore}` : '—'}
            <span className="text-xs text-zinc-400 font-normal"> /100</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-0.5 capitalize truncate">
            {specs?.deviceTier || 'Standard'} Tier
          </div>
        </div>
      </div>
    </div>
  );
};
