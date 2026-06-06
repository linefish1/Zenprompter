/**
 * 文本分析引擎 - 智能语音跟读核心模块
 *
 * 该引擎负责将输入文本分析为结构化数据，包括：
 * - 段落划分
 * - 句子解析
 * - 关键词提取
 * - 文本结构缓存
 */

import { TextStructure, Paragraph, Sentence } from '../../../types/voiceTrackingTypes';

/**
 * 文本分析引擎主类
 */
export class TextAnalysisEngine {
  private paragraphSplitter: ParagraphSplitter;
  private sentenceParser: SentenceParser;
  private keywordExtractor: KeywordExtractor;
  private cache: TextStructureCache;

  constructor() {
    this.paragraphSplitter = new ParagraphSplitter();
    this.sentenceParser = new SentenceParser();
    this.keywordExtractor = new KeywordExtractor();
    this.cache = new TextStructureCache();
  }

  /**
   * 分析文本并返回结构化数据
   * @param text 要分析的文本内容
   * @returns 结构化的文本数据
   */
  async analyze(text: string): Promise<TextStructure> {
    // 检查缓存
    const cached = this.cache.get(text);
    if (cached) {
      return cached;
    }

    // 分析过程
    const paragraphs = this.paragraphSplitter.split(text);
    const sentences = this.sentenceParser.parse(text);
    const keywords = this.keywordExtractor.extract(text);

    const result: TextStructure = {
      paragraphs,
      sentences,
      keywords,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      timestamp: new Date().toISOString()
    };

    // 缓存结果
    this.cache.set(text, result);
    return result;
  }

  /**
   * 清除分析缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存的分析结果
   * @param text 文本内容
   * @returns 缓存的结构化数据或null
   */
  getCachedAnalysis(text: string): TextStructure | null {
    return this.cache.get(text);
  }
}

/**
 * 段落划分器 - 将文本划分为段落
 */
class ParagraphSplitter {
  /**
   * 划分段落
   * @param text 输入文本
   * @returns 段落数组
   */
  split(text: string): Paragraph[] {
    // 使用双换行作为段落分隔符
    const paragraphTexts = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    return paragraphTexts.map((paragraphText, index) => {
      const paragraphId = `para-${index + 1}`;
      const startIndex = text.indexOf(paragraphText);
      const endIndex = startIndex + paragraphText.length;

      return {
        id: paragraphId,
        text: paragraphText.trim(),
        startIndex,
        endIndex,
        sentences: [] // 将在后续步骤中填充
      };
    });
  }
}

/**
 * 句子解析器 - 将文本解析为句子
 */
class SentenceParser {
  /**
   * 解析句子
   * @param text 输入文本
   * @returns 句子数组
   */
  parse(text: string): Sentence[] {
    // 使用常见的句子结束标点作为分隔符
    const sentenceTexts = text.split(/(?<=[.!?。！？])/).filter(s => s.trim().length > 0);

    let currentIndex = 0;
    return sentenceTexts.map((sentenceText, index) => {
      const sentenceId = `sent-${index + 1}`;
      const startIndex = currentIndex;
      const endIndex = startIndex + sentenceText.length;

      // 更新当前索引
      currentIndex = endIndex + 1;

      return {
        id: sentenceId,
        text: sentenceText.trim(),
        startIndex,
        endIndex,
        paragraphId: '' // 将在后续步骤中填充
      };
    });
  }
}

/**
 * 关键词提取器 - 提取文本中的关键词
 */
class KeywordExtractor {
  /**
   * 提取关键词
   * @param text 输入文本
   * @returns 关键词数组
   */
  extract(text: string): string[] {
    // 简单实现：提取出现频率较高的名词
    // 在实际应用中可集成NLP库（如spaCy或NLTK）

    // 去除常见停用词
    const stopWords = new Set([
      '的', '了', '和', '是', '在', '我', '你', '他', '她', '它',
      '我们', '你们', '他们', '她们', '它们', '这', '那', '有',
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
      'for', 'of', 'with', 'as', 'is', 'was', 'are', 'be', 'been'
    ]);

    // 分词（简单实现）
    const words = text.toLowerCase().match(/[\u4e00-\u9fa5a-z]+/g) || [];
    const wordFrequency: Record<string, number> = {};

    // 计算词频
    words.forEach(word => {
      if (!stopWords.has(word) && word.length > 1) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });

    // 按频率排序并取前10个作为关键词
    return Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
}

/**
 * 文本结构缓存 - 缓存分析结果
 */
class TextStructureCache {
  private cache: Map<string, TextStructure>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * 设置缓存
   * @param text 文本内容
   * @param structure 结构化数据
   */
  set(text: string, structure: TextStructure): void {
    this.cache.set(this.getCacheKey(text), structure);
  }

  /**
   * 获取缓存
   * @param text 文本内容
   * @returns 缓存的结构化数据或null
   */
  get(text: string): TextStructure | null {
    return this.cache.get(this.getCacheKey(text)) || null;
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 生成缓存键
   * @param text 文本内容
   * @returns 缓存键
   */
  private getCacheKey(text: string): string {
    // 使用文本长度和前100字符作为缓存键
    return `${text.length}-${text.substring(0, 100).hashCode()}`;
  }
}

// 简单的hashCode实现
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function() {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};