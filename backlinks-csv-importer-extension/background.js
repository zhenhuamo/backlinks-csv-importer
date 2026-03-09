"use strict";
(() => {
  // src/ai-comment-generator.ts
  var DASHSCOPE_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  var DEFAULT_MODEL = "qwen3.5-flash";
  var DEFAULT_CAPTCHA_MODEL = "qwen3.5-flash";
  var currentModel = DEFAULT_MODEL;
  var currentCaptchaModel = DEFAULT_CAPTCHA_MODEL;
  var thinkingEnabled = false;
  var MULTIMODAL_MODELS = /* @__PURE__ */ new Set(["qwen3.5-flash", "qwen3.5-plus", "qwen-vl-plus"]);
  function buildSystemPrompt(htmlAllowed) {
    const linkFormatInstruction = htmlAllowed ? '\u5728\u8BC4\u8BBA\u4E2D\u4F7F\u7528 <a href="url">\u5173\u952E\u8BCD</a> \u7684 HTML \u683C\u5F0F\u5D4C\u5165\u94FE\u63A5\u3002' : "\u5728\u8BC4\u8BBA\u4E2D\u4EE5\u7EAF\u6587\u672C\u65B9\u5F0F\u81EA\u7136\u5730\u63D0\u53CA\u7F51\u5740\u548C\u5173\u952E\u8BCD\uFF0C\u4E0D\u8981\u4F7F\u7528\u4EFB\u4F55 HTML \u6807\u7B7E\u3002";
    return [
      "\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u7684\u535A\u5BA2\u8BFB\u8005\u548C\u8BC4\u8BBA\u8005\u3002\u8BF7\u9605\u8BFB\u7528\u6237\u63D0\u4F9B\u7684\u535A\u5BA2\u6587\u7AE0\u5185\u5BB9\uFF0C\u7136\u540E\u751F\u6210\u4E00\u6761\u81EA\u7136\u3001\u76F8\u5173\u7684\u8BC4\u8BBA\u3002",
      "\u8981\u6C42\uFF1A",
      "1. \u8BC4\u8BBA\u5FC5\u987B\u4E0E\u6587\u7AE0\u5185\u5BB9\u76F8\u5173\uFF0C\u4F53\u73B0\u4F60\u8BA4\u771F\u9605\u8BFB\u4E86\u6587\u7AE0\u3002",
      "2. \u81EA\u7136\u5730\u878D\u5165\u7528\u6237\u63D0\u4F9B\u7684\u94FE\u63A5\u6A21\u677F\uFF08\u7F51\u5740\u548C\u5173\u952E\u8BCD\uFF09\uFF0C\u4E0D\u8981\u751F\u786C\u6216\u8FC7\u4E8E\u63A8\u5E7F\u3002",
      `3. ${linkFormatInstruction}`,
      "4. \u8BC4\u8BBA\u7B80\u6D01\uFF0C2-3\u53E5\u8BDD\u5373\u53EF\u3002",
      "5. \u8BED\u6C14\u81EA\u7136\u53CB\u597D\uFF0C\u50CF\u771F\u5B9E\u8BFB\u8005\u7684\u8BC4\u8BBA\u3002"
    ].join("\n");
  }
  function buildUserPrompt(title, body, template) {
    return [
      `\u3010\u6587\u7AE0\u6807\u9898\u3011${title}`,
      "",
      `\u3010\u6587\u7AE0\u5185\u5BB9\u6458\u8981\u3011${body}`,
      "",
      "\u3010\u5916\u94FE\u6A21\u677F\u4FE1\u606F\u3011",
      `- \u540D\u79F0\uFF1A${template.name}`,
      `- \u7F51\u5740\uFF1A${template.url}`,
      `- \u5173\u952E\u8BCD\uFF1A${template.keyword}`,
      "",
      "\u8BF7\u6839\u636E\u4EE5\u4E0A\u6587\u7AE0\u5185\u5BB9\u751F\u6210\u4E00\u6761\u81EA\u7136\u7684\u8BC4\u8BBA\uFF0C\u5E76\u5728\u8BC4\u8BBA\u4E2D\u878D\u5165\u4E0A\u8FF0\u5916\u94FE\u4FE1\u606F\u3002"
    ].join("\n");
  }
  async function generateComment(params, apiKey) {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: "\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E API Key" };
    }
    const body = JSON.stringify({
      model: currentModel,
      messages: [
        { role: "system", content: buildSystemPrompt(params.htmlAllowed) },
        { role: "user", content: buildUserPrompt(params.title, params.body, params.template) }
      ],
      enable_thinking: thinkingEnabled
    });
    let response;
    try {
      response = await fetch(DASHSCOPE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body
      });
    } catch {
      return { success: false, error: "\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5" };
    }
    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "API Key \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u8BBE\u7F6E" };
      }
      if (response.status === 429) {
        return { success: false, error: "API \u8C03\u7528\u9891\u7387\u8D85\u9650\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
      }
      return { success: false, error: "AI \u670D\u52A1\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return { success: true, comment: content };
  }
  function cleanCaptchaResult(raw) {
    return raw.replace(/[\s\.,;:!?'"，。；：！？、\-\(\)\[\]{}\u3000]/g, "");
  }
  async function recognizeCaptcha(imageData, apiKey) {
    if (!apiKey?.trim()) {
      return { success: false, error: "\u8BF7\u5148\u914D\u7F6E API Key" };
    }
    if (!imageData?.trim()) {
      return { success: false, error: "\u9A8C\u8BC1\u7801\u56FE\u7247\u6570\u636E\u4E3A\u7A7A" };
    }
    const body = JSON.stringify({
      model: currentCaptchaModel,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageData } },
          { type: "text", text: "\u8BC6\u522B\u8FD9\u5F20\u9A8C\u8BC1\u7801\u56FE\u7247\u4E2D\u7684\u5B57\u7B26\uFF0C\u53EA\u8FD4\u56DE\u7EAF\u5B57\u7B26\u5185\u5BB9\uFF0C\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u3002" }
        ]
      }],
      enable_thinking: thinkingEnabled
    });
    let response;
    try {
      response = await fetch(DASHSCOPE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body
      });
    } catch {
      return { success: false, error: "\u7F51\u7EDC\u9519\u8BEF" };
    }
    if (!response.ok) {
      if (response.status === 401) return { success: false, error: "API Key \u65E0\u6548" };
      if (response.status === 429) return { success: false, error: "API \u8C03\u7528\u9891\u7387\u8D85\u9650" };
      return { success: false, error: "AI \u670D\u52A1\u5F02\u5E38" };
    }
    try {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { success: false, error: "\u8BC6\u522B\u7ED3\u679C\u4E3A\u7A7A" };
      const cleaned = cleanCaptchaResult(content);
      if (!cleaned) return { success: false, error: "\u672A\u80FD\u8BC6\u522B\u9A8C\u8BC1\u7801\u5185\u5BB9" };
      return { success: true, text: cleaned };
    } catch {
      return { success: false, error: "AI \u8FD4\u56DE\u89E3\u6790\u5931\u8D25" };
    }
  }
  function snapshotToText(snapshot) {
    const lines = [];
    lines.push(`\u3010\u9875\u9762\u6807\u9898\u3011${snapshot.title}`);
    lines.push(`\u3010\u9875\u9762\u8BED\u8A00\u3011${snapshot.pageLang || "\u672A\u77E5"}`);
    lines.push(`\u3010\u9A8C\u8BC1\u7801\u7EBF\u7D22\u3011${snapshot.hasCaptcha ? "\u53D1\u73B0\u7EBF\u7D22" : "\u672A\u53D1\u73B0\u660E\u663E\u7EBF\u7D22"}`);
    if (snapshot.captchaSignals && snapshot.captchaSignals.length > 0) {
      for (const signal of snapshot.captchaSignals.slice(0, 5)) {
        lines.push(`  - ${signal}`);
      }
    }
    if (snapshot.captchaInfo) {
      lines.push(`\u3010\u53EF\u81EA\u52A8\u8BC6\u522B\u9A8C\u8BC1\u7801\u3011\u662F`);
      lines.push(`\u3010\u9A8C\u8BC1\u7801\u8F93\u5165\u6846\u3011${snapshot.captchaInfo.inputSelector}`);
    } else {
      lines.push(`\u3010\u53EF\u81EA\u52A8\u8BC6\u522B\u9A8C\u8BC1\u7801\u3011\u5426`);
    }
    lines.push(`\u3010\u5141\u8BB8HTML\u3011${snapshot.htmlAllowed ? "\u662F" : "\u5426"}`);
    if (snapshot.errorMessages && snapshot.errorMessages.length > 0) {
      lines.push(`\u3010\u9875\u9762\u9519\u8BEF/\u63D0\u793A\u4FE1\u606F\u3011`);
      for (const msg of snapshot.errorMessages.slice(0, 5)) {
        lines.push(`  - ${msg}`);
      }
    }
    lines.push("");
    for (let i = 0; i < snapshot.forms.length; i++) {
      const form = snapshot.forms[i];
      lines.push(`=== \u8868\u5355 ${i + 1} (selector: ${form.selector}) ===`);
      for (const el of form.elements) {
        const parts = [];
        parts.push(`  [${el.tag.toUpperCase()}]`);
        if (el.type) parts.push(`type="${el.type}"`);
        if (el.name) parts.push(`name="${el.name}"`);
        if (el.id) parts.push(`id="${el.id}"`);
        if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
        if (el.label) parts.push(`label="${el.label}"`);
        if (el.text) parts.push(`text="${el.text}"`);
        if (el.value) parts.push(`value="${el.value}"`);
        parts.push(`\u2192 selector: ${el.selector}`);
        lines.push(parts.join(" "));
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  function buildAnalyzeSystemPrompt() {
    return `\u4F60\u662F\u4E00\u4E2A\u6D4F\u89C8\u5668\u81EA\u52A8\u5316\u52A9\u624B\u3002\u7528\u6237\u4F1A\u7ED9\u4F60\u4E00\u4E2A\u7F51\u9875\u7684\u8868\u5355\u7ED3\u6784\u5FEB\u7167\u548C\u4E00\u7BC7\u6587\u7AE0\u7684\u5185\u5BB9\u6458\u8981\u3002

\u6709\u65F6\u8FD8\u4F1A\u989D\u5916\u63D0\u4F9B 1-2 \u5F20\u9875\u9762\u622A\u56FE\u3002\u82E5\u63D0\u4F9B\u4E86\u622A\u56FE\uFF0C\u8BF7\u50CF\u771F\u4EBA\u4E00\u6837\u5148\u770B\u622A\u56FE\u4E2D\u7684\u53EF\u89C1\u8868\u5355\u533A\u57DF\uFF0C\u518D\u7ED3\u5408 DOM \u5FEB\u7167\u5224\u65AD\u5B57\u6BB5\u7528\u9014\u3002

\u4F60\u7684\u4EFB\u52A1\uFF1A
1. \u5206\u6790\u9875\u9762\u4E2D\u7684\u8BC4\u8BBA\u8868\u5355\uFF0C\u7406\u89E3\u6BCF\u4E2A\u5B57\u6BB5\u7684\u7528\u9014
2. \u6839\u636E\u6587\u7AE0\u5185\u5BB9\u751F\u6210\u4E00\u6761\u81EA\u7136\u3001\u76F8\u5173\u7684\u8BC4\u8BBA\uFF082-3\u53E5\u8BDD\uFF09
3. \u89C4\u5212\u4E00\u7CFB\u5217\u64CD\u4F5C\u6307\u4EE4\u6765\u586B\u5199\u8868\u5355\u5E76\u63D0\u4EA4

\u4F60\u5FC5\u987B\u8FD4\u56DE\u4E25\u683C\u7684 JSON \u683C\u5F0F\uFF08\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6807\u8BB0\uFF09\uFF0C\u7ED3\u6784\u5982\u4E0B\uFF1A
{
  "comment": "\u751F\u6210\u7684\u8BC4\u8BBA\u6587\u672C",
  "actions": [
    { "type": "scroll", "selector": "\u8868\u5355\u7684CSS\u9009\u62E9\u5668" },
    { "type": "type", "selector": "\u5B57\u6BB5\u7684CSS\u9009\u62E9\u5668", "value": "\u8981\u8F93\u5165\u7684\u503C" },
    { "type": "click", "selector": "\u63D0\u4EA4\u6309\u94AE\u7684CSS\u9009\u62E9\u5668" }
  ],
  "hasCaptcha": false
}

\u64CD\u4F5C\u7C7B\u578B\u8BF4\u660E\uFF1A
- scroll: \u6EDA\u52A8\u5230\u6307\u5B9A\u5143\u7D20
- type: \u5728\u8F93\u5165\u6846/\u6587\u672C\u57DF\u4E2D\u8F93\u5165\u6587\u5B57
- click: \u70B9\u51FB\u6309\u94AE

\u89C4\u5219\uFF1A
- \u5148 scroll \u5230\u8868\u5355\u533A\u57DF
- \u6309\u987A\u5E8F\u586B\u5199\u6BCF\u4E2A\u9700\u8981\u7684\u5B57\u6BB5\uFF08\u540D\u79F0\u3001\u90AE\u7BB1\u3001URL\u3001\u8BC4\u8BBA\u7B49\uFF09
- \u6700\u540E click \u63D0\u4EA4\u6309\u94AE
- \u4F60\u4F1A\u6536\u5230\u201C\u9A8C\u8BC1\u7801\u7EBF\u7D22\u201D\uFF0C\u4F46\u5FC5\u987B\u81EA\u5DF1\u7EFC\u5408\u8868\u5355\u7ED3\u6784\u3001\u6309\u94AE\u3001\u7EBF\u7D22\u5185\u5BB9\u5224\u65AD\u9875\u9762\u662F\u5426\u771F\u7684\u5B58\u5728\u9A8C\u8BC1\u7801
- \u5982\u679C\u53EA\u662F\u53EF\u7591\u7EBF\u7D22\u4F46\u65E0\u6CD5\u786E\u8BA4\uFF0C\u4E0D\u8981\u56E0\u4E3A\u5355\u4E2A\u5173\u952E\u8BCD\u5C31\u5224\u5B9A\u4E3A\u6709\u9A8C\u8BC1\u7801
- \u5982\u679C\u9875\u9762\u5B58\u5728\u53EF\u81EA\u52A8\u8BC6\u522B\u7684\u7B80\u5355\u56FE\u7247\u9A8C\u8BC1\u7801\uFF0C\u4E14\u5FEB\u7167\u4E2D\u63D0\u4F9B\u4E86\u9A8C\u8BC1\u7801\u8F93\u5165\u6846 selector\uFF0C\u53EF\u4EE5\u5728\u586B\u5199\u9A8C\u8BC1\u7801\u540E\u7EE7\u7EED\u70B9\u51FB\u63D0\u4EA4
- \u53EA\u6709\u5728\u786E\u8BA4\u5B58\u5728\u590D\u6742\u9A8C\u8BC1\u7801\u3001\u4EBA\u5DE5\u9A8C\u8BC1\u3001\u6216\u65E0\u6CD5\u5B89\u5168\u81EA\u52A8\u5B8C\u6210\u65F6\uFF0C\u624D\u8BBE\u7F6E hasCaptcha \u4E3A true \u5E76\u4E14\u4E0D\u6DFB\u52A0 click \u63D0\u4EA4\u64CD\u4F5C
- \u8BC4\u8BBA\u8981\u4E0E\u6587\u7AE0\u5185\u5BB9\u76F8\u5173\uFF0C\u81EA\u7136\u878D\u5165\u7528\u6237\u63D0\u4F9B\u7684\u94FE\u63A5\u4FE1\u606F
- \u53EA\u586B\u5199\u4F60\u80FD\u786E\u5B9A\u7528\u9014\u7684\u5B57\u6BB5\uFF0C\u4E0D\u786E\u5B9A\u7684\u5B57\u6BB5\u8DF3\u8FC7\uFF08\u5982"\u524A\u9664\u30AD\u30FC"\u7B49\uFF09
- selector \u5FC5\u987B\u4F7F\u7528\u5FEB\u7167\u4E2D\u63D0\u4F9B\u7684 selector \u503C\uFF0C\u4E0D\u8981\u81EA\u5DF1\u7F16\u9020
- \u4F18\u5148\u9009\u62E9\u622A\u56FE\u91CC\u8089\u773C\u53EF\u89C1\u3001\u5C3A\u5BF8\u6B63\u5E38\u3001\u4F4D\u4E8E\u8BC4\u8BBA\u533A\u4E2D\u7684\u8F93\u5165\u6846
- \u5FFD\u7565\u4EFB\u4F55\u9690\u85CF\u3001\u6781\u5C0F\u3001\u88AB\u88C1\u526A\u3001\u5C4F\u5E55\u5916\u3001aria-hidden\u3001tabindex=-1\u3001\u6216\u660E\u663E\u7528\u4E8E\u53CD\u5783\u573E/\u871C\u7F50\u7684\u5B57\u6BB5

\u5173\u4E8E URL/\u94FE\u63A5\u7684\u91CD\u8981\u89C4\u5219\uFF08\u6839\u636E\u8868\u5355\u7ED3\u6784\u7075\u6D3B\u5904\u7406\uFF09\uFF1A
- \u3010\u60C5\u51B5A\uFF1A\u8868\u5355\u6709\u4E13\u95E8\u7684 URL/\u7F51\u5740\u5B57\u6BB5\u3011\u5982\u679C\u8868\u5355\u4E2D\u6709 name="url" \u6216 label \u5305\u542B "URL"\u3001"\u7F51\u5740"\u3001"\u30DB\u30FC\u30E0\u30DA\u30FC\u30B8"\u3001"Website" \u7684\u8F93\u5165\u6846\uFF1A
  - \u628A\u7F51\u5740\u586B\u5728\u90A3\u4E2A\u4E13\u95E8\u7684 URL \u5B57\u6BB5\u91CC
  - \u8BC4\u8BBA\u6B63\u6587\u4E2D\u3010\u4E25\u7981\u3011\u5305\u542B\u4EFB\u4F55 URL\u3001\u7F51\u5740\u3001\u94FE\u63A5\uFF08http://\u3001https://\u3001www. \u6216\u57DF\u540D\uFF09
  - \u8BC4\u8BBA\u6B63\u6587\u53EA\u5199\u7EAF\u6587\u5B57\uFF0C\u81EA\u7136\u63D0\u53CA\u5173\u952E\u8BCD\u548C\u7F51\u7AD9\u540D\u79F0\u5373\u53EF
  - \u5F88\u591A\u7F51\u7AD9\u4F1A\u628A URL \u4E2D\u7684\u5B57\u7B26\u5F53\u4F5C\u7981\u6B62\u8BCD\uFF0C\u6240\u4EE5\u8BC4\u8BBA\u6B63\u6587\u5FC5\u987B\u662F\u7EAF\u6587\u5B57
- \u3010\u60C5\u51B5B\uFF1A\u8868\u5355\u6CA1\u6709 URL/\u7F51\u5740\u5B57\u6BB5\u3011\u5982\u679C\u8868\u5355\u4E2D\u6CA1\u6709\u4E13\u95E8\u7684 URL \u5B57\u6BB5\uFF08\u53EA\u6709 Name\u3001Subject\u3001Message/Comment \u7B49\uFF09\uFF1A
  - \u5FC5\u987B\u5728\u8BC4\u8BBA\u6B63\u6587\u4E2D\u5D4C\u5165\u94FE\u63A5\uFF0C\u5426\u5219\u5916\u94FE\u5C31\u4E22\u5931\u4E86
  - \u5982\u679C\u3010\u5141\u8BB8HTML\u3011\u4E3A"\u662F"\uFF0C\u4F7F\u7528 <a href="\u7F51\u5740">\u5173\u952E\u8BCD</a> \u683C\u5F0F\u5D4C\u5165\u94FE\u63A5
  - \u5982\u679C\u3010\u5141\u8BB8HTML\u3011\u4E3A"\u5426"\u6216\u4E0D\u786E\u5B9A\uFF0C\u4E5F\u5C1D\u8BD5\u4F7F\u7528 <a href="\u7F51\u5740">\u5173\u952E\u8BCD</a> \u683C\u5F0F\uFF08\u5F88\u591A\u8BBA\u575B/\u7559\u8A00\u677F\u5B9E\u9645\u652F\u6301 HTML \u4F46\u9875\u9762\u4E0A\u6CA1\u6709\u660E\u786E\u63D0\u793A\uFF09
  - \u94FE\u63A5\u8981\u81EA\u7136\u878D\u5165\u8BC4\u8BBA\u5185\u5BB9\u4E2D\uFF0C\u4E0D\u8981\u751F\u786C
  - \u4F8B\u5982\uFF1A"\u8FD9\u7BC7\u6587\u7AE0\u5F88\u6709\u542F\u53D1\uFF0C\u63A8\u8350\u5927\u5BB6\u4E5F\u770B\u770B <a href="https://example.com">\u76F8\u5173\u8D44\u6E90</a>\uFF0C\u5185\u5BB9\u5F88\u4E0D\u9519\u3002"

\u5173\u4E8E\u8BC4\u8BBA\u8BED\u8A00\u7684\u91CD\u8981\u89C4\u5219\uFF1A
- \u6839\u636E\u9875\u9762\u8BED\u8A00\uFF08\u3010\u9875\u9762\u8BED\u8A00\u3011\u5B57\u6BB5\uFF09\u6765\u51B3\u5B9A\u8BC4\u8BBA\u4F7F\u7528\u7684\u8BED\u8A00
- \u3010\u6700\u91CD\u8981\u3011\u5982\u679C\u9875\u9762\u662F\u65E5\u6587\uFF08ja\uFF09\uFF0C\u8BC4\u8BBA\u6B63\u6587\u4E2D\u4E25\u7981\u51FA\u73B0\u4EFB\u4F55\u82F1\u6587\u5B57\u6BCD\uFF08a-z\u3001A-Z\uFF09\uFF01\u4E00\u4E2A\u90FD\u4E0D\u884C\uFF01
- \u65E5\u6587\u9875\u9762\u7684\u8BC4\u8BBA\u5FC5\u987B\u662F100%\u7EAF\u65E5\u6587\u5B57\u7B26\uFF08\u5E73\u5047\u540D\u3001\u7247\u5047\u540D\u3001\u6C49\u5B57\u3001\u65E5\u6587\u6807\u70B9\uFF09
- \u65E5\u6587\u9875\u9762\u4E2D\uFF0C\u6240\u6709\u82F1\u6587\u540D\u79F0\u5FC5\u987B\u7FFB\u8BD1\u6210\u7247\u5047\u540D\uFF1A\u4F8B\u5982 "Spicy Books" \u2192 "\u30B9\u30D1\u30A4\u30B7\u30FC\u30D6\u30C3\u30AF\u30B9"\u3001"Kingshot Guide" \u2192 "\u30AD\u30F3\u30B0\u30B7\u30E7\u30C3\u30C8\u30AC\u30A4\u30C9"\u3001"photo to cartoon" \u2192 "\u30D5\u30A9\u30C8\u30C8\u30A5\u30AB\u30FC\u30C8\u30A5\u30FC\u30F3"
- \u65E5\u6587\u9875\u9762\u4E2D\uFF0C\u5173\u952E\u8BCD\u4E5F\u5FC5\u987B\u7FFB\u8BD1\u6210\u65E5\u6587\uFF0C\u4E0D\u80FD\u4FDD\u7559\u82F1\u6587\u539F\u6587
- \u5982\u679C\u9875\u9762\u662F\u4E2D\u6587\uFF08zh\uFF09\uFF0C\u8BC4\u8BBA\u7528\u4E2D\u6587\u5199\uFF0C\u82F1\u6587\u540D\u79F0\u53EF\u4EE5\u4FDD\u7559
- \u5982\u679C\u9875\u9762\u662F\u97E9\u6587\uFF08ko\uFF09\uFF0C\u8BC4\u8BBA\u7528\u97E9\u6587\u5199
- \u5982\u679C\u9875\u9762\u662F\u82F1\u6587\u6216\u8BED\u8A00\u672A\u77E5\uFF0C\u8BC4\u8BBA\u7528\u82F1\u6587\u5199
- \u540D\u79F0\u5B57\u6BB5\uFF08name/\u540D\u524D\uFF09\u53EF\u4EE5\u4FDD\u7559\u82F1\u6587\uFF0C\u56E0\u4E3A\u90A3\u662F\u7528\u6237\u540D
- \u90AE\u7BB1\u5B57\u6BB5\u53EF\u4EE5\u4FDD\u7559\u82F1\u6587
- URL \u5B57\u6BB5\u53EF\u4EE5\u4FDD\u7559\u82F1\u6587
- \u53EA\u6709\u8BC4\u8BBA\u6B63\u6587\uFF08textarea/\u30B3\u30E1\u30F3\u30C8\uFF09\u9700\u8981\u4E25\u683C\u9075\u5B88\u8BED\u8A00\u89C4\u5219\uFF0C\u7EDD\u5BF9\u4E0D\u80FD\u6709\u82F1\u6587\u5B57\u6BCD`;
  }
  function buildAnalyzeUserPrompt(snapshot, template, htmlAllowed) {
    const hasUrlField = snapshot.forms.some(
      (form) => form.elements.some(
        (el) => el.name?.toLowerCase().includes("url") || el.label?.toLowerCase().includes("url") || el.label?.includes("\u30DB\u30FC\u30E0\u30DA\u30FC\u30B8") || el.label?.toLowerCase().includes("website") || el.label?.includes("\u7F51\u5740")
      )
    );
    let linkInstruction;
    if (hasUrlField) {
      linkInstruction = "\u3010\u94FE\u63A5\u5904\u7406\u3011\u8868\u5355\u6709\u4E13\u95E8\u7684 URL \u5B57\u6BB5\uFF0C\u8BF7\u628A\u7F51\u5740\u586B\u5728 URL \u5B57\u6BB5\u4E2D\uFF0C\u8BC4\u8BBA\u6B63\u6587\u4E2D\u4E0D\u8981\u5305\u542B\u4EFB\u4F55\u94FE\u63A5\u6216\u7F51\u5740\u3002";
    } else {
      linkInstruction = [
        "\u3010\u26A0\uFE0F \u94FE\u63A5\u5904\u7406 \u2014 \u6781\u5176\u91CD\u8981\uFF0C\u5FC5\u987B\u9075\u5B88\u3011",
        "\u6B64\u8868\u5355\u6CA1\u6709 URL \u5B57\u6BB5\uFF01\u5982\u679C\u4E0D\u5728\u8BC4\u8BBA\u6B63\u6587\u4E2D\u5D4C\u5165\u94FE\u63A5\uFF0C\u5916\u94FE\u5C31\u4F1A\u5B8C\u5168\u4E22\u5931\uFF0C\u8FD9\u6B21\u8BC4\u8BBA\u5C31\u767D\u8D39\u4E86\u3002",
        `\u4F60\u5FC5\u987B\u5728\u8BC4\u8BBA\u6B63\u6587\uFF08Message/Comment\uFF09\u4E2D\u5305\u542B\u8FD9\u4E2A\u94FE\u63A5\uFF1A<a href="${template.url}">${template.keyword}</a>`,
        "\u628A\u8FD9\u4E2A <a> \u6807\u7B7E\u81EA\u7136\u5730\u878D\u5165\u8BC4\u8BBA\u53E5\u5B50\u4E2D\uFF0C\u4F8B\u5982\uFF1A",
        `"...\u63A8\u8350\u5927\u5BB6\u770B\u770B <a href="${template.url}">${template.keyword}</a>\uFF0C\u5185\u5BB9\u5F88\u4E0D\u9519..."`,
        "\u5982\u679C\u4E0D\u5305\u542B\u8FD9\u4E2A\u94FE\u63A5\uFF0C\u4EFB\u52A1\u5C31\u5931\u8D25\u4E86\u3002"
      ].join("\n");
    }
    return [
      "\u3010\u9875\u9762\u8868\u5355\u7ED3\u6784\u3011",
      snapshotToText(snapshot),
      "",
      `\u3010\u6587\u7AE0\u5185\u5BB9\u6458\u8981\u3011${snapshot.bodyExcerpt.substring(0, 1500)}`,
      "",
      "\u3010\u5916\u94FE\u6A21\u677F\u4FE1\u606F\uFF08\u7528\u4E8E\u586B\u5199\u8868\u5355\u5B57\u6BB5\u548C\u751F\u6210\u8BC4\u8BBA\uFF09\u3011",
      `- \u540D\u79F0/\u6635\u79F0: ${template.name}`,
      `- \u90AE\u7BB1: ${template.email || "\uFF08\u672A\u63D0\u4F9B\uFF0C\u8BF7\u7528\u5408\u7406\u7684\u90AE\u7BB1\u5982 name@domain.com\uFF09"}`,
      `- \u7F51\u5740: ${template.url}`,
      `- \u5173\u952E\u8BCD: ${template.keyword}`,
      "",
      linkInstruction,
      "",
      "\u8BF7\u5206\u6790\u8868\u5355\u7ED3\u6784\uFF0C\u751F\u6210\u8BC4\u8BBA\uFF0C\u5E76\u8FD4\u56DE\u64CD\u4F5C\u6307\u4EE4 JSON\u3002"
    ].join("\n");
  }
  function buildVisionAwareUserContent(promptText, screenshots) {
    if (!screenshots || screenshots.length === 0 || !MULTIMODAL_MODELS.has(currentModel)) {
      return promptText;
    }
    const userContent = [];
    for (const screenshot of screenshots.slice(0, 2)) {
      userContent.push({ type: "image_url", image_url: { url: screenshot } });
    }
    userContent.push({
      type: "text",
      text: [
        "\u3010\u89C6\u89C9\u5206\u6790\u8981\u6C42\u3011\u8BF7\u5148\u6839\u636E\u622A\u56FE\u5224\u65AD\u8BC4\u8BBA\u533A\u91CC\u771F\u6B63\u53EF\u89C1\u7684\u8F93\u5165\u6846\u548C\u63D0\u4EA4\u6309\u94AE\uFF0C\u518D\u7528 DOM \u5FEB\u7167\u4E2D\u7684 selector \u751F\u6210\u52A8\u4F5C\u3002",
        promptText
      ].join("\n\n")
    });
    return userContent;
  }
  function buildAnalyzeUserContent(snapshot, template, htmlAllowed, screenshots) {
    const promptText = buildAnalyzeUserPrompt(snapshot, template, htmlAllowed);
    return buildVisionAwareUserContent(promptText, screenshots);
  }
  async function analyzePageAndPlan(snapshot, template, apiKey, screenshots) {
    if (!apiKey?.trim()) {
      return { success: false, error: "\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E API Key" };
    }
    let captchaText = null;
    let captchaFailed = false;
    if (snapshot.captchaInfo?.type === "simple_image") {
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
        { role: "system", content: buildAnalyzeSystemPrompt() },
        { role: "user", content: buildAnalyzeUserContent(snapshot, template, snapshot.htmlAllowed, screenshots) }
      ],
      response_format: { type: "json_object" },
      enable_thinking: thinkingEnabled
    });
    let response;
    try {
      response = await fetch(DASHSCOPE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body
      });
    } catch {
      return { success: false, error: "\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5" };
    }
    if (!response.ok) {
      if (response.status === 401) return { success: false, error: "API Key \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u8BBE\u7F6E" };
      if (response.status === 429) return { success: false, error: "API \u8C03\u7528\u9891\u7387\u8D85\u9650\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
      return { success: false, error: "AI \u670D\u52A1\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" };
    }
    try {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { success: false, error: "AI \u8FD4\u56DE\u5185\u5BB9\u4E3A\u7A7A" };
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const plan = JSON.parse(cleaned);
      let finalActions = Array.isArray(plan.actions) ? [...plan.actions] : [];
      let finalHasCaptcha = plan.hasCaptcha || false;
      const submitIdx = finalActions.findIndex((a) => a.type === "click");
      if (captchaText && snapshot.captchaInfo) {
        const captchaAction = {
          type: "type",
          selector: snapshot.captchaInfo.inputSelector,
          value: captchaText
        };
        if (submitIdx >= 0) {
          finalActions = [...finalActions.slice(0, submitIdx), captchaAction, ...finalActions.slice(submitIdx)];
        } else {
          finalActions = [...finalActions, captchaAction];
        }
        finalHasCaptcha = finalHasCaptcha && submitIdx < 0;
      } else if (captchaFailed && finalHasCaptcha) {
        finalActions = finalActions.filter((a) => a.type !== "click");
        finalHasCaptcha = true;
      }
      return {
        success: true,
        comment: plan.comment,
        actions: finalActions,
        hasCaptcha: finalHasCaptcha
      };
    } catch (e) {
      return { success: false, error: "AI \u8FD4\u56DE\u683C\u5F0F\u89E3\u6790\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5" };
    }
  }
  async function analyzePostSubmit(snapshot, apiKey, commentContent) {
    if (!apiKey?.trim()) {
      return { status: "unknown", message: "API Key \u7F3A\u5931" };
    }
    const systemPrompt = `\u4F60\u662F\u4E00\u4E2A\u6D4F\u89C8\u5668\u81EA\u52A8\u5316\u52A9\u624B\u3002\u7528\u6237\u521A\u521A\u5728\u4E00\u4E2A\u7F51\u9875\u4E0A\u63D0\u4EA4\u4E86\u8BC4\u8BBA\u8868\u5355\uFF0C\u9875\u9762\u53D1\u751F\u4E86\u53D8\u5316\u3002
\u4F60\u9700\u8981\u5206\u6790\u5F53\u524D\u9875\u9762\u72B6\u6001\uFF0C\u5224\u65AD\u5C5E\u4E8E\u4EE5\u4E0B\u54EA\u79CD\u60C5\u51B5\uFF1A

1. "confirmation_page" \u2014 \u8FD9\u662F\u4E00\u4E2A\u9884\u89C8/\u786E\u8BA4\u9875\u9762\uFF0C\u8BC4\u8BBA\u8FD8\u6CA1\u6709\u771F\u6B63\u53D1\u5E03\uFF0C\u9700\u8981\u518D\u70B9\u51FB\u4E00\u4E2A\u6309\u94AE\u624D\u80FD\u771F\u6B63\u63D0\u4EA4
   \u5E38\u89C1\u7279\u5F81\uFF1A\u9875\u9762\u663E\u793A\u4E86\u8BC4\u8BBA\u9884\u89C8\u5185\u5BB9\uFF0C\u6709"\u6295\u7A3F\u3059\u308B"\u3001"Submit"\u3001"\u786E\u8BA4\u63D0\u4EA4"\u3001"Post"\u7B49\u6309\u94AE
2. "success" \u2014 \u8BC4\u8BBA\u5DF2\u7ECF\u6210\u529F\u53D1\u5E03
   \u5E38\u89C1\u7279\u5F81\uFF1A\u9875\u9762\u663E\u793A\u611F\u8C22\u4FE1\u606F\u3001\u6210\u529F\u63D0\u793A\u3001\u6216\u8005\u8BC4\u8BBA\u5DF2\u7ECF\u51FA\u73B0\u5728\u8BC4\u8BBA\u5217\u8868\u4E2D
3. "error" \u2014 \u63D0\u4EA4\u51FA\u9519
   \u5E38\u89C1\u7279\u5F81\uFF1A\u9875\u9762\u663E\u793A\u9519\u8BEF\u4FE1\u606F\u3001\u9A8C\u8BC1\u5931\u8D25\u63D0\u793A\u3001\u7981\u6B62\u8BCD\u63D0\u793A\u3001\u6295\u7A3F\u7981\u6B62\u30EF\u30FC\u30C9\u7B49

\u8FD4\u56DE\u4E25\u683C\u7684 JSON \u683C\u5F0F\uFF08\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6807\u8BB0\uFF09\uFF1A
{
  "status": "confirmation_page" \u6216 "success" \u6216 "error",
  "message": "\u7B80\u77ED\u63CF\u8FF0\u5F53\u524D\u9875\u9762\u72B6\u6001\uFF0C\u5982\u679C\u662F error \u8BF7\u5305\u542B\u5177\u4F53\u7684\u9519\u8BEF\u539F\u56E0\uFF08\u5982\u7981\u6B62\u8BCD\u3001\u9A8C\u8BC1\u7801\u9519\u8BEF\u7B49\uFF09",
  "actions": [
    { "type": "click", "selector": "\u9700\u8981\u70B9\u51FB\u7684\u6309\u94AE\u7684CSS\u9009\u62E9\u5668" }
  ]
}

\u89C4\u5219\uFF1A
- \u5982\u679C\u662F confirmation_page\uFF0Cactions \u4E2D\u5FC5\u987B\u5305\u542B\u70B9\u51FB\u771F\u6B63\u63D0\u4EA4\u6309\u94AE\u7684\u6307\u4EE4
- \u5982\u679C\u662F success \u6216 error\uFF0Cactions \u4E3A\u7A7A\u6570\u7EC4
- selector \u5FC5\u987B\u4F7F\u7528\u5FEB\u7167\u4E2D\u63D0\u4F9B\u7684 selector \u503C\uFF0C\u4E0D\u8981\u81EA\u5DF1\u7F16\u9020
- \u5982\u679C\u9875\u9762\u6709"\u6295\u7A3F\u3059\u308B"\u3001"\u9001\u4FE1"\u3001"Submit"\u3001"Post Comment"\u7B49\u6309\u94AE\uFF0C\u5F88\u53EF\u80FD\u662F\u786E\u8BA4\u9875
- \u6CE8\u610F\u67E5\u770B\u3010\u9875\u9762\u9519\u8BEF/\u63D0\u793A\u4FE1\u606F\u3011\u90E8\u5206\uFF0C\u90A3\u91CC\u5305\u542B\u4E86\u9875\u9762\u4E0A\u663E\u793A\u7684\u9519\u8BEF\u548C\u8B66\u544A
- \u5982\u679C\u770B\u5230"\u7981\u6B62\u30EF\u30FC\u30C9"\u3001"\u7981\u6B62\u8BCD"\u3001"banned word"\u7B49\u63D0\u793A\uFF0Cstatus \u5E94\u4E3A error\uFF0Cmessage \u4E2D\u8BF4\u660E\u5177\u4F53\u7684\u7981\u6B62\u8BCD

\u6210\u529F\u4FE1\u53F7\u8BC6\u522B\uFF08\u91CD\u8981\uFF09\uFF1A
- \u5982\u679C\u7528\u6237\u63D0\u4F9B\u4E86\u3010\u521A\u63D0\u4EA4\u7684\u8BC4\u8BBA\u5185\u5BB9\u3011\uFF0C\u8BF7\u5728\u9875\u9762\u6B63\u6587\u4E2D\u641C\u7D22\u8BE5\u8BC4\u8BBA\u6587\u672C\u3002\u5982\u679C\u627E\u5230\u4E86\u63D0\u4EA4\u7684\u8BC4\u8BBA\u5185\u5BB9\uFF0C\u8FD9\u662F\u975E\u5E38\u5F3A\u7684\u6210\u529F\u4FE1\u53F7\uFF0C\u5373\u4F7F\u9875\u9762\u6CA1\u6709\u663E\u793A\u660E\u786E\u7684\u611F\u8C22\u4FE1\u606F\uFF0C\u4E5F\u5E94\u5224\u5B9A\u4E3A success
- \u591A\u79CD\u6210\u529F\u4FE1\u53F7\uFF1A\u8868\u5355\u5DF2\u88AB\u6E05\u7A7A\u3001\u51FA\u73B0\u611F\u8C22/\u6210\u529F\u63D0\u793A\uFF08\u5982"Thank you"\u3001"\u30B3\u30E1\u30F3\u30C8\u3042\u308A\u304C\u3068\u3046"\uFF09\u3001\u8BC4\u8BBA\u51FA\u73B0\u5728\u8BC4\u8BBA\u5217\u8868\u4E2D\u3001\u9875\u9762 URL \u53D1\u751F\u53D8\u5316\u3001\u51FA\u73B0"\u8BC4\u8BBA\u5F85\u5BA1\u6838"/"\u30B3\u30E1\u30F3\u30C8\u306F\u627F\u8A8D\u5F85\u3061"/"comment awaiting moderation"\u7B49\u63D0\u793A
- \u4EE5\u4E0A\u4FE1\u53F7\u51FA\u73B0\u4EFB\u610F\u4E00\u4E2A\u6216\u591A\u4E2A\uFF0C\u90FD\u5E94\u503E\u5411\u5224\u5B9A\u4E3A success

\u4E0D\u540C\u7F51\u7AD9\u7684\u63D0\u4EA4\u540E\u884C\u4E3A\u5DEE\u5F02\uFF1A
- WordPress \u7B49\u7AD9\u70B9\uFF1A\u63D0\u4EA4\u540E\u9875\u9762\u76F4\u63A5\u5237\u65B0\uFF0C\u8BC4\u8BBA\u51FA\u73B0\u5728\u8BC4\u8BBA\u5217\u8868\u4E2D\uFF0C\u8868\u5355\u88AB\u6E05\u7A7A\uFF0C\u901A\u5E38\u6CA1\u6709\u660E\u786E\u7684\u611F\u8C22\u5F39\u7A97
- \u65E5\u672C\u7F51\u7AD9\uFF1A\u53EF\u80FD\u8DF3\u8F6C\u5230\u786E\u8BA4\u9875\uFF08\u6709"\u6295\u7A3F\u3059\u308B"\u6309\u94AE\uFF09\uFF0C\u8FD9\u662F confirmation_page \u800C\u975E success
- AJAX \u65E0\u5237\u65B0\u7AD9\u70B9\uFF1A\u8BC4\u8BBA\u901A\u8FC7 AJAX \u63D2\u5165\u9875\u9762\uFF0C\u9875\u9762\u4E0D\u5237\u65B0\u4F46\u8BC4\u8BBA\u5217\u8868\u66F4\u65B0
- \u6CE8\u610F\u533A\u5206\uFF1A\u9875\u9762\u5237\u65B0\u540E\u8868\u5355\u6E05\u7A7A + \u8BC4\u8BBA\u53EF\u89C1 = success\uFF0C\u800C\u975E error \u6216 unknown`;
    const userPromptParts = [
      "\u3010\u63D0\u4EA4\u540E\u7684\u9875\u9762\u72B6\u6001\u3011",
      snapshotToText(snapshot),
      "",
      "\u3010\u9875\u9762\u6B63\u6587\u6458\u8981\u3011",
      snapshot.bodyExcerpt.substring(0, 1e3)
    ];
    if (commentContent?.trim()) {
      userPromptParts.push("", "\u3010\u521A\u63D0\u4EA4\u7684\u8BC4\u8BBA\u5185\u5BB9\u3011", commentContent.trim());
    }
    userPromptParts.push("", "\u8BF7\u5224\u65AD\u5F53\u524D\u9875\u9762\u72B6\u6001\u5E76\u8FD4\u56DE JSON\u3002");
    const userPrompt = userPromptParts.join("\n");
    const body = JSON.stringify({
      model: currentModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      enable_thinking: thinkingEnabled
    });
    let response;
    try {
      response = await fetch(DASHSCOPE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body
      });
    } catch {
      return { status: "unknown", message: "\u7F51\u7EDC\u9519\u8BEF" };
    }
    if (!response.ok) {
      return { status: "unknown", message: "AI \u670D\u52A1\u5F02\u5E38" };
    }
    try {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { status: "unknown", message: "AI \u8FD4\u56DE\u4E3A\u7A7A" };
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const result = JSON.parse(cleaned);
      return result;
    } catch {
      return { status: "unknown", message: "AI \u8FD4\u56DE\u89E3\u6790\u5931\u8D25" };
    }
  }
  async function retryWithErrorContext(snapshot, template, apiKey, errorMessage, failedComment, attemptNumber, screenshots) {
    if (!apiKey?.trim()) {
      return { success: false, error: "API Key \u7F3A\u5931" };
    }
    const systemPrompt = buildAnalyzeSystemPrompt();
    const userPrompt = [
      "\u3010\u91CD\u8981\uFF1A\u4E0A\u6B21\u63D0\u4EA4\u5931\u8D25\u4E86\uFF0C\u8BF7\u4FEE\u6B63\u8BC4\u8BBA\u3011",
      `\u5931\u8D25\u539F\u56E0\uFF1A${errorMessage}`,
      `\u4E0A\u6B21\u5931\u8D25\u7684\u8BC4\u8BBA\u5185\u5BB9\uFF1A\u300C${failedComment}\u300D`,
      `\u8FD9\u662F\u7B2C ${attemptNumber} \u6B21\u91CD\u8BD5\u3002`,
      "",
      "\u8BF7\u4ED4\u7EC6\u5206\u6790\u5931\u8D25\u539F\u56E0\uFF0C\u751F\u6210\u4E00\u6761\u5B8C\u5168\u4E0D\u540C\u7684\u8BC4\u8BBA\u6765\u907F\u514D\u540C\u6837\u7684\u9519\u8BEF\u3002",
      '\u5982\u679C\u9519\u8BEF\u63D0\u793A\u5305\u542B"\u7981\u6B62\u30EF\u30FC\u30C9"\uFF08\u7981\u6B62\u8BCD\uFF09\u6216\u7C7B\u4F3C\u4FE1\u606F\uFF0C\u8BF4\u660E\u8BC4\u8BBA\u4E2D\u5305\u542B\u4E86\u88AB\u7F51\u7AD9\u7981\u6B62\u7684\u5B57\u7B26\u6216\u8BCD\u8BED\u3002',
      "\u5E38\u89C1\u7684\u7981\u6B62\u89C4\u5219\uFF1A",
      "- \u6709\u4E9B\u65E5\u6587\u7F51\u7AD9\u7981\u6B62\u8BC4\u8BBA\u4E2D\u51FA\u73B0\u4EFB\u4F55\u82F1\u6587\u5B57\u6BCD\uFF08a-z\u3001A-Z\uFF09",
      "- \u6709\u4E9B\u7F51\u7AD9\u7981\u6B62 URL\u3001\u94FE\u63A5\u3001\u7279\u5B9A\u7B26\u53F7",
      "- \u5982\u679C\u4E4B\u524D\u7684\u8BC4\u8BBA\u5305\u542B\u82F1\u6587\u5B57\u6BCD\u4E14\u88AB\u62D2\u7EDD\uFF0C\u8FD9\u6B21\u8BF7\u7528\u7EAF\u65E5\u6587/\u4E2D\u6587/\u97E9\u6587\uFF08\u6839\u636E\u9875\u9762\u8BED\u8A00\uFF09\uFF0C\u5B8C\u5168\u4E0D\u8981\u4F7F\u7528\u4EFB\u4F55\u82F1\u6587\u5B57\u6BCD",
      "",
      "\u3010\u9875\u9762\u8868\u5355\u7ED3\u6784\u3011",
      snapshotToText(snapshot),
      "",
      `\u3010\u6587\u7AE0\u5185\u5BB9\u6458\u8981\u3011${snapshot.bodyExcerpt.substring(0, 1500)}`,
      "",
      "\u3010\u5916\u94FE\u6A21\u677F\u4FE1\u606F\u3011",
      `- \u540D\u79F0/\u6635\u79F0: ${template.name}`,
      `- \u90AE\u7BB1: ${template.email || "\uFF08\u672A\u63D0\u4F9B\uFF09"}`,
      `- \u7F51\u5740: ${template.url}`,
      `- \u5173\u952E\u8BCD: ${template.keyword}`,
      "",
      "\u8BF7\u91CD\u65B0\u751F\u6210\u8BC4\u8BBA\u5E76\u8FD4\u56DE\u64CD\u4F5C\u6307\u4EE4 JSON\u3002",
      "\u6CE8\u610F\uFF1A\u5982\u679C\u9875\u9762\u662F\u65E5\u6587\u7F51\u7AD9\uFF0C\u8BC4\u8BBA\u6B63\u6587\u4E2D\u7EDD\u5BF9\u4E0D\u8981\u5305\u542B\u4EFB\u4F55\u82F1\u6587\u5B57\u6BCD\u3002",
      `\u5173\u4E8E\u94FE\u63A5\uFF1A\u8BF7\u6839\u636E\u8868\u5355\u7ED3\u6784\u5224\u65AD\u2014\u2014\u5982\u679C\u6709 URL \u5B57\u6BB5\u5219\u8BC4\u8BBA\u6B63\u6587\u4E0D\u8981\u5305\u542B\u94FE\u63A5\uFF1B\u5982\u679C\u6CA1\u6709 URL \u5B57\u6BB5\uFF0C\u5219\u5FC5\u987B\u5728\u8BC4\u8BBA\u6B63\u6587\u4E2D\u7528 <a href="${template.url}">${template.keyword}</a> \u5D4C\u5165\u94FE\u63A5\uFF0C\u5426\u5219\u5916\u94FE\u4E22\u5931\u3001\u4EFB\u52A1\u5931\u8D25\u3002`
    ].join("\n");
    const body = JSON.stringify({
      model: currentModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildVisionAwareUserContent(userPrompt, screenshots) }
      ],
      response_format: { type: "json_object" },
      enable_thinking: thinkingEnabled
    });
    let response;
    try {
      response = await fetch(DASHSCOPE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body
      });
    } catch {
      return { success: false, error: "\u7F51\u7EDC\u9519\u8BEF" };
    }
    if (!response.ok) {
      if (response.status === 401) return { success: false, error: "API Key \u65E0\u6548" };
      if (response.status === 429) return { success: false, error: "API \u8C03\u7528\u9891\u7387\u8D85\u9650" };
      return { success: false, error: "AI \u670D\u52A1\u5F02\u5E38" };
    }
    try {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { success: false, error: "AI \u8FD4\u56DE\u4E3A\u7A7A" };
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const plan = JSON.parse(cleaned);
      return {
        success: true,
        comment: plan.comment,
        actions: plan.actions,
        hasCaptcha: plan.hasCaptcha || false
      };
    } catch {
      return { success: false, error: "AI \u8FD4\u56DE\u89E3\u6790\u5931\u8D25" };
    }
  }
  function buildVLVerifySystemPrompt() {
    return `\u4F60\u662F\u4E00\u4E2A\u6D4F\u89C8\u5668\u81EA\u52A8\u5316\u52A9\u624B\uFF0C\u64C5\u957F\u901A\u8FC7\u622A\u56FE\u89C6\u89C9\u5206\u6790\u5224\u65AD\u7F51\u9875\u72B6\u6001\u3002
\u7528\u6237\u521A\u521A\u5728\u4E00\u4E2A\u7F51\u9875\u4E0A\u63D0\u4EA4\u4E86\u8BC4\u8BBA\u8868\u5355\u3002\u4F60\u4F1A\u6536\u5230 1-2 \u5F20\u9875\u9762\u622A\u56FE\u548C\u4E00\u4EFD DOM \u5FEB\u7167\u6587\u672C\u3002

\u3010\u91CD\u8981\u3011\u8BF7\u4F18\u5148\u4F9D\u636E\u622A\u56FE\u4E2D\u7684\u89C6\u89C9\u4FE1\u606F\u8FDB\u884C\u5224\u65AD\uFF0CDOM \u5FEB\u7167\u4EC5\u4F5C\u4E3A\u8F85\u52A9\u53C2\u8003\u3002

\u8BF7\u6839\u636E\u4EE5\u4E0B\u89C6\u89C9\u4FE1\u53F7\u5224\u65AD\u63D0\u4EA4\u7ED3\u679C\uFF1A

\u6210\u529F\u4FE1\u53F7\uFF08\u611F\u8C22/\u6210\u529F\u63D0\u793A\uFF09\uFF1A
- \u9875\u9762\u663E\u793A"\u611F\u8C22"\u3001"Thank you"\u3001"\u30B3\u30E1\u30F3\u30C8\u3042\u308A\u304C\u3068\u3046"\u3001"\u8BC4\u8BBA\u6210\u529F"\u7B49\u611F\u8C22/\u6210\u529F\u63D0\u793A
- \u8BC4\u8BBA\u51FA\u73B0\u5728\u8BC4\u8BBA\u5217\u8868\u4E2D\uFF08\u53EF\u4EE5\u770B\u5230\u521A\u63D0\u4EA4\u7684\u8BC4\u8BBA\u5185\u5BB9\uFF09
- \u8868\u5355\u5DF2\u88AB\u6E05\u7A7A\uFF08\u8F93\u5165\u6846\u53D8\u4E3A\u7A7A\u767D\uFF09
- \u51FA\u73B0"\u8BC4\u8BBA\u5F85\u5BA1\u6838"\u3001"awaiting moderation"\u3001"\u627F\u8A8D\u5F85\u3061"\u7B49\u63D0\u793A\uFF08\u8FD9\u4E5F\u662F\u6210\u529F\uFF09

\u786E\u8BA4\u9875\u9762\u6309\u94AE\u4FE1\u53F7\uFF1A
- \u9875\u9762\u663E\u793A\u8BC4\u8BBA\u9884\u89C8\u5185\u5BB9\uFF0C\u5E76\u6709"\u6295\u7A3F\u3059\u308B"\u3001"Submit"\u3001"\u786E\u8BA4\u63D0\u4EA4"\u3001"Post"\u7B49\u6309\u94AE
- \u8FD9\u8868\u793A\u9700\u8981\u518D\u70B9\u51FB\u4E00\u6B21\u624D\u80FD\u771F\u6B63\u63D0\u4EA4

\u9519\u8BEF\u63D0\u793A\u4FE1\u53F7\uFF1A
- \u9875\u9762\u663E\u793A\u7EA2\u8272\u9519\u8BEF\u4FE1\u606F\u3001\u9A8C\u8BC1\u5931\u8D25\u63D0\u793A
- \u51FA\u73B0"\u7981\u6B62\u30EF\u30FC\u30C9"\u3001"\u7981\u6B62\u8BCD"\u3001"banned word"\u7B49\u63D0\u793A
- \u9A8C\u8BC1\u7801\u9519\u8BEF\u63D0\u793A

\u8FD4\u56DE\u4E25\u683C\u7684 JSON \u683C\u5F0F\uFF08\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6807\u8BB0\uFF09\uFF1A
{
  "status": "success" \u6216 "confirmation_page" \u6216 "error" \u6216 "unknown",
  "message": "\u7B80\u77ED\u63CF\u8FF0\u5F53\u524D\u9875\u9762\u72B6\u6001",
  "actions": [
    { "type": "click", "selector": "\u9700\u8981\u70B9\u51FB\u7684\u6309\u94AE\u7684CSS\u9009\u62E9\u5668" }
  ]
}

\u89C4\u5219\uFF1A
- \u5982\u679C\u662F confirmation_page\uFF0Cactions \u4E2D\u5FC5\u987B\u5305\u542B\u70B9\u51FB\u771F\u6B63\u63D0\u4EA4\u6309\u94AE\u7684\u6307\u4EE4\uFF0Cselector \u4ECE DOM \u5FEB\u7167\u4E2D\u83B7\u53D6
- \u5982\u679C\u662F success \u6216 error\uFF0Cactions \u4E3A\u7A7A\u6570\u7EC4
- \u4F18\u5148\u770B\u622A\u56FE\u5224\u65AD\uFF0C\u622A\u56FE\u4E2D\u80FD\u770B\u5230\u7684\u89C6\u89C9\u4FE1\u53F7\u6BD4 DOM \u6587\u672C\u66F4\u53EF\u9760
- \u5982\u679C\u622A\u56FE\u4E2D\u80FD\u770B\u5230\u8BC4\u8BBA\u5185\u5BB9\u51FA\u73B0\u5728\u9875\u9762\u4E0A\uFF0C\u5373\u4F7F DOM \u5FEB\u7167\u4E0D\u5B8C\u6574\uFF0C\u4E5F\u5E94\u5224\u5B9A\u4E3A success`;
  }
  function buildVLVerifyUserPrompt(snapshot, commentContent) {
    const parts = [];
    parts.push("\u3010DOM \u5FEB\u7167\u4FE1\u606F\uFF08\u8F85\u52A9\u53C2\u8003\uFF09\u3011");
    parts.push(`\u9875\u9762\u6807\u9898: ${snapshot.title}`);
    if (snapshot.pageLang) parts.push(`\u9875\u9762\u8BED\u8A00: ${snapshot.pageLang}`);
    if (snapshot.errorMessages && snapshot.errorMessages.length > 0) {
      parts.push("\u9875\u9762\u9519\u8BEF/\u63D0\u793A\u4FE1\u606F:");
      for (const msg of snapshot.errorMessages.slice(0, 5)) {
        parts.push(`  - ${msg}`);
      }
    }
    if (snapshot.forms && snapshot.forms.length > 0) {
      parts.push("");
      parts.push("\u8868\u5355\u7ED3\u6784:");
      for (const form of snapshot.forms) {
        for (const el of form.elements) {
          const desc = [`[${el.tag}]`];
          if (el.type) desc.push(`type="${el.type}"`);
          if (el.name) desc.push(`name="${el.name}"`);
          if (el.text) desc.push(`text="${el.text}"`);
          desc.push(`\u2192 ${el.selector}`);
          parts.push(`  ${desc.join(" ")}`);
        }
      }
    }
    parts.push("");
    parts.push(`\u9875\u9762\u6B63\u6587\u6458\u8981: ${snapshot.bodyExcerpt.substring(0, 1e3)}`);
    if (commentContent?.trim()) {
      parts.push("");
      parts.push(`\u3010\u521A\u63D0\u4EA4\u7684\u8BC4\u8BBA\u5185\u5BB9\u3011${commentContent.trim()}`);
    }
    parts.push("");
    parts.push("\u8BF7\u7ED3\u5408\u622A\u56FE\u548C\u4EE5\u4E0A\u4FE1\u606F\uFF0C\u5224\u65AD\u8BC4\u8BBA\u63D0\u4EA4\u7ED3\u679C\u5E76\u8FD4\u56DE JSON\u3002");
    return parts.join("\n");
  }
  async function analyzePostSubmitWithScreenshot(params) {
    if (!params.apiKey?.trim()) {
      return { status: "unknown", message: "API Key \u7F3A\u5931" };
    }
    const userContent = [];
    for (const screenshot of params.screenshots) {
      userContent.push({ type: "image_url", image_url: { url: screenshot } });
    }
    userContent.push({
      type: "text",
      text: buildVLVerifyUserPrompt(params.snapshot, params.commentContent)
    });
    const body = JSON.stringify({
      model: currentCaptchaModel,
      messages: [
        { role: "system", content: buildVLVerifySystemPrompt() },
        { role: "user", content: userContent }
      ],
      response_format: { type: "json_object" },
      enable_thinking: thinkingEnabled
    });
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 3e4);
    let response;
    try {
      response = await fetch(DASHSCOPE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`
        },
        body,
        signal: abortController.signal
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e?.name === "AbortError") {
        return { status: "unknown", message: "VL \u5206\u6790\u8D85\u65F6\uFF0830s\uFF09" };
      }
      return { status: "unknown", message: "\u7F51\u7EDC\u9519\u8BEF" };
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      return { status: "unknown", message: "VL \u6A21\u578B\u670D\u52A1\u5F02\u5E38" };
    }
    try {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { status: "unknown", message: "VL \u8FD4\u56DE\u4E3A\u7A7A" };
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const result = JSON.parse(cleaned);
      const validStatuses = ["success", "error", "confirmation_page", "unknown"];
      if (!validStatuses.includes(result.status)) {
        return { status: "unknown", message: "VL \u8FD4\u56DE\u65E0\u6548\u72B6\u6001" };
      }
      return result;
    } catch {
      return { status: "unknown", message: "VL \u8FD4\u56DE\u89E3\u6790\u5931\u8D25" };
    }
  }

  // src/background.ts
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  var MAX_SCREENSHOT_BYTES = 512e3;
  async function captureScreenshot(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const windowId = tab.windowId;
      const url = tab.url || "";
      const qualities = [80, 60, 40, 20];
      let screenshot;
      for (const quality of qualities) {
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: "jpeg",
          quality
        });
        const prefixEnd = dataUrl.indexOf(",");
        const base64Data = prefixEnd >= 0 ? dataUrl.substring(prefixEnd + 1) : dataUrl;
        if (base64Data.length <= MAX_SCREENSHOT_BYTES) {
          screenshot = dataUrl;
          break;
        }
        if (quality === qualities[qualities.length - 1]) {
          screenshot = dataUrl;
        }
      }
      if (!screenshot) {
        return { success: false, error: "\u622A\u56FE\u6570\u636E\u4E3A\u7A7A" };
      }
      return {
        success: true,
        screenshot,
        url,
        timestamp: Date.now()
      };
    } catch (e) {
      return { success: false, error: "\u622A\u56FE\u5931\u8D25: " + (e?.message || e) };
    }
  }
  async function ensureContentScript(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"]
    });
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { action, payload } = message;
    if (action === "snapshot-page") {
      const { tabId } = payload;
      (async () => {
        try {
          await ensureContentScript(tabId);
          const r = await chrome.tabs.sendMessage(tabId, {
            action: "snapshot-page",
            payload: {}
          });
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "\u9875\u9762\u901A\u4FE1\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "ai-analyze") {
      const { snapshot, template, apiKey, screenshots } = payload;
      (async () => {
        try {
          const r = await analyzePageAndPlan(snapshot, template, apiKey, screenshots);
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "AI\u5206\u6790\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "execute-actions") {
      const { tabId, actions } = payload;
      (async () => {
        try {
          await ensureContentScript(tabId);
          const r = await chrome.tabs.sendMessage(tabId, {
            action: "execute-actions",
            payload: { actions }
          });
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "\u64CD\u4F5C\u6267\u884C\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "post-submit-analyze") {
      const { snapshot, apiKey, commentContent } = payload;
      (async () => {
        try {
          const r = await analyzePostSubmit(snapshot, apiKey, commentContent);
          sendResponse({ success: true, ...r });
        } catch (e) {
          sendResponse({ success: false, status: "unknown", message: "\u9A8C\u8BC1\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "ai-retry-comment") {
      const { snapshot, template, apiKey, errorMessage, failedComment, attemptNumber, screenshots } = payload;
      (async () => {
        try {
          const r = await retryWithErrorContext(snapshot, template, apiKey, errorMessage, failedComment, attemptNumber, screenshots);
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "\u91CD\u8BD5\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "captcha-recognize") {
      const { imageData, apiKey } = payload;
      (async () => {
        try {
          if (!imageData) {
            sendResponse({ success: false, error: "\u9A8C\u8BC1\u7801\u56FE\u7247\u6570\u636E\u7F3A\u5931" });
            return;
          }
          if (!apiKey) {
            sendResponse({ success: false, error: "API Key \u7F3A\u5931" });
            return;
          }
          const r = await recognizeCaptcha(imageData, apiKey);
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "\u9A8C\u8BC1\u7801\u8BC6\u522B\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "capture-screenshot") {
      const { tabId } = payload;
      (async () => {
        try {
          const r = await captureScreenshot(tabId);
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "\u622A\u56FE\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "scroll-and-capture") {
      const { tabId } = payload;
      (async () => {
        try {
          await ensureContentScript(tabId);
          const scrollResult = await chrome.tabs.sendMessage(tabId, {
            action: "scroll-to-comments",
            payload: {}
          });
          const screenshotResult = await captureScreenshot(tabId);
          if (scrollResult?.previousScrollY !== void 0) {
            await chrome.tabs.sendMessage(tabId, {
              action: "restore-scroll",
              payload: { scrollY: scrollResult.previousScrollY }
            });
          }
          sendResponse({
            screenshot2: screenshotResult.success ? screenshotResult.screenshot : null,
            scrollResult
          });
        } catch (e) {
          sendResponse({ screenshot2: null, scrollResult: null, error: "\u6EDA\u52A8\u622A\u56FE\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "post-submit-analyze-vl") {
      const vlPayload = payload;
      (async () => {
        try {
          const r = await analyzePostSubmitWithScreenshot({
            screenshots: vlPayload.screenshots,
            snapshot: vlPayload.snapshot,
            apiKey: vlPayload.apiKey,
            commentContent: vlPayload.commentContent
          });
          sendResponse({ success: true, ...r });
        } catch (e) {
          sendResponse({ success: false, status: "unknown", message: "VL \u5206\u6790\u5931\u8D25: " + (e?.message || e) });
        }
      })();
      return true;
    }
    if (action === "extract-content") {
      const { tabId } = payload;
      (async () => {
        try {
          await ensureContentScript(tabId);
          const r = await chrome.tabs.sendMessage(tabId, {
            action: "extract-content",
            payload: {}
          });
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "\u65E0\u6CD5\u4E0E\u9875\u9762\u901A\u4FE1\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5" });
        }
      })();
      return true;
    }
    if (action === "generate-comment") {
      const { title, body, template, htmlAllowed, apiKey } = payload;
      (async () => {
        try {
          const r = await generateComment(
            { title, body, template, htmlAllowed },
            apiKey
          );
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "AI\u8BC4\u8BBA\u751F\u6210\u5931\u8D25" });
        }
      })();
      return true;
    }
    if (action === "fill-and-submit") {
      const { tabId, comment, template, formInfo } = payload;
      (async () => {
        try {
          const r = await chrome.tabs.sendMessage(tabId, {
            action: "fill-and-submit",
            payload: { comment, template, formInfo }
          });
          sendResponse(r);
        } catch (e) {
          sendResponse({ success: false, error: "\u65E0\u6CD5\u4E0E\u9875\u9762\u901A\u4FE1\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5" });
        }
      })();
      return true;
    }
  });
})();
