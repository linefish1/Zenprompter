import React, { useState, useEffect, useRef, useCallback } from 'react';
import TeleprompterDisplay from './components/TeleprompterDisplay';
import ControlPanel from './components/ControlPanel';
import AIModal from './components/AIModal';
import HelpModal from './components/HelpModal';
import APISettingsModal from './components/APISettingsModal';
import StyleSettingsModal from './components/StyleSettingsModal';
import DonateModal from './components/DonateModal';
import HomePage from './components/HomePage';
import ScriptEditor from './components/ScriptEditor';
import RecordingOverlay from './components/RecordingOverlay';
import PermissionsGate from './components/PermissionsGate';
import { PrompterSettings, StylePresetId } from './types';
import { databaseService } from './services/databaseService';
import { requestCameraAccess, stopCamera, isRecordingSupported } from './utils/cameraUtils';
import { getStylePreset, applyStylePresetToDOM } from './config/stylePresets';
import { htmlToPlainText } from './utils/htmlUtils';
import { addScriptToLibrary } from './utils/scriptLibrarySync';
import type { ScriptLibraryItem } from './types';
import { generateMultiRewrite, RewriteVersion } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [text, setText] = useState<string>(() => {
    const savedText = localStorage.getItem('zen_text');
    return savedText !== null ? savedText : `您好，欢迎使用 ZenPrompter，这是一款为您精心设计的个人提词器，旨在提供清晰、专注的体验。

现在，您正处于编辑模式。您可以点击本文本的任意位置开始输入纯文本内容、粘贴纯文本，或者直接从电脑拖拽一个纯文本文件进来。

准备好后，请看下方的控制面板。

您可以按下"开始"按钮，或者直接敲击空格键，来启动平滑的自动滚动。使用速度控件找到最适合您的语速。

想要获得真正现代化的体验，请尝试语音模式。点击麦克风图标，授予权限，ZenPrompter 将会聆听您的声音，并跟随您的语速进行滚动。正在朗读的词语会被高亮显示，让您永远不会跟丢。

需要配合实体提词器设备使用吗？"镜像"按钮可以水平翻转文本，以便在提词器玻璃上正确显示。

如果您创作时遇到困难，我们的 AI 助手可以随时提供帮助。从一个简单的想法生成全新的纯文本脚本，或者润色您现有的文本，使其语法更通顺，语流更自然。

就是这么简单！现在您已准备好自信地进行演示。去吧，用您自己的精彩纯文本内容替换这段文字。`;
  });

const [settings, setSettings] = useState<PrompterSettings>(() => {
  const defaults: PrompterSettings = {
    speed: 2,
    fontSize: 60,
    isMirrored: false,
    isPlaying: false,
    isEditing: false, // 修改为阅读模式
    fontFamily: 'sans',
    textColor: 'white',
    bgColor: { h: 0, s: 0, l: 0 },
    bgOpacity: 50,
    textOpacity: 100, // 这是主编辑区的文本透明度
    prompterBgTransparency: 0, // 新增：提词框背景透明度，0 = 完全不透明
    prompterTextVisibility: 0, // 新增：提词框文字透明度，0 = 完全不透明 (可见), 100 = 完全透明 (不可见)
    stylePreset: 'zen-dark',
  };
    const savedSettings = localStorage.getItem('zen_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        return {
          ...defaults,
          ...parsed,
          isPlaying: false
        };
      } catch (e) {
        console.error("Failed to load settings from localStorage:", e);
      }
    }
    return defaults;
  });

  const [isAIModalOpen, setAIModalOpen] = useState(false);
  const [isHelpModalOpen, setHelpModalOpen] = useState(false);
  const [isApiModalOpen, setApiModalOpen] = useState(false);
  const [isStyleSettingsModalOpen, setStyleSettingsModalOpen] = useState(false);
  const [isDonateModalOpen, setDonateModalOpen] = useState(false);
