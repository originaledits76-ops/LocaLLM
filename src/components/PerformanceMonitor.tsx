/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  BarChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Cpu,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { TelemetryPoint } from '../types';

export interface PerformanceMonitorProps {
  telemetry: TelemetryPoint[];
  isGenerating: boolean;
  activeModelName?: string;
  backendUsed?: 'webgpu' | 'wasm' | 'cpu';
  ttftMs?: number;
  tokensGenerated?: number;
  tokensPerSec?: number;
  instantaneousTps?: number;
  peakTps?: number;
  avgLatencyMs?: number;
  maxLatencyMs?: number;
  spikeCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
}

type ChartViewMode = 'combined' | 'tps' | 'latency';

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  telemetry = [],
  isGenerating,
  activeModelName,
  backendUsed = 'wasm',
  ttftMs,
  tokensGenerated = 0,
  tokensPerSec = 0,
  instantaneousTps,
  peakTps,
  avgLatencyMs,
  maxLatencyMs,
  spikeCount = 0,
  isExpanded = true,
  onToggleExpand,
  onClose
}) => {
  const [viewMode, setChartViewMode] = useState<ChartViewMode>('combined');

  // Compute stats from points if not explicitly passed
  const currentTokenCount = telemetry.length > 0 ? telemetry[telemetry.length - 1].tokenIndex : tokensGenerated;
  const currentTps = instantaneousTps ?? (telemetry.length > 0 ? telemetry[telemetry.length - 1].tps : tokensPerSec);
  const currentAvgTps = tokensPerSec || (telemetry.length > 0 ? telemetry[telemetry.length - 1].cumulativeTps : 0);
  const currentPeakTps = peakTps ?? (telemetry.length > 0 ? Math.max(...telemetry.map((p) => p.tps)) : currentTps);

  const nonPromptPoints = telemetry.filter((p) => p.tokenIndex > 1);
  const latencies = nonPromptPoints.map((p) => p.interTokenLatencyMs);
  const calculatedAvgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : avgLatencyMs || 0;
  const calculatedMaxLatency = latencies.length > 0
    ? Math.max(...latencies)
    : maxLatencyMs || 0;
  const calculatedSpikes = telemetry.filter((p) => p.isSpike).length || spikeCount;

  // Custom Glass Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as TelemetryPoint;
      if (!data) return null;

      return (
        <div className="liquid-glass-dock rounded-xl px-3 py-2 text-xs border border-black/10 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 pb-1 mb-1 border-b border-black/[0.06] text-[11px] font-mono text-zinc-500">
            <span>Token #{data.tokenIndex}</span>
            <span>{data.timeMs}ms elapsed</span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-600">Instantaneous:</span>
              <span className="font-semibold text-black">{data.tps.toFixed(1)} tok/s</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-600">Cumulative TPS:</span>
              <span className="text-zinc-800">{data.cumulativeTps.toFixed(1)} tok/s</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-600">Inter-token Latency:</span>
              <span className={`font-semibold ${data.isSpike ? 'text-amber-600' : 'text-zinc-800'}`}>
                {data.interTokenLatencyMs} ms
              </span>
            </div>
          </div>

          {data.isSpike && (
            <div className="mt-1.5 pt-1 border-t border-amber-500/20 text-[10px] font-medium text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Latency Spike (+{Math.max(0, Math.round(((data.interTokenLatencyMs - calculatedAvgLatency) / Math.max(1, calculatedAvgLatency)) * 100))}% over avg)</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="performance-monitor-panel"
      className="w-full liquid-glass-card rounded-2xl border border-black/[0.08] shadow-sm overflow-hidden transition-all duration-200"
    >
      {/* Top Header Bar */}
      <div className="px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2 border-b border-black/[0.05] bg-black/[0.015]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
            <Activity className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs font-bold text-black tracking-tight flex items-center gap-1">
                Inference Telemetry
              </h4>

              {isGenerating ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px] font-semibold tracking-wide uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Stream
                </span>
              ) : telemetry.length > 0 ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-black/5 text-zinc-600 text-[10px] font-mono">
                  {telemetry.length} tokens
                </span>
              ) : null}
            </div>

            <p className="text-[10px] font-mono text-zinc-500 truncate">
              {activeModelName ? `${activeModelName} • ` : ''}
              Engine: <span className="uppercase font-semibold text-black">{backendUsed}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {isExpanded && (
            <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-black/5 border border-black/5 mr-1">
              <button
                type="button"
                onClick={() => setChartViewMode('combined')}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  viewMode === 'combined'
                    ? 'bg-white text-black font-semibold shadow-xs'
                    : 'text-zinc-500 hover:text-black'
                }`}
              >
                Combined
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('tps')}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  viewMode === 'tps'
                    ? 'bg-white text-black font-semibold shadow-xs'
                    : 'text-zinc-500 hover:text-black'
                }`}
              >
                TPS
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('latency')}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  viewMode === 'latency'
                    ? 'bg-white text-black font-semibold shadow-xs'
                    : 'text-zinc-500 hover:text-black'
                }`}
              >
                Latency
              </button>
            </div>
          )}

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg hover:bg-black/5 text-zinc-500 hover:text-black transition-colors"
              title={isExpanded ? 'Collapse monitor' : 'Expand monitor'}
              aria-label={isExpanded ? 'Collapse monitor' : 'Expand monitor'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-[11px] text-zinc-400 hover:text-black transition-colors rounded-md"
              title="Close telemetry view"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* KPI Ribbon: Always visible for instant at-a-glance awareness */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 sm:px-4 sm:py-2.5 bg-white/40 border-b border-black/[0.04]">
        {/* Metric 1: Current / Avg TPS */}
        <div className="px-2.5 py-1.5 rounded-xl bg-white/70 border border-black/5 flex flex-col">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-black" />
              Throughput
            </span>
            <span>TPS</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-black">
              {currentTps ? currentTps.toFixed(1) : '0.0'}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              avg: {currentAvgTps ? currentAvgTps.toFixed(1) : '0.0'}
            </span>
          </div>
        </div>

        {/* Metric 2: Latency & Spikes */}
        <div className="px-2.5 py-1.5 rounded-xl bg-white/70 border border-black/5 flex flex-col">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-600" />
              Avg Latency
            </span>
            <span>Inter-tok</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-black">
              {calculatedAvgLatency ? `${calculatedAvgLatency}ms` : '—'}
            </span>
            {calculatedMaxLatency > 0 && (
              <span className="text-[10px] font-mono text-zinc-500">
                max: {calculatedMaxLatency}ms
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Latency Spikes Detected */}
        <div className={`px-2.5 py-1.5 rounded-xl border flex flex-col transition-colors ${
          calculatedSpikes > 0
            ? 'bg-amber-500/[0.08] border-amber-500/20'
            : 'bg-white/70 border-black/5'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
            <span className={`flex items-center gap-1 ${calculatedSpikes > 0 ? 'text-amber-700 font-semibold' : 'text-zinc-400'}`}>
              <AlertTriangle className={`w-3 h-3 ${calculatedSpikes > 0 ? 'text-amber-600' : 'text-zinc-400'}`} />
              Spike Events
            </span>
            <span className={`text-[9px] ${calculatedSpikes > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>
              &gt;1.6x avg
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className={`text-base sm:text-lg font-bold font-mono tracking-tight ${
              calculatedSpikes > 0 ? 'text-amber-800' : 'text-emerald-700'
            }`}>
              {calculatedSpikes} {calculatedSpikes === 1 ? 'spike' : 'spikes'}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {calculatedSpikes === 0 && telemetry.length > 2 ? 'smooth' : ''}
            </span>
          </div>
        </div>

        {/* Metric 4: Time to First Token (TTFT) */}
        <div className="px-2.5 py-1.5 rounded-xl bg-white/70 border border-black/5 flex flex-col">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-zinc-600" />
              Prompt Eval (TTFT)
            </span>
            <span>First tok</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-black">
              {ttftMs !== undefined && ttftMs > 0 ? `${ttftMs}ms` : telemetry.length > 0 ? `${telemetry[0].timeMs}ms` : '—'}
            </span>
            {currentPeakTps > 0 && (
              <span className="text-[10px] font-mono text-zinc-500">
                peak: {currentPeakTps.toFixed(1)}t/s
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Chart Section */}
      {isExpanded && (
        <div className="p-3 sm:p-4 bg-white/30 space-y-3">
          {/* Mobile view selector */}
          <div className="flex sm:hidden items-center justify-center p-0.5 rounded-lg bg-black/5 border border-black/5 w-full">
            <button
              type="button"
              onClick={() => setChartViewMode('combined')}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-colors ${
                viewMode === 'combined'
                  ? 'bg-white text-black font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              Combined
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('tps')}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-colors ${
                viewMode === 'tps'
                  ? 'bg-white text-black font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              TPS
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('latency')}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-colors ${
                viewMode === 'latency'
                  ? 'bg-white text-black font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              Latency Spikes
            </button>
          </div>

          {/* Chart Display Container */}
          {telemetry.length === 0 ? (
            <div className="h-44 sm:h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed border-black/10 rounded-xl bg-white/40">
              <Activity className="w-6 h-6 text-zinc-300 mb-1.5 animate-pulse" />
              <p className="text-xs font-semibold text-black">Awaiting Inference Activity</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mt-0.5 leading-relaxed">
                Send a prompt to observe live tokens-per-second, prompt evaluation latency, and inter-token variation.
              </p>
            </div>
          ) : (
            <div className="h-44 sm:h-52 w-full pt-1">
              {viewMode === 'combined' && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={telemetry} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#18181b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#18181b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis
                      dataKey="tokenIndex"
                      stroke="#a1a1aa"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                      tickFormatter={(val) => `#${val}`}
                    />
                    {/* Left Y Axis: TPS */}
                    <YAxis
                      yAxisId="left"
                      stroke="#18181b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 'auto']}
                      tickFormatter={(val) => `${val} t/s`}
                    />
                    {/* Right Y Axis: Latency in ms */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#f59e0b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 'auto']}
                      tickFormatter={(val) => `${val}ms`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {calculatedAvgLatency > 0 && (
                      <ReferenceLine
                        yAxisId="right"
                        y={calculatedAvgLatency}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                      />
                    )}
                    {/* Area for TPS */}
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="tps"
                      name="Instantaneous TPS"
                      stroke="#18181b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#tpsGradient)"
                      isAnimationActive={false}
                    />
                    {/* Line for Latency Spikes */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="interTokenLatencyMs"
                      name="Latency (ms)"
                      stroke="#d97706"
                      strokeWidth={1.5}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (!payload?.isSpike) return null;
                        return (
                          <circle
                            key={`spike-dot-${payload.tokenIndex}`}
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill="#dc2626"
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                        );
                      }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {viewMode === 'tps' && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetry} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tpsOnlyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000000" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#000000" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis
                      dataKey="tokenIndex"
                      stroke="#a1a1aa"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                      tickFormatter={(val) => `tok ${val}`}
                    />
                    <YAxis
                      stroke="#18181b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 'auto']}
                      tickFormatter={(val) => `${val} t/s`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {currentAvgTps > 0 && (
                      <ReferenceLine
                        y={currentAvgTps}
                        stroke="#18181b"
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                        label={{
                          value: `Avg: ${currentAvgTps.toFixed(1)} t/s`,
                          position: 'top',
                          fill: '#71717a',
                          fontSize: 10
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="tps"
                      stroke="#000000"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#tpsOnlyGrad)"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeTps"
                      stroke="#71717a"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {viewMode === 'latency' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={telemetry} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis
                      dataKey="tokenIndex"
                      stroke="#a1a1aa"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                      tickFormatter={(val) => `#${val}`}
                    />
                    <YAxis
                      stroke="#18181b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 'auto']}
                      tickFormatter={(val) => `${val}ms`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {calculatedAvgLatency > 0 && (
                      <ReferenceLine
                        y={calculatedAvgLatency}
                        stroke="#71717a"
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                        label={{
                          value: `Avg: ${calculatedAvgLatency}ms`,
                          position: 'top',
                          fill: '#71717a',
                          fontSize: 10
                        }}
                      />
                    )}
                    <Bar
                      dataKey="interTokenLatencyMs"
                      radius={[2, 2, 0, 0]}
                      isAnimationActive={false}
                    >
                      {telemetry.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.isSpike ? '#ef4444' : '#27272a'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Legend / Diagnostic Footnote */}
          <div className="pt-2 border-t border-black/[0.04] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-zinc-900 inline-block" />
                Normal Latency / TPS
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                Spike Event (&gt;1.65x baseline)
              </span>
            </div>

            {calculatedSpikes > 0 ? (
              <span className="text-amber-700 font-medium">
                {calculatedSpikes} {calculatedSpikes === 1 ? 'delay spike' : 'delay spikes'} observed (e.g., KV cache expansion or browser GC)
              </span>
            ) : (
              <span className="text-zinc-500">
                Low variance runtime execution
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
