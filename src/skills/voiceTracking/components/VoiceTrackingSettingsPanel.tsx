/**
 * VoiceTrackingSettingsPanel - 语音跟读设置面板
 *
 * 支持后端切换 (Web Speech API / API) 和高亮、滚动、字号等配置
 */

import React, { useState, useEffect } from 'react';
import { VoiceTrackingSettings, HighlightMode, RecognitionBackend } from '../types';

interface Props {
  settings: VoiceTrackingSettings;
  onSave: (settings: VoiceTrackingSettings) => void;
  onClose: () => void;
  hideBackend?: boolean; // 隐藏"语音识别后端"模块（由外部 API 引擎配置接管）
}

const DEFAULT_SETTINGS: VoiceTrackingSettings = {
  highlightMode: 'character',
  highlightColor: '#FFFF00',
  highlightSpeed: 50,
  autoScroll: true,
  autoScrollSpeed: 60,
  voiceSync: true,
  fontSize: 24,
  backend: {
    type: 'web-speech-api',
    language: 'zh-CN',
  },
};

/** SiliconFlow SenseVoiceSmall 预设配置 */
const SILICONFLOW_PRESET: Partial<VoiceTrackingSettings['backend']> = {
  type: 'api',
  apiUrl: 'https://api.siliconflow.cn/v1/audio/transcriptions',
  apiModel: 'FunAudioLLM/SenseVoiceSmall',
  language: 'zh-CN',
};

const AVAILABLE_COLORS = [
  '#FFFF00', '#00FF00', '#00FFFF', '#FF00FF',
  '#FF6600', '#FF0000', '#00FF66',
];