const [showInstructions, setShowInstructions] = useState(true);
  const [showPermissions, setShowPermissions] = useState(() => {
    return !localStorage.getItem('zen_permissions_requested');
  });
  const [isDragging, setIsDragging] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const isStartingRef = useRef(false);
  const [networkSpeed, setNetworkSpeed] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('检测中...');
  const speedTestIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [originalText, setOriginalText] = useState<string>('');
  const [rewrittenVersions, setRewrittenVersions] = useState<RewriteVersion[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [phoneMockupImage, setPhoneMockupImage] = useState(() => {
    return localStorage.getItem('zen_phone_mockup') || '';
  });

  const updatePhoneMockupImage = useCallback((dataUrl: string) => {
    setPhoneMockupImage(dataUrl);
    if (dataUrl) {
      localStorage.setItem('zen_phone_mockup', dataUrl);
    } else {
      localStorage.removeItem('zen_phone_mockup');
    }
  }, []);

  // --- Camera cleanup on unmount ---
  useEffect(() => {
    return () => {
      if (cameraStream) {
        stopCamera(cameraStream);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Apply style preset to DOM ---
  useEffect(() => {
    const preset = getStylePreset(settings.stylePreset);
    applyStylePresetToDOM(preset);
  }, [settings.stylePreset]);

  // --- Network Speed Monitoring ---
  useEffect(() => {
    const testSpeed = async () => {
      const startTime = performance.now();
      try {
        await fetch('https://www.google.com/favicon.ico', { 
          mode: 'no-cors',
          cache: 'no-store'
        });
        const endTime = performance.now();
        const duration = endTime - startTime;
        if (duration < 5000) {
          setNetworkSpeed(Math.round(duration));
          setConnectionStatus('已连接');
        } else {
          setConnectionStatus('连接中...');
        }
      } catch (e) {
        setConnectionStatus('离线');
      }
    };

    testSpeed();
    speedTestIntervalRef.current = setInterval(testSpeed, 30000);
    return () => {
      if (speedTestIntervalRef.current) clearInterval(speedTestIntervalRef.current);
    };
  }, []);

// --- Persistence ---
useEffect(() => {
  // Save to localStorage when settings or text changes
  localStorage.setItem('zen_text', text);
  // Don't save active status flags like isPlaying
  const { isPlaying, ...toSave } = settings;
  localStorage.setItem('zen_settings', JSON.stringify(toSave));

  // Save to IndexedDB using databaseService
  const saveToDatabase = async () => {
    try {
      await databaseService.init();
      await databaseService.savePrompt({
        id: 'default',
        text: text,
        settings: toSave,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save to database:', error);
    }
  };

  saveToDatabase();
}, [text, settings]);

  // --- Get background color with opacity ---
  const getBackgroundColor = () => {
    const { h, s, l } = settings.bgColor;
    return `hsla(${h}, ${s * 100}%, ${l * 100}%, ${settings.bgOpacity / 100})`;
  };


  // --- Handlers ---
const handleTextChange = (newText: string) => {
  setText(newText);
  // Hide instructions when text changes
  setShowInstructions(false);

  // Save to database immediately when text changes
  const saveToDatabase = async () => {
    try {
      await databaseService.init();
      const { isPlaying, ...toSave } = settings;
      await databaseService.savePrompt({
        id: 'default',
        text: newText,
        settings: toSave,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save to database:', error);
    }
  };

  saveToDatabase();
};

const handleDisplayDoubleClick = () => {
  // 拍摄中不允许切换编辑模式
  if (cameraStream) return;
  // 双击时切换到编辑模式
  updateSettings({ isEditing: true, isPlaying: false });

  // Save current state to database when switching modes
  const saveToDatabase = async () => {
    try {
      await databaseService.init();
      const { isPlaying, ...toSave } = settings;
      await databaseService.savePrompt({
        id: 'default',
        text: text,
        settings: toSave,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save to database:', error);
    }
  };

  saveToDatabase();
};

  const updateSettings = (newSettings: Partial<PrompterSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const togglePlay = () => {
    setSettings(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const handleReset = () => {
    setSettings(prev => ({ ...prev, isPlaying: false }));
    const scroller = document.querySelector('.overflow-y-auto');
    if (scroller) scroller.scrollTop = 0;
  };

  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError(null);

    try {
      if (!isRecordingSupported()) {
        setCameraError('您的浏览器不支持录像功能。请使用最新版 Chrome、Edge 或 Firefox。');
        return;
      }
      const stream = await requestCameraAccess();
      setCameraStream(stream);
      updateSettings({ isEditing: false, isPlaying: false });
      setIsRecording(true);
    } catch (err: any) {
      setCameraError(err.message || '摄像头访问失败');
    } finally {
      isStartingRef.current = false;
    }
  }, [updateSettings]);

  const handleCameraClick = async () => {
    if (cameraStream) {
      stopCamera(cameraStream);
      setCameraStream(null);
      setIsRecording(false);
    } else {
      await startCamera();
    }
  };

  const handleAIApply = (generatedText: string) => {
    setText(generatedText);
    updateSettings({ isEditing: true, isPlaying: false });
  };

  const handleStylePresetChange = (presetId: StylePresetId) => {
    updateSettings({ stylePreset: presetId });
  };

  const handleScriptSelectAndEdit = (content: string) => {
    setText(content);
    updateSettings({ isEditing: true, isPlaying: false });
  };

  const handleSaveToLibrary = useCallback((html: string) => {
    const plain = htmlToPlainText(html);
    if (!plain.trim()) return;
    const lines = plain.trim().split('\n');
    const title = lines[0].slice(0, 30) + (lines[0].length > 30 ? '…' : '');
    const now = Date.now();
    const newScript: ScriptLibraryItem = {
      id: now.toString(36),
      title: title || '未命名台词',
      content: plain,
      wordCount: plain.length,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };
    addScriptToLibrary(newScript);
  }, []);

  const handleScriptRewrite = async (content: string) => {
    setIsRewriting(true);
    try {
      setOriginalText(content);
      const versions = await generateMultiRewrite(content);
      setRewrittenVersions(versions);
      // Set text to the first version for the editor
      if (versions.length > 0) {
        setText(versions[0].text);
      }
      setShowComparison(true);
      updateSettings({ isEditing: true, isPlaying: false });
    } catch (error: any) {
      alert('改写失败: ' + (error.message || '未知错误'));
    } finally {
      setIsRewriting(false);
    }
  };

  const handleClearComparison = () => {
    setShowComparison(false);
    setOriginalText('');
    setRewrittenVersions([]);
  };

  const handleSelectVersion = (versionText: string) => {
    setText(versionText);
  };

  const handleEditorView = () => {
    handleClearComparison();
    updateSettings({ isEditing: false, isPlaying: true });
  };

  const handleGoHome = () => {
    setSettings(prev => ({ ...prev, isEditing: false, isPlaying: false }));
    setShowComparison(false);
    setOriginalText('');
    setRewrittenVersions([]);
    const scroller = document.querySelector('.overflow-y-auto');
    if (scroller) scroller.scrollTop = 0;
  };

  // --- Drag & Drop ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
        if (file.type.startsWith('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
            const content = await file.text();
            setText(content);
            handleReset();
        } else {
            alert("请拖放普通的文本文件 (.txt、.md)！");
        }
    }
  };

  return (
    <div 
        className="flex flex-col h-screen overflow-hidden font-sans relative"
        style={{ backgroundColor: getBackgroundColor() }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
          <div className="absolute inset-0 z-50 bg-amber-950/80 backdrop-blur-sm flex items-center justify-center border-4 border-amber-500 border-dashed m-4 rounded-xl">
              <div className="text-center text-amber-100 animate-bounce">
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                  <h2 className="text-3xl font-bold">拖放文件以加载脚本</h2>
              </div>
          </div>
      )}

      {/* Status Bar - Top */}
      <div className="absolute top-2 left-0 right-0 z-50 flex items-center justify-between px-4 pointer-events-none">
        {/* Connection status - left */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500/60">
          <span className={connectionStatus === '已连接' ? 'text-green-500' : connectionStatus === '离线' ? 'text-red-500' : ''}>
            {connectionStatus === '已连接' ? '●' : connectionStatus === '离线' ? '●' : '○'}
          </span>
          {networkSpeed !== null && connectionStatus === '已连接' && (
            <span>{networkSpeed}ms</span>
          )}
        </div>
        {/* Right side spacing to maintain layout */}
        <div className="w-16"></div>
      </div>

      {/* Header / Top Bar (Minimalist) — clickable logo returns home */}
      <div className="absolute top-0 left-0 p-4 z-40">
        <button
          onClick={handleGoHome}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all"
        >
          <h1 className="text-white font-bold tracking-tighter text-xl pointer-events-none select-none">
            Zen<span className="text-amber-500">Prompter</span>
          </h1>
        </button>
      </div>

      {/* Head display area for native mobile recording status */}
      {isRecording && !cameraStream && (
        <div className="absolute top-3 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-mono font-bold shadow-lg shadow-red-900/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span>录制中…</span>
        </div>
      )}

{showPermissions ? (
  <PermissionsGate onComplete={() => setShowPermissions(false)} />
) : showInstructions ? (
  <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
    <div className="bg-gray-800 rounded-lg p-6 w-full h-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto flex flex-col justify-between">
      <h2 className="text-2xl font-bold text-white mb-4">ZenPrompter 使用说明</h2>
      <div className="text-gray-300 space-y-4">
        <p>欢迎使用 ZenPrompter！这是一款专为个人演讲、演示和练习设计的提词器应用。</p>

        <div className="space-y-2">
          <h3 className="font-semibold text-amber-400">1. 编辑模式：</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>点击屏幕任意位置开始编辑</li>
            <li>输入或粘贴您的纯文本演讲稿</li>
            <li>支持拖拽纯文本文件(.txt)导入</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-amber-400">2. 阅读模式：</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>点击"播放"按钮开始自动滚动</li>
            <li>调整速度控件控制滚动速度</li>
            <li>镜像模式可用于提词器设备</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-amber-400">3. 高级功能：</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>语音模式：实时跟随您的语速滚动</li>
            <li>字体和颜色自定义</li>
            <li>背景透明度调整</li>
          </ul>
        </div>

        <p className="mt-4">准备好后，点击屏幕进入编辑模式开始创建您的演讲稿。</p>
      </div>
      <button
        onClick={() => setShowInstructions(false)}
        className="mt-6 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
      >
        开始使用
      </button>
    </div>
  </div>
) : null}

{/* Main Content Area — flex-1 fills space above ControlPanel */}
<div className="flex-1 overflow-hidden relative">
  {/* Recording overlay when camera is active */}
    {isRecording && cameraStream ? (
    <RecordingOverlay
      cameraStream={cameraStream}
      settings={settings}
      text={text}
      onStop={handleCameraClick}
      onScriptSelect={handleTextChange}
    />
  ) : settings.isEditing ? (
    <ScriptEditor
      text={text}
      onTextChange={handleTextChange}
      onView={handleEditorView}
      onSaveToLibrary={handleSaveToLibrary}
      originalText={originalText}
      rewrittenVersions={rewrittenVersions}
      showComparison={showComparison}
      onClearComparison={handleClearComparison}
      onSelectVersion={handleSelectVersion}
    />
  ) : settings.isPlaying ? (
    <TeleprompterDisplay
      settings={settings}
      text={text}
      onTextChange={handleTextChange}
      togglePlay={togglePlay}
      onDisplayDoubleClick={handleDisplayDoubleClick}
      cameraStream={cameraStream}
    />
  ) : (
    <HomePage
      text={text}
      setText={setText}
      settings={settings}
      updateSettings={updateSettings}
      handleCameraClick={handleCameraClick}
      openAIModal={() => setAIModalOpen(true)}
      openHelpModal={() => setHelpModalOpen(true)}
      openApiModal={() => setApiModalOpen(true)}
      openStyleSettingsModal={() => setStyleSettingsModalOpen(true)}
      openDonateModal={() => setDonateModalOpen(true)}
      onSelectAndEdit={handleScriptSelectAndEdit}
      onRewrite={handleScriptRewrite}
	      phoneMockupImage={phoneMockupImage}
    />
  )}
</div>

{/* ControlPanel — always visible at bottom */}
<ControlPanel
  settings={settings}
  updateSettings={updateSettings}
  togglePlay={togglePlay}
  onReset={handleReset}
  onHome={handleGoHome}
  openAIModal={() => setAIModalOpen(true)}
  openHelpModal={() => setHelpModalOpen(true)}
  openApiModal={() => setApiModalOpen(true)}
  openStyleSettingsModal={() => setStyleSettingsModalOpen(true)}
  openDonateModal={() => setDonateModalOpen(true)}
  openScriptPanel={() => { /* Script library is now in HomePage */ }}
  wordCount={(() => {
    const plain = htmlToPlainText(text);
    return plain.split(/\s+/).filter(w => w.length > 0).length;
  })()}
  isCameraRecording={!!cameraStream}
  onCameraClick={handleCameraClick}
  isRecording={isRecording}
/>

      {/* AI Modal */}
      <AIModal 
        isOpen={isAIModalOpen} 
        onClose={() => setAIModalOpen(false)}
        onApply={handleAIApply}
        currentText={text}
      />

      {/* Help Modal */}
      <HelpModal 
        isOpen={isHelpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

      {/* API Settings Modal */}
      <APISettingsModal
        isOpen={isApiModalOpen}
        onClose={() => setApiModalOpen(false)}
      />

      {/* Style Settings Modal */}
      <StyleSettingsModal
        isOpen={isStyleSettingsModalOpen}
        onClose={() => setStyleSettingsModalOpen(false)}
        currentPreset={settings.stylePreset}
        onPresetChange={handleStylePresetChange}
        phoneMockupImage={phoneMockupImage}
        onPhoneMockupChange={updatePhoneMockupImage}
      />

      {/* Donate Modal */}
      <DonateModal
        isOpen={isDonateModalOpen}
        onClose={() => setDonateModalOpen(false)}
      />

      {/* ── Camera error dialog (replaces raw alert — with retry) ── */}
      {cameraError && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
             onClick={(e) => { if (e.target === e.currentTarget) setCameraError(null); }}>
          <div className="bg-gray-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                     className="text-red-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-base">摄像头无法启动</h3>
                <p className="text-white/40 text-xs">请检查以下问题后重试</p>
              </div>
            </div>

            {/* Error message */}
            <div className="px-5 pb-3 max-h-48 overflow-y-auto">
              <div className="text-sm text-white/70 whitespace-pre-line leading-relaxed bg-white/5 rounded-lg p-3 border border-white/5">
                {cameraError}
              </div>
            </div>

            {/* Quick actions */}
            <div className="px-5 pb-2">
              <p className="text-[10px] text-amber-400/70 font-medium mb-2 uppercase tracking-wider">快速排查</p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-start gap-1.5 text-white/50 bg-white/5 rounded-lg p-2">
                  <span className="text-amber-400 text-xs mt-0.5">1</span>
                  <span>关闭其他使用摄像头的软件<br/>（Zoom、微信视频、OBS等）</span>
                </div>
                <div className="flex items-start gap-1.5 text-white/50 bg-white/5 rounded-lg p-2">
                  <span className="text-amber-400 text-xs mt-0.5">2</span>
                  <span>系统设置中检查<br/>相机权限是否开启</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 px-5 pb-5 pt-3 border-t border-white/5">
              <button
                onClick={() => setCameraError(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium
                           bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80
                           border border-white/5 transition-colors"
              >
                关闭
              </button>
              <button
                onClick={startCamera}
                disabled={isStartingRef.current}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold
                           bg-green-600 hover:bg-green-500 text-white
                           border border-green-500/30 transition-colors
                           disabled:opacity-50 disabled:cursor-wait
                           flex items-center justify-center gap-2"
              >
                {isStartingRef.current ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                    </svg>
                    启动中…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    重试启动摄像头
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;