/**
 * 麦克风权限诊断 — 统一类型定义
 *
 * 覆盖两个维度：
 * - Web 端：getUserMedia 底层探测 + SpeechRecognition 测试
 * - 移动端：Capacitor 原生权限 + ROM 特定拦截诊断
 */

/** 麦克风权限综合状态 */
export type MicPermissionState =
  | 'unknown'        // 尚未检测
  | 'testing'        // 检测中
  | 'granted'        // 完全正常
  | 'denied'         // 明确拒绝（NotAllowedError）
  | 'no-hardware'    // 无麦克风硬件（NotFoundError）
  | 'occupied'       // 被其他应用占用（NotReadableError）
  | 'insecure'       // 非安全协议（SecurityError — 需要 HTTPS/localhost）
  | 'rom-blocked'    // 系统/ROM 静默拦截（弹窗点了允许但报 NotAllowedError）
  | 'aborted'        // 操作被取消（AbortError — 可重试）

/** 单次 getUserMedia 诊断结果 */
export interface GetUserMediaResult {
  success: boolean;
  errorName: string | null;
  errorMessage: string | null;
  /** 根据错误类型的推断状态 */
  inferredState: MicPermissionState;
  /** 耗时 ms */
  durationMs: number;
}

/** SpeechRecognition 可用性诊断 */
export interface SpeechRecognitionResult {
  supported: boolean;
  initialized: boolean;
  started: boolean;
  errorName: string | null;
  errorMessage: string | null;
}

/** 完整诊断报告 */
export interface MicDiagnosticReport {
  timestamp: number;
  /** 平台信息 */
  platform: {
    os: string;
    browser: string;
    isCapacitorNative: boolean;
    userAgent: string;
    language: string;
  };
  /** getUserMedia 层诊断 */
  gUM: GetUserMediaResult;
  /** SpeechRecognition 层诊断 */
  speechRecog: SpeechRecognitionResult;
  /** 综合判定 */
  overall: MicPermissionState;
  /** ROM 特定判定 */
  romHint: RomHint | null;
  /** 修复建议 */
  repairSteps: string[];
}

/** ROM 系统特征信息 */
export interface RomHint {
  /** ROM 厂商名称 */
  vendor: string;
  /** 中文名称 */
  vendorNameCN: string;
  /** 系统判定拦截的特征描述 */
  description: string;
  /** 针对此 ROM 的修复步骤 */
  repairSteps: string[];
}

/** ROM 检测规则 */
export interface RomDetectionRule {
  vendor: string;
  vendorNameCN: string;
  /** 返回 true 表示匹配 */
  detect: (ua: string) => boolean;
  /** 匹配时的拦截特征描述 */
  description: string;
  /** 系统设置路径指引 */
  settingsPath: string;
}
