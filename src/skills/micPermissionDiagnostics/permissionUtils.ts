/**
 * 麦克风权限诊断 — 工具函数
 *
 * 提供：
 * 1. ROM 检测规则（MIUI/HyperOS, ColorOS, HarmonyOS, OriginOS, OneUI）
 * 2. getUserMedia 底层探测
 * 3. SpeechRecognition 可用性测试
 * 4. 完整诊断报告生成
 */

import type {
  MicPermissionState,
  GetUserMediaResult,
  SpeechRecognitionResult,
  MicDiagnosticReport,
  RomHint,
  RomDetectionRule,
} from './types';

// ==================================================================
// ROM 检测规则表
// ==================================================================

const ROM_DETECTION_RULES: RomDetectionRule[] = [
  {
    vendor: 'xiaomi',
    vendorNameCN: '小米 MIUI / HyperOS',
    detect: (ua: string) =>
      /miui|hyperos|redmi|xiaomi|m200|m210|m201|m2012|m2011|m2102/i.test(ua),
    description:
      'MIUI/HyperOS 首次安装默认禁止麦克风，"隐私保护"中的「敏感权限提醒」可能静默拦截音频权限',
    settingsPath:
      '设置 → 应用管理 → 提词器 → 权限管理 → 麦克风 → 设为「仅在使用中允许」',
  },
  {
    vendor: 'oppo',
    vendorNameCN: 'OPPO / realme ColorOS',
    detect: (ua: string) =>
      /coloros|oppo|realme|pacm00|pckm|pdbm|pdsm|peem|pfvm|pgam|pgcm|pgjm|pgkm|phk|phw/i.test(ua),
    description:
      'ColorOS 自动权限管理中可能将麦克风设为「拒绝」，需手动开启并关闭智能权限拦截',
    settingsPath:
      '设置 → 应用 → 应用管理 → 提词器 → 权限 → 麦克风 → 设为「使用时允许」',
  },
  {
    vendor: 'huawei',
    vendorNameCN: '华为 HarmonyOS / EMUI',
    detect: (ua: string) =>
      /harmonyos|huawei|honor|emui|eml-|clt-|bkl-|jkm-|vtr-|stf-|ane-|hwtf/i.test(ua),
    description:
      'HarmonyOS 纯净模式下非应用商店下载的 App 敏感权限会被默认拦截，需关闭纯净模式或手动授权',
    settingsPath:
      '设置 → 应用和服务 → 应用管理 → 提词器 → 权限 → 麦克风 → 设为「仅使用期间允许」',
  },
  {
    vendor: 'vivo',
    vendorNameCN: 'vivo / iQOO OriginOS',
    detect: (ua: string) =>
      /originos|funtouch|vivo|iqoo|v[0-9]{4}[a-z]|v[0-9]{3}[a-z]/i.test(ua),
    description:
      'OriginOS 隐私保护策略会静默拒绝首次安装应用的敏感权限请求',
    settingsPath:
      '设置 → 应用与权限 → 权限管理 → 麦克风 → 提词器 → 设为「仅在使用中允许」',
  },
  {
    vendor: 'samsung',
    vendorNameCN: '三星 One UI',
    detect: (ua: string) =>
      /samsung|sm-[a-z]\d{3}|oneui/i.test(ua),
    description:
      '三星 One UI 默认权限策略较宽松，但部分定制系统可能限制后台麦克风',
    settingsPath:
      '设置 → 应用程序 → 提词器 → 权限 → 麦克风 → 设为「仅在使用应用时允许」',
  },
  {
    vendor: 'google',
    vendorNameCN: 'Google Pixel / 原生 Android',
    detect: (ua: string) =>
      /pixel|android.*google/i.test(ua),
    description:
      '原生 Android 权限策略标准。若 getUserMedia 返回 NotAllowedError 且已点允许，可能是 Chrome WebView 权限缓存异常',
    settingsPath:
      '设置 → 应用 → 提词器 → 权限 → 麦克风 → 设为「仅在使用应用时允许」',
  },
];

// ==================================================================
// 平台信息
// ==================================================================

