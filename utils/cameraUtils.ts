import { Capacitor } from '@capacitor/core';

/**
 * Request camera + microphone access.
 *
 * Desktop: getUserMedia with 1080p, front camera, audio.
 * Mobile:  getUserMedia with 720p, front camera, audio.
 *
 * Includes pre-flight checks for common permission issues
 * (insecure context, previously-denied permission, missing API).
 */
export const requestCameraAccess = async (
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream> => {
  const isMobile = Capacitor.getPlatform() !== 'web';

  // ── Pre-flight checks ─────────────────────────────────────────
  if (!window.isSecureContext) {
    throw new Error(
      '摄像头需要安全连接（HTTPS 或 localhost）。\n' +
      '请在地址栏确认网址以 https:// 开头，或在本地开发时使用 localhost。'
    );
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      isMobile
        ? '您的设备系统版本过低，不支持浏览器内录像。\n请使用系统相机录像功能。'
        : '您的浏览器不支持摄像头调用。\n请使用最新版 Chrome、Edge 或 Firefox。'
    );
  }

  // Check if camera permission was previously denied (silent reject)
  try {
    const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
    if (camStatus.state === 'denied') {
      throw new Error(
        '摄像头权限已被浏览器永久拒绝。\n\n' +
        '解决方法：\n' +
        (isMobile
          ? '1. 打开系统「设置」→「应用」→ 找到本应用\n' +
            '2. 进入「权限」→ 开启「相机」\n' +
            '3. 返回本应用重试'
          : '1. 点击浏览器地址栏左侧的锁图标 🔒\n' +
            '2. 找到「摄像头」→ 设为「允许」\n' +
            '3. 刷新页面后重试')
      );
    }
  } catch (_permErr) {
    // permissions.query may not be supported — proceed to getUserMedia
  }

  // ── Request camera ────────────────────────────────────────────
  const videoConstraints: MediaTrackConstraints = {
    facingMode: facingMode,
    width: { ideal: isMobile ? 720 : 1920 },
    height: { ideal: isMobile ? 1280 : 1080 }
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
  } catch (error: any) {
    const name: string = error.name || '';
    let message = '无法访问摄像头';

    if (name === 'NotAllowedError') {
      message = '摄像头权限被拒绝。\n\n可能原因：\n' +
        '1. 点击了「拒绝」—— 请刷新页面后重新点击「开始拍摄」，在弹出的权限对话框中点「允许」\n' +
        (window.location.protocol === 'http:' && window.location.hostname !== 'localhost'
          ? '2. 网页不是 HTTPS —— 摄像头功能需要安全连接\n'
          : '') +
        '3. 浏览器之前设为「禁止」—— 请按上一提示中的方法重置权限';
    } else if (name === 'NotReadableError') {
      message = isMobile
        ? '摄像头被其他应用占用。\n请关闭其他使用摄像头的 App 后重试。'
        : '摄像头被其他程序占用或无法启动。\n\n请尝试：\n' +
          '1. 关闭其他使用摄像头的软件（Zoom、微信、OBS 等）\n' +
          '2. Windows：「设置」→「隐私」→「相机」→ 确保「允许应用访问相机」已开启\n' +
          '3. Mac：「系统设置」→「隐私与安全性」→「相机」→ 勾选本浏览器\n' +
          '4. 重启浏览器后重试';
    } else if (name === 'NotFoundError') {
      message = '未检测到摄像头设备，请确认摄像头已连接并安装驱动。';
    } else if (name === 'OverconstrainedError') {
      message = '摄像头不支持所需分辨率，尝试重新获取通用配置……';
      // Retry with minimal constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Success with generic — add audio and return
        try {
          const a = await navigator.mediaDevices.getUserMedia({ audio: true });
          a.getAudioTracks().forEach(t => stream.addTrack(t));
        } catch (_) { /* silent */ }
        return stream;
      } catch (_retryErr) {
        throw new Error(message);
      }
    } else {
      message += `（${name}: ${error.message || '未知错误'}）`;
    }
    throw new Error(message);
  }

  // ── Add audio track ───────────────────────────────────────────
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStream.getAudioTracks().forEach(track => stream.addTrack(track));
  } catch (_audioErr) {
    console.warn('麦克风不可用，将录制无声视频');
  }

  return stream;
};

