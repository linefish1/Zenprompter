# 语音跟读 Skill

## 概述

将「语音跟读」功能提取为可复用模块。用户对着麦克风朗读屏幕上的文本，
系统通过 Web Speech API (或 API 后端) 实时识别语音，用模糊匹配算法定位到文本中的对应位置，
从而实现字符级高亮跟随 + 自动滚动。

## 依赖

- React 18+
- TypeScript 4+
- 浏览器需支持 Web Speech API（Chrome/Edge 最佳）

## 目录结构

```
src/skills/voiceTracking/
├── index.ts                                   # 统一导出入口
├── types.ts                                   # 所有类型定义
├── SKILL.md                                   # 本文档
├── services/
│   ├── FuzzyMatcher.ts                        # Levenshtein 模糊匹配
│   ├── TextAnalyzer.ts                        # 文本规范化/分句
│   └── SpeechRecognitionService.ts            # 语音识别服务 (Web Speech / API)
├── hooks/
│   └── useVoiceTracking.ts                    # 核心 Hook
└── components/
    ├── VoiceTrackingRenderer.tsx              # 字符级高亮渲染器
    └── VoiceTrackingSettingsPanel.tsx          # 设置面板
```

## 视觉层级

| 层级 | 视觉样式 | 含义 |
|------|---------|------|
| `Read` | 灰色 `#4b5563` 文字 | 已朗读过的内容 |
| `Active` | 琥珀色背景 + 黑色加粗 | 当前正在朗读的字符 |
| `NextSentence` | 淡蓝底色 | 即将读到的下一句（预览） |
| `Upcoming` | 蓝绿底色 | 再下一个段落（即将阅读区域） |
| `Default` | 正常文字颜色 | 尚未读到的内容 |

## 快速开始

### 1. 基本用法

```tsx
import { useMemo } from 'react';
import {
  useVoiceTracking,
  VoiceTrackingRenderer,
  analyzeText,
} from './skills/voiceTracking';
import type { VoiceTrackingSettings } from './skills/voiceTracking';

const defaultSettings: VoiceTrackingSettings = {
  highlightMode: 'character',
  highlightColor: '#FFFF00',
  highlightSpeed: 50,
  autoScroll: true,
  autoScrollSpeed: 60,
  voiceSync: true,
  fontSize: 24,
  backend: { type: 'web-speech-api', language: 'zh-CN' },
};

function Teleprompter({ text }: { text: string }) {
  const textMeta = useMemo(() => analyzeText(text), [text]);

  const vt = useVoiceTracking({
    text,
    settings: defaultSettings,
    active: true, // 激活语音识别
    textMeta,     // 复用文本分析结果
  });

  return (
    <div>
      {/* 高亮渲染 */}
      <VoiceTrackingRenderer
        textMeta={textMeta}
        matchedIndex={vt.matchedIndex}
        readIndices={vt.readIndices}
        nextSentenceId={vt.nextClauseId}
        upcomingClauseId={vt.upcomingClauseId}
      />

      {/* 状态指示器 */}
      <div className="status">{vt.voiceStatus}</div>
    </div>
  );
}
```

### 2. 配置识别后端

Web Speech API（默认，无需额外配置）：

```ts
backend: { type: 'web-speech-api', language: 'zh-CN' }
```

API 模式（对接第三方语音识别）：

```ts
backend: {
  type: 'api',
  apiUrl: 'https://your-api.com/v1/speech',
  apiKey: 'sk-xxx',
  language: 'zh-CN',
}
```

### 3. 结合 "即将阅读段落" 蓝绿背景

`upcomingClauseId` 是当前匹配位置再往后两个 clause 的 ID。
`VoiceTrackingRenderer` 会自动为这些 clause 内的字符添加 `rgba(20, 184, 166, 0.25)` 蓝绿底色。

自定义颜色：

```tsx
<VoiceTrackingRenderer
  upcomingBg="rgba(0, 200, 180, 0.3)"  // 自定义蓝绿背景
  nextSentenceBg="rgba(100, 150, 255, 0.2)" // 自定义下一句背景
/>
```

## API 参考

### `useVoiceTracking(options): UseVoiceTrackingResult`

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 原始文本 |
| `settings` | `VoiceTrackingSettings` | 语音跟读配置 |
| `active` | `boolean` | 是否激活语音识别 |
| `getVisibleClauses?` | `() => Clause[]` | 获取当前可见子句（用于可见区域优先匹配） |
| `textMeta?` | `TextMeta` | 预计算的文本分析结果 |

| 返回值 | 类型 | 说明 |
|--------|------|------|
| `voiceStatus` | `VoiceStatus` | 当前语音状态 |
| `matchedIndex` | `number` | 匹配到的 normalized index |
| `fatalError` | `boolean` | 是否发生致命错误 |
| `readIndices` | `Set<number>` | 已读的 normIndex 集合 |
| `nextClauseId` | `number \| null` | 下一句 clauseId |
| `upcomingClauseId` | `number \| null` | 即将阅读段落 clauseId |
| `textMeta` | `TextMeta` | 文本元数据 |
| `resetTracking` | `() => void` | 重置阅读位置 |

### `VoiceTrackingRenderer`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `textMeta` | `TextMeta` | (必填) | 文本元数据 |
| `matchedIndex` | `number` | (必填) | 当前匹配位置 |
| `readIndices` | `Set<number>` | (必填) | 已读集合 |
| `nextSentenceId` | `number \| null` | - | 下一句预览 |
| `upcomingClauseId` | `number \| null` | - | 即将阅读段落 |
| `showNextSentence` | `boolean` | `true` | 是否显示下一句预览 |
| `showUpcoming` | `boolean` | `true` | 是否显示即将阅读段落 |
| `readColor` | `string` | `#4b5563` | 已读文字颜色 |
| `nextSentenceBg` | `string` | `rgba(96,165,250,0.20)` | 下一句背景色 |
| `upcomingBg` | `string` | `rgba(20,184,166,0.25)` | 即将阅读段落背景色 |

### `analyzeText(text): TextMeta`

将原始文本转换为内部结构，包含 segments、normalizedText、clauses。

### `fuzzyMatch(options): FuzzyMatchOutput`

Levenshtein 模糊匹配 + 位置惩罚。用于自定义匹配逻辑。

## 与旧版差异

对比原先分散在 `hooks/useVoiceTracking.ts` + `RecordingOverlay.tsx` + `services/voiceTracking/` 的实现：

1. **合并重复逻辑**：消除 RecordingOverlay 中独立的语音识别循环
2. **可配置后端**：Web Speech API / API 模式可切换
3. **新增蓝绿背景**：`upcomingClauseId` 驱动的即将阅读段落高亮
4. **文本分析独立**：`analyzeText()` 纯函数，便于测试
5. **匹配引擎独立**：`FuzzyMatcher` 无副作用，可独立测试
6. **类型统一**：所有类型集中在 `types.ts`

## 浏览器兼容

| 浏览器 | Web Speech API | API 模式 |
|--------|---------------|---------|
| Chrome 33+ | ✅ | ✅ |
| Edge 79+ | ✅ | ✅ |
| Safari 14.1+ | ⚠️ 部分 | ✅ |
| Firefox | ❌ | ✅ |

## 许可

随项目使用，MIT。