function getPlatformInfo(): MicDiagnosticReport['platform'] {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return {
    os: detectOS(ua),
    browser: detectBrowser(ua),
    isCapacitorNative: isCapacitorNative(),
    userAgent: ua,
    language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
  };
}

function detectOS(ua: string): string {
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function detectBrowser(ua: string): string {
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/firefox/i.test(ua)) return 'Firefox';
  return 'Unknown';
}

function isCapacitorNative(): boolean {
  try {
    const cap = (window as any).Capacitor;
    if (!cap) return false;
    return typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  } catch {
    return false;
  }
}

// ==================================================================
// ROM 检测
// ==================================================================

function detectRom(): RomHint | null {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  for (const rule of ROM_DETECTION_RULES) {
    if (rule.detect(ua)) {
      return {
        vendor: rule.vendor,
        vendorNameCN: rule.vendorNameCN,
        description: rule.description,
        repairSteps: [
          rule.settingsPath,
          '同时建议在应用信息页面中：关闭「电池优化」、开启「自启动」、关闭「纯净模式」（华为）或「隐私保护增强」（小米）',
        ],
      };
    }
  }
  return null;
}

// ==================================================================
// getUserMedia 底层探测
// ==================================================================

async function probeGetUserMedia(): Promise<GetUserMediaResult> {
  const start = performance.now();

  try {
    // 先检查 API 可用性
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        success: false,
        errorName: 'NotSupportedError',
        errorMessage: '当前环境不支持 getUserMedia API',
        inferredState: 'denied',
        durationMs: performance.now() - start,
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());

    return {
      success: true,
      errorName: null,
      errorMessage: null,
      inferredState: 'granted',
      durationMs: performance.now() - start,
    };
  } catch (err: any) {
    const durationMs = performance.now() - start;
    const name = err.name || 'UnknownError';
    const msg = err.message || '';

    let inferredState: MicPermissionState = 'denied';

    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        // 关键判断：如果用户确认点了「允许」但依然报错 = ROM 拦截
        // 在 UI 层面会弹出二次确认来区分
        inferredState = 'rom-blocked';
        break;
      case 'NotFoundError':
        inferredState = 'no-hardware';
        break;
      case 'NotReadableError':
        inferredState = 'occupied';
        break;
      case 'SecurityError':
        inferredState = 'insecure';
        break;
      case 'AbortError':
        inferredState = 'aborted';
        break;
      default:
        inferredState = 'denied';
    }

    return {
      success: false,
      errorName: name,
      errorMessage: msg,
      inferredState,
      durationMs,
    };
  }
}

// ==================================================================
// SpeechRecognition 可用性测试
// ==================================================================

async function probeSpeechRecognition(): Promise<SpeechRecognitionResult> {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return {
      supported: false,
      initialized: false,
      started: false,
      errorName: 'NotSupportedError',
      errorMessage: '浏览器不支持 SpeechRecognition API',
    };
  }

  // 快速启动-停止测试，验证整个链路
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'zh-CN';

  return new Promise((resolve) => {
    let started = false;
    const timeout = setTimeout(() => {
      try { recognition.stop(); } catch {}
      resolve({
        supported: true,
        initialized: true,
        started,
        errorName: 'TimeoutError',
        errorMessage: 'SpeechRecognition 启动超时（可能被系统静默阻止）',
      });
    }, 3000);

    recognition.onstart = () => {
      started = true;
    };

    recognition.onerror = (event: any) => {
      clearTimeout(timeout);
      const errName = event.error || 'unknown';
      try { recognition.stop(); } catch {}

      resolve({
        supported: true,
        initialized: true,
        started,
        errorName: errName,
        errorMessage: getSpeechErrorDescription(errName),
      });
    };

    recognition.onend = () => {
      clearTimeout(timeout);
      resolve({
        supported: true,
        initialized: true,
        started,
        errorName: null,
        errorMessage: null,
      });
    };

    // 短暂启动后立即停止，验证权限和链路
    recognition.onresult = () => {
      // 收到结果说明完全正常
    };

    try {
      recognition.start();
      // 启动后 500ms 停止，快速验证链路
      setTimeout(() => {
        try { recognition.stop(); } catch {}
      }, 500);
    } catch (e: any) {
      clearTimeout(timeout);
      resolve({
        supported: true,
        initialized: false,
        started: false,
        errorName: e.name || 'start-failed',
        errorMessage: e.message || 'SpeechRecognition 启动失败',
      });
    }
  });
}

