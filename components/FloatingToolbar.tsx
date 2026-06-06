/**
 * 浮动工具条组件 - 文本编辑工具条
 *
 * 特性：
 * - 浮动显示，跟随文本选择位置
 * - 不超出页面边界
 * - 手机端适配
 * - 提供编辑工具功能
 */

import React, { useState, useEffect, useRef } from 'react';

interface FloatingToolbarProps {
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: string) => void;
  isMobile: boolean;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  position,
  onClose,
  onAction,
  isMobile
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // 点击外部关闭工具条
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setVisible(false);
        setTimeout(onClose, 200);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // 计算工具条位置，确保不超出页面
  const calculatePosition = (): { top: string; left: string } => {
    if (isMobile) {
      // 手机端固定在底部
      return { top: 'auto', left: '0' };
    }

    // 桌面端跟随鼠标位置，但确保不超出边界
    const toolbarWidth = 300;
    const toolbarHeight = 60;
    const buffer = 10; // 边界缓冲区

    let top = position.y + 20; // 鼠标下方20px
    let left = position.x;

    // 确保不超出右边界
    if (left + toolbarWidth > window.innerWidth - buffer) {
      left = window.innerWidth - toolbarWidth - buffer;
    }

    // 确保不超出底部边界
    if (top + toolbarHeight > window.innerHeight - buffer) {
      top = window.innerHeight - toolbarHeight - buffer;
    }

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  };

  const positionStyle = calculatePosition();

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2"
      style={{
        ...positionStyle,
        transition: 'all 0.2s ease',
        transform: 'translateY(0)',
        opacity: 1
      }}
    >
      <div className="flex items-center space-x-2">
        {/* 工具按钮 */}
        <button
          onClick={() => onAction('help-write')}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col items-center text-xs"
          title="帮写"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.834.99V15a1 1 0 01-1 1h-2.834a1 1 0 00-.766.357l-3.466 2.57a1 1 0 01-1.272 0l-3.466-2.57A1 1 0 003.166 15H2a1 1 0 01-1-1V7.99a1 1 0 01.834-.99h4V2a1 1 0 011-1h2.3zM16 5a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h10z" clipRule="evenodd" />
          </svg>
          <span>帮写</span>
        </button>

        <button
          onClick={() => onAction('interpret')}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col items-center text-xs"
          title="解读"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>解读</span>
        </button>

        <button
          onClick={() => onAction('translate')}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col items-center text-xs"
          title="翻译"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm5 2a1 1 0 00-1 1v6a1 1 0 102 0V7a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v6a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>翻译</span>
        </button>

        <button
          onClick={() => onAction('rewrite')}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col items-center text-xs"
          title="改写"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17a2 2 0 002 2h10a2 2 0 002-2v-2.828l-8.379-8.379zM17 17a1 1 0 100-2h-2a1 1 0 100 2h2z" />
          </svg>
          <span>改写</span>
        </button>

        <button
          onClick={() => onAction('format')}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col items-center text-xs"
          title="排版"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 10a1 1 0 011-1h2a1 1 0 100 2H5a1 1 0 01-1-1zm0-4a1 1 0 011-1h2a1 1 0 100 2H5a1 1 0 01-1-1z" />
          </svg>
          <span>排版</span>
        </button>

        {/* 手机端关闭按钮 */}
        {isMobile && (
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ml-auto"
            title="关闭"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* 手机端底部固定工具条 */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2">
          <div className="flex justify-around">
            <button onClick={() => onAction('help-write')} className="flex flex-col items-center text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.834.99V15a1 1 0 01-1 1h-2.834a1 1 0 00-.766.357l-3.466 2.57a1 1 0 01-1.272 0l-3.466-2.57A1 1 0 003.166 15H2a1 1 0 01-1-1V7.99a1 1 0 01.834-.99h4V2a1 1 0 011-1h2.3zM16 5a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h10z" clipRule="evenodd" />
              </svg>
              <span>帮写</span>
            </button>

            <button onClick={() => onAction('interpret')} className="flex flex-col items-center text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>解读</span>
            </button>

            <button onClick={() => onAction('translate')} className="flex flex-col items-center text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm5 2a1 1 0 00-1 1v6a1 1 0 102 0V7a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v6a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>翻译</span>
            </button>

            <button onClick={() => onAction('rewrite')} className="flex flex-col items-center text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17a2 2 0 002 2h10a2 2 0 002-2v-2.828l-8.379-8.379zM17 17a1 1 0 100-2h-2a1 1 0 100 2h2z" />
              </svg>
              <span>改写</span>
            </button>

            <button onClick={() => onAction('format')} className="flex flex-col items-center text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 10a1 1 0 011-1h2a1 1 0 100 2H5a1 1 0 01-1-1zm0-4a1 1 0 011-1h2a1 1 0 100 2H5a1 1 0 01-1-1z" />
              </svg>
              <span>排版</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};