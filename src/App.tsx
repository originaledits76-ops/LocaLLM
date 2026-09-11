/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  MessageSquare,
  Sparkles,
  Sliders,
  RotateCcw,
  Check
} from 'lucide-react';
import { AVAILABLE_MODELS } from './data/models';
import {
  DeviceSpecs,
  ModelInfo,
  ModelRecommendation,
  ModelRuntimeState,
  ChatMessage,
  InferenceSettings,
  TelemetryPoint
} from './types';
import { scanDeviceHardware, evaluateModelRecommendations } from './services/deviceScanner';
import { getInstalledModelRecords, uninstallModel } from './services/cacheManager';
import {
  installOrLoadModel,
  streamChatCompletion,
  abortOperation,
  isModelLoaded,
  unloadActiveModel
} from './services/onnxRunner';
import { DeviceSpecsCard } from './components/DeviceSpecsCard';
import { ModelCatalog } from './components/ModelCatalog';
import { ChatInterface } from './components/ChatInterface';

type AppTab = 'chat' | 'models' | 'hardware' | 'settings';

export default function App() {
  // Device Specs State
  const [specs, setSpecs] = useState<DeviceSpecs | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);

  // Navigation State: bottom nav with 'chat' | 'models' | 'hardware' | 'settings'
  const [activeTab, setActiveTab] = useState<AppTab>('models');

  // Runtime Models State
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [runtimeStates, setRuntimeStates] = useState<Record<string, ModelRuntimeState>>({});

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingMetrics, setStreamingMetrics] = useState<{
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
  }>({});
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryPoint[]>([]);

  // Settings State
  const [settings, setSettings] = useState<InferenceSettings>({
    temperature: 0.6,
    maxTokens: 256,
    topP: 0.9,
    topK: 40,
    fastMode: true,
    systemPrompt: 'You are a helpful and concise AI assistant running locally in the browser via ONNX Runtime Web.',
    preferWebGpu: true // Auto-detects WebGPU for 15-40 tok/s with seamless multi-threaded WASM fallback
  });
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  // Floating Status Toast
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  /**
   * Run initial hardware diagnostics scan on mount
   */
  const performHardwareScan = useCallback(async (customRam?: number) => {
    setIsScanning(true);
    try {
      const detected = await scanDeviceHardware(customRam);
      setSpecs(detected);

      // Auto-enable WebGPU when hardware support is detected on device
      if (detected.webGpuAvailable) {
        setSettings((s) => ({ ...s, preferWebGpu: true }));
      }

      const recs = evaluateModelRecommendations(detected, AVAILABLE_MODELS);
      setRecommendations(recs);

      // Check previously installed models in local storage cache
      const cachedRecords = getInstalledModelRecords();
      const initialRuntimeStates: Record<string, ModelRuntimeState> = {};

      AVAILABLE_MODELS.forEach((m) => {
        if (cachedRecords[m.id]) {
          initialRuntimeStates[m.id] = {
            status: 'ready',
            progress: 100,
            statusMessage: 'Installed in browser cache',
            downloadedBytes: m.downloadSizeMB * 1024 * 1024,
            totalBytes: m.downloadSizeMB * 1024 * 1024
          };
        } else {
          initialRuntimeStates[m.id] = {
            status: 'not_installed',
            progress: 0,
            statusMessage: '',
            downloadedBytes: 0,
            totalBytes: 0
          };
        }
      });

      setRuntimeStates((prev) => ({ ...initialRuntimeStates, ...prev }));

      // Set default active model to the best pick if not already selected
      setActiveModelId((curr) => {
        if (!curr && recs.length > 0) {
          const bestPick = recs.find((r) => r.isBestPick) || recs[0];
          setSettings((s) => ({
            ...s,
            systemPrompt: bestPick.model.systemPromptDefault
          }));
          return bestPick.model.id;
        }
        return curr;
      });
    } catch (err) {
      console.error('Failed scanning device specs:', err);
    } finally {
      setIsScanning(false);
    }
  }, []); // Run only on initial mount or manual rescan

  useEffect(() => {
    performHardwareScan();
  }, [performHardwareScan]);

  const activeModel = AVAILABLE_MODELS.find((m) => m.id === activeModelId) || null;
  const installedModels = AVAILABLE_MODELS.filter(
    (m) => runtimeStates[m.id]?.status === 'ready' || runtimeStates[m.id]?.status === 'active'
  );

  /**
   * Handle model installation / download
   */
  const handleInstallModel = async (modelId: string) => {
    const targetModel = AVAILABLE_MODELS.find((m) => m.id === modelId);
    const modelDisplayName = targetModel?.name || 'Model';
    const totalEstimatedBytes = (targetModel?.downloadSizeMB || 100) * 1024 * 1024;

    setRuntimeStates((prev) => ({
      ...prev,
      [modelId]: {
        status: 'downloading',
        progress: 5,
        statusMessage: `Downloading ${modelDisplayName}...`,
        activeFile: 'Connecting to Hugging Face...',
        downloadedBytes: 0,
        totalBytes: totalEstimatedBytes,
        error: null
      }
    }));

    const result = await installOrLoadModel(modelId, settings.preferWebGpu, (progressInfo) => {
      setRuntimeStates((prev) => {
        const current = prev[modelId] || {
          status: 'downloading',
          progress: 5,
          statusMessage: `Downloading ${modelDisplayName}...`,
          downloadedBytes: 0,
          totalBytes: totalEstimatedBytes
        };

        const incomingProgress = typeof progressInfo.progress === 'number' ? progressInfo.progress : (current.progress || 5);
        // Strictly monotonic progression: NEVER jitter backwards
        const newProgress = Math.max(current.progress || 0, incomingProgress);
        const newMsg = progressInfo.stage || progressInfo.status || `Downloading ${modelDisplayName}...`;
        const newLoaded = Math.max(current.downloadedBytes || 0, progressInfo.loaded || 0);
        const newTotal = Math.max(current.totalBytes || totalEstimatedBytes, progressInfo.total || totalEstimatedBytes);

        // Skip unnecessary re-renders if values haven't visually advanced
        if (
          current.progress === newProgress &&
          current.statusMessage === newMsg &&
          current.downloadedBytes === newLoaded
        ) {
          return prev;
        }

        return {
          ...prev,
          [modelId]: {
            ...current,
            status: 'downloading',
            progress: newProgress,
            activeFile: progressInfo.stage || current.activeFile,
            statusMessage: newMsg,
            downloadedBytes: newLoaded,
            totalBytes: newTotal
          }
        };
      });
    });

    if (result.success) {
      setRuntimeStates((prev) => ({
        ...prev,
        [modelId]: {
          status: 'ready',
          progress: 100,
          statusMessage: 'Ready in browser cache',
          downloadedBytes: totalEstimatedBytes,
          totalBytes: totalEstimatedBytes,
          error: null
        }
      }));
      setActiveModelId(modelId);
      if (targetModel) {
        setSettings((prev) => ({
          ...prev,
          systemPrompt: targetModel.systemPromptDefault
        }));
      }
      setToastNotice(`"${modelDisplayName}" installed. Ready to chat.`);
      setTimeout(() => setToastNotice(null), 3000);
    } else {
      setRuntimeStates((prev) => ({
        ...prev,
        [modelId]: {
          status: 'error',
          progress: 0,
          statusMessage: 'Download failed',
          downloadedBytes: 0,
          totalBytes: 0,
          error: result.error || 'Failed to download model'
        }
      }));
    }
  };

  /**
   * Cancel ongoing download
   */
  const handleCancelInstall = (modelId: string) => {
    abortOperation();
    setRuntimeStates((prev) => ({
      ...prev,
      [modelId]: {
        status: 'not_installed',
        progress: 0,
        statusMessage: 'Cancelled',
        downloadedBytes: 0,
        totalBytes: 0,
        error: null
      }
    }));
  };

  /**
   * Uninstall model and clean cache
   */
  const handleUninstallModel = async (modelId: string) => {
    if (activeModelId === modelId) {
      await unloadActiveModel();
    }
    await uninstallModel(modelId);
    setRuntimeStates((prev) => ({
      ...prev,
      [modelId]: {
        status: 'not_installed',
        progress: 0,
        statusMessage: '',
        downloadedBytes: 0,
        totalBytes: 0,
        error: null
      }
    }));
    setToastNotice('Removed from browser cache.');
    setTimeout(() => setToastNotice(null), 2500);
  };

  /**
   * Launch Chat with model
   */
  const handleLaunchChat = async (modelId: string) => {
    const targetModel = AVAILABLE_MODELS.find((m) => m.id === modelId);

    if (!isModelLoaded(modelId)) {
      setToastNotice(`Loading "${targetModel?.name || 'Model'}"...`);
      const loadResult = await installOrLoadModel(modelId, settings.preferWebGpu);
      if (!loadResult.success) {
        setToastNotice(`Load error: ${loadResult.error}`);
        return;
      }
      setToastNotice(`Loaded via ${loadResult.backend.toUpperCase()}`);
      setTimeout(() => setToastNotice(null), 2500);
    }

    setActiveModelId(modelId);
    if (targetModel) {
      setSettings((prev) => ({
        ...prev,
        systemPrompt: targetModel.systemPromptDefault
      }));
    }

    setActiveTab('chat');
  };

  /**
   * Send chat message and stream response from local model
   */
  const handleSendMessage = async (text: string) => {
    if (!activeModelId || isGenerating) return;

    if (!isModelLoaded(activeModelId)) {
      setToastNotice(`Preparing ${activeModel?.name || 'model'}...`);
      const res = await installOrLoadModel(activeModelId, settings.preferWebGpu);
      if (!res.success) {
        setToastNotice(`Init error: ${res.error}`);
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      modelId: activeModelId
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsGenerating(true);
    setStreamingContent('');
    setStreamingMetrics({});
    setLiveTelemetry([]);

    const conversation = newMessages.map((m) => ({
      role: m.role,
      content: m.content
    }));

    try {
      let finalMetrics = streamingMetrics;
      let collectedTelemetry: TelemetryPoint[] = [];

      const generatedText = await streamChatCompletion(
        conversation,
        settings,
        (_token, metrics, fullText, point) => {
          if (fullText !== undefined) {
            setStreamingContent(fullText);
          } else {
            setStreamingContent((prev) => prev + _token);
          }
          if (point) {
            collectedTelemetry.push(point);
            setLiveTelemetry((prev) => [...prev, point]);
          }
          if (metrics) {
            finalMetrics = { ...finalMetrics, ...metrics };
            setStreamingMetrics(metrics);
          }
        },
        (completedMetrics) => {
          finalMetrics = completedMetrics;
          setStreamingMetrics(completedMetrics);
          if (completedMetrics.telemetry && completedMetrics.telemetry.length > 0) {
            collectedTelemetry = completedMetrics.telemetry;
            setLiveTelemetry(completedMetrics.telemetry);
          }
        }
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: generatedText,
        timestamp: Date.now(),
        modelId: activeModelId,
        metrics: {
          ...finalMetrics,
          telemetry: finalMetrics.telemetry || collectedTelemetry
        }
      };

      setMessages([...newMessages, assistantMessage]);
    } catch (err: any) {
      console.error('Inference error:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error during local inference: ${err?.message || 'ONNX execution failure'}.`,
        timestamp: Date.now(),
        modelId: activeModelId
      };
      setMessages([...newMessages, errorMessage]);
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
    }
  };

  const handleStopGeneration = () => {
    abortOperation();
    setIsGenerating(false);
  };

  const handleClearChat = () => {
    setMessages([]);
    setStreamingContent('');
    setLiveTelemetry([]);
    setStreamingMetrics({});
  };

  return (
    <div className="min-h-[100dvh] ambient-bg text-black flex flex-col font-sans antialiased selection:bg-black selection:text-white relative">
      {/* Ambient background blur elements */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-black/[0.025] to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-20 right-10 w-80 h-80 bg-black/[0.015] rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Floating Status Toast */}
      {toastNotice && (
        <div className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 liquid-glass-dock rounded-full px-4 py-2 sm:py-1.5 text-xs font-medium text-black shadow-lg flex items-center gap-2 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping shrink-0" />
          <span className="truncate">{toastNotice}</span>
        </div>
      )}

      {/* Main View Area */}
      {activeTab === 'chat' ? (
        /* Full Page Chat Interface */
        <div className="h-[100dvh] w-full flex flex-col overflow-hidden">
          <ChatInterface
            activeModel={activeModel}
            installedModels={installedModels}
            messages={messages}
            isGenerating={isGenerating}
            streamingContent={streamingContent}
            streamingMetrics={streamingMetrics}
            liveTelemetry={liveTelemetry}
            settings={settings}
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            onClearChat={handleClearChat}
            onSwitchModel={handleLaunchChat}
            onOpenSettings={() => setActiveTab('settings')}
            onNavigateToModels={() => setActiveTab('models')}
          />
        </div>
      ) : (
        /* Content for Models, Hardware, and Settings tabs */
        <div className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 pb-28 sm:pb-24">
          {/* Subtle Minimal Top Bar */}
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 pb-4 sm:pb-5 mb-5 sm:mb-6 border-b border-black/[0.06]">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 rounded-2xl bg-black text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-black flex items-center gap-2">
                  Local Model Advisor
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-black/10 text-zinc-600 bg-white/60">
                    ONNX Web
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">
                  {installedModels.length} of {AVAILABLE_MODELS.length} models installed
                </p>
              </div>
            </div>

            {installedModels.length > 0 && (
              <button
                onClick={() => setActiveTab('chat')}
                className="self-start xs:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-xs min-h-[36px]"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Chat</span>
              </button>
            )}
          </div>

          {activeTab === 'models' && (
            <div className="space-y-6">
              <ModelCatalog
                recommendations={recommendations}
                runtimeStates={runtimeStates}
                activeModelId={activeModelId}
                onInstall={handleInstallModel}
                onCancelInstall={handleCancelInstall}
                onUninstall={handleUninstallModel}
                onLaunchChat={handleLaunchChat}
              />
            </div>
          )}

          {activeTab === 'hardware' && (
            <div className="space-y-6">
              <DeviceSpecsCard
                specs={specs}
                isLoading={isScanning}
                onRescan={performHardwareScan}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="liquid-glass-card rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                  <div>
                    <h2 className="text-base font-bold text-black tracking-tight">
                      Inference Settings
                    </h2>
                    <p className="text-xs text-zinc-500">
                      WebLLM WebGPU & ONNX decoding parameters
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSettings({
                        temperature: 0.7,
                        maxTokens: 256,
                        topP: 0.9,
                        systemPrompt: activeModel?.systemPromptDefault || 'You are a helpful assistant.',
                        preferWebGpu: false
                      });
                      setSavedNotice(true);
                      setTimeout(() => setSavedNotice(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-black font-medium transition-colors p-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Temperature */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-black">Temperature</span>
                      <span className="font-mono text-zinc-500">{settings.temperature.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={settings.temperature}
                      onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-black cursor-pointer h-2"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                      <span>Focused (0.0)</span>
                      <span>Creative (1.5)</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-black">Max Tokens</span>
                      <span className="font-mono text-zinc-500">{settings.maxTokens}</span>
                    </div>
                    <input
                      type="range"
                      min={64}
                      max={1024}
                      step={32}
                      value={settings.maxTokens}
                      onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value, 10) })}
                      className="w-full accent-black cursor-pointer h-2"
                    />
                  </div>

                  {/* Prefer WebGPU */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/60 border border-black/[0.06]">
                    <div>
                      <p className="font-semibold text-black">WebGPU Hardware Acceleration</p>
                      <p className="text-[11px] text-zinc-400">Uses GPU shader execution with WASM fallback</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.preferWebGpu}
                      onChange={(e) => setSettings({ ...settings, preferWebGpu: e.target.checked })}
                      className="w-5 h-5 accent-black cursor-pointer rounded shrink-0"
                    />
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-black">System Instructions</span>
                    <textarea
                      rows={3}
                      value={settings.systemPrompt}
                      onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                      className="w-full p-3 rounded-2xl border border-black/10 bg-white/70 text-xs text-black focus:outline-none focus:border-black font-mono leading-relaxed resize-none"
                    />
                  </div>
                </div>

                {savedNotice && (
                  <div className="p-2 rounded-xl bg-black text-white text-xs flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Settings reset to defaults</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Liquid Glass Bottom Navigation Dock - Icons Only */}
      <nav
        id="bottom-nav-dock"
        aria-label="Main Navigation"
        className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-5 left-1/2 -translate-x-1/2 z-50 liquid-glass-dock rounded-full p-1.5 flex items-center justify-center gap-1 sm:gap-2 border border-black/[0.08] shadow-lg backdrop-blur-xl"
      >
        {/* Models Tab */}
        <button
          id="nav-models"
          onClick={() => setActiveTab('models')}
          title="Explore Models"
          aria-label="Models"
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            activeTab === 'models'
              ? 'bg-black text-white shadow-xs scale-105'
              : 'text-zinc-600 hover:text-black hover:bg-black/5'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
        </button>

        {/* Chat Tab */}
        <button
          id="nav-chat"
          onClick={() => setActiveTab('chat')}
          title="Local AI Chat"
          aria-label="Chat"
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all relative ${
            activeTab === 'chat'
              ? 'bg-black text-white shadow-xs scale-105'
              : 'text-zinc-600 hover:text-black hover:bg-black/5'
          }`}
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          {installedModels.length > 0 && (
            <span
              className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full ring-1 ${
                activeTab === 'chat' ? 'bg-white ring-black' : 'bg-black ring-white'
              }`}
            />
          )}
        </button>

        {/* Hardware Specs Tab */}
        <button
          id="nav-hardware"
          onClick={() => setActiveTab('hardware')}
          title="Hardware Diagnostics & Benchmarks"
          aria-label="Hardware Diagnostics"
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            activeTab === 'hardware'
              ? 'bg-black text-white shadow-xs scale-105'
              : 'text-zinc-600 hover:text-black hover:bg-black/5'
          }`}
        >
          <Cpu className="w-4 h-4 shrink-0" />
        </button>

        {/* Settings Tab */}
        <button
          id="nav-settings"
          onClick={() => setActiveTab('settings')}
          title="Inference Settings"
          aria-label="Inference Settings"
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
            activeTab === 'settings'
              ? 'bg-black text-white shadow-xs scale-105'
              : 'text-zinc-600 hover:text-black hover:bg-black/5'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
        </button>
      </nav>
    </div>
  );
}
