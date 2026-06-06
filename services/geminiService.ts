import { GoogleGenAI } from "@google/genai";
import { getFramework, HOOK_ARCHETYPES, getNextHookType, FRAMEWORK_IDS, LENGTH_PRESETS, AUDIENCE_PRESETS } from '../config/writingFrameworks';

const apiKey = import.meta.env.VITE_API_KEY;

// Initialize the default client only if the key is available
const defaultAi = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to get active custom LLM configuration
interface CustomLlmConfig {
  id: string;
  name: string;
  apiKey: string;
  endpoint?: string;
  model?: string;
}

const getActiveCustomLlm = (): CustomLlmConfig | null => {
  try {
    const saved = localStorage.getItem('zen_api_configs');
    if (saved) {
      const parsed = JSON.parse(saved);
      const active = parsed.find((c: any) => c.type === 'llm' && c.enabled && c.apiKey);
      if (active) {
        return {
          id: active.id,
          name: active.name,
          apiKey: active.apiKey,
          endpoint: active.endpoint,
          model: active.model
        };
      }
    }
  } catch (e) {
    console.error("加载自定义大模型配置时出错:", e);
  }
  return null;
};

// Generic LLM Client caller
const callLlmApi = async (prompt: string, fallbackModel = 'gemini-3-flash-preview'): Promise<string> => {
  const custom = getActiveCustomLlm();

  if (custom) {
    try {
      // 1. Google Gemini Custom KEY Mode
      if (custom.id === 'gemini_custom') {
        const endpoint = custom.endpoint || 'https://generativelanguage.googleapis.com';
        const model = custom.model || 'gemini-2.5-flash';
        const url = `${endpoint}/v1beta/models/${model}:generateContent?key=${custom.apiKey}`;

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Gemini[自定义] 调用失败(${resp.status}): ${errText}`);
        }

        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        throw new Error("模型响应中没有提取到文本");
      }

      // 2. SiliconFlow (硅基流动) Mode
      if (custom.id === 'siliconflow') {
        const endpoint = custom.endpoint || 'https://api.siliconflow.cn/v1';
        const model = custom.model || 'deepseek-ai/DeepSeek-V3';
        const url = `${endpoint}/chat/completions`;

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${custom.apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false
          })
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`硅基流动 调用失败(${resp.status}): ${errText}`);
        }

        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text;
        throw new Error("模型未响应有效的文本内容");
      }

      // 3. Custom OpenAI Compatible Mode (including custom_openai)
      if (custom.id === 'custom_openai') {
        const endpoint = custom.endpoint || 'https://api.openai.com/v1';
        const model = custom.model || 'gpt-3.5-turbo';
        const url = `${endpoint}/chat/completions`;

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${custom.apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false
          })
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`自定义API 调用失败(${resp.status}): ${errText}`);
        }

        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text;
        throw new Error("模型未响应有效的文本内容");
      }

      // 4. OpenAI / DeepSeek / Kimi / GLM / Qwen Compatible Mode
      const endpoint = custom.endpoint || 'https://api.openai.com/v1';
      const model = custom.model || 'gpt-4o';
      const url = `${endpoint}/chat/completions`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${custom.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`${custom.name} 调用失败(${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) return text;
      throw new Error("模型未响应有效的文本内容");
    } catch (e: any) {
      console.error(`自定义大模型 ${custom.name} 运行错误，将尝试降级至系统默认模型:`, e);
      // Fall through to default fallback below
    }
  }

  // Fallback to default System Gemini client if no custom is active or if custom failed
  if (!defaultAi) {
    throw new Error("未检测到可用的 API Key。请在「API 接口配置」里设置您的 API 密钥。");
  }

  const response = await defaultAi.models.generateContent({
    model: fallbackModel,
    contents: prompt,
  });

  return response.text || "";
};

export const generateScript = async (
  topic: string,
  tone: string = 'professional',
  frameworkId?: string,
  lengthId?: string,
  audienceId?: string
): Promise<string> => {
  try {
    const toneDescription =
      tone === 'professional' ? '有逻辑、严谨、专业的讲师/学术风格' :
      tone === 'casual' ? '自然温和、对话式、轻松随意的聊天风格' :
      tone === 'funny' ? '幽默风趣、接地气、带有网梗的娱乐风格' :
      tone === 'urgent' ? '具有带货、促销、充满下单紧迫感和激情的口播风格' : '日常自然口播风格';

    const framework = frameworkId ? getFramework(frameworkId) : getFramework('standard');
    const length = LENGTH_PRESETS.find(l => l.id === lengthId) || LENGTH_PRESETS[1]; // default medium
    const audience = AUDIENCE_PRESETS.find(a => a.id === audienceId) || AUDIENCE_PRESETS[0];

    const prompt = `${framework.generatePrompt}

主题：${topic}
语气风格：${toneDescription}
目标受众：${audience.name}（${audience.description}）
字数要求：全文严格控制在${length.min}-${length.max}字以内
长度类型：${length.name}

语言适配要求：
- 根据目标受众调整词汇难度和表达方式
- 如果受众是年轻群体，可以适当使用网络热梗和流行语
- 如果受众是B端商业，强调逻辑和数据支撑
- 如果受众是C端消费者，强调情感共鸣和利益点

只输出口播说话的内容（中文），不要输出任何场景描述或旁白指示。`;

    const text = await callLlmApi(prompt, 'gemini-3-flash-preview');
    return text || "抱歉，由于模型未能正常回应，未能为您生成脚本，请重试。";
  } catch (error) {
    console.error("Script Generation Error:", error);
    throw new Error("无法生成脚本。请检查您的 API 配置详情并重试。");
  }
};

export const rewriteScript = async (currentText: string, frameworkId?: string): Promise<string> => {
  try {
    const framework = frameworkId ? getFramework(frameworkId) : getFramework('standard');

    const prompt = `你是一位顶尖的短视频口播编剧。请对以下文本进行改写，使用「${framework.name}」框架。

写作框架要求：
${framework.rewritePrompt}

原稿：
${currentText}

请直接输出改写后的文本：`;

    const text = await callLlmApi(prompt, 'gemini-3-flash-preview');
    return text || currentText;
  } catch (error) {
    console.error("Script Rewrite Error:", error);
    throw error;
  }
};

export const polishScript = async (currentText: string): Promise<string> => {
  try {
    const prompt = `作为专业主播和文案纠错专家，请对以下提词文本进行口语化润色和节奏调整。

    润色规则：
    1. 长句拆短。如果一句话多于 20 字，拆分为更短的几句话，保持朗读平缓不憋气。
    2. 将生硬、书面词替换为高频的口头说话习惯词（如"因此"替换为"所以"，"然而"替换为"但是/不过"等）。
    3. 修复任何语病或不通顺的地方，确保朗读起来行云流水。
    4. 保持文本原本表达的中心主旨和意思绝对一致，只改善表达方式。

    待润色提词文本：
    ${currentText}

    请直接输出润色后的口语化文本，原文本里的格式换行也请保留。绝对不要输出任何带有解释、对比或分析性质的旁白。`;

    const text = await callLlmApi(prompt, 'gemini-3-flash-preview');
    return text || currentText;
  } catch (error) {
    console.error("Script Polish Error:", error);
    throw error;
  }
};

// 多版本改写 - 一次 API 调用生成 3 个不同框架的版本
// 灵感来源于 Writer's Loop 的多角度评审和 Book Genesis 的多视角评估
export interface RewriteVersion {
  frameworkId: string;
  frameworkName: string;
  text: string;
}

export const generateMultiRewrite = async (currentText: string): Promise<RewriteVersion[]> => {
  try {
    // Pick 3 frameworks (exclude 'standard' to give more distinctive options)
    const frameworksToUse = FRAMEWORK_IDS
      .filter(id => id !== 'standard')
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Assign different hook types to each version for diversity
    const hookType1 = getNextHookType();
    const hookType2 = getNextHookType();
    const hookType3 = getNextHookType();

    const hook1 = HOOK_ARCHETYPES.find(h => h.id === hookType1);
    const hook2 = HOOK_ARCHETYPES.find(h => h.id === hookType2);
    const hook3 = HOOK_ARCHETYPES.find(h => h.id === hookType3);

    const frameworks = frameworksToUse.map(id => getFramework(id));

    const prompt = `你是一位顶尖的短视频口播编剧和文案大师。请对以下原稿进行改写，生成 3 个不同风格的版本。

原稿：
${currentText}

请分别使用以下 3 个写作框架各生成一个版本。每个版本使用指定的钩子类型开头。

---

=== 版本 1：${frameworks[0].name} ===
钩子类型：${hook1?.name || '通用开场'}
${hook1 ? `钩子模板参考：${hook1.template}` : ''}
${frameworks[0].rewritePrompt}

=== 版本 2：${frameworks[1].name} ===
钩子类型：${hook2?.name || '通用开场'}
${hook2 ? `钩子模板参考：${hook2.template}` : ''}
${frameworks[1].rewritePrompt}

=== 版本 3：${frameworks[2].name} ===
钩子类型：${hook3?.name || '通用开场'}
${hook3 ? `钩子模板参考：${hook3.template}` : ''}
${frameworks[2].rewritePrompt}

---

输出格式要求（严格按照以下格式输出，不要增减内容）：
---版本1---
[版本1的完整口播文本]
---版本2---
[版本2的完整口播文本]
---版本3---
[版本3的完整口播文本]`;

    const result = await callLlmApi(prompt, 'gemini-3-flash-preview');

    // Parse the result to extract 3 versions
    const versions: RewriteVersion[] = [];
    const parts = result.split(/---版本[123]---/).filter(p => p.trim());

    frameworksToUse.forEach((frameworkId, index) => {
      const text = parts[index]?.trim();
      if (text) {
        versions.push({
          frameworkId,
          frameworkName: frameworks[index].name,
          text,
        });
      }
    });

    // If parsing failed, fall back to single rewrites
    if (versions.length < 2) {
      const fallbacks = await Promise.all(
        frameworksToUse.map(async (id, index) => {
          try {
            const text = await rewriteScript(currentText, id);
            return { frameworkId: id, frameworkName: frameworks[index].name, text };
          } catch {
            return null;
          }
        })
      );
      return fallbacks.filter((v): v is RewriteVersion => v !== null);
    }

    return versions;
  } catch (error) {
    console.error("Multi Rewrite Error:", error);
    // Fallback: generate 3 individual rewrites
    const frameworksToUse = FRAMEWORK_IDS
      .filter(id => id !== 'standard')
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const fallbacks = await Promise.all(
      frameworksToUse.map(async (id) => {
        try {
          const framework = getFramework(id);
          const text = await rewriteScript(currentText, id);
          return { frameworkId: id, frameworkName: framework.name, text };
        } catch {
          return null;
        }
      })
    );
    return fallbacks.filter((v): v is RewriteVersion => v !== null);
  }
};