const VoiceTrackingSettingsPanel: React.FC<Props> = ({
  settings,
  onSave,
  onClose,
  hideBackend = false,
}) => {
  const [local, setLocal] = useState<VoiceTrackingSettings>(settings);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const patch = (partial: Partial<VoiceTrackingSettings>) =>
    setLocal((prev) => ({ ...prev, ...partial }));

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  const handleReset = () => {
    setLocal(DEFAULT_SETTINGS);
  };

  const setBackendType = (type: RecognitionBackend) => {
    setLocal((prev) => ({
      ...prev,
      backend: { ...prev.backend, type },
    }));
  };

  const setBackendField = (field: string, value: string) => {
    setLocal((prev) => ({
      ...prev,
      backend: { ...prev.backend, [field]: value },
    }));
  };

  return (
    <div className="space-y-5">
      {!hideBackend && (
        /* ===== 识别后端 ===== */
        <Section title="语音识别后端">
          <p className="text-[10px] text-gray-400 mb-2">
            选择语音识别引擎。Web Speech API 使用浏览器原生识别（离线免费）。
            SiliconFlow 和 API 模式可对接第三方高精度语音识别服务。
          </p>
          <div className="grid grid-cols-3 gap-2">
            <BackendButton
              label="Web Speech"
              active={local.backend.type === 'web-speech-api'}
              onClick={() => setBackendType('web-speech-api')}
            />
            <BackendButton
              label="SiliconFlow"
              active={
                local.backend.type === 'api' &&
                local.backend.apiUrl?.includes('siliconflow')
              }
              onClick={() => {
                setLocal((prev) => ({
                  ...prev,
                  backend: { ...prev.backend, ...SILICONFLOW_PRESET },
                }));
              }}
            />
            <BackendButton
              label="自定义 API"
              active={
                local.backend.type === 'api' &&
                !local.backend.apiUrl?.includes('siliconflow')
              }
              onClick={() => {
                if (local.backend.type !== 'api') {
                  setBackendType('api');
                }
              }}
            />
          </div>

          {local.backend.type === 'api' && (
            <div className="mt-3 space-y-2 bg-gray-800/40 rounded-lg p-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">API 端点 URL</label>
                <input
                  type="text"
                  value={local.backend.apiUrl || ''}
                  onChange={(e) => setBackendField('apiUrl', e.target.value)}
                  placeholder="https://api.siliconflow.cn/v1/audio/transcriptions"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-950 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">API Key</label>
                <input
                  type="password"
                  value={local.backend.apiKey || ''}
                  onChange={(e) => setBackendField('apiKey', e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-950 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">模型</label>
                <input
                  type="text"
                  value={local.backend.apiModel || ''}
                  onChange={(e) => setBackendField('apiModel', e.target.value)}
                  placeholder="FunAudioLLM/SenseVoiceSmall"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-950 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">语言</label>
                <input
                  type="text"
                  value={local.backend.language || 'zh-CN'}
                  onChange={(e) => setBackendField('language', e.target.value)}
                  placeholder="zh-CN"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-gray-950 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ===== 高亮模式 ===== */}
      <Section title="字符高亮模式">
        <div className="grid grid-cols-2 gap-3">
          <ModeButton
            label="逐个字符高亮"
            desc="精确到每个字符"
            active={local.highlightMode === 'character'}
            onClick={() => patch({ highlightMode: 'character' })}
          />
          <ModeButton
            label="按句子高亮"
            desc="更自然的阅读体验"
            active={local.highlightMode === 'sentence'}
            onClick={() => patch({ highlightMode: 'sentence' })}
          />
        </div>
      </Section>

      {/* ===== 高亮颜色 ===== */}
      <Section title="高亮颜色">
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => patch({ highlightColor: color })}
              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                local.highlightColor === color
                  ? 'border-white scale-110 ring-2 ring-amber-500/50'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </Section>

      {/* ===== 高亮速度 ===== */}
      <SliderSection
        title="高亮速度"
        value={local.highlightSpeed}
        min={10}
        max={200}
        step={10}
        unit="ms"
        onChange={(v) => patch({ highlightSpeed: v })}
      />

      {/* ===== 自动滚动 ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ToggleSection
          title="自动滚动"
          desc="文本自动滚动跟随高亮显示"
          enabled={local.autoScroll}
          onToggle={() => patch({ autoScroll: !local.autoScroll })}
        >
          {local.autoScroll && (
            <div className="mt-3">
              <SliderSection
                title="滚动速度"
                value={local.autoScrollSpeed}
                min={10}
                max={200}
                step={10}
                unit="px/s"
                onChange={(v) => patch({ autoScrollSpeed: v })}
              />
            </div>
          )}
        </ToggleSection>

        <ToggleSection
          title="语音同步"
          desc="语音与文本高亮同步显示"
          enabled={local.voiceSync}
          onToggle={() => patch({ voiceSync: !local.voiceSync })}
        />
      </div>

      {/* ===== 字体大小 ===== */}
      <SliderSection
        title="字体大小"
        value={local.fontSize}
        min={16}
        max={48}
        step={2}
        unit="px"
        onChange={(v) => patch({ fontSize: v })}
      />

      {/* ===== 麦克风权限声明 ===== */}
      <Section title="麦克风使用提示">
        <p className="text-xs text-gray-400 leading-relaxed">
          Z 提词器需要访问您的麦克风进行语音识别。在部分安卓系统（如 ColorOS），即使已授予麦克风权限，系统仍可能在后台将其限制或关闭。
        </p>
        <p className="text-xs text-gray-400 leading-relaxed mt-2">
          如果语音识别功能异常，请前往系统设置：
        </p>
        <ul className="list-disc list-inside text-xs text-gray-400 ml-4 mt-2 space-y-1">
          <li>检查应用麦克风权限是否为“始终允许”。</li>
          <li>关闭应用的电池优化或允许后台活动。</li>
          <li>允许应用的自启动。</li>
        </ul>
        <p className="text-xs text-amber-500 leading-relaxed mt-2 font-semibold">
          重要提示：应用无法强制获取或保持麦克风权限，请务必手动检查系统设置。
        </p>
      </Section>

      {/* ===== 按钮区 ===== */}
      <div className="flex justify-end items-center gap-3 pt-2">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-xs font-semibold bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors border border-gray-700/50"
        >
          重置默认值
        </button>
        <button
          onClick={handleSave}
          className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors shadow-lg"
        >
          保存设置
        </button>
      </div>
    </div>
  );
};

// ===== 辅助小组件 =====

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
      <h3 className="text-sm font-bold text-white mb-3">{title}</h3>
      {children}
    </div>
  );
}

function BackendButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border transition-all text-center ${
        active
          ? 'bg-gray-700 border-amber-500 text-white shadow-md'
          : 'bg-transparent border-transparent hover:bg-gray-900 text-gray-400 hover:text-gray-200'
      }`}
    >
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function ModeButton({
  label,
  desc,
  active,
  onClick,
}: {
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border transition-all flex flex-col items-center gap-2 ${
        active
          ? 'bg-gray-700 border-amber-500 text-white shadow-md'
          : 'bg-transparent border-transparent hover:bg-gray-900 text-gray-400 hover:text-gray-200'
      }`}
    >
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-[10px] text-center text-gray-400">{desc}</span>
    </button>
  );
}

function SliderSection({
  title,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-amber-400 font-mono text-xs font-semibold">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>慢</span>
        <span>快</span>
      </div>
    </div>
  );
}

function ToggleSection({
  title,
  desc,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800/40 border border-gray-800 p-4 rounded-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
          <p className="text-xs text-gray-400">{desc}</p>
        </div>
        <button
          onClick={onToggle}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
            enabled ? 'bg-amber-500 justify-end' : 'bg-gray-700 justify-start'
          }`}
        >
          <div className="w-4 h-4 bg-white rounded-full shadow-md" />
        </button>
      </div>
      {children}
    </div>
  );
}

export default VoiceTrackingSettingsPanel;
