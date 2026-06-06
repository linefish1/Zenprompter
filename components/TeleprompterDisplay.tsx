// components/TeleprompterDisplay.tsx

import React, { useEffect, useRef, useState } from 'react';
import { PrompterSettings } from '../types';
import { htmlToPlainText } from '../utils/htmlUtils';

interface TeleprompterDisplayProps {
  settings: PrompterSettings;
  text: string;
  onTextChange: (text: string) => void;
  togglePlay: () => void;
  onDisplayDoubleClick: () => void;
  cameraStream?: MediaStream | null;
}

const TeleprompterDisplay: React.FC<TeleprompterDisplayProps> = ({
  settings,
  text,
  onTextChange,
  togglePlay,
  cameraStream
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const readOnlyContentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync camera stream to video element when it changes from parent
  useEffect(() => {
    if (videoRef.current) {
      if (cameraStream) {
        videoRef.current.srcObject = cameraStream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [cameraStream]);

  const [isFocused, setIsFocused] = useState(false);
  const [textStats, setTextStats] = useState({
    wordCount: 0,
    charCount: 0,
    lineCount: 0
  });

  const getFontFamily = () => {
      switch(settings.fontFamily) {
          case 'serif': return 'font-serif';
          case 'mono': return 'font-mono';
          default: return 'font-sans';
      }
  };

  const getTextColor = () => {
      switch(settings.textColor) {
          case 'yellow': return '#fbbf24';
          case 'green': return '#4ade80';
          case 'cyan': return '#22d3ee';
          default: return 'white';
      }
  };

  // Strip HTML tags
  const plainText = htmlToPlainText(text);

  // Auto-scroll animation for playback mode
  useEffect(() => {
    let animationFrameId: number;
    let isRunning = settings.isPlaying;
    let lastTime = 0;
    let targetScroll = 0;
    let currentScroll = 0;
    let lastScrollUpdate = 0;

    const animate = (time: number) => {
      if (!isRunning || !containerRef.current) return;

      if (!lastTime) {
        lastTime = time;
        currentScroll = containerRef.current.scrollTop;
        targetScroll = currentScroll;
        lastScrollUpdate = time;
      }

      const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const pixelsPerSecond = settings.speed * 20;
      targetScroll += pixelsPerSecond * deltaTime;

      if (time - lastScrollUpdate > 16) {
        const scrollDifference = targetScroll - currentScroll;
        const smoothFactor = 0.1;
        currentScroll += scrollDifference * smoothFactor;

        containerRef.current.scrollTop = currentScroll;
        lastScrollUpdate = time;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    if (settings.isPlaying) {
      if (containerRef.current) {
        currentScroll = containerRef.current.scrollTop;
        targetScroll = currentScroll;
      }
      lastTime = 0;
      lastScrollUpdate = 0;
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [settings.isPlaying, settings.speed]);

  // Update text statistics when text changes
  useEffect(() => {
    const raw = htmlToPlainText(text);
    const words = raw.trim().split(/\s+/);
    const wordCount = raw.trim() === '' ? 0 : words.length;
    const charCount = raw.length;
    const lineCount = raw.split('\n').length;

    setTextStats({
      wordCount,
      charCount,
      lineCount
    });
  }, [text]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (settings.isPlaying || document.activeElement !== contentEditableRef.current) {
          e.preventDefault();
          togglePlay();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        console.log('Ctrl+S pressed - save functionality');
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        console.log('Ctrl+Z pressed - undo functionality');
        if (contentEditableRef.current) {
          document.execCommand('undo');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.isPlaying, togglePlay]);

  const isReadOnlyMode = settings.isPlaying || !!cameraStream;

return (
  <div
      className={`relative flex-1 overflow-hidden w-full h-full ${isReadOnlyMode ? 'pointer-events-none' : ''}`}
      style={{
        backgroundColor: `rgba(0, 0, 0, ${
          settings.prompterBgTransparency === 100 ? 0 : settings.bgOpacity / 100
        })`
      }}
  >

    {/* ===== Camera video layer — fills the screen behind everything ===== */}
    {cameraStream && (
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    )}

    {/* ===== Teleprompter overlay ON TOP of camera — rendered as direct sibling for guaranteed z-index ===== */}
    {cameraStream && (
      <div
        ref={readOnlyContentRef}
        className={`
          fixed inset-x-0 top-[10%] bottom-[10%] z-[1001]
          max-w-4xl mx-auto outline-none overflow-y-auto
          ${settings.isMirrored ? 'scale-x-[-1]' : ''}
          ${getFontFamily()}
        `}
        style={{
          fontSize: `${settings.fontSize}px`,
          lineHeight: 1.6,
          textAlign: settings.isMirrored ? 'right' : 'left',
          whiteSpace: 'pre-wrap',
          color: getTextColor(),
          opacity: (100 - settings.prompterTextVisibility) / 100, // 0 = 完全不透明, 100 = 完全透明
          backgroundColor: `rgba(0, 0, 0, ${1 - (settings.prompterBgTransparency / 100)})`, // 0 = 完全不透明, 100 = 完全透明
          padding: '20px 24px',
          borderRadius: '16px',
          boxShadow: 'none', // 拍摄模式下强制移除阴影，确保透明度不受影响
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        {plainText}
      </div>
    )}

      {/* ===== Sight-line indicator ===== */}
      <div className="absolute top-1/2 left-0 right-0 z-20 flex items-center justify-center pointer-events-none opacity-40">
        <div className="w-full h-0 border-t-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
        <div className="absolute right-4 -top-3 text-red-500 text-xs font-mono uppercase tracking-widest bg-black px-1">视线高度</div>
      </div>

      {/* ===== Main scrollable content area (editing + play/voice read-only) ===== */}
      <div
        ref={containerRef}
        className={`w-full h-full overflow-y-auto no-scrollbar relative z-10 scroll-smooth ${isReadOnlyMode ? 'cursor-none' : 'cursor-text'}`}
      >
        <div style={{ height: '50vh' }}></div>

        <div
          ref={contentEditableRef}
          contentEditable={!isReadOnlyMode}
          onInput={(e) => onTextChange(e.currentTarget.innerHTML)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          suppressContentEditableWarning={true}
          className={`
            max-w-4xl mx-auto px-8 outline-none
            ${settings.isMirrored ? 'scale-x-[-1]' : ''}
            ${isReadOnlyMode ? 'hidden' : 'block'}
            ${getFontFamily()}
          `}
          style={{
            fontSize: `${settings.fontSize}px`,
            lineHeight: 1.5,
            color: getTextColor(),
            opacity: settings.textOpacity / 100,
            textAlign: settings.isMirrored ? 'right' : 'left',
            whiteSpace: 'pre-wrap'
          }}
          dangerouslySetInnerHTML={{ __html: text }}
        />

        {/* Read-only overlay for play/voice mode (NOT recording) — inside container */}
        {isReadOnlyMode && !cameraStream && (
        <div
          ref={readOnlyContentRef}
          className={`
              max-w-4xl mx-auto px-8 outline-none
              ${settings.isMirrored ? 'scale-x-[-1]' : ''}
              ${getFontFamily()}
          `}
          style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: 1.5,
              textAlign: settings.isMirrored ? 'right' : 'left',
              whiteSpace: 'pre-wrap',
              color: getTextColor(),
              opacity: (100 - settings.prompterTextVisibility) / 100, // 0 = 完全不透明, 100 = 完全透明
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              backgroundColor: `rgba(0, 0, 0, ${(100 - settings.prompterBgTransparency) / 100})`, // 0 = 完全不透明, 100 = 完全透明
              padding: '10px',
              borderRadius: '8px',
              boxShadow: 'none',
              pointerEvents: 'none',
              userSelect: 'none'
          }}
        >
          {plainText}
        </div>
        )}
        <div style={{ height: '50vh' }}></div>
      </div>

      {/* Empty state prompt */}
      {!isReadOnlyMode && !isFocused && text.trim().length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-500">
             <span className="text-xl">点击此处开始输入，或拖放脚本文件到这里...</span>
         </div>
      )}
    </div>
  );
};

export default TeleprompterDisplay;
