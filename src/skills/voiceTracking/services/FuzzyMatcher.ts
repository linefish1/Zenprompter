/**
 * 模糊匹配器 - Levenshtein Distance + 位置惩罚
 *
 * 可独立使用，不依赖 React。
 */

/**
 * 计算 Levenshtein 编辑距离，带最大距离截断
 */
export function levenshteinDistance(
  s: string,
  t: string,
  maxDist: number = 100
): number {
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  if (Math.abs(s.length - t.length) > maxDist) return maxDist + 1;

  // 优化: 只保留两行
  let prev = new Array(t.length + 1);
  let curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[t.length];
}

export interface FuzzyMatchOptions {
  /** 搜索字符串 */
  searchStr: string;
  /** 被搜索的完整规范化文本 */
  normalizedText: string;
  /** 当前位置（用于位置惩罚） */
  currentPos: number;
  /** 容差比例 (默认 0.35 = 35%) */
  tolerance?: number;
  /** 可见范围的 index 映射（用于范围限定） */
  searchSpaceIndices?: number[];
  /** 位置惩罚系数 (默认 0.001) */
  positionPenalty?: number;
  /** 回跳惩罚倍数 (默认 5x 前进惩罚) */
  backtrackPenalty?: number;
}

export interface FuzzyMatchOutput {
  /** 匹配到的 normalizedIndex, -1 表示未匹配 */
  index: number;
  /** 综合得分 (越低越好) */
  score: number;
  /** Levenshtein 原始距离 */
  dist: number;
}

/**
 * 在规范化文本中执行模糊匹配
 *
 * 策略:
 * 1. 滑动窗口搜索，计算 Levenshtein 距离
 * 2. 加入位置惩罚：远离当前位置的匹配得分降低
 * 3. 回跳的惩罚比前进更大
 */
export function fuzzyMatch({
  searchStr,
  normalizedText,
  currentPos,
  tolerance = 0.35,
  searchSpaceIndices,
  positionPenalty = 0.001,
  backtrackPenalty = 5,
}: FuzzyMatchOptions): FuzzyMatchOutput {
  if (normalizedText.length < searchStr.length) {
    return { index: -1, score: Infinity, dist: Infinity };
  }

  const maxAllowableDist = Math.floor(searchStr.length * tolerance);
  let bestIdx = -1;
  let bestScore = Infinity;
  let bestDist = Infinity;

  for (let i = 0; i <= normalizedText.length - searchStr.length; i++) {
    const candidate = normalizedText.slice(i, i + searchStr.length);
    const dist = levenshteinDistance(searchStr, candidate, maxAllowableDist);
    if (dist > maxAllowableDist) continue;

    // 位置惩罚
    const mappedPos = searchSpaceIndices ? searchSpaceIndices[i] : i;
    const drift = mappedPos - currentPos;
    const penalty =
      drift < 0
        ? Math.abs(drift) * positionPenalty * backtrackPenalty
        : drift * positionPenalty;

    const score = dist + penalty;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
      bestDist = dist;
    }
  }

  if (bestIdx !== -1) {
    const matchedEndIdx = bestIdx + searchStr.length - 1;
    const originalIndex = searchSpaceIndices
      ? searchSpaceIndices[matchedEndIdx]
      : matchedEndIdx;
    return { index: originalIndex, score: bestScore, dist: bestDist };
  }

  return { index: -1, score: Infinity, dist: Infinity };
}
