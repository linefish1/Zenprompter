import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ScriptLibraryItem, SCRIPT_LIBRARY_KEY, PrompterSettings } from '../types';
import { incrementScriptUsage, SCRIPT_LIBRARY_CHANGE_EVENT } from '../utils/scriptLibrarySync';
import MarkdownRenderer from './MarkdownRenderer';

interface HomePageProps {
  text: string;
  setText: (text: string) => void;
  settings: PrompterSettings;
  updateSettings: (newSettings: Partial<PrompterSettings>) => void;
  handleCameraClick: () => Promise<void>;
  openAIModal: () => void;
  openHelpModal: () => void;
  openApiModal: () => void;
  openStyleSettingsModal: () => void;
  openDonateModal: () => void;
  onSelectAndEdit: (content: string) => void;
  onRewrite?: (content: string) => void;
  phoneMockupImage: string;
}

const HomePage: React.FC<HomePageProps> = ({
  setText,
  updateSettings,
  handleCameraClick,
  openAIModal,
  openHelpModal,
  openApiModal,
  openStyleSettingsModal,
  openDonateModal,
  onSelectAndEdit,
  onRewrite,
  phoneMockupImage,
}) => {
  const [scripts, setScripts] = useState<ScriptLibraryItem[]>(() => {
    try {
      const raw = localStorage.getItem(SCRIPT_LIBRARY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingFullId, setViewingFullId] = useState<string | null>(null);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recent' | 'hot'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'hot' | 'words'>('time');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derived: filtered + sorted scripts
  const displayScripts = useMemo(() => {
    let list = [...scripts];

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q)
      );
    }

    // Sort
    if (activeTab === 'hot') {
      list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    } else {
      switch (sortBy) {
        case 'hot':
          list.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
          break;
        case 'words':
          list.sort((a, b) => b.wordCount - a.wordCount);
          break;
        case 'time':
        default:
          list.sort((a, b) => b.createdAt - a.createdAt);
          break;
      }
    }

    return list;
  }, [scripts, searchQuery, activeTab, sortBy]);

  // Refresh on mount and when scripts might change
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCRIPT_LIBRARY_KEY);
      setScripts(raw ? JSON.parse(raw) : []);
    } catch { setScripts([]); }
  }, []);

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

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleNewScript = () => {
    setText("");
    updateSettings({ isEditing: true, isPlaying: false });
  };

  const handleFileImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const content = await file.text();
        setText(content);
        updateSettings({ isEditing: true, isPlaying: false });
      } else {
        alert("请拖放普通的文本文件 (.txt、.md)！");
      }
    }
  };

  const handleSelectScriptForRecord = (content: string) => {
    setText(content);
    updateSettings({ isEditing: false, isPlaying: true });
  };

  const handleSelectScriptForEdit = (content: string) => {
    setText(content);
    updateSettings({ isEditing: true, isPlaying: false });
  };

  const handleTabSwitch = (tab: 'recent' | 'hot') => {
    setActiveTab(tab);
    setExpandedId(null);
    if (tab === 'hot') setSortBy('hot');
  };

  const handleToggleSearch = () => {
    setIsSearchVisible(v => !v);
    if (!isSearchVisible) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
    }
  };

  const handleMultiSelectToggle = () => {
    setIsMultiSelectMode(v => !v);
    setSelectedScripts(new Set());
  };

  const handleBulkDelete = () => {
    const updated = scripts.filter(s => !selectedScripts.has(s.id));
    setScripts(updated);
    localStorage.setItem(SCRIPT_LIBRARY_KEY, JSON.stringify(updated));
    setSelectedScripts(new Set());
    setIsMultiSelectMode(false);
  };

  const handleScriptClick = (id: string) => {
    if (isMultiSelectMode) {
      setSelectedScripts(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      toggleExpand(id);
    }
  };

  const sortLabels: Record<string, string> = {
    time: '按时间',
    hot: '按热度',
    words: '按字数',
  };

  // Close sort menu on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Listen for script library changes from other components
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem(SCRIPT_LIBRARY_KEY);
        setScripts(raw ? JSON.parse(raw) : []);
      } catch { setScripts([]); }
    };
    window.addEventListener(SCRIPT_LIBRARY_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(SCRIPT_LIBRARY_CHANGE_EVENT, refresh);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans relative bg-gray-950">
      {/* Top Section */}
      <div className="relative h-64 bg-gradient-to-br from-green-600 to-blue-600 flex items-center justify-center p-4">
        <div className="text-center text-white z-10">
          <h2 className="text-4xl font-bold">随声提词，助你完美出镜</h2>
          <p className="text-sm mt-2">AI 智能提词器，让您的表达更流畅</p>
        </div>
        {/* Phone mockup image - only shown when user uploads one */}
        {phoneMockupImage && (
          <img src={phoneMockupImage} alt="phone mockup" className="absolute bottom-0 right-8 h-56 w-auto opacity-70" />
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-4 p-4 -mt-16 relative z-20">
        <button
          onClick={handleCameraClick}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg flex flex-col items-center justify-center text-center transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          <span className="text-lg">开始拍摄</span>
          <span className="text-xs opacity-80 mt-1">即刻拍摄属于你的高光时刻</span>
        </button>
        <div className="flex flex-col gap-4">
          <button
            onClick={handleNewScript}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg flex items-center gap-3 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>新建台词</span>
          </button>
          <button
            onClick={handleFileImportClick}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg flex items-center gap-3 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            <span>文件导入</span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".txt,.md"
            />
          </button>
        </div>
      </div>

      {/* Script Library Section */}
      <div className="flex-1 overflow-y-auto bg-gray-900 rounded-t-3xl mt-4 p-4 shadow-inner">
        {/* Tabs and controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleTabSwitch('recent')}
              className={`text-lg font-bold pb-1 transition-colors ${
                activeTab === 'recent'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              我的台词
            </button>
            <button
              onClick={() => handleTabSwitch('hot')}
              className={`text-lg font-bold pb-1 transition-colors ${
                activeTab === 'hot'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              热门台词库
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            {isSearchVisible && (
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索台词…"
                className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 transition-all"
              />
            )}
            <button
              onClick={handleToggleSearch}
              className={`p-2 rounded-md transition-colors ${
                isSearchVisible ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:text-white'
              }`}
              title="搜索"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            {/* Sort */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu(v => !v)}
                className={`p-2 rounded-md transition-colors ${
                  showSortMenu || sortBy !== 'time' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:text-white'
                }`}
                title="排序"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 w-28 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden">
                  {(['time', 'hot', 'words'] as const).map(key => (
                    <button
                      key={key}
                      onClick={() => { setSortBy(key); setShowSortMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                        sortBy === key
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {sortLabels[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Multi-select */}
            <button
              onClick={handleMultiSelectToggle}
              className={`p-2 rounded-md transition-colors ${
                isMultiSelectMode ? 'text-red-400 bg-red-500/10' : 'text-gray-400 hover:text-white'
              }`}
              title="批量操作"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            {/* Bulk delete (visible in multi-select mode) */}
            {isMultiSelectMode && (
              <button
                onClick={handleBulkDelete}
                disabled={selectedScripts.size === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                删除 ({selectedScripts.size})
              </button>
            )}
          </div>
        </div>

        {/* Result count */}
        {scripts.length > 0 && (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] text-gray-500">
              {searchQuery
                ? `找到 ${displayScripts.length} 条`
                : activeTab === 'hot'
                  ? `${displayScripts.filter(s => (s.usageCount || 0) > 0).length} 条使用过`
                  : `${displayScripts.length} 条记录`}
            </span>
            {isMultiSelectMode && (
              <span className="text-[11px] text-gray-500">已选 {selectedScripts.size} 条</span>
            )}
          </div>
        )}

        {displayScripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 py-12">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span className="text-sm">
              {searchQuery
                ? '没有匹配的台词'
                : activeTab === 'hot'
                  ? '还没有使用过台词'
                  : '还没有保存的台词'}
            </span>
            <span className="text-[11px] text-gray-600">
              {searchQuery
                ? '试试其他关键词'
                : activeTab === 'hot'
                  ? '加载台词进行拍摄或编辑后会自动记录热度'
                  : '在拍摄页面保存当前内容，或在 AI 创作中生成脚本'}
            </span>
          </div>
        ) : (
          displayScripts.map(script => {
            const isExpanded = expandedId === script.id;
            const isSelected = selectedScripts.has(script.id);
            const previewLen = 80;
            const preview = script.content.length > previewLen
              ? script.content.slice(0, previewLen) + '…'
              : script.content;

            return (
              <div
                key={script.id}
                className={`
                  rounded-xl border transition-all duration-200 cursor-pointer mb-2
                  ${isExpanded
                    ? 'bg-gray-800/80 border-amber-500/30 shadow-lg'
                    : isSelected
                      ? 'bg-red-900/20 border-red-500/40'
                      : 'bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'}
                `}
                onClick={() => handleScriptClick(script.id)}
              >
                {/* Collapsed row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Multi-select checkbox */}
                  {isMultiSelectMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 rounded accent-red-500 shrink-0"
                    />
                  )}
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {script.title}
                        {(activeTab === 'hot' || sortBy === 'hot') && (script.usageCount || 0) > 0 && (
                          <span className="ml-2 text-[10px] text-amber-400/70 font-normal">
                            {script.usageCount === 1 ? '🔥 1次' : `🔥 ${script.usageCount}次`}
                          </span>
                        )}
                      </span>
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
                    {viewingFullId === script.id ? (
                      /* ── Full content view ── */
                      <>
                        <div className="bg-gray-900/60 rounded-lg p-4 overflow-y-auto text-sm text-gray-200 leading-relaxed border border-gray-800 max-h-[55vh]">
                          <MarkdownRenderer content={script.content} />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewingFullId(null); }}
                            className="px-3 py-1.5 text-[10px] font-semibold bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors border border-gray-700/50"
                          >
                            ← 收起预览
                          </button>
                          <span className="text-[10px] text-gray-500">{script.wordCount} 字</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-900/60 rounded-lg p-3 max-h-32 overflow-y-auto text-xs text-gray-300 leading-relaxed whitespace-pre-wrap border border-gray-800">
                          {script.content}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              incrementScriptUsage(script.id);
                              handleSelectScriptForRecord(script.content);
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
                              incrementScriptUsage(script.id);
                              handleSelectScriptForEdit(script.content);
                            }}
                            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            <span>编辑</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewingFullId(script.id); }}
                            className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/20"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                            <span>查看</span>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              incrementScriptUsage(script.id);
                              if (onRewrite) {
                                setRewritingId(script.id);
                                try {
                                  await onRewrite(script.content);
                                } finally {
                                  setRewritingId(null);
                                }
                              }
                            }}
                            disabled={rewritingId === script.id}
                            className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/20"
                            title="一键改写"
                          >
                            {rewritingId === script.id ? (
                              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 3a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6M12 3a6 6 0 0 0-6 6v0a6 6 0 0 0 6-6"/>
                                <path d="M12 21v-3m0-6v3m0 0h3m-3 0H9"/>
                                <path d="M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
                              </svg>
                            )}
                            <span>{rewritingId === script.id ? '改写中…' : '一键改写'}</span>
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
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HomePage;