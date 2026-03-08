import { LinkTemplate, GenerateCommentParams, GenerateCommentResult, PageSnapshot, AIAction, AIAnalyzeResult, SnapshotElement } from './types';

export const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
export const DEFAULT_MODEL = 'qwen3.5-flash';
export const DEFAULT_CAPTCHA_MODEL = 'qwen3.5-flash';

/** 可选的文本生成模型列表 */
export const AVAILABLE_MODELS = [
  { id: 'qwen3.5-flash', name: 'Qwen3.5-Flash（推荐，快速+多模态）' },
  { id: 'qwen3.5-plus', name: 'Qwen3.5-Plus（最聪明，较慢）' },
  { id: 'qwen-plus', name: 'Qwen-Plus（旧版均衡）' },
  { id: 'qwen3-max', name: 'Qwen3-Max（最强，较贵）' },
] as const;

/** 可选的视觉模型列表（验证码识别） */
export const AVAILABLE_VL_MODELS = [
  { id: 'qwen3.5-flash', name: 'Qwen3.5-Flash（推荐，快速+多模态）' },
  { id: 'qwen3.5-plus', name: 'Qwen3.5-Plus（更强，较慢）' },
  { id: 'qwen-vl-plus', name: 'Qwen-VL-Plus（旧版视觉模型）' },
] as const;

/** 运行时使用的模型，可通过 setModel 修改 */
let currentModel = DEFAULT_MODEL;
let currentCaptchaModel = DEFAULT_CAPTCHA_MODEL;
let thinkingEnabled = false;

export function setModel(model: string): void { currentModel = model; }
export function setCaptchaModel(model: string): void { currentCaptchaModel = model; }
export function getModel(): string { return currentModel; }
export function getCaptchaModel(): string { return currentCaptchaModel; }
export function setThinkingEnabled(enabled: boolean): void { thinkingEnabled = enabled; }
export function getThinkingEnabled(): boolean { return thinkingEnabled; }

/**
 * 构建 system prompt
 * 根据 htmlAllowed 参数决定是否指示 AI 使用 <a href> 标签
 */
export function buildSystemPrompt(htmlAllowed: boolean): string {
  const linkFormatInstruction = htmlAllowed
    ? '在评论中使用 <a href="url">关键词</a> 的 HTML 格式嵌入链接。'
    : '在评论中以纯文本方式自然地提及网址和关键词，不要使用任何 HTML 标签。';

  return [
    '你是一位资深的博客读者和评论者。请阅读用户提供的博客文章内容，然后生成一条自然、相关的评论。',
    '要求：',
    '1. 评论必须与文章内容相关，体现你认真阅读了文章。',
    '2. 自然地融入用户提供的链接模板（网址和关键词），不要生硬或过于推广。',
    `3. ${linkFormatInstruction}`,
    '4. 评论简洁，2-3句话即可。',
    '5. 语气自然友好，像真实读者的评论。',
  ].join('\n');
}

/**
 * 构建 user prompt
 * 包含文章标题、正文摘要、外链模板信息
 */
export function buildUserPrompt(title: string, body: string, template: LinkTemplate): string {
  return [
    `【文章标题】${title}`,
    '',
    `【文章内容摘要】${body}`,
    '',
    '【外链模板信息】',
    `- 名称：${template.name}`,
    `- 网址：${template.url}`,
    `- 关键词：${template.keyword}`,
    '',
    '请根据以上文章内容生成一条自然的评论，并在评论中融入上述外链信息。',
  ].join('\n');
}


/**
 * 调用 DashScope API 生成评论
 * - 使用 OpenAI 兼容格式
 * - 处理 401/429/网络错误
 * - 返回 GenerateCommentResult
 */
