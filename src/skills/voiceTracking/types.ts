/**
 * 语音跟读 Skill - 统一类型定义
 *
 * 可复用到任何 React 项目，依赖: react, react-dom
 */

// ===== 语音识别配置 =====

/** 识别后端类型 */
export type RecognitionBackend = 'web-speech-api' | 'api';

/** 识别后端配置 */
export interface RecognitionBackendConfig {
  type: RecognitionBackend;
  /** API 模式下的端点 URL */
  apiUrl?: string;
  /** API 模式下的密钥 */
  apiKey?: string;
  /** API 模式下的模型名称 */
  apiModel?: string;
  /** 语言 (默认 zh-CN) */
  language?: string;
}

// ===== 高亮模式 =====

export type HighlightMode = 'character' | 'sentence';

// ===== 语音跟读设置 =====

export interface VoiceTrackingSettings {
  highlightMode: HighlightMode;
  highlightColor: string;
  highlightSpeed: number;
  autoScroll: boolean;
  autoScrollSpeed: number;
  voiceSync: boolean;
  fontSize: number;
  /** 识别后端 */
  backend: RecognitionBackendConfig;
}

// ===== 文本结构 =====

export interface CharacterSegment {
  char: string;
  isWordChar: boolean;
  normIndex: number;
}

export interface Clause {
  id: number;
  text: string;
  normalizedText: string;
  charStartIndex: number;
  charEndIndex: number;
  normStartIndex: number;
  normEndIndex: number;
  segIndices: number[];
}

export interface TextMeta {
  segments: CharacterSegment[];
  normalizedText: string;
  clauses: Clause[];
}

// ===== 语音识别结果 =====

export interface RecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

// ===== 匹配结果 =====

export interface MatchResult {
  index: number;
  score: number;
  dist: number;
}

// ===== 状态 =====

export type VoiceStatus =
  | 'idle'
  | 'initializing'
  | 'listening'
  | 'tracking'
  | 'reacquiring'
  | 'error'
  | 'no-speech'
  | 'no-permission';

// ===== 跟踪上下文值 =====

export interface VoiceTrackingContextValue {
  voiceStatus: VoiceStatus;
  matchedIndex: number;
  fatalError: boolean;
  readIndices: Set<number>;
  nextSentenceId: number | null;
  /** 即将读到的段落 clause ID（用于蓝绿背景高亮） */
  upcomingClauseId: number | null;
  /** 多子句预览集合，包含接下来 N 个要读的子句 */
  previewClauseIds: Set<number>;
  settings: VoiceTrackingSettings;
  updateSettings: (patch: Partial<VoiceTrackingSettings>) => void;
  isActive: boolean;
}

// ===== 高亮层级枚举 =====

export enum HighlightLevel {
  Read = 'read',
  Active = 'active',
  NextSentence = 'next-sentence',
  Upcoming = 'upcoming',
  Default = 'default',
}

// ===== 句子位置映射 =====

export interface SentencePosition {
  clauseId: number;
  normStartIndex: number;
  normEndIndex: number;
}
