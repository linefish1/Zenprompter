/**
 * 智能语音跟读功能类型定义
 */

// 文本结构定义
export interface TextStructure {
  paragraphs: Paragraph[];
  sentences: Sentence[];
  keywords: string[];
  wordCount: number;
  timestamp: string;
}

export interface Paragraph {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  sentences: Sentence[];
}

export interface Sentence {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  paragraphId: string;
}

// 位置跟踪定义
export interface CurrentPosition {
  paragraphId?: string;
  sentenceId?: string;
  wordIndex?: number;
  characterIndex?: number;
}

export interface PositionHistoryItem {
  position: CurrentPosition;
  timestamp: string;
  confidence: number;
}

// 语音跟踪状态定义
export enum TrackingStatus {
  IDLE = 'idle',
  READY = 'ready',
  TRACKING = 'tracking',
  PAUSED = 'paused',
  ERROR = 'error'
}

// 语音识别状态定义
export enum RecognitionStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  READY = 'ready',
  RUNNING = 'running',
  ERROR = 'error'
}

export interface VoiceTrackingState {
  textStructure: TextStructure | null;
  trackingStatus: TrackingStatus;
  currentPosition: CurrentPosition | null;
  positionHistory: PositionHistoryItem[];
  performance: {
    lastMatchTime: number;
    averageMatchTime: number;
    confidenceScore: number;
  };
  settings: VoiceTrackingSettings;
}

// 语音跟踪设置定义
export interface VoiceTrackingSettings {
  highlightMode: 'character' | 'sentence';
  highlightColor: string;
  highlightSpeed: number;
  autoScroll: boolean;
  autoScrollSpeed: number; // 自动滚屏速度
  voiceSync: boolean;
  fontSize: number;
  sensitivity: number;
  language: string;
}

// 语音识别结果定义
export interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  isPrediction?: boolean; // 标记为预测结果
  predictionTimestamp?: number; // 预测时间戳
  timestamp: number;
}

// 位置更新结果定义
export interface PositionUpdate {
  position: CurrentPosition;
  confidence: number;
  isJump: boolean;
  isRepeat: boolean;
}

// 错误类型定义
export enum ErrorType {
  RECOGNITION_FAILED = 'recognition_failed',
  MATCHING_FAILED = 'matching_failed',
  MEMORY_LIMIT = 'memory_limit',
  NETWORK_ERROR = 'network_error',
  PERMISSION_DENIED = 'permission_denied'
}