function getSpeechErrorDescription(errorName: string): string {
  switch (errorName) {
    case 'not-allowed':
      return '语音识别权限被拒绝。浏览器/系统层面阻止了 SpeechRecognition API';
    case 'audio-capture':
      return '无法捕获音频。麦克风可能被其他应用占用或未正确连接';
    case 'network':
      return '语音识别需要网络连接（Android 系统语音引擎依赖网络）';
    case 'no-speech':
      return '未检测到语音输入。请尝试说话或检查麦克风是否连接';
    case 'service-not-allowed':
      return '语音识别服务未被允许。检查浏览器/系统设置中的语音识别权限';
    case 'aborted':
      return '语音识别被意外中断。可安全重试，不影响诊断结论';
    case 'language-not-supported':
      return 'zh-CN 语言不被当前引擎支持。请切换语音识别引擎';
    default:
      return `未知错误: ${errorName}`;
  }
}

// ==================================================================
// 综合诊断报告
// ==================================================================

/**
 * 运行完整诊断并生成报告
 */
export async function runFullDiagnostic(): Promise<MicDiagnosticReport> {
  const [gUM, speechRecog] = await Promise.all([
    probeGetUserMedia(),
    probeSpeechRecognition(),
  ]);

  const romHint = detectRom();

  // 综合判定
  let overall: MicPermissionState;
  if (gUM.success) {
    overall = speechRecog.started || speechRecog.errorName === 'aborted'
      ? 'granted'
      : 'rom-blocked'; // getUserMedia 成功但 SpeechRecognition 连 start 都不行
  } else {
    overall = gUM.inferredState;
  }

  // 生成修复步骤
  const repairSteps = generateRepairSteps(overall, gUM, speechRecog, romHint);

  return {
    timestamp: Date.now(),
    platform: getPlatformInfo(),
    gUM,
    speechRecog,
    overall,
    romHint,
    repairSteps,
  };
}

// ==================================================================
// 简易版：仅做 getUserMedia 快速检测
// ==================================================================

/**
 * 快速检测麦克风权限（仅 getUserMedia 层）
 * 用于启动录音前快速预检
 */
export async function quickCheckPermission(): Promise<MicPermissionState> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (err: any) {
    const name = err.name || '';
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'rom-blocked';
      case 'NotFoundError':
        return 'no-hardware';
      case 'NotReadableError':
        return 'occupied';
      case 'SecurityError':
        return 'insecure';
      case 'AbortError':
        return 'aborted';
      default:
        return 'denied';
    }
  }
}

// ==================================================================
// 错误名称转用户友好描述
// ==================================================================

/** getUserMedia 错误 → 用户友好描述 + 通用修复建议 */
export function getGUMErrorDescription(errorName: string): {
  title: string;
  description: string;
  action: string;
} {
  switch (errorName) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        title: '麦克风权限被拒绝',
        description:
          '系统拒绝了麦克风访问请求。如果您在弹窗中点了「允许」但仍然看到此错误，则说明是手机系统（ROM）在底层拦截了权限。',
        action: '请到系统设置中手动开启麦克风权限。下方提供了各品牌手机的详细设置路径。',
      };
    case 'NotFoundError':
      return {
        title: '未检测到麦克风硬件',
        description: '浏览器/系统未能找到可用的麦克风设备。',
        action: '请检查是否连接了麦克风，或尝试在系统声音设置中确认麦克风设备状态。',
      };
    case 'NotReadableError':
      return {
        title: '麦克风被占用',
        description: '麦克风当前正被其他应用占用（如微信语音、其他录音软件、浏览器其他标签页等）。',
        action: '请关闭其他可能占用麦克风的应用后重试。在手机端，重启浏览器也通常可以解决问题。',
      };
    case 'SecurityError':
      return {
        title: '不安全的连接（非 HTTPS）',
        description:
          '浏览器安全策略要求麦克风访问必须在安全环境下（HTTPS 或 localhost）。当前页面使用了不安全的协议。',
        action: '电脑端：请使用 localhost 地址访问（如 http://localhost:5173）。手机端：请确保使用 HTTPS 或通过 USB 调试端口转发。',
      };
    case 'AbortError':
      return {
        title: '麦克风检测被中断',
        description: '权限请求过程中操作被取消或页面发生了导航。这通常是临时性的。',
        action: '点击「重试」按钮重新检测。如果反复出现此错误，请检查是否有浏览器扩展拦截了权限弹窗。',
      };
    case 'NotSupportedError':
      return {
        title: '当前环境不支持麦克风',
        description: '浏览器或运行环境不支持 getUserMedia API。',
        action: '请使用最新版 Chrome、Edge 或 Safari 浏览器。',
      };
    default:
      return {
        title: `未知错误: ${errorName}`,
        description: '遇到了未预期的麦克风访问错误。',
        action: '请尝试重启应用或浏览器后重试。如问题持续，请在系统设置中检查麦克风权限。',
      };
  }
}

