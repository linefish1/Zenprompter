/**
 * VoiceWaveform — 语音波形指示器
 *
 * 5 根竖条，高度随实时音量跳动，配色跟随语音识别状态。
 * 使用 CSS animation 产生错相波动效果，配合 inline style 的动态高度。
 */

import React from 'react';

interface VoiceWaveformProps {
  /** 音量等级 0–1 */
  level: number;
  /** 语音识别状态 */
  voiceStatus: string;
}

const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ level, voiceStatus }) => {
  const isTracking = voiceStatus === 'tracking';
  const isListening = voiceStatus === 'listening' || voiceStatus === 'reacquiring';
  const isActive = isTracking || isListening;

  // 颜色映射：和阅读线保持一致
  const color = isTracking
    ? '#4ade80'    // green-400
    : isListening
    ? '#fbbf24'    // amber-400
    : '#6b7280';   // gray-500 (idle)

  const maxHeight = 16;
  const barCount = 5;
  const barWidth = 3;
  const gap = 2;

  return (
    <>
      {/* 注入全局 keyframes */}
      <style>{`
        @keyframes voice-wave-pulse {
          0%, 100% { transform: scaleY(0.35); }
          50%      { transform: scaleY(1); }
        }
      `}</style>

      <div
        className="flex items-end shrink-0"
        style={{
          height: maxHeight,
          gap: `${gap}px`,
        }}
      >
        {Array.from({ length: barCount }).map((_, i) => {
          // 无活动时显示最低高度
          if (!isActive) {
            return (
              <div
                key={i}
                className="rounded-full transition-colors duration-300"
                style={{
                  width: barWidth,
                  height: 3,
                  backgroundColor: color,
                  opacity: 0.4,
                }}
              />
            );
          }

          // 活跃状态：高度 = 基础音量 + 每个条有不同的相位偏移
          return (
            <div
              key={i}
              className="rounded-full transition-[background-color] duration-300"
              style={{
                width: barWidth,
                height: `${Math.max(3, level * maxHeight)}px`,
                backgroundColor: color,
                boxShadow: `0 0 5px ${color}`,
                animationName: 'voice-wave-pulse',
                animationDuration: '0.45s',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: `${i * 0.08}s`,
                transformOrigin: 'bottom center',
                transition: 'height 100ms ease-out',
              }}
            />
          );
        })}
      </div>
    </>
  );
};

export default VoiceWaveform;
