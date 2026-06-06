/**
 * 语音跟读 Skill - 可复用模块
 *
 * 将语音跟读功能打包成一个独立模块，可复制到任何 React 项目使用。
 *
 * ## 快速开始
 *
 * ```tsx
 * import { useVoiceTracking, VoiceTrackingRenderer, analyzeText } from './skills/voiceTracking';
 *
 * function MyComponent({ text }) {
 *   const textMeta = useMemo(() => analyzeText(text), [text]);
 *   const vt = useVoiceTracking({ text, settings, active: true });
 *
 *   return (
 *     <div>
 *       <VoiceTrackingRenderer
 *         textMeta={textMeta}
 *         matchedIndex={vt.matchedIndex}
 *         readIndices={vt.readIndices}
 *         nextSentenceId={vt.nextClauseId}
 *         upcomingClauseId={vt.upcomingClauseId}
 *       />
 *       <div>{vt.voiceStatus}</div>
 *     </div>
 *   );
 * }
 * ```
 */

// ===== 类型 =====
export type {
  VoiceTrackingSettings,
  RecognitionBackendConfig,
  RecognitionBackend,
  HighlightMode,
  CharacterSegment,
  Clause,
  TextMeta,
  RecognitionResult,
  MatchResult,
  VoiceStatus,
  VoiceTrackingContextValue,
  SentencePosition,
} from './types';

export { HighlightLevel } from './types';

// ===== 服务 =====
export {
  levenshteinDistance,
  fuzzyMatch,
} from './services/FuzzyMatcher';
export type { FuzzyMatchOptions, FuzzyMatchOutput } from './services/FuzzyMatcher';

export {
  analyzeText,
  buildSearchSpace,
  getVisibleNormRange,
  findClauseIdAt,
  findNextClauseId,
} from './services/TextAnalyzer';

export {
  WebSpeechRecognitionService,
  APIRecognitionService,
  createRecognitionService,
} from './services/SpeechRecognitionService';
export type { ISpeechRecognitionService, RecognitionCallbacks } from './services/SpeechRecognitionService';

// ===== Hook =====
export { useVoiceTracking } from './hooks/useVoiceTracking';
export type { UseVoiceTrackingOptions, UseVoiceTrackingResult } from './hooks/useVoiceTracking';
export { useAudioLevel } from './hooks/useAudioLevel';

// ===== 组件 =====
export { default as VoiceTrackingRenderer } from './components/VoiceTrackingRenderer';
export { default as VoiceTrackingSettingsPanel } from './components/VoiceTrackingSettingsPanel';
export { default as VoiceWaveform } from './components/VoiceWaveform';
