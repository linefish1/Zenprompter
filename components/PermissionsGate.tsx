import React, { useState, useCallback } from 'react';
import { detectRom } from '../src/skills/micPermissionDiagnostics/permissionUtils';
import { requestWithDiagnostics, openAppSettings } from '../src/skills/micPermissionDiagnostics/nativeBridge';
import type { MicPermissionState } from '../src/skills/micPermissionDiagnostics/types';

const PERMISSIONS_KEY = 'zen_permissions_requested';

interface PermissionItem {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'granted' | 'denied' | 'unavailable' | 'error';
  errorMessage?: string;
  /** 详细错误类型（仅麦克风） */
  micErrorType?: MicPermissionState;
  /** 是否需要重启 App 才能生效 */
  needsRestart?: boolean;
}

interface PermissionsGateProps {
  onComplete: () => void;
}

const MicIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const CameraIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
    <path d="M23 7l-7 5 7 5V7z"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const StorageIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
);

const checkMediaDevicesAvailable = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

/**
 * 请求麦克风权限（参考 voice-tracking-test.html 验证过的路径）
 *
 * 策略：getUserMedia 直接探测（和测试页一样的方式）。
 * 在 Capacitor WebView 中，MainActivity 已配置 onPermissionRequest 桥接，
 * 系统 RECORD_AUDIO 授权后自动传递给 WebView。
 *
 * 如果 getUserMedia 直接失败，说明系统级权限尚未授予，
 * 此时通过 Capacitor 插件触发 Android 系统权限对话框。
 * 系统授权后再试 getUserMedia。如仍失败，提示重启 App。
 */
const requestMicrophone = async (): Promise<{
  success: boolean;
  errorType?: MicPermissionState;
  errorDetail?: string;
  needsRestart?: boolean;
}> => {
  // ── 第 1 次尝试：getUserMedia 直接探测（与测试页相同方式）──
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    return { success: true };
  } catch (firstErr: any) {
    // getUserMedia 失败 → 可能是系统权限尚未授予
    // 不立即报错，先尝试通过 Capacitor 插件请求系统权限
    const errorName = firstErr.name || '';
    console.log('First getUserMedia failed:', errorName, firstErr.message);
  }

  // ── 第 2 次尝试：原生 Android 权限请求 + 诊断 ──
  // 使用 MicPermissionPlugin (MainActivity.java 注册)，
  // 通过 shouldShowRequestPermissionRationale() 精确区分 ROM 拦截 vs 用户拒绝
  try {
    // 优先使用原生插件（支持 shouldShowRationale 诊断）
    const nativeResult = await requestWithDiagnostics();

    if (nativeResult) {
      // 原生插件可用 → 使用精确诊断结果
      if (nativeResult.granted) {
        // 系统权限已授予 → 再次尝试 getUserMedia
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          return { success: true };
        } catch (webErr: any) {
          return {
            success: false,
            errorType: 'rom-blocked',
            errorDetail:
              'Android 系统权限已授予 ✅，但 WebView 尚未同步。请退出 App 后重新打开。',
            needsRestart: true,
          };
        }
      }

      // 权限未授予 → 显示精确诊断
      if (nativeResult.romBlockSuspected) {
        // DENIED + shouldShowRationale=false → 系统 ROM 静默拦截
        return {
          success: false,
          errorType: 'rom-blocked',
          errorDetail:
            nativeResult.diagnosis ||
            '系统静默拦截了麦克风权限（ROM 特征：DENIED + shouldShowRationale=false）。请在系统设置中手动开启。',
        };
      }

      // DENIED + shouldShowRationale=true → 用户主动拒绝
      return {
        success: false,
        errorType: 'denied',
        errorDetail: '您点击了拒绝。请在系统设置中手动开启麦克风权限。',
      };
    }
  } catch {
    // 原生插件不可用 → 回退到 Capacitor 语音识别插件
  }

  // ── 回退：Capacitor 语音识别插件 ──
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() === 'web') {
      return {
        success: false,
        errorType: 'denied',
        errorDetail: '浏览器拒绝了麦克风访问。请检查地址栏站点设置。',
      };
    }

    const mod = await import('@capgo/capacitor-speech-recognition');
    const requestResult = await mod.SpeechRecognition.requestPermissions();
    if (requestResult?.speechRecognition !== 'granted') {
      return {
        success: false,
        errorType: 'denied',
        errorDetail: '系统权限被拒绝。请在系统设置中手动开启。',
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return { success: true };
    } catch (webErr: any) {
      return {
        success: false,
        errorType: 'rom-blocked',
        errorDetail: '系统权限已授予，但 WebView 尚未同步。请退出 App 后重新打开。',
        needsRestart: true,
      };
    }
  } catch {
    return {
      success: false,
      errorType: 'denied',
      errorDetail: '无法完成权限设置。请确保 App 已正确安装。',
    };
  }
};

