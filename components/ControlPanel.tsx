import React, { useState, useRef, useEffect } from 'react';
import { PrompterSettings } from '../types';
import { UpdateService } from '../services/updateService';

// Helper function to convert HSL to Hex
const hslToHex = (h: number, s: number, l: number): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Color Picker Component
interface ColorPickerProps {
  settings: PrompterSettings;
  updateSettings: (newSettings: Partial<PrompterSettings>) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ settings, updateSettings }) => {
  const satLightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [isDraggingSL, setIsDraggingSL] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);

  const { h, s, l } = settings.bgColor;

  // Calculate position from HSL
  const slPosition = { x: s * 100, y: (1 - l) * 100 };
  const huePosition = (h / 360) * 100;

  // Update HSL from position
  const updateFromSL = (clientX: number, clientY: number) => {
    if (!satLightRef.current) return;
    const rect = satLightRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    updateSettings({
      bgColor: { h, s: x, l: 1 - y }
    });
  };

  const updateFromHue = (clientX: number) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    updateSettings({
      bgColor: { h: x * 360, s, l }
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSL) updateFromSL(e.clientX, e.clientY);
      if (isDraggingHue) updateFromHue(e.clientX);
    };
    const handleMouseUp = () => {
      setIsDraggingSL(false);
      setIsDraggingHue(false);
    };
    if (isDraggingSL || isDraggingHue) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSL, isDraggingHue, h, s, l]);

  return (
    <div>
      <label className="text-xs text-gray-400 mb-1.5 block">背景色</label>

      {/* Saturation/Lightness Box */}
      <div
        ref={satLightRef}
        className="relative w-full h-24 rounded-lg cursor-crosshair mb-2 overflow-hidden"
        style={{
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))
          `
        }}
        onMouseDown={(e) => { setIsDraggingSL(true); updateFromSL(e.clientX, e.clientY); }}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          updateFromSL(touch.clientX, touch.clientY);
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          updateFromSL(touch.clientX, touch.clientY);
        }}
      >
        {/* SL Selector */}
        <div
          className="absolute w-4 h-4 border-2 border-white rounded-full shadow-md pointer-events-none"
          style={{
            left: `calc(${slPosition.x}% - 8px)`,
            top: `calc(${slPosition.y}% - 8px)`,
            backgroundColor: `hsl(${h}, ${s * 100}%, ${l * 100}%)`
          }}
        />
      </div>

      {/* Hue Bar */}
      <div
        ref={hueRef}
        className="relative h-4 rounded-full cursor-pointer overflow-hidden"
        style={{
          background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
        }}
        onMouseDown={(e) => { setIsDraggingHue(true); updateFromHue(e.clientX); }}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          updateFromHue(touch.clientX);
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          updateFromHue(touch.clientX);
        }}
      >
        {/* Hue Selector */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-white border-2 border-gray-400 rounded-full shadow-md pointer-events-none"
          style={{ left: `calc(${huePosition}% - 6px)` }}
        />
      </div>

      {/* Preview */}
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-gray-500">点击或拖动选择颜色</span>
        <div
          className="w-8 h-8 rounded border border-gray-600 shadow-inner"
          style={{ backgroundColor: `hsl(${h}, ${s * 100}%, ${l * 100}%)` }}
        />
      </div>
    </div>
  );
};

interface ControlPanelProps {
  settings: PrompterSettings;
  updateSettings: (newSettings: Partial<PrompterSettings>) => void;
  togglePlay: () => void;
  onReset: () => void;
  onHome?: () => void;
  openAIModal: () => void;
  openHelpModal: () => void;
  openApiModal: () => void;
  openStyleSettingsModal: () => void;
  openDonateModal: () => void;
  openScriptPanel: () => void;
  wordCount?: number;
  isCameraRecording?: boolean;
  onCameraClick?: () => void;
  isRecording?: boolean;
  recordingTime?: number;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  updateSettings,
  togglePlay,
  onReset,
  onHome,
  openAIModal,
  openHelpModal,
  openApiModal,
  openStyleSettingsModal,
  openDonateModal,
  openScriptPanel,
  wordCount = 0,
  isCameraRecording = false,
  onCameraClick,
  isRecording = false,
  recordingTime = 0
}) => {
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  // Helper to adjust speed safely
  const adjustSpeed = (delta: number) => {
    const newSpeed = Math.max(0, Math.min(10, settings.speed + delta));
    const roundedSpeed = Math.round(newSpeed * 10) / 10;
    updateSettings({ speed: roundedSpeed });
  };

  // Estimate time: 130 words per minute
  const estMinutes = Math.floor(wordCount / 130);
  const estSeconds = Math.round(((wordCount / 130) - estMinutes) * 60);

  // Update state and functions
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{version?: string; downloadUrl?: string}>({});

  return (
    <div className="relative z-50">

      {/* Pop-up Style Menu */}
      {showStyleMenu && (
          <div className="absolute bottom-full right-4 mb-2 rounded-2xl shadow-2xl p-4 w-72 max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 z-50"
            style={{
              backgroundColor: 'var(--zen-bg-secondary)',
              border: '1px solid var(--zen-border)',
            }}
          >
              <div className="flex justify-between items-center mb-4 pb-2 border-b" style={{ borderColor: 'var(--zen-border)' }}>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">系统设置</h3>
                  <button
                      onClick={() => setShowStyleMenu(false)}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
              </div>

              <div className="space-y-4">
                  {/* Style Preset Switcher */}
                  <button
                      onClick={() => {
                          openStyleSettingsModal();
                          setShowStyleMenu(false);
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-950/30"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/>
                      </svg>
                      <span>风格设定</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 ml-1">
                          {settings.stylePreset === 'apple-light' ? 'Apple 极简' : 'Zen 暗夜'}
                      </span>
                  </button>

                  {/* Font Size */}
                  <div>
                      <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                          <span>字号大小</span>
                          <span className="text-amber-400 font-mono text-xs font-semibold">{settings.fontSize}px</span>
                      </div>
                      <input
                          type="range"
                          min="20"
                          max="150"
                          step="5"
                          value={settings.fontSize}
                          onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                  </div>

                  {/* Background Color - 2D Color Picker */}
                  <ColorPicker
                      settings={settings}
                      updateSettings={updateSettings}
                  />

                  {/* Text Color */}
                  <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">文字色彩</label>
                      <div className="flex gap-2">
                        {['white', 'yellow', 'green', 'cyan', 'purple', 'pink', 'orange'].map((c) => (
                             <button
                                key={c}
                                onClick={() => updateSettings({ textColor: c as any })}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${settings.textColor === c ? 'border-white scale-110 ring-2 ring-amber-500/50' : 'border-transparent'}`}
                                style={{ backgroundColor: c === 'yellow' ? '#fbbf24' : c === 'green' ? '#4ade80' : c === 'cyan' ? '#22d3ee' : c === 'purple' ? '#a855f7' : c === 'pink' ? '#ec4899' : c === 'orange' ? '#f97316' : '#ffffff' }}
                                title={c === 'yellow' ? '黄色' : c === 'green' ? '绿色' : c === 'cyan' ? '青色' : c === 'purple' ? '紫色' : c === 'pink' ? '粉色' : c === 'orange' ? '橙色' : '白色'}
                             />
                        ))}
                      </div>
                  </div>

                  {/* Font Family */}
                  <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">字体系列</label>
                  <div className="grid grid-cols-3 gap-1 bg-gray-950 p-1 rounded-lg">
                      {['sans', 'serif', 'mono'].map((f) => (
                          <button
                            key={f}
                            onClick={() => updateSettings({ fontFamily: f as any })}
                            className={`py-1.5 text-xs rounded transition-colors font-medium ${settings.fontFamily === f ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-gray-300'}`}
                          >
                              {f === 'sans' ? '无衬线' : f === 'serif' ? '有衬线' : '等宽'}
                          </button>
                      ))}
                  </div>
                  </div>

                  {/* Opacity Settings */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                      <div>
                          <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                              <span>背景透明</span>
                              <span className="text-amber-400 font-mono text-[10px] font-semibold">{settings.bgOpacity}%</span>
                          </div>
                          <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={settings.bgOpacity}
                              onChange={(e) => updateSettings({ bgOpacity: parseInt(e.target.value) })}
                              className="w-full h-1 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                      </div>
                      <div>
                          <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                              <span>文字透明</span>
                              <span className="text-amber-400 font-mono text-[10px] font-semibold">{settings.textOpacity}%</span>
                          </div>
                          <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              value={settings.textOpacity}
                              onChange={(e) => updateSettings({ textOpacity: parseInt(e.target.value) })}
                              className="w-full h-1 bg-gray-955 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                      </div>
                  </div>

                  {/* Mirror & Help buttons inside menu */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-800">
                      <button
                          onClick={() => updateSettings({ isMirrored: !settings.isMirrored })}
                          className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${settings.isMirrored ? 'bg-amber-950/20 border-amber-500/40 text-amber-400' : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'}`}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3"/>
                            <path d="M10 5L4 12l6 7V5z" fill={settings.isMirrored ? 'currentColor' : 'none'}/>
                          </svg>
                          <span>镜像翻转</span>
                      </button>

                      <button
                          onClick={() => {
                              openHelpModal();
                              setShowStyleMenu(false);
                          }}
                          className="py-2 px-3 rounded-lg bg-gray-955 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                          <span>使用说明</span>
                      </button>
                  </div>

                  {/* API settings button */}
                  <div className="pt-2">
                      <button
                          onClick={() => {
                              openApiModal();
                              setShowStyleMenu(false);
                          }}
                          className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/40"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                          <span>API 接口设置</span>
                      </button>
                  </div>

                  {/* Donate button */}
                  <div className="pt-2">
                      <button
                          onClick={() => {
                              openDonateModal();
                              setShowStyleMenu(false);
                          }}
                          className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-pink-950/40"
                      >
                          <span className="text-base">❤️</span>
                          <span>支持开发者</span>
                      </button>
                  </div>

                  {/* Check for updates */}
                  <div className="pt-3 border-t border-gray-800">
                      <button
                          onClick={async () => {
                              setIsCheckingUpdate(true);
                              try {
                                  const result = await UpdateService.checkForAndroidUpdate();
                                  if (result.available && result.version && result.downloadUrl) {
                                      setUpdateAvailable(true);
                                      setUpdateInfo({ version: result.version, downloadUrl: result.downloadUrl });
                                  } else {
                                      setUpdateAvailable(false);
                                      setUpdateInfo({});
                                  }
                              } catch (error) {
                                  console.error('Error checking for updates:', error);
                                  setUpdateAvailable(false);
                                  setUpdateInfo({});
                              } finally {
                                  setIsCheckingUpdate(false);
                                  setShowStyleMenu(false);
                              }
                          }}
                          disabled={isCheckingUpdate}
                          className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-green-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isCheckingUpdate ? (
                              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                          ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="23 4 23 10 17 10"/>
                                  <polyline points="1 20 1 14 7 14"/>
                                  <path d="M3.5 9h17"/>
                                  <path d="M20 14h-4"/>
                              </svg>
                          )}
                          <span>{updateAvailable ? '有新版本可用！' : isCheckingUpdate ? '检查中...' : '检查更新'}</span>
                      </button>
                      {updateAvailable && updateInfo.downloadUrl && (
                          <button
                              onClick={() => window.open(updateInfo.downloadUrl, '_blank')}
                              className="w-full mt-2 py-2 px-3 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/>
                                  <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                              <span>下载 {updateInfo.version || '新版本'}</span>
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="px-3 py-2.5 w-full overflow-x-auto"
        style={{
          backgroundColor: 'var(--zen-bg-secondary)',
          borderTop: '1px solid var(--zen-border)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)'
        }}
      >
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 sm:gap-6 md:gap-10 flex-nowrap">

        {/* 首页 */}
        <button
          onClick={onHome}
          title="首页"
          className="p-2.5 rounded-full bg-gray-900 text-amber-500 hover:text-amber-400 hover:bg-gray-800 transition-colors border border-amber-500/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </button>

        {/* AI创作 */}
        <button
          onClick={openAIModal}
          className="p-2.5 rounded-full text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors border border-amber-500/10"
          title="AI 创作（生成口播脚本）"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="m5 3 1.25 2.75L9 7l-2.75 1.25L5 11l-1.25-2.75L1 7l2.75-1.25L5 3Z"/><path d="m19 17 1 2.25L22.25 20 20 21l-1 2.25-1-2.25-2.25-1 2.25-1 1-2.25Z"/></svg>
        </button>

        {/* 开始拍摄（居中加粗） */}
        <button
          onClick={onCameraClick}
          className={`p-3.5 rounded-full transition-all border relative flex items-center gap-1.5 ${isRecording ? 'bg-red-500 border-red-450 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)] px-4' : isCameraRecording ? 'bg-red-500 border-red-450 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]'}`}
          title={isRecording ? '停止拍摄' : '开始拍摄'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M23 7l-7 5 7 5V7z"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          {isRecording && (
            <span className="text-[10px] font-mono font-extrabold whitespace-nowrap">
              {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{Math.floor(recordingTime % 60).toString().padStart(2, '0')}
            </span>
          )}
          {isRecording && (
            <span className="absolute top-0 right-0 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </span>
          )}
        </button>

        {/* 系统设置 */}
        <button
          onClick={() => setShowStyleMenu(!showStyleMenu)}
          className={`p-2.5 rounded-full transition-all border ${showStyleMenu ? 'bg-amber-500/20 border-amber-500/45 text-amber-400' : 'bg-transparent border-amber-500/10 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10'}`}
          title="系统设置"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>

        {/* 支持开发者 */}
        <button
          onClick={openDonateModal}
          className="p-2.5 rounded-full text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 transition-colors border border-pink-500/10"
          title="支持开发者"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

      </div>
      </div>
    </div>
  );
};

export default ControlPanel;