import { StylePreset, StylePresetId } from '../types';

/**
 * Predefined style presets.
 * Each preset is a complete set of design tokens that can be applied globally.
 */

export const STYLE_PRESETS: Record<StylePresetId, StylePreset> = {
  'zen-dark': {
    id: 'zen-dark',
    name: 'Zen 暗夜',
    description: '沉浸式暗色主题，琥珀高亮，适合长时间专注阅读与录制',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#111827',
      bgTertiary: '#1F2937',
      textPrimary: '#FFFFFF',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      accent: '#F59E0B',
      accentHover: '#D97706',
      accentText: '#000000',
      border: '#1F2937',
      borderLight: '#374151',
      danger: '#EF4444',
      success: '#10B981',
    },
    typography: {
      fontFamily: "'Inter', 'PingFang SC', 'SF Pro Display', -apple-system, sans-serif",
      headingWeight: '700',
      bodyWeight: '400',
    },
    spacing: {
      borderRadius: '12px',
      containerPadding: '24px',
    },
  },

  'apple-light': {
    id: 'apple-light',
    name: 'Apple 极简',
    description: '遵循 Apple 设计美学：简洁克制，高级留白，以内容为中心',
    colors: {
      bgPrimary: '#FFFFFF',
      bgSecondary: '#F5F5F7',
      bgTertiary: '#E5E5E7',
      textPrimary: '#1D1D1F',
      textSecondary: '#86868B',
      textMuted: '#AEAEB2',
      accent: '#007AFF',
      accentHover: '#0066CC',
      accentText: '#FFFFFF',
      border: '#E5E5E7',
      borderLight: '#F0F0F2',
      danger: '#FF3B30',
      success: '#34C759',
    },
    typography: {
      fontFamily: "'Inter', 'SF Pro Display', 'PingFang SC', -apple-system, sans-serif",
      headingWeight: '600',
      bodyWeight: '400',
    },
    spacing: {
      borderRadius: '8px',
      containerPadding: '24px',
    },
  },
};

/**
 * Get a style preset by ID. Falls back to zen-dark if not found.
 */
export function getStylePreset(id: StylePresetId): StylePreset {
  return STYLE_PRESETS[id] ?? STYLE_PRESETS['zen-dark'];
}

/**
 * Apply a style preset to the document root via CSS custom properties.
 */
export function applyStylePresetToDOM(preset: StylePreset): void {
  const root = document.documentElement;
  const { colors, typography, spacing } = preset;

  // Colors
  root.style.setProperty('--zen-bg-primary', colors.bgPrimary);
  root.style.setProperty('--zen-bg-secondary', colors.bgSecondary);
  root.style.setProperty('--zen-bg-tertiary', colors.bgTertiary);
  root.style.setProperty('--zen-text-primary', colors.textPrimary);
  root.style.setProperty('--zen-text-secondary', colors.textSecondary);
  root.style.setProperty('--zen-text-muted', colors.textMuted);
  root.style.setProperty('--zen-accent', colors.accent);
  root.style.setProperty('--zen-accent-hover', colors.accentHover);
  root.style.setProperty('--zen-accent-text', colors.accentText);
  root.style.setProperty('--zen-border', colors.border);
  root.style.setProperty('--zen-border-light', colors.borderLight);
  root.style.setProperty('--zen-danger', colors.danger);
  root.style.setProperty('--zen-success', colors.success);

  // Typography
  root.style.setProperty('--zen-font-family', typography.fontFamily);
  root.style.setProperty('--zen-heading-weight', typography.headingWeight);
  root.style.setProperty('--zen-body-weight', typography.bodyWeight);

  // Spacing
  root.style.setProperty('--zen-border-radius', spacing.borderRadius);
  root.style.setProperty('--zen-container-padding', spacing.containerPadding);

  // Store current preset ID
  root.setAttribute('data-style-preset', preset.id);
}

/**
 * Get the complementary background for the teleprompter display area.
 * For dark themes: near-black. For light themes: off-white.
 */
export function getDisplayBackground(preset: StylePreset): string {
  return preset.id === 'apple-light' ? '#FAFAFA' : '#000000';
}
