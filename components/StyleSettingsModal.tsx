import React, { useState, useEffect } from 'react';
import { StylePresetId, StylePreset } from '../types';
import { STYLE_PRESETS, getStylePreset, applyStylePresetToDOM } from '../config/stylePresets';

interface StyleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreset: StylePresetId;
  onPresetChange: (presetId: StylePresetId) => void;
  phoneMockupImage: string;
  onPhoneMockupChange: (dataUrl: string) => void;
}

// Color swatch preview component
const ColorSwatch: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div
      className="w-5 h-5 rounded border border-zen"
      style={{ backgroundColor: color }}
    />
    <span className="text-[10px] text-zen-secondary">{label}</span>
  </div>
);

// Mini preview card for a style
const StylePreviewCard: React.FC<{
  preset: StylePreset;
  isActive: boolean;
  onClick: () => void;
}> = ({ preset, isActive, onClick }) => {
  const { colors, typography } = preset;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
        isActive
          ? 'border-[var(--zen-accent)] shadow-lg'
          : 'border-zen hover:border-zen-light'
      }`}
      style={{
        backgroundColor: colors.bgSecondary,
        color: colors.textPrimary,
      }}
    >
      {/* Preview header bar */}
      <div
        className="h-2 rounded-full mb-3 w-2/3"
        style={{ backgroundColor: colors.accent }}
      />

      {/* Preview content blocks */}
      <div className="space-y-2 mb-3">
        <div
          className="h-3 rounded w-full"
          style={{ backgroundColor: colors.bgTertiary }}
        />
        <div
          className="h-3 rounded w-4/5"
          style={{ backgroundColor: colors.bgTertiary }}
        />
      </div>

      {/* Preview button */}
      <div
        className="inline-block px-3 py-1 rounded text-xs font-semibold"
        style={{
          backgroundColor: colors.accent,
          color: colors.accentText,
          borderRadius: preset.spacing.borderRadius,
        }}
      >
        {preset.name}
      </div>

      {/* Label row */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: colors.border }}>
        <div>
          <span
            className="text-sm font-semibold block"
            style={{
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
            }}
          >
            {preset.name}
          </span>
          <span
            className="text-[10px] block mt-0.5"
            style={{ color: colors.textSecondary }}
          >
            {preset.description}
          </span>
        </div>
        {isActive && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: colors.accent }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.accentText} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
};

const StyleSettingsModal: React.FC<StyleSettingsModalProps> = ({
  isOpen,
  onClose,
  currentPreset,
  onPresetChange,
  phoneMockupImage,
  onPhoneMockupChange,
}) => {
  const [previewPresetId, setPreviewPresetId] = useState<StylePresetId>(currentPreset);

  // Live-preview preset data (built from the base preset + custom overrides)
  const [customBgOpacity, setCustomBgOpacity] = useState(50);
  const [customTextOpacity, setCustomTextOpacity] = useState(100);
  const [customPrompterBg, setCustomPrompterBg] = useState(0);
  const [customPrompterText, setCustomPrompterText] = useState(0);

  // Reset preview when modal opens
  useEffect(() => {
    if (isOpen) {
      setPreviewPresetId(currentPreset);
    }
  }, [isOpen, currentPreset]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onPhoneMockupChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const activePreset = getStylePreset(currentPreset);
  const previewPreset = getStylePreset(previewPresetId);
  const previewData = {
    ...previewPreset,
    bgOpacity: customBgOpacity,
    textOpacity: customTextOpacity,
    prompterBgTransparency: customPrompterBg,
    prompterTextVisibility: customPrompterText,
  };

  const handlePresetCardClick = (id: StylePresetId) => {
    setPreviewPresetId(id);
    // Live preview: temporarily apply the style to DOM
    const preset = getStylePreset(id);
    applyStylePresetToDOM(preset);
  };

  const handleApply = () => {
    onPresetChange(previewPresetId);
    onClose();
  };

  const handleCancel = () => {
    // Revert to the saved preset
    applyStylePresetToDOM(activePreset);
    setPreviewPresetId(currentPreset);
    onClose();
  };

  const presetEntries = Object.entries(STYLE_PRESETS) as [StylePresetId, StylePreset][];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border"
        style={{
          backgroundColor: activePreset.colors.bgSecondary,
          borderColor: activePreset.colors.border,
        }}
      >
        {/* Header */}
        <div
          className="p-5 border-b flex justify-between items-center"
          style={{ borderColor: activePreset.colors.border }}
        >
          <div>
            <h2
              className="text-lg font-bold flex items-center gap-2"
              style={{ color: activePreset.colors.textPrimary }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activePreset.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2" /><path d="M12 21v2" /><path d="M4.22 4.22l1.42 1.42" /><path d="M18.36 18.36l1.42 1.42" /><path d="M1 12h2" /><path d="M21 12h2" /><path d="M4.22 19.78l1.42-1.42" /><path d="M18.36 5.64l1.42-1.42" />
              </svg>
              风格设定
            </h2>
            <p
              className="text-xs mt-1"
              style={{ color: activePreset.colors.textSecondary }}
            >
              选择一套视觉风格，一键切换整个应用的外观。
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg transition-colors hover:bg-opacity-80"
            style={{
              color: activePreset.colors.textSecondary,
              backgroundColor: activePreset.colors.bgTertiary,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Style Preset Cards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {presetEntries.map(([id, preset]) => (
              <StylePreviewCard
                key={id}
                preset={preset}
                isActive={previewPresetId === id}
                onClick={() => handlePresetCardClick(id)}
              />
            ))}
          </div>

          {/* Background and Text Opacity Sliders (for editedPreset) */}
          <div
            className="rounded-xl p-4 space-y-4"
            style={{
              backgroundColor: previewData.colors.bgTertiary,
              borderColor: previewData.colors.border,
              border: '1px solid ' + previewData.colors.border,
            }}
          >
            <h4
              className="text-xs font-semibold"
              style={{ color: previewData.colors.textSecondary }}
            >
              通用透明度
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                  <span>背景透明</span>
                  <span className="text-amber-400 font-mono text-[10px] font-semibold">{previewData.bgOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={previewData.bgOpacity}
                  onChange={(e) => setCustomBgOpacity(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                  <span>文字透明</span>
                  <span className="text-amber-400 font-mono text-[10px] font-semibold">{previewData.textOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={previewData.textOpacity}
                  onChange={(e) => setCustomTextOpacity(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Prompter Background and Text Transparency Sliders (for editedPreset) */}
          <div
            className="rounded-xl p-4 space-y-4"
            style={{
              backgroundColor: previewData.colors.bgTertiary,
              borderColor: previewData.colors.border,
              border: '1px solid ' + previewData.colors.border,
            }}
          >
            <h4
              className="text-xs font-semibold"
              style={{ color: previewData.colors.textSecondary }}
            >
              提词框透明度
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                  <span>背景透明</span>
                  <span className="text-amber-400 font-mono text-[10px] font-semibold">{previewData.prompterBgTransparency}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={previewData.prompterBgTransparency}
                  onChange={(e) => setCustomPrompterBg(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                  <span>文字透明</span>
                  <span className="text-amber-400 font-mono text-[10px] font-semibold">{previewData.prompterTextVisibility}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={previewData.prompterTextVisibility}
                  onChange={(e) => setCustomPrompterText(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Phone Mockup Image */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              backgroundColor: previewData.colors.bgTertiary,
              borderColor: previewData.colors.border,
              border: '1px solid ' + previewData.colors.border,
            }}
          >
            <h4
              className="text-xs font-semibold"
              style={{ color: previewData.colors.textSecondary }}
            >
              首页手机样机图
            </h4>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              上传一张图片作为首页右上角的手机样机展示图。建议使用透明背景的 PNG 图片。
            </p>
            {phoneMockupImage ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center bg-gray-950/50 rounded-lg p-2">
                  <img
                    src={phoneMockupImage}
                    alt="当前样机图"
                    className="h-32 w-auto object-contain rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{
                      backgroundColor: previewData.colors.accent,
                      color: previewData.colors.accentText,
                    }}
                  >
                    更换图片
                  </button>
                  <button
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      onPhoneMockupChange('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'transparent',
                      color: previewData.colors.danger,
                      border: '1px solid ' + previewData.colors.danger,
                    }}
                  >
                    清除
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: previewData.colors.bgTertiary,
                    color: previewData.colors.textSecondary,
                    border: '1px dashed ' + previewData.colors.borderLight,
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  上传图片
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Color token display for current preview */}
          <div
            className="rounded-xl p-4 mt-2"
            style={{
              backgroundColor: previewData.colors.bgTertiary,
              borderColor: previewData.colors.border,
              border: '1px solid ' + previewData.colors.border,
            }}
          >
            <h4
              className="text-xs font-semibold mb-3"
              style={{ color: previewData.colors.textSecondary }}
            >
              色彩预览
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <ColorSwatch color={previewData.colors.bgPrimary} label="主背景" />
              <ColorSwatch color={previewData.colors.textPrimary} label="主文字" />
              <ColorSwatch color={previewData.colors.accent} label="强调色" />
              <ColorSwatch color={previewData.colors.border} label="边框" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t flex items-center justify-between gap-3"
          style={{ borderColor: activePreset.colors.border }}
        >
          <span
            className="text-[10px]"
            style={{ color: activePreset.colors.textMuted }}
          >
            预览中：{previewData.name} — 点击"应用"确认切换
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors"
              style={{
                backgroundColor: activePreset.colors.bgTertiary,
                color: activePreset.colors.textSecondary,
                border: '1px solid ' + activePreset.colors.border,
              }}
            >
              取消
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold rounded-lg transition-colors"
              style={{
                backgroundColor: activePreset.colors.accent,
                color: activePreset.colors.accentText,
              }}
            >
              应用此风格
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleSettingsModal;
