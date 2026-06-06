/**
 * 文本分析器 - 文本规范化、分句、Clause 生成
 *
 * 可独立使用，不依赖 React。
 */

import { CharacterSegment, Clause, TextMeta } from '../types';

/** 字母数字正则（支持 Unicode，覆盖中文、英文、数字） */
const WORD_REGEX = /[\p{L}\p{N}]/u;

/** 分句标点（中文 + 英文 + 换行） */
const SPLIT_PUNCTUATIONS = new Set([
  '.', '!', '?', ',', '\n', '\r',
  '。', '！', '？', '，', '；', '：',
]);

/**
 * 从原始文本生成 TextMeta
 *
 * 包括:
 * - 字符级 segments（含 normIndex 映射）
 * - 规范化文本（只保留字母数字，lowercase）
 * - 基于标点的 clause 分句
 */
export function analyzeText(text: string): TextMeta {
  const segments: CharacterSegment[] = [];
  let normStr = '';

  // Pass 1: 字符级分析
  for (const char of text) {
    const isWordChar = WORD_REGEX.test(char);
    if (isWordChar) {
      segments.push({ char, isWordChar, normIndex: normStr.length });
      normStr += char.toLowerCase();
    } else {
      segments.push({ char, isWordChar, normIndex: -1 });
    }
  }

  // Pass 2: 基于标点分句
  const clauses: Clause[] = [];
  let currentChars: string[] = [];
  let currentSegIndices: number[] = [];
  let charStart = 0;
  let clauseId = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    currentChars.push(char);
    currentSegIndices.push(i);

    if (SPLIT_PUNCTUATIONS.has(char) || i === text.length - 1) {
      const clauseText = currentChars.join('');
      const clauseSegments = currentSegIndices.map(
        (idx) => segments[idx]
      );
      const clNorm = clauseSegments
        .filter((s) => s.isWordChar)
        .map((s) => s.char.toLowerCase())
        .join('');

      let normStartIndex = -1;
      let normEndIndex = -1;
      const validNormSegs = clauseSegments.filter(
        (s) => s.normIndex !== -1
      );
      if (validNormSegs.length > 0) {
        normStartIndex = validNormSegs[0].normIndex;
        normEndIndex = validNormSegs[validNormSegs.length - 1].normIndex;
      }

      clauses.push({
        id: clauseId++,
        text: clauseText,
        normalizedText: clNorm,
        charStartIndex: charStart,
        charEndIndex: i,
        normStartIndex,
        normEndIndex,
        segIndices: currentSegIndices,
      });

      currentChars = [];
      currentSegIndices = [];
      charStart = i + 1;
    }
  }

  return { segments, normalizedText: normStr, clauses };
}

/**
 * 从 Clause 数组中提取搜索空间
 * 返回 { searchSpaceText, searchSpaceIndices }
 */
export function buildSearchSpace(
  clauses: Clause[],
  normalizedText: string
): {
  searchSpaceText: string;
  searchSpaceIndices: number[];
} {
  const searchSpaceIndices: number[] = [];
  let searchSpaceText = '';

  for (const clause of clauses) {
    if (clause.normStartIndex !== -1 && clause.normEndIndex !== -1) {
      for (let idx = clause.normStartIndex; idx <= clause.normEndIndex; idx++) {
        searchSpaceText += normalizedText[idx];
        searchSpaceIndices.push(idx);
      }
    }
  }

  return { searchSpaceText, searchSpaceIndices };
}

/**
 * 计算 Clause 的可见范围（normalized 区间）
 */
export function getVisibleNormRange(clauses: Clause[]): {
  start: number;
  end: number;
} {
  if (clauses.length === 0) {
    return { start: 0, end: 0 };
  }
  return {
    start: clauses[0].normStartIndex,
    end: clauses[clauses.length - 1].normEndIndex,
  };
}

/**
 * 找到包含指定 normIndex 的 Clause ID
 */
export function findClauseIdAt(
  clauses: Clause[],
  normIndex: number
): number | null {
  for (const clause of clauses) {
    if (
      clause.normStartIndex <= normIndex &&
      normIndex <= clause.normEndIndex
    ) {
      return clause.id;
    }
  }
  return null;
}

/**
 * 找到指定 clauseId 之后的下一个 clauseId
 * （用于"即将阅读"段落预览）
 */
export function findNextClauseId(
  clauses: Clause[],
  currentClauseId: number
): number | null {
  const idx = clauses.findIndex((c) => c.id === currentClauseId);
  if (idx !== -1 && idx + 1 < clauses.length) {
    return clauses[idx + 1].id;
  }
  return null;
}
