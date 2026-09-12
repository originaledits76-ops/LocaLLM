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
  Activity,
  Plus
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
    <div className="flex flex-col h-full w-full relative overflow-hidden aidora-bg">
      {/* Top Aidora Header Bar */}
      <header className="shrink-0 z-30 px-3 sm:px-6 py-3 bg-white/70 backdrop-blur-xl border-b border-zinc-200/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          {/* Back Button Circle */}
          <button
            onClick={onNavigateToModels}
            className="w-10 h-10 rounded-full bg-white border border-zinc-200/80 hover:border-zinc-400 text-zinc-800 flex items-center justify-center shadow-2xs transition-all hover:scale-105"
            title="Back to Catalog"
          >
            <ChevronDown className="w-5 h-5 rotate-90 stroke-[2.5]" />
          </button>

          {/* Center Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-200/80 font-display font-bold text-xs text-zinc-900 bg-white hover:bg-zinc-50 transition-all shadow-2xs min-h-[40px]"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[260px]">
                {activeModel ? activeModel.name : 'Select Model'}
              </span>
              <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0 ml-0.5" />
            </button>

            {showModelDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-72 rounded-[24px] bg-white p-2.5 shadow-xl border border-zinc-200 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  Installed Models
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
                        className="block mt-2.5 mx-auto px-4 py-2 rounded-full bg-[#18181b] text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
                      >
                        Explore Catalog
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
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors min-h-[42px] ${
                        activeModel?.id === m.id
                          ? 'bg-[#18181b] text-white font-bold shadow-2xs'
                          : 'text-zinc-900 bg-white hover:bg-zinc-100'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold truncate">{m.name}</p>
                        <p className={`text-[10px] font-mono ${activeModel?.id === m.id ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {m.parameterCount} • {m.quantization}
                        </p>
                      </div>
                      {activeModel?.id === m.id && (
                        <Check className="w-4 h-4 shrink-0 text-[#c7f43a]" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            <button
              id="toggle-telemetry-button"
              type="button"
              onClick={() => setShowTelemetry(!showTelemetry)}
              className={`w-10 h-10 rounded-full border border-zinc-200/80 flex items-center justify-center transition-all shadow-2xs ${
                showTelemetry ? 'bg-[#18181b] text-[#c7f43a]' : 'bg-white text-zinc-700 hover:text-black'
              }`}
              title="Toggle Performance Telemetry"
              aria-label="Toggle Performance Telemetry"
            >
              <Activity className="w-4 h-4" />
            </button>

            <button
              id="open-settings-button"
              onClick={onOpenSettings}
              className="w-10 h-10 rounded-full bg-white border border-zinc-200/80 hover:border-zinc-400 text-zinc-800 flex items-center justify-center shadow-2xs transition-all hover:scale-105"
              title="Inference Settings"
              aria-label="Inference Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Visual Performance Monitor HUD */}
      {showTelemetry && (
        <div className="shrink-0 max-w-3xl w-full mx-auto px-3 sm:px-6 pt-2 pb-1 transition-all">
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
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 max-w-3xl mx-auto w-full pb-32">
        {/* Dynamic Topic Headline matching Aidora screen 3 */}
        {messages.length > 0 && messages[0].role === 'user' && (
          <div className="pt-1 pb-2">
            <h2 className="text-xl sm:text-2xl font-extrabold font-display text-zinc-900 tracking-tight leading-tight">
              {messages[0].content.length > 45 ? `${messages[0].content.slice(0, 45)}...` : messages[0].content}
            </h2>
          </div>
        )}

        {messages.length === 0 && !streamingContent ? (
          /* Empty / Welcome State */
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8 px-2">
            <div className="w-14 h-14 rounded-full bg-[#18181b] text-[#c7f43a] flex items-center justify-center mb-4 shadow-md">
              <Sparkles className="w-7 h-7" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-zinc-900 tracking-tight">
              {activeModel ? activeModel.name : 'Aidora On-Device AI'}
            </h3>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 mb-6 text-xs font-semibold">
              <span className="px-3.5 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-800 shadow-2xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                100% Private On-Device
              </span>
              <span className="px-3.5 py-1.5 rounded-full bg-[#e2f779] text-zinc-900 border border-black/5 shadow-2xs flex items-center gap-1.5 font-bold">
                <Zap className="w-3.5 h-3.5" />
                Zero Latency
              </span>
            </div>

            {/* Starter Prompt Cards */}
            {activeModel && activeModel.samplePrompts.length > 0 ? (
              <div className="w-full space-y-3 text-left">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1 font-display">
                  Suggested Prompts
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeModel.samplePrompts.slice(0, 4).map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(prompt)}
                      className="text-left p-4 rounded-[24px] bg-white border border-zinc-200/80 shadow-2xs hover:shadow-md hover:border-zinc-300 group flex flex-col justify-between min-h-[84px] transition-all"
                    >
                      <span className="text-xs font-medium text-zinc-900 leading-relaxed">
                        "{prompt}"
                      </span>
                      <span className="mt-3 text-[11px] font-bold text-zinc-400 group-hover:text-[#18181b] flex items-center gap-1">
                        Ask Aidora &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[94%] sm:max-w-xl ${
                  msg.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                {/* Assistant Bot Icon Badge */}
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-[#18181b] text-[#c7f43a] flex items-center justify-center shrink-0 shadow-2xs mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`relative group rounded-[26px] p-4 sm:p-5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#cbebf0] text-zinc-900 rounded-tr-md font-medium shadow-2xs'
                      : 'bg-white text-zinc-900 rounded-tl-md font-medium shadow-2xs border border-zinc-200/60'
                  }`}
                >
                  <div className="pr-6">
                    <FormattedMessage content={msg.content} isUser={msg.role === 'user'} />
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(msg.content, msg.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-full opacity-60 hover:opacity-100 transition-opacity text-zinc-500 hover:text-black hover:bg-black/5"
                    title="Copy message"
                    aria-label="Copy message"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Metrics Footnote */}
                  {msg.role === 'assistant' && msg.metrics && (
                    <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                      {msg.metrics.tokensPerSec && (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {msg.metrics.tokensPerSec.toFixed(1)} t/s
                        </span>
                      )}
                      {msg.metrics.tokensGenerated && (
                        <span>{msg.metrics.tokensGenerated} tokens</span>
                      )}
                    </div>
                  )}
                </div>

                {/* User Avatar Badge */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-sky-200 text-sky-900 border border-white flex items-center justify-center shrink-0 shadow-2xs mt-1 font-bold text-xs">
                    👤
                  </div>
                )}
              </div>
            ))}

            {/* Streaming Assistant Bubble */}
            {isGenerating && (
              <div className="flex gap-3 max-w-[94%] sm:max-w-xl mr-auto justify-start">
                <div className="w-8 h-8 rounded-full bg-[#18181b] text-[#c7f43a] flex items-center justify-center shrink-0 shadow-2xs mt-1">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="relative rounded-[26px] rounded-tl-md p-4 sm:p-5 text-sm leading-relaxed bg-white text-zinc-900 font-medium shadow-2xs border border-zinc-200/60">
                  <div>
                    {streamingContent ? (
                      <FormattedMessage content={streamingContent} isUser={false} />
                    ) : (
                      <span className="text-zinc-400 font-medium text-xs">Generating response...</span>
                    )}
                    <span className="inline-block w-2 h-4 ml-1 bg-[#18181b] animate-pulse align-middle" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Floating Stop Generation Pill */}
      {isGenerating && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={onStopGeneration}
            className="bg-[#18181b] text-white px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
            <span>Stop generate</span>
          </button>
        </div>
      )}

      {/* Aidora Clean Floating Bottom Input Bar */}
      <div className="fixed bottom-4 left-0 right-0 z-30 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-full p-2 pl-4 flex items-center gap-2 border border-zinc-200/80 shadow-lg shadow-zinc-300/30 min-h-[52px]"
          >
            {/* Left Plus Icon */}
            <button
              type="button"
              onClick={onNavigateToModels}
              className="w-9 h-9 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 flex items-center justify-center shrink-0 transition-colors"
              title="Add attachment / Select Model"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>

            <textarea
              ref={textareaRef}
              id="chat-input-textarea"
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me everything..."
              disabled={!activeModel || isGenerating}
              className="flex-1 resize-none bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none py-1.5 max-h-24 leading-normal font-sans font-medium"
            />

            {/* Right Send Button (Electric Lime Circle) */}
            <button
              type="submit"
              id="send-message-button"
              disabled={!inputText.trim() || !activeModel || isGenerating}
              className="aidora-lime-btn w-10 h-10 flex items-center justify-center shrink-0 disabled:opacity-30 disabled:hover:scale-100 shadow-2xs my-auto cursor-pointer"
              title="Send prompt"
              aria-label="Send message"
            >
              <ArrowUp className="w-5 h-5 text-[#18181b] stroke-[2.5]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
