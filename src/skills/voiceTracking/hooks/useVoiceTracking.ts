/**
 * useVoiceTracking - 语音跟读核心 Hook (增强版)
 *
 * 增强特性：
 * 1. 方向感知阈值 — 连续小步前进不再被拦截
 * 2. 位置停滞检测 — 同一位置卡住 5 次触发强制重扫
 * 3. 带状搜索 — 只搜当前位 ±BAND 窗口，避免远距离误匹配
 * 4. 自适应容差 — 根据匹配成败动态调整 tolerance
 *
 * 整合 Web Speech API / API 识别 + 模糊匹配 + 阅读位置追踪
 * 可独立使用，仅依赖 React + types.ts + 各 service
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  VoiceTrackingSettings,
  RecognitionResult,
  VoiceStatus,
  Clause,
  TextMeta,
} from '../types';
import { analyzeText, buildSearchSpace, getVisibleNormRange, findClauseIdAt, findNextClauseId } from '../services/TextAnalyzer';
import { fuzzyMatch } from '../services/FuzzyMatcher';
import { createRecognitionService, ISpeechRecognitionService, RecognitionCallbacks } from '../services/SpeechRecognitionService';

export interface UseVoiceTrackingOptions {
  text: string;
  settings: VoiceTrackingSettings;
  active: boolean;
  getVisibleClauses?: () => Clause[];
  textMeta?: TextMeta;
  onSettingsChange?: (newSettings: VoiceTrackingSettings) => void;
  audioStream?: MediaStream; // Add this line
}

export interface UseVoiceTrackingResult {
  voiceStatus: VoiceStatus;
  matchedIndex: number;
  fatalError: boolean;
  readIndices: Set<number>;
  nextClauseId: number | null;
  upcomingClauseId: number | null;
  /** 预览子句 ID 集合，包含接下来 N 个要读的子句（用于下一段高亮展示） */
  previewClauseIds: Set<number>;
  textMeta: TextMeta;
  resetTracking: () => void;
  jumpTo: (index: number) => void;
  reconfigureBackend: (settings: VoiceTrackingSettings) => Promise<void>;
}

// ===== 增强引擎常量 =====
const DEFAULT_VISIBLE_CLAUSES: Clause[] = [];
const EMPTY_SET = new Set<number>();
const BAND_HALF_WIDTH = 200;        // 带状搜索半宽（normIndex 单位）
const STAGNATION_LIMIT = 5;         // 同位置连续匹配 N 次触发强制重扫
const STUCK_LIMIT = 4;              // 连续未匹配 N 次进入 reacquiring
const TOLERANCE_DEFAULT = 0.35;     // 初始容差
const TOLERANCE_MAX = 0.60;         // 最大容差
const TOLERANCE_STEP_UP = 0.05;     // 失败时容差增幅
const TOLERANCE_STEP_DOWN = 0.02;   // 成功时容差降幅
const MIN_ADVANCE = 1;              // 最小前进量才视为推进
const CONSECUTIVE_FORWARD_MIN = 2;  // 连续前进 N 次小步也放行
const PREVIEW_CLAUSE_COUNT = 8;     // 预览子句数量（下一段高亮范围）

/**
 * Extract banded search window from normalizedText
 */
function extractBandedWindow(
  normalizedText: string,
  currentPos: number,
): { bandedText: string; bandedOffset: number } {
  const start = Math.max(0, currentPos - BAND_HALF_WIDTH);
  const end = Math.min(normalizedText.length, currentPos + BAND_HALF_WIDTH);
  return {
    bandedText: normalizedText.slice(start, end),
    bandedOffset: start,
  };
}

