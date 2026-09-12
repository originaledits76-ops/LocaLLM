/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Sparkles,
  Sliders,
  Trash2,
  Copy,
  Check,
  Zap,
  ChevronDown,
  Layers,
  Activity
} from 'lucide-react';
import { ChatMessage, InferenceSettings, ModelInfo, TelemetryPoint } from '../types';
import { PerformanceMonitor } from './PerformanceMonitor';
import { FormattedMessage } from './FormattedMessage';
import { HardwareOptimizationBanner } from './HardwareOptimizationBanner';

interface ChatInterfaceProps {
  activeModel: ModelInfo | null;
  installedModels: ModelInfo[];
  messages: ChatMessage[];
  isGenerating: boolean;
  streamingContent: string;
  streamingMetrics: {
    tokensGenerated?: number;
    tokensPerSec?: number;
    instantaneousTps?: number;
    timeToFirstTokenMs?: number;
    backendUsed?: 'webgpu' | 'wasm' | 'cpu';
    peakTokensPerSec?: number;
    avgLatencyMs?: number;
    maxLatencyMs?: number;
    spikeCount?: number;
    telemetry?: TelemetryPoint[];
  };
  liveTelemetry?: TelemetryPoint[];
  settings: InferenceSettings;
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
  onClearChat: () => void;
  onSwitchModel: (modelId: string) => void;
  onOpenSettings: () => void;
  onNavigateToModels?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  activeModel,
  installedModels,
  messages,
  isGenerating,
  streamingContent,
  streamingMetrics,
  liveTelemetry = [],
  settings,
  onSendMessage,
  onStopGeneration,
  onClearChat,
  onSwitchModel,
  onOpenSettings,
  onNavigateToModels
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [isTelemetryExpanded, setIsTelemetryExpanded] = useState(true);
  const [inspectedMessageId, setInspectedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Automatically switch back to live stream when a new generation starts
  useEffect(() => {
    if (isGenerating) {
      setInspectedMessageId(null);
    }
  }, [isGenerating]);

  // Find inspected message if any
  const inspectedMessage = inspectedMessageId
    ? messages.find((m) => m.id === inspectedMessageId)
    : null;

  // Latest assistant message with metrics
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.metrics);

  // Determine which telemetry dataset to feed the monitor
  const activeTelemetryData = inspectedMessage?.metrics?.telemetry
    ? inspectedMessage.metrics.telemetry
    : liveTelemetry.length > 0
    ? liveTelemetry
    : latestAssistantMessage?.metrics?.telemetry || [];

  const activeTokensCount = inspectedMessage?.metrics?.tokensGenerated
    ?? streamingMetrics.tokensGenerated
    ?? latestAssistantMessage?.metrics?.tokensGenerated
    ?? 0;

  const activeAvgTps = inspectedMessage?.metrics?.tokensPerSec
    ?? streamingMetrics.tokensPerSec
    ?? latestAssistantMessage?.metrics?.tokensPerSec
    ?? 0;

  const activeInstTps = inspectedMessage
    ? undefined
    : streamingMetrics.instantaneousTps;

  const activePeakTps = inspectedMessage?.metrics?.peakTokensPerSec
    ?? streamingMetrics.peakTokensPerSec
    ?? latestAssistantMessage?.metrics?.peakTokensPerSec;

  const activeAvgLatency = inspectedMessage?.metrics?.avgLatencyMs
    ?? streamingMetrics.avgLatencyMs
    ?? latestAssistantMessage?.metrics?.avgLatencyMs;

  const activeMaxLatency = inspectedMessage?.metrics?.maxLatencyMs
    ?? streamingMetrics.maxLatencyMs
    ?? latestAssistantMessage?.metrics?.maxLatencyMs;

  const activeSpikeCount = inspectedMessage?.metrics?.spikeCount
    ?? streamingMetrics.spikeCount
    ?? latestAssistantMessage?.metrics?.spikeCount;

  const activeTtft = inspectedMessage?.metrics?.timeToFirstTokenMs
    ?? streamingMetrics.timeToFirstTokenMs
    ?? latestAssistantMessage?.metrics?.timeToFirstTokenMs;

