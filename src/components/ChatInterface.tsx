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
    <div className="flex flex-col h-[100dvh] w-full relative overflow-hidden">
      {/* Top Floating Glass Header */}
      <header className="shrink-0 sticky top-0 z-30 liquid-glass border-b border-black/[0.06] px-3 sm:px-6 py-2 sm:py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Model Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-full border border-black/10 hover:border-black text-xs font-semibold text-black bg-white/70 hover:bg-white transition-all shadow-xs min-h-[40px]"
            >
              <div className="w-2 h-2 rounded-full bg-black animate-pulse shrink-0" />
              <span className="truncate max-w-[120px] xs:max-w-[170px] sm:max-w-[220px]">
                {activeModel ? activeModel.name : 'Select Model'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            </button>

            {showModelDropdown && (
              <div className="absolute top-full left-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-72 rounded-2xl liquid-glass-dock p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-mono text-zinc-400 uppercase">
                  Installed Models
                </div>
                {installedModels.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-zinc-500 text-center">
                    No models installed yet.
                    {onNavigateToModels && (
                      <button
                        onClick={() => {
                          setShowModelDropdown(false);
                          onNavigateToModels();
                        }}
                        className="block mt-2 mx-auto px-3 py-1.5 rounded-full bg-black text-white text-xs font-medium min-h-[36px]"
                      >
                        Explore Models
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
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors min-h-[44px] ${
                        activeModel?.id === m.id
                          ? 'bg-black text-white font-medium'
                          : 'text-black hover:bg-black/5'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <p className="font-semibold truncate">{m.name}</p>
                        <p className={`text-[10px] font-mono ${activeModel?.id === m.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {m.parameterCount} • {m.quantization}
                        </p>
                      </div>
                      {activeModel?.id === m.id && (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Visual Performance Monitor Button */}
            <button
              id="toggle-telemetry-button"
              type="button"
              onClick={() => setShowTelemetry(!showTelemetry)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono transition-all shadow-xs min-h-[36px] ${
                showTelemetry
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-white/70 hover:bg-white text-zinc-700 hover:text-black border-black/10'
              }`}
              title="Toggle Performance Telemetry & Latency Spikes Monitor"
              aria-label="Toggle Performance Telemetry"
            >
              <Activity className={`w-3.5 h-3.5 ${isGenerating ? 'animate-pulse text-emerald-400' : ''}`} />
              <span className="hidden xs:inline">Telemetry</span>
              {streamingMetrics.tokensPerSec !== undefined && streamingMetrics.tokensPerSec > 0 ? (
                <span className="font-semibold">{streamingMetrics.tokensPerSec.toFixed(1)} t/s</span>
              ) : activeAvgTps > 0 ? (
                <span className="text-[11px] opacity-80">{activeAvgTps.toFixed(1)} t/s</span>
              ) : null}
            </button>

            <button
              id="clear-chat-button"
              onClick={onClearChat}
              disabled={messages.length === 0 && !streamingContent}
              className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-black/10 hover:border-black text-zinc-400 hover:text-black disabled:opacity-30 bg-white/60 transition-colors shadow-xs shrink-0"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              id="open-settings-button"
              onClick={onOpenSettings}
              className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-black/10 hover:border-black text-black bg-white/60 transition-colors shadow-xs shrink-0"
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
            <div className="mb-1.5 px-3 py-1 rounded-xl bg-black/5 flex items-center justify-between text-[11px] font-mono border border-black/5">
              <span className="text-zinc-600 truncate mr-2">
                Inspecting snapshot for response from {new Date(inspectedMessage.timestamp).toLocaleTimeString()}
              </span>
              <button
                type="button"
                onClick={() => setInspectedMessageId(null)}
                className="text-black font-semibold hover:underline shrink-0 text-[11px]"
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
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-3.5 max-w-3xl mx-auto w-full">
        {messages.length === 0 && !streamingContent ? (
          /* Empty / Welcome State */
          <div className="min-h-[45vh] flex flex-col items-center justify-center text-center max-w-md mx-auto py-8 px-2">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-black text-white flex items-center justify-center mb-3 shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-black tracking-tight">
              {activeModel ? activeModel.name : 'Local AI'}
            </h3>

            <p className="text-xs text-zinc-500 mt-1 max-w-xs leading-relaxed">
              100% on-device inference via ONNX Runtime Web.
            </p>

            {/* Quick Starters */}
            {activeModel && activeModel.samplePrompts.length > 0 ? (
              <div className="mt-5 sm:mt-6 w-full space-y-2">
                {activeModel.samplePrompts.slice(0, 3).map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(prompt)}
                    className="w-full text-left px-3.5 sm:px-4 py-2.5 rounded-2xl liquid-glass-card hover:border-black/30 text-xs text-zinc-800 hover:text-black transition-all flex items-center justify-between group min-h-[44px]"
                  >
                    <span className="truncate pr-2">"{prompt}"</span>
                    <Sparkles className="w-3 h-3 text-zinc-400 group-hover:text-black shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            ) : !activeModel ? (
              <div className="mt-5">
                <button
                  onClick={onNavigateToModels}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-xs min-h-[44px]"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Choose a Model to Download</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 max-w-[90%] sm:max-w-2xl ${
                  msg.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                <div
                  className={`relative group rounded-3xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-black text-white rounded-br-xs shadow-sm'
                      : 'liquid-glass-card text-black rounded-bl-xs shadow-xs'
                  }`}
                >
                  <div className="pr-6">
                    <FormattedMessage content={msg.content} isUser={msg.role === 'user'} />
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(msg.content, msg.id)}
                    className={`absolute top-2 right-2 p-1.5 rounded-md opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity min-w-[28px] min-h-[28px] flex items-center justify-center ${
                      msg.role === 'user' ? 'text-zinc-400 hover:text-white' : 'text-zinc-400 hover:text-black'
                    }`}
                    title="Copy"
                    aria-label="Copy message"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Metrics Footnote with Telemetry Inspector */}
                  {msg.role === 'assistant' && msg.metrics && (
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedMessageId(msg.id);
                        setShowTelemetry(true);
                        setIsTelemetryExpanded(true);
                      }}
                      className="mt-2 pt-1.5 border-t border-black/[0.05] flex items-center gap-1.5 sm:gap-2 text-[10px] font-mono text-zinc-500 hover:text-black transition-colors w-full text-left group cursor-pointer"
                      title="Click to inspect tokens-per-second chart and latency spikes for this message"
                    >
                      <Activity className="w-3 h-3 text-zinc-400 group-hover:text-black shrink-0" />
                      <span>{msg.metrics.tokensPerSec ? `${msg.metrics.tokensPerSec.toFixed(1)} tok/s` : 'Metrics'}</span>
                      {msg.metrics.tokensGenerated && (
                        <span>• {msg.metrics.tokensGenerated} tokens</span>
                      )}
                      {msg.metrics.spikeCount !== undefined && msg.metrics.spikeCount > 0 && (
                        <span className="text-amber-600 font-semibold">• {msg.metrics.spikeCount} {msg.metrics.spikeCount === 1 ? 'spike' : 'spikes'}</span>
                      )}
                      {msg.metrics.backendUsed && (
                        <span className="uppercase">• {msg.metrics.backendUsed}</span>
                      )}
                      <span className="ml-auto text-[9px] text-zinc-400 group-hover:text-black underline opacity-0 group-hover:opacity-100 transition-opacity hidden xs:inline">
                        View Chart &rarr;
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming Bubble */}
            {isGenerating && (
              <div className="flex gap-2 max-w-[90%] sm:max-w-2xl mr-auto justify-start">
                <div className="relative rounded-3xl rounded-bl-xs px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed liquid-glass-card text-black shadow-xs">
                  <div>
                    {streamingContent ? (
                      <FormattedMessage content={streamingContent} isUser={false} />
                    ) : (
                      <span className="text-zinc-400 italic font-mono text-xs">Generating locally...</span>
                    )}
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-black animate-pulse align-middle" />
                  </div>

                  {streamingMetrics.tokensPerSec !== undefined && streamingMetrics.tokensPerSec > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-black/[0.05] flex items-center gap-1.5 sm:gap-2 text-[10px] font-mono text-zinc-500">
                      <Activity className="w-3 h-3 text-emerald-600 animate-pulse shrink-0" />
                      <span>{streamingMetrics.tokensPerSec.toFixed(1)} tok/s</span>
                      {streamingMetrics.tokensGenerated && (
                        <span>• {streamingMetrics.tokensGenerated} tokens</span>
                      )}
                      {streamingMetrics.spikeCount !== undefined && streamingMetrics.spikeCount > 0 && (
                        <span className="text-amber-600 font-semibold">• {streamingMetrics.spikeCount} {streamingMetrics.spikeCount === 1 ? 'spike' : 'spikes'}</span>
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

      {/* Chat Input Bar docked naturally above the bottom nav */}
      <div className="shrink-0 w-full z-40 px-3 sm:px-4 pt-1.5 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="liquid-glass-dock rounded-3xl sm:rounded-full pl-3.5 sm:pl-4 pr-1.5 sm:pr-2 py-1.5 flex items-end gap-2 border border-black/[0.08] shadow-md min-h-[48px]"
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
                  ? `Message ${activeModel.name}...`
                  : 'Select or download a model first...'
              }
              disabled={!activeModel || isGenerating}
              className="flex-1 resize-none bg-transparent text-base sm:text-sm text-black placeholder:text-zinc-400 focus:outline-none py-1.5 max-h-24 leading-normal"
            />

            {isGenerating ? (
              <button
                type="button"
                id="stop-generation-button"
                onClick={onStopGeneration}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-black text-white hover:bg-zinc-800 flex items-center justify-center shrink-0 transition-colors shadow-xs my-auto"
                title="Stop generation"
                aria-label="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                id="send-message-button"
                disabled={!inputText.trim() || !activeModel}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-black text-white hover:bg-zinc-800 disabled:opacity-20 disabled:hover:bg-black flex items-center justify-center shrink-0 transition-all shadow-xs my-auto"
                title="Send"
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
