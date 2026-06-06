# Voice Tracking Skill

## 描述

语音跟读（voice tracking）模块——用户在浏览器中对麦克风朗读文本，系统实时识别语音并通过模糊匹配定位到文本对应位置，实现字符级高亮跟随和自动滚动。

当用户询问以下内容时使用此 skill：
- 集成/使用 voice tracking 或语音跟读功能
- 配置语音识别后端（Web Speech API 或第三方 API）
- 调试语音识别、匹配定位、高亮渲染相关问题
- 扩展或修改 voice tracking 模块
- 理解 TextMeta / Clause / CharacterSegment 等数据结构
- 处理浏览器兼容性（Chrome、Safari、Firefox 的 Web Speech API 差异）

## 模块位置

```
src/skills/voiceTracking/
├── index.ts                          # 统一导出入口
├── types.ts                          # 所有类型定义
├── SKILL.md                          # 原始技能文档
├── services/
│   ├── FuzzyMatcher.ts               # Levenshtein 模糊匹配
│   ├── TextAnalyzer.ts               # 文本规范化/分句
│   └── SpeechRecognitionService.ts   # 语音识别服务（Web Speech / API）
├── hooks/
│   └── useVoiceTracking.ts           # 核心 Hook
└── components/
    ├── VoiceTrackingRenderer.tsx      # 字符级高亮渲染器
    └── VoiceTrackingSettingsPanel.tsx # 设置面板
```

## 核心架构

### 数据流

```
麦克风 → SpeechRecognitionService → RecognitionResult
                                         ↓
                                  fuzzyMatch() 在 TextMeta.normalizedText 中定位
                                         ↓
                                  useVoiceTracking 更新 matchedIndex / readIndices / clauseId
                                         ↓
                                  VoiceTrackingRenderer 按字符级渲染五种视觉状态
```

### 五种渲染状态

| 层级 | 枚举值 | 视觉样式 | 含义 |
|------|--------|---------|------|
| Read | `HighlightLevel.Read` | 灰色 `#4b5563` | 已朗读过的内容 |
| Active | `HighlightLevel.Active` | 琥珀色背景 + 黑色加粗 | 当前正在朗读的字符 |
| NextSentence | `HighlightLevel.NextSentence` | 淡蓝底色 | 即将读到的下一句（预览） |
| Upcoming | `HighlightLevel.Upcoming` | 蓝绿底色 | 再下一个段落（即将阅读区域） |
| Default | `HighlightLevel.Default` | 正常文字颜色 | 尚未读到的内容 |

### 关键数据结构

**TextMeta** — `analyzeText(text)` 的输出：
- `segments: CharacterSegment[]` — 每个字符及其 `isWordChar`、`normIndex`（只对字母数字分配，非文字字符为 -1）
- `normalizedText: string` — 去除非文字字符 + lowercase 的纯文本，用于模糊匹配
- `clauses: Clause[]` — 按标点（中英文句号、逗号、换行等）分割的子句，每个 clause 包含其在 normalizedText 中的 `normStartIndex` / `normEndIndex`

**Clause** — 子句结构：
- `id: number` — 从 0 递增，用于「下一句」「即将阅读段落」的判定
- `text: string` — 原始文本
- `normalizedText: string` — 规范化的 clause 文本
- `normStartIndex / normEndIndex` — 在全局 normalizedText 中的起止位置
- `charStartIndex / charEndIndex` — 在原始 text 中的起止位置
- `segIndices: number[]` — 该 clause 包含的 segment 索引

**RecognitionResult** — 语音识别结果：
- `text: string` — 识别到的文本
- `confidence: number` — 置信度
- `isFinal: boolean` — 是否最终结果
- `timestamp: number` — 时间戳

## 快速集成

