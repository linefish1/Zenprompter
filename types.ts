// Style preset identifiers
export type StylePresetId = 'zen-dark' | 'apple-light';

// Style preset definition
export interface StylePreset {
  id: StylePresetId;
  name: string;
  description: string;
  // Color tokens
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    accentText: string;
    border: string;
    borderLight: string;
    danger: string;
    success: string;
  };
  // Typography
  typography: {
    fontFamily: string;
    headingWeight: string;
    bodyWeight: string;
  };
  // Spacing & decoration
  spacing: {
    borderRadius: string;
    containerPadding: string;
  };
  prompterBgTransparency?: number;
  prompterTextVisibility?: number;
}

export interface PrompterSettings {
  speed: number;
  fontSize: number;
  isMirrored: boolean;
  isPlaying: boolean;
  isEditing: boolean;
  fontFamily: 'sans' | 'serif' | 'mono';
  textColor: 'white' | 'yellow' | 'green' | 'cyan' | 'purple' | 'pink' | 'orange';
  bgColor: { h: number; s: number; l: number };
  bgOpacity: number;
  textOpacity: number;
  prompterBgTransparency: number; // 0 = fully opaque, 100 = fully transparent
  prompterTextVisibility: number; // 0 = fully invisible, 100 = fully visible
  // Style preset
  stylePreset: StylePresetId;
}

export interface ScriptSuggestion {
  title: string;
  content: string;
}

export interface TeleprompterDisplayProps {
  settings: PrompterSettings;
  text: string;
  onTextChange: (text: string) => void;
  togglePlay: () => void;
  onDisplayDoubleClick: () => void;
}

// Shared script library item — used by both AI creation and recording overlay
export interface ScriptLibraryItem {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  usageCount: number; // number of times loaded — for 热门台词库 ranking
}

export const SCRIPT_LIBRARY_KEY = 'tcq_script_library';

export enum AppMode {
  EDIT = 'EDIT',
  PROMPT = 'PROMPT'
}
