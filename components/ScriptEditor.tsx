import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import type { RewriteVersion } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import { htmlToPlainText } from '../utils/htmlUtils';

interface ScriptEditorProps {
  text: string;
  onTextChange: (newText: string) => void;
  onView: () => void;
  originalText?: string;
  rewrittenVersions?: RewriteVersion[];
  showComparison?: boolean;
  onClearComparison?: () => void;
  onSelectVersion?: (versionText: string) => void;
  onSaveToLibrary?: (text: string) => void;
}

const COLOR_OPTIONS = [
  { label: '默认', value: '#000000' },
  { label: '红色', value: '#EF4444' },
  { label: '蓝色', value: '#3B82F6' },
  { label: '绿色', value: '#10B981' },
  { label: '橙色', value: '#F97316' },
  { label: '紫色', value: '#8B5CF6' },
];

const HIGHLIGHT_COLORS = [
  { label: '紫色', value: '#7C3AED' },
  { label: '蓝色', value: '#3B82F6' },
  { label: '浅蓝', value: '#7DD3FC' },
  { label: '黄色', value: '#FEF08A' },
  { label: '粉色', value: '#FBCFE8' },
  { label: '绿色', value: '#BBF7D0' },
];

const ScriptEditor: React.FC<ScriptEditorProps> = ({
  text,
  onTextChange,
  originalText = '',
  rewrittenVersions = [],
  showComparison = false,
  onClearComparison,
  onSelectVersion,
  onSaveToLibrary,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('original');
  const [editorKey, setEditorKey] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  // Build tab list for comparison mode
  const tabList = useMemo(() => {
    if (!showComparison) return [];
    const tabs: { id: string; label: string; subtitle: string }[] = [
      { id: 'original', label: '原稿 A', subtitle: '只读' }
    ];
    rewrittenVersions.forEach((v, i) => {
      const letter = String.fromCharCode(66 + i); // B, C, D...
      tabs.push({
        id: v.frameworkId,
        label: `改写 ${letter} (${v.frameworkName})`,
        subtitle: '可编辑',
      });
    });
    return tabs;
  }, [showComparison, rewrittenVersions]);

  // Reset to original tab when showComparison changes
  useEffect(() => {
    if (showComparison) {
      setActiveTab('original');
    }
  }, [showComparison]);

  // When switching to a version tab, update the parent text
  useEffect(() => {
    if (!showComparison) return;
    if (activeTab === 'original') return;

    const version = rewrittenVersions.find(v => v.frameworkId === activeTab);
    if (version && onSelectVersion) {
      onSelectVersion(version.text);
    }
    // Force editor to reinitialize with new content
    setEditorKey(prev => prev + 1);
  }, [activeTab, showComparison]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize editor content from text prop
  useEffect(() => {
    if (!editorRef.current) return;
    if (!/<[a-z][\s\S]*>/i.test(text)) {
      editorRef.current.innerHTML = text
        .split('\n')
        .map(p => p.trim() ? `<p>${p}</p>` : '<p><br></p>')
        .join('');
    } else {
      editorRef.current.innerHTML = text;
    }
  }, [editorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute a document command and notify parent
  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      onTextChange(editorRef.current.innerHTML);
    }
  }, [onTextChange]);

  const handleSave = useCallback(() => {
    const html = editorRef.current?.innerHTML;
    if (html) {
      onTextChange(html);
      onSaveToLibrary?.(html);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  }, [onTextChange, onSaveToLibrary]);

  const handleView = useCallback(() => {
    if (previewMode) {
      // Exiting preview → re-initialize editor with saved content
      setPreviewMode(false);
      setEditorKey(prev => prev + 1);
      return;
    }
    // Save current content and enter preview
    if (editorRef.current) {
      onTextChange(editorRef.current.innerHTML);
    }
    setPreviewMode(true);
  }, [onTextChange, previewMode]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onTextChange(editorRef.current.innerHTML);
    }
  }, [onTextChange]);

  // Close color/highlight pickers when clicking outside
  useEffect(() => {
    if (!showColorPicker && !showHighlightPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.color-picker-trigger') && !target.closest('.color-picker-panel')) {
        setShowColorPicker(false);
        setShowHighlightPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker, showHighlightPicker]);

  // Get current version's text for comparison display
  const getCurrentVersionText = () => {
    if (activeTab === 'original') return originalText;
    const version = rewrittenVersions.find(v => v.frameworkId === activeTab);
    return version?.text || text;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ===== Top Navigation ===== */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        {/* Left spacer */}
        <div className="w-[72px]" />

        {/* Center: Title */}
        <h1 className="text-base font-bold text-gray-900 whitespace-nowrap">
          {showComparison ? 'A/B/C 对比' : '台词创作'}
        </h1>

        {/* Right: View + Save buttons */}
        <div className="flex items-center gap-2">
          {previewMode ? (
            <button
              onClick={handleView}
              className="px-5 py-1.5 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 text-sm font-bold rounded-full transition-colors"
            >
              编辑
            </button>
          ) : (
            <button
              onClick={handleView}
              className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-bold rounded-full transition-colors"
            >
              查看
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-5 py-1.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-sm font-bold rounded-full transition-colors"
          >
            {isSaved ? '已保存' : '保存'}
          </button>
        </div>
      </div>

      {/* ===== A/B/C Comparison Tabs ===== */}
      {showComparison && tabList.length > 1 && (
        <div className="shrink-0 bg-gray-50 border-b border-gray-200 px-4 py-2">
          <div className="flex items-center gap-1 max-w-2xl mx-auto flex-wrap">
            {tabList.map((tab, index) => {
              const isActive = activeTab === tab.id;
              const isOriginal = tab.id === 'original';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                    ${isActive
                      ? isOriginal
                        ? 'bg-amber-100 text-amber-800 shadow-sm'
                        : 'bg-purple-100 text-purple-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <span>{tab.label}</span>
                  <span className={`ml-1 text-[9px] ${isActive ? 'opacity-70' : 'opacity-40'}`}>
                    ({tab.subtitle})
                  </span>
                </button>
              );
            })}
            <div className="flex-1 min-w-[8px]" />
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              {activeTab === 'original' ? '原稿（仅查看）' : '改写稿（可编辑）'}
            </span>
          </div>
        </div>
      )}

      {/* ===== Editing / Preview Area ===== */}
      <div className="flex-1 overflow-y-auto bg-white px-5 py-4">
        {previewMode ? (
          /* ── Rendered preview (strip HTML, use light theme) ── */
          <div className="min-h-full max-w-2xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <MarkdownRenderer content={htmlToPlainText(text)} dark={false} />
            </div>
          </div>
        ) : showComparison && activeTab === 'original' ? (
          <div
            className="text-gray-500 min-h-full max-w-2xl mx-auto select-none"
            style={{
              fontSize: '16px',
              lineHeight: '1.9',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif',
            }}
          >
            {originalText ? (
              <div dangerouslySetInnerHTML={{ __html: originalText }} />
            ) : (
              <p className="text-gray-300 italic">暂无原稿内容</p>
            )}
          </div>
        ) : (
          <div
            key={editorKey}
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            className="outline-none text-gray-800 min-h-full max-w-2xl mx-auto"
            style={{
              fontSize: '16px',
              lineHeight: '1.9',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif',
            }}
          />
        )}
      </div>

      {/* ===== Bottom Formatting Toolbar ===== */}
      {!previewMode && (
      <div className="shrink-0 bg-white border-t border-gray-100 px-2 py-2.5 safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* Bold */}
          <button
            onClick={() => exec('bold')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors font-extrabold text-sm"
            title="加粗 (Ctrl+B)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 12a4 4 0 0 0 0-8H6v8m8 0a4 4 0 0 1 0 8H6v-8m8 0H6"/>
            </svg>
          </button>

          {/* Italic */}
          <button
            onClick={() => exec('italic')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors italic text-lg"
            title="斜体 (Ctrl+I)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>
            </svg>
          </button>

          {/* Underline */}
          <button
            onClick={() => exec('underline')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors text-sm"
            title="下划线 (Ctrl+U)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>
            </svg>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-gray-200" />

          {/* Highlight colors */}
          <div className="relative color-picker-trigger">
            <button
              onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              title="高亮标记"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
              </svg>
            </button>
            {showHighlightPicker && (
              <div className="color-picker-panel absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-50 min-w-[200px]">
                <div className="text-xs text-gray-500 font-medium mb-2 text-center">高亮颜色</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {HIGHLIGHT_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => { exec('hiliteColor', c.value); setShowHighlightPicker(false); }}
                      className="w-8 h-8 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-all hover:scale-110"
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Text Color */}
          <div className="relative color-picker-trigger">
            <button
              onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              title="文字颜色"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16"/><path d="m4 20 4-16m0 0 4 16m-4-16h8l4 16"/>
              </svg>
            </button>
            {showColorPicker && (
              <div className="color-picker-panel absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-50 min-w-[200px]">
                <div className="text-xs text-gray-500 font-medium mb-2 text-center">文字颜色</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => { exec('foreColor', c.value); setShowColorPicker(false); }}
                      className="w-8 h-8 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-all hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    >
                      {c.value === '#000000' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/></svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-gray-200" />

          {/* Font size decrease */}
          <button
            onClick={() => exec('fontSize', '3')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors font-bold text-sm"
            title="缩小字号"
          >
            <span className="text-xs">A<sup>−</sup></span>
          </button>

          {/* Font size increase */}
          <button
            onClick={() => exec('fontSize', '6')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors font-bold text-sm"
            title="增大字号"
          >
            <span className="text-sm font-bold">A<sup>+</sup></span>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-gray-200" />

          {/* Undo */}
          <button
            onClick={() => exec('undo')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            title="撤销 (Ctrl+Z)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.5 15.5A8.5 8.5 0 1 0 5 5L1 10"/>
            </svg>
          </button>

          {/* Redo */}
          <button
            onClick={() => exec('redo')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            title="重做 (Ctrl+Shift+Z)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.5 15.5A8.5 8.5 0 1 1 19 5l4 5"/>
            </svg>
          </button>

          {/* Remove Format */}
          <button
            onClick={() => exec('removeFormat')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
            title="清除格式"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 9.5 14 13l-3-3 3.5-3.5"/><path d="M11 7H4"/><path d="M11 13H4"/><path d="m3 19 8-8"/>
            </svg>
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

export default ScriptEditor;