### 最小可用示例

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
    active: true,
    textMeta, // 复用预计算的 textMeta
  });

  return (
    <div>
      <VoiceTrackingRenderer
        textMeta={textMeta}
        matchedIndex={vt.matchedIndex}
        readIndices={vt.readIndices}
        nextSentenceId={vt.nextClauseId}
        upcomingClauseId={vt.upcomingClauseId}
      />
      <div className="status">{vt.voiceStatus}</div>
    </div>
  );
}
```

### useVoiceTracking 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `text` | `string` | 是 | 需要跟读的原始文本 |
| `settings` | `VoiceTrackingSettings` | 是 | 完整配置 |
| `active` | `boolean` | 是 | 控制语音识别启停，切换时会重建 service |
| `getVisibleClauses` | `() => Clause[]` | 否 | 返回当前可见子句，用于可见区域优先匹配 |
| `textMeta` | `TextMeta` | 否 | 预计算的文本分析结果，不传则自动计算 |

### useVoiceTracking 返回值

| 字段 | 类型 | 说明 |
|------|------|------|
| `voiceStatus` | `VoiceStatus` | 当前语音状态（idle / initializing / listening / tracking / reacquiring / error / no-speech / no-permission） |
| `matchedIndex` | `number` | 当前匹配到的 normalized index，-1 表示未匹配 |
| `fatalError` | `boolean` | 致命错误（如浏览器不支持、权限被拒），此时应提示用户 |
| `readIndices` | `Set<number>` | 已读的 normIndex 集合（增量更新，跳转超过 100 个位置时不追溯标记） |
| `nextClauseId` | `number \| null` | 当前 clause 的下一个 clause 的 ID（淡蓝预览） |
| `upcomingClauseId` | `number \| null` | 再下一个 clause 的 ID（蓝绿预览） |
| `textMeta` | `TextMeta` | 文本元数据（复用时传入的相同对象） |
| `resetTracking` | `() => void` | 重置所有跟踪状态 |
| `jumpTo` | `(index: number) => void` | 跳转到指定 normalized index |
| `reconfigureBackend` | `(settings) => Promise<void>` | 停止当前服务、清除 fatalError（实际重建由 useEffect 的依赖触发） |

### VoiceTrackingRenderer 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `textMeta` | `TextMeta` | 必填 | 文本元数据 |
| `matchedIndex` | `number` | 必填 | 当前匹配位置 |
| `readIndices` | `Set<number>` | 必填 | 已读集合 |
| `nextSentenceId` | `number \| null` | - | 下一句预览 clause ID |
| `upcomingClauseId` | `number \| null` | - | 即将阅读段落 clause ID |
| `showNextSentence` | `boolean` | `true` | 是否显示淡蓝预览 |
| `showUpcoming` | `boolean` | `true` | 是否显示蓝绿预览 |
| `readColor` | `string` | `#4b5563` | 已读文字颜色 |
| `nextSentenceBg` | `string` | `rgba(96,165,250,0.20)` | 下一句背景色 |
| `upcomingBg` | `string` | `rgba(20,184,166,0.25)` | 即将阅读段落背景色 |

## 语音识别后端

### Web Speech API（默认）

不需要外部服务，浏览器原生支持。Chrome/Edge 支持良好，Safari 部分支持，Firefox 不支持。

```ts
backend: { type: 'web-speech-api', language: 'zh-CN' }
```

特点：
- 免费、离线可用
- continuous: true, interimResults: true
- 自动重连机制（onend 后 250ms 重试）
- 处理 no-speech / not-allowed / aborted 等错误状态

### API 模式

对接任意第三方语音识别服务（Google Cloud STT、DeepSeek、OpenAI Whisper 等）。

```ts
backend: {
  type: 'api',
  apiUrl: 'https://your-api.com/v1/speech',
  apiKey: 'sk-xxx',
  language: 'zh-CN',
}
```

特点：
- 使用 MediaRecorder 每 3 秒发送一次音频 chunk
- 音频格式优先 webm，fallback mp4
- 发送时在 Authorization header 中携带 Bearer token
- 解析响应时按优先级尝试：`data.text` → `data.transcript` → `data.results[0].alternatives[0].transcript`

