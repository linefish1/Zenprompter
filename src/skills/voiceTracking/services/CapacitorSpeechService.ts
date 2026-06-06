/**
 * CapacitorSpeechService — Android/iOS 原生语音识别后端
 *
 * 封装 @capgo/capacitor-speech-recognition 插件：
 * - Android → android.speech.SpeechRecognizer（系统原生，离线可用）
 * - iOS     → SFSpeechRecognizer（系统原生）
 * - Web     → 自动回退到 Web Speech API
 *
 * 移动端语音跟随架构：
 * ┌─────────────────────────────────────────┐
 * │  第一层：权限获取 (PermissionsGate.tsx)    │
 * │  「请求→验证」模式：getUserMedia 验证录音  │
 * ├─────────────────────────────────────────┤
 * │  第二层：服务选择 (SpeechRecognitionSvc)   │
 * │  isCapacitorNative() → 原生 / Web       │
 * ├─────────────────────────────────────────┤
 * │  第三层：Android 原生引擎（本文件）         │
 * │  android.speech.SpeechRecognizer        │
 * ├─────────────────────────────────────────┤
 * │  第四层：降级策略                          │
 * │  原生不可用 → Web Speech API             │
 * │  Web API 不可用 → 提示切换到 API 模式     │
 * └─────────────────────────────────────────┘
 *
 * 注意：
 * - Android SpeechRecognizer 不支持 start()-while-running，必须先 stop() 再 start()
 * - 部分国产 ROM（OPPO/ColorOS、MIUI 等）可能未预装 Google 语音服务，
 *   此时 SpeechRecognizer 不可用，需降级到 Web Speech API
 * - Android 13+ 需要 RECORD_AUDIO + POST_NOTIFICATIONS 权限
 */

import { RecognitionBackendConfig, VoiceStatus } from '../types';
import type { RecognitionCallbacks, ISpeechRecognitionService } from './ISpeechService';

/**
 * 检查当前设备是否可能缺少 Google 语音服务
 * 国产 ROM 常见特征：系统语言为中文、厂商为 OPPO/vivo/小米等
 */
function isChineseRomWithoutGoogleServices(): boolean {
  if (typeof navigator === 'undefined') return false;
  const lang = navigator.language || '';
  // 中文语言环境 + Android = 大概率国产 ROM
  return /^zh/i.test(lang) && /android/i.test(navigator.userAgent || '');
}

export class CapacitorSpeechRecognitionService implements ISpeechRecognitionService {
  private config: RecognitionBackendConfig | null = null;
  private running = false;
  private callbacks: RecognitionCallbacks | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private plugin: any = null;
  private initialized = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  /** 是否回退到 Web Speech API */
  private fallbackToWebApi = false;

  async initialize(config: RecognitionBackendConfig): Promise<void> {
    this.config = config;

    try {
      // Dynamic import — only resolves in Capacitor runtime where the plugin is registered
      const mod = await import('@capgo/capacitor-speech-recognition');
      this.plugin = mod.SpeechRecognition;

      // Step 1: Check if speech recognition is available on this device
      try {
        const { available } = await this.plugin.available();
        if (!available) {
          // 国产 ROM 常见：Google 语音服务未安装
          if (isChineseRomWithoutGoogleServices()) {
            console.warn(
              'Android SpeechRecognizer 不可用（可能缺少 Google 语音服务）。将回退到 Web Speech API。'
            );
            this.fallbackToWebApi = true;
            this.initialized = true; // 标记为已初始化，由调用方处理回退
            return;
          }
          throw new Error('语音识别在当前设备上不可用');
        }
      } catch (availErr: any) {
        // available() 可能在某些插件版本中抛出异常
        console.warn('Speech recognition availability check failed:', availErr.message);
        if (isChineseRomWithoutGoogleServices()) {
          this.fallbackToWebApi = true;
          this.initialized = true;
          return;
        }
        throw availErr;
      }

      // Step 2: Check permission (do NOT re-request here — PermissionsGate handles that)
      try {
        const permResult = await this.plugin.checkPermissions();
        if (permResult?.speechRecognition === 'granted') {
          console.log('Speech recognition permission already granted');
        } else {
          console.warn(
            'Speech recognition permission not granted. State:',
            permResult?.speechRecognition
          );
          // Not fatal — PermissionsGate should have handled this earlier
        }
      } catch {
        // checkPermissions may throw — proceed anyway
      }

      this.initialized = true;
      console.log('CapacitorSpeechRecognitionService initialized successfully');
    } catch (err: any) {
      // Plugin module not found → device doesn't support Capacitor native
      if (err.message?.includes('Cannot find module')) {
        throw new Error(
          '语音识别插件未安装。请运行: npm install @capgo/capacitor-speech-recognition && npx cap sync'
        );
      }
      throw err;
    }
  }

  /** 是否因为 Google 语音服务不可用而需要回退 */
  needsWebApiFallback(): boolean {
    return this.fallbackToWebApi;
  }

  async start(callbacks: RecognitionCallbacks): Promise<void> {
    if (!this.initialized || !this.plugin) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    // 如果需要回退，直接告诉调用方
    if (this.fallbackToWebApi) {
      throw new Error(
        'Android 语音识别服务不可用（缺少 Google 语音服务）。请使用 Web Speech API 模式。'
      );
    }

    // Check permission before attempting to start
    try {
      const permResult = await this.plugin.checkPermissions();
      if (permResult?.speechRecognition !== 'granted') {
        callbacks.onStatus('no-permission');
        return;
      }
    } catch {
      // checkPermissions may throw if not implemented — proceed anyway
    }

    this.callbacks = callbacks;
    this.running = true;

    // Clean up any stale listeners from a previous session
    try {
      this.plugin.removeAllListeners();
    } catch {
      // ignore
    }

    // ── Register result listeners ────────────────────────────────

    this.plugin.addListener('partialResults', (data: { matches: string[] }) => {
      if (!this.running || !this.callbacks) return;
      const text = data.matches?.[0] || '';
      if (text) {
        this.callbacks.onResult({
          text,
          confidence: 0.5,
          isFinal: false,
          timestamp: Date.now(),
        });
      }
    });

    this.plugin.addListener('result', (data: { matches: string[] }) => {
      if (!this.running || !this.callbacks) return;
      const text = data.matches?.[0] || '';
      if (text) {
        this.callbacks.onResult({
          text,
          confidence: 0.9,
          isFinal: true,
          timestamp: Date.now(),
        });
      }
    });

    this.plugin.addListener('error', (data: { error: string }) => {
      if (!this.running || !this.callbacks) return;
      const msg = (data.error || '').toLowerCase();

      if (msg.includes('no-speech') || msg.includes('no match') || msg.includes('error_no_match')) {
        this.callbacks.onStatus('no-speech');

        // Auto-restart after no-speech
        if (this.running) {
          this.restartTimer = setTimeout(async () => {
            if (!this.running || !this.plugin || !this.callbacks) return;
            try {
              await this.plugin.stop();
            } catch { /* ignore */ }
            try {
              await this.plugin.start({
                language: this.config?.language || 'zh-CN',
                maxResults: 1,
                partialResults: true,
                popup: false,
              });
              this.callbacks.onStatus('listening');
            } catch {
              // restart failed — service may need full re-initialization
            }
          }, 300);
        }
        return;
      }
      if (
        msg.includes('not-allowed') ||
        msg.includes('permission') ||
        msg.includes('error_network') ||
        msg.includes('error_server')
      ) {
        this.callbacks.onStatus('error');
        this.running = false;
        return;
      }
      // Other errors — report but don't crash
      this.callbacks.onError(data.error || 'Speech recognition error');
    });

    // ── Start the native recognizer ──────────────────────────────
    // Android SpeechRecognizer may already be active from a prior session;
    // stop first to ensure clean start.
    try {
      await this.plugin.stop();
    } catch {
      // not running — that's fine
    }

    try {
      await this.plugin.start({
        language: this.config?.language || 'zh-CN',
        maxResults: 1,
        partialResults: true,
        popup: false, // No system dialog — stays in-app
      });
      callbacks.onStatus('listening');
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('not-allowed') || msg.includes('security')) {
        callbacks.onStatus('no-permission');
      } else if (msg.includes('network') || msg.includes('server')) {
        callbacks.onError('语音识别需要网络连接，请检查网络设置');
      } else {
        callbacks.onError(err.message || '启动语音识别失败');
      }
    }
  }

  stop(): void {
    this.running = false;
    this.callbacks = null;

    // Clear any pending restart timer
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.plugin) {
      try {
        this.plugin.stop();
      } catch {
        // ignore — plugin may already be stopped
      }
      try {
        this.plugin.removeAllListeners();
      } catch {
        // ignore
      }
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getConfig(): RecognitionBackendConfig {
    if (!this.config) {
      return { type: 'web-speech-api', language: 'zh-CN' };
    }
    return this.config;
  }
}
