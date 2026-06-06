/**
 * usePermissionDiagnostics — 麦克风权限诊断 React Hook
 *
 * 用法：
 * ```tsx
 * const { state, report, runDiagnostic, repairSteps } = usePermissionDiagnostics();
 *
 * // 启动诊断
 * await runDiagnostic();
 *
 * // 渲染结果
 * <MicDiagnosticPanel state={state} report={report} steps={repairSteps} />
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import type { MicPermissionState, MicDiagnosticReport, RomHint } from './types';
import { runFullDiagnostic, quickCheckPermission, getGUMErrorDescription } from './permissionUtils';

export interface UsePermissionDiagnosticsResult {
  /** 当前权限状态 */
  state: MicPermissionState;
  /** 完整诊断报告（仅在 runDiagnostic 后可用） */
  report: MicDiagnosticReport | null;
  /** ROM 信息 */
  romHint: RomHint | null;
  /** 修复步骤列表 */
  repairSteps: string[];
  /** 是否正在检测中 */
  isRunning: boolean;
  /** 最后一次错误详情 */
  lastError: string | null;
  /** 运行完整诊断 */
  runDiagnostic: () => Promise<MicDiagnosticReport>;
  /** 快速检测权限（仅 getUserMedia） */
  quickCheck: () => Promise<MicPermissionState>;
  /** 重置状态 */
  reset: () => void;
}

export function usePermissionDiagnostics(): UsePermissionDiagnosticsResult {
  const [state, setState] = useState<MicPermissionState>('unknown');
  const [report, setReport] = useState<MicDiagnosticReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const runDiagnostic = useCallback(async (): Promise<MicDiagnosticReport> => {
    setIsRunning(true);
    setState('testing');
    setLastError(null);
    abortRef.current = false;

    try {
      const result = await runFullDiagnostic();

      if (abortRef.current) return result;

      setReport(result);
      setState(result.overall);
      setIsRunning(false);
      return result;
    } catch (err: any) {
      if (abortRef.current) {
        setIsRunning(false);
        return report!;
      }
      setState('denied');
      setLastError(err.message || '诊断过程出现意外错误');
      setIsRunning(false);
      throw err;
    }
  }, [report]);

  const quickCheck = useCallback(async (): Promise<MicPermissionState> => {
    setIsRunning(true);
    setLastError(null);

    try {
      const result = await quickCheckPermission();
      setState(result);
      setIsRunning(false);
      return result;
    } catch (err: any) {
      setState('denied');
      setLastError(err.message || '权限检测失败');
      setIsRunning(false);
      return 'denied';
    }
  }, []);

  const reset = useCallback(() => {
    setState('unknown');
    setReport(null);
    setLastError(null);
    abortRef.current = true;
  }, []);

  // 计算修复步骤
  const repairSteps = report?.repairSteps ?? [];
  const romHint = report?.romHint ?? null;

  return {
    state,
    report,
    romHint,
    repairSteps,
    isRunning,
    lastError,
    runDiagnostic,
    quickCheck,
    reset,
  };
}

// Re-export the error description helper for convenience
export { getGUMErrorDescription } from './permissionUtils';
