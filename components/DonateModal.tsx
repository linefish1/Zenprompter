import React from 'react';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ── */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
          <div className="flex items-center gap-3">
            <span className="text-3xl">❤️</span>
            <div>
              <h2 className="text-xl font-bold text-white">支持开发者</h2>
              <p className="text-xs text-gray-400 mt-0.5">您的每一份支持，都是开源的动力</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">

          {/* Message */}
          <div className="bg-gradient-to-br from-amber-950/40 to-orange-950/40 border border-amber-500/20 rounded-xl p-5 text-center">
            <p className="text-sm text-gray-200 leading-relaxed">
              ZenPrompter 是一款
              <span className="text-amber-400 font-bold">完全开源、永久免费</span>
              的智能提词器。
            </p>
            <p className="text-sm text-gray-300 leading-relaxed mt-3">
              所有功能均无偿提供，无广告、无订阅、无隐藏收费。
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mt-3">
              如果你觉得这个工具不错，欢迎请开发者喝杯咖啡 ☕
            </p>
          </div>

          {/* QR Code area */}
          <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 text-center">扫码打赏</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* WeChat */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center border-2 border-green-500/30 shadow-lg shadow-green-900/20">
                  <img src="/20260604094352_258_310.jpg" alt="WeChat Donation QR Code" className="w-32 h-32 rounded-xl" />
                </div>
                <span className="text-xs text-green-400 font-medium">微信赞赏码</span>
              </div>

            </div>
          </div>

          {/* GitHub Sponsor */}
          <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3 text-center">GitHub Sponsors</h3>
            <a
              href="https://github.com/sponsors/YOUR_USERNAME"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-950/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>通过 GitHub Sponsors 赞助</span>
            </a>
            <p className="text-[10px] text-gray-500 text-center mt-3">
              请将链接中的 <code className="text-gray-400 bg-gray-800 px-1 rounded">YOUR_USERNAME</code> 替换为你的 GitHub 用户名
            </p>
          </div>

          {/* Buy Me a Coffee */}
          <div className="text-center">
            <a
              href="https://www.buymeacoffee.com/YOUR_USERNAME"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#FFDD00] hover:bg-[#FFE433] text-black font-extrabold text-sm transition-all shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 8h-2V6h2v2zm0 4h-2v-2h2v2zm0 4h-2v-2h2v2zM4 8h2v8H4V8zm12-6C9.37 2 4 7.37 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-6.63-5.37-12-12-12zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
              </svg>
              <span>Buy Me a Coffee</span>
            </a>
            <p className="text-[10px] text-gray-500 mt-2">
              替换 <code className="text-gray-400 bg-gray-800 px-1 rounded">YOUR_USERNAME</code> 为你的 Buy Me a Coffee 用户名
            </p>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-800 p-5 flex justify-center items-center gap-3 bg-gray-950">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-xl transition-colors border border-gray-700/50"
          >
            稍后再说
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition-colors shadow-lg shadow-amber-950/10"
          >
            已支持 ❤️
          </button>
        </div>
      </div>
    </div>
  );
};

export default DonateModal;
