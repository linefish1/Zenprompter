import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-amber-500">?</span> 使用指南与说明
          </h2>
          <button 
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 text-gray-300">
          
          {/* Section 1: Basics */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              编辑输入与滚动播放
            </h3>
            <ul className="list-disc list-inside space-y-2 ml-1">
              <li><strong className="text-gray-100">任意点击</strong> 文本显示区域，即可直接编辑修改或输入您的提词脚本，也支持从电脑上直接拖拽 `.txt` / `.md` 文本文件进来。</li>
              <li>按下键盘 <strong className="text-gray-100 px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 font-mono text-xs">空格键</strong> 或点击底部的 <span className="text-amber-400 font-bold">开始</span> 按钮启动自动平滑滚动。</li>
              <li>使用 <span className="text-gray-100">语速滚条</span> 或 <span className="text-gray-100">+/-</span> 按钮来调节提词滚动的快慢节奏。</li>
            </ul>
          </section>

          {/* Section 2: Voice Mode */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-550 text-amber-500"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
              AI智能语音跟读 (魔法随读模式)
            </h3>
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <p className="mb-3">点击麦克风图标启用 <strong className="text-amber-400">语音跟读模式</strong>。提词器可以根据您的实际发音进行动态跟读：</p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold">●</span>
                  <span>根据您的说话语速自动同步文字滚屏，无需手动操控。</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold">●</span>
                  <span>您当前正在朗读的 <span className="bg-amber-600/35 border border-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded text-xs">字词</span> 会被高亮标记，确保您绝不迷失。</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold">●</span>
                  <span>已读完的文字会自动变灰，清晰展现您的演讲进度。</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 italic">注：此模式需要授以麦克风权限。推荐在 Chrome 等主流浏览器中体验。</p>
            </div>
          </section>

          {/* Section 3: AI & Tools */}
          <section className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
                AI 创作助手
              </h3>
              <p className="text-sm">点击底部的 <strong className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">AI 创作</strong> 按钮：</p>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1 text-gray-400">
                <li>根据特定主题或观点直接生成高品质脚本</li>
                <li>自动一键纠错并润色句法</li>
                <li>支持调整为“专业”、“随性”、“幽默”或“促销”语调</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                硬件镜像模式
              </h3>
               <p className="text-sm">需要配合专门的实体提词器玻璃或折射镜设备使用？</p>
               <p className="text-sm mt-2 text-gray-400">点击底部的 <strong className="text-gray-200">水平镜像</strong> 按钮进行水平镜像翻转，使文字在折射镜上完美正向显示。</p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button 
            onClick={onClose}
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-extrabold py-3 rounded-lg transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;