// ==================================================================
// 修复步骤生成
// ==================================================================

function generateRepairSteps(
  overall: MicPermissionState,
  gUM: GetUserMediaResult,
  speechRecog: SpeechRecognitionResult,
  romHint: RomHint | null
): string[] {
  const steps: string[] = [];

  switch (overall) {
    case 'granted':
      steps.push('麦克风权限和语音识别均正常，无需修复。');
      break;

    case 'rom-blocked': {
      if (romHint) {
        steps.push(
          `检测到您的设备运行 ${romHint.vendorNameCN}，系统可能静默拦截了麦克风权限。`,
          ...romHint.repairSteps
        );
      } else {
        steps.push(
          '麦克风权限在系统层面被拦截。',
          '请到系统「设置 → 应用管理 → 提词器 → 权限」中手动开启麦克风。',
          '同时建议关闭电池优化、开启自启动。'
        );
      }
      steps.push('修复后请点击「重试检测」确认权限已生效。');
      break;
    }

    case 'denied':
      steps.push(
        '麦克风权限被拒绝。',
        '请重新打开应用以触发权限弹窗，或在系统设置中手动开启。'
      );
      break;

    case 'no-hardware':
      steps.push(
        '未检测到麦克风硬件。请确认设备连接了麦克风，',
        '或插入外接耳麦。在部分 Android 模拟器中需要手动启用虚拟麦克风。'
      );
      break;

    case 'occupied':
      steps.push(
        '麦克风正被其他应用占用。',
        '请关闭其他使用麦克风的应用（如微信、QQ、其他录音App），',
        '或重启手机浏览器后重试。'
      );
      break;

    case 'insecure':
      steps.push(
        '当前页面不是安全连接。',
        '电脑端：请使用 localhost 地址访问（http://localhost:5173 即可）。',
        '手机端：由于 Capacitor 在 WebView 中运行，通常不受此限制。如遇到此问题，请确保 App 使用正确的加载 URL。'
      );
      break;

    case 'aborted':
      steps.push(
        '权限检测被中断，请重试。',
        '如果反复出现此错误，检查是否有其他标签页或 App 正在请求麦克风权限。'
      );
      break;

    default:
      steps.push('请重试检测，如持续失败请联系技术支持。');
  }

  // SpeechRecognition 特定修复
  if (!speechRecog.supported) {
    steps.push(
      '同时检测到：您的浏览器不支持 SpeechRecognition API。',
      '请使用 Chrome 或 Edge 浏览器（WebKit 的 SpeechRecognition 实现不完善）。'
    );
  } else if (speechRecog.errorName === 'not-allowed' && overall === 'granted') {
    steps.push(
      '注意: 麦克风硬件权限正常，但语音识别服务被阻止。',
      '这可能是浏览器的「语音识别」站点权限被禁用。请检查地址栏左侧的站点设置。'
    );
  }

  return steps;
}

// ==================================================================
// 导出 ROM 检测（供 UI 单独使用）
// ==================================================================

export { detectRom, getPlatformInfo };