export async function generateComment(
  params: GenerateCommentParams,
  apiKey: string
): Promise<GenerateCommentResult> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: '请先在设置中配置 API Key' };
  }

  const body = JSON.stringify({
    model: currentModel,
    messages: [
      { role: 'system', content: buildSystemPrompt(params.htmlAllowed) },
      { role: 'user', content: buildUserPrompt(params.title, params.body, params.template) },
    ],
    enable_thinking: thinkingEnabled,
  });

  let response: Response;
  try {
    response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch {
    return { success: false, error: '网络错误，请检查网络连接' };
  }

  if (!response.ok) {
    if (response.status === 401) {
      return { success: false, error: 'API Key 无效，请检查设置' };
    }
    if (response.status === 429) {
      return { success: false, error: 'API 调用频率超限，请稍后重试' };
    }
    return { success: false, error: 'AI 服务异常，请稍后重试' };
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return { success: true, comment: content };
}


// ============================================================
// 验证码识别：调用多模态 AI 识别简单图片验证码
// ============================================================

/**
 * 清洗验证码识别结果：去除空格、标点等非验证码字符
 */
export function cleanCaptchaResult(raw: string): string {
  return raw.replace(/[\s\.,;:!?'"，。；：！？、\-\(\)\[\]{}\u3000]/g, '');
}

/**
 * 调用 DashScope 多模态 API 识别验证码图片内容
 */
export async function recognizeCaptcha(
  imageData: string,
  apiKey: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  if (!apiKey?.trim()) {
    return { success: false, error: '请先配置 API Key' };
  }
  if (!imageData?.trim()) {
    return { success: false, error: '验证码图片数据为空' };
  }

  const body = JSON.stringify({
    model: currentCaptchaModel,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageData } },
        { type: 'text', text: '识别这张验证码图片中的字符，只返回纯字符内容，不要任何解释。' },
      ],
    }],
    enable_thinking: thinkingEnabled,
  });

  let response: Response;
  try {
    response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch {
    return { success: false, error: '网络错误' };
  }

  if (!response.ok) {
    if (response.status === 401) return { success: false, error: 'API Key 无效' };
    if (response.status === 429) return { success: false, error: 'API 调用频率超限' };
    return { success: false, error: 'AI 服务异常' };
  }

  try {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { success: false, error: '识别结果为空' };

    const cleaned = cleanCaptchaResult(content);
    if (!cleaned) return { success: false, error: '未能识别验证码内容' };

    return { success: true, text: cleaned };
  } catch {
    return { success: false, error: 'AI 返回解析失败' };
  }
}


// ============================================================
// AI 驱动的页面分析 + 评论生成 + 操作规划
// ============================================================

/**
 * 将页面快照转为 AI 可读的文本描述
 */
