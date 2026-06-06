import React from 'react';

/**
 * Lightweight Markdown renderer — no external dependencies.
 * Supports common block and inline syntax used in script writing.
 */
interface MarkdownRendererProps {
  content: string;
  dark?: boolean; // dark background mode (default: true)
}

interface MdBlock {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'code' | 'blockquote' | 'ul' | 'ol' | 'hr' | 'p';
  text: string;
  items?: string[];   // for ul/ol
  lang?: string;      // for code blocks
}

function parseBlocks(source: string): MdBlock[] {
  const lines = source.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Thematic break ──
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr', text: '' });
      i++;
      continue;
    }

    // ── Code block ──
    if (/^```/.test(line.trimStart())) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trimStart())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', text: codeLines.join('\n'), lang: lang || undefined });
      continue;
    }

    // ── Headings ──
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length as 1|2|3|4;
      const types = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4' } as const;
      blocks.push({ type: types[level], text: hMatch[2] });
      i++;
      continue;
    }

    // ── Blockquote ──
    if (/^>\s/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    // ── Unordered list ──
    if (/^[-*+]\s/.test(line.trimStart())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i].trimStart())) {
        items.push(lines[i].trim().replace(/^[-*+]\s/, ''));
        i++;
      }
      blocks.push({ type: 'ul', text: '', items });
      continue;
    }

    // ── Ordered list ──
    if (/^\d+\.\s/.test(line.trimStart())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trimStart())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push({ type: 'ol', text: '', items });
      continue;
    }

    // ── Paragraph (collect consecutive non-empty lines) ──
    if (line.trim() !== '') {
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !/^```/.test(lines[i].trimStart())) {
        paraLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'p', text: paraLines.join('\n') });
      continue;
    }

    // ── Empty line → skip ──
    i++;
  }

  return blocks;
}

/** Render inline markdown syntax (bold, italic, code, link, strikethrough) */
function renderInline(text: string, dark?: boolean): React.ReactNode[] {
  const tc = (light: string, dark_: string) => dark ? dark_ : light;
  // Split by inline patterns while preserving delimiters
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Pattern order matters: bold before italic, code before bold
  const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/;

  while (remaining.length > 0) {
    const match = remaining.match(inlineRegex);
    if (!match) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const idx = match.index!;
    // Text before match
    if (idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    }

    const full = match[0];
    if (match[1]) {
      // Inline code `code`
      parts.push(<code key={key++} className={`${tc('text-amber-600', 'text-amber-300')} ${dark ? 'bg-gray-800' : 'bg-amber-100'} px-1 rounded text-[11px] font-mono`}>{match[1].slice(1, -1)}</code>);
    } else if (match[2]) {
      // Bold **text**
      parts.push(<strong key={key++} className={`${tc('text-gray-900', 'text-white')} font-bold`}>{match[2].slice(2, -2)}</strong>);
    } else if (match[3]) {
      // Italic *text*
      parts.push(<em key={key++} className={`${tc('text-gray-700', 'text-white/90')} italic`}>{match[3].slice(1, -1)}</em>);
    } else if (match[4]) {
      // Strikethrough ~~text~~
      parts.push(<del key={key++} className={`${tc('text-gray-400', 'text-white/50')} line-through`}>{match[4].slice(2, -2)}</del>);
    } else if (match[5]) {
      // Link [text](url)
      const inner = match[5];
      const linkMatch = inner.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
             className={`${tc('text-amber-600 hover:text-amber-700', 'text-amber-400 hover:text-amber-300')} underline`}>
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(<span key={key++}>{full}</span>);
      }
    } else {
      parts.push(<span key={key++}>{full}</span>);
    }

    remaining = remaining.slice(idx + full.length);
  }

  return parts;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, dark = true }) => {
  const blocks = parseBlocks(content);
  const b = (light: string, dark_: string) => dark ? dark_ : light;
  const borderCls = dark ? 'border-white/10' : 'border-gray-200';

  return (
    <div className="markdown-body space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h1':
            return <h1 key={i} className={`text-xl font-bold ${b('text-gray-900', 'text-white')} border-b ${borderCls} pb-1`}>{renderInline(block.text, dark)}</h1>;
          case 'h2':
            return <h2 key={i} className={`text-lg font-bold ${b('text-gray-800', 'text-white/90')}`}>{renderInline(block.text, dark)}</h2>;
          case 'h3':
            return <h3 key={i} className={`text-base font-bold ${b('text-gray-700', 'text-white/80')}`}>{renderInline(block.text, dark)}</h3>;
          case 'h4':
            return <h4 key={i} className={`text-sm font-bold ${b('text-gray-600', 'text-white/70')}`}>{renderInline(block.text, dark)}</h4>;
          case 'code':
            return (
              <pre key={i} className={`${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-100 border-gray-200'} border rounded-lg p-3 overflow-x-auto`}>
                <code className={`text-[12px] ${b('text-green-700', 'text-green-300')} font-mono leading-relaxed block whitespace-pre`}>{block.text}</code>
                {block.lang && <div className={`text-[9px] text-gray-500 mt-1 border-t ${dark ? 'border-gray-800' : 'border-gray-200'} pt-1`}>{block.lang}</div>}
              </pre>
            );
          case 'blockquote':
            return (
              <blockquote key={i} className={`border-l-2 border-amber-500/50 pl-3 ${b('text-gray-500', 'text-white/60')} italic text-sm`}>
                {renderInline(block.text, dark)}
              </blockquote>
            );
          case 'ul':
            return (
              <ul key={i} className={`list-disc list-inside space-y-0.5 text-sm ${b('text-gray-600', 'text-white/70')}`}>
                {block.items?.map((item, j) => (
                  <li key={j}>{renderInline(item, dark)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className={`list-decimal list-inside space-y-0.5 text-sm ${b('text-gray-600', 'text-white/70')}`}>
                {block.items?.map((item, j) => (
                  <li key={j}>{renderInline(item, dark)}</li>
                ))}
              </ol>
            );
          case 'hr':
            return <hr key={i} className={`${dark ? 'border-gray-800' : 'border-gray-200'} my-2`} />;
          case 'p':
          default:
            return <p key={i} className={`text-sm ${b('text-gray-700', 'text-white/80')} leading-relaxed`}>{renderInline(block.text, dark)}</p>;
        }
      })}
    </div>
  );
};

export default MarkdownRenderer;