export function useVoiceTracking(options: UseVoiceTrackingOptions): UseVoiceTrackingResult {
  const {
    text,
    settings,
    active,
    getVisibleClauses,
    textMeta: externalTextMeta,
    audioStream, // Destructure audioStream here
  } = options;
  // ===== 文本分析 =====
  const textMeta = useMemo(
    () => externalTextMeta || analyzeText(text),
    [text, externalTextMeta]
  );

  // ===== 状态 =====
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [matchedIndex, setMatchedIndex] = useState<number>(-1);
  const [fatalError, setFatalError] = useState(false);
  const [readIndices, setReadIndices] = useState<Set<number>>(EMPTY_SET);
  const [nextClauseId, setNextClauseId] = useState<number | null>(null);
  const [upcomingClauseId, setUpcomingClauseId] = useState<number | null>(null);
  const [previewClauseIds, setPreviewClauseIds] = useState<Set<number>>(new Set());

  // ===== Refs =====
  const serviceRef = useRef<ISpeechRecognitionService | null>(null);
  const lastMatchIndexRef = useRef<number>(0);
  const stuckCounterRef = useRef<number>(0);
  const isReacquiringRef = useRef<boolean>(true);
  const prevMatchedIndexRef = useRef<number>(-1);
  const activeRef = useRef(active);
  activeRef.current = active;
  const textMetaRef = useRef(textMeta);
  textMetaRef.current = textMeta;
  const getVisibleClausesRef = useRef(getVisibleClauses);
  getVisibleClausesRef.current = getVisibleClauses;

  // ===== 增强引擎 refs =====
  const consecutiveForwardRef = useRef<number>(0);    // 连续小步前进计数
  const samePositionCountRef = useRef<number>(0);     // 同位置连续匹配计数
  const adaptiveToleranceRef = useRef(TOLERANCE_DEFAULT);

  // ===== 重置 =====
  const resetTracking = useCallback(() => {
    setMatchedIndex(-1);
    setReadIndices(EMPTY_SET);
    setNextClauseId(null);
    setUpcomingClauseId(null);
    setPreviewClauseIds(new Set());
    lastMatchIndexRef.current = 0;
    stuckCounterRef.current = 0;
    isReacquiringRef.current = true;
    prevMatchedIndexRef.current = -1;
    consecutiveForwardRef.current = 0;
    samePositionCountRef.current = 0;
    adaptiveToleranceRef.current = TOLERANCE_DEFAULT;
  }, []);

  const jumpTo = useCallback((index: number) => {
    setMatchedIndex(index);
    lastMatchIndexRef.current = index;
    prevMatchedIndexRef.current = index;
    stuckCounterRef.current = 0;
    consecutiveForwardRef.current = 0;
    samePositionCountRef.current = 0;
    isReacquiringRef.current = false;
  }, []);

  /**
   * 执行一次模糊匹配（带增强引擎）
   * 返回 matchedNormIdx（-1 = 未匹配）
   */
  const doEnhancedMatch = useCallback((
    searchStr: string,
    normalizedText: string,
    currentPos: number,
    visibleClauses: Clause[],
  ): number => {
    let matchedNormIdx = -1;
    const tolerance = adaptiveToleranceRef.current;
    const isForceRescan = samePositionCountRef.current >= STAGNATION_LIMIT; // Fixed typo here: samePositionRef -> samePositionCountRef

    // Step 0: 强制重扫模式 — 扩大容差 + 忽略位置惩罚
    const forceTolerance = isForceRescan ? TOLERANCE_MAX : tolerance;
    const forcePenalty = isForceRescan ? 0 : undefined;

    // Step 1: 可见子句优先匹配
    if (visibleClauses.length > 0) {
      const { searchSpaceText, searchSpaceIndices } = buildSearchSpace(
        visibleClauses,
        normalizedText
      );
      // Map currentPos to visible-clause search space
      let mappedPos = currentPos;
      for (let i = 0; i < searchSpaceIndices.length; i++) {
        if (searchSpaceIndices[i] >= currentPos) {
          mappedPos = i;
          break;
        }
      }
      const matchResult = fuzzyMatch({
        searchStr,
        normalizedText: searchSpaceText,
        currentPos: mappedPos,
        searchSpaceIndices,
        tolerance: forceTolerance,
        positionPenalty: forcePenalty ?? 0.001,
      });
      if (matchResult.index !== -1) {
        matchedNormIdx = matchResult.index;
      }
    }

    // Step 2: 带状搜索 fallback
    if (matchedNormIdx === -1) {
      const { bandedText, bandedOffset } = extractBandedWindow(normalizedText, currentPos);
      const bandedMatch = fuzzyMatch({
        searchStr,
        normalizedText: bandedText,
        currentPos: currentPos - bandedOffset,
        tolerance: forceTolerance,
        positionPenalty: forcePenalty ?? 0.001,
      });
      if (bandedMatch.index !== -1) {
        matchedNormIdx = bandedMatch.index + bandedOffset;
      }
    }

    // Step 3: 全局 fallback（仅在强制重扫或带状未命中时）
    if (matchedNormIdx === -1 && (isForceRescan || visibleClauses.length === 0)) {
      const globalMatch = fuzzyMatch({
        searchStr,
        normalizedText,
        currentPos,
        tolerance: forceTolerance,
        positionPenalty: forcePenalty ?? 0.001,
      });
      if (globalMatch.index !== -1) {
        matchedNormIdx = globalMatch.index;
      }
    }

    // Step 4: 限制到可见范围
    if (matchedNormIdx !== -1) {
      const visibleRange = visibleClauses.length > 0
        ? getVisibleNormRange(visibleClauses)
        : { start: matchedNormIdx, end: matchedNormIdx };
      matchedNormIdx = Math.max(
        visibleRange.start,
        Math.min(visibleRange.end, matchedNormIdx)
      );
    }

    return matchedNormIdx;
  }, []);

  /**
   * 判断是否应该接受此匹配位置
   * 方向感知：连续小步前进也放行
   */
  const shouldAcceptPosition = useCallback((
    newPos: number,
    currentPos: number,
    isForward: boolean,
  ): boolean => {
    const diff = newPos - currentPos;

    // 大幅前进 → 直接接受
    if (diff > MIN_ADVANCE) {
      consecutiveForwardRef.current = 0;
      return true;
    }

    // 大幅后退 → 拒绝（除非 reacquiring）
    if (diff < -MIN_ADVANCE) {
      consecutiveForwardRef.current = 0;
      if (isReacquiringRef.current) return true;
      return false;
    }

    // 小步前进 (0 < diff <= MIN_ADVANCE)
    if (diff > 0) {
      consecutiveForwardRef.current++;
      // 连续小步前进 N 次也放行
      if (consecutiveForwardRef.current >= CONSECUTIVE_FORWARD_MIN) {
        consecutiveForwardRef.current = 0;
        return true;
      }
      return false;
    }

    // 原地不动 → 计为停滞
    consecutiveForwardRef.current = 0;
    return false;
  }, []);

  // ===== 语音识别回调 =====
  const handleResult = useCallback(
    (result: RecognitionResult) => {
      if (!activeRef.current) return;

      // 规范化识别文本
      let clean = '';
      const regex = /[\p{L}\p{N}]/u;
      for (const char of result.text) {
        if (regex.test(char)) clean += char.toLowerCase();
      }
      if (clean.length < 2) return;

      const currentTextMeta = textMetaRef.current;
      const { normalizedText, clauses } = currentTextMeta;
      if (normalizedText.length < 3) return;

      const WINDOW = 40;
      const searchStr = clean.slice(-WINDOW);
      const currentPos = lastMatchIndexRef.current;

      // 获取可见子句
      const currentGetVisible = getVisibleClausesRef.current;
      const visibleClauses = currentGetVisible?.() ?? DEFAULT_VISIBLE_CLAUSES;

      // 增强匹配
      const matchedNormIdx = doEnhancedMatch(searchStr, normalizedText, currentPos, visibleClauses);

      if (matchedNormIdx !== -1) {
        const diff = matchedNormIdx - currentPos;
        const isForward = diff > 0;
        const accepted = shouldAcceptPosition(matchedNormIdx, currentPos, isForward);

        // ── 位置停滞检测 ──
        if (diff === 0) {
          samePositionCountRef.current++;
        } else {
          samePositionCountRef.current = 0;
        }

        if (accepted || samePositionCountRef.current >= STAGNATION_LIMIT) {
          // ── 位置可接受 → 更新 ──
          stuckCounterRef.current = 0;
          lastMatchIndexRef.current = matchedNormIdx;
          setMatchedIndex(matchedNormIdx);

          // 自适应容差：成功 → 降回默认
          if (adaptiveToleranceRef.current > TOLERANCE_DEFAULT) {
            adaptiveToleranceRef.current = Math.max(
              TOLERANCE_DEFAULT,
              adaptiveToleranceRef.current - TOLERANCE_STEP_DOWN
            );
          }

          if (samePositionCountRef.current >= STAGNATION_LIMIT) {
            // 强制重扫生效 → 重置停滞计数和容差
            samePositionCountRef.current = 0;
            adaptiveToleranceRef.current = TOLERANCE_DEFAULT;
            setVoiceStatus('tracking');
          } else if (!isReacquiringRef.current) {
            setVoiceStatus('tracking');
          }
          isReacquiringRef.current = false;
        } else {
          // 位置变化太小 → 搁置但不计为失败
          if (isForward) {
            // 小步前进被搁置，不增加 stuck counter
          } else {
            stuckCounterRef.current++;
          }
        }

      } else {
        // ── 未匹配 → 自适应容差增大 ──
        stuckCounterRef.current++;
        adaptiveToleranceRef.current = Math.min(
          TOLERANCE_MAX,
          adaptiveToleranceRef.current + TOLERANCE_STEP_UP
        );
      }

      // 连续 N 次未匹配 → 进入 reacquiring
      if (stuckCounterRef.current >= STUCK_LIMIT) {
        isReacquiringRef.current = true;
        stuckCounterRef.current = 0;
        consecutiveForwardRef.current = 0;
        setVoiceStatus('reacquiring');
      }
    },
    [doEnhancedMatch, shouldAcceptPosition]
  );

  const handleStatus = useCallback((status: VoiceStatus) => {
    setVoiceStatus(status);
  }, []);

  const handleError = useCallback((_error: string) => {
    // 非致命错误，状态已通过 handleStatus 更新
  }, []);

  // ===== 识别服务生命周期 =====
  useEffect(() => {
    // Clean up previous service
    if (serviceRef.current) {
      serviceRef.current.stop();
      serviceRef.current = null;
    }

    if (!active) {
      setVoiceStatus('idle');
      return;
    }

    setFatalError(false);
    setVoiceStatus('initializing');

    let cancelled = false;

    (async () => {
      try {
        // createRecognitionService is async — it may dynamically import the
        // Capacitor backend when running on a native platform
        const service = await createRecognitionService(settings.backend, audioStream);
        if (cancelled) { service.stop(); return; }
        serviceRef.current = service;

        await service.initialize(settings.backend);

        const callbacks: RecognitionCallbacks = {
          onResult: handleResult,
          onStatus: handleStatus,
          onError: handleError,
        };

        await service.start(callbacks, audioStream);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Voice recognition failed:', err);
        setVoiceStatus('error');
        setFatalError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (serviceRef.current) {
        serviceRef.current.stop();
        serviceRef.current = null;
      }
    };
  }, [active, settings.backend.type, settings.backend.apiUrl, settings.backend.apiKey, handleResult, handleStatus, handleError]);

  // ===== 阅读状态更新 =====
  useEffect(() => {
    if (matchedIndex === -1 || !active) return;

    const prevIndex = prevMatchedIndexRef.current;
    const JUMP_THRESHOLD = 100;

    setReadIndices((current) => {
      const next = new Set(current);
      if (matchedIndex > prevIndex) {
        if (matchedIndex - prevIndex < JUMP_THRESHOLD) {
          for (let i = prevIndex; i < matchedIndex; i++) {
            if (i >= 0) next.add(i);
          }
        }
      } else if (matchedIndex < prevIndex) {
        for (let i = matchedIndex + 1; i <= prevIndex; i++) {
          next.delete(i);
        }
      }
      return next;
    });

    prevMatchedIndexRef.current = matchedIndex;

    const currentClauseId = findClauseIdAt(textMeta.clauses, matchedIndex);
    if (currentClauseId !== null) {
      const nxt = findNextClauseId(textMeta.clauses, currentClauseId);
      setNextClauseId(nxt);

      // Compute next (upcomingClauseId)
      if (nxt !== null) {
        setUpcomingClauseId(findNextClauseId(textMeta.clauses, nxt));
      } else {
        setUpcomingClauseId(null);
      }

      // Compute previewClauseIds: collect N upcoming clauses
      const previewIds = new Set<number>();
      let cursor = nxt;
      for (let i = 0; i < PREVIEW_CLAUSE_COUNT && cursor !== null; i++) {
        previewIds.add(cursor);
        cursor = findNextClauseId(textMeta.clauses, cursor);
      }
      setPreviewClauseIds(previewIds);
    } else {
      setPreviewClauseIds(new Set());
    }
  }, [matchedIndex, active, textMeta.clauses]);

  return {
    voiceStatus,
    matchedIndex,
    fatalError,
    readIndices,
    nextClauseId,
    upcomingClauseId,
    previewClauseIds,
    textMeta,
    resetTracking,
    jumpTo,
    reconfigureBackend: async (newSettings: VoiceTrackingSettings) => {
      if (serviceRef.current) {
        serviceRef.current.stop();
      }
      setFatalError(false);
      if (onSettingsChange) {
        onSettingsChange(newSettings);
      }
    },
  };
}
