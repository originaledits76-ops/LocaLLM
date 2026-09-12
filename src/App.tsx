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
    <div className="min-h-[100dvh] brutalist-bg text-black flex flex-col font-sans antialiased selection:bg-amber-300 selection:text-black relative">
      {/* Top Neubrutalist Header Navigation */}
      <header className="sticky top-0 z-40 brutalist-header px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-[0_2px_0_0_#000]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_#000] shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div className="hidden xs:block">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-black font-display uppercase">
                POCKET LOCAL AI
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-400 text-black border border-black shadow-[1px_1px_0px_0px_#000]">
                PRIVATE
              </span>
            </div>
          </div>
        </div>

        {/* Top Header Navigation Tabs */}
        <nav className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-0.5 scrollbar-none">
          <button
            id="nav-models"
            onClick={() => setActiveTab('models')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap border-2 border-black ${
              activeTab === 'models'
                ? 'bg-black text-white shadow-[2px_2px_0px_0px_#000]'
                : 'bg-white text-black hover:bg-zinc-100 shadow-[2px_2px_0px_0px_#000]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Models</span>
          </button>

          <button
            id="nav-chat"
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap border-2 border-black relative ${
              activeTab === 'chat'
                ? 'bg-black text-white shadow-[2px_2px_0px_0px_#000]'
                : 'bg-white text-black hover:bg-zinc-100 shadow-[2px_2px_0px_0px_#000]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
            {installedModels.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 border border-black" />
            )}
          </button>

          <button
            id="nav-hardware"
            onClick={() => setActiveTab('hardware')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap border-2 border-black ${
              activeTab === 'hardware'
                ? 'bg-black text-white shadow-[2px_2px_0px_0px_#000]'
                : 'bg-white text-black hover:bg-zinc-100 shadow-[2px_2px_0px_0px_#000]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hardware</span>
          </button>

          <button
            id="nav-settings"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap border-2 border-black ${
              activeTab === 'settings'
                ? 'bg-black text-white shadow-[2px_2px_0px_0px_#000]'
                : 'bg-white text-black hover:bg-zinc-100 shadow-[2px_2px_0px_0px_#000]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </nav>
      </header>

      {/* Floating Status Toast */}
      {toastNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 brutalist-card px-4 py-2 text-xs font-bold text-black shadow-[4px_4px_0px_0px_#000] flex items-center gap-2 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-emerald-400 border border-black animate-ping shrink-0" />
          <span className="truncate font-mono">{toastNotice}</span>
        </div>
      )}

      {/* Main View Area */}
      {activeTab === 'chat' ? (
        /* Full View Chat Interface - No Bottom Bar Blocking Input */
        <div className="flex-1 w-full flex flex-col overflow-hidden h-[calc(100dvh-57px)]">
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
        <div className="flex-1 w-full max-w-5xl mx-auto px-3.5 sm:px-6 py-6 pb-12">
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
              <div className="brutalist-card p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                  <div>
                    <h2 className="text-lg font-black text-black tracking-tight font-display">
                      INFERENCE CONFIGURATION
                    </h2>
                    <p className="text-xs text-zinc-600 font-medium">
                      Configure parameters and hardware acceleration
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
                    className="inline-flex items-center gap-1 text-xs text-black font-bold brutalist-pill px-2.5 py-1 bg-amber-300 hover:bg-amber-400"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="space-y-5 text-xs">
                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-black uppercase tracking-wider">Temperature</span>
                      <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded border border-black">{settings.temperature.toFixed(2)}</span>
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
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono font-semibold">
                      <span>Focused (0.0)</span>
                      <span>Creative (1.5)</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-black uppercase tracking-wider">Max Output Tokens</span>
                      <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded border border-black">{settings.maxTokens}</span>
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
                  <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-100/60 border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                    <div>
                      <p className="font-bold text-black uppercase tracking-wider text-xs">Hardware GPU Acceleration</p>
                      <p className="text-[11px] text-zinc-700 font-medium">Uses GPU hardware acceleration when supported</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.preferWebGpu}
                      onChange={(e) => setSettings({ ...settings, preferWebGpu: e.target.checked })}
                      className="w-5 h-5 accent-black cursor-pointer rounded shrink-0 border-2 border-black"
                    />
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-2">
                    <span className="font-bold text-black uppercase tracking-wider block">System Instructions</span>
                    <textarea
                      rows={3}
                      value={settings.systemPrompt}
                      onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                      className="w-full p-3 rounded-xl border-2 border-black bg-white text-xs text-black focus:outline-none font-mono leading-relaxed resize-none shadow-[3px_3px_0px_0px_#000]"
                    />
                  </div>
                </div>

                {savedNotice && (
                  <div className="p-3 rounded-xl bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                    <Check className="w-4 h-4" />
                    <span>Settings reset to defaults!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