/**
 * 请求摄像头权限（与麦克风相同策略：getUserMedia 优先 → 插件回退）
 */
const requestCamera = async (): Promise<{
  success: boolean;
  errorDetail?: string;
  needsRestart?: boolean;
}> => {
  // 第 1 次尝试：getUserMedia 直接探测
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
    return { success: true };
  } catch (firstErr: any) {
    console.log('First camera getUserMedia failed:', firstErr.name);
  }

  // 第 2 次尝试：通过 Capacitor Camera 插件请求系统权限
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() === 'web') {
      return {
        success: false,
        errorDetail: '浏览器拒绝了摄像头访问。请检查地址栏站点设置。',
      };
    }

    const { Camera } = await import('@capacitor/camera');

    // 先检查已有权限
    const checkResult = await Camera.checkPermissions();
    if (checkResult.camera !== 'granted') {
      // 请求系统权限（弹系统对话框）
      const requestResult = await Camera.requestPermissions();
      if (requestResult.camera !== 'granted') {
        return {
          success: false,
          errorDetail: '系统权限被拒绝。请在系统设置中手动开启摄像头权限。',
        };
      }
    }

    // 系统权限已授予 → 再试 getUserMedia
    // MainActivity 的 onPermissionRequest 已将系统权限桥接到 WebView
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      return { success: true };
    } catch (secondErr: any) {
      return {
        success: false,
        errorDetail: '系统权限已授予，但 WebView 尚未同步。请退出 App 后重新打开。',
        needsRestart: true,
      };
    }
  } catch {
    return {
      success: false,
      errorDetail: '无法完成摄像头权限设置。',
    };
  }
};

const requestStorage = async (): Promise<boolean> => {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      if (granted) return true;
    }
    // Fallback: test that localStorage actually works
    try {
      localStorage.setItem('__perm_test__', '1');
      localStorage.removeItem('__perm_test__');
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
};

/**
 * 根据 MicPermissionState 生成用户友好的错误信息
 */
function getMicErrorMessage(errorType: MicPermissionState): string {
  switch (errorType) {
    case 'rom-blocked':
      return '系统可能静默拦截了麦克风权限（如小米 MIUI、OPPO ColorOS 等 ROM 的隐私保护策略）。建议到系统「设置」中手动开启。';
    case 'no-hardware':
      return '未检测到麦克风硬件。请检查设备是否连接了麦克风。';
    case 'occupied':
      return '麦克风正被其他应用占用，请关闭其他录音应用后重试。';
    case 'insecure':
      return '需要安全连接（HTTPS 或 localhost）才能访问麦克风。';
    case 'aborted':
      return '权限检测被中断，请重试。';
    default:
      return '麦克风权限请求失败。';
  }
}

/**
 * 获取 ROM 特定的修复指引
 */
function getRomGuidance(): { title: string; steps: string[] } | null {
  const rom = detectRom();
  if (!rom) return null;
  return {
    title: `检测到您的设备: ${rom.vendorNameCN}`,
    steps: rom.repairSteps,
  };
}