  const activeBackend = inspectedMessage?.metrics?.backendUsed
    ?? streamingMetrics.backendUsed
    ?? latestAssistantMessage?.metrics?.backendUsed
    ?? 'wasm';

  // Auto-scroll to bottom on incoming stream or new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    const text = inputText.trim();
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden brutalist-bg">
      {/* Top Neubrutalist Sub-Header for Chat */}
      <header className="shrink-0 z-30 brutalist-header px-3 sm:px-6 py-2 sm:py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Model Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 border-black font-bold text-xs text-black bg-white hover:bg-amber-100 transition-all shadow-[2px_2px_0px_0px_#000] min-h-[38px]"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black animate-pulse shrink-0" />
              <span className="truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[240px] font-mono font-bold">
                {activeModel ? activeModel.name : 'Select Model'}
              </span>
              {activeModel && (
                <span className="hidden xs:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-black text-white">
                  {activeModel.parameterCount}
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-black shrink-0 ml-0.5" />
            </button>

            {showModelDropdown && (
              <div className="absolute top-full left-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-72 rounded-xl brutalist-card p-2 shadow-[6px_6px_0px_0px_#000] z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                  Installed Local Models
                </div>
                {installedModels.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-zinc-600 text-center font-medium">
                    No models installed yet.
                    {onNavigateToModels && (
                      <button
                        onClick={() => {
                          setShowModelDropdown(false);
                          onNavigateToModels();
                        }}
                        className="block mt-2.5 mx-auto px-4 py-2 rounded-xl bg-black text-white text-xs font-bold border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-800 transition-colors"
                      >
                        Explore Models Catalog
                      </button>
                    )}
                  </div>
                ) : (
                  installedModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSwitchModel(m.id);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors min-h-[40px] border my-1 ${
                        activeModel?.id === m.id
                          ? 'bg-black text-white font-bold border-black'
                          : 'text-black bg-white hover:bg-zinc-100 border-zinc-200'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold truncate">{m.name}</p>
                        <p className={`text-[10px] font-mono ${activeModel?.id === m.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {m.parameterCount} • {m.quantization}
                        </p>
                      </div>
                      {activeModel?.id === m.id && (
                        <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {messages.length > 0 && (
              <div 
                className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border-2 border-black text-[11px] font-mono font-bold text-black shadow-[2px_2px_0px_0px_#000]"
                title={`${messages.length} conversational turns active in model memory context`}
              >
                <Layers className="w-3.5 h-3.5 text-black" />
                <span>{messages.length} turns</span>
              </div>
            )}

            <button
              id="toggle-telemetry-button"
              type="button"
              onClick={() => setShowTelemetry(!showTelemetry)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black text-xs font-mono font-bold transition-all shadow-[2px_2px_0px_0px_#000] min-h-[36px] ${
                showTelemetry
                  ? 'bg-amber-300 text-black'
                  : 'bg-white hover:bg-zinc-100 text-black'
              }`}
              title="Toggle Performance Telemetry HUD"
              aria-label="Toggle Performance Telemetry"
            >
              <Activity className={`w-3.5 h-3.5 ${isGenerating ? 'animate-pulse text-emerald-600' : ''}`} />
              <span className="hidden xs:inline">Telemetry</span>
              {streamingMetrics.tokensPerSec !== undefined && streamingMetrics.tokensPerSec > 0 ? (
                <span className="font-bold text-emerald-700 bg-white px-1.5 rounded border border-black">{streamingMetrics.tokensPerSec.toFixed(1)} t/s</span>
              ) : activeAvgTps > 0 ? (
                <span className="text-[11px] opacity-90">{activeAvgTps.toFixed(1)} t/s</span>
              ) : null}
            </button>

            <button
              id="clear-chat-button"
              onClick={onClearChat}
              disabled={messages.length === 0 && !streamingContent}
              className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl border-2 border-black text-black bg-white hover:bg-rose-100 disabled:opacity-40 transition-colors shadow-[2px_2px_0px_0px_#000] shrink-0"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              id="open-settings-button"
              onClick={onOpenSettings}
              className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl border-2 border-black text-black bg-white hover:bg-zinc-100 transition-colors shadow-[2px_2px_0px_0px_#000] shrink-0"
              title="Inference Settings"
              aria-label="Inference Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hardware Optimization Status Banner */}
      <HardwareOptimizationBanner />

      {/* Visual Performance Monitor HUD */}
      {showTelemetry && (
        <div className="shrink-0 max-w-4xl w-full mx-auto px-3 sm:px-6 pt-2 pb-1 transition-all">
          {inspectedMessage && (
            <div className="mb-1.5 px-3 py-1.5 rounded-xl bg-amber-200 border-2 border-black flex items-center justify-between text-[11px] font-mono shadow-[2px_2px_0px_0px_#000]">
              <span className="text-black font-bold truncate mr-2">
                Inspecting snapshot from {new Date(inspectedMessage.timestamp).toLocaleTimeString()}
              </span>
              <button
                type="button"
                onClick={() => setInspectedMessageId(null)}
                className="text-black font-extrabold hover:underline shrink-0 text-[11px]"
              >
                &larr; Return to Live Stream
              </button>
            </div>
          )}
          <PerformanceMonitor
            telemetry={activeTelemetryData}
            isGenerating={isGenerating && !inspectedMessageId}
            activeModelName={activeModel?.name}
            backendUsed={activeBackend}
            ttftMs={activeTtft}
            tokensGenerated={activeTokensCount}
            tokensPerSec={activeAvgTps}
            instantaneousTps={activeInstTps}
            peakTps={activePeakTps}
            avgLatencyMs={activeAvgLatency}
            maxLatencyMs={activeMaxLatency}
            spikeCount={activeSpikeCount}
            isExpanded={isTelemetryExpanded}
            onToggleExpand={() => setIsTelemetryExpanded(!isTelemetryExpanded)}
            onClose={() => setShowTelemetry(false)}
          />
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto w-full">
        {messages.length === 0 && !streamingContent ? (
          /* Empty / Welcome State */
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8 px-2">
            <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-4 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
              <Sparkles className="w-7 h-7 text-amber-300" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-black font-display text-black tracking-tight uppercase">
              {activeModel ? activeModel.name : 'Pocket Local AI'}
            </h3>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 mb-6 text-xs font-mono font-bold">
              <span className="px-3 py-1 rounded-xl bg-emerald-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-black" />
                100% On-Device Private
              </span>
              <span className="px-3 py-1 rounded-xl bg-amber-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-black" />
                Zero Latency
              </span>
            </div>

            {/* Starter Prompt Cards */}
            {activeModel && activeModel.samplePrompts.length > 0 ? (
              <div className="w-full space-y-3 text-left">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider px-1 font-mono">
                  Prompt Ideas
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeModel.samplePrompts.slice(0, 4).map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(prompt)}
                      className="text-left p-4 rounded-xl brutalist-card-interactive group flex flex-col justify-between min-h-[80px]"
                    >
                      <span className="text-xs font-bold text-black leading-snug">
                        "{prompt}"
                      </span>
                      <span className="mt-3 text-[10px] font-mono font-bold text-zinc-500 group-hover:text-black flex items-center gap-1">
                        Send Prompt &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : !activeModel ? (
              <div className="mt-4">
                <button
                  onClick={onNavigateToModels}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black text-white text-xs font-bold border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:bg-zinc-800 transition-all min-h-[44px]"
                >
                  <Layers className="w-4 h-4 text-amber-300" />
                  <span>Explore & Download Models</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 max-w-[92%] sm:max-w-2xl ${
                  msg.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                <div
                  className={`relative group rounded-2xl p-4 text-sm leading-relaxed border-2 border-black shadow-[4px_4px_0px_0px_#000] backdrop-blur-md ${
                    msg.role === 'user'
                      ? 'bg-black/90 text-white font-medium'
                      : 'bg-white/85 text-black font-medium'
                  }`}
                >
                  <div className="pr-6">
                    <FormattedMessage content={msg.content} isUser={msg.role === 'user'} />
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(msg.content, msg.id)}
                    className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity min-w-[28px] min-h-[28px] flex items-center justify-center border ${
                      msg.role === 'user' ? 'text-zinc-300 hover:text-white bg-zinc-800 border-zinc-700' : 'text-zinc-600 hover:text-black bg-zinc-100 border-black'
                    }`}
                    title="Copy message"
                    aria-label="Copy message"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Metrics Footnote */}
                  {msg.role === 'assistant' && msg.metrics && (
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedMessageId(msg.id);
                        setShowTelemetry(true);
                        setIsTelemetryExpanded(true);
                      }}
                      className="mt-3 pt-2 border-t border-black/10 flex flex-wrap items-center gap-2 text-[10px] font-mono font-bold text-zinc-600 hover:text-black transition-colors w-full text-left group cursor-pointer"
                      title="Inspect performance telemetry for this message"
                    >
                      <span className="flex items-center gap-1 font-bold text-emerald-900 bg-emerald-300 px-2 py-0.5 rounded border border-black">
                        <Activity className="w-3 h-3 text-emerald-900" />
                        {msg.metrics.tokensPerSec ? `${msg.metrics.tokensPerSec.toFixed(1)} t/s` : 'Metrics'}
                      </span>
                      {msg.metrics.tokensGenerated && (
                        <span>{msg.metrics.tokensGenerated} tokens</span>
                      )}
                      {msg.metrics.timeToFirstTokenMs && (
                        <span>• {(msg.metrics.timeToFirstTokenMs / 1000).toFixed(2)}s TTFT</span>
                      )}
                      {msg.metrics.backendUsed && (
                        <span className="uppercase text-zinc-500 font-bold">• {msg.metrics.backendUsed === 'webgpu' ? 'GPU' : 'CPU'}</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming Bubble */}
            {isGenerating && (
              <div className="flex gap-2 max-w-[92%] sm:max-w-2xl mr-auto justify-start">
                <div className="relative rounded-2xl p-4 text-sm leading-relaxed bg-white/85 backdrop-blur-md text-black border-2 border-black shadow-[4px_4px_0px_0px_#000]">
                  <div>
                    {streamingContent ? (
                      <FormattedMessage content={streamingContent} isUser={false} />
                    ) : (
                      <span className="text-zinc-500 font-mono text-xs font-bold italic">Generating response on GPU...</span>
                    )}
                    <span className="inline-block w-2.5 h-4 ml-1 bg-black animate-pulse align-middle" />
                  </div>

                  {streamingMetrics.tokensPerSec !== undefined && streamingMetrics.tokensPerSec > 0 && (
                    <div className="mt-3 pt-2 border-t border-black/10 flex items-center gap-2 text-[10px] font-mono text-zinc-600 font-bold">
                      <span className="flex items-center gap-1 font-bold text-emerald-900 bg-emerald-300 px-2 py-0.5 rounded border border-black">
                        <Activity className="w-3 h-3 text-emerald-900 animate-pulse" />
                        {streamingMetrics.tokensPerSec.toFixed(1)} t/s
                      </span>
                      {streamingMetrics.tokensGenerated && (
                        <span>• {streamingMetrics.tokensGenerated} tokens</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Clean Bottom Input Box */}
      <div className="shrink-0 w-full z-30 px-3 sm:px-6 py-3 bg-white/80 backdrop-blur-xl border-t-2 border-black">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="brutalist-card p-2 sm:p-2.5 flex items-end gap-2"
          >
            <textarea
              ref={textareaRef}
              id="chat-input-textarea"
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeModel
                  ? `Prompt ${activeModel.name}...`
                  : 'Select or download a model first...'
              }
              disabled={!activeModel || isGenerating}
              className="flex-1 resize-none bg-transparent text-sm text-black placeholder:text-zinc-400 focus:outline-none py-2 px-1 max-h-24 leading-normal font-sans font-medium"
            />

            {isGenerating ? (
              <button
                type="button"
                id="stop-generation-button"
                onClick={onStopGeneration}
                className="px-4 py-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 flex items-center justify-center gap-1.5 shrink-0 transition-all font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] my-auto cursor-pointer"
                title="Stop generation"
                aria-label="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                id="send-message-button"
                disabled={!inputText.trim() || !activeModel}
                className="px-4 py-2.5 rounded-xl bg-black text-white hover:bg-zinc-800 disabled:opacity-30 flex items-center justify-center gap-1.5 shrink-0 transition-all font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none my-auto cursor-pointer"
                title="Send prompt"
                aria-label="Send message"
              >
                <span>Send</span>
                <ArrowUp className="w-4 h-4 stroke-[3]" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
