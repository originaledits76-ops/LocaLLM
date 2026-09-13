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
    <div id="device-specs-container" className="aidora-card-white p-5 sm:p-6 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#18181b] text-[#c7f43a] flex items-center justify-center shrink-0 shadow-2xs">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-zinc-900 font-display">
              Hardware Diagnostics
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              {specs?.osName || 'System Profile'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            id="toggle-tuning-button"
            onClick={() => setShowTuning(!showTuning)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full border border-zinc-200 text-zinc-800 bg-white hover:bg-zinc-100 transition-all shadow-2xs min-h-[38px]"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showTuning ? 'Done' : 'Adjust RAM'}</span>
          </button>

          <button
            id="rescan-specs-button"
            onClick={() => onRescan()}
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full bg-[#18181b] text-white hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-2xs min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Scanning' : 'Re-run Diagnostic'}</span>
          </button>
        </div>
      </div>

      {/* Manual RAM Selector Drawer */}
      {showTuning && (
        <div className="my-4 p-4 rounded-2xl bg-[#edf9d5] border border-black/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
            <span className="text-xs font-bold text-zinc-900">Select Physical RAM</span>
            <span className="text-[11px] text-zinc-600 font-medium">Browsers cap auto-detection at 8 GB</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[4, 8, 16, 24, 32, 64].map((gb) => (
              <button
                key={gb}
                type="button"
                onClick={() => setManualRam(gb)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all min-h-[36px] ${
                  manualRam === gb
                    ? 'bg-[#18181b] text-white shadow-xs'
                    : 'bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {gb} GB
              </button>
            ))}

            <button
              onClick={handleApplyCustomRam}
              className="ml-auto px-4 py-1.5 rounded-full bg-[#c7f43a] text-zinc-900 font-extrabold text-xs hover:bg-[#b8e62b] transition-colors shadow-2xs min-h-[36px]"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Hardware Metrics Grid - Aidora Soft Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4">
        {/* RAM */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500">RAM</span>
            <HardDrive className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-display tracking-tight text-zinc-900">
            {specs ? `${specs.ramGB} GB` : '—'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-500 font-medium mt-0.5">
            {specs?.ramDetected ? 'Hardware detected' : 'Assigned RAM'}
          </div>
        </div>

        {/* CPU */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500">CPU Cores</span>
            <Cpu className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-display tracking-tight text-zinc-900">
            {specs ? specs.cpuCores : '—'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-500 font-medium mt-0.5">
            Logical threads
          </div>
        </div>

        {/* Acceleration */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
          <div className="flex items-center justify-between text-zinc-400 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500">Acceleration</span>
            <Zap className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-display tracking-tight text-zinc-900">
            {specs?.npuAvailable ? 'NPU Neural' : specs?.webGpuAvailable ? 'GPU Shaders' : 'CPU Core'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-500 font-medium mt-0.5 truncate">
            {specs?.npuAvailable ? (specs.npuName || 'WebNN Accelerator') : specs?.webGpuAvailable ? 'Hardware Turbo' : 'Standard CPU'}
          </div>
        </div>

        {/* Benchmark Score */}
        <div className="p-4 rounded-2xl bg-[#edf9d5] border border-black/10">
          <div className="flex items-center justify-between text-zinc-500 mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Benchmark</span>
            <Gauge className="w-4 h-4 text-zinc-900" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold font-display tracking-tight text-zinc-900">
            {specs ? `${specs.benchmarkScore}` : '—'}
            <span className="text-xs text-zinc-500 font-normal"> /100</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-zinc-600 font-medium capitalize truncate">
            {specs?.deviceTier || 'Standard'} Tier
          </div>
        </div>
      </div>
    </div>
  );
};