const PermissionsGate: React.FC<PermissionsGateProps> = ({ onComplete }) => {
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      key: 'microphone',
      label: '麦克风权限',
      description: '用于语音模式，实时识别您的语音并跟随语速自动滚动提词器',
      icon: <MicIcon />,
      status: checkMediaDevicesAvailable() ? 'pending' : 'unavailable',
    },
    {
      key: 'camera',
      label: '摄像头权限',
      description: '用于录制演示视频，将摄像头画面与提词器画面一同录制保存',
      icon: <CameraIcon />,
      status: checkMediaDevicesAvailable() ? 'pending' : 'unavailable',
    },
    {
      key: 'storage',
      label: '本地存储权限',
      description: '用于持久保存您的脚本和设置数据，确保关闭应用后数据不会丢失',
      icon: <StorageIcon />,
      status: 'pending',
    },
  ]);
  const [requestingIndex, setRequestingIndex] = useState<number | null>(null);

  const handleRequest = useCallback(async (index: number) => {
    if (requestingIndex !== null) return;
    const item = permissions[index];
    if (item.status !== 'pending') return;

    setRequestingIndex(index);

    try {
      switch (item.key) {
        case 'microphone': {
          const result = await requestMicrophone();
          setPermissions(prev =>
            prev.map((p, i) =>
              i === index
                ? {
                    ...p,
                    status: result.success ? 'granted' : 'error',
                    errorMessage: result.success
                      ? undefined
                      : (result.errorDetail || getMicErrorMessage(result.errorType || 'denied')),
                    micErrorType: result.success ? undefined : result.errorType,
                    needsRestart: result.needsRestart || false,
                  }
                : p
            )
          );
          break;
        }
        case 'camera': {
          const result = await requestCamera();
          setPermissions(prev =>
            prev.map((p, i) =>
              i === index
                ? {
                    ...p,
                    status: result.success ? 'granted' : 'error',
                    errorMessage: result.success ? undefined : result.errorDetail,
                    needsRestart: result.needsRestart || false,
                  }
                : p
            )
          );
          break;
        }
        case 'storage': {
          const success = await requestStorage();
          setPermissions(prev =>
            prev.map((p, i) =>
              i === index
                ? { ...p, status: success ? 'granted' : 'denied' }
                : p
            )
          );
          break;
        }
      }
    } finally {
      setRequestingIndex(null);
    }
  }, [requestingIndex, permissions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'granted':
        return (
          <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
            已授权
          </span>
        );
      case 'denied':
        return (
          <span className="text-xs font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
            已拒绝
          </span>
        );
      case 'error':
        return (
          <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
            检测异常
          </span>
        );
      case 'unavailable':
        return (
          <span className="text-xs font-medium text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-full border border-gray-500/20">
            不可用
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium text-gray-400 bg-gray-400/10 px-2 py-0.5 rounded-full border border-gray-400/20">
            待授权
          </span>
        );
    }
  };

  const getButton = (item: PermissionItem, index: number) => {
    if (item.status === 'granted') {
      return (
        <button
          disabled
          className="px-4 py-1.5 text-xs font-medium rounded-lg bg-green-500/20 text-green-400 border border-green-400/20 cursor-default"
        >
          已授权
        </button>
      );
    }
    if (item.status === 'unavailable') {
      return (
        <button
          disabled
          className="px-4 py-1.5 text-xs font-medium rounded-lg bg-gray-500/10 text-gray-500 border border-gray-500/20 cursor-default"
        >
          不可用
        </button>
      );
    }
    if (item.status === 'denied' || item.status === 'error') {
      return (
        <button
          onClick={() => {
            // 允许重新请求
            setPermissions(prev =>
              prev.map((p, i) =>
                i === index ? { ...p, status: 'pending' as const, errorMessage: undefined, micErrorType: undefined } : p
              )
            );
          }}
          disabled={requestingIndex !== null}
          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
            requestingIndex === index
              ? 'bg-amber-500/30 text-amber-300 border border-amber-500/30 animate-pulse'
              : 'bg-amber-500 hover:bg-amber-400 text-white border border-amber-500/30 hover:border-amber-400/30'
          }`}
        >
          {requestingIndex === index ? '请求中...' : '重试'}
        </button>
      );
    }
    return (
      <button
        onClick={() => handleRequest(index)}
        disabled={requestingIndex !== null}
        className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
          requestingIndex === index
            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/30 animate-pulse'
            : 'bg-amber-500 hover:bg-amber-400 text-white border border-amber-500/30 hover:border-amber-400/30'
        }`}
      >
        {requestingIndex === index ? '请求中...' : '授权'}
      </button>
    );
  };

  // ROM 指引
  const romGuidance = getRomGuidance();
  const micItem = permissions.find(p => p.key === 'microphone');
  const cameraItem = permissions.find(p => p.key === 'camera');
  const anyNeedsRestart = permissions.some(p => p.needsRestart);
  const hasDetailedError = (item: PermissionItem) =>
    item.status === 'error' && !!item.errorMessage;

  return (
    <div className="absolute inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-8">
      <div className="bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">权限申请</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            ZenPrompter 需要以下权限来提供完整功能。请逐一授权，您可以跳过暂时不需要的权限。
          </p>
        </div>

        {/* Permission Cards */}
        <div className="space-y-3 flex-1">
          {permissions.map((item, index) => (
            <div
              key={item.key}
              className="flex items-start gap-4 p-4 rounded-xl bg-gray-900/60 border border-gray-700/50"
            >
              {item.icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium text-sm">{item.label}</span>
                  {getStatusBadge(item.status)}
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">{item.description}</p>
                {/* Detail error message (mic specific) */}
                {hasDetailedError(item) && (item.key === 'microphone' || item.key === 'camera') && item.errorMessage && (
                  <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/10">
                    <p className="text-red-400/80 text-[11px] leading-relaxed">{item.errorMessage}</p>
                    {item.needsRestart && (
                      <p className="text-amber-400/80 text-[11px] leading-relaxed mt-1.5 font-semibold">
                        请先点「继续使用」进入 App，然后从最近任务中完全退出 App，再重新打开即可正常使用麦克风。
                      </p>
                    )}
                    {!item.needsRestart && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await openAppSettings();
                        }}
                        className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                                   bg-amber-500 hover:bg-amber-400 text-black transition-colors
                                   flex items-center gap-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        打开系统设置
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="shrink-0 pt-0.5">
                {getButton(item, index)}
              </div>
            </div>
          ))}
        </div>

        {/* ROM specific guidance (only if NOT a restart-needed situation) */}
        {(micItem?.status === 'error' || cameraItem?.status === 'error') && !anyNeedsRestart && romGuidance && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-amber-400 font-semibold text-xs mb-2">
              {romGuidance.title}
            </p>
            <div className="text-white/60 text-[11px] space-y-1">
              {romGuidance.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-400/60 shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Denied/Error explanation */}
        {permissions.some(p => p.status === 'denied' || p.status === 'error') && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            {anyNeedsRestart ? (
              <p className="text-amber-400/80 text-xs leading-relaxed">
                系统权限已授予 ✅，但 WebView 需要重启 App 才能同步权限状态。请点「继续使用」进入 App 后，从最近任务中完全退出，再重新打开。
              </p>
            ) : (
              <p className="text-amber-400/80 text-xs leading-relaxed">
                如果您拒绝了某项权限，可以随时在手机的「设置 → 应用 → 提词器 → 权限」中手动开启。
                部分国产手机（小米、OPPO、华为等）可能在系统层面静默拦截权限，即使您点了「允许」也会被拒绝。
                这种情况下，请在系统设置中手动授予权限。
              </p>
            )}
          </div>
        )}

        {/* Bottom Buttons */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              localStorage.setItem(PERMISSIONS_KEY, 'true');
              onComplete();
            }}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            跳过
          </button>
          <button
            onClick={() => {
              localStorage.setItem(PERMISSIONS_KEY, 'true');
              onComplete();
            }}
            className="px-6 py-2 text-sm font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            继续使用
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionsGate;
