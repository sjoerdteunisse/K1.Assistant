import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  RefreshCw,
  Download,
  Mic,
  Shield,
  FolderOpen,
  LogOut,
  UserCircle,
  Sun,
  Moon,
  Monitor,
  Cloud,
  Key,
  Cpu,
  Network,
  Sparkles,
  AlertTriangle,
  Loader2,
  Check,
  Mail,
  CircleCheck,
  CircleX,
  RotateCw,
  BookOpen,
  Copy,
  Trash2,
} from "lucide-react";

import MicPermissionWarning from "./ui/MicPermissionWarning";
import MicrophoneSettings from "./ui/MicrophoneSettings";
import PermissionCard from "./ui/PermissionCard";
import PasteToolsInfo from "./ui/PasteToolsInfo";
import TranscriptionModelPicker from "./TranscriptionModelPicker";
import SelfHostedPanel from "./SelfHostedPanel";
import {
  ConfirmDialog,
  AlertDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { useSettings } from "../hooks/useSettings";
import { useDialogs } from "../hooks/useDialogs";
import { useAgentName } from "../utils/agentName";
import { useWhisper } from "../hooks/useWhisper";
import { usePermissions } from "../hooks/usePermissions";
import { useSystemAudioPermission } from "../hooks/useSystemAudioPermission";
import { useClipboard } from "../hooks/useClipboard";
import { useUpdater } from "../hooks/useUpdater";

import PromptStudio from "./ui/PromptStudio";
import ReasoningModelSelector from "./ReasoningModelSelector";
import { HotkeyInput } from "./ui/HotkeyInput";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { validateHotkeyForSlot } from "../utils/hotkeyValidation";
import { getPlatform, getCachedPlatform } from "../utils/platform";
import { formatHotkeyLabel } from "../utils/hotkeys";
import { ActivationModeSelector } from "./ui/ActivationModeSelector";
import { Toggle } from "./ui/toggle";
import DeveloperSection from "./DeveloperSection";
import AgentModeSettings from "./settings/AgentModeSettings";
import LanguageSelector from "./ui/LanguageSelector";
import { Skeleton } from "./ui/skeleton";
import { Progress } from "./ui/progress";
import { useToast } from "./ui/useToast";
import { useTheme } from "../hooks/useTheme";
import type { GpuDevice, LocalTranscriptionProvider, InferenceMode } from "../types/electron";
import logger from "../utils/logger";
import { SettingsRow, InferenceModeSelector } from "./ui/SettingsSection";
import type { InferenceModeOption } from "./ui/SettingsSection";
import { useSettingsLayout } from "./ui/useSettingsLayout";
import { cn } from "./lib/utils";
import { formatBytes } from "../utils/formatBytes";
import { useSettingsStore } from "../stores/settingsStore";
import { canManageSystemAudioInApp } from "../utils/systemAudioAccess";

const formatAmount = (cents: number, currency: string) =>
  (cents / 100).toLocaleString(undefined, { style: "currency", currency });

export type SettingsSectionType =
  | "general"
  | "hotkeys"
  | "transcription"
  | "intelligence"
  | "privacyData"
  | "system"
  | "aiModels"
  | "agentConfig"
  | "prompts"
  | "agentMode";

interface SettingsPageProps {
  activeSection?: SettingsSectionType;
}

const UI_LANGUAGE_OPTIONS: import("./ui/LanguageSelector").LanguageOption[] = [
  { value: "en", label: "English", flag: "ðŸ‡ºðŸ‡¸" },
  { value: "es", label: "EspaÃ±ol", flag: "ðŸ‡ªðŸ‡¸" },
  { value: "fr", label: "FranÃ§ais", flag: "ðŸ‡«ðŸ‡·" },
  { value: "de", label: "Deutsch", flag: "ðŸ‡©ðŸ‡ª" },
  { value: "pt", label: "PortuguÃªs", flag: "ðŸ‡µðŸ‡¹" },
  { value: "it", label: "Italiano", flag: "ðŸ‡®ðŸ‡¹" },
  { value: "ru", label: "Ð ÑƒÑÑÐºÐ¸Ð¹", flag: "ðŸ‡·ðŸ‡º" },
  { value: "ja", label: "æ—¥æœ¬èªž", flag: "ðŸ‡¯ðŸ‡µ" },
  { value: "zh-CN", label: "ç®€ä½“ä¸­æ–‡", flag: "ðŸ‡¨ðŸ‡³" },
  { value: "zh-TW", label: "ç¹é«”ä¸­æ–‡", flag: "ðŸ‡¹ðŸ‡¼" },
];

const noop = () => {};

function SettingsPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border/50 dark:border-border-subtle/70 bg-card/50 dark:bg-surface-2/50 backdrop-blur-sm divide-y divide-border/30 dark:divide-border-subtle/50 ${className}`}
    >
      {children}
    </div>
  );
}

function SettingsPanelRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isCompact } = useSettingsLayout();

  return (
    <div className={`${isCompact ? "px-3 py-2.5" : "px-4 py-3"} ${className}`}>{children}</div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground/80 mt-0.5 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

interface TranscriptionSectionProps {
  cloudTranscriptionMode: string;
  setCloudTranscriptionMode: (mode: string) => void;
  useLocalWhisper: boolean;
  setUseLocalWhisper: (value: boolean) => void;
  updateTranscriptionSettings: (settings: { useLocalWhisper: boolean }) => void;
  cloudTranscriptionProvider: string;
  setCloudTranscriptionProvider: (provider: string) => void;
  cloudTranscriptionModel: string;
  setCloudTranscriptionModel: (model: string) => void;
  localTranscriptionProvider: string;
  setLocalTranscriptionProvider: (provider: LocalTranscriptionProvider) => void;
  whisperModel: string;
  setWhisperModel: (model: string) => void;
  parakeetModel: string;
  setParakeetModel: (model: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  mistralApiKey: string;
  setMistralApiKey: (key: string) => void;
  customTranscriptionApiKey: string;
  setCustomTranscriptionApiKey: (key: string) => void;
  cloudTranscriptionBaseUrl?: string;
  setCloudTranscriptionBaseUrl: (url: string) => void;
  transcriptionMode: InferenceMode;
  setTranscriptionMode: (mode: InferenceMode) => void;
  remoteTranscriptionUrl: string;
  setRemoteTranscriptionUrl: (url: string) => void;
  toast: (opts: {
    title: string;
    description: string;
    variant?: "default" | "destructive" | "success";
    duration?: number;
  }) => void;
}

function TranscriptionSection({
  cloudTranscriptionMode,
  setCloudTranscriptionMode,
  useLocalWhisper,
  setUseLocalWhisper,
  updateTranscriptionSettings,
  cloudTranscriptionProvider,
  setCloudTranscriptionProvider,
  cloudTranscriptionModel,
  setCloudTranscriptionModel,
  localTranscriptionProvider,
  setLocalTranscriptionProvider,
  whisperModel,
  setWhisperModel,
  parakeetModel,
  setParakeetModel,
  openaiApiKey,
  setOpenaiApiKey,
  groqApiKey,
  setGroqApiKey,
  mistralApiKey,
  setMistralApiKey,
  customTranscriptionApiKey,
  setCustomTranscriptionApiKey,
  cloudTranscriptionBaseUrl,
  setCloudTranscriptionBaseUrl,
  transcriptionMode,
  setTranscriptionMode,
  remoteTranscriptionUrl,
  setRemoteTranscriptionUrl,
  toast,
}: TranscriptionSectionProps) {
  const { t } = useTranslation();

  const transcriptionModes: InferenceModeOption[] = [
    {
      id: "openwhispr",
      label: t("settingsPage.transcription.modes.openwhispr"),
      description: t("settingsPage.transcription.modes.openwhisprDesc"),
      icon: <Cloud className="w-4 h-4" />,
    },
    {
      id: "providers",
      label: t("settingsPage.transcription.modes.providers"),
      description: t("settingsPage.transcription.modes.providersDesc"),
      icon: <Key className="w-4 h-4" />,
    },
    {
      id: "local",
      label: t("settingsPage.transcription.modes.local"),
      description: t("settingsPage.transcription.modes.localDesc"),
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      id: "self-hosted",
      label: t("settingsPage.transcription.modes.selfHosted"),
      description: t("settingsPage.transcription.modes.selfHostedDesc"),
      icon: <Network className="w-4 h-4" />,
    },
  ];

  const handleTranscriptionModeSelect = (mode: InferenceMode) => {
    if (mode === transcriptionMode) return;
    setTranscriptionMode(mode);
    setUseLocalWhisper(mode === "local");
    updateTranscriptionSettings({ useLocalWhisper: mode === "local" });
    setCloudTranscriptionMode(mode === "openwhispr" ? "openwhispr" : "byok");

    const toastKey = {
      openwhispr: "switchedCloud",
      providers: "switchedProviders",
      local: "switchedLocal",
      "self-hosted": "switchedSelfHosted",
    }[mode];
    toast({
      title: t(`settingsPage.transcription.toasts.${toastKey}.title`),
      description: t(`settingsPage.transcription.toasts.${toastKey}.description`),
      variant: "success",
      duration: 3000,
    });
  };

  const handleLocalModelSelect = useCallback(
    (modelId: string) => {
      if (localTranscriptionProvider === "nvidia") {
        setParakeetModel(modelId);
      } else {
        setWhisperModel(modelId);
      }
    },
    [localTranscriptionProvider, setParakeetModel, setWhisperModel]
  );

  const renderTranscriptionPicker = (mode?: "cloud" | "local") => (
    <TranscriptionModelPicker
      selectedCloudProvider={cloudTranscriptionProvider}
      onCloudProviderSelect={setCloudTranscriptionProvider}
      selectedCloudModel={cloudTranscriptionModel}
      onCloudModelSelect={setCloudTranscriptionModel}
      selectedLocalModel={localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel}
      onLocalModelSelect={handleLocalModelSelect}
      selectedLocalProvider={localTranscriptionProvider}
      onLocalProviderSelect={setLocalTranscriptionProvider}
      useLocalWhisper={mode === "local" || (!mode && useLocalWhisper)}
      onModeChange={
        mode
          ? noop
          : (isLocal) => {
              setUseLocalWhisper(isLocal);
              updateTranscriptionSettings({ useLocalWhisper: isLocal });
              if (isLocal) setCloudTranscriptionMode("byok");
            }
      }
      mode={mode}
      openaiApiKey={openaiApiKey}
      setOpenaiApiKey={setOpenaiApiKey}
      groqApiKey={groqApiKey}
      setGroqApiKey={setGroqApiKey}
      mistralApiKey={mistralApiKey}
      setMistralApiKey={setMistralApiKey}
      customTranscriptionApiKey={customTranscriptionApiKey}
      setCustomTranscriptionApiKey={setCustomTranscriptionApiKey}
      cloudTranscriptionBaseUrl={cloudTranscriptionBaseUrl}
      setCloudTranscriptionBaseUrl={setCloudTranscriptionBaseUrl}
      variant="settings"
    />
  );

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("settingsPage.transcription.title")}
        description={t("settingsPage.transcription.description")}
      />

      {renderTranscriptionPicker("local")}

      <GpuDeviceSelector purpose="transcription" />
    </div>
  );
}

interface AiModelsSectionProps {
  cloudReasoningMode: string;
  setCloudReasoningMode: (mode: string) => void;
  useReasoningModel: boolean;
  setUseReasoningModel: (value: boolean) => void;
  reasoningModel: string;
  setReasoningModel: (model: string) => void;
  reasoningProvider: string;
  setReasoningProvider: (provider: string) => void;
  cloudReasoningBaseUrl: string;
  setCloudReasoningBaseUrl: (url: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  anthropicApiKey: string;
  setAnthropicApiKey: (key: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  customReasoningApiKey: string;
  setCustomReasoningApiKey: (key: string) => void;
  reasoningMode: InferenceMode;
  setReasoningMode: (mode: InferenceMode) => void;
  remoteReasoningUrl: string;
  setRemoteReasoningUrl: (url: string) => void;
  toast: (opts: {
    title: string;
    description: string;
    variant?: "default" | "destructive" | "success";
    duration?: number;
  }) => void;
}

function AiModelsSection({
  cloudReasoningMode,
  setCloudReasoningMode,
  useReasoningModel,
  setUseReasoningModel,
  reasoningModel,
  setReasoningModel,
  reasoningProvider,
  setReasoningProvider,
  cloudReasoningBaseUrl,
  setCloudReasoningBaseUrl,
  openaiApiKey,
  setOpenaiApiKey,
  anthropicApiKey,
  setAnthropicApiKey,
  geminiApiKey,
  setGeminiApiKey,
  groqApiKey,
  setGroqApiKey,
  customReasoningApiKey,
  setCustomReasoningApiKey,
  reasoningMode,
  setReasoningMode,
  remoteReasoningUrl,
  setRemoteReasoningUrl,
  toast,
}: AiModelsSectionProps) {
  const { t } = useTranslation();

  const aiModes: InferenceModeOption[] = [
    {
      id: "openwhispr",
      label: t("settingsPage.aiModels.modes.openwhispr"),
      description: t("settingsPage.aiModels.modes.openwhisprDesc"),
      icon: <Cloud className="w-4 h-4" />,
    },
    {
      id: "providers",
      label: t("settingsPage.aiModels.modes.providers"),
      description: t("settingsPage.aiModels.modes.providersDesc"),
      icon: <Key className="w-4 h-4" />,
    },
    {
      id: "local",
      label: t("settingsPage.aiModels.modes.local"),
      description: t("settingsPage.aiModels.modes.localDesc"),
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      id: "self-hosted",
      label: t("settingsPage.aiModels.modes.selfHosted"),
      description: t("settingsPage.aiModels.modes.selfHostedDesc"),
      icon: <Network className="w-4 h-4" />,
    },
  ];

  const handleReasoningModeSelect = (mode: InferenceMode) => {
    if (mode === reasoningMode) return;
    setReasoningMode(mode);
    setCloudReasoningMode(mode === "openwhispr" ? "openwhispr" : "byok");
    if (mode === "openwhispr" || mode === "self-hosted") {
      window.electronAPI?.llamaServerStop?.();
    }

    const toastKey = {
      openwhispr: "switchedCloud",
      providers: "switchedProviders",
      local: "switchedLocal",
      "self-hosted": "switchedSelfHosted",
    }[mode];
    toast({
      title: t(`settingsPage.aiModels.toasts.${toastKey}.title`),
      description: t(`settingsPage.aiModels.toasts.${toastKey}.description`),
      variant: "success",
      duration: 3000,
    });
  };

  const renderReasoningSelector = (mode?: "cloud" | "local") => (
    <ReasoningModelSelector
      reasoningModel={reasoningModel}
      setReasoningModel={setReasoningModel}
      localReasoningProvider={reasoningProvider}
      setLocalReasoningProvider={setReasoningProvider}
      cloudReasoningBaseUrl={cloudReasoningBaseUrl}
      setCloudReasoningBaseUrl={setCloudReasoningBaseUrl}
      openaiApiKey={openaiApiKey}
      setOpenaiApiKey={setOpenaiApiKey}
      anthropicApiKey={anthropicApiKey}
      setAnthropicApiKey={setAnthropicApiKey}
      geminiApiKey={geminiApiKey}
      setGeminiApiKey={setGeminiApiKey}
      groqApiKey={groqApiKey}
      setGroqApiKey={setGroqApiKey}
      customReasoningApiKey={customReasoningApiKey}
      setCustomReasoningApiKey={setCustomReasoningApiKey}
      mode={mode}
    />
  );

  return (
    <div className="space-y-4">
      <SectionHeader
        title={t("settingsPage.aiModels.title")}
        description={t("settingsPage.aiModels.description")}
      />

      <SettingsPanel>
        <SettingsPanelRow>
          <SettingsRow
            label={t("settingsPage.aiModels.enableTextCleanup")}
            description={t("settingsPage.aiModels.enableTextCleanupDescription")}
          >
            <Toggle checked={useReasoningModel} onChange={setUseReasoningModel} />
          </SettingsRow>
        </SettingsPanelRow>
      </SettingsPanel>

      {useReasoningModel && (
        <>
          {renderReasoningSelector("local")}
          <GpuDeviceSelector purpose="intelligence" />
        </>
      )}
    </div>
  );
}

function GpuDeviceSelector({ purpose }: { purpose: "transcription" | "intelligence" }) {
  const { t } = useTranslation();
  const [gpus, setGpus] = useState<GpuDevice[]>([]);
  const [selectedIndex, setSelectedIndex] = useState("0");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      window.electronAPI?.listGpus?.() ?? Promise.resolve([]),
      window.electronAPI?.getGpuDeviceIndex?.(purpose) ?? Promise.resolve("0"),
    ])
      .then(([gpuList, idx]) => {
        setGpus(gpuList);
        setSelectedIndex(idx);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [purpose]);

  if (!loaded || gpus.length < 2) return null;

  return (
    <div className="border-t border-border/40 pt-4 mt-4">
      <SectionHeader
        title={t(`settingsPage.${purpose}.gpuDevice.title`)}
        description={t(`settingsPage.${purpose}.gpuDevice.description`)}
      />
      <SettingsPanel>
        <SettingsPanelRow>
          <div className="relative w-full">
            <select
              value={selectedIndex}
              onChange={async (e) => {
                const idx = e.target.value;
                setSelectedIndex(idx);
                await window.electronAPI?.setGpuDeviceIndex?.(purpose, Number(idx));
              }}
              className="w-full appearance-none rounded-md border border-border bg-background px-3 pr-10 py-2 text-sm"
            >
              {gpus.map((gpu) => (
                <option key={gpu.index} value={String(gpu.index)}>
                  GPU {gpu.index}: {gpu.name} ({Math.round(gpu.vramMb / 1024)}GB)
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </SettingsPanelRow>
      </SettingsPanel>
    </div>
  );
}

export default function SettingsPage({ activeSection = "general" }: SettingsPageProps) {
  const { isCompact } = useSettingsLayout();
  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  const {
    useLocalWhisper,
    whisperModel,
    localTranscriptionProvider,
    parakeetModel,
    uiLanguage,
    preferredLanguage,
    cloudTranscriptionProvider,
    cloudTranscriptionModel,
    cloudTranscriptionBaseUrl,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    reasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    groqApiKey,
    mistralApiKey,
    dictationKey,
    activationMode,
    setActivationMode,
    preferBuiltInMic,
    selectedMicDeviceId,
    setPreferBuiltInMic,
    setSelectedMicDeviceId,
    setUseLocalWhisper,
    setUiLanguage,
    setWhisperModel,
    setLocalTranscriptionProvider,
    setParakeetModel,
    setCloudTranscriptionProvider,
    setCloudTranscriptionModel,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setUseReasoningModel,
    setReasoningModel,
    setReasoningProvider,
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setGroqApiKey,
    setMistralApiKey,
    customTranscriptionApiKey,
    setCustomTranscriptionApiKey,
    customReasoningApiKey,
    setCustomReasoningApiKey,
    setDictationKey,
    meetingKey,
    setMeetingKey,
    autoLearnCorrections,
    setAutoLearnCorrections,
    updateTranscriptionSettings,
    updateReasoningSettings,
    cloudTranscriptionMode,
    setCloudTranscriptionMode,
    cloudReasoningMode,
    setCloudReasoningMode,
    transcriptionMode,
    setTranscriptionMode,
    remoteTranscriptionUrl,
    setRemoteTranscriptionUrl,
    reasoningMode,
    setReasoningMode,
    remoteReasoningUrl,
    setRemoteReasoningUrl,
    audioCuesEnabled,
    setAudioCuesEnabled,
    pauseMediaOnDictation,
    setPauseMediaOnDictation,
    keepTranscriptionInClipboard,
    setKeepTranscriptionInClipboard,
    floatingIconAutoHide,
    setFloatingIconAutoHide,
    startMinimized,
    setStartMinimized,
    panelStartPosition,
    setPanelStartPosition,
    telemetryEnabled,
    setTelemetryEnabled,
    audioRetentionDays,
    setAudioRetentionDays,
    dataRetentionEnabled,
    setDataRetentionEnabled,
    customDictionary,
    setCustomDictionary,
    noteFilesEnabled,
    setNoteFilesEnabled,
    noteFilesPath,
    setNoteFilesPath,
  } = useSettings();

  const agentKey = useSettingsStore((s) => s.agentKey);
  const meetingAudioDetection = useSettingsStore((s) => s.meetingAudioDetection);
  const setMeetingAudioDetection = useSettingsStore((s) => s.setMeetingAudioDetection);

  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [isRemovingModels, setIsRemovingModels] = useState(false);
  const cachePathHint =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
      ? "%USERPROFILE%\\.cache\\openwhispr"
      : "~/.cache/openwhispr";

  const {
    status: updateStatus,
    info: updateInfo,
    downloadProgress: updateDownloadProgress,
    isChecking: checkingForUpdates,
    isDownloading: downloadingUpdate,
    isInstalling: installInitiated,
    checkForUpdates,
    downloadUpdate,
    installUpdate: installUpdateAction,
    getAppVersion,
    error: updateError,
  } = useUpdater();

  const isUpdateAvailable =
    !updateStatus.isDevelopment && (updateStatus.updateAvailable || updateStatus.updateDownloaded);

  const { checkWhisperInstallation } = useWhisper();
  const permissionsHook = usePermissions(showAlertDialog);
  const systemAudio = useSystemAudioPermission();
  useClipboard(showAlertDialog);
  const { agentName, setAgentName } = useAgentName();
  const [agentNameInput, setAgentNameInput] = useState(agentName);
  const [audioStorageUsage, setAudioStorageUsage] = useState<{
    fileCount: number;
    totalBytes: number;
  }>({ fileCount: 0, totalBytes: 0 });

  useEffect(() => {
    if (activeSection !== "privacyData") return;
    window.electronAPI
      ?.getAudioStorageUsage?.()
      .then((usage: { fileCount: number; totalBytes: number }) => {
        if (usage) setAudioStorageUsage(usage);
      })
      .catch(() => {});
  }, [activeSection]);

  const handleClearAllAudio = async () => {
    if (!window.electronAPI?.deleteAllAudio) return;
    try {
      await window.electronAPI.deleteAllAudio();
      setAudioStorageUsage({ fileCount: 0, totalBytes: 0 });
      toast({ title: t("settingsPage.privacy.clearAllAudio"), variant: "default" });
    } catch {
      // silent fail
    }
  };

  // ydotool status for Wayland paste diagnostics
  const [ydotoolStatus, setYdotoolStatus] = useState<{
    isLinux: boolean;
    isWayland: boolean;
    hasYdotool: boolean;
    hasYdotoold: boolean;
    daemonRunning: boolean;
    hasService: boolean;
    hasUinput: boolean;
    hasUdevRule: boolean;
    hasGroup: boolean;
    allGood: boolean;
    isKde?: boolean;
    hasXclip?: boolean;
    hasXsel?: boolean;
  } | null>(null);
  const [ydotoolGuideKey, setYdotoolGuideKey] = useState<string | null>(null);

  const refreshYdotoolStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI?.getYdotoolStatus?.();
      if (status) setYdotoolStatus(status);
    } catch {}
  }, []);

  useEffect(() => {
    refreshYdotoolStatus();
  }, [refreshYdotoolStatus]);

  const handleSaveAgentName = useCallback(() => {
    const trimmed = agentNameInput.trim();
    const previousName = agentName;

    setAgentName(trimmed);
    setAgentNameInput(trimmed);

    let nextDictionary = customDictionary.filter((w) => w !== previousName);
    if (trimmed) {
      const hasName = nextDictionary.some((w) => w.toLowerCase() === trimmed.toLowerCase());
      if (!hasName) {
        nextDictionary = [trimmed, ...nextDictionary];
      }
    }
    setCustomDictionary(nextDictionary);

    showAlertDialog({
      title: t("settingsPage.agentConfig.dialogs.updatedTitle"),
      description: t("settingsPage.agentConfig.dialogs.updatedDescription", {
        name: trimmed,
      }),
    });
  }, [
    agentNameInput,
    agentName,
    customDictionary,
    setAgentName,
    setCustomDictionary,
    showAlertDialog,
    t,
  ]);

  const { theme, setTheme } = useTheme();

  const installTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => {
      setDictationKey(registeredHotkey);
    },
    showSuccessToast: false,
    showErrorToast: true,
    showAlert: showAlertDialog,
  });

  const meetingRegisterFn = useCallback(async (hotkey: string) => {
    const result = await window.electronAPI?.registerMeetingHotkey?.(hotkey);
    return result ?? { success: false, message: "Electron API unavailable" };
  }, []);

  const { registerHotkey: registerMeetingHotkey, isRegistering: isMeetingHotkeyRegistering } =
    useHotkeyRegistration({
      onSuccess: (registeredHotkey) => {
        setMeetingKey(registeredHotkey);
      },
      showSuccessToast: false,
      showErrorToast: true,
      showAlert: showAlertDialog,
      registerFn: meetingRegisterFn,
    });

  const validateDictationHotkey = useCallback(
    (hotkey: string) =>
      validateHotkeyForSlot(
        hotkey,
        {
          "settingsPage.general.meetingHotkey.title": meetingKey,
          "agentMode.settings.hotkey": agentKey,
        },
        t
      ),
    [meetingKey, agentKey, t]
  );

  const validateMeetingHotkey = useCallback(
    (hotkey: string) =>
      validateHotkeyForSlot(
        hotkey,
        {
          "settingsPage.general.hotkey.title": dictationKey,
          "agentMode.settings.hotkey": agentKey,
        },
        t
      ),
    [dictationKey, agentKey, t]
  );

  const [isUsingNativeShortcut, setIsUsingNativeShortcut] = useState(false);
  const [effectiveDefaultHotkey, setEffectiveDefaultHotkey] = useState<string | null>(null);

  const platform = getCachedPlatform();

  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartLoading, setAutoStartLoading] = useState(true);

  useEffect(() => {
    if (platform === "linux") {
      setAutoStartLoading(false);
      return;
    }
    const loadAutoStart = async () => {
      if (window.electronAPI?.getAutoStartEnabled) {
        try {
          const enabled = await window.electronAPI.getAutoStartEnabled();
          setAutoStartEnabled(enabled);
        } catch (error) {
          logger.error("Failed to get auto-start status", error, "settings");
        }
      }
      setAutoStartLoading(false);
    };
    loadAutoStart();
  }, [platform]);

  const handleAutoStartChange = async (enabled: boolean) => {
    if (window.electronAPI?.setAutoStartEnabled) {
      try {
        setAutoStartLoading(true);
        const result = await window.electronAPI.setAutoStartEnabled(enabled);
        if (result.success) {
          setAutoStartEnabled(enabled);
        }
      } catch (error) {
        logger.error("Failed to set auto-start", error, "settings");
      } finally {
        setAutoStartLoading(false);
      }
    }
  };

  const [noteFilesDefaultPath, setNoteFilesDefaultPath] = useState("");
  const [noteFilesRebuilding, setNoteFilesRebuilding] = useState(false);

  useEffect(() => {
    if (!noteFilesEnabled) return;
    window.electronAPI?.noteFilesGetDefaultPath?.().then((p) => {
      if (p) setNoteFilesDefaultPath(p);
    });
  }, [noteFilesEnabled]);

  const handleNoteFilesToggle = useCallback(
    async (enabled: boolean) => {
      setNoteFilesEnabled(enabled);
      await window.electronAPI?.noteFilesSetEnabled?.(enabled, noteFilesPath || undefined);
    },
    [setNoteFilesEnabled, noteFilesPath]
  );

  const handleNoteFilesChangePath = useCallback(async () => {
    const result = await window.electronAPI?.noteFilesPickFolder?.();
    if (result?.canceled || !result?.path) return;
    setNoteFilesPath(result.path);
    await window.electronAPI?.noteFilesSetPath?.(result.path);
  }, [setNoteFilesPath]);

  const handleNoteFilesRebuild = useCallback(async () => {
    setNoteFilesRebuilding(true);
    try {
      await window.electronAPI?.noteFilesRebuild?.();
    } finally {
      setNoteFilesRebuilding(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const timer = setTimeout(async () => {
      if (!mounted) return;

      const version = await getAppVersion();
      if (version && mounted) setCurrentVersion(version);

      if (mounted) {
        checkWhisperInstallation();
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [checkWhisperInstallation, getAppVersion]);

  useEffect(() => {
    const checkHotkeyMode = async () => {
      try {
        const info = await window.electronAPI?.getHotkeyModeInfo();
        if (info?.isUsingNativeShortcut) {
          setIsUsingNativeShortcut(true);
          setActivationMode("tap");
        }
      } catch (error) {
        logger.error("Failed to check hotkey mode", error, "settings");
      }
      try {
        const key = await window.electronAPI?.getEffectiveDefaultHotkey?.();
        if (key) setEffectiveDefaultHotkey(key);
      } catch (error) {
        logger.error("Failed to get effective default hotkey", error, "settings");
      }
    };
    checkHotkeyMode();
  }, [setActivationMode]);

  useEffect(() => {
    if (updateError) {
      showAlertDialog({
        title: t("settingsPage.general.updates.dialogs.updateError.title"),
        description: t("settingsPage.general.updates.dialogs.updateError.description"),
      });
    }
  }, [updateError, showAlertDialog, t]);

  useEffect(() => {
    if (installInitiated) {
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current);
      }
      installTimeoutRef.current = setTimeout(() => {
        showAlertDialog({
          title: t("settingsPage.general.updates.dialogs.almostThere.title"),
          description: t("settingsPage.general.updates.dialogs.almostThere.description"),
        });
      }, 10000);
    } else if (installTimeoutRef.current) {
      clearTimeout(installTimeoutRef.current);
      installTimeoutRef.current = null;
    }

    return () => {
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current);
        installTimeoutRef.current = null;
      }
    };
  }, [installInitiated, showAlertDialog, t]);

  const resetAccessibilityPermissions = () => {
    const message = t("settingsPage.permissions.resetAccessibility.description");

    showConfirmDialog({
      title: t("settingsPage.permissions.resetAccessibility.title"),
      description: message,
      onConfirm: () => {
        permissionsHook.requestAccessibilityPermission();
      },
    });
  };

  const handleRemoveModels = useCallback(() => {
    if (isRemovingModels) return;

    showConfirmDialog({
      title: t("settingsPage.developer.removeModels.title"),
      description: t("settingsPage.developer.removeModels.description", { path: cachePathHint }),
      confirmText: t("settingsPage.developer.removeModels.confirmText"),
      variant: "destructive",
      onConfirm: async () => {
        setIsRemovingModels(true);
        try {
          const results = await Promise.allSettled([
            window.electronAPI?.deleteAllWhisperModels?.(),
            window.electronAPI?.deleteAllParakeetModels?.(),
            window.electronAPI?.modelDeleteAll?.(),
          ]);

          const anyFailed = results.some(
            (r) =>
              r.status === "rejected" || (r.status === "fulfilled" && r.value && !r.value.success)
          );

          if (anyFailed) {
            showAlertDialog({
              title: t("settingsPage.developer.removeModels.failedTitle"),
              description: t("settingsPage.developer.removeModels.failedDescription"),
            });
          } else {
            window.dispatchEvent(new Event("openwhispr-models-cleared"));
            showAlertDialog({
              title: t("settingsPage.developer.removeModels.successTitle"),
              description: t("settingsPage.developer.removeModels.successDescription"),
            });
          }
        } catch {
          showAlertDialog({
            title: t("settingsPage.developer.removeModels.failedTitle"),
            description: t("settingsPage.developer.removeModels.failedDescriptionShort"),
          });
        } finally {
          setIsRemovingModels(false);
        }
      },
    });
  }, [isRemovingModels, cachePathHint, showConfirmDialog, showAlertDialog, t]);

  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-6">
            {/* Appearance */}
            <div>
              <SectionHeader
                title={t("settingsPage.general.appearance.title")}
                description={t("settingsPage.general.appearance.description")}
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.appearance.theme")}
                    description={t("settingsPage.general.appearance.themeDescription")}
                  >
                    <div className="inline-flex items-center gap-px p-0.5 bg-muted/60 dark:bg-surface-2 rounded-md">
                      {(
                        [
                          {
                            value: "light",
                            icon: Sun,
                            label: t("settingsPage.general.appearance.light"),
                          },
                          {
                            value: "dark",
                            icon: Moon,
                            label: t("settingsPage.general.appearance.dark"),
                          },
                          {
                            value: "auto",
                            icon: Monitor,
                            label: t("settingsPage.general.appearance.auto"),
                          },
                        ] as const
                      ).map((option) => {
                        const Icon = option.icon;
                        const isSelected = theme === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setTheme(option.value)}
                            className={`
                              flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-xs font-medium
                              transition-colors duration-100
                              ${
                                isSelected
                                  ? "bg-background dark:bg-surface-raised text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                            `}
                          >
                            <Icon className={`w-3 h-3 ${isSelected ? "text-primary" : ""}`} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Sound Effects */}
            <div>
              <SectionHeader title={t("settingsPage.general.soundEffects.title")} />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.soundEffects.dictationSounds")}
                    description={t("settingsPage.general.soundEffects.dictationSoundsDescription")}
                  >
                    <Toggle checked={audioCuesEnabled} onChange={setAudioCuesEnabled} />
                  </SettingsRow>
                </SettingsPanelRow>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.soundEffects.pauseMedia")}
                    description={t("settingsPage.general.soundEffects.pauseMediaDescription")}
                  >
                    <Toggle checked={pauseMediaOnDictation} onChange={setPauseMediaOnDictation} />
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Meeting Detection */}
            <div>
              <SectionHeader
                title={t("calendar.detection.title")}
                description={t("calendar.detection.description")}
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("calendar.detection.audioDetection")}
                    description={t("calendar.detection.audioDescription")}
                  >
                    <Toggle
                      checked={meetingAudioDetection}
                      onChange={(value) => {
                        setMeetingAudioDetection(value);
                        window.electronAPI?.meetingDetectionSetPreferences?.({
                          audioDetection: value,
                        });
                      }}
                    />
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Clipboard */}
            <div>
              <SectionHeader title={t("settingsPage.general.clipboard.title")} />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.clipboard.keepInClipboard")}
                    description={t("settingsPage.general.clipboard.keepInClipboardDescription")}
                  >
                    <Toggle
                      checked={keepTranscriptionInClipboard}
                      onChange={setKeepTranscriptionInClipboard}
                    />
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Save Notes as Files */}
            <div>
              <SectionHeader title={t("settings.noteFiles.title")} />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settings.noteFiles.title")}
                    description={t("settings.noteFiles.description")}
                  >
                    <Toggle checked={noteFilesEnabled} onChange={handleNoteFilesToggle} />
                  </SettingsRow>
                </SettingsPanelRow>
                {noteFilesEnabled && (
                  <>
                    <SettingsPanelRow>
                      <SettingsRow
                        label={t("settings.noteFiles.path")}
                        description={noteFilesPath || noteFilesDefaultPath || "..."}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleNoteFilesChangePath}
                        >
                          {t("settings.noteFiles.changePath")}
                        </Button>
                      </SettingsRow>
                    </SettingsPanelRow>
                    <SettingsPanelRow>
                      <SettingsRow
                        label={t("settings.noteFiles.rebuild")}
                        description={t("settings.noteFiles.rebuildDescription")}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={noteFilesRebuilding}
                          onClick={handleNoteFilesRebuild}
                        >
                          {noteFilesRebuilding ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            t("settings.noteFiles.rebuild")
                          )}
                        </Button>
                      </SettingsRow>
                    </SettingsPanelRow>
                  </>
                )}
              </SettingsPanel>
            </div>

            {/* Floating Icon */}
            <div>
              <SectionHeader
                title={t("settingsPage.general.floatingIcon.title")}
                description={t("settingsPage.general.floatingIcon.description")}
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.floatingIcon.autoHide")}
                    description={t("settingsPage.general.floatingIcon.autoHideDescription")}
                  >
                    <Toggle checked={floatingIconAutoHide} onChange={setFloatingIconAutoHide} />
                  </SettingsRow>
                </SettingsPanelRow>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.floatingIcon.startPosition")}
                    description={t("settingsPage.general.floatingIcon.startPositionDescription")}
                  >
                    <select
                      value={panelStartPosition}
                      onChange={(e) =>
                        setPanelStartPosition(
                          e.target.value as "bottom-right" | "center" | "bottom-left"
                        )
                      }
                      className="h-7 rounded border border-border/70 bg-surface-1/80 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:border-border-hover hover:bg-surface-2/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-colors duration-200"
                    >
                      <option value="bottom-right">
                        {t("settingsPage.general.floatingIcon.bottomRight")}
                      </option>
                      <option value="center">
                        {t("settingsPage.general.floatingIcon.center")}
                      </option>
                      <option value="bottom-left">
                        {t("settingsPage.general.floatingIcon.bottomLeft")}
                      </option>
                    </select>
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Language */}
            <div>
              <SectionHeader
                title={t("settings.language.sectionTitle")}
                description={t("settings.language.sectionDescription")}
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settings.language.uiLabel")}
                    description={t("settings.language.uiDescription")}
                  >
                    <LanguageSelector
                      value={uiLanguage}
                      onChange={setUiLanguage}
                      options={UI_LANGUAGE_OPTIONS}
                      className="min-w-32"
                    />
                  </SettingsRow>
                </SettingsPanelRow>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settings.language.transcriptionLabel")}
                    description={t("settings.language.transcriptionDescription")}
                  >
                    <LanguageSelector
                      value={preferredLanguage}
                      onChange={(value) =>
                        updateTranscriptionSettings({ preferredLanguage: value })
                      }
                    />
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Startup */}
            <div>
              <SectionHeader
                title={t("settingsPage.general.startup.title")}
                description={t("settingsPage.general.startup.description")}
              />
              <SettingsPanel>
                {platform !== "linux" && (
                  <SettingsPanelRow>
                    <SettingsRow
                      label={t("settingsPage.general.startup.launchAtLogin")}
                      description={t("settingsPage.general.startup.launchAtLoginDescription")}
                    >
                      <Toggle
                        checked={autoStartEnabled}
                        onChange={(checked: boolean) => handleAutoStartChange(checked)}
                        disabled={autoStartLoading}
                      />
                    </SettingsRow>
                  </SettingsPanelRow>
                )}
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.startup.startMinimized")}
                    description={t("settingsPage.general.startup.startMinimizedDescription")}
                  >
                    <Toggle checked={startMinimized} onChange={setStartMinimized} />
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Microphone */}
            <div>
              <SectionHeader
                title={t("settingsPage.general.microphone.title")}
                description={t("settingsPage.general.microphone.description")}
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <MicrophoneSettings
                    preferBuiltInMic={preferBuiltInMic}
                    selectedMicDeviceId={selectedMicDeviceId}
                    onPreferBuiltInChange={setPreferBuiltInMic}
                    onDeviceSelect={setSelectedMicDeviceId}
                  />
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Dictionary */}
            <div>
              <SectionHeader
                title={t("settingsPage.dictionary.autoLearnTitle", {
                  defaultValue: "Auto-learn from corrections",
                })}
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.dictionary.autoLearnTitle", {
                      defaultValue: "Auto-learn from corrections",
                    })}
                    description={t("settingsPage.dictionary.autoLearnDescription", {
                      defaultValue:
                        "When you correct a transcription in the target app, the corrected word is automatically added to your dictionary.",
                    })}
                  >
                    <Toggle checked={autoLearnCorrections} onChange={setAutoLearnCorrections} />
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Wayland Paste Diagnostics â€” only on Linux + Wayland */}
            {ydotoolStatus?.isLinux && ydotoolStatus?.isWayland && (
              <div>
                <SectionHeader
                  title={t("settingsPage.general.waylandPaste.title", {
                    defaultValue: "Wayland Paste Setup",
                  })}
                  description={t("settingsPage.general.waylandPaste.description", {
                    defaultValue:
                      "Auto-paste on Wayland requires ydotool. Check the status of each component below.",
                  })}
                />
                {(() => {
                  const checks = [
                    {
                      key: "hasYdotool",
                      label: "ydotool",
                      ok: ydotoolStatus.hasYdotool,
                      desc: t("settingsPage.general.waylandPaste.ydotoolDesc", {
                        defaultValue: "Input automation tool for Wayland",
                      }),
                      steps: [
                        {
                          title: t("settingsPage.general.waylandPaste.guide.ydotool.step1Title", {
                            defaultValue: "Install ydotool",
                          }),
                          desc: t("settingsPage.general.waylandPaste.guide.ydotool.step1Desc", {
                            defaultValue:
                              "Use your distribution's package manager to install ydotool.",
                          }),
                          cmds: [
                            { label: "Ubuntu / Pop!_OS / Debian", cmd: "sudo apt install ydotool" },
                            { label: "Fedora", cmd: "sudo dnf install ydotool" },
                            { label: "openSUSE", cmd: "sudo zypper install ydotool" },
                          ],
                        },
                        {
                          title: t("settingsPage.general.waylandPaste.guide.ydotool.step2Title", {
                            defaultValue: "Verify installation",
                          }),
                          desc: t("settingsPage.general.waylandPaste.guide.ydotool.step2Desc", {
                            defaultValue: "Check that ydotool is available in your PATH.",
                          }),
                          cmds: [{ cmd: "which ydotool" }],
                        },
                      ],
                    },
                    {
                      key: "hasYdotoold",
                      label: "ydotoold",
                      ok: ydotoolStatus.hasYdotoold,
                      desc: t("settingsPage.general.waylandPaste.ydotooldDesc", {
                        defaultValue: "Daemon for ydotool (separate package on Ubuntu/Pop!_OS)",
                      }),
                      steps: [
                        {
                          title: t("settingsPage.general.waylandPaste.guide.ydotoold.step1Title", {
                            defaultValue: "Install ydotoold",
                          }),
                          desc: t("settingsPage.general.waylandPaste.guide.ydotoold.step1Desc", {
                            defaultValue:
                              "On Ubuntu and Pop!_OS, ydotoold is a separate package. On Fedora, it's included with ydotool.",
                          }),
                          cmds: [
                            {
                              label: "Ubuntu / Pop!_OS / Debian",
                              cmd: "sudo apt install ydotoold",
                            },
                            { label: "Fedora", cmd: "# Already included in the ydotool package" },
                          ],
                        },
                      ],
                    },
                    {
                      key: "hasUinput",
                      label: "/dev/uinput",
                      ok: ydotoolStatus.hasUinput,
                      desc: t("settingsPage.general.waylandPaste.uinputDesc", {
                        defaultValue: "Kernel input device access",
                      }),
                      note: !ydotoolStatus.hasUinput
                        ? ydotoolStatus.hasUdevRule
                          ? t("settingsPage.general.waylandPaste.uinputRuleFound", {
                              defaultValue: "Rule present but not active. A reboot should fix it.",
                            })
                          : t("settingsPage.general.waylandPaste.uinputRuleMissing", {
                              defaultValue: "no udev rule found",
                            })
                        : undefined,
                      steps:
                        ydotoolStatus.hasUdevRule && !ydotoolStatus.hasUinput
                          ? [
                              {
                                title: t(
                                  "settingsPage.general.waylandPaste.guide.uinput.ruleFoundTitle",
                                  {
                                    defaultValue: "udev rule already configured",
                                  }
                                ),
                                desc: t(
                                  "settingsPage.general.waylandPaste.guide.uinput.ruleFoundDesc",
                                  {
                                    defaultValue:
                                      "The udev rule for /dev/uinput is already on your system but hasn't taken effect. Try reloading:",
                                  }
                                ),
                                cmds: [
                                  {
                                    cmd: "sudo udevadm control --reload-rules && sudo udevadm trigger /dev/uinput",
                                  },
                                ],
                              },
                              {
                                title: t(
                                  "settingsPage.general.waylandPaste.guide.uinput.rebootTitle",
                                  {
                                    defaultValue: "If reloading didn't help, reboot",
                                  }
                                ),
                                desc: t(
                                  "settingsPage.general.waylandPaste.guide.uinput.rebootDesc",
                                  {
                                    defaultValue:
                                      "On some distros, udev changes only apply after a full reboot. Restart your computer and come back to re-check.",
                                  }
                                ),
                              },
                            ]
                          : [
                              {
                                title: t(
                                  "settingsPage.general.waylandPaste.guide.uinput.step1Title",
                                  {
                                    defaultValue: "Create a udev rule",
                                  }
                                ),
                                desc: t(
                                  "settingsPage.general.waylandPaste.guide.uinput.step1Desc",
                                  {
                                    defaultValue:
                                      "This rule grants access to /dev/uinput for users in the input group.",
                                  }
                                ),
                                cmds: [
                                  {
                                    cmd: 'echo \'KERNEL=="uinput", GROUP="input", MODE="0660", TAG+="uaccess"\' | sudo tee /etc/udev/rules.d/70-uinput.rules',
                                  },
                                ],
                              },
                              {
                                title: t(
                                  "settingsPage.general.waylandPaste.guide.uinput.step2Title",
                                  {
                                    defaultValue: "Reload udev rules",
                                  }
                                ),
                                desc: t(
                                  "settingsPage.general.waylandPaste.guide.uinput.step2Desc",
                                  {
                                    defaultValue: "Apply the new rule without rebooting.",
                                  }
                                ),
                                cmds: [
                                  {
                                    cmd: "sudo udevadm control --reload-rules && sudo udevadm trigger /dev/uinput",
                                  },
                                ],
                              },
                            ],
                    },
                    {
                      key: "hasGroup",
                      label: t("settingsPage.general.waylandPaste.inputGroup", {
                        defaultValue: "input group",
                      }),
                      ok: ydotoolStatus.hasGroup,
                      desc: t("settingsPage.general.waylandPaste.inputGroupDesc", {
                        defaultValue: "User must be in the input group (requires re-login)",
                      }),
                      steps: [
                        {
                          title: t("settingsPage.general.waylandPaste.guide.group.step1Title", {
                            defaultValue: "Add your user to the input group",
                          }),
                          cmds: [{ cmd: "sudo usermod -aG input $USER" }],
                        },
                        {
                          title: t("settingsPage.general.waylandPaste.guide.group.step2Title", {
                            defaultValue: "Log out and back in",
                          }),
                          desc: t("settingsPage.general.waylandPaste.guide.group.step2Desc", {
                            defaultValue:
                              "Group changes only take effect after a new login session. Log out of your desktop and log back in, then reopen OpenWhispr.",
                          }),
                        },
                      ],
                    },
                    {
                      key: "hasService",
                      label: t("settingsPage.general.waylandPaste.service", {
                        defaultValue: "systemd service",
                      }),
                      ok: ydotoolStatus.hasService,
                      desc: t("settingsPage.general.waylandPaste.serviceDesc", {
                        defaultValue: "User service file for auto-starting ydotoold",
                      }),
                      steps: [
                        {
                          title: t("settingsPage.general.waylandPaste.guide.service.step1Title", {
                            defaultValue: "Create the service directory",
                          }),
                          cmds: [{ cmd: "mkdir -p ~/.config/systemd/user" }],
                        },
                        {
                          title: t("settingsPage.general.waylandPaste.guide.service.step2Title", {
                            defaultValue: "Create the service file",
                          }),
                          desc: t("settingsPage.general.waylandPaste.guide.service.step2Desc", {
                            defaultValue:
                              "This creates a user-level systemd service that starts ydotoold automatically when you log in.",
                          }),
                          cmds: [
                            {
                              cmd: `cat > ~/.config/systemd/user/ydotoold.service << 'EOF'
[Unit]
Description=ydotoold - ydotool daemon
After=graphical-session.target
PartOf=graphical-session.target

[Service]
ExecStart=/usr/bin/ydotoold
Restart=on-failure
RestartSec=1s

[Install]
WantedBy=graphical-session.target
EOF`,
                            },
                          ],
                        },
                        {
                          title: t("settingsPage.general.waylandPaste.guide.service.step3Title", {
                            defaultValue: "Reload and enable",
                          }),
                          cmds: [
                            {
                              cmd: "systemctl --user daemon-reload && systemctl --user enable ydotoold",
                            },
                          ],
                        },
                      ],
                    },
                    {
                      key: "daemonRunning",
                      label: t("settingsPage.general.waylandPaste.daemon", {
                        defaultValue: "ydotoold daemon",
                      }),
                      ok: ydotoolStatus.daemonRunning,
                      desc: t("settingsPage.general.waylandPaste.daemonDesc", {
                        defaultValue: "Background service must be running",
                      }),
                      steps: [
                        {
                          title: t("settingsPage.general.waylandPaste.guide.daemon.step1Title", {
                            defaultValue: "Start the daemon",
                          }),
                          desc: t("settingsPage.general.waylandPaste.guide.daemon.step1Desc", {
                            defaultValue: "Start ydotoold and enable it so it runs on every login.",
                          }),
                          cmds: [
                            {
                              cmd: "systemctl --user enable ydotoold && systemctl --user start ydotoold",
                            },
                          ],
                        },
                        {
                          title: t("settingsPage.general.waylandPaste.guide.daemon.step2Title", {
                            defaultValue: "Verify it's running",
                          }),
                          cmds: [{ cmd: "systemctl --user status ydotoold" }],
                        },
                      ],
                    },
                  ];

                  if (ydotoolStatus.isKde) {
                    checks.push({
                      key: "hasXclip",
                      label: "xclip",
                      ok: ydotoolStatus.hasXclip || ydotoolStatus.hasXsel || false,
                      desc: t("settingsPage.general.waylandPaste.xclipDesc", {
                        defaultValue: "Clipboard tool for KDE Wayland paste (xclip or xsel)",
                      }),
                      steps: [
                        {
                          title: t("settingsPage.general.waylandPaste.guide.xclip.step1Title", {
                            defaultValue: "Install xclip",
                          }),
                          cmds: [
                            { cmd: "sudo dnf install xclip  # Fedora" },
                            { cmd: "sudo apt install xclip  # Debian/Ubuntu" },
                          ],
                        },
                      ],
                    });
                  }

                  const allOk = checks.every((c) => c.ok);
                  const activeGuide = checks.find((c) => c.key === ydotoolGuideKey);

                  return (
                    <>
                      {allOk ? (
                        <SettingsPanel>
                          <SettingsPanelRow>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CircleCheck className="h-4 w-4 text-emerald-500" />
                                <span className="text-sm">
                                  {t("settingsPage.general.waylandPaste.allGoodDesc", {
                                    defaultValue: "Auto-paste is ready to go.",
                                  })}
                                </span>
                              </div>
                              <button
                                onClick={refreshYdotoolStatus}
                                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </SettingsPanelRow>
                        </SettingsPanel>
                      ) : (
                        <>
                          <div className="rounded-xl border border-border overflow-hidden">
                            <div className="divide-y divide-border">
                              {checks.map((item) => (
                                <div key={item.key} className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    {item.ok ? (
                                      <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                                    ) : (
                                      <CircleX className="h-4 w-4 shrink-0 text-red-500" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-medium">{item.label}</span>
                                      <span className="text-xs text-muted-foreground ml-2">
                                        {item.desc}
                                      </span>
                                      {item.note && (
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                                          {item.note}
                                        </p>
                                      )}
                                    </div>
                                    {!item.ok && (
                                      <button
                                        onClick={() => setYdotoolGuideKey(item.key)}
                                        className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors text-foreground"
                                      >
                                        <BookOpen className="w-3 h-3" />
                                        {t("settingsPage.general.waylandPaste.guide.open", {
                                          defaultValue: "Guide",
                                        })}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={refreshYdotoolStatus}
                            className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <RotateCw className="w-3 h-3" />
                            {t("settingsPage.general.waylandPaste.recheck", {
                              defaultValue: "Re-check",
                            })}
                          </button>
                        </>
                      )}

                      {/* Step-by-step guide dialog */}
                      <Dialog
                        open={!!activeGuide}
                        onOpenChange={(open) => !open && setYdotoolGuideKey(null)}
                      >
                        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                          {activeGuide && (
                            <>
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4" />
                                  {activeGuide.label}
                                </DialogTitle>
                                <DialogDescription>{activeGuide.desc}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-5 mt-2">
                                {activeGuide.steps.map((step, i) => (
                                  <div key={i}>
                                    <div className="flex items-start gap-3">
                                      <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                                        {i + 1}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{step.title}</p>
                                        {step.desc && (
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {step.desc}
                                          </p>
                                        )}
                                        {step.cmds && step.cmds.length > 0 && (
                                          <div className="mt-2 space-y-2">
                                            {step.cmds.map((c, j) => (
                                              <div key={j}>
                                                {c.label && (
                                                  <p className="text-[11px] text-muted-foreground mb-1">
                                                    {c.label}
                                                  </p>
                                                )}
                                                <div className="flex items-start gap-1.5">
                                                  <pre className="flex-1 text-[11px] bg-muted/60 rounded-md px-3 py-2 font-mono whitespace-pre-wrap break-all select-all overflow-x-auto">
                                                    {c.cmd}
                                                  </pre>
                                                  <button
                                                    onClick={() =>
                                                      navigator.clipboard.writeText(c.cmd)
                                                    }
                                                    className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                                    title={t(
                                                      "settingsPage.general.waylandPaste.copy",
                                                      { defaultValue: "Copy" }
                                                    )}
                                                  >
                                                    <Copy className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );

      case "hotkeys":
        return (
          <div className="space-y-6">
            {/* Dictation Hotkey */}
            <div>
              <SectionHeader
                title={t("settingsPage.general.hotkey.title")}
                description={t("settingsPage.general.hotkey.description")}
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <HotkeyInput
                    value={dictationKey}
                    onChange={async (newHotkey) => {
                      await registerHotkey(newHotkey);
                    }}
                    disabled={isHotkeyRegistering}
                    validate={validateDictationHotkey}
                  />
                  {effectiveDefaultHotkey &&
                    dictationKey &&
                    dictationKey !== effectiveDefaultHotkey && (
                      <button
                        onClick={() => registerHotkey(effectiveDefaultHotkey)}
                        disabled={isHotkeyRegistering}
                        className="mt-2 text-xs text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {t("settingsPage.general.hotkey.resetToDefault", {
                          hotkey: formatHotkeyLabel(effectiveDefaultHotkey),
                        })}
                      </button>
                    )}
                </SettingsPanelRow>

                {!isUsingNativeShortcut && (
                  <SettingsPanelRow>
                    <p className="text-xs font-medium text-muted-foreground/80 mb-2">
                      {t("settingsPage.general.hotkey.activationMode")}
                    </p>
                    <ActivationModeSelector value={activationMode} onChange={setActivationMode} />
                  </SettingsPanelRow>
                )}
              </SettingsPanel>
            </div>

            {/* Meeting Mode Hotkey */}
            <div>
              <SectionHeader
                title={t("settingsPage.general.meetingHotkey.title")}
                description={t("settingsPage.general.meetingHotkey.description")}
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <HotkeyInput
                    value={meetingKey}
                    onChange={async (newHotkey) => {
                      await registerMeetingHotkey(newHotkey);
                    }}
                    disabled={isMeetingHotkeyRegistering}
                    validate={validateMeetingHotkey}
                  />
                  {meetingKey && (
                    <button
                      onClick={async () => {
                        await window.electronAPI?.registerMeetingHotkey?.("");
                        setMeetingKey("");
                      }}
                      disabled={isMeetingHotkeyRegistering}
                      className="mt-2 text-xs text-muted-foreground/70 hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {t("settingsPage.general.meetingHotkey.clear")}
                    </button>
                  )}
                </SettingsPanelRow>
              </SettingsPanel>
            </div>
          </div>
        );

      case "transcription":
        return (
          <TranscriptionSection
            cloudTranscriptionMode={cloudTranscriptionMode}
            setCloudTranscriptionMode={setCloudTranscriptionMode}
            useLocalWhisper={useLocalWhisper}
            setUseLocalWhisper={setUseLocalWhisper}
            updateTranscriptionSettings={updateTranscriptionSettings}
            cloudTranscriptionProvider={cloudTranscriptionProvider}
            setCloudTranscriptionProvider={setCloudTranscriptionProvider}
            cloudTranscriptionModel={cloudTranscriptionModel}
            setCloudTranscriptionModel={setCloudTranscriptionModel}
            localTranscriptionProvider={localTranscriptionProvider}
            setLocalTranscriptionProvider={setLocalTranscriptionProvider}
            whisperModel={whisperModel}
            setWhisperModel={setWhisperModel}
            parakeetModel={parakeetModel}
            setParakeetModel={setParakeetModel}
            openaiApiKey={openaiApiKey}
            setOpenaiApiKey={setOpenaiApiKey}
            groqApiKey={groqApiKey}
            setGroqApiKey={setGroqApiKey}
            mistralApiKey={mistralApiKey}
            setMistralApiKey={setMistralApiKey}
            customTranscriptionApiKey={customTranscriptionApiKey}
            setCustomTranscriptionApiKey={setCustomTranscriptionApiKey}
            cloudTranscriptionBaseUrl={cloudTranscriptionBaseUrl}
            setCloudTranscriptionBaseUrl={setCloudTranscriptionBaseUrl}
            transcriptionMode={transcriptionMode}
            setTranscriptionMode={setTranscriptionMode}
            remoteTranscriptionUrl={remoteTranscriptionUrl}
            setRemoteTranscriptionUrl={setRemoteTranscriptionUrl}
            toast={toast}
          />
        );

      case "aiModels":
        return (
          <AiModelsSection
            cloudReasoningMode={cloudReasoningMode}
            setCloudReasoningMode={setCloudReasoningMode}
            useReasoningModel={useReasoningModel}
            setUseReasoningModel={(value) => {
              setUseReasoningModel(value);
              updateReasoningSettings({ useReasoningModel: value });
            }}
            reasoningModel={reasoningModel}
            setReasoningModel={setReasoningModel}
            reasoningProvider={reasoningProvider}
            setReasoningProvider={setReasoningProvider}
            cloudReasoningBaseUrl={cloudReasoningBaseUrl}
            setCloudReasoningBaseUrl={setCloudReasoningBaseUrl}
            openaiApiKey={openaiApiKey}
            setOpenaiApiKey={setOpenaiApiKey}
            anthropicApiKey={anthropicApiKey}
            setAnthropicApiKey={setAnthropicApiKey}
            geminiApiKey={geminiApiKey}
            setGeminiApiKey={setGeminiApiKey}
            groqApiKey={groqApiKey}
            setGroqApiKey={setGroqApiKey}
            customReasoningApiKey={customReasoningApiKey}
            setCustomReasoningApiKey={setCustomReasoningApiKey}
            reasoningMode={reasoningMode}
            setReasoningMode={setReasoningMode}
            remoteReasoningUrl={remoteReasoningUrl}
            setRemoteReasoningUrl={setRemoteReasoningUrl}
            toast={toast}
          />
        );

      case "agentConfig":
        return (
          <div className="space-y-5">
            <SectionHeader
              title={t("settingsPage.agentConfig.title")}
              description={t("settingsPage.agentConfig.description")}
            />

            {/* Agent Name */}
            <div>
              <p className="text-[13px] font-medium text-foreground mb-3">
                {t("settingsPage.agentConfig.agentName")}
              </p>
              <SettingsPanel>
                <SettingsPanelRow>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("settingsPage.agentConfig.placeholder")}
                        value={agentNameInput}
                        onChange={(e) => setAgentNameInput(e.target.value)}
                        className="flex-1 text-center text-base font-mono"
                      />
                      <Button
                        onClick={handleSaveAgentName}
                        disabled={!agentNameInput.trim()}
                        size="sm"
                      >
                        {t("settingsPage.agentConfig.save")}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">
                      {t("settingsPage.agentConfig.helper")}
                    </p>
                  </div>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* How it works */}
            <div>
              <SectionHeader title={t("settingsPage.agentConfig.howItWorksTitle")} />
              <SettingsPanel>
                <SettingsPanelRow>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {t("settingsPage.agentConfig.howItWorksDescription", { agentName })}
                  </p>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Examples */}
            <div>
              <SectionHeader title={t("settingsPage.agentConfig.examplesTitle")} />
              <SettingsPanel>
                <SettingsPanelRow>
                  <div className="space-y-2.5">
                    {[
                      {
                        input: `Hey ${agentName}, write a formal email about the budget`,
                        mode: t("settingsPage.agentConfig.instructionMode"),
                      },
                      {
                        input: `Hey ${agentName}, make this more professional`,
                        mode: t("settingsPage.agentConfig.instructionMode"),
                      },
                      {
                        input: `Hey ${agentName}, convert this to bullet points`,
                        mode: t("settingsPage.agentConfig.instructionMode"),
                      },
                      {
                        input: t("settingsPage.agentConfig.cleanupExample"),
                        mode: t("settingsPage.agentConfig.cleanupMode"),
                      },
                    ].map((example, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span
                          className={`shrink-0 mt-0.5 text-[10px] font-medium uppercase tracking-wider px-1.5 py-px rounded ${
                            example.mode === t("settingsPage.agentConfig.instructionMode")
                              ? "bg-primary/10 text-primary dark:bg-primary/15"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {example.mode}
                        </span>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                          "{example.input}"
                        </p>
                      </div>
                    ))}
                  </div>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>
          </div>
        );

      case "prompts":
        return (
          <div className="space-y-5">
            <SectionHeader
              title={t("settingsPage.prompts.title")}
              description={t("settingsPage.prompts.description")}
            />

            <PromptStudio />
          </div>
        );

      case "intelligence":
        return (
          <div className="space-y-6">
            {/* Text Cleanup (AI Models) */}
            <AiModelsSection
              cloudReasoningMode={cloudReasoningMode}
              setCloudReasoningMode={setCloudReasoningMode}
              useReasoningModel={useReasoningModel}
              setUseReasoningModel={(value) => {
                updateReasoningSettings({ useReasoningModel: value });
              }}
              reasoningModel={reasoningModel}
              setReasoningModel={setReasoningModel}
              reasoningProvider={reasoningProvider}
              setReasoningProvider={setReasoningProvider}
              cloudReasoningBaseUrl={cloudReasoningBaseUrl}
              setCloudReasoningBaseUrl={setCloudReasoningBaseUrl}
              openaiApiKey={openaiApiKey}
              setOpenaiApiKey={setOpenaiApiKey}
              anthropicApiKey={anthropicApiKey}
              setAnthropicApiKey={setAnthropicApiKey}
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              groqApiKey={groqApiKey}
              setGroqApiKey={setGroqApiKey}
              customReasoningApiKey={customReasoningApiKey}
              setCustomReasoningApiKey={setCustomReasoningApiKey}
              reasoningMode={reasoningMode}
              setReasoningMode={setReasoningMode}
              remoteReasoningUrl={remoteReasoningUrl}
              setRemoteReasoningUrl={setRemoteReasoningUrl}
              toast={toast}
            />

            {/* Agent Config */}
            <div className="border-t border-border/40 pt-6">
              <SectionHeader
                title={t("settingsPage.agentConfig.title")}
                description={t("settingsPage.agentConfig.description")}
              />

              <div className="space-y-5">
                <div>
                  <p className="text-xs font-medium text-foreground mb-3">
                    {t("settingsPage.agentConfig.agentName")}
                  </p>
                  <SettingsPanel>
                    <SettingsPanelRow>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder={t("settingsPage.agentConfig.placeholder")}
                            value={agentNameInput}
                            onChange={(e) => setAgentNameInput(e.target.value)}
                            className="flex-1 text-center text-base font-mono"
                          />
                          <Button
                            onClick={handleSaveAgentName}
                            disabled={!agentNameInput.trim()}
                            size="sm"
                          >
                            {t("settingsPage.agentConfig.save")}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground/60">
                          {t("settingsPage.agentConfig.helper")}
                        </p>
                      </div>
                    </SettingsPanelRow>
                  </SettingsPanel>
                </div>

                <div>
                  <SectionHeader title={t("settingsPage.agentConfig.howItWorksTitle")} />
                  <SettingsPanel>
                    <SettingsPanelRow>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t("settingsPage.agentConfig.howItWorksDescription", { agentName })}
                      </p>
                    </SettingsPanelRow>
                  </SettingsPanel>
                </div>

                <div>
                  <SectionHeader title={t("settingsPage.agentConfig.examplesTitle")} />
                  <SettingsPanel>
                    <SettingsPanelRow>
                      <div className="space-y-2.5">
                        {[
                          {
                            input: t("settingsPage.agentConfig.examples.formalEmail", {
                              agentName,
                            }),
                            mode: t("settingsPage.agentConfig.instructionMode"),
                          },
                          {
                            input: t("settingsPage.agentConfig.examples.professional", {
                              agentName,
                            }),
                            mode: t("settingsPage.agentConfig.instructionMode"),
                          },
                          {
                            input: t("settingsPage.agentConfig.examples.bulletPoints", {
                              agentName,
                            }),
                            mode: t("settingsPage.agentConfig.instructionMode"),
                          },
                          {
                            input: t("settingsPage.agentConfig.cleanupExample"),
                            mode: t("settingsPage.agentConfig.cleanupMode"),
                          },
                        ].map((example, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span
                              className={`shrink-0 mt-0.5 text-xs font-medium uppercase tracking-wider px-1.5 py-px rounded ${
                                example.mode === t("settingsPage.agentConfig.instructionMode")
                                  ? "bg-primary/10 text-primary dark:bg-primary/15"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {example.mode}
                            </span>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              "{example.input}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </SettingsPanelRow>
                  </SettingsPanel>
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="border-t border-border/40 pt-6">
              <SectionHeader
                title={t("settingsPage.prompts.title")}
                description={t("settingsPage.prompts.description")}
              />
              <PromptStudio />
            </div>
          </div>
        );

      case "privacyData":
        return (
          <div className="space-y-6">
            {/* Privacy */}
            <div>
              <SectionHeader
                title={t("settingsPage.privacy.title")}
                description={t("settingsPage.privacy.description")}
              />

            </div>

            {/* Audio Retention */}
            <div className="border-t border-border/40 pt-6">
              <SectionHeader
                title={t("settingsPage.privacy.audioRetention")}
                description={t("settingsPage.privacy.audioRetentionDescription")}
              />

              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.privacy.audioRetention")}
                    description={t("settingsPage.privacy.audioRetentionDescription")}
                  >
                    <select
                      value={audioRetentionDays}
                      onChange={(e) => setAudioRetentionDays(parseInt(e.target.value, 10))}
                      className="h-7 rounded border border-border/70 bg-surface-1/80 px-2.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm hover:border-border-hover hover:bg-surface-2/70 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-1 transition-colors duration-200"
                    >
                      <option value={0}>{t("settingsPage.privacy.audioRetentionDisabled")}</option>
                      <option value={7}>
                        {t("settingsPage.privacy.audioRetentionDays", { count: 7 })}
                      </option>
                      <option value={14}>
                        {t("settingsPage.privacy.audioRetentionDays", { count: 14 })}
                      </option>
                      <option value={30}>
                        {t("settingsPage.privacy.audioRetentionDays", { count: 30 })}
                      </option>
                      <option value={60}>
                        {t("settingsPage.privacy.audioRetentionDays", { count: 60 })}
                      </option>
                      <option value={90}>
                        {t("settingsPage.privacy.audioRetentionDays", { count: 90 })}
                      </option>
                    </select>
                  </SettingsRow>
                </SettingsPanelRow>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.privacy.audioStorageUsage")}
                    description={
                      audioStorageUsage.fileCount > 0
                        ? t("settingsPage.privacy.audioStorageFiles", {
                            count: audioStorageUsage.fileCount,
                            size: formatBytes(audioStorageUsage.totalBytes),
                          })
                        : t("settingsPage.privacy.audioStorageEmpty")
                    }
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={audioStorageUsage.fileCount === 0}
                      onClick={handleClearAllAudio}
                    >
                      {t("settingsPage.privacy.clearAllAudio")}
                    </Button>
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Data Retention */}
            <div className="border-t border-border/40 pt-6">
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.privacy.dataRetention")}
                    description={t("settingsPage.privacy.dataRetentionDescription")}
                  >
                    <Toggle checked={dataRetentionEnabled} onChange={setDataRetentionEnabled} />
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Permissions */}
            <div className="border-t border-border/40 pt-6">
              <SectionHeader
                title={t("settingsPage.permissions.title")}
                description={t("settingsPage.permissions.description")}
              />

              <div className="space-y-3">
                <PermissionCard
                  icon={Mic}
                  title={t("settingsPage.permissions.microphoneTitle")}
                  description={t("settingsPage.permissions.microphoneDescription")}
                  granted={permissionsHook.micPermissionGranted}
                  onRequest={permissionsHook.requestMicPermission}
                  buttonText={t("settingsPage.permissions.grantAccess")}
                />

                {(platform === "darwin" || canManageSystemAudioInApp(systemAudio)) && (
                  <>
                    {platform === "darwin" && (
                      <PermissionCard
                        icon={Shield}
                        title={t("settingsPage.permissions.accessibilityTitle")}
                        description={t("settingsPage.permissions.accessibilityDescription")}
                        granted={permissionsHook.accessibilityPermissionGranted}
                        onRequest={permissionsHook.requestAccessibilityPermission}
                        buttonText={t("settingsPage.permissions.grantAccess")}
                      />
                    )}
                    {canManageSystemAudioInApp(systemAudio) && (
                      <PermissionCard
                        icon={Monitor}
                        title={t("settingsPage.permissions.systemAudioTitle")}
                        description={t("settingsPage.permissions.systemAudioDescription")}
                        granted={systemAudio.granted}
                        onRequest={systemAudio.request}
                        buttonText={t("settingsPage.permissions.grantAccess")}
                        badge={t("settingsPage.permissions.optional")}
                      />
                    )}
                  </>
                )}
              </div>

              {!permissionsHook.micPermissionGranted && permissionsHook.micPermissionError && (
                <MicPermissionWarning
                  error={permissionsHook.micPermissionError}
                  onOpenSoundSettings={permissionsHook.openSoundInputSettings}
                  onOpenPrivacySettings={permissionsHook.openMicPrivacySettings}
                />
              )}

              {platform === "linux" &&
                permissionsHook.pasteToolsInfo &&
                !permissionsHook.pasteToolsInfo.available && (
                  <PasteToolsInfo
                    pasteToolsInfo={permissionsHook.pasteToolsInfo}
                    isChecking={permissionsHook.isCheckingPasteTools}
                    onCheck={permissionsHook.checkPasteToolsAvailability}
                  />
                )}

              {platform === "darwin" && (
                <div className="mt-5">
                  <p className="text-xs font-medium text-foreground mb-3">
                    {t("settingsPage.permissions.troubleshootingTitle")}
                  </p>
                  <SettingsPanel>
                    <SettingsPanelRow>
                      <SettingsRow
                        label={t("settingsPage.permissions.resetAccessibility.label")}
                        description={t(
                          "settingsPage.permissions.resetAccessibility.rowDescription"
                        )}
                      >
                        <Button
                          onClick={resetAccessibilityPermissions}
                          variant="ghost"
                          size="sm"
                          className="text-foreground/70 hover:text-foreground"
                        >
                          {t("settingsPage.permissions.troubleshoot")}
                        </Button>
                      </SettingsRow>
                    </SettingsPanelRow>
                  </SettingsPanel>
                </div>
              )}
            </div>
          </div>
        );

      case "system":
        return (
          <div className="space-y-6">
            {/* Software Updates */}
            <div>
              <SectionHeader title={t("settingsPage.general.updates.title")} />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label={t("settingsPage.general.updates.currentVersion")}
                    description={
                      updateStatus.isDevelopment
                        ? t("settingsPage.general.updates.devMode")
                        : isUpdateAvailable
                          ? t("settingsPage.general.updates.newVersionAvailable")
                          : t("settingsPage.general.updates.latestVersion")
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs tabular-nums text-muted-foreground font-mono">
                        {currentVersion || t("settingsPage.general.updates.versionPlaceholder")}
                      </span>
                      {updateStatus.isDevelopment ? (
                        <Badge variant="warning">
                          {t("settingsPage.general.updates.badges.dev")}
                        </Badge>
                      ) : isUpdateAvailable ? (
                        <Badge variant="success">
                          {t("settingsPage.general.updates.badges.update")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t("settingsPage.general.updates.badges.latest")}
                        </Badge>
                      )}
                    </div>
                  </SettingsRow>
                </SettingsPanelRow>

                <SettingsPanelRow>
                  <div className="space-y-2.5">
                    <Button
                      onClick={async () => {
                        try {
                          const result = await checkForUpdates();
                          if (result && !result.updateAvailable) {
                            toast({
                              title: t("settingsPage.general.updates.dialogs.noUpdates.title"),
                              description: t(
                                "settingsPage.general.updates.dialogs.noUpdates.description"
                              ),
                            });
                          }
                        } catch {}
                      }}
                      disabled={checkingForUpdates || updateStatus.isDevelopment}
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      <RefreshCw
                        size={13}
                        className={`mr-1.5 ${checkingForUpdates ? "animate-spin" : ""}`}
                      />
                      {checkingForUpdates
                        ? t("settingsPage.general.updates.checking")
                        : t("settingsPage.general.updates.checkForUpdates")}
                    </Button>

                    {isUpdateAvailable && !updateStatus.updateDownloaded && (
                      <div className="space-y-2">
                        <Button
                          onClick={async () => {
                            try {
                              await downloadUpdate();
                            } catch {
                              showAlertDialog({
                                title: t(
                                  "settingsPage.general.updates.dialogs.downloadFailed.title"
                                ),
                                description: t(
                                  "settingsPage.general.updates.dialogs.downloadFailed.description"
                                ),
                              });
                            }
                          }}
                          disabled={downloadingUpdate}
                          variant="success"
                          className="w-full"
                          size="sm"
                        >
                          <Download
                            size={13}
                            className={`mr-1.5 ${downloadingUpdate ? "animate-pulse" : ""}`}
                          />
                          {downloadingUpdate
                            ? t("settingsPage.general.updates.downloading", {
                                progress: Math.round(updateDownloadProgress),
                              })
                            : t("settingsPage.general.updates.downloadUpdate", {
                                version: updateInfo?.version || "",
                              })}
                        </Button>

                        {downloadingUpdate && (
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
                            <div
                              className="h-full bg-success transition-[width] duration-200 rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, updateDownloadProgress))}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {updateStatus.updateDownloaded && (
                      <Button
                        onClick={() => {
                          showConfirmDialog({
                            title: t("settingsPage.general.updates.dialogs.installUpdate.title"),
                            description: t(
                              "settingsPage.general.updates.dialogs.installUpdate.description",
                              { version: updateInfo?.version || "" }
                            ),
                            confirmText: t(
                              "settingsPage.general.updates.dialogs.installUpdate.confirmText"
                            ),
                            onConfirm: async () => {
                              try {
                                await installUpdateAction();
                              } catch {
                                showAlertDialog({
                                  title: t(
                                    "settingsPage.general.updates.dialogs.installFailed.title"
                                  ),
                                  description: t(
                                    "settingsPage.general.updates.dialogs.installFailed.description"
                                  ),
                                });
                              }
                            },
                          });
                        }}
                        disabled={installInitiated}
                        className="w-full"
                        size="sm"
                      >
                        <RefreshCw
                          size={14}
                          className={`mr-2 ${installInitiated ? "animate-spin" : ""}`}
                        />
                        {installInitiated
                          ? t("settingsPage.general.updates.restarting")
                          : t("settingsPage.general.updates.installAndRestart")}
                      </Button>
                    )}
                  </div>

                  {updateInfo?.releaseNotes && (
                    <div className="mt-4 pt-4 border-t border-border/30">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {t("settingsPage.general.updates.whatsNew", {
                          version: updateInfo.version,
                        })}
                      </p>
                      <div
                        className="text-xs text-muted-foreground [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-1 [&_li]:pl-1 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_a]:text-link [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
                      />
                    </div>
                  )}
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Developer Tools */}
            <div className="border-t border-border/40 pt-6">
              <DeveloperSection />
            </div>

            {/* Data Management */}
            <div className="border-t border-border/40 pt-6">
              <SectionHeader
                title={t("settingsPage.developer.dataManagementTitle")}
                description={t("settingsPage.developer.dataManagementDescription")}
              />

              <div className="space-y-4">
                <SettingsPanel>
                  <SettingsPanelRow>
                    <SettingsRow
                      label={t("settingsPage.developer.modelCache")}
                      description={cachePathHint}
                    >
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.electronAPI?.openWhisperModelsFolder?.()}
                        >
                          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                          {t("settingsPage.developer.open")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveModels}
                          disabled={isRemovingModels}
                        >
                          {isRemovingModels
                            ? t("settingsPage.developer.removing")
                            : t("settingsPage.developer.clearCache")}
                        </Button>
                      </div>
                    </SettingsRow>
                  </SettingsPanelRow>
                </SettingsPanel>

                <SettingsPanel>
                  <SettingsPanelRow>
                    <SettingsRow
                      label={t("settingsPage.developer.resetAppData")}
                      description={t("settingsPage.developer.resetAppDataDescription")}
                    >
                      <Button
                        onClick={() => {
                          showConfirmDialog({
                            title: t("settingsPage.developer.resetAll.title"),
                            description: t("settingsPage.developer.resetAll.description"),
                            onConfirm: async () => {
                              try {
                                await window.electronAPI?.cleanupApp();
                                showAlertDialog({
                                  title: t("settingsPage.developer.resetAll.successTitle"),
                                  description: t(
                                    "settingsPage.developer.resetAll.successDescription"
                                  ),
                                });
                                setTimeout(() => {
                                  window.location.reload();
                                }, 1000);
                              } catch {
                                showAlertDialog({
                                  title: t("settingsPage.developer.resetAll.failedTitle"),
                                  description: t(
                                    "settingsPage.developer.resetAll.failedDescription"
                                  ),
                                });
                              }
                            },
                            variant: "destructive",
                            confirmText: t("settingsPage.developer.resetAll.confirmText"),
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
                      >
                        {t("common.reset")}
                      </Button>
                    </SettingsRow>
                  </SettingsPanelRow>
                </SettingsPanel>
              </div>
            </div>
          </div>
        );

      case "agentMode":
        return <AgentModeSettings />;

      default:
        return null;
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      {renderSectionContent()}
    </>
  );
}
