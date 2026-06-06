/**
 * MicPermissionDiagnostics — 麦克风权限诊断面板
 *
 * 功能：
 * ① getUserMedia 底层探测
 * ② SpeechRecognition 可用性测试
 * ③ ROM 系统特征识别与针对性修复指引
 * ④ 二次确认（区分「用户主动拒绝」与「ROM 静默拦截」）
 * ⑤ 重试 + 重新启动语音跟随
 *
 * 适用场景：
 * - 桌面浏览器（Chrome / Edge / Safari）
 * - 手机 App（Capacitor WebView 内）
 * - 手机浏览器（通过 adb reverse + localhost 访问）
 */

import React, { useState, useCallback, useEffect } from 'react';
import type {
  MicPermissionState,
  MicDiagnosticReport,
  RomHint,
} from './types';
import { usePermissionDiagnostics, getGUMErrorDescription } from './usePermissionDiagnostics';

// ==================================================================
// 图标组件（内联 SVG，零依赖）
// ==================================================================

const MicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
    <path d="M12 2a10 10 0 019.95 9" strokeLinecap="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const WarnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ==================================================================
// 状态徽章
// ==================================================================

const StateBadge: React.FC<{ state: MicPermissionState }> = ({ state }) => {
  const map: Record<MicPermissionState, { label: string; color: string }> = {
    unknown: { label: '未检测', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
    testing: { label: '检测中…', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse' },
    granted: { label: '正常', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
    denied: { label: '已拒绝', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
    'no-hardware': { label: '无硬件', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
    occupied: { label: '被占用', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
    insecure: { label: '不安全协议', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
    'rom-blocked': { label: '系统拦截', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
    aborted: { label: '已中断', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  };
  const { label, color } = map[state] ?? map.unknown;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
};

// ==================================================================
// ROM 提示卡片
// ==================================================================

const RomHintCard: React.FC<{ romHint: RomHint }> = ({ romHint }) => (
  <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
    <div className="flex items-center gap-2 mb-2">
      <WarnIcon />
      <span className="text-amber-400 font-semibold text-xs">
        检测到 {romHint.vendorNameCN}
      </span>
    </div>
    <p className="text-white/60 text-[11px] leading-relaxed mb-2">
      {romHint.description}
    </p>
    <div className="text-white/60 text-[11px] space-y-1">
      <p className="text-amber-300/80 font-medium">系统设置路径：</p>
      {romHint.repairSteps.map((step, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="text-amber-400/60 shrink-0 mt-0.5">•</span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  </div>
);

// ==================================================================
// 诊断步骤行
// ==================================================================

interface StepRowProps {
  label: string;
  status: 'pending' | 'running' | 'success' | 'fail' | 'skipped';
  detail?: string;
}

const StepRow: React.FC<StepRowProps> = ({ label, status, detail }) => {
  const statusIcon = {
    pending: <div className="w-4 h-4 rounded-full border border-gray-600" />,
    running: <SpinnerIcon />,
    success: <CheckIcon />,
    fail: <XIcon />,
    skipped: <div className="w-4 h-4 rounded-full border border-gray-700 bg-gray-800" />,
  }[status];

  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="shrink-0 mt-0.5">{statusIcon}</div>
      <div className="min-w-0">
        <span className="text-white/80 text-xs">{label}</span>
        {detail && (
          <p className="text-white/40 text-[10px] mt-0.5 break-all">{detail}</p>
        )}
      </div>
    </div>
  );
};

// ==================================================================
// 修复指引列表
// ==================================================================

const RepairGuide: React.FC<{ steps: string[] }> = ({ steps }) => {
  if (steps.length === 0) return null;
  return (
    <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
      <p className="text-blue-400 font-semibold text-xs mb-2">修复步骤：</p>
      <ol className="list-decimal list-inside text-white/60 text-[11px] space-y-1.5">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
};

// ==================================================================
// 二次确认弹窗（区分用户拒绝 vs ROM 拦截）
// ==================================================================

interface RomBlockConfirmProps {
  isOpen: boolean;
  onUserRejected: () => void;
  onRomBlocked: () => void;
  onRetry: () => void;
}

const RomBlockConfirm: React.FC<RomBlockConfirmProps> = ({
  isOpen,
  onUserRejected,
  onRomBlocked,
  onRetry,
}) => {
  if (!isOpen) return null;
  return (
    <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
      <p className="text-red-400 font-semibold text-xs mb-2">
        请确认以下信息以帮助精准诊断：
      </p>
      <div className="space-y-2">
        <button
          onClick={onUserRejected}
          className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20
                     text-red-300 border border-red-500/20 transition-colors text-left"
        >
          我在弹窗中点击了「拒绝」或「禁止」
        </button>
        <button
          onClick={onRomBlocked}
          className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20
                     text-amber-300 border border-amber-500/20 transition-colors text-left"
        >
          我在弹窗中点击了「允许」，但仍然失败了
        </button>
        <button
          onClick={onRetry}
          className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-gray-500/10 hover:bg-gray-500/20
                     text-gray-300 border border-gray-500/20 transition-colors text-left"
        >
          没有看到弹窗，直接失败了
        </button>
      </div>
    </div>
  );
};

// ==================================================================
// 主组件
// ==================================================================

interface MicPermissionDiagnosticsProps {
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 诊断完成后调用（可用于通知父组件更新状态） */
  onDiagnosticComplete?: (report: MicDiagnosticReport) => void;
  /** 重试语音跟随时调用 */
  onRestartVoiceTracking?: () => void;
  /** 紧凑模式（用于嵌入 RecordingOverlay 内） */
  compact?: boolean;
}

const MicPermissionDiagnostics: React.FC<MicPermissionDiagnosticsProps> = ({
  defaultExpanded = false,
  onDiagnosticComplete,
  onRestartVoiceTracking,
  compact = false,
}) => {
  const {
    state,
    report,
    romHint,
    repairSteps,
    isRunning,
    lastError,
    runDiagnostic,
    quickCheck,
    reset,
  } = usePermissionDiagnostics();

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showRomConfirm, setShowRomConfirm] = useState(false);

  // 自动展开诊断区域
  useEffect(() => {
    if (state !== 'unknown' && state !== 'granted') {
      setExpanded(true);
    }
  }, [state]);

  // 处理完整诊断 + 二次确认逻辑
  const handleRunDiagnostic = useCallback(async () => {
    setShowRomConfirm(false);
    const result = await runDiagnostic();

    if (result.overall === 'rom-blocked') {
      // 弹出二次确认区分「用户拒绝」与「ROM 拦截」
      setShowRomConfirm(true);
    }

    onDiagnosticComplete?.(result);
  }, [runDiagnostic, onDiagnosticComplete]);

  const handleQuickCheck = useCallback(async () => {
    await quickCheck();
  }, [quickCheck]);

  const handleUserRejected = useCallback(() => {
    setShowRomConfirm(false);
    // 用户主动拒绝 — 显示常规拒绝指引
  }, []);

  const handleRomBlocked = useCallback(() => {
    setShowRomConfirm(false);
    // ROM 拦截 — 已在 report.romHint 中提供详细信息
  }, []);

  const handleRetry = useCallback(async () => {
    setShowRomConfirm(false);
    await handleRunDiagnostic();
  }, [handleRunDiagnostic]);

  // ========== 渲染 ==========

  if (compact) {
    return (
      <div className="space-y-2">
        {/* 紧凑头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StateBadge state={state} />
            {isRunning && <SpinnerIcon />}
          </div>
          <div className="flex gap-1.5">
            {state === 'unknown' || state === 'aborted' || state === 'denied' || state === 'rom-blocked' ? (
              <button
                onClick={handleRunDiagnostic}
                disabled={isRunning}
                className="px-2.5 py-1 rounded text-[10px] font-semibold
                           bg-amber-500 hover:bg-amber-400 text-black transition-colors
                           disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-wait"
              >
                {isRunning ? '检测中…' : '🔬 诊断'}
              </button>
            ) : null}
            {state === 'granted' && onRestartVoiceTracking && (
              <button
                onClick={onRestartVoiceTracking}
                className="px-2.5 py-1 rounded text-[10px] font-semibold
                           bg-green-500/20 hover:bg-green-500/30 text-green-400
                           border border-green-400/20 transition-colors"
              >
                启动语音跟随
              </button>
            )}
          </div>
        </div>

        {/* 简化错误信息 */}
        {report?.gUM && !report.gUM.success && (
          <p className="text-red-400/80 text-[11px]">
            {getGUMErrorDescription(report.gUM.errorName || '').title}
            {report.gUM.errorName === 'NotAllowedError' && romHint && (
              <span className="text-amber-400"> — 可能是 {romHint.vendorNameCN} 拦截</span>
            )}
          </p>
        )}

        {/* 修复指引（仅当有修复建议时） */}
        {repairSteps.length > 0 && state !== 'granted' && (
          <RepairGuide steps={repairSteps} />
        )}
      </div>
    );
  }

  // ========== 完整面板 ==========

  return (
    <div className="space-y-3">
      {/* 折叠头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold text-xs transition-colors w-full"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        麦克风权限诊断与修复
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span className="ml-auto"><StateBadge state={state} /></span>
      </button>

      {expanded && (
        <div className="space-y-3 pl-1">
          {/* 步骤诊断结果 */}
          {report && (
            <div className="space-y-0">
              <StepRow
                label="① getUserMedia 底层探测"
                status={report.gUM.success ? 'success' : 'fail'}
                detail={
                  report.gUM.success
                    ? `耗时 ${Math.round(report.gUM.durationMs)}ms`
                    : `${report.gUM.errorName}: ${report.gUM.errorMessage}`
                }
              />
              <StepRow
                label="② SpeechRecognition API 测试"
                status={
                  report.speechRecog.errorName === null ? 'success' :
                  report.speechRecog.errorName === 'aborted' ? 'success' : 'fail'
                }
                detail={
                  report.speechRecog.supported
                    ? `启动: ${report.speechRecog.started ? '成功' : '失败'}${report.speechRecog.errorName ? ` (${report.speechRecog.errorName})` : ''}`
                    : '不支持 SpeechRecognition'
                }
              />
              {romHint && (
                <StepRow
                  label="③ ROM 系统特征识别"
                  status="fail"
                  detail={`${romHint.vendorNameCN} — 可能存在系统级拦截`}
                />
              )}
            </div>
          )}

          {/* 诊断详情（gUM 错误详情） */}
          {report?.gUM && !report.gUM.success && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <p className="text-red-400 font-semibold text-xs mb-1">
                {getGUMErrorDescription(report.gUM.errorName || '').title}
              </p>
              <p className="text-white/60 text-[11px] leading-relaxed">
                {getGUMErrorDescription(report.gUM.errorName || '').description}
              </p>
              <p className="text-amber-400/80 text-[11px] mt-1.5">
                {getGUMErrorDescription(report.gUM.errorName || '').action}
              </p>
            </div>
          )}

          {/* ROM 提示卡片 */}
          {romHint && state === 'rom-blocked' && (
            <RomHintCard romHint={romHint} />
          )}

          {/* 二次确认 */}
          <RomBlockConfirm
            isOpen={showRomConfirm}
            onUserRejected={handleUserRejected}
            onRomBlocked={handleRomBlocked}
            onRetry={handleRetry}
          />

          {/* 修复指引 */}
          <RepairGuide steps={repairSteps} />

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRunDiagnostic}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isRunning
                  ? 'bg-gray-700 text-gray-400 cursor-wait'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {isRunning && <SpinnerIcon />}
                {isRunning ? '检测中…' : '🔬 完整诊断'}
              </span>
            </button>

            <button
              onClick={handleQuickCheck}
              disabled={isRunning}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold
                         bg-white/10 hover:bg-white/20 text-white transition-colors
                         disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-wait"
            >
              快速检测
            </button>

            {state !== 'unknown' && (
              <button
                onClick={reset}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                           text-gray-400 hover:text-white transition-colors"
              >
                重置
              </button>
            )}
          </div>

          {/* SpeechRecognition 特定提示 */}
          {report?.speechRecog && !report.speechRecog.supported && (
            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-amber-400/80 text-[11px]">
                当前浏览器不支持语音识别。请使用 Chrome 或 Edge 浏览器。Safari/Firefox 的 SpeechRecognition API 已废弃或不可用。
              </p>
            </div>
          )}

          {/* 重试语音跟随 */}
          {state === 'granted' && onRestartVoiceTracking && (
            <button
              onClick={onRestartVoiceTracking}
              className="w-full px-3 py-2 rounded-lg text-xs font-semibold
                         bg-green-500/20 hover:bg-green-500/30 text-green-400
                         border border-green-400/20 transition-colors"
            >
              权限正常，重新启动语音跟随
            </button>
          )}

          {/* 平台信息（调试用） */}
          {report?.platform && (
            <div className="text-white/20 text-[9px] space-y-0.5 pt-1 border-t border-white/5">
              <p>OS: {report.platform.os} · Browser: {report.platform.browser}</p>
              <p>Native: {report.platform.isCapacitorNative ? 'yes' : 'no'} · Lang: {report.platform.language}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MicPermissionDiagnostics;
