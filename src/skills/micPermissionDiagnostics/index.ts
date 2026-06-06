/**
 * 麦克风权限诊断模块
 *
 * 提供完整的两层诊断能力：
 * - Web 端：getUserMedia 底层探测 + SpeechRecognition 测试
 * - 移动端：ROM 特征识别 + 针对性修复指引
 *
 * 用法：
 * ```tsx
 * import MicPermissionDiagnostics from 'src/skills/micPermissionDiagnostics';
 * import { usePermissionDiagnostics } from 'src/skills/micPermissionDiagnostics';
 *
 * // UI 组件
 * <MicPermissionDiagnostics onRestartVoiceTracking={handleRestart} />
 *
 * // 或者只用 Hook 做逻辑层
 * const { state, runDiagnostic } = usePermissionDiagnostics();
 * ```
 */

export { default } from './MicPermissionDiagnostics';
export { usePermissionDiagnostics } from './usePermissionDiagnostics';
export {
  runFullDiagnostic,
  quickCheckPermission,
  getGUMErrorDescription,
  detectRom,
} from './permissionUtils';
export type {
  MicPermissionState,
  GetUserMediaResult,
  SpeechRecognitionResult,
  MicDiagnosticReport,
  RomHint,
} from './types';
