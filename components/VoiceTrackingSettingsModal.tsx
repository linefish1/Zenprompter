import React, { useState, useEffect } from 'react';
import type { VoiceTrackingSettings } from '../src/skills/voiceTracking/types';

interface VoiceTrackingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceTrackingSettings;
  updateSettings: (newSettings: Partial<VoiceTrackingSettings>) => void;
}

const VoiceTrackingSettingsModal: React.FC<VoiceTrackingSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  updateSettings
}) => {
  const [localSettings, setLocalSettings] = useState<VoiceTrackingSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleReset = () => {
    const defaultSettings: VoiceTrackingSettings = {
      highlightMode: 'character',
      highlightColor: '#FFFF00',
      highlightSpeed: 50,
      autoScroll: true,
      autoScrollSpeed: 60,
      voiceSync: true,
      fontSize: 24,
      backend: { type: 'web-speech-api', language: 'zh-CN' },
    };
    setLocalSettings(defaultSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
              语音跟读设置
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              自定义语音跟读的高亮显示、同步和跟踪行为，优化您的朗读体验。
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
          {/* Highlight Mode Selection */}
          <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
            <h3 className="text-sm font-bold text-white mb-3">字符高亮显示模式</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setLocalSettings({...localSettings, highlightMode: 'character'})}
                className={`p-4 rounded-lg border transition-all flex flex-col items-center gap-2 ${localSettings.highlightMode === 'character' ? 'bg-gray-700 border-amber-500 text-white shadow-md' : 'bg-transparent border-transparent hover:bg-gray-900 text-gray-400 hover:text-gray-200'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 6H3"></path>
                  <path d="M17 12H3"></path>
                  <path d="M17 18H3"></path>
                </svg>
                <span className="text-xs font-semibold">逐个字符高亮</span>
                <span className="text-[10px] text-center text-gray-400">精确到每个字符，适合需要细粒度控制的场景</span>
              </button>

              <button
                onClick={() => setLocalSettings({...localSettings, highlightMode: 'sentence'})}
                className={`p-4 rounded-lg border transition-all flex flex-col items-center gap-2 ${localSettings.highlightMode === 'sentence' ? 'bg-gray-700 border-amber-500 text-white shadow-md' : 'bg-transparent border-transparent hover:bg-gray-900 text-gray-400 hover:text-gray-200'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 12h.01"></path>
                  <path d="M12 18h.01"></path>
                  <path d="M12 6h.01"></path>
                  <path d="M12 12a15.3 15.3 0 0 1-4.25-4.25"></path>
                  <path d="M12 12a15.3 15.3 0 0 0-4.25 4.25"></path>
                  <path d="M12 12a15.3 15.3 0 0 0 4.25-4.25"></path>
                  <path d="M12 12a15.3 15.3 0 0 1 4.25 4.25"></path>
                </svg>
                <span className="text-xs font-semibold">按句子高亮</span>
                <span className="text-[10px] text-center text-gray-400">按照完整句子或段落高亮，更自然的阅读体验</span>
              </button>
            </div>
          </div>

          {/* Highlight Color Picker */}
          <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
            <h3 className="text-sm font-bold text-white mb-3">高亮颜色选择</h3>
            <div className="flex flex-wrap gap-2">
              {['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FF6600', '#FF0000', '#00FF66'].map((color) => (
                <button
                  key={color}
                  onClick={() => setLocalSettings({...localSettings, highlightColor: color})}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${localSettings.highlightColor === color ? 'border-white scale-110 ring-2 ring-amber-500/50' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-400">当前选择:</span>
              <div className="w-6 h-6 rounded border border-gray-600" style={{ backgroundColor: localSettings.highlightColor }}></div>
              <span className="text-xs font-mono text-gray-300">{localSettings.highlightColor}</span>
            </div>
          </div>

          {/* Highlight Speed */}
          <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-white">高亮速度</h3>
              <span className="text-amber-400 font-mono text-xs font-semibold">{localSettings.highlightSpeed}ms</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={localSettings.highlightSpeed}
              onChange={(e) => setLocalSettings({...localSettings, highlightSpeed: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>慢</span>
              <span>快</span>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Auto Scroll */}
          <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">自动滚动</h3>
                <p className="text-xs text-gray-400">文本自动滚动跟随高亮显示</p>
              </div>
              <button
                onClick={() => setLocalSettings({...localSettings, autoScroll: !localSettings.autoScroll})}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${localSettings.autoScroll ? 'bg-amber-500 justify-end' : 'bg-gray-700 justify-start'}`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
              </button>
            </div>

            {/* Auto Scroll Speed - only show when autoScroll is enabled */}
            {localSettings.autoScroll && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-white">滚动速度</h3>
                  <span className="text-amber-400 font-mono text-xs font-semibold">{localSettings.autoScrollSpeed}px/s</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={localSettings.autoScrollSpeed}
                  onChange={(e) => setLocalSettings({...localSettings, autoScrollSpeed: parseInt(e.target.value)})}
                  className="w-full h-1.5 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>慢</span>
                  <span>快</span>
                </div>
              </div>
            )}
          </div>

            {/* Voice Sync */}
            <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">语音同步</h3>
                  <p className="text-xs text-gray-400">语音与文本高亮同步显示</p>
                </div>
                <button
                  onClick={() => setLocalSettings({...localSettings, voiceSync: !localSettings.voiceSync})}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${localSettings.voiceSync ? 'bg-amber-500 justify-end' : 'bg-gray-700 justify-start'}`}
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                </button>
              </div>
            </div>
          </div>

          {/* Font Size */}
          <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-white">字体大小</h3>
              <span className="text-amber-400 font-mono text-xs font-semibold">{localSettings.fontSize}px</span>
            </div>
            <input
              type="range"
              min="16"
              max="48"
              step="2"
              value={localSettings.fontSize}
              onChange={(e) => setLocalSettings({...localSettings, fontSize: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>小</span>
              <span>大</span>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="border-t border-gray-800 p-5 flex justify-end items-center gap-3 bg-gray-950">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors border border-gray-700/50"
          >
            重置默认值
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors shadow-lg shadow-amber-950/10"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceTrackingSettingsModal;