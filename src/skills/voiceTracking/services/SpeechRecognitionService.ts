/**
 * 语音识别服务 - 支持 Web Speech API 和 API 两种后端
 *
 * 通过配置文件切换后端:
 * - Web Speech API: 浏览器原生，离线，免费
 * - API: 可对接任何语音识别 API (如 Google Cloud STT, DeepSeek, OpenAI Whisper)
 */

import { RecognitionBackendConfig, RecognitionResult, VoiceStatus } from '../types';

// Re-export shared interfaces for backward compatibility
export type { RecognitionCallbacks, ISpeechRecognitionService } from './ISpeechService';
import type { RecognitionCallbacks, ISpeechRecognitionService } from './ISpeechService';

// ===== Web Speech API 实现 =====

export class WebSpeechRecognitionService implements ISpeechRecognitionService {
  private recognition: any = null;
  private config: RecognitionBackendConfig | null = null;
  private running = false;
  private callbacks: RecognitionCallbacks | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  async initialize(config: RecognitionBackendConfig): Promise<void> {
    this.config = config;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Web Speech API not supported in this browser');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = config.language || 'zh-CN';
    console.log('WebSpeechRecognitionService initialized with language:', this.recognition.lang);
  }

  async start(callbacks: RecognitionCallbacks, stream?: MediaStream): Promise<void> {
    if (!this.recognition) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    this.callbacks = callbacks;
    this.running = true;

    return new Promise((resolve, reject) => {
      try {
        this.recognition.onstart = () => {
          console.log('WebSpeechRecognitionService onstart event: Listening started. Language:', this.recognition.lang);
          callbacks.onStatus('listening');
          resolve();
        };

        // this.recognition.onspeechstart = () => {
        //   console.log('WebSpeechRecognitionService onspeechstart event: Speech has been detected.');
        //   callbacks.onStatus('detecting-speech');
        // };

        // this.recognition.onspeechend = () => {
        //   console.log('WebSpeechRecognitionService onspeechend event: Speech activity ended.');
        //   callbacks.onStatus('processing-speech');
        // };

        this.recognition.onresult = (event: any) => {
          let finalText = '';
          let interimText = '';
          let confidence = 0;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalText += transcript + ' ';
              confidence = event.results[i][0].confidence || 0.8;
            } else {
              interimText += transcript;
            }
          }

          console.log('WebSpeechRecognitionService onresult event:', event.results);

          if (finalText.trim()) {
            callbacks.onResult({
              text: finalText.trim(),
              confidence,
              isFinal: true,
              timestamp: Date.now(),
            });
          } else if (interimText.trim()) {
            callbacks.onResult({
              text: interimText.trim(),
              confidence: 0.5,
              isFinal: false,
              timestamp: Date.now(),
            });
          }
        };

        this.recognition.onerror = (event: any) => {
          const msg = String(event.error || '');
          console.error('WebSpeechRecognitionService onerror event:', msg, event); // Log all errors
          console.error('WebSpeechRecognitionService onerror event details:', event.error, event.message, event.type, event);
          if (msg === 'no-speech') {
            callbacks.onStatus('no-speech');
            return;
          }
          if (msg === 'not-allowed') {
            callbacks.onStatus('no-permission');
            this.running = false;
            return;
          }
          // Catch all other errors
          callbacks.onStatus('error'); // Set status to error for unhandled errors
          if (msg !== 'aborted') {
            callbacks.onError(msg);
          }
        };

        this.recognition.onend = () => {
          console.log('WebSpeechRecognitionService onend event: Recognition ended, attempting restart. Current running state:', this.running);
          // Auto-reconnect (unless actively stopped or fatal error)
          if (this.running) {
            this.restartTimer = setTimeout(() => {
              if (this.running && this.recognition) {
                try {
                  this.recognition.start();
                  console.log('WebSpeechRecognitionService restarting recognition.');
                } catch (e) {
                  console.error('Error restarting WebSpeechRecognitionService:', e);
                  // ignore
                }
              }
            }, 250);
          }
        };

        this.recognition.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): void {
    this.running = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.callbacks = null;
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

// ===== API 后端实现（占位 + 可扩展） =====

export class APIRecognitionService implements ISpeechRecognitionService {
  private config: RecognitionBackendConfig | null = null;
  private running = false;
  private callbacks: RecognitionCallbacks | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private stream: MediaStream | null = null; // Store the stream here

  async initialize(config: RecognitionBackendConfig): Promise<void> {
    this.config = config;
    if (!this.config?.apiUrl) {
      throw new Error('API Recognition Service: apiUrl is not configured.');
    }
  }

  async start(callbacks: RecognitionCallbacks, stream?: MediaStream): Promise<void> {
    if (!this.config) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
    this.callbacks = callbacks;
    this.running = true;

    try {
      let audioStream: MediaStream;
      if (stream) {
        // Use provided stream if available
        audioStream = stream;
        this.stream = stream; // Store the stream
        console.log('APIRecognitionService: Using provided MediaStream for audio input.');
      } else {
        // Fallback to getUserMedia if no stream is provided
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.stream = audioStream; // Store the stream
        console.log('APIRecognitionService: Falling back to getUserMedia for audio input.');
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg'; // Fallback for older browsers

      console.log('APIRecognitionService: Using MIME type:', mimeType);

      this.mediaRecorder = new MediaRecorder(audioStream, { mimeType });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.onstop = () => {
        if (this.intervalTimer) {
          clearInterval(this.intervalTimer);
          this.intervalTimer = null;
        }
        audioStream.getTracks().forEach((t) => t.stop()); // Stop the tracks
      };

      this.mediaRecorder.start(1000); // Collect 1-second chunks
      this.callbacks.onStatus('listening');

      this.intervalTimer = setInterval(async () => {
        if (this.audioChunks.length > 0) {
          await this.sendAudioChunk();
        }
      }, 3000); // Send chunks every 3 seconds

    } catch (error: any) {
      console.error('APIRecognitionService start error:', error);
      this.callbacks?.onError('Failed to start API recognition service: ' + error.message);
      this.callbacks?.onStatus('error');
      this.running = false;
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
    }
  }

  private async sendAudioChunk(): Promise<void> {
    if (!this.config?.apiUrl || !this.callbacks) return;

    const chunks = [...this.audioChunks];
    this.audioChunks = [];
    const blob = new Blob(chunks, { type: this.mediaRecorder?.mimeType });

    try {
      const formData = new FormData();
      // OpenAI-compatible API uses 'file' as the field name (SiliconFlow, Whisper, etc.)
      formData.append('file', blob, 'recording.webm');
      // Send model parameter when configured (required for SiliconFlow)
      if (this.config.apiModel) {
        formData.append('model', this.config.apiModel);
      }

      const headers: Record<string, string> = {};
      if (this.config.apiKey) {
        headers['Authorization'] = 'Bearer ' + this.config.apiKey;
      }

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error('API returned ' + response.status + (errBody ? ': ' + errBody.slice(0, 200) : ''));
      }

      const data = await response.json();
      // Handle multiple response formats: { text } (OpenAI/SiliconFlow) | { transcript } | { results: [...] }
      const transcript = data.text || data.transcript || data.results?.[0]?.alternatives?.[0]?.transcript || '';

      if (transcript) {
        this.callbacks.onResult({
          text: transcript,
          confidence: data.confidence ?? data.results?.[0]?.alternatives?.[0]?.confidence ?? 0.8,
          isFinal: true,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      this.callbacks?.onError('API request failed: ' + err.message);
    }
  }

  stop(): void {
    this.running = false;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    this.audioChunks = [];
    this.callbacks = null;
  }

  isRunning(): boolean {
    return this.running;
  }

  getConfig(): RecognitionBackendConfig {
    if (!this.config) {
      return { type: 'api', apiUrl: '', language: 'zh-CN' };
    }
    return this.config;
  }
}

// ===== 服务工厂 =====

/**
 * Detect if running inside a Capacitor native app (Android / iOS WebView).
 * Capacitor injects a global `Capacitor` object with platform info.
 */
function isCapacitorNative(): boolean {
  try {
    const cap = (window as any).Capacitor;
    if (!cap) return false;
    // Capacitor.isNativePlatform() returns true on Android/iOS, false on web/PWA
    return typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  } catch {
    return false;
  }
}

export async function createRecognitionService(
  config: RecognitionBackendConfig,
  stream?: MediaStream // Add stream parameter here
): Promise<ISpeechRecognitionService> {
  switch (config.type) {
    case 'api':
      // Pass the stream to APIRecognitionService
      const apiService = new APIRecognitionService();
      await apiService.initialize(config);
      // The start method of APIRecognitionService now accepts a stream
      await apiService.start({} as RecognitionCallbacks, stream); // Pass an empty callback object for initialization, real callbacks will be set in useVoiceTracking
      return apiService;
    case 'web-speech-api':
    default: {
      // Auto-detect platform:
      // - Native (Capacitor Android/iOS) → use device's built-in speech recognizer
      // - Web (desktop browser / PWA)   → use Web Speech API
      if (isCapacitorNative()) {
        // Dynamic import — only loads CapacitorSpeechService when actually
        // running inside a Capacitor native app. Keeps this module out of
        // the browser/web bundle entirely.
        const { CapacitorSpeechRecognitionService } = await import('./CapacitorSpeechService');
        const nativeService = new CapacitorSpeechRecognitionService();

        try {
          await nativeService.initialize(config);

          // 检查是否需要回退（国产 ROM 缺少 Google 语音服务）
          if (nativeService.needsWebApiFallback()) {
            console.warn(
              'Android 原生语音识别不可用（缺少 Google 语音服务），自动回退到 Web Speech API'
            );
            // 回退到 Web Speech API（部分 Android WebView 支持）
            const webService = new WebSpeechRecognitionService();
            await webService.initialize(config);
            return webService;
          }

          return nativeService;
        } catch (initErr: any) {
          console.warn(
            'Failed to initialize native speech recognition, falling back to Web Speech API:',
            initErr.message
          );
          // 原生初始化失败 → 回退到 Web Speech API
          const webService = new WebSpeechRecognitionService();
          await webService.initialize(config);
          return webService;
        }
      }
      return new WebSpeechRecognitionService();
    }
  }
}
