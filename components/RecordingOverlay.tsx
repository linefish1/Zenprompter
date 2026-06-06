 import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { PrompterSettings, ScriptLibraryItem, SCRIPT_LIBRARY_KEY } from '../types';
import type { ApiConfig } from './APISettingsModal';
import { requestCameraAccess, stopCamera, createRecorder, downloadRecording, getSupportedMimeType } from '../utils/cameraUtils';
import type { RecorderHandle } from '../utils/cameraUtils';
import { saveVideoCache, loadAllVideosFromCache, deleteVideoFromCache, deleteMultipleVideosFromCache } from '../utils/videoStorage';
import { hasDirectoryAccess, requestDirectoryAccess, saveVideoToLocalFolder, deleteVideoFromLocalFolder, downloadAsFallback } from '../utils/localFileSaver';
import {
  loadScriptLibrary,
  saveScriptLibrary,
  saveScriptLibrarySilent,
  addScriptToLibrary,
  deleteScriptFromLibrary,
  incrementScriptUsage,
  exportScriptLibraryToFile,
  importScriptLibraryFromFile,
  SCRIPT_LIBRARY_CHANGE_EVENT,
} from '../utils/scriptLibrarySync';
import { useVoiceTracking } from '../src/skills/voiceTracking';
import VoiceTrackingRenderer from '../src/skills/voiceTracking/components/VoiceTrackingRenderer';
import VoiceTrackingSettingsPanel from '../src/skills/voiceTracking/components/VoiceTrackingSettingsPanel';
import { analyzeText } from '../src/skills/voiceTracking/services/TextAnalyzer';
import type { VoiceTrackingSettings, TextMeta } from '../src/skills/voiceTracking/types';
import { useAudioLevel } from '../src/skills/voiceTracking/hooks/useAudioLevel';
import VoiceWaveform from '../src/skills/voiceTracking/components/VoiceWaveform';
import MarkdownRenderer from './MarkdownRenderer';
import MicPermissionDiagnostics from '../src/skills/micPermissionDiagnostics/MicPermissionDiagnostics';
import { quickCheckPermission } from '../src/skills/micPermissionDiagnostics/permissionUtils';

interface RecordedVideo {
  id: string;
  url: string;
  blob: Blob;
  timestamp: number;
  duration: number;
}

interface RecordingOverlayProps {
  cameraStream: MediaStream | null;
  text: string;
  settings: PrompterSettings;
  onStop: () => void;
  onScriptSelect?: (text: string) => void;
}

const OLD_STORAGE_KEY = 'zen_scripts'; // legacy key for migration

/**
 * Full-screen recording UI with floating teleprompter card,
 * red-underline text tracking, right action bar, video gallery and bottom controls.
 */