## 模糊匹配引擎（FuzzyMatcher）

### fuzzyMatch 核心逻辑

1. 滑动窗口扫描 normalizedText，窗口大小 = searchStr.length
2. 对每个窗口计算 Levenshtein 编辑距离
3. 距离超过 `tolerance * searchStr.length`（默认 35%）则跳过
4. 叠加位置惩罚：前进 `|drift| * 0.001`，回跳 `|drift| * 0.005`（5 倍惩罚）
5. 得分 = dist + penalty，取最低分

### 匹配策略（useVoiceTracking 内部）

1. **可见区域优先**：如果提供了 `getVisibleClauses`，先在这些 clause 的搜索空间中匹配
2. **全局 fallback**：可见区域未匹配到，则在整个 normalizedText 中搜索
3. **位置限制**：匹配结果限制在可见 clause 的 normRange 内
4. **去抖**：仅当匹配位置与当前位置相差 > 1 时才更新
5. **重获状态**：连续 3 次未匹配进入 `reacquiring` 状态

## 调试指南

### 常见问题

**语音识别无法启动**
- 检查浏览器是否支持 Web Speech API（`window.SpeechRecognition || window.webkitSpeechRecognition`）
- 检查麦克风权限（`navigator.mediaDevices.getUserMedia`）
- 查看 `voiceStatus` 是否为 `no-permission` 或 `error`
- 检查 `fatalError` 是否为 true

**匹配不准确**
- 检查 `analyzeText()` 输出的 `normalizedText` 是否合理
- 调整 `FuzzyMatchOptions.tolerance`（增大容差 = 更宽松匹配）
- 检查 `getVisibleClauses` 是否返回了正确的可见区域
- 连续 3 次未匹配会进入 `reacquiring` 状态——这是正常行为

**高亮不更新**
- 确认 `matchedIndex` 在变化
- 确认 `readIndices` 在累积（跳转超过 100 个位置时不追溯标记，这是设计如此）
- 检查 `VoiceTrackingRenderer` 的 props 是否正确传递

**API 模式无响应**
- 检查 API URL 是否可访问（CORS）
- 检查 API 返回格式是否匹配解析逻辑
- 查看 Network 面板中 3 秒间隔的 POST 请求

### 调试输出

在 `useVoiceTracking` 的 `handleResult` 中添加日志：

```ts
console.log('Recognition text:', result.text, 'clean:', clean);
console.log('Matched index:', matchedNormIdx, 'stuck:', stuckCounterRef.current);
```

## 依赖

- React 18+
- TypeScript 4+
- 浏览器 Web Speech API（Chrome/Edge 最佳，Safari 部分支持，Firefox 需用 API 模式）

## 文件修改指南

### 添加新的识别后端

1. 在 `types.ts` 的 `RecognitionBackend` 中新增类型（如 `'websocket'`）
2. 实现 `ISpeechRecognitionService` 接口（参考 `APIRecognitionService`）
3. 在 `createRecognitionService()` 工厂函数中新增 case
4. 更新 `VoiceTrackingSettingsPanel` 添加后端选择 UI

### 修改匹配算法

- 核心逻辑在 `services/FuzzyMatcher.ts` 的 `fuzzyMatch()` 函数
- 匹配策略在 `hooks/useVoiceTracking.ts` 的 `handleResult` 回调中
- `TextAnalyzer.ts` 的 `analyzeText()` / `buildSearchSpace()` 决定搜索空间结构

### 添加新的渲染状态

1. 在 `types.ts` 的 `HighlightLevel` 枚举中新增值
2. 在 `VoiceTrackingRenderer.tsx` 的 `getLevel()` 函数中新增判定逻辑
3. 在 `switch (level)` 中添加对应的 CSS 样式
4. 更新 `VoiceTrackingRendererProps` 添加相关的颜色/显示控制属性
