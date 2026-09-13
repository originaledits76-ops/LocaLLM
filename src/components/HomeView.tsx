/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  Sparkles,
  Bot,
  Zap,
  Sliders,
  ChevronRight,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  Compass,
  MessageSquare,
  Flame,
  Star,
  Plus
} from 'lucide-react';
import { ModelInfo } from '../types';
import { WebGpuLiveStatus } from './WebGpuLiveStatus';

interface HomeViewProps {
  activeModel: ModelInfo | null;
  installedModels: ModelInfo[];
  isModelInstalled?: boolean;
  onStartNewChat: (prompt?: string) => void;
  onNavigateToModels: () => void;
  onNavigateToHardware: () => void;
  onPromptInstall?: () => void;
  onOpenWebGpuGuide?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  activeModel,
  installedModels,
  isModelInstalled = false,
  onStartNewChat,
  onNavigateToModels,
  onNavigateToHardware,
  onPromptInstall,
  onOpenWebGpuGuide
}) => {
  const [selectedTopic, setSelectedTopic] = useState<string>('All');

  const historyTopics = [
    { label: 'What is a wild animal?', prompt: 'What is a wild animal? Explain their natural habitats.' },
    { label: 'UI/UX Design', prompt: 'Give me 5 essential principles of modern UI/UX design for AI apps.' },
    { label: 'iOS App', prompt: 'How do I optimize local ML models for mobile iOS devices?' },
    { label: 'Meaning of white rose', prompt: 'What is the symbolic meaning of a white rose in literature?' }
  ];

  const popularPrompts = [
    {
      id: 'sushi-recipe',
      title: 'Explain a Sushi Roll recipe',
      subtitle: 'Cooking & Recipes',
      prompt: 'Explain how to prepare a delicious sushi roll at home step-by-step.',
      color: 'lime',
      author: 'Kanny_low',
      icon: '🍣'
    },
    {
      id: '2025-goals',
      title: 'Give the best resolution for 2025',
      subtitle: 'Self Improvement',
      prompt: 'What are the top impactful New Year goals and resolutions to adopt for 2025?',
      color: 'cyan',
      author: 'Jon_Jenny',
      icon: '🍀'
    },
    {
      id: 'code-review',
      title: 'Analyze React code performance',
      subtitle: 'Software Engineering',
      prompt: 'How can I optimize React re-renders and memory footprint in full-stack apps?',
      color: 'yellow',
      author: 'Dev_Expert',
      icon: '⚡'
    },
    {
      id: 'local-ai-guide',
      title: 'Explain WebGPU vs WASM inference',
      subtitle: 'AI Hardware',
      prompt: 'Explain the technical differences between WebGPU shaders and WebAssembly SIMD execution for local LLMs.',
      color: 'mint',
      author: 'Local_AI',
      icon: '🧠'
    }
  ];

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-6 pb-28">
      {/* App Header Banner in Aidora Style */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-white border border-zinc-200/80 shadow-xs flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#18181b]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-display font-extrabold text-xl text-zinc-900 tracking-tight">
              Aidora
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#c7f43a] text-[10px] font-mono font-bold text-zinc-900 border border-black/10">
              2.0
            </span>
          </div>
        </div>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2">
          {activeModel && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-zinc-200/80 text-xs font-medium text-zinc-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-zinc-900">{activeModel.name}</span>
            </div>
          )}
          <div className="w-10 h-10 rounded-full bg-amber-200 border-2 border-white shadow-xs overflow-hidden flex items-center justify-center text-amber-900 font-bold text-sm">
            <span>👤</span>
          </div>
        </div>
      </div>

      {/* Main Headline */}
      <div className="pt-2 space-y-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-zinc-900 tracking-tight leading-tight">
          How can I help you <br className="hidden xs:inline" /> today?
        </h1>

        {/* Live WebGPU Hardware Status Banner */}
        <WebGpuLiveStatus onOpenGuideModal={onOpenWebGpuGuide} />
      </div>

      {/* Start New Chat Large Action Pill Button (Exact Match to Aidora center mockup) */}
      <button
        onClick={() => onStartNewChat()}
        className="w-full aidora-pill-action flex items-center justify-between group cursor-pointer"
      >
        <span className="font-display font-bold text-base sm:text-lg tracking-tight text-white pl-1">
          Start New Chat
        </span>
        <div className="aidora-lime-btn w-10 h-10 flex items-center justify-center shrink-0">
          <ArrowRight className="w-5 h-5 text-[#18181b] group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* Chat History Topics Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 font-display">
            Chat history
          </h2>
          <button
            onClick={() => onStartNewChat()}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            See All
          </button>
        </div>

        {/* Horizontal Scrollable Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {historyTopics.map((topic, idx) => (
            <button
              key={idx}
              onClick={() => onStartNewChat(topic.prompt)}
              className="px-4 py-2 rounded-full bg-white border border-zinc-200/80 hover:border-zinc-400 text-xs font-medium text-zinc-800 shrink-0 shadow-2xs transition-all hover:scale-[1.02] active:scale-98"
            >
              {topic.label}
            </button>
          ))}
          <button
            onClick={onNavigateToModels}
            className="px-4 py-2 rounded-full bg-[#18181b] text-white text-xs font-semibold shrink-0 shadow-xs hover:bg-zinc-800 transition-colors"
          >
            More
          </button>
        </div>
      </div>

      {/* Popular Prompts Section (Matching side-by-side colorful cards) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 font-display">
            Popular Prompt
          </h2>
          <button
            onClick={() => onStartNewChat()}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            See All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {popularPrompts.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-[28px] flex flex-col justify-between min-h-[160px] relative overflow-hidden transition-all hover:-translate-y-1 ${
                item.color === 'lime'
                  ? 'aidora-card-lime'
                  : item.color === 'cyan'
                  ? 'aidora-card-cyan'
                  : item.color === 'yellow'
                  ? 'bg-[#f8f0a0] text-zinc-900 shadow-sm'
                  : 'bg-[#d8f4e2] text-zinc-900 shadow-sm'
              }`}
            >
              {/* Top Title */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold font-display leading-snug max-w-[85%] text-zinc-900">
                    {item.title}
                  </h3>
                  <span className="text-lg shrink-0">{item.icon}</span>
                </div>
                <p className="text-[11px] font-medium text-zinc-600 mt-2">
                  Generate by {item.author}
                </p>
              </div>

              {/* Bottom White Use Prompt Pill */}
              <div className="mt-5">
                <button
                  onClick={() => onStartNewChat(item.prompt)}
                  className="w-full py-2.5 px-4 rounded-full bg-white text-zinc-900 font-bold text-xs shadow-2xs hover:shadow-xs hover:bg-zinc-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Use this prompt</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Status & IndexedDB Card */}
      <div className="aidora-card-white p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#18181b] text-[#c7f43a] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-zinc-900 font-display">
                {activeModel ? activeModel.name : 'Qwen 2.5 1.5B (Instruct)'}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#edf9d5] text-zinc-900 border border-black/10">
                IndexedDB
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
              {isModelInstalled
                ? 'Installed in IndexedDB • Ready for WebGPU inference'
                : 'Not installed yet • Click to download & store in IndexedDB'}
            </p>
          </div>
        </div>

        {isModelInstalled ? (
          <button
            onClick={onPromptInstall}
            className="px-3.5 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold transition-colors shrink-0"
          >
            Model Info
          </button>
        ) : (
          <button
            onClick={onPromptInstall}
            className="px-4 py-2 rounded-full bg-[#18181b] hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#c7f43a]" />
            <span>Install</span>
          </button>
        )}
      </div>
    </div>
  );
};