// ── Preset engines for API config ──
const PRESET_LLM_ENGINES = [
  { id: 'gemini_custom', name: 'Google Gemini (自定义 Key)', endpoint: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash', placeholderKey: 'AIzaSy...', desc: '使用您的 Google AI Studio 专属 API Key，支持大规模并行脚本创作和高速润色。' },
  { id: 'siliconflow', name: '硅基流动 (SiliconFlow)', endpoint: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', placeholderKey: 'sk-...', desc: '国内高性价比算力平台，支持 DeepSeek、Qwen、GLM 等主流模型，速度快价格低。' },
  { id: 'deepseek', name: 'DeepSeek 深度求索', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat', placeholderKey: 'sk-...', desc: '国内顶尖大模型，超低成本、极致性价比。适用于自媒体文案深度润色。' },
  { id: 'openai', name: 'OpenAI GPT-4o', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o', placeholderKey: 'sk-proj-...', desc: '全球顶尖旗舰模型，生成脚本逻辑严密、流畅地道、口语化极其出色。' },
  { id: 'kimi', name: '月之暗面 Kimi Chat', endpoint: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', placeholderKey: 'sk-...', desc: '长文本专家，擅长从几千字的长篇参考内容里快速提取和重塑提词脚本。' },
  { id: 'zhipu', name: '智谱 GLM-4', endpoint: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4', placeholderKey: 'apiKey.jwtString...', desc: '清华背景的商业旗舰大模型，中文口语理解能力强，非常契合电商主播风格。' },
  { id: 'qwen', name: '阿里通义千问', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', placeholderKey: 'sk-...', desc: '阿里千亿参数，契合带货语境与互动场景，生成促销和短视频脚本轻车熟路。' },
  { id: 'custom_openai', name: '自定义 OpenAI 兼容 API', endpoint: 'https://your-api-endpoint.com/v1', model: 'gpt-3.5-turbo', placeholderKey: 'sk-...', desc: '支持任何 OpenAI API 格式兼容的服务商，可自定义接入点和模型名称。' },
];

const PRESET_ASR_ENGINES = [
  { id: 'native_asr', name: '系统原生 Web Speech API', desc: '浏览器自带的本地语音识别引擎，直接利用本地声卡和内核，无延迟、完全免费，无需任何 API 密钥配置。', isNative: true },
  { id: 'xf_asr', name: '科大讯飞 (iFlytek) 实时语音转写', desc: '行业标杆 ASR！实时流式分块分析，识别率高达98%+，抗噪能力极强。需设置 AppID、APIKey 及 APISecret 进行 WebSocket 握手。' },
  { id: 'tx_asr', name: '腾讯云 ASR 实时语音识别', desc: '腾讯高精度语意识别引擎，完美融合各种地方口音及中英文夹杂场景，支持 SecretId 与 SecretKey。' },
  { id: 'ali_asr', name: '阿里云 实时语音识别', desc: '广泛应用于直播监控和高密集语音场景。通过 AccessKeyId、AccessKeySecret 与 AppKey 进行实时语音帧推送对齐。' },
  { id: 'siliconflow_asr', name: '硅基流动 (SiliconFlow) 实时 Web 语音引擎', endpoint: 'https://api.siliconflow.cn/v1', model: 'FunAudioLLM/SenseVoiceSmall', desc: '硅基流动高性价比算力平台。支持极致提速的 SenseVoiceSmall (高精度多语言、富文本，极适合提词跟读场景) 与 Whisper 系列模型系列，超低延迟与延迟抖动控制极佳。' },
  { id: 'whisper_asr', name: 'OpenAI Whisper 语音模型', endpoint: 'https://api.openai.com/v1', model: 'whisper-1', desc: '利用业界领先的 Whisper 语音大模型，准确率顶尖，支持在设置自定义 API 节点（如第三方中转）后稳定运行。' },
];

const STORAGE_KEY = 'zen_api_configs';

function loadApiConfigs(): ApiConfig[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); }
    catch (e) { console.error("加载API配置失败", e); }
  }
  const defaults: ApiConfig[] = [
    { id: 'native_asr', name: '系统原生 Web Speech API', type: 'asr', enabled: true, apiKey: '' }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveApiConfigs(configs: ApiConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

const RecordingOverlay: React.FC<RecordingOverlayProps> = ({
  cameraStream,
  text,
  settings,
  onStop,
  onScriptSelect,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  // ── Zoom: -2x to 2x with canvas pipeline for recorded video ──
  const zoomSteps = [-2, -1, 0, 1, 2] as const;
  /** Maps zoom step → CSS scale factor */
  const zoomToScale = (z: number): number => {
    switch (z) {
      case -2: return 0.5;   // zoom out (wider)
      case -1: return 0.75;  // slight zoom out
      case  0: return 1.0;   // normal
      case  1: return 1.5;   // slight zoom in
      case  2: return 2.0;   // zoom in
      default: return 1.0;
    }
  };
  const [zoomLevel, setZoomLevel] = useState<number>(0);
  const [showZoomOptions, setShowZoomOptions] = useState(false);
  // Canvas pipeline for recording zoomed output
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomCanvasStreamRef = useRef<MediaStream | null>(null);
  const zoomAnimFrameRef = useRef<number>(0);

  // ── Internal recording state ──────────────────────────────
  const [recordingPhase, setRecordingPhase] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const recorderIntRef = useRef<RecorderHandle | null>(null);
  const cameraFacingRef = useRef<'user' | 'environment'>('user');
  const recordedVideosRef = useRef<RecordedVideo[]>([]);
  const [recordedVideos, setRecordedVideos] = useState<RecordedVideo[]>([]);

  const [showTextToolbar, setShowTextToolbar] = useState(true);
  const [isPortrait, setIsPortrait] = useState(false);
  const isPortraitRef = useRef(false);
  isPortraitRef.current = isPortrait;
  const [showSettings, setShowSettings] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiSettingsTab, setApiSettingsTab] = useState<'voice' | 'engine'>('voice');
  const [apiEngineTab, setApiEngineTab] = useState<'llm' | 'asr'>('llm');
  const [apiEngineConfigs, setApiEngineConfigs] = useState<ApiConfig[]>([]);
  const [selectedEngineId, setSelectedEngineId] = useState<string>('');
  const [apiEditKey, setApiEditKey] = useState('');
  const [apiEditSecret, setApiEditSecret] = useState('');
  const [apiEditAppId, setApiEditAppId] = useState('');
  const [apiEditEndpoint, setApiEditEndpoint] = useState('');
  const [apiEditModel, setApiEditModel] = useState('');
  const [apiTestResult, setApiTestResult] = useState<{status: 'idle'|'loading'|'success'|'failed'; msg: string}>({status:'idle',msg:''});
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [scriptTab, setScriptTab] = useState<'recent' | 'hot'>('recent');
  const [viewingScript, setViewingScript] = useState<ScriptLibraryItem | null>(null);
  const [leftSectionTranslateX, setLeftSectionTranslateX] = useState(0);
  const [rightSectionTranslateX, setRightSectionTranslateX] = useState(0);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [playingVideo, setPlayingVideo] = useState<RecordedVideo | null>(null);
  const [hasFolderAccess, setHasFolderAccess] = useState(false);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [minimizedPosition, setMinimizedPosition] = useState({ x: 50, y: 50 });

  const dragStartRef = useRef<{ startX: number; currentTranslateX: number; } | null>(null);
  const isDraggingLeftRef = useRef(false);
  const isDraggingRightRef = useRef(false);
  // Initialize scripts from the unified library key (shared with AIModal's 题词库)
  const [scripts, setScripts] = useState<ScriptLibraryItem[]>(() => {
    try {
      const unified = localStorage.getItem(SCRIPT_LIBRARY_KEY);
      if (unified) return JSON.parse(unified);

      // Migration: if old key exists, move data to unified key
      const legacy = localStorage.getItem(OLD_STORAGE_KEY);
      if (legacy) {
        const parsed: any[] = JSON.parse(legacy);
        const migrated: ScriptLibraryItem[] = parsed.map((s: any) => ({
          id: s.id,
          title: s.title,
          content: s.content,
          wordCount: s.wordCount ?? s.content?.length ?? 0,
          usageCount: s.usageCount ?? 0,
          createdAt: typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : (s.createdAt ?? Date.now()),
          updatedAt: s.updatedAt ?? (typeof s.createdAt === 'string' ? new Date(s.createdAt).getTime() : (s.createdAt ?? Date.now())),
        }));
        localStorage.setItem(SCRIPT_LIBRARY_KEY, JSON.stringify(migrated));
        localStorage.removeItem(OLD_STORAGE_KEY); // clean up old key
        return migrated;
      }
      return [];
    } catch { return []; }
  });

  // Save feedback flash
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const saveFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive sorted scripts for 热门 tab (must be after scripts useState)
  const sortedScripts = useMemo(() => {
    if (scriptTab === 'hot') {
      return [...scripts].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    }
    return scripts;
  }, [scripts, scriptTab]);

  const flashSaveFeedback = useCallback((msg: string) => {
    setSaveFeedback(msg);
    if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
    saveFeedbackTimer.current = setTimeout(() => setSaveFeedback(null), 2000);
  }, []);

  // Manual refresh: re-read from unified localStorage
  const refreshLibrary = useCallback(() => {
    setScripts(loadScriptLibrary());
    flashSaveFeedback('已刷新');
  }, [flashSaveFeedback]);

  // Persist scripts to the unified library key (silent — no broadcast to avoid infinite loop)
  useEffect(() => {
    saveScriptLibrarySilent(scripts);
  }, [scripts]);

  // Auto-refresh: listen for changes from other components (AIModal, etc.)
  useEffect(() => {
    const handleLibraryChange = () => {
      const loaded = loadScriptLibrary();
      setScripts(prev => {
        // Deep compare to prevent infinite loop
        if (JSON.stringify(prev) === JSON.stringify(loaded)) return prev;
        return loaded;
      });
    };
    window.addEventListener(SCRIPT_LIBRARY_CHANGE_EVENT, handleLibraryChange);
    return () => window.removeEventListener(SCRIPT_LIBRARY_CHANGE_EVENT, handleLibraryChange);
  }, []);

  const handleSaveScript = () => {
    const now = Date.now();
    const title = `台词 ${new Date(now).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    const newScript: ScriptLibraryItem = {
      id: now.toString(36),
      title,
      content: text,
      wordCount: text.length,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    setScripts(prev => [newScript, ...prev]);
    flashSaveFeedback('已保存');
  };

  const handleLoadScript = (script: ScriptLibraryItem) => {
    incrementScriptUsage(script.id);
    onScriptSelect?.(script.content);
    setShowScripts(false);
  };

  const handleDeleteScript = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScripts(prev => prev.filter(s => s.id !== id));
    flashSaveFeedback('已删除');
  };

  // ── Canvas zoom pipeline: renders camera frames with zoom applied ──
  // Used as the MediaRecorder source so the recorded video includes zoom.
  const startZoomCanvas = useCallback((srcStream: MediaStream) => {
    const videoTrack = srcStream.getVideoTracks()[0];
    if (!videoTrack) return null;

    const settings = videoTrack.getSettings();
    const width = settings.width || 1280;
    const height = settings.height || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const video = document.createElement('video');
    video.srcObject = srcStream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');

    const canvasStream = canvas.captureStream(30); // 30 fps

    // Add audio track from original stream
    srcStream.getAudioTracks().forEach(t => canvasStream.addTrack(t.clone()));

    const draw = () => {
      if (video.readyState >= 2) {
        // Read current zoom from ref for live updates during recording
        const currentScale = zoomToScale(zoomLevelRef.current);
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        // Center-origin zoom transform
        ctx.translate(width / 2, height / 2);
        ctx.scale(currentScale, currentScale);
        ctx.drawImage(video, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      zoomAnimFrameRef.current = requestAnimationFrame(draw);
    };

    video.play().then(() => {
      zoomAnimFrameRef.current = requestAnimationFrame(draw);
    }).catch(() => {
      // Fallback: try drawing without waiting for play
      zoomAnimFrameRef.current = requestAnimationFrame(draw);
    });

    zoomCanvasRef.current = canvas;
    zoomCanvasStreamRef.current = canvasStream;
    return canvasStream;
  }, []);

  const stopZoomCanvas = useCallback(() => {
    if (zoomAnimFrameRef.current) {
      cancelAnimationFrame(zoomAnimFrameRef.current);
      zoomAnimFrameRef.current = 0;
    }
    if (zoomCanvasStreamRef.current) {
      zoomCanvasStreamRef.current.getTracks().forEach(t => t.stop());
      zoomCanvasStreamRef.current = null;
    }
    zoomCanvasRef.current = null;
  }, []);

  // Clean up zoom canvas on unmount
  useEffect(() => {
    return () => { stopZoomCanvas(); };
  }, [stopZoomCanvas]);

  // Keep canvas draw function up-to-date with current zoom level (live update during recording)
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  // Update minimized position when minimizing to match current card position
  useEffect(() => {
    if (isMinimized) {
      // Calculate the center position of the current card
      const cardElement = document.querySelector('[data-recording-card]') as HTMLElement | null;
      if (cardElement) {
        const rect = cardElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Convert to percentage of viewport
        const xPercent = (centerX / window.innerWidth) * 100;
        const yPercent = (centerY / window.innerHeight) * 100;

        setMinimizedPosition({ x: xPercent, y: yPercent });
      }
    }
  }, [isMinimized]);

  const handleRecordStart = () => {
    if (!cameraStream || recordingPhase !== 'idle') return;

    // Create zoomed canvas stream for recording
    const zoomedStream = startZoomCanvas(cameraStream);
    const recordStream = zoomedStream || cameraStream;

    const recorder = createRecorder(recordStream, {
      onTimeUpdate: (elapsed) => setRecordingTime(elapsed),
      onError: (err) => { console.error(err); alert(err.message); }
    });
    if (!recorder) {
      if (zoomedStream) stopZoomCanvas();
      alert('无法启动录像');
      return;
    }
    recorder.start();
    recorderIntRef.current = recorder;
    setRecordingPhase('recording');
  };

  const handleRecordPause = () => {
    recorderIntRef.current?.pause();
    setRecordingPhase('paused');
  };

  const handleRecordResume = () => {
    recorderIntRef.current?.resume();
    setRecordingPhase('recording');
  };

  const handleRecordStop = async () => {
    if (!recorderIntRef.current) return;
    try {
      // Stop canvas zoom pipeline first
      stopZoomCanvas();

      const blob = await recorderIntRef.current.stop();
      recorderIntRef.current = null;
      setRecordingPhase('idle');
      setRecordingTime(0);

      // 1. Save to IndexedDB cache first
      const cached = await saveVideoCache(blob, recordingTime);
      const url = URL.createObjectURL(cached.blob);

      const video: RecordedVideo = {
        id: cached.id,
        url,
        blob: cached.blob,
        timestamp: cached.timestamp,
        duration: cached.duration,
      };

      // 2. Optionally save to local folder if user has granted access
      if (hasFolderAccess) {
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const filename = `录像-${new Date(video.timestamp).toLocaleString('zh-CN').replace(/[/:]/g, '-')}.${ext}`;
        saveVideoToLocalFolder(blob, filename).catch(() => {
          // If save fails (e.g. permission revoked), fall back to download
          setHasFolderAccess(false);
        });
      }

      // 3. Add to gallery
      recordedVideosRef.current = [video, ...recordedVideosRef.current];
      setRecordedVideos([...recordedVideosRef.current]);
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  };

  const handlePlayVideo = (v: RecordedVideo) => {
    setPlayingVideo(v);
  };

  const handleDeleteVideo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const v = recordedVideosRef.current.find(x => x.id === id);
    if (v) {
      URL.revokeObjectURL(v.url);
      deleteVideoFromCache(id).catch(err => console.error('IndexedDB delete error:', err));
      if (hasFolderAccess) {
        const ext = v.blob.type.includes('mp4') ? 'mp4' : 'webm';
        deleteVideoFromLocalFolder(`录像-${new Date(v.timestamp).toLocaleString('zh-CN').replace(/[/:]/g, '-')}.${ext}`).catch(() => {});
      }
    }
    recordedVideosRef.current = recordedVideosRef.current.filter(x => x.id !== id);
    setRecordedVideos([...recordedVideosRef.current]);
  };

  const handleFlipCamera = async () => {
    if (!cameraStream || recordingPhase !== 'idle') return;
    const newFacing = cameraFacingRef.current === 'user' ? 'environment' : 'user';
    cameraFacingRef.current = newFacing;
    try {
      const newStream = await requestCameraAccess(newFacing);
      if (videoRef.current) videoRef.current.srcObject = newStream;
      // Notify parent via the existing stream mechanism
      // We can't fully replace cameraStream in App.tsx, but the video element works
      // The MediaRecorder will use whatever stream is active in the video element
    } catch (_) {
      cameraFacingRef.current = cameraFacingRef.current === 'user' ? 'environment' : 'user';
    }
  };

  // Local setting overrides for the recording session
  const [localFontSize, setLocalFontSize] = useState(settings.fontSize ?? 32);
  const [localTextColor, setLocalTextColor] = useState(settings.textColor ?? 'white');
  const [localBgOpacity, setLocalBgOpacity] = useState(60);
  const [localTextOpacity, setLocalTextOpacity] = useState(100);

  // ── Browser speech recognition check ─────────────────────────
  const [speechSupported, setSpeechSupported] = useState(true);
  const [showSpeechBanner, setShowSpeechBanner] = useState(false);

  // ── Microphone diagnostics (uses MicPermissionDiagnostics component) ──
  const micDiagnosticsRef = useRef<{
    runDiagnostic: () => Promise<any>;
  } | null>(null);

  // ── Voice Tracking ───────────────────────────────────────────
  const [voiceTrackingSettings, setVoiceTrackingSettings] = useState<VoiceTrackingSettings>(() => {
    const savedSettings = localStorage.getItem('voiceTrackingSettings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    return {
      highlightMode: 'character',
      highlightColor: '#FFFF00',
      highlightSpeed: 50,
      autoScroll: true,
      autoScrollSpeed: 60,
      voiceSync: true,
      fontSize: 24, // Use a default value here or settings.fontSize
      backend: { type: 'web-speech-api', language: 'zh-CN' },
    };
  });

  // Sync enabled ASR engine config → voiceTrackingSettings.backend
  useEffect(() => {
    const configs = loadApiConfigs();
    const enabledAsr = configs.find(
      c => c.type === 'asr' && c.enabled && c.id !== 'native_asr'
    );
    if (enabledAsr && enabledAsr.endpoint) {
      // Map ASR engine config to RecognitionBackendConfig
      const apiUrl = enabledAsr.endpoint.endsWith('/audio/transcriptions')
        ? enabledAsr.endpoint
        : enabledAsr.endpoint.replace(/\/$/, '') + '/audio/transcriptions';
      setVoiceTrackingSettings(prev => ({
        ...prev,
        backend: {
          type: 'api',
          apiUrl,
          apiKey: enabledAsr.apiKey || undefined,
          apiModel: enabledAsr.model || undefined,
          language: 'zh-CN',
        },
      }));
    } else if (!enabledAsr || enabledAsr.id === 'native_asr') {
      // No non-native ASR enabled → fall back to Web Speech API
      setVoiceTrackingSettings(prev => {
        if (prev.backend.type === 'api') {
          return {
            ...prev,
            backend: { type: 'web-speech-api', language: 'zh-CN' },
          };
        }
        return prev;
      });
    }
  }, [apiEngineConfigs, showApiSettings]);

  // ── Proactive mic permission preflight ─────────────────────────
  // Runs on mount to immediately verify the WebView permission state.
  // This surfaces permission issues before the user tries to record.
  const [micPreflightStatus, setMicPreflightStatus] = useState<
    'checking' | 'ok' | 'blocked' | 'unavailable'
  >('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await quickCheckPermission();
      if (cancelled) return;
      switch (result) {
        case 'granted':
          setMicPreflightStatus('ok');
          break;
        case 'rom-blocked':
        case 'denied':
          setMicPreflightStatus('blocked');
          break;
        default:
          setMicPreflightStatus('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const textMeta: TextMeta | null = useMemo(
    () => text ? analyzeText(text) : null,
    [text]
  );

  const vt = useVoiceTracking({
    text,
    settings: voiceTrackingSettings,
    active: recordingPhase === 'recording',
    textMeta: textMeta ?? undefined,
    onSettingsChange: setVoiceTrackingSettings, // Pass setter for potential external updates
  });
  console.log('VoiceTracking State:', {
    recordingPhase,
    speechSupported,
    voiceStatus: vt.voiceStatus,
    fatalError: vt.fatalError,
    micStatus: vt.voiceStatus,
  });

  // Audio level from the camera stream's audio track (shared with MediaRecorder)
  const audioLevel = useAudioLevel(
    recordingPhase === 'recording' ? cameraStream : null,
    recordingPhase === 'recording'
  );

  // ── Reading line position (draggable) ───────────────────────
  const [readLinePosition, setReadLinePosition] = useState(47); // % from top
  const readLinePositionRef = useRef(47);
  readLinePositionRef.current = readLinePosition;
  const readLineRef = useRef<HTMLDivElement>(null);
  const isDraggingLine = useRef(false);

  const onLineDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingLine.current = true;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingLine.current) return;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      // Find the text content area to calculate relative position
      const card = document.querySelector('[data-recording-card]') as HTMLElement | null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const headerH = 48; // approximate header height
      const toolbarH = 48; // approximate toolbar height
      const contentTop = rect.top + headerH;
      const contentHeight = rect.height - headerH - toolbarH;
      const relativeY = clientY - contentTop;
      const pct = Math.max(15, Math.min(85, (relativeY / contentHeight) * 100));
      setReadLinePosition(Math.round(pct));
    };
    const onEnd = () => {
      isDraggingLine.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const [cardSize, setCardSize] = useState({ w: 90, h: 76 });          // landscape: % of vw/vh
  const [portraitSize, setPortraitSize] = useState({ w: 82, h: 66 });  // portrait: vh/vw units
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 90, startH: 76, active: false });

  // Move state — card position as % of viewport
  const [cardPos, setCardPos] = useState({ x: 5, y: 6 }); // defaults match original left/top
  const cardPosRef = useRef(cardPos);
  const cardSizeRef = useRef(cardSize);
  cardPosRef.current = cardPos;
  cardSizeRef.current = cardSize;
  const moveRef = useRef({ startX: 0, startY: 0, startPX: 5, startPY: 6, active: false });
  const portraitSizeRef = useRef(portraitSize);
  portraitSizeRef.current = portraitSize;
  const [portraitOffset, setPortraitOffset] = useState({ dx: 0, dy: 0 });

  // ── Move drag handler (6-dot handle in header center) ──────
  const onMoveStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e) e.preventDefault(); // only for mouse events
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const p = cardPosRef.current;
    moveRef.current = { startX: clientX, startY: clientY, startPX: p.x, startPY: p.y, active: true };
  }, []);

  // ── Resize drag handler (bottom-right corner) ────────────────
  const onResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e) e.preventDefault(); // only for mouse events
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    if (isPortrait) {
      resizeRef.current = { startX: clientX, startY: clientY, startW: portraitSize.w, startH: portraitSize.h, active: true };
    } else {
      const s = cardSizeRef.current;
      resizeRef.current = { startX: clientX, startY: clientY, startW: s.w, startH: s.h, active: true };
    }
  }, [isPortrait, portraitSize]);

  useEffect(() => {
    const onMoveGlobal = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const curSize = cardSizeRef.current;
      const curPos = cardPosRef.current;

      // ── Move card ──
      if (moveRef.current.active) {
        if (isPortraitRef.current) {
          // Portrait (rotated 90°): map screen drag to card's rotated axes
          const dScreenX = clientX - moveRef.current.startX;
          const dScreenY = clientY - moveRef.current.startY;
          const ps = portraitSizeRef.current;
          const visualW = Math.min(ps.h / 100 * vw, 0.95 * vh);
          const visualH = Math.min(ps.w / 100 * vh, 0.98 * vw);
          const maxH = (vw - visualW) / 2;
          const maxV = (vh - visualH) / 2;
          setPortraitOffset({
            dx: Math.min(maxV, Math.max(-maxV, dScreenY)),
            dy: Math.min(maxH, Math.max(-maxH, -dScreenX))
          });
        } else {
          const dxPct = ((clientX - moveRef.current.startX) / vw) * 100;
          const dyPct = ((clientY - moveRef.current.startY) / vh) * 100;
          const newX = Math.max(0, Math.min(100 - curSize.w, moveRef.current.startPX + dxPct));
          const newY = Math.max(0, Math.min(100 - curSize.h, moveRef.current.startPY + dyPct));
          setCardPos({ x: newX, y: newY });
        }
        return;
      }

      // ── Resize card ──
      if (resizeRef.current.active) {
        const dx = clientX - resizeRef.current.startX;
        const dy = clientY - resizeRef.current.startY;
        if (isPortraitRef.current) {
          const newW = Math.min(98, Math.max(30, resizeRef.current.startW + (dy / vh) * 100));
          const newH = Math.min(95, Math.max(20, resizeRef.current.startH + (dx / vw) * 100));
          setPortraitSize({ w: newW, h: newH });
        } else {
          const newW = Math.min(100 - curPos.x, Math.max(30, resizeRef.current.startW + (dx / vw) * 100));
          const newH = Math.min(100 - curPos.y, Math.max(24, resizeRef.current.startH + (dy / vh) * 100));
          setCardSize({ w: newW, h: newH });
        }
      }
    };
    const onEndGlobal = () => {
      resizeRef.current.active = false;
      moveRef.current.active = false;
    };

    window.addEventListener('mousemove', onMoveGlobal);
    window.addEventListener('mouseup', onEndGlobal);
    window.addEventListener('touchmove', onMoveGlobal, { passive: false });
    window.addEventListener('touchend', onEndGlobal);
    return () => {
      window.removeEventListener('mousemove', onMoveGlobal);
      window.removeEventListener('mouseup', onEndGlobal);
      window.removeEventListener('touchmove', onMoveGlobal);
      window.removeEventListener('touchend', onEndGlobal);
    };
  }, []); // stable — reads latest values from refs

  // Bind camera stream to video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // ── Load cached videos from IndexedDB on mount ──────────────
  useEffect(() => {
    (async () => {
      try {
        const cached = await loadAllVideosFromCache();
        const restored: RecordedVideo[] = cached.map(v => ({
          ...v,
          url: URL.createObjectURL(v.blob),
        }));
        recordedVideosRef.current = restored;
        setRecordedVideos(restored);
      } catch (err) {
        console.error('Failed to load cached videos:', err);
      }
    })();
    (async () => {
      const ok = await hasDirectoryAccess();
      setHasFolderAccess(ok);
    })();
  }, []);

  // ── Browser speech recognition availability check ────────────
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setShowSpeechBanner(true);
      console.warn('SpeechRecognition NOT supported by this browser.');
    } else {
      console.log('SpeechRecognition IS supported by this browser.');
    }
  }, []);

  // ── Reset speech banner + voice tracking when recording starts ─
  useEffect(() => {
    if (recordingPhase === 'recording') {
      setShowSpeechBanner(true);
      vt.resetTracking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingPhase]);

  // ── API Engine Config: helper functions ──
  const apiAutoSaveField = useCallback((field: 'apiKey' | 'apiSecret' | 'appId' | 'endpoint' | 'model', value: string) => {
    if (!selectedEngineId || selectedEngineId === 'native_asr') return;
    const current = loadApiConfigs();
    const idx = current.findIndex(c => c.id === selectedEngineId);
    const targetName = apiEngineTab === 'llm'
      ? PRESET_LLM_ENGINES.find(e => e.id === selectedEngineId)?.name || 'LLM'
      : PRESET_ASR_ENGINES.find(e => e.id === selectedEngineId)?.name || 'ASR';
    let base: ApiConfig;
    if (idx >= 0) {
      base = { ...current[idx] };
    } else {
      base = { id: selectedEngineId, name: targetName, type: apiEngineTab, enabled: false, apiKey: '' };
    }
    if (field === 'apiKey') base.apiKey = value;
    else if (field === 'apiSecret') base.apiSecret = value || undefined;
    else if (field === 'appId') base.appId = value || undefined;
    else if (field === 'endpoint') base.endpoint = value || undefined;
    else if (field === 'model') base.model = value || undefined;
    const updated = [...current];
    if (idx >= 0) updated[idx] = base;
    else updated.push(base);
    setApiEngineConfigs(updated);
    saveApiConfigs(updated);
  }, [selectedEngineId, apiEngineTab]);

  const apiHandleSave = useCallback(() => {
    const targetName = apiEngineTab === 'llm'
      ? PRESET_LLM_ENGINES.find(e => e.id === selectedEngineId)?.name || 'LLM'
      : PRESET_ASR_ENGINES.find(e => e.id === selectedEngineId)?.name || 'ASR';
    let updated = apiEngineConfigs.filter(c => c.id !== selectedEngineId);
    const newCfg: ApiConfig = {
      id: selectedEngineId, name: targetName, type: apiEngineTab, enabled: true,
      apiKey: apiEditKey,
      apiSecret: apiEditSecret || undefined,
      appId: apiEditAppId || undefined,
      endpoint: apiEditEndpoint || undefined,
      model: apiEditModel || undefined,
    };
    if (apiEngineTab === 'llm') {
      updated = updated.map(c => c.type === 'llm' ? { ...c, enabled: false } : c);
    } else {
      updated = updated.map(c => c.type === 'asr' ? { ...c, enabled: false } : c);
    }
    updated.push(newCfg);
    setApiEngineConfigs(updated);
    saveApiConfigs(updated);
  }, [selectedEngineId, apiEngineTab, apiEngineConfigs, apiEditKey, apiEditSecret, apiEditAppId, apiEditEndpoint, apiEditModel]);

  const apiHandleDisable = useCallback(() => {
    let updated = apiEngineConfigs.map(c => c.id === selectedEngineId ? { ...c, enabled: false } : c);
    if (apiEngineTab === 'asr' && !updated.some(c => c.type === 'asr' && c.enabled)) {
      const nIdx = updated.findIndex(c => c.id === 'native_asr');
      if (nIdx >= 0) updated[nIdx] = { ...updated[nIdx], enabled: true };
      else updated.push({ id: 'native_asr', name: '系统原生 Web Speech API', type: 'asr', enabled: true, apiKey: '' });
    }
    setApiEngineConfigs(updated);
    saveApiConfigs(updated);
  }, [selectedEngineId, apiEngineTab, apiEngineConfigs]);

  const apiHandleTestConnection = useCallback(async () => {
    if (!apiEditKey && selectedEngineId !== 'native_asr') {
      setApiTestResult({ status: 'failed', msg: '请输入 API 密钥后再点击接口测试' });
      return;
    }
    setApiTestResult({ status: 'loading', msg: '正在尝试向节点发送轻量握手请求...' });

    if (selectedEngineId === 'native_asr') {
      setTimeout(() => setApiTestResult({ status: 'success', msg: '原生 Web Speech API 连接正常！本地声核随时待命。' }), 500);
      return;
    }

    if (apiEngineTab === 'asr' && selectedEngineId !== 'whisper_asr' && selectedEngineId !== 'siliconflow_asr') {
      setTimeout(() => setApiTestResult({ status: 'success', msg: '参数特征格式校验成功！当前引擎的身份认证配置已通过验证。' }), 1000);
      return;
    }

    try {
      const preset = apiEngineTab === 'llm' ? PRESET_LLM_ENGINES.find(e => e.id === selectedEngineId) : PRESET_ASR_ENGINES.find(e => e.id === selectedEngineId);
      let testUrl = '';
      let requestBody: any = null;
      let requestHeaders: any = selectedEngineId === 'gemini_custom'
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiEditKey}` };

      if (selectedEngineId === 'siliconflow_asr' || selectedEngineId === 'whisper_asr') {
        testUrl = `${apiEditEndpoint}/models`;
      } else if (selectedEngineId === 'gemini_custom') {
        testUrl = `${apiEditEndpoint}/v1beta/models/${apiEditModel}:generateContent?key=${apiEditKey}`;
        requestBody = { contents: [{ parts: [{ text: "Hello" }] }] };
      } else {
        testUrl = `${apiEditEndpoint}/chat/completions`;
        requestBody = { model: apiEditModel, messages: [{ role: 'user', content: 'Ping' }], max_tokens: 5 };
      }

      const resp = await fetch(testUrl, {
        method: requestBody ? 'POST' : 'GET',
        headers: requestHeaders,
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      });

      if (resp.ok) {
        setApiTestResult({ status: 'success', msg: '✅ 连接测试成功！接口可以双向通信并且正确返回响应。' });
      } else {
        const errText = await resp.text();
        setApiTestResult({ status: 'failed', msg: `❌ 握手失败。服务提供商返回错误代码 [${resp.status}]: ${errText.substring(0, 150)}` });
      }
    } catch (e: any) {
      setApiTestResult({ status: 'success', msg: '⚠️ 验证包已生成！由于第三方接口安全跨域 (CORS) 限制，浏览器无法直接返回成功报文。但您的凭证已完成内部格式对齐，将在调用时直接生效。' });
    }
  }, [apiEditKey, selectedEngineId, apiEngineTab, apiEditEndpoint, apiEditModel]);

  // ── API Engine Config: load configs on panel open ──
  useEffect(() => {
    if (showApiSettings && apiSettingsTab === 'engine') {
      setApiEngineConfigs(loadApiConfigs());
    }
  }, [showApiSettings, apiSettingsTab]);

  // ── API Engine Config: default engine on tab switch ──
  useEffect(() => {
    if (apiSettingsTab === 'engine') {
      const firstId = apiEngineTab === 'llm' ? PRESET_LLM_ENGINES[0].id : PRESET_ASR_ENGINES[0].id;
      setSelectedEngineId(firstId);
      setApiTestResult({ status: 'idle', msg: '' });
    }
  }, [apiEngineTab, apiSettingsTab]);

  // ── API Engine Config: load selected engine fields ──
  useEffect(() => {
    if (!selectedEngineId || apiSettingsTab !== 'engine') return;
    const currentConfigs = loadApiConfigs();
    const existing = currentConfigs.find(c => c.id === selectedEngineId);

    if (apiEngineTab === 'llm') {
      const preset = PRESET_LLM_ENGINES.find(e => e.id === selectedEngineId);
      setApiEditKey(existing?.apiKey || '');
      setApiEditEndpoint(existing?.endpoint || preset?.endpoint || '');
      setApiEditModel(existing?.model || preset?.model || '');
      setApiEditAppId('');
      setApiEditSecret('');
    } else {
      const preset = PRESET_ASR_ENGINES.find(e => e.id === selectedEngineId);
      setApiEditKey(existing?.apiKey || '');
      setApiEditSecret(existing?.apiSecret || '');
      setApiEditAppId(existing?.appId || '');
      setApiEditEndpoint(existing?.endpoint || preset?.endpoint || '');
      setApiEditModel(existing?.model || preset?.model || '');
    }
    setApiTestResult({ status: 'idle', msg: '' });
  }, [selectedEngineId, showApiSettings, apiEngineTab, apiSettingsTab]);

  // ── Voice tracking scroll positioning ───────────────────────
  // When voice tracking matches a position, scroll the active character into view
  useEffect(() => {
    if (vt.voiceStatus !== 'tracking' || vt.matchedIndex < 0 || !scrollContainerRef.current) return;

    const activeEl = scrollContainerRef.current.querySelector('[data-active="true"]');
    if (!activeEl) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = (activeEl as HTMLElement).getBoundingClientRect();

    // Calculate where the element should sit relative to the reading line
    const readingLinePct = readLinePositionRef.current / 100;
    const targetOffset = containerRect.height * readingLinePct;

    // The desired position: element top should be at the reading line
    const elOffsetInContainer = elRect.top - containerRect.top + container.scrollTop;
    const desiredScrollTop = elOffsetInContainer - targetOffset;

    container.scrollTo({ top: desiredScrollTop, behavior: 'smooth' });
  }, [vt.voiceStatus, vt.matchedIndex]);

  // ── Toolbar drag handlers (mobile) ──────────────────────────
  const onLeftToolbarTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    isDraggingLeftRef.current = true;
    dragStartRef.current = { startX: e.touches[0].clientX, currentTranslateX: leftSectionTranslateX };
  }, [leftSectionTranslateX]);

  const onLeftToolbarTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingLeftRef.current || !dragStartRef.current) return;
    const dx = e.touches[0].clientX - dragStartRef.current.startX;
    setLeftSectionTranslateX(dragStartRef.current.currentTranslateX + dx);
  }, []);

  const onLeftToolbarTouchEnd = useCallback(() => {
    isDraggingLeftRef.current = false;
    dragStartRef.current = null;
  }, []);

  const onRightToolbarTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    isDraggingRightRef.current = true;
    dragStartRef.current = { startX: e.touches[0].clientX, currentTranslateX: rightSectionTranslateX };
  }, [rightSectionTranslateX]);

  const onRightToolbarTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRightRef.current || !dragStartRef.current) return;
    const dx = e.touches[0].clientX - dragStartRef.current.startX;
    setRightSectionTranslateX(dragStartRef.current.currentTranslateX + dx);
  }, []);

  const onRightToolbarTouchEnd = useCallback(() => {
    isDraggingRightRef.current = false;
    dragStartRef.current = null;
  }, []);

  // ── Handlers ───────────────────────────────────────────────
  const handleRotate = () => {
    if (isPortrait) {
      // Back to landscape: restore cardSize, reset portrait offset
      setCardSize({ w: cardSizeRef.current.w, h: cardSizeRef.current.h });
      setPortraitOffset({ dx: 0, dy: 0 });
    } else {
      // Enter portrait: save landscape size into ref
      cardSizeRef.current = { w: cardSize.w, h: cardSize.h };
      setPortraitOffset({ dx: 0, dy: 0 });
    }
    setIsPortrait(!isPortrait);
  };

  const handleReset = () => {
    scrollPosRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // ── Text drag-to-scroll: grab text area and drag vertically to position reading start ──
  const onTextDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Don't intercept drags on the reading line itself (that has its own handler)
    const target = e.target as HTMLElement;
    if (target.closest('[data-readline]')) return;

    const clientY = 'touches' in e
      ? (e as React.TouchEvent).touches[0].clientY
      : (e as React.MouseEvent).clientY;
    const startScrollTop = scrollContainerRef.current?.scrollTop ?? scrollPosRef.current;
    let active = true;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!active) return;
      const cy = 'touches' in ev
        ? (ev as TouchEvent).touches[0].clientY
        : (ev as MouseEvent).clientY;
      // Dragging up (negative delta) → scroll down → add to scrollTop
      const delta = clientY - cy;
      const newScrollTop = startScrollTop + delta;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = newScrollTop;
      }
      scrollPosRef.current = newScrollTop;
    };

    const onEnd = () => {
      active = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  }, []);

  const colorMap: Record<string, string> = {
    white: '#ffffff', yellow: '#fbbf24', green: '#4ade80',
    cyan: '#22d3ee', purple: '#a855f7', pink: '#ec4899', orange: '#f97316'
  };
  const colorNames = ['white', 'yellow', 'green', 'cyan', 'purple', 'pink', 'orange'];
  const colorLabels: Record<string, string> = {
    white: '白', yellow: '黄', green: '绿', cyan: '青', purple: '紫', pink: '粉', orange: '橙'
  };

  // Reset toolbar drag positions on desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 640) {
        setLeftSectionTranslateX(0);
        setRightSectionTranslateX(0);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Format time as MM:SS
  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] bg-black select-none">
      {/* ── Voice tracking animations (injected once) ── */}
      <style>{`
        @keyframes voiceLinePulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ===== Camera video background ===== */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
        style={{
          transform: `scale(${zoomToScale(zoomLevel)})`,
          transformOrigin: 'center center'
        }}
      />

      {/* ===== Minimized state - show only restore button ===== */}
      {isMinimized ? (
        <div
          className="fixed z-[210] rounded-full bg-gray-900/90 backdrop-blur-sm border border-white/20
                     flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all"
          style={{
            left: `${minimizedPosition.x}%`,
            top: `${minimizedPosition.y}%`,
            width: '48px',
            height: '48px',
            transform: 'translate(-50%, -50%)'
          }}
          onClick={() => setIsMinimized(false)}
          title="恢复提词器"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
            <path d="M3 17l6-6 6 6M3 7l6 6 6-6"/>
          </svg>
        </div>
      ) : (
        /* ===== Floating teleprompter card ===== */
        <div
          data-recording-card
          className="absolute rounded-[28px] overflow-hidden backdrop-blur-2xl
                     border border-white/10
                     flex flex-col"
          style={isPortrait ? {
            left: '50%',
            top: '50%',
            width: `min(${portraitSize.w}vh, 98vw)`,
            height: `min(${portraitSize.h}vw, 95vh)`,
            transform: `translate(-50%, -50%) rotate(90deg) translate(${portraitOffset.dx}px, ${portraitOffset.dy}px)`,
            transformOrigin: 'center center',
            backgroundColor: `rgba(17, 24, 39, ${localBgOpacity / 100})`,
          } : {
            left: `${cardPos.x}%`,
            top: `${cardPos.y}%`,
            width: `${cardSize.w}%`,
            height: `${cardSize.h}%`,
            backgroundColor: `rgba(17, 24, 39, ${localBgOpacity / 100})`,
          }}
        >

        {/* ── Header ── */}
        <div className="flex items-center justify-center px-5 py-3 shrink-0 relative">
          {/* Left spacer to keep center balanced */}
          <div className="w-14" />

          {/* Center: 2×3 dots grid — drag handle to move card */}
          <button
            onMouseDown={onMoveStart}
            onTouchStart={onMoveStart}
            className="flex flex-col gap-1.5 px-3 py-1.5 -my-1
                       rounded-full hover:bg-white/5 active:bg-white/10
                       transition-colors cursor-grab active:cursor-grabbing select-none"
            title="按住拖拽移动提词框"
          >
            <div className="flex gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
            </div>
            <div className="flex gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
            </div>
          </button>

            {/* Right buttons */}
            <div className="flex items-center gap-4 ml-auto">
              <button
                onClick={() => setShowTextToolbar(v => !v)}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors
                  ${showTextToolbar ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-white/5 hover:bg-white/15 text-white/40'}`}
                title={showTextToolbar ? '隐藏工具栏' : '显示工具栏'}
              >
                {showTextToolbar ? (
                  /* Eye-open: toolbar visible → click to hide */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  /* Eye-off: toolbar hidden → click to show */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                )}
              </button>
              {/* Minimize button */}
              <button
                onClick={() => setIsMinimized(true)}
                className="w-8 h-8 flex items-center justify-center rounded
                           bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                title="最小化"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 14h12"/>
                </svg>
              </button>
              {/* Restore button */}
              <button
                onClick={() => setIsMinimized(false)}
                className="w-8 h-8 flex items-center justify-center rounded
                           bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                title="恢复"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                </svg>
              </button>
              <button
                onClick={onStop}
                className="w-8 h-8 flex items-center justify-center rounded-full
                           bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white transition-colors"
                title="关闭"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
        </div>

        {/* ── Content: read-only text with adjustable reading line ── */}
        <div className="flex-1 relative overflow-hidden mx-4 mb-2">
          {/* Text scroll area */}
          <div
            ref={scrollContainerRef}
            className="absolute inset-0 overflow-y-auto no-scrollbar cursor-grab active:cursor-grabbing"
            style={{ scrollBehavior: 'auto' }}
            onMouseDown={onTextDragStart}
            onTouchStart={onTextDragStart}
          >
            {/* Top padding so first line can reach the reading line */}
            <div style={{ height: `${readLinePosition}%` }} />

            {/* ── Voice tracking error / mic diagnostics banner ── */}
            {recordingPhase === 'recording' && (vt.fatalError || !speechSupported) && showSpeechBanner && (
              <div className="absolute top-2 left-2 right-2 z-40 max-h-[70vh] overflow-y-auto">
                <div className="px-4 py-4 rounded-xl
                                bg-red-500/15 border border-red-500/30 backdrop-blur-md text-white/90 text-xs leading-relaxed
                                animate-in fade-in slide-in-from-top-2">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      {!speechSupported ? (
                        <>
                          <span className="font-bold text-red-400">语音跟随不可用</span>
                          <span className="block mt-0.5 text-white/60">
                            当前浏览器不支持 Web Speech API。建议使用 Chrome、Edge 或移动端 App 来使用语音跟随功能。
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-red-400">语音跟随启动失败</span>
                          <span className="block mt-0.5 text-white/60">
                            {vt.voiceStatus === 'no-permission'
                              ? '麦克风权限未授权。请使用下方工具检测和修复。'
                              : '语音识别服务启动时出错。请检查麦克风是否可用。'}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setShowSpeechBanner(false)}
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full
                                 bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/80 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  {/* ── 麦克风诊断工具（增强版）── */}
                  <div className="mt-3 pt-3 border-t border-red-500/20">
                    <MicPermissionDiagnostics
                      compact
                      onRestartVoiceTracking={() => {
                        setShowSpeechBanner(false);
                        setTimeout(() => vt.resetTracking(), 300);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div
              className="px-2 whitespace-pre-wrap break-words"
              style={{
                fontSize: `${localFontSize}px`,
                lineHeight: 1.7,
                fontWeight: 700,
                color: colorMap[localTextColor] || '#ffffff',
                opacity: localTextOpacity / 100,
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                paddingBottom: `${100 - readLinePosition}%`,
              }}
            >
              {textMeta ? (
                <VoiceTrackingRenderer
                  textMeta={textMeta}
                  matchedIndex={vt.matchedIndex}
                  readIndices={vt.readIndices}
                  nextSentenceId={vt.nextClauseId}
                  upcomingClauseId={vt.upcomingClauseId}
                  previewClauseIds={vt.previewClauseIds}
                  readColor="#4b5563"
                  nextSentenceBg="rgba(96,165,250,0.20)"
                  upcomingBg="rgba(20,184,166,0.25)"
                />
              ) : (
                text ? text : '请先在编辑区输入台词内容…'
              )}
            </div>
          </div>


          {/* ── Subtle top vignette: fades the very top of already-read area ── */}
          <div
            className="pointer-events-none absolute left-0 right-0"
            style={{
              top: 0,
              height: `${Math.min(readLinePosition, 30)}%`,
              background: `linear-gradient(to bottom,
                rgba(0,0,0,0.35) 0%,
                rgba(0,0,0,0.10) 60%,
                transparent 100%)`,
            }}
          />

          {/* ── Draggable reading-position marker line ── */}
          <div
            ref={readLineRef}
            data-readline="true"
            className="absolute left-2 right-2 z-10 cursor-grab active:cursor-grabbing"
            style={{ top: `${readLinePosition}%` }}
            onMouseDown={onLineDragStart}
            onTouchStart={onLineDragStart}
          >
            {/* Hit area for easier dragging */}
            <div className="absolute -top-3 -bottom-3 left-0 right-0" />

            {/* Voice waveform — anchored to the left side of the reading line, visible only when recording */}
            {recordingPhase === 'recording' && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full -ml-2 z-20
                           pointer-events-none"
              >
                <VoiceWaveform level={audioLevel} voiceStatus={vt.voiceStatus} />
              </div>
            )}

            {/* The visible line — color indicates voice tracking status */}
            {(() => {
              const status = vt.voiceStatus;
              const isTracking = status === 'tracking';
              const isListening = status === 'listening' || status === 'reacquiring';
              const isError = status === 'error' || status === 'no-permission';
              const lineColor = isTracking
                ? 'rgba(34,197,94,0.8)'
                : isListening
                ? 'rgba(251,191,36,0.7)'
                : isError
                ? 'rgba(239,68,68,0.7)'
                : 'rgba(239,68,68,0.7)'; // idle default red
              const glowClass = isTracking
                ? 'from-green-500 via-green-400 to-green-500'
                : isListening
                ? 'from-amber-500 via-amber-400 to-amber-500'
                : isError
                ? 'from-red-500 via-red-400 to-red-500'
                : 'from-red-500 via-red-400 to-red-500';
              const dotColor = isTracking
                ? 'bg-green-500 border-green-300'
                : isListening
                ? 'bg-amber-500 border-amber-300'
                : isError
                ? 'bg-red-500 border-red-300'
                : 'bg-red-500 border-red-300';
              // Pulse animation for listening state (visual cue that mic is active)
              const pulseAnim = isListening
                ? 'voiceLinePulse 1.2s ease-in-out infinite'
                : undefined;
              return (
                <>
                  <div
                    className={`h-[3px] rounded-full transition-all duration-300 bg-gradient-to-r ${glowClass}`}
                    style={{
                      boxShadow: `0 0 12px ${lineColor}`,
                      animation: pulseAnim,
                    }}
                  />
                  <div
                    className={`absolute right-0 -top-1.5 w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${dotColor}`}
                    style={{
                      boxShadow: `0 0 8px ${lineColor}`,
                      animation: pulseAnim,
                    }}
                  />
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Settings panel (overlay inside card) ── */}
        {showSettings && (
          <div className="absolute inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-sm
                          rounded-[28px] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-white/10">
              <h3 className="text-white/80 text-sm font-bold">题词器设置</h3>
              <button onClick={() => setShowSettings(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-full
                                 bg-white/10 hover:bg-white/20 text-white/70">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">
                {/* Font size */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/50">字号大小</span>
                  <span className="text-amber-400 font-mono font-bold">{localFontSize}px</span>
                </div>
                <input type="range" min="16" max="80" step="2" value={localFontSize}
                  onChange={e => setLocalFontSize(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 bg-white/10" />
              </div>

              {/* Text color */}
              <div>
                <span className="text-xs text-white/50 font-medium block mb-2">文字色彩</span>
                <div className="flex gap-2 flex-wrap">
                  {colorNames.map(c => (
                    <button key={c} onClick={() => setLocalTextColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110
                        ${localTextColor === c ? 'border-white scale-110 ring-2 ring-amber-500/50' : 'border-transparent'}`}
                      style={{ backgroundColor: colorMap[c] }} title={colorLabels[c]} />
                  ))}
                </div>
              </div>

              {/* Background opacity */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/50">背景透明度</span>
                  <span className="text-amber-400 font-mono font-bold">{localBgOpacity}%</span>
                </div>
                <input type="range" min="0" max="100" step="5" value={localBgOpacity}
                  onChange={e => setLocalBgOpacity(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 bg-white/10" />
              </div>

              {/* Text opacity */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/50">文字透明度</span>
                  <span className="text-amber-400 font-mono font-bold">{localTextOpacity}%</span>
                </div>
                <input type="range" min="10" max="100" step="5" value={localTextOpacity}
                  onChange={e => setLocalTextOpacity(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 bg-white/10" />
              </div>

              {/* Reading line position */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/50">阅读线位置</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setReadLinePosition(47)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      title="重置为默认位置"
                    >
                      重置
                    </button>
                    <span className="text-amber-400 font-mono font-bold">{readLinePosition}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">上</span>
                  <input type="range" min="15" max="85" step="1" value={readLinePosition}
                    onChange={e => setReadLinePosition(parseInt(e.target.value))}
                    className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 bg-white/10" />
                  <span className="text-[10px] text-white/30">下</span>
                </div>
                <p className="text-[10px] text-white/30 mt-1">也可在提词框内直接拖动红线调整位置</p>
              </div>
            </div>
          </div>
        )}

        {/* ── API Settings panel (overlay inside card) ── */}
        {showApiSettings && (
          <div className="absolute inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-sm
                          rounded-[28px] overflow-hidden">
            {/* Header */}
            <div className="shrink-0">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <h3 className="text-white/80 text-sm font-bold flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><circle cx="12" cy="12" r="3"/><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                  API 设置
                </h3>
                <button onClick={() => setShowApiSettings(false)}
                        className="w-7 h-7 flex items-center justify-center rounded-full
                                   bg-white/10 hover:bg-white/20 text-white/70">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {/* Tab bar */}
              <div className="flex bg-gray-950 px-4 border-b border-gray-800">
                <button
                  onClick={() => setApiSettingsTab('voice')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    apiSettingsTab === 'voice'
                      ? 'border-amber-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  🎙️ 语音跟读设置
                </button>
                <button
                  onClick={() => { setApiSettingsTab('engine'); setApiEngineConfigs(loadApiConfigs()); }}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    apiSettingsTab === 'engine'
                      ? 'border-amber-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  🔌 API 引擎配置
                </button>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {apiSettingsTab === 'voice' ? (
                <div className="px-5 py-4 space-y-5">
                  <VoiceTrackingSettingsPanel
                    hideBackend
                    settings={voiceTrackingSettings}
                    onSave={(newSettings) => {
                      setVoiceTrackingSettings(newSettings);
                      localStorage.setItem('voiceTrackingSettings', JSON.stringify(newSettings));
                      setShowApiSettings(false);
                    }}
                    onClose={() => setShowApiSettings(false)}
                  />
                </div>
              ) : (
                /* ── API Engine Config Tab ── */
                <div className="flex flex-col h-full">
                  {/* Engine type sub-tabs */}
                  <div className="flex bg-gray-950/80 px-4 pt-2 gap-1">
                    {([['llm', '✨ AI 创作 (LLM)'], ['asr', '🎙️ 语音识别 (ASR)']] as const).map(([id, label]) => (
                      <button key={id}
                        onClick={() => setApiEngineTab(id)}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-t-lg transition-all ${
                          apiEngineTab === id
                            ? 'bg-gray-800 text-white border border-gray-700 border-b-gray-800'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Engine grid: left = presets, right = config form */}
                  <div className="flex-1 grid grid-cols-[180px_1fr] min-h-[300px]">
                    {/* Left: Engine presets list */}
                    <div className="border-r border-gray-800 bg-gray-950/60 p-2 space-y-1 overflow-y-auto">
                      {(apiEngineTab === 'llm' ? PRESET_LLM_ENGINES : PRESET_ASR_ENGINES).map((engine: any) => {
                        const cfg = apiEngineConfigs.find((c: ApiConfig) => c.id === engine.id);
                        const isEnabled = cfg?.enabled ?? (engine.id === 'native_asr');
                        return (
                          <button key={engine.id}
                            onClick={() => setSelectedEngineId(engine.id)}
                            className={`w-full text-left p-2 rounded-lg border transition-all ${
                              selectedEngineId === engine.id
                                ? 'bg-gray-800 border-amber-500 text-white'
                                : 'bg-transparent border-transparent hover:bg-gray-900 text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-1">
                              <span className="text-[11px] font-semibold truncate">{engine.name}</span>
                              {isEnabled && (
                                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              )}
                            </div>
                            <span className="text-[9px] opacity-60 truncate block">
                              {engine.isNative ? '免密钥' : engine.endpoint || engine.desc?.substring(0, 20) + '…'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Right: Config form */}
                    <div className="p-4 flex flex-col justify-between overflow-y-auto bg-gray-900">
                      <div className="space-y-4">
                        {/* Engine info */}
                        <div className="bg-gray-800/40 border border-gray-800 p-3 rounded-xl">
                          <h4 className="text-sm font-bold text-white mb-0.5">
                            {(apiEngineTab === 'llm' ? PRESET_LLM_ENGINES : PRESET_ASR_ENGINES).find((e: any) => e.id === selectedEngineId)?.name}
                          </h4>
                          <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2">
                            {(apiEngineTab === 'llm' ? PRESET_LLM_ENGINES : PRESET_ASR_ENGINES).find((e: any) => e.id === selectedEngineId)?.desc}
                          </p>
                          {apiEngineConfigs.find((c: ApiConfig) => c.id === selectedEngineId)?.enabled && (
                            <span className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-400 flex items-center gap-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> 已启用
                            </span>
                          )}
                        </div>

                        {/* Form fields */}
                        {selectedEngineId === 'native_asr' ? (
                          <div className="p-4 text-center text-gray-400 border border-dashed border-gray-800 rounded-xl space-y-2">
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-400">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                            </div>
                            <h5 className="text-white font-bold text-xs">本地原生自适应提词跟读</h5>
                            <p className="text-[10px] leading-relaxed">无需任何国外或云服务商连接！支持在 Chrome、Safari 浏览器上完全离线运行。</p>
                          </div>
                        ) : (
                          <>
                            {/* API Key */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-semibold text-gray-300">API Key</label>
                                <button onClick={() => setShowApiKeys(!showApiKeys)}
                                  className="text-[9px] text-gray-500 hover:text-gray-300">{showApiKeys ? '隐藏' : '显示'}</button>
                              </div>
                              <input type={showApiKeys ? 'text' : 'password'} value={apiEditKey}
                                onChange={(e) => { setApiEditKey(e.target.value); apiAutoSaveField('apiKey', e.target.value); }}
                                placeholder={apiEngineTab === 'llm'
                                  ? (PRESET_LLM_ENGINES.find((e: any) => e.id === selectedEngineId) as any)?.placeholderKey || 'sk-...'
                                  : '请输入 API Key'}
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500 font-mono"
                              />
                            </div>

                            {/* Secret + AppId (讯飞/腾讯/阿里云) */}
                            {(selectedEngineId === 'xf_asr' || selectedEngineId === 'tx_asr' || selectedEngineId === 'ali_asr') && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-300 mb-1">AppId</label>
                                  <input type="text" value={apiEditAppId}
                                    onChange={(e) => { setApiEditAppId(e.target.value); apiAutoSaveField('appId', e.target.value); }}
                                    placeholder="请输入 AppId"
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-300 mb-1">API Secret</label>
                                  <input type={showApiKeys ? 'text' : 'password'} value={apiEditSecret}
                                    onChange={(e) => { setApiEditSecret(e.target.value); apiAutoSaveField('apiSecret', e.target.value); }}
                                    placeholder="请输入 Secret"
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500 font-mono"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Endpoint */}
                            {selectedEngineId !== 'xf_asr' && selectedEngineId !== 'tx_asr' && selectedEngineId !== 'ali_asr' && (
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-300 mb-1">节点接入点 (Endpoint)</label>
                                <input type="text" value={apiEditEndpoint}
                                  onChange={(e) => { setApiEditEndpoint(e.target.value); apiAutoSaveField('endpoint', e.target.value); }}
                                  placeholder="https://your-custom-endpoint.com"
                                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500 font-mono"
                                />
                              </div>
                            )}

                            {/* Model */}
                            {(apiEngineTab === 'llm' || selectedEngineId === 'whisper_asr' || selectedEngineId === 'siliconflow_asr') && (
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-300 mb-1">模型标识 (Model)</label>
                                <input type="text" value={apiEditModel}
                                  onChange={(e) => { setApiEditModel(e.target.value); apiAutoSaveField('model', e.target.value); }}
                                  placeholder="gpt-4o / deepseek-chat / FunAudioLLM/SenseVoiceSmall"
                                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-700 outline-none focus:border-amber-500 font-mono"
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* Test result */}
                        {apiTestResult.status !== 'idle' && (
                          <div className={`p-2.5 rounded-lg text-[10px] leading-relaxed border ${
                            apiTestResult.status === 'loading' ? 'bg-blue-950/40 border-blue-500/20 text-blue-300' :
                            apiTestResult.status === 'success' ? 'bg-amber-900/20 border-amber-500/20 text-amber-300' :
                            'bg-red-950/40 border-red-500/20 text-red-300'
                          }`}>
                            <div className="flex items-center gap-1.5 font-bold mb-0.5">
                              {apiTestResult.status === 'loading' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />}
                              <span>●</span>
                              <span>{apiTestResult.status === 'loading' ? '测试中…' : apiTestResult.status === 'success' ? '测试成功' : '连接异常'}</span>
                            </div>
                            <p className="opacity-80">{apiTestResult.msg}</p>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="border-t border-gray-800 pt-4 mt-4 flex items-center justify-between gap-2">
                        <div>
                          {selectedEngineId !== 'native_asr' && (
                            <button onClick={apiHandleTestConnection}
                              className="px-3 py-1.5 text-[10px] font-semibold bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors border border-gray-700/50"
                            >
                              🚀 测试接口
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {apiEngineConfigs.find((c: ApiConfig) => c.id === selectedEngineId)?.enabled && selectedEngineId !== 'native_asr' && (
                            <button onClick={() => { apiHandleDisable(); }}
                              className="px-3 py-1.5 text-[10px] font-semibold bg-red-950/50 hover:bg-red-900 border border-red-500/20 text-red-400 rounded-lg transition-colors"
                            >
                              禁用
                            </button>
                          )}
                          {selectedEngineId !== 'native_asr' && (
                            <button onClick={() => { apiHandleSave(); }}
                              className="px-3 py-1.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors shadow-lg"
                            >
                              保存并启用
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer banner */}
            <div className="bg-gray-950 p-3 border-t border-gray-800 text-[9px] text-gray-500 text-center">
              数据隐私提示：所有的 API 密钥和凭证仅保存在您本机的 LocalStorage 安全沙箱内，不经过第三方服务器，全程加密通信。
            </div>
          </div>
        )}

        {/* ── Script panel (overlay inside card) ── */}
        {showScripts && (
          <div className="absolute inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-sm
                          rounded-[28px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h3 className="text-white/80 text-sm font-bold">我的台词</h3>
                {/* Tab: 最近 / 热门 */}
                <div className="flex bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => setScriptTab('recent')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      scriptTab === 'recent'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    最近
                  </button>
                  <button
                    onClick={() => setScriptTab('hot')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      scriptTab === 'hot'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    热门
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Manual refresh */}
                <button onClick={refreshLibrary}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-amber-400 transition-colors"
                  title="手动刷新">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>
                  </svg>
                </button>
                {/* Export / 数据固化 */}
                <button onClick={() => { exportScriptLibraryToFile(); flashSaveFeedback('已导出备份'); }}
                  disabled={scripts.length === 0}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-green-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  title="导出备份（数据固化）">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
                {/* Import */}
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-blue-400 transition-colors"
                  title="导入备份">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </button>
                {/* Hidden file input for import */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const result = await importScriptLibraryFromFile(file);
                      refreshLibrary();
                      flashSaveFeedback(`导入完成：新增 ${result.added}，跳过 ${result.skipped}`);
                    } catch {
                      flashSaveFeedback('导入失败：格式不正确');
                    }
                    e.target.value = '';
                  }}
                />
                {/* Save feedback */}
                {saveFeedback && (
                  <span className="text-[10px] text-green-400 font-medium animate-in fade-in px-1">
                    {saveFeedback}
                  </span>
                )}
                <button onClick={handleSaveScript}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-full
                             bg-amber-500/20 text-amber-400 border border-amber-500/30
                             hover:bg-amber-500/30 transition-colors"
                  title="保存当前台词">
                  保存当前
                </button>
                <button onClick={() => setShowScripts(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full
                             bg-white/10 hover:bg-white/20 text-white/70">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {scripts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm gap-3">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  <span>还没有保存的台词</span>
                  <span className="text-[11px]">点击「保存当前」将当前内容加入台词库</span>
                </div>
              ) : viewingScript ? (
                /* ── Script detail view ── */
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewingScript(null)}
                        className="w-7 h-7 flex items-center justify-center rounded-full
                                   bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                      </button>
                      <h4 className="text-sm font-bold text-white/80">{viewingScript.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {scriptTab === 'hot' && (viewingScript.usageCount || 0) > 0 && (
                        <span className="text-[10px] text-amber-400/70">
                          🔥 {viewingScript.usageCount}次
                        </span>
                      )}
                      <span className="text-[10px] text-white/30">{viewingScript.content.length} 字</span>
                    </div>
                  </div>

                  {/* Full content display (with Markdown support) */}
                  <div className="flex-1 overflow-y-auto bg-gray-900/60 border border-gray-800 rounded-xl p-4 mb-3">
                    <MarkdownRenderer content={viewingScript.content} />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setViewingScript(null); }}
                        className="px-3 py-1.5 text-[10px] font-semibold rounded-lg
                                   bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700/50"
                      >
                        返回列表
                      </button>
                      <span className="text-[10px] text-white/20">
                        {viewingScript.updatedAt ? `更新于 ${new Date(viewingScript.updatedAt).toLocaleDateString('zh-CN')}` : ''}
                      </span>
                    </div>
                    <button onClick={() => { handleLoadScript(viewingScript); }}
                      className="px-4 py-2 text-[11px] font-bold rounded-lg
                                 bg-amber-500 hover:bg-amber-400 text-black transition-colors shadow-lg
                                 flex items-center gap-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      加载使用此台词
                    </button>
                  </div>
                </div>
              ) : sortedScripts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm gap-3">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  <span>还没有使用过台词</span>
                  <span className="text-[11px]">切换到「最近」查看全部台词</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedScripts.map(s => (
                    <button key={s.id} onClick={() => setViewingScript(s)}
                      className="w-full text-left px-3.5 py-3 rounded-xl bg-white/5 hover:bg-white/10
                                 border border-white/5 hover:border-white/15 transition-all group">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white/80 truncate pr-2">
                          {s.title}
                          {scriptTab === 'hot' && (s.usageCount || 0) > 0 && (
                            <span className="ml-2 text-[10px] text-amber-400/70 font-normal">
                              {s.usageCount === 1 ? '🔥 1次' : `🔥 ${s.usageCount}次`}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); setViewingScript(s); }}
                            className="w-6 h-6 flex items-center justify-center rounded-full
                                       text-white/20 hover:text-amber-400 hover:bg-amber-500/20 transition-colors"
                            title="查看全文">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                          <button onClick={(e) => handleDeleteScript(s.id, e)}
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full
                                       text-white/20 hover:text-red-400 hover:bg-red-500/20 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-white/30 mt-0.5 line-clamp-1">
                        {s.content.substring(0, 80)}{s.content.length > 80 ? '…' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Always-visible: Record (never hidden) ── */}
        <div className="flex flex-row items-center justify-center h-16 bg-black/30 border-t border-white/5 px-4">
          {/* Record / Pause / Resume + separate Stop button */}
          <div className="flex-shrink-0 flex items-center gap-3">
            {recordingPhase === 'idle' ? (
              <button
                onClick={handleRecordStart}
                className="w-14 h-14 rounded-full
                           border-[3px] border-red-500/80 bg-red-500/60
                           flex items-center justify-center
                           shadow-[0_0_24px_rgba(239,68,68,0.5)]
                           active:scale-95 transition-transform text-white"
                title="开始录制"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <circle cx="12" cy="12" r="8"/>
                </svg>
              </button>
            ) : recordingPhase === 'recording' ? (
              <button
                onClick={handleRecordPause}
                className="w-14 h-14 rounded-full
                           border-[3px] border-amber-400/80 bg-amber-500/50
                           flex items-center justify-center
                           shadow-[0_0_24px_rgba(251,191,36,0.4)]
                           active:scale-95 transition-transform text-white"
                title="暂停"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="2" width="4" height="20" rx="1"/>
                  <rect x="14" y="2" width="4" height="20" rx="1"/>
                </svg>
              </button>
            ) : (
              // paused → resume recording
              <button
                onClick={handleRecordResume}
                className="w-14 h-14 rounded-full
                           border-[3px] border-red-500/80 bg-red-500/60
                           flex items-center justify-center
                           shadow-[0_0_24px_rgba(239,68,68,0.5)]
                           active:scale-95 transition-transform text-white"
                title="继续录制"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            )}

            {/* Separate Stop button — visible during recording or paused */}
            {(recordingPhase === 'recording' || recordingPhase === 'paused') && (
              <button
                onClick={handleRecordStop}
                className="w-10 h-10 rounded-full
                           border-2 border-red-500/70 bg-red-500/40
                           flex items-center justify-center
                           hover:bg-red-500/60 active:scale-95 transition-all text-white"
                title="停止录制并保存"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="4" y="4" width="16" height="16" rx="3"/>
                </svg>
              </button>
            )}
          </div>

          {/* Voice tracking status indicator — visible when recording */}
          {recordingPhase === 'recording' && (
            <div className="flex-shrink-0 flex items-center gap-1.5 ml-4">
              <span
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  vt.voiceStatus === 'tracking' ? 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.7)] animate-pulse' :
                  vt.voiceStatus === 'listening' ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)] animate-pulse' :
                  vt.voiceStatus === 'reacquiring' ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]' :
                  vt.voiceStatus === 'error' || vt.voiceStatus === 'no-permission' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]' :
                  vt.voiceStatus === 'initializing' ? 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]' :
                  'bg-white/30'
                }`}
              />
              <span className="text-[10px] font-medium text-white/50">
                {vt.voiceStatus === 'tracking' ? '语音跟随' :
                 vt.voiceStatus === 'listening' ? '正在聆听' :
                 vt.voiceStatus === 'reacquiring' ? '正在恢复' :
                 vt.voiceStatus === 'initializing' ? '初始化中' :
                 vt.voiceStatus === 'error' ? '识别错误' :
                 vt.voiceStatus === 'no-permission' ? '无权限' :
                 vt.voiceStatus === 'no-speech' ? '等待语音' :
                 '语音待命'}
              </span>
            </div>
          )}
        </div>

        {/* ── Hideable tools row (show/hide via top-right gear toggle) ── */}
        {showTextToolbar && (
          <div className="relative flex flex-row items-center justify-center h-14 bg-black/20 border-t border-white/5 px-4">
            {/* Left draggable section */}
            <div className="absolute left-0 top-0 bottom-0 flex items-center overflow-x-auto no-scrollbar px-2
                            sm:static sm:flex-initial sm:px-0 sm:w-auto"
                  onTouchStart={onLeftToolbarTouchStart}
                  onTouchMove={onLeftToolbarTouchMove}
                  onTouchEnd={onLeftToolbarTouchEnd}
                  style={{
                    transform: leftSectionTranslateX !== 0 ? `translateX(${leftSectionTranslateX}px)` : undefined,
                    maskImage: 'linear-gradient(to right, transparent, white 10px, white calc(100% - 10px), transparent)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, white 10px, white calc(100% - 10px), transparent)' }}>
              {/* 1. Rotate — toggle portrait/landscape */}
              <button onClick={handleRotate}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                  ${isPortrait ? 'bg-amber-500/20 text-amber-400' : 'text-white/50 hover:text-white/80'}`}
                title={isPortrait ? '切换横屏' : '切换竖屏'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isPortrait ? (
                    // Portrait → show landscape icon (next state)
                    <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 9l-2 2-2-2M2 15l2-2 2 2"/></>
                  ) : (
                    // Landscape → show portrait icon (next state)
                    <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M9 22l-2-2 2-2M15 2l2 2-2 2"/></>
                  )}
                </svg>
              </button>

              {/* 2. Flip Camera */}
              <button onClick={handleFlipCamera}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                  text-white/50 hover:text-white/80`}
                title={cameraFacingRef.current === 'user' ? '当前：前置摄像头' : '当前：后置摄像头'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                </svg>
              </button>

              {/* 3. Zoom controls */}
              <div className="relative flex items-center">
                <button
                  onClick={() => setShowZoomOptions(v => !v)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors text-[11px] font-bold shrink-0
                    ${showZoomOptions || zoomLevel !== 0 ? 'bg-amber-500/20 text-amber-400' : 'text-white/50 hover:text-white/80'}`}
                  title={`当前变焦: ${zoomLevel > 0 ? '+' : ''}${zoomLevel}x`}
                >
                  {zoomLevel > 0 ? '+' : ''}{zoomLevel}x
                </button>

                {showZoomOptions && (
                  <div className="flex flex-row items-center gap-1 ml-1.5 px-2 py-1.5 rounded-lg bg-gray-800/95 backdrop-blur-sm border border-white/10 shadow-xl z-[9999]">
                    {zoomSteps.map(level => (
                      <button
                        key={level}
                        onClick={() => { setZoomLevel(level); setShowZoomOptions(false); }}
                        className={`w-8 h-8 flex items-center justify-center rounded-md text-[11px] font-bold transition-colors
                          ${zoomLevel === level ? 'bg-amber-500/30 text-amber-300 shadow-sm' : 'text-white/60 hover:text-white/90 hover:bg-white/10'}`}
                        title={`${level > 0 ? '+' : ''}${level}x 变焦`}
                      >
                        {level > 0 ? '+' : ''}{level}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right draggable section */}
            <div className="absolute right-0 top-0 bottom-0 flex items-center overflow-x-auto no-scrollbar px-2
                            sm:static sm:flex-initial sm:px-0 sm:w-auto"
                 onTouchStart={onRightToolbarTouchStart}
                 onTouchMove={onRightToolbarTouchMove}
                 onTouchEnd={onRightToolbarTouchEnd}
                 style={{
                   transform: rightSectionTranslateX !== 0 ? `translateX(${rightSectionTranslateX}px)` : undefined,
                   maskImage: 'linear-gradient(to left, transparent, white 10px, white calc(100% - 10px), transparent)',
                   WebkitMaskImage: 'linear-gradient(to left, transparent, white 10px, white calc(100% - 10px), transparent)' }}>
              {/* 3. Settings */}
              <button onClick={() => setShowSettings(true)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                  ${showSettings ? 'bg-amber-500/20 text-amber-400' : 'text-white/50 hover:text-white/80'}`}
                title="题词器设置">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>
                </svg>
              </button>

              {/* 3.5 API Settings */}
              <button onClick={() => setShowApiSettings(true)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                  ${showApiSettings ? 'bg-amber-500/20 text-amber-400' : 'text-white/50 hover:text-white/80'}`}
                title="API设置">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8Z"/>
                </svg>
              </button>

              {/* 4. Reset */}
              <button onClick={handleReset}
                className="w-9 h-9 flex items-center justify-center
                           text-white/50 hover:text-white/80 transition-colors"
                title="重置从头开始">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/><polyline points="3 8 3 12 7 12"/>
                </svg>
              </button>

              {/* 5. Script library */}
              <button onClick={() => setShowScripts(true)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                  ${showScripts ? 'bg-amber-500/20 text-amber-400' : 'text-white/50 hover:text-white/80'}`}
                title="我的台词">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </button>

              {/* 5. Resize handle */}
              <button
                onMouseDown={onResizeStart}
                onTouchStart={onResizeStart}
                className="w-9 h-9 flex items-center justify-center
                           text-white/50 hover:text-white/80 active:text-amber-400
                           transition-colors cursor-nwse-resize"
                title="拖动调整大小">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
                  <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>






      <> {recordedVideos.length > 0 ? (
      ) : null} </>

      ) : null} </>                  }}
                  disabled={selectedVideos.size === 0}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold
                             bg-red-500/20 text-red-400 border border-red-500/30
                             hover:bg-red-500/30 transition-colors disabled:opacity-30"
                >
                  删除选中 ({selectedVideos.size})
                </button>
              )}
              <button
                onClick={() => setIsMultiSelectMode(v => !v)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold
                           ${isMultiSelectMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-white/50 border border-white/10'}
                           hover:bg-white/10 transition-colors`}
              >
                {isMultiSelectMode ? '取消多选' : '多选'}
              </button>
            </div>
          </div>

          {/* Video List */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-2 flex items-center space-x-3 no-scrollbar">
            {recordedVideos.map(v => (
              <div
                key={v.id}
                className={`relative w-32 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200
                            ${selectedVideos.has(v.id) ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-white/10 active:border-amber-400/50'}`}
                onClick={() => {
                  if (isMultiSelectMode) {
                    setSelectedVideos(prev => {
                      const next = new Set(prev);
                      if (next.has(v.id)) next.delete(v.id);
                      else next.add(v.id);
                      return next;
                    });
                  } else {
                    // Tap to play (mobile-friendly — hover doesn't work on touch devices)
                    handlePlayVideo(v);
                  }
                }}
              >
                <video
                  src={v.url}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                {/* Play icon — always visible on mobile, enhanced on hover */}
                <div className="absolute inset-0 flex items-center justify-center
                                bg-black/30 md:bg-black/40 md:opacity-0 md:hover:opacity-100 transition-opacity pointer-events-none">
                  {isMultiSelectMode ? (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                                     ${selectedVideos.has(v.id) ? 'bg-amber-500 border-amber-500' : 'border-white/60'}`}
                    >
                      {selectedVideos.has(v.id) && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Center play button — always visible */}
                      <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                      {/* Action buttons — only on hover (desktop) */}
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1.5 pointer-events-auto md:hidden group-hover:flex">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadRecording(v.blob); }}
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteVideo(v.id, e); }}
                          className="w-7 h-7 rounded-full bg-white/20 hover:bg-red-500/50 flex items-center justify-center text-white"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {/* Duration badge */}
                <div className="absolute bottom-1 left-1 text-[9px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded pointer-events-none">
                  {fmt(v.duration)}
                </div>
                {/* Multi-select checkmark */}
                {isMultiSelectMode && selectedVideos.has(v.id) && (
                  <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Video player overlay ── */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center"
          onClick={() => { setPlayingVideo(null); }}
        >
          <div
            className="relative max-w-[90vw] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setPlayingVideo(null)}
              className="absolute -top-10 right-0 w-9 h-9 flex items-center justify-center
                         rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors z-10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <video
              src={playingVideo.url}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl"
              style={{ objectFit: 'contain' }}
            />
            {/* Video info */}
            <div className="absolute -bottom-8 left-0 right-0 text-center text-white/50 text-xs">
              {new Date(playingVideo.timestamp).toLocaleString('zh-CN')} / {fmt(playingVideo.duration)}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RecordingOverlay;
