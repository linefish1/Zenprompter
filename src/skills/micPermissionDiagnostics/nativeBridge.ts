/**
 * Capacitor 原生 MicPermission 插件 — TypeScript 桥接
 *
 * 对应 Android 端的 MicPermissionPlugin.java。
 * 提供三个方法：
 * - checkDetailed()  — 纯诊断（不弹任何 UI）
 * - requestWithDiagnostics() — 请求权限 + 返回详细诊断
 * - openAppSettings() — 打开 App 的系统设置页面
 */

/** 与 MicPermissionPlugin.java 的 JSObject 输出一致 */
export interface NativePermissionResult {
  state: 'granted' | 'denied' | 'never_ask_again';
  granted: boolean;
  shouldShowRationale: boolean;
  romBlockSuspected: boolean;
  diagnosis?: string;
}

/** 裸插件方法类型 */
interface RawMicPermissionPlugin {
  checkDetailed(): Promise<NativePermissionResult>;
  requestWithDiagnostics(): Promise<NativePermissionResult>;
  openAppSettings(): Promise<void>;
}

/**
 * 获取原生 MicPermission 插件实例
 *
 * 仅在 Capacitor 原生环境（Android/iOS）可用。
 * Web 环境下返回 null。
 */
function getNativePlugin(): RawMicPermissionPlugin | null {
  try {
    // Capacitor 8: plugins are accessible via the global CapacitorPlugins or Capacitor.Plugins
    const cap = (window as any).Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) {
      return null;
    }

    // Try multiple access patterns for Capacitor plugin resolution
    const plugin =
      (cap as any).Plugins?.MicPermission ||
      (window as any).CapacitorPlugins?.MicPermission;

    return plugin || null;
  } catch {
    return null;
  }
}

/** 纯诊断：不弹任何 UI，检查权限状态 + ROM 特征 */
export async function checkDetailed(): Promise<NativePermissionResult | null> {
  const plugin = getNativePlugin();
  if (!plugin) return null;
  return plugin.checkDetailed();
}

/** 请求权限（弹系统对话框）+ 返回详细诊断（含 shouldShowRationale） */
export async function requestWithDiagnostics(): Promise<NativePermissionResult | null> {
  const plugin = getNativePlugin();
  if (!plugin) return null;
  return plugin.requestWithDiagnostics();
}

/** 打开当前 App 的系统设置页面（让用户手动修改权限） */
export async function openAppSettings(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    await plugin.openAppSettings();
    return true;
  } catch {
    return false;
  }
}

/** 检查原生插件是否可用 */
export function isNativePluginAvailable(): boolean {
  return getNativePlugin() !== null;
}