function snapshotToText(snapshot: PageSnapshot): string {
  const lines: string[] = [];
  lines.push(`【页面标题】${snapshot.title}`);
  lines.push(`【页面语言】${snapshot.pageLang || '未知'}`);
  lines.push(`【验证码线索】${snapshot.hasCaptcha ? '发现线索' : '未发现明显线索'}`);
  if (snapshot.captchaSignals && snapshot.captchaSignals.length > 0) {
    for (const signal of snapshot.captchaSignals.slice(0, 5)) {
      lines.push(`  - ${signal}`);
    }
  }
  if (snapshot.captchaInfo) {
    lines.push(`【可自动识别验证码】是`);
    lines.push(`【验证码输入框】${snapshot.captchaInfo.inputSelector}`);
  } else {
    lines.push(`【可自动识别验证码】否`);
  }
  lines.push(`【允许HTML】${snapshot.htmlAllowed ? '是' : '否'}`);
  if (snapshot.errorMessages && snapshot.errorMessages.length > 0) {
    lines.push(`【页面错误/提示信息】`);
    for (const msg of snapshot.errorMessages.slice(0, 5)) {
      lines.push(`  - ${msg}`);
    }
  }
  lines.push('');

  for (let i = 0; i < snapshot.forms.length; i++) {
    const form = snapshot.forms[i];
    lines.push(`=== 表单 ${i + 1} (selector: ${form.selector}) ===`);
    for (const el of form.elements) {
      const parts: string[] = [];
      parts.push(`  [${el.tag.toUpperCase()}]`);
      if (el.type) parts.push(`type="${el.type}"`);
      if (el.name) parts.push(`name="${el.name}"`);
      if (el.id) parts.push(`id="${el.id}"`);
      if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
      if (el.label) parts.push(`label="${el.label}"`);
      if (el.text) parts.push(`text="${el.text}"`);
      if (el.value) parts.push(`value="${el.value}"`);
      parts.push(`→ selector: ${el.selector}`);
      lines.push(parts.join(' '));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 构建 AI 分析 + 规划的 system prompt
 */
function buildAnalyzeSystemPrompt(): string {
  return `你是一个浏览器自动化助手。用户会给你一个网页的表单结构快照和一篇文章的内容摘要。

你的任务：
1. 分析页面中的评论表单，理解每个字段的用途
2. 根据文章内容生成一条自然、相关的评论（2-3句话）
3. 规划一系列操作指令来填写表单并提交

你必须返回严格的 JSON 格式（不要包含 markdown 代码块标记），结构如下：
{
  "comment": "生成的评论文本",
  "actions": [
    { "type": "scroll", "selector": "表单的CSS选择器" },
    { "type": "type", "selector": "字段的CSS选择器", "value": "要输入的值" },
    { "type": "click", "selector": "提交按钮的CSS选择器" }
  ],
  "hasCaptcha": false
}

操作类型说明：
- scroll: 滚动到指定元素
- type: 在输入框/文本域中输入文字
- click: 点击按钮

规则：
- 先 scroll 到表单区域
- 按顺序填写每个需要的字段（名称、邮箱、URL、评论等）
- 最后 click 提交按钮
- 你会收到“验证码线索”，但必须自己综合表单结构、按钮、线索内容判断页面是否真的存在验证码
- 如果只是可疑线索但无法确认，不要因为单个关键词就判定为有验证码
- 如果页面存在可自动识别的简单图片验证码，且快照中提供了验证码输入框 selector，可以在填写验证码后继续点击提交
- 只有在确认存在复杂验证码、人工验证、或无法安全自动完成时，才设置 hasCaptcha 为 true 并且不添加 click 提交操作
- 评论要与文章内容相关，自然融入用户提供的链接信息
- 只填写你能确定用途的字段，不确定的字段跳过（如"削除キー"等）
- selector 必须使用快照中提供的 selector 值，不要自己编造

关于 URL/链接的重要规则（根据表单结构灵活处理）：
- 【情况A：表单有专门的 URL/网址字段】如果表单中有 name="url" 或 label 包含 "URL"、"网址"、"ホームページ"、"Website" 的输入框：
  - 把网址填在那个专门的 URL 字段里
  - 评论正文中【严禁】包含任何 URL、网址、链接（http://、https://、www. 或域名）
  - 评论正文只写纯文字，自然提及关键词和网站名称即可
  - 很多网站会把 URL 中的字符当作禁止词，所以评论正文必须是纯文字
- 【情况B：表单没有 URL/网址字段】如果表单中没有专门的 URL 字段（只有 Name、Subject、Message/Comment 等）：
  - 必须在评论正文中嵌入链接，否则外链就丢失了
  - 如果【允许HTML】为"是"，使用 <a href="网址">关键词</a> 格式嵌入链接
  - 如果【允许HTML】为"否"或不确定，也尝试使用 <a href="网址">关键词</a> 格式（很多论坛/留言板实际支持 HTML 但页面上没有明确提示）
  - 链接要自然融入评论内容中，不要生硬
  - 例如："这篇文章很有启发，推荐大家也看看 <a href="https://example.com">相关资源</a>，内容很不错。"

关于评论语言的重要规则：
- 根据页面语言（【页面语言】字段）来决定评论使用的语言
- 【最重要】如果页面是日文（ja），评论正文中严禁出现任何英文字母（a-z、A-Z）！一个都不行！
- 日文页面的评论必须是100%纯日文字符（平假名、片假名、汉字、日文标点）
- 日文页面中，所有英文名称必须翻译成片假名：例如 "Spicy Books" → "スパイシーブックス"、"Kingshot Guide" → "キングショットガイド"、"photo to cartoon" → "フォトトゥカートゥーン"
- 日文页面中，关键词也必须翻译成日文，不能保留英文原文
- 如果页面是中文（zh），评论用中文写，英文名称可以保留
- 如果页面是韩文（ko），评论用韩文写
- 如果页面是英文或语言未知，评论用英文写
- 名称字段（name/名前）可以保留英文，因为那是用户名
- 邮箱字段可以保留英文
- URL 字段可以保留英文
- 只有评论正文（textarea/コメント）需要严格遵守语言规则，绝对不能有英文字母`;
}

/**
 * 构建 AI 分析的 user prompt
 */
function buildAnalyzeUserPrompt(
  snapshot: PageSnapshot,
  template: LinkTemplate,
  htmlAllowed: boolean
): string {
  // 检查表单是否有专门的 URL 字段
  const hasUrlField = snapshot.forms.some((form) =>
    form.elements.some(
      (el: SnapshotElement) =>
        el.name?.toLowerCase().includes('url') ||
        el.label?.toLowerCase().includes('url') ||
        el.label?.includes('ホームページ') ||
        el.label?.toLowerCase().includes('website') ||
        el.label?.includes('网址')
    )
  );

  let linkInstruction: string;
  if (hasUrlField) {
    linkInstruction = '【链接处理】表单有专门的 URL 字段，请把网址填在 URL 字段中，评论正文中不要包含任何链接或网址。';
  } else {
    linkInstruction = [
      '【⚠️ 链接处理 — 极其重要，必须遵守】',
      '此表单没有 URL 字段！如果不在评论正文中嵌入链接，外链就会完全丢失，这次评论就白费了。',
      `你必须在评论正文（Message/Comment）中包含这个链接：<a href="${template.url}">${template.keyword}</a>`,
      '把这个 <a> 标签自然地融入评论句子中，例如：',
      `"...推荐大家看看 <a href="${template.url}">${template.keyword}</a>，内容很不错..."`,
      '如果不包含这个链接，任务就失败了。',
    ].join('\n');
  }

  return [
    '【页面表单结构】',
    snapshotToText(snapshot),
    '',
    `【文章内容摘要】${snapshot.bodyExcerpt.substring(0, 1500)}`,
    '',
    '【外链模板信息（用于填写表单字段和生成评论）】',
    `- 名称/昵称: ${template.name}`,
    `- 邮箱: ${template.email || '（未提供，请用合理的邮箱如 name@domain.com）'}`,
    `- 网址: ${template.url}`,
    `- 关键词: ${template.keyword}`,
    '',
    linkInstruction,
    '',
    '请分析表单结构，生成评论，并返回操作指令 JSON。',
  ].join('\n');
}

/**
 * AI 分析页面并规划操作
 * 一次 API 调用同时完成：评论生成 + 操作规划
 */
export async function analyzePageAndPlan(
  snapshot: PageSnapshot,
  template: LinkTemplate,
  apiKey: string
): Promise<AIAnalyzeResult> {
  if (!apiKey?.trim()) {
    return { success: false, error: '请先在设置中配置 API Key' };
  }

  // 验证码处理
  let captchaText: string | null = null;
  let captchaFailed = false;
  if (snapshot.captchaInfo?.type === 'simple_image') {
    const captchaResult = await recognizeCaptcha(snapshot.captchaInfo.imageData, apiKey);
    if (captchaResult.success && captchaResult.text) {
      captchaText = captchaResult.text;
    } else {
      captchaFailed = true;
    }
  }

  const body = JSON.stringify({
    model: currentModel,
    messages: [
      { role: 'system', content: buildAnalyzeSystemPrompt() },
      { role: 'user', content: buildAnalyzeUserPrompt(snapshot, template, snapshot.htmlAllowed) },
    ],
    response_format: { type: 'json_object' },
    enable_thinking: thinkingEnabled,
  });

  let response: Response;
  try {
    response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch {
    return { success: false, error: '网络错误，请检查网络连接' };
  }

  if (!response.ok) {
    if (response.status === 401) return { success: false, error: 'API Key 无效，请检查设置' };
    if (response.status === 429) return { success: false, error: 'API 调用频率超限，请稍后重试' };
    return { success: false, error: 'AI 服务异常，请稍后重试' };
  }

  try {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { success: false, error: 'AI 返回内容为空' };

    // 解析 JSON（兼容 AI 可能返回 markdown 代码块的情况）
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const plan = JSON.parse(cleaned) as {
      comment: string;
      actions: AIAction[];
      hasCaptcha?: boolean;
    };

    let finalActions = Array.isArray(plan.actions) ? [...plan.actions] : [];
    let finalHasCaptcha = plan.hasCaptcha || false;
    const submitIdx = finalActions.findIndex((a: AIAction) => a.type === 'click');

    if (captchaText && snapshot.captchaInfo) {
      // 验证码识别成功：在提交按钮点击前插入验证码填写操作
      const captchaAction: AIAction = {
        type: 'type' as const,
        selector: snapshot.captchaInfo.inputSelector,
        value: captchaText,
      };
      if (submitIdx >= 0) {
        finalActions = [...finalActions.slice(0, submitIdx), captchaAction, ...finalActions.slice(submitIdx)];
      } else {
        finalActions = [...finalActions, captchaAction];
      }
      finalHasCaptcha = finalHasCaptcha && submitIdx < 0;
    } else if (captchaFailed && finalHasCaptcha) {
      // 验证码识别失败：移除提交操作，标记需要手动处理
      finalActions = finalActions.filter((a: AIAction) => a.type !== 'click');
      finalHasCaptcha = true;
    }

    return {
      success: true,
      comment: plan.comment,
      actions: finalActions,
      hasCaptcha: finalHasCaptcha,
    };
  } catch (e) {
    return { success: false, error: 'AI 返回格式解析失败，请重试' };
  }
}


// ============================================================
// 提交后验证：判断页面状态并决定下一步操作
// ============================================================

export interface PostSubmitResult {
  status: 'confirmation_page' | 'success' | 'error' | 'unknown';
  actions?: AIAction[];
  message?: string;
}

/**
 * 提交后分析页面状态
 * 判断是预览/确认页、成功页、还是错误页
 */
export async function analyzePostSubmit(
  snapshot: PageSnapshot,
  apiKey: string,
  commentContent?: string
): Promise<PostSubmitResult> {
  if (!apiKey?.trim()) {
    return { status: 'unknown', message: 'API Key 缺失' };
  }

  const systemPrompt = `你是一个浏览器自动化助手。用户刚刚在一个网页上提交了评论表单，页面发生了变化。
你需要分析当前页面状态，判断属于以下哪种情况：

1. "confirmation_page" — 这是一个预览/确认页面，评论还没有真正发布，需要再点击一个按钮才能真正提交
   常见特征：页面显示了评论预览内容，有"投稿する"、"Submit"、"确认提交"、"Post"等按钮
2. "success" — 评论已经成功发布
   常见特征：页面显示感谢信息、成功提示、或者评论已经出现在评论列表中
3. "error" — 提交出错
   常见特征：页面显示错误信息、验证失败提示、禁止词提示、投稿禁止ワード等

返回严格的 JSON 格式（不要包含 markdown 代码块标记）：
{
  "status": "confirmation_page" 或 "success" 或 "error",
  "message": "简短描述当前页面状态，如果是 error 请包含具体的错误原因（如禁止词、验证码错误等）",
  "actions": [
    { "type": "click", "selector": "需要点击的按钮的CSS选择器" }
  ]
}

规则：
- 如果是 confirmation_page，actions 中必须包含点击真正提交按钮的指令
- 如果是 success 或 error，actions 为空数组
- selector 必须使用快照中提供的 selector 值，不要自己编造
- 如果页面有"投稿する"、"送信"、"Submit"、"Post Comment"等按钮，很可能是确认页
- 注意查看【页面错误/提示信息】部分，那里包含了页面上显示的错误和警告
- 如果看到"禁止ワード"、"禁止词"、"banned word"等提示，status 应为 error，message 中说明具体的禁止词

成功信号识别（重要）：
- 如果用户提供了【刚提交的评论内容】，请在页面正文中搜索该评论文本。如果找到了提交的评论内容，这是非常强的成功信号，即使页面没有显示明确的感谢信息，也应判定为 success
- 多种成功信号：表单已被清空、出现感谢/成功提示（如"Thank you"、"コメントありがとう"）、评论出现在评论列表中、页面 URL 发生变化、出现"评论待审核"/"コメントは承認待ち"/"comment awaiting moderation"等提示
- 以上信号出现任意一个或多个，都应倾向判定为 success

不同网站的提交后行为差异：
- WordPress 等站点：提交后页面直接刷新，评论出现在评论列表中，表单被清空，通常没有明确的感谢弹窗
- 日本网站：可能跳转到确认页（有"投稿する"按钮），这是 confirmation_page 而非 success
- AJAX 无刷新站点：评论通过 AJAX 插入页面，页面不刷新但评论列表更新
- 注意区分：页面刷新后表单清空 + 评论可见 = success，而非 error 或 unknown`;

  const userPromptParts = [
    '【提交后的页面状态】',
    snapshotToText(snapshot),
    '',
    '【页面正文摘要】',
    snapshot.bodyExcerpt.substring(0, 1000),
  ];

  if (commentContent?.trim()) {
    userPromptParts.push('', '【刚提交的评论内容】', commentContent.trim());
  }

  userPromptParts.push('', '请判断当前页面状态并返回 JSON。');

  const userPrompt = userPromptParts.join('\n');

  const body = JSON.stringify({
    model: currentModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    enable_thinking: thinkingEnabled,
  });

  let response: Response;
  try {
    response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch {
    return { status: 'unknown', message: '网络错误' };
  }

  if (!response.ok) {
    return { status: 'unknown', message: 'AI 服务异常' };
  }

  try {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { status: 'unknown', message: 'AI 返回为空' };

    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const result = JSON.parse(cleaned) as PostSubmitResult;
    return result;
  } catch {
    return { status: 'unknown', message: 'AI 返回解析失败' };
  }
}


// ============================================================
// 带错误上下文的重试：让 AI 根据错误信息修正评论
// ============================================================

/**
 * 根据提交错误信息，让 AI 重新生成评论并规划操作
 * 把之前失败的评论和错误信息一起发给 AI，让它理解问题并修正
 */
export async function retryWithErrorContext(
  snapshot: PageSnapshot,
  template: LinkTemplate,
  apiKey: string,
  errorMessage: string,
  failedComment: string,
  attemptNumber: number
): Promise<AIAnalyzeResult> {
  if (!apiKey?.trim()) {
    return { success: false, error: 'API Key 缺失' };
  }

  const systemPrompt = buildAnalyzeSystemPrompt();

  const userPrompt = [
    '【重要：上次提交失败了，请修正评论】',
    `失败原因：${errorMessage}`,
    `上次失败的评论内容：「${failedComment}」`,
    `这是第 ${attemptNumber} 次重试。`,
    '',
    '请仔细分析失败原因，生成一条完全不同的评论来避免同样的错误。',
    '如果错误提示包含"禁止ワード"（禁止词）或类似信息，说明评论中包含了被网站禁止的字符或词语。',
    '常见的禁止规则：',
    '- 有些日文网站禁止评论中出现任何英文字母（a-z、A-Z）',
    '- 有些网站禁止 URL、链接、特定符号',
    '- 如果之前的评论包含英文字母且被拒绝，这次请用纯日文/中文/韩文（根据页面语言），完全不要使用任何英文字母',
    '',
    '【页面表单结构】',
    snapshotToText(snapshot),
    '',
    `【文章内容摘要】${snapshot.bodyExcerpt.substring(0, 1500)}`,
    '',
    '【外链模板信息】',
    `- 名称/昵称: ${template.name}`,
    `- 邮箱: ${template.email || '（未提供）'}`,
    `- 网址: ${template.url}`,
    `- 关键词: ${template.keyword}`,
    '',
    '请重新生成评论并返回操作指令 JSON。',
    '注意：如果页面是日文网站，评论正文中绝对不要包含任何英文字母。',
    `关于链接：请根据表单结构判断——如果有 URL 字段则评论正文不要包含链接；如果没有 URL 字段，则必须在评论正文中用 <a href="${template.url}">${template.keyword}</a> 嵌入链接，否则外链丢失、任务失败。`,
  ].join('\n');

  const body = JSON.stringify({
    model: currentModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    enable_thinking: thinkingEnabled,
  });

  let response: Response;
  try {
    response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch {
    return { success: false, error: '网络错误' };
  }

  if (!response.ok) {
    if (response.status === 401) return { success: false, error: 'API Key 无效' };
    if (response.status === 429) return { success: false, error: 'API 调用频率超限' };
    return { success: false, error: 'AI 服务异常' };
  }

  try {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { success: false, error: 'AI 返回为空' };

    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const plan = JSON.parse(cleaned) as {
      comment: string;
      actions: AIAction[];
      hasCaptcha?: boolean;
    };

    return {
      success: true,
      comment: plan.comment,
      actions: plan.actions,
      hasCaptcha: plan.hasCaptcha || false,
    };
  } catch {
    return { success: false, error: 'AI 返回解析失败' };
  }
}


// ============================================================
// 截图 + VL 视觉模型验证：提交后截图分析
// ============================================================

export interface VLAnalyzeParams {
  screenshots: string[];       // 1-2 张截图的 base64 数据
  snapshot: PageSnapshot;      // DOM 快照
  apiKey: string;
  commentContent?: string;     // 刚提交的评论内容
}

/**
 * 构建 VL 验证的 system prompt
 * 包含视觉信号关键词，指示模型优先依据截图视觉信息判断
 */
export function buildVLVerifySystemPrompt(): string {
  return `你是一个浏览器自动化助手，擅长通过截图视觉分析判断网页状态。
用户刚刚在一个网页上提交了评论表单。你会收到 1-2 张页面截图和一份 DOM 快照文本。

【重要】请优先依据截图中的视觉信息进行判断，DOM 快照仅作为辅助参考。

请根据以下视觉信号判断提交结果：

成功信号（感谢/成功提示）：
- 页面显示"感谢"、"Thank you"、"コメントありがとう"、"评论成功"等感谢/成功提示
- 评论出现在评论列表中（可以看到刚提交的评论内容）
- 表单已被清空（输入框变为空白）
- 出现"评论待审核"、"awaiting moderation"、"承認待ち"等提示（这也是成功）

确认页面按钮信号：
- 页面显示评论预览内容，并有"投稿する"、"Submit"、"确认提交"、"Post"等按钮
- 这表示需要再点击一次才能真正提交

错误提示信号：
- 页面显示红色错误信息、验证失败提示
- 出现"禁止ワード"、"禁止词"、"banned word"等提示
- 验证码错误提示

返回严格的 JSON 格式（不要包含 markdown 代码块标记）：
{
  "status": "success" 或 "confirmation_page" 或 "error" 或 "unknown",
  "message": "简短描述当前页面状态",
  "actions": [
    { "type": "click", "selector": "需要点击的按钮的CSS选择器" }
  ]
}

规则：
- 如果是 confirmation_page，actions 中必须包含点击真正提交按钮的指令，selector 从 DOM 快照中获取
- 如果是 success 或 error，actions 为空数组
- 优先看截图判断，截图中能看到的视觉信号比 DOM 文本更可靠
- 如果截图中能看到评论内容出现在页面上，即使 DOM 快照不完整，也应判定为 success`;
}

/**
 * 构建 VL 验证的 user prompt（文本部分）
 * 将 DOM 快照文本和评论内容组合
 */
export function buildVLVerifyUserPrompt(snapshot: PageSnapshot, commentContent?: string): string {
  const parts: string[] = [];

  parts.push('【DOM 快照信息（辅助参考）】');
  parts.push(`页面标题: ${snapshot.title}`);
  if (snapshot.pageLang) parts.push(`页面语言: ${snapshot.pageLang}`);

  if (snapshot.errorMessages && snapshot.errorMessages.length > 0) {
    parts.push('页面错误/提示信息:');
    for (const msg of snapshot.errorMessages.slice(0, 5)) {
      parts.push(`  - ${msg}`);
    }
  }

  if (snapshot.forms && snapshot.forms.length > 0) {
    parts.push('');
    parts.push('表单结构:');
    for (const form of snapshot.forms) {
      for (const el of form.elements) {
        const desc: string[] = [`[${el.tag}]`];
        if (el.type) desc.push(`type="${el.type}"`);
        if (el.name) desc.push(`name="${el.name}"`);
        if (el.text) desc.push(`text="${el.text}"`);
        desc.push(`→ ${el.selector}`);
        parts.push(`  ${desc.join(' ')}`);
      }
    }
  }

  parts.push('');
  parts.push(`页面正文摘要: ${snapshot.bodyExcerpt.substring(0, 1000)}`);

  if (commentContent?.trim()) {
    parts.push('');
    parts.push(`【刚提交的评论内容】${commentContent.trim()}`);
  }

  parts.push('');
  parts.push('请结合截图和以上信息，判断评论提交结果并返回 JSON。');

  return parts.join('\n');
}

/**
 * 使用 VL 视觉模型分析截图 + DOM 快照，判断评论提交结果
 * 返回与现有 PostSubmitResult 兼容的结果
 */
export async function analyzePostSubmitWithScreenshot(
  params: VLAnalyzeParams
): Promise<PostSubmitResult> {
  if (!params.apiKey?.trim()) {
    return { status: 'unknown', message: 'API Key 缺失' };
  }

  const userContent: Array<{ type: string; image_url?: { url: string }; text?: string }> = [];

  // 添加截图（1-2 张）
  for (const screenshot of params.screenshots) {
    userContent.push({ type: 'image_url', image_url: { url: screenshot } });
  }

  // 添加文本部分
  userContent.push({
    type: 'text',
    text: buildVLVerifyUserPrompt(params.snapshot, params.commentContent),
  });

  const body = JSON.stringify({
    model: currentCaptchaModel,
    messages: [
      { role: 'system', content: buildVLVerifySystemPrompt() },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    enable_thinking: thinkingEnabled,
  });

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body,
      signal: abortController.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === 'AbortError') {
      return { status: 'unknown', message: 'VL 分析超时（30s）' };
    }
    return { status: 'unknown', message: '网络错误' };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return { status: 'unknown', message: 'VL 模型服务异常' };
  }

  try {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { status: 'unknown', message: 'VL 返回为空' };

    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const result = JSON.parse(cleaned) as PostSubmitResult;

    // Validate status
    const validStatuses = ['success', 'error', 'confirmation_page', 'unknown'];
    if (!validStatuses.includes(result.status)) {
      return { status: 'unknown', message: 'VL 返回无效状态' };
    }

    return result;
  } catch {
    return { status: 'unknown', message: 'VL 返回解析失败' };
  }
}