export const stopCamera = (stream: MediaStream | null) => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

/**
 * Mobile-only: trigger the native system camera app to record video.
 * This opens the phone's built-in Camera app — the teleprompter overlay
 * will NOT be visible during recording in this mode.
 *
 * Returns a Blob of the recorded video, or null if user cancelled.
 */
export const requestNativeMobileRecording = (): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.capture = 'user'; // front camera

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'video/mp4' });
      resolve(blob);
    };

    input.oncancel = () => {
      resolve(null);
    };

    // Must be in DOM for iOS to trigger
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
    // Clean up after a delay
    setTimeout(() => document.body.removeChild(input), 60000);
  });
};

// ── MediaRecorder helpers ──────────────────────────────────────────

export const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'video/mp4;codecs=h264,mp4a.40.2',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/x-matroska;codecs=h264,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
};

export const isRecordingSupported = (): boolean => {
  return getSupportedMimeType() !== '';
};

export const isMobileDevice = (): boolean => {
  return Capacitor.getPlatform() !== 'web';
};

export const canUseInAppRecording = (): boolean => {
  return typeof navigator?.mediaDevices?.getUserMedia === 'function'
      && typeof MediaRecorder !== 'undefined';
};

export interface RecorderCallbacks {
  onTimeUpdate?: (elapsedSeconds: number) => void;
  onError?: (error: Error) => void;
}

export interface RecorderHandle {
  start: () => void;
  stop: () => Promise<Blob>;
  pause: () => void;
  resume: () => void;
  getState: () => RecordingState;
  getElapsedSeconds: () => number;
}

export const createRecorder = (
  stream: MediaStream,
  callbacks: RecorderCallbacks = {}
): RecorderHandle | null => {
  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    callbacks.onError?.(new Error('您的浏览器不支持录像功能，请使用最新版 Chrome、Edge 或 Firefox'));
    return null;
  }

  const chunks: Blob[] = [];
  let startTime = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let currentState: RecordingState = 'inactive';

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch (_err) {
    callbacks.onError?.(new Error('无法创建录像器，请检查摄像头权限'));
    return null;
  }

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  recorder.onerror = () => {
    callbacks.onError?.(new Error('录像过程中发生错误'));
    currentState = 'inactive';
    if (timerInterval !== null) clearInterval(timerInterval);
  };

  return {
    start: () => {
      chunks.length = 0;
      startTime = Date.now();
      recorder.start(1000);
      currentState = 'recording';

      if (callbacks.onTimeUpdate) {
        timerInterval = setInterval(() => {
          callbacks.onTimeUpdate?.((Date.now() - startTime) / 1000);
        }, 200);
      }
    },

    pause: () => {
      if (recorder.state === 'recording') {
        recorder.pause();
        currentState = 'paused';
        if (timerInterval !== null) clearInterval(timerInterval);
      }
    },

    resume: () => {
      if (recorder.state === 'paused') {
        recorder.resume();
        currentState = 'recording';
        if (callbacks.onTimeUpdate) {
          timerInterval = setInterval(() => {
            callbacks.onTimeUpdate?.((Date.now() - startTime) / 1000);
          }, 200);
        }
      }
    },

    stop: (): Promise<Blob> => {
      return new Promise<Blob>((resolve, reject) => {
        if (timerInterval !== null) {
          clearInterval(timerInterval);
          timerInterval = null;
        }

        recorder.onstop = () => {
          currentState = 'inactive';
          resolve(new Blob(chunks, {
            type: mimeType.startsWith('video/mp4') || mimeType.startsWith('video/x-matroska') ? 'video/mp4' : 'video/webm'
          }));
        };

        try {
          if (recorder.state === 'recording' || recorder.state === 'paused') {
            recorder.stop();
          } else {
            resolve(new Blob([], { type: 'video/webm' }));
          }
        } catch (err) {
          reject(err);
        }
      });
    },

    getState: () => currentState,

    getElapsedSeconds: () => startTime === 0 ? 0 : (Date.now() - startTime) / 1000
  };
};

export const downloadRecording = (blob: Blob, filename?: string): string => {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const name = filename || `zen-recording-${Date.now()}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
};
