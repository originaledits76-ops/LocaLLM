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
    <div id="device-specs-container" className="brutalist-card p-5 sm:p-6 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000] shrink-0">
            <Cpu className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight text-black font-display uppercase">
              Hardware Diagnostics & Profile
            </h2>
            <p className="text-xs text-zinc-600 font-mono font-bold">
              {specs?.osName || 'System'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            id="toggle-tuning-button"
            onClick={() => setShowTuning(!showTuning)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border-2 border-black text-black bg-white hover:bg-zinc-100 transition-all shadow-[2px_2px_0px_#000] min-h-[38px]"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showTuning ? 'Done' : 'Adjust RAM'}</span>
          </button>

          <button
            id="rescan-specs-button"
            onClick={() => onRescan()}
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-black text-white hover:bg-zinc-800 disabled:opacity-50 transition-all border-2 border-black shadow-[2px_2px_0px_#000] min-h-[38px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Scanning' : 'Re-run Diagnostic'}</span>
          </button>
        </div>
      </div>

      {/* Manual RAM Selector Drawer */}
      {showTuning && (
        <div className="my-4 p-4 rounded-xl bg-amber-100/80 border-2 border-black backdrop-blur-md shadow-[3px_3px_0px_#000]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
            <span className="text-xs font-bold text-black font-mono">Select Physical RAM</span>
            <span className="text-[11px] text-zinc-600 font-mono font-semibold">Browsers cap auto-detection at 8 GB</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[4, 8, 16, 24, 32, 64].map((gb) => (
              <button
                key={gb}
                type="button"
                onClick={() => setManualRam(gb)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border-2 transition-all min-h-[36px] ${
                  manualRam === gb
                    ? 'bg-black text-white border-black shadow-[2px_2px_0px_#000]'
                    : 'bg-white text-black border-black hover:bg-zinc-100'
                }`}
              >
                {gb} GB
              </button>
            ))}

            <button
              onClick={handleApplyCustomRam}
              className="ml-auto px-4 py-1.5 rounded-lg bg-emerald-400 text-black font-extrabold border-2 border-black text-xs hover:bg-emerald-300 transition-colors shadow-[2px_2px_0px_#000] min-h-[36px]"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Hardware Metrics Grid - Minimalist Glass Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4">
        {/* RAM */}
        <div className="p-4 rounded-xl bg-white/70 backdrop-blur-md border-2 border-black shadow-[3px_3px_0px_#000]">
          <div className="flex items-center justify-between text-zinc-500 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">RAM</span>
            <HardDrive className="w-4 h-4 text-black" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-black">
            {specs ? `${specs.ramGB} GB` : '—'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-600 font-mono font-semibold mt-0.5">
            {specs?.ramDetected ? 'Hardware' : 'Assigned'}
          </div>
        </div>

        {/* CPU */}
        <div className="p-4 rounded-xl bg-white/70 backdrop-blur-md border-2 border-black shadow-[3px_3px_0px_#000]">
          <div className="flex items-center justify-between text-zinc-500 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">CPU Cores</span>
            <Cpu className="w-4 h-4 text-black" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-black">
            {specs ? specs.cpuCores : '—'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-600 font-mono font-semibold mt-0.5">
            Threads
          </div>
        </div>

        {/* Acceleration */}
        <div className="p-4 rounded-xl bg-white/70 backdrop-blur-md border-2 border-black shadow-[3px_3px_0px_#000]">
          <div className="flex items-center justify-between text-zinc-500 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider">Acceleration</span>
            <Zap className="w-4 h-4 text-black" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold tracking-tight text-black">
            {specs?.webGpuAvailable ? 'GPU Hardware' : 'CPU Core'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
            {specs?.webGpuAvailable ? 'Hardware Turbo' : 'Standard CPU'}
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
