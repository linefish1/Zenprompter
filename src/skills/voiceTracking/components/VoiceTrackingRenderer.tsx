/**
 * VoiceTrackingRenderer - 语音跟读文本渲染器
 *
 * 按字符级别渲染文本，五种视觉状态:
 * - 已读       → 灰色文字
 * - 正在读     → 琥珀色背景 + 黑色加粗
 * - 下一句     → 淡蓝色背景 (预览)
 * - 即将读的段  → 蓝绿色背景 (新增)
 * - 默认       → 正常文字
 *
 * 可独立使用，仅依赖 React + types.ts
 */

import React from 'react';
import { CharacterSegment, Clause, HighlightLevel, TextMeta } from '../types';

interface VoiceTrackingRendererProps {
  textMeta: TextMeta;
  matchedIndex: number;
  readIndices: Set<number>;
  /** 立即下一句 clauseId (淡蓝背景) */
  nextSentenceId: number | null;
  /** 即将阅读的段落 clauseId (蓝绿背景) */
  upcomingClauseId: number | null;
  /** 多子句预览集合 — 包含接下来 N 个要读的子句，用于 "下一段"高亮 */
  previewClauseIds?: Set<number>;
  showNextSentence?: boolean;
  showUpcoming?: boolean;
  readColor?: string;
  nextSentenceBg?: string;
  upcomingBg?: string;
}

function getLevel(
  seg: CharacterSegment,
  clause: Clause,
  matchedIndex: number,
  readIndices: Set<number>,
  nextSentenceId: number | null,
  upcomingClauseId: number | null,
  previewClauseIds: Set<number> | null
): HighlightLevel {
  // 1) 正在读 (最高优先级)
  if (seg.isWordChar && seg.normIndex === matchedIndex) {
    return HighlightLevel.Active;
  }

  // 2) 已读
  if (seg.normIndex !== -1 && readIndices.has(seg.normIndex)) {
    return HighlightLevel.Read;
  }

  // 3) 下一句 (淡蓝预览 — 最强高亮)
  if (nextSentenceId !== null && clause.id === nextSentenceId) {
    return HighlightLevel.NextSentence;
  }

  // 4) 其余预览子句 (柔和高亮)
  if (previewClauseIds && previewClauseIds.has(clause.id) && clause.id !== nextSentenceId) {
    return HighlightLevel.Upcoming;
  }

  // 5) 传统 upcoming (向后兼容)
  if (upcomingClauseId !== null && clause.id === upcomingClauseId) {
    return HighlightLevel.Upcoming;
  }

  return HighlightLevel.Default;
}

const VoiceTrackingRenderer: React.FC<VoiceTrackingRendererProps> = ({
  textMeta,
  matchedIndex,
  readIndices,
  nextSentenceId,
  upcomingClauseId,
  previewClauseIds,
  showNextSentence = true,
  showUpcoming = true,
  readColor = '#4b5563',
  nextSentenceBg = 'rgba(96, 165, 250, 0.20)',
  upcomingBg = 'rgba(20, 184, 166, 0.25)',
}) => {
  const { segments, clauses } = textMeta;

  return (
    <>
      {clauses.map((clause) => (
        <span key={clause.id} data-clause-idx={clause.id} className="inline">
          {clause.segIndices.map((segIdx) => {
            const seg = segments[segIdx];
            const level = getLevel(
              seg,
              clause,
              matchedIndex,
              readIndices,
              showNextSentence ? nextSentenceId : null,
              showUpcoming ? upcomingClauseId : null,
              showUpcoming ? previewClauseIds ?? null : null
            );

            let className = 'transition-all duration-150 ease-in-out';
            let style: React.CSSProperties = {};

            switch (level) {
              case HighlightLevel.Read:
                style = { color: readColor };
                break;
              case HighlightLevel.Active:
                className +=
                  ' bg-amber-500 text-black font-extrabold rounded shadow-lg scale-110 inline-block';
                break;
              case HighlightLevel.NextSentence:
                style = { backgroundColor: nextSentenceBg, borderRadius: '2px' };
                break;
              case HighlightLevel.Upcoming:
                style = { backgroundColor: upcomingBg, borderRadius: '2px', padding: '0 1px' };
                break;
              default:
                break;
            }

            return (
              <span
                key={segIdx}
                data-active={level === HighlightLevel.Active ? 'true' : 'false'}
                data-level={level}
                className={className}
                style={style}
              >
                {seg.char}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
};

export default VoiceTrackingRenderer;
