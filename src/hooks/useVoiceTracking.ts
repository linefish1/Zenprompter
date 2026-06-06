/**
 * useVoiceTracking - 语音跟读 Hook
 *
 * 从 Skill 模块重新导出，保持向后兼容。
 * 新代码请直接 import from '../skills/voiceTracking';
 */

export {
  useVoiceTracking,
} from '../skills/voiceTracking/hooks/useVoiceTracking';

export type {
  UseVoiceTrackingOptions,
  UseVoiceTrackingResult,
} from '../skills/voiceTracking/hooks/useVoiceTracking';
