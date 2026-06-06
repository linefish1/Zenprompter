import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScriptLibraryItem, SCRIPT_LIBRARY_KEY } from '../types';

interface ScriptLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAndRecord: (content: string) => void;
  onSelectAndEdit: (content: string) => void;
}

const ScriptLibraryPanel: React.FC<ScriptLibraryPanelProps> = ({
  isOpen,
  onClose,
  onSelectAndRecord,
  onSelectAndEdit,
}) => {
  const [scripts, setScripts] = useState<ScriptLibraryItem[]>(() => {
    try {
      const raw = localStorage.getItem(SCRIPT_LIBRARY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Refresh on open
  useEffect(() => {
    if (isOpen) {
      try {
        const raw = localStorage.getItem(SCRIPT_LIBRARY_KEY);
        setScripts(raw ? JSON.parse(raw) : []);
      } catch { setScripts([]); }
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = scripts.filter(s => s.id !== id);
    setScripts(updated);
    localStorage.setItem(SCRIPT_LIBRARY_KEY, JSON.stringify(updated));
    if (expandedId === id) setExpandedId(null);
  }, [scripts, expandedId]);

  if (!isOpen) return null;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed z-[95] flex flex-col shadow-2xl
          bg-gray-900 border border-gray-800
          transition-all duration-300 ease-out
          ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}
          md:left-0 md:top-0 md:bottom-0 md:w-96 md:rounded-r-2xl
          max-md:inset-x-0 max-md:bottom-0 max-md:top-16 max-md:rounded-t-3xl
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <div>
              <h2 className="text-base font-bold text-white">剧本台词</h2>
              <p className="text-[10px] text-gray-500">{scripts.length} 个脚本</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-2">
          {scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 py-12">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span className="text-sm">还没有保存的台词</span>
              <span className="text-[11px] text-gray-600">
                在拍摄页面保存当前内容，或在 AI 创作中生成脚本
              </span>
            </div>
          ) : (
            scripts.map(script => {
              const isExpanded = expandedId === script.id;
              const previewLen = 80;
              const preview = script.content.length > previewLen
                ? script.content.slice(0, previewLen) + '…'
                : script.content;

              return (
                <div
                  key={script.id}
                  className={`
                    rounded-xl border transition-all duration-200 cursor-pointer
                    ${isExpanded
                      ? 'bg-gray-800/80 border-amber-500/30 shadow-lg'
                      : 'bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'}
                  `}
                  onClick={() => toggleExpand(script.id)}
                >
                  {/* Collapsed row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white truncate">{script.title}</span>
                        <span className="text-[10px] text-gray-500 shrink-0">{formatDate(script.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{preview}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-500">{script.wordCount} 字</span>
                      </div>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={`text-gray-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="bg-gray-900/60 rounded-lg p-3 max-h-32 overflow-y-auto text-xs text-gray-300 leading-relaxed whitespace-pre-wrap border border-gray-800">
                        {script.content}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAndRecord(script.content);
                            onClose();
                          }}
                          className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-red-900/20"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                          </svg>
                          <span>去拍摄</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAndEdit(script.content);
                            onClose();
                          }}
                          className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          <span>编辑</span>
                        </button>
                        <button
                          onClick={(e) => handleDelete(script.id, e)}
                          className="p-2.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="删除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default ScriptLibraryPanel;
