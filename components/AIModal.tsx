import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { generateScript, polishScript } from '../services/geminiService';
import { ScriptLibraryItem, SCRIPT_LIBRARY_KEY } from '../types';
import {
  loadScriptLibrary,
  saveScriptLibrary,
  addScriptToLibrary,
  deleteScriptFromLibrary,
  incrementScriptUsage,
  exportScriptLibraryToFile,
  importScriptLibraryFromFile,
  SCRIPT_LIBRARY_CHANGE_EVENT,
  broadcastScriptLibraryChange,
} from '../utils/scriptLibrarySync';
import { WRITING_FRAMEWORKS, FRAMEWORK_IDS, getFramework, LENGTH_PRESETS, AUDIENCE_PRESETS } from '../config/writingFrameworks';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (text: string) => void;
  currentText: string;
}

const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, onApply, currentText }) => {
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('professional');
  const [framework, setFramework] = useState('standard');
  const [lengthId, setLengthId] = useState('medium');
  const [audienceId, setAudienceId] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  
  // Script Library State — unified with RecordingOverlay's 我的台词
  const [scriptLibrary, setScriptLibrary] = useState<ScriptLibraryItem[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [scriptTab, setScriptTab] = useState<'recent' | 'hot'>('recent');
  const sortedScripts = useMemo(() => {
    if (scriptTab === 'hot') {
      return [...scriptLibrary].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    }
    return scriptLibrary;
  }, [scriptLibrary, scriptTab]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [contentEditingId, setContentEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null); // "已保存" flash
  const saveFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show brief save feedback then clear
  const flashSaveFeedback = useCallback((msg: string) => {
    setSaveFeedback(msg);
    if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
    saveFeedbackTimer.current = setTimeout(() => setSaveFeedback(null), 2000);
  }, []);

  // Manual refresh: re-read from localStorage
  const refreshLibrary = useCallback(() => {
    setScriptLibrary(loadScriptLibrary());
    flashSaveFeedback('已刷新');
  }, [flashSaveFeedback]);

  // Load script library on mount
  useEffect(() => {
    setScriptLibrary(loadScriptLibrary());
  }, []);

  // Auto-refresh: listen for changes from other components (RecordingOverlay, etc.)
  useEffect(() => {
    const handleLibraryChange = () => {
      const loaded = loadScriptLibrary();
      setScriptLibrary(prev => {
        // Deep compare to prevent infinite loop
        if (JSON.stringify(prev) === JSON.stringify(loaded)) return prev;
        return loaded;
      });
    };
    window.addEventListener(SCRIPT_LIBRARY_CHANGE_EVENT, handleLibraryChange);
    return () => window.removeEventListener(SCRIPT_LIBRARY_CHANGE_EVENT, handleLibraryChange);
  }, []);

  // Save script library to unified localStorage and broadcast change
  const saveLibrary = (library: ScriptLibraryItem[]) => {
    saveScriptLibrary(library);
    setScriptLibrary(library);
  };

  // Save current text to unified library
  const saveToLibrary = () => {
    if (!currentText.trim()) return;

    const lines = currentText.trim().split('\n');
    const title = lines[0].slice(0, 30) + (lines[0].length > 30 ? '...' : '');

    const newItem: ScriptLibraryItem = {
      id: Date.now().toString(),
      title,
      content: currentText,
      wordCount: currentText.length,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    saveLibrary([newItem, ...scriptLibrary]);
  };

  // Delete script from library (broadcasts change)
  const deleteScript = (id: string) => {
    deleteScriptFromLibrary(id);
    setScriptLibrary(loadScriptLibrary());
    flashSaveFeedback('已删除');
  };

  // Load script from library - stay in modal, put content in textarea for generation
  const loadScript = (item: ScriptLibraryItem) => {
    incrementScriptUsage(item.id);
    setPrompt(item.content);
    onApply(item.content);
    // Don't close - user stays in modal to select options then generate
  };

  // Start editing title
  const startEditTitle = (item: ScriptLibraryItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
  };

  // Save edited title
  const saveEditTitle = (id: string) => {
    saveLibrary(scriptLibrary.map(item =>
      item.id === id ? { ...item, title: editTitle, updatedAt: Date.now() } : item
    ));
    setEditingId(null);
  };

  // Start editing content
  const startEditContent = (item: ScriptLibraryItem) => {
    setContentEditingId(item.id);
    setEditContent(item.content);
  };

  // Save edited content
  const saveEditContent = (id: string) => {
    const newWordCount = editContent.length;
    saveLibrary(scriptLibrary.map(item =>
      item.id === id ? { ...item, content: editContent, wordCount: newWordCount, updatedAt: Date.now() } : item
    ));
    setContentEditingId(null);
    flashSaveFeedback('已保存');
  };

  // Cancel content editing
  const cancelEditContent = () => {
    setContentEditingId(null);
    setEditContent('');
  };

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    // Keep existing result visible while regenerating (only clear on first generation)
    if (!generatedResult) {
      setGeneratedResult(null);
    }
    try {
      const result = await generateScript(prompt, tone, framework, lengthId, audienceId);
      setGeneratedResult(result);
    } catch (e) {
      setError("无法生成脚本。请检查您的 API 密钥配置，或稍后重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptResult = () => {
    if (generatedResult) {
      onApply(generatedResult);
      setGeneratedResult(null);
      onClose();
    }
  };

  const handlePolish = async (textToPolish?: string) => {
    const source = textToPolish || currentText;
    if (!source.trim()) {
        setError("您的提词器文本为空！请先输入一些文字，或者生成一个新脚本。");
        return;
    }
    setIsLoading(true);
    setError(null);
    // Only clear generatedResult if polishing from input mode (not from result preview)
    if (!textToPolish) {
      setGeneratedResult(null);
    }
    try {
      const result = await polishScript(source);
      setGeneratedResult(result);
    } catch (e) {
      setError("润色脚本失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const tones = [
    { label: '专业学术', value: 'professional' },
    { label: '日常随性', value: 'casual' },
    { label: '趣味幽默', value: 'funny' },
    { label: '激情促销', value: 'urgent' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl shadow-2xl relative flex overflow-hidden" style={{ maxHeight: '80vh' }}>
        
        {/* Left Sidebar - Script Library */}
        <div className={`border-r border-gray-800 bg-gray-950/50 transition-all duration-300 ${showLibrary ? 'w-80' : 'w-12'}`}>
          {/* Toggle Button */}
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="w-full h-12 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border-b border-gray-800"
            title={showLibrary ? '收起题词库' : '展开题词库'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showLibrary ? '' : 'rotate-180'}`}>
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          
          {showLibrary && (
            <div className="flex flex-col h-[calc(80vh-48px)]">
              {/* Library Header */}
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-amber-500">📚 题词库</h3>
                  {/* Tab: 最近 / 热门 */}
                  <div className="flex bg-gray-800 rounded-lg p-0.5 ml-2">
                    <button
                      onClick={() => setScriptTab('recent')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                        scriptTab === 'recent'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      最近
                    </button>
                    <button
                      onClick={() => setScriptTab('hot')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                        scriptTab === 'hot'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      热门
                    </button>
                  </div>
                  {/* Action buttons row */}
                  <div className="flex items-center gap-1">
                    {/* Manual refresh */}
                    <button
                      onClick={refreshLibrary}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      title="手动刷新"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>
                      </svg>
                    </button>
                    {/* Export / 数据固化 */}
                    <button
                      onClick={() => { exportScriptLibraryToFile(); flashSaveFeedback('已导出备份'); }}
                      disabled={scriptLibrary.length === 0}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="导出备份（数据固化）"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                    {/* Import */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                      title="导入备份"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Hidden file input for import */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const result = await importScriptLibraryFromFile(file);
                      refreshLibrary();
                      flashSaveFeedback(`导入完成：新增 ${result.added} 条，跳过 ${result.skipped} 条`);
                    } catch {
                      flashSaveFeedback('导入失败：文件格式不正确');
                    }
                    e.target.value = ''; // reset so same file can be re-imported
                  }}
                />
                {/* Save current + feedback */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { saveToLibrary(); flashSaveFeedback('已保存'); }}
                    disabled={!currentText.trim()}
                    className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    保存当前
                  </button>
                  {saveFeedback && (
                    <span className="text-[10px] text-green-400 font-medium animate-in fade-in">
                      {saveFeedback}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {scriptTab === 'hot'
                    ? `${sortedScripts.filter(s => (s.usageCount || 0) > 0).length} 条使用过`
                    : `${scriptLibrary.length} 条记录`}
                </p>
              </div>
              
              {/* Library List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {sortedScripts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-xs">
                    {scriptTab === 'hot'
                      ? '还没有使用过台词'
                      : '暂无保存的题词<br/>点击"保存当前"添加'}
                  </div>
                ) : (
                  sortedScripts.map(item => (
                    <div key={item.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 transition-colors group">
                      {editingId === item.id ? (
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditTitle(item.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button
                            onClick={() => saveEditTitle(item.id)}
                            className="text-green-400 hover:text-green-300"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 
                            className="text-sm font-medium text-gray-200 line-clamp-2 flex-1 cursor-pointer hover:text-amber-400"
                            onClick={() => loadScript(item)}
                            title={item.title}
                          >
                            {item.title}
                            {scriptTab === 'hot' && (item.usageCount || 0) > 0 && (
                              <span className="ml-2 text-[10px] text-amber-400/70 font-normal">
                                {item.usageCount === 1 ? '🔥 1次' : `🔥 ${item.usageCount}次`}
                              </span>
                            )}
                          </h4>
                        </div>
                      )}

                      {/* Content editing area */}
                      {contentEditingId === item.id && (
                        <div className="mb-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-black border border-gray-700 rounded-lg p-2.5 text-xs text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-vertical min-h-[100px] font-mono leading-relaxed"
                            placeholder="编辑脚本内容..."
                            autoFocus
                          />
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-gray-500">{editContent.length} 字</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => cancelEditContent()}
                                className="px-2.5 py-1 text-[10px] rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => saveEditContent(item.id)}
                                className="px-2.5 py-1 text-[10px] rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                              >
                                保存编辑
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <span>{formatDate(item.createdAt)}</span>
                          <span>·</span>
                          <span>{item.wordCount} 字</span>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditTitle(item)}
                            className="p-1 text-gray-400 hover:text-amber-400"
                            title="修改标题"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                          </button>
                          <button
                            onClick={() => startEditContent(item)}
                            className="p-1 text-gray-400 hover:text-blue-400"
                            title="编辑内容"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            onClick={() => loadScript(item)}
                            className="p-1 text-gray-400 hover:text-green-400"
                            title="加载"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h11.5l-4.5 4.5 4.5 4.5"/><path d="M21 10h-11.5l4.5-4.5-4.5-4.5"/></svg>
                          </button>
                          <button
                            onClick={() => deleteScript(item.id)}
                            className="p-1 text-gray-400 hover:text-red-400"
                            title="删除"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Content - AI Assistant */}
        <div className="flex-1 p-6 relative">
          <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white z-10"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <span className="text-amber-500">✨</span> AI 创作助手
          </h2>
          <p className="text-gray-400 text-sm mb-6">专业编剧级口播脚本生成，让你的表达更打动人心</p>

        {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 text-sm p-3 rounded-lg mb-4">
                {error}
            </div>
        )}

        {/* Result Preview Mode */}
        {generatedResult ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-green-400 uppercase">✅ 脚本已生成</span>
              <span className="text-[10px] text-gray-500">{generatedResult.length} 字</span>
            </div>
            <div className="bg-black border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">{generatedResult}</pre>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptResult}
                className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-colors"
              >
                使用此脚本
              </button>
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
              >
                {isLoading ? '生成中...' : '重新生成'}
              </button>
            </div>
            <button
              onClick={() => handlePolish(generatedResult)}
              disabled={isLoading}
              className="w-full py-2 rounded-lg text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              {isLoading ? '润色中...' : '润色当前结果'}
            </button>
            <p className="text-[10px] text-gray-600 text-center">
              对结果不满意？调整下面的选项后点击"重新生成"
            </p>
            {/* Controls for regeneration */}
            <div className="border-t border-gray-800 pt-3 space-y-2">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase">调整选项重新生成</label>
              <div className="flex flex-wrap gap-1.5">
                {tones.map(t => (
                  <button key={t.value} onClick={() => setTone(t.value)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${tone === t.value ? 'bg-amber-950/60 border-amber-500/40 text-amber-300' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                  >{t.label}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {FRAMEWORK_IDS.map(id => {
                  const fw = WRITING_FRAMEWORKS[id];
                  return (
                    <button key={id} onClick={() => setFramework(id)} title={fw.description}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${framework === id ? 'bg-purple-950/60 border-purple-500/40 text-purple-300' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                    >{fw.icon} {fw.shortLabel}</button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Input Mode */
          <div className="space-y-4">
            <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">脚本主题/内容</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="输入主题或粘贴内容：例如「3分钟分享AI如何改变工作方式」..."
                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none h-28 resize-none text-sm"
                ></textarea>

                {/* Tone Selector */}
                <div className="mt-2">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1.5">语气风格</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tones.map(t => (
                        <button key={t.value} onClick={() => setTone(t.value)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${tone === t.value ? 'bg-amber-950/60 border-amber-500/40 text-amber-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                        >{t.label}</button>
                    ))}
                  </div>
                </div>

                {/* Length Selector */}
                <div className="mt-2">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1.5">脚本长度</label>
                  <div className="flex gap-1.5">
                    {LENGTH_PRESETS.map(l => (
                      <button key={l.id} onClick={() => setLengthId(l.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${lengthId === l.id ? 'bg-blue-950/60 border-blue-500/40 text-blue-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                      >{l.name}</button>
                    ))}
                  </div>
                </div>

                {/* Audience Selector */}
                <div className="mt-2">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1.5">目标受众</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AUDIENCE_PRESETS.map(a => (
                      <button key={a.id} onClick={() => setAudienceId(a.id)} title={a.description}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${audienceId === a.id ? 'bg-green-950/60 border-green-500/40 text-green-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                      >{a.name}</button>
                    ))}
                  </div>
                </div>

                {/* Writing Framework Selector */}
                <div className="mt-2">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1.5">写作框架</label>
                  <div className="flex flex-wrap gap-1">
                    {FRAMEWORK_IDS.map(id => {
                      const fw = WRITING_FRAMEWORKS[id];
                      return (
                        <button key={id} onClick={() => setFramework(id)} title={fw.description}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${framework === id ? 'bg-purple-950/60 border-purple-500/40 text-purple-300 shadow-sm' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                        >{fw.icon} {fw.name}</button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{getFramework(framework).description}</p>
                </div>
            </div>

            <button
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-sm
                    ${isLoading || !prompt.trim() ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-amber-500 text-black hover:bg-amber-400'}
                `}
            >
                {isLoading ? (
                  <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> 正在构思脚本...</>
                ) : (
                  '✨ 生成全新脚本'
                )}
            </button>

            <div className="relative flex py-1.5 items-center">
                <div className="flex-grow border-t border-gray-800"></div>
                <span className="flex-shrink-0 mx-3 text-gray-600 text-[10px] uppercase">或者</span>
                <div className="flex-grow border-t border-gray-800"></div>
            </div>

             <button
                onClick={handlePolish}
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg font-medium border border-gray-700 text-gray-400 hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-950/20 transition-all flex items-center justify-center gap-1.5 text-xs"
            >
                {isLoading ? '润色中...' : '润色当前文本 (语法纠正 & 口语化流畅)'}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default AIModal;