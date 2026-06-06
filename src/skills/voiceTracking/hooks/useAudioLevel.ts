/**
 * useAudioLevel — 从 MediaStream 提取实时音量等级
 *
 * 使用 Web Audio API 的 AnalyserNode 读取音频频域数据，
 * 取低频段（人声范围）平均值作为音量等级 (0–1)。
 *
 * 不影响流的其他使用者（如 MediaRecorder），因为 AnalyserNode
 * 只是"旁路监听"，不会消费或改变音频数据。
 *
 * 兼容 Android WebView（Capacitor）、iOS WKWebView 和桌面浏览器。
 */

import { useEffect, useRef, useState } from 'react';

/**
 * @param stream   - 包含音频轨道的 MediaStream（如 cameraStream）
 * @param active   - 是否激活监听（false 时停止 rAF 并返回 0）
 * @param throttle - 状态更新间隔（ms），避免过于频繁的 React 重渲染
 */
export function useAudioLevel(
  stream: MediaStream | null,
  active: boolean,
  throttle = 60
): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !active) {
      setLevel(0);
      return;
    }

    // 检查流是否包含音频轨道
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('useAudioLevel: stream has no audio tracks');
      return;
    }

    let disposed = false;

    try {
      // AudioContext may start suspended on mobile (autoplay policy).
      // createMediaStreamSource still works; we just need to resume the context.
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = audioCtx;

      // Resume if suspended (common on Android WebView and iOS Safari)
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {
          // May fail if no user gesture — the context stays suspended,
          // but will auto-resume once audio starts flowing through it
        });
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;

      const source = audioCtx.createMediaStreamSource(stream);
      // Connect analyser only — we don't need to hear the audio,
      // just measure it. Not connecting to destination avoids feedback.
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const update = () => {
        if (disposed) return;
        rafRef.current = requestAnimationFrame(update);

        // Skip measurement if context is suspended
        if (audioCtx.state === 'suspended') return;

        const now = performance.now();
        if (now - lastUpdateRef.current < throttle) return;
        lastUpdateRef.current = now;

        analyser.getByteFrequencyData(dataArray);

        // 取低频段（索引 0–31，约 0–1378 Hz），覆盖人声范围
        let sum = 0;
        const voiceBins = Math.min(32, dataArray.length);
        for (let i = 0; i < voiceBins; i++) {
          sum += dataArray[i];
        }
        const avg = sum / (voiceBins * 255); // 归一化到 0–1

        // 轻微放大低音量区域，让视觉更有层次感
        setLevel(Math.min(1, avg * 1.4));
      };

      update();
    } catch (err) {
      // AudioContext or createMediaStreamSource is not supported (very old browser)
      console.error('useAudioLevel: failed to create AudioContext', err);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, [stream, active, throttle]);

  return level;
}
