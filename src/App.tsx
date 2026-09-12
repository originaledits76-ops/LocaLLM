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
  Check,
  Home,
  Layers,
  Bot
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
import { getInstalledModelRecordsAsync, uninstallModel } from './services/cacheManager';
import {
  idbGetAllMessages,
  idbSaveMessage,
  idbClearAllMessages,
  idbGetSettings,
  idbSaveSettings,
  idbGetCachedSpecs,
  idbSaveCachedSpecs
} from './services/db';
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
import { HomeView } from './components/HomeView';

type AppTab = 'home' | 'chat' | 'models' | 'hardware' | 'settings';

export default function App() {
  // Device Specs State
  const [specs, setSpecs] = useState<DeviceSpecs | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);

  // Navigation State: bottom nav with 'home' | 'chat' | 'models' | 'hardware' | 'settings'
  const [activeTab, setActiveTab] = useState<AppTab>('home');

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
    maxTokens: 2048,
    topP: 0.9,
    topK: 40,
    fastMode: true,
    systemPrompt: 'You are a helpful and concise AI assistant running locally on-device in the browser.',
    preferWebGpu: true
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
      await idbSaveCachedSpecs(detected);

      // Auto-enable WebGPU when hardware support is detected on device
      if (detected.webGpuAvailable) {
        setSettings((s) => {
          const updated = { ...s, preferWebGpu: true };
          idbSaveSettings(updated);
          return updated;
        });
      }

      const recs = evaluateModelRecommendations(detected, AVAILABLE_MODELS);
      setRecommendations(recs);

      // Check previously installed models in IndexedDB & local storage cache
      const cachedRecords = await getInstalledModelRecordsAsync();
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
          setSettings((s) => {
            const updated = {
              ...s,
              systemPrompt: bestPick.model.systemPromptDefault
            };
            idbSaveSettings(updated);
            return updated;
          });
          return bestPick.model.id;
        }
        return curr;
      });
    } catch (err) {
      console.error('Failed scanning device specs:', err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Initial load from IndexedDB
  useEffect(() => {
    async function loadIndexedDbState() {
      // 1. Restore messages
      const savedMsgs = await idbGetAllMessages();
      if (savedMsgs && savedMsgs.length > 0) {
        setMessages(savedMsgs);
      }

      // 2. Restore settings
      const savedSet = await idbGetSettings();
      if (savedSet) {
        setSettings(savedSet);
      }

      // 3. Restore cached specs if available
      const cachedSpecs = await idbGetCachedSpecs();
      if (cachedSpecs) {
        setSpecs(cachedSpecs);
        setRecommendations(evaluateModelRecommendations(cachedSpecs, AVAILABLE_MODELS));
        setIsScanning(false);
      } else {
        performHardwareScan();
      }
    }
    loadIndexedDbState();
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
    await idbSaveMessage(userMessage);

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
      await idbSaveMessage(assistantMessage);
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
      await idbSaveMessage(errorMessage);
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
    }
  };

  const handleStopGeneration = () => {
    abortOperation();
    setIsGenerating(false);
  };

  const handleClearChat = async () => {
    setMessages([]);
    setStreamingContent('');
    setLiveTelemetry([]);
    setStreamingMetrics({});
    await idbClearAllMessages();
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col aidora-bg text-zinc-900 font-sans selection:bg-[#c7f43a] selection:text-black relative">
      {/* Top Aidora Sub-Header for Non-Chat Views */}
      {activeTab !== 'chat' && activeTab !== 'home' && (
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-zinc-200/50 px-4 sm:px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('home')}>
              <div className="w-9 h-9 rounded-full bg-[#18181b] text-[#c7f43a] flex items-center justify-center font-bold text-xs shadow-2xs">
                <Bot className="w-5 h-5" />
              </div>
              <span className="font-display font-extrabold text-lg text-zinc-900 tracking-tight">
                Aidora
              </span>
            </div>

            {activeModel && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-zinc-200/80 text-xs font-semibold text-zinc-800 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[160px]">{activeModel.name}</span>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Floating Status Toast */}
      {toastNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#18181b] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-top-2 duration-150 border border-zinc-700">
          <span className="w-2 h-2 rounded-full bg-[#c7f43a] animate-ping shrink-0" />
          <span className="truncate">{toastNotice}</span>
        </div>
      )}

      {/* Main View Area */}
      {activeTab === 'home' ? (
        <HomeView
          activeModel={activeModel}
          installedModels={installedModels}
          onStartNewChat={(prompt) => {
            if (prompt) {
              handleSendMessage(prompt);
            }
            setActiveTab('chat');
          }}
          onNavigateToModels={() => setActiveTab('models')}
          onNavigateToHardware={() => setActiveTab('hardware')}
        />
      ) : activeTab === 'chat' ? (
        /* Full View Chat Interface */
        <div className="flex-1 w-full flex flex-col overflow-hidden h-[calc(100dvh)]">
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
        <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
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
              <div className="aidora-card-white p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                  <div>
                    <h2 className="text-lg font-extrabold text-zinc-900 tracking-tight font-display">
                      INFERENCE CONFIGURATION
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium">
                      Parameters &amp; Hardware Acceleration
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newSet: InferenceSettings = {
                        temperature: 0.6,
                        maxTokens: 2048,
                        topP: 0.9,
                        topK: 40,
                        fastMode: true,
                        systemPrompt: activeModel?.systemPromptDefault || 'You are a helpful and concise AI assistant running locally on-device in the browser.',
                        preferWebGpu: specs?.webGpuAvailable ?? true
                      };
                      setSettings(newSet);
                      idbSaveSettings(newSet);
                      setSavedNotice(true);
                      setTimeout(() => setSavedNotice(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-zinc-800 font-bold px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-5 text-xs">
                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-zinc-800 uppercase tracking-wider">Temperature</span>
                      <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">{settings.temperature.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={settings.temperature}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSettings((s) => {
                          const updated = { ...s, temperature: val };
                          idbSaveSettings(updated);
                          return updated;
                        });
                      }}
                      className="w-full accent-[#18181b] cursor-pointer h-2"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-400 font-mono font-semibold">
                      <span>Focused (0.0)</span>
                      <span>Creative (1.5)</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-zinc-800 uppercase tracking-wider">Max Output Tokens</span>
                      <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">{settings.maxTokens}</span>
                    </div>
                    <input
                      type="range"
                      min={64}
                      max={2048}
                      step={32}
                      value={settings.maxTokens}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setSettings((s) => {
                          const updated = { ...s, maxTokens: val };
                          idbSaveSettings(updated);
                          return updated;
                        });
                      }}
                      className="w-full accent-[#18181b] cursor-pointer h-2"
                    />
                  </div>

                  {/* Prefer WebGPU */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#edf9d5] border border-black/10">
                    <div>
                      <p className="font-bold text-zinc-900 uppercase tracking-wider text-xs">Hardware GPU Acceleration</p>
                      <p className="text-[11px] text-zinc-600 font-medium font-sans">Uses GPU shaders for fast local token streaming</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.preferWebGpu}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setSettings((s) => {
                          const updated = { ...s, preferWebGpu: val };
                          idbSaveSettings(updated);
                          return updated;
                        });
                      }}
                      className="w-5 h-5 accent-[#18181b] cursor-pointer rounded shrink-0"
                    />
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-2">
                    <span className="font-bold text-zinc-800 uppercase tracking-wider block">System Instructions</span>
                    <textarea
                      rows={3}
                      value={settings.systemPrompt}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings((s) => {
                          const updated = { ...s, systemPrompt: val };
                          idbSaveSettings(updated);
                          return updated;
                        });
                      }}
                      className="w-full p-3 rounded-2xl border border-zinc-200 bg-white text-xs text-zinc-900 focus:outline-none font-mono leading-relaxed resize-none shadow-2xs"
                    />
                  </div>
                </div>

                {savedNotice && (
                  <div className="p-3 rounded-2xl bg-[#c7f43a] text-zinc-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs">
                    <Check className="w-4 h-4" />
                    <span>Settings reset to defaults!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aidora Floating Bottom Navigation Dock (Exact Match to Aidora Mockup Dock) */}
      {activeTab !== 'chat' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
          <nav className="aidora-nav-dock px-3 py-2 flex items-center gap-2 shadow-xl">
            {/* Home Tab */}
            <button
              onClick={() => setActiveTab('home')}
              className={`p-2.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-[#18181b] text-white shadow-xs scale-105'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Home"
            >
              <Home className="w-5 h-5" />
            </button>

            {/* Chat Tab */}
            <button
              onClick={() => setActiveTab('chat')}
              className="p-2.5 rounded-full transition-all cursor-pointer relative text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              title="Chat AI"
            >
              <MessageSquare className="w-5 h-5" />
              {installedModels.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#c7f43a] ring-2 ring-white" />
              )}
            </button>

            {/* Models Catalog Tab */}
            <button
              onClick={() => setActiveTab('models')}
              className={`p-2.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'models'
                  ? 'bg-[#18181b] text-white shadow-xs scale-105'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Models Hub"
            >
              <Layers className="w-5 h-5" />
            </button>

            {/* Hardware Tab */}
            <button
              onClick={() => setActiveTab('hardware')}
              className={`p-2.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'hardware'
                  ? 'bg-[#18181b] text-white shadow-xs scale-105'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Hardware Diagnostics"
            >
              <Cpu className="w-5 h-5" />
            </button>

            {/* Settings Tab */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`p-2.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#18181b] text-white shadow-xs scale-105'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Settings"
            >
              <Sliders className="w-5 h-5" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
