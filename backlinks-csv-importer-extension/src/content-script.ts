/**
 * Content Script — AI 驱动的浏览器自动化
 * 1. 截取页面 DOM 快照供 AI 分析
 * 2. 按 AI 返回的指令逐步执行操作（滚动、输入、点击）
 */

// 防止重复注入：如果已经注入过，跳过
if ((window as any).__autoCommentInjected) {
  // 已注入，不重复注册监听器
} else {
  (window as any).__autoCommentInjected = true;
}

import { PageSnapshot, SnapshotElement, AIAction, CaptchaInfo } from './types';

/** 验证码图片检测关键词 */
const CAPTCHA_IMAGE_KEYWORDS = ['captcha', 'verify', 'verification', 'seccode', '验证码', '認証', 'vcode'];

/** 验证码输入框检测关键词 */
const CAPTCHA_INPUT_KEYWORDS = ['captcha', 'verify', 'verification', 'seccode', '验证码', '認証', 'vcode'];

/** 复杂验证码检测选择器（不尝试自动识别） */
const COMPLEX_CAPTCHA_SELECTORS = ['.g-recaptcha', '[class*="recaptcha"]', '[class*="hcaptcha"]', '[data-sitekey]'];

// ============================================================
// 页面快照：捕获页面结构供 AI 理解
// ============================================================

/**
 * 为元素生成唯一的 CSS 选择器（健壮版，限制递归深度）
 */
function buildSelector(el: Element, depth = 0): string {
  // 防止无限递归
  if (depth > 5 || !el || el === document.documentElement || el === document.body) {
    return el?.tagName?.toLowerCase() || 'body';
  }

  if (el.id) {
    try {
      // 验证 id 选择器能正常工作
      const escaped = `#${CSS.escape(el.id)}`;
      if (document.querySelector(escaped) === el) return escaped;
    } catch { /* fallthrough */ }
  }

  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute('name');
  if (name) {
    try {
      const sel = `${tag}[name="${name.replace(/"/g, '\\"')}"]`;
      if (document.querySelector(sel) === el) return sel;
    } catch { /* fallthrough */ }
  }

  const parent = el.parentElement;
  if (parent && parent !== document.documentElement && parent !== document.body) {
    const parentSel = buildSelector(parent, depth + 1);
    return `${parentSel} > ${tag}:nth-child(${Array.from(parent.children).indexOf(el) + 1})`;
  }

  // 最后兜底：用 nth-child 从 body 开始
  return tag;
}

/**
 * 查找与 input 关联的 label 文本
 */
function findLabel(el: Element, form: Element): string {
  try {
    // 1. for 属性匹配
    const id = el.getAttribute('id');
    if (id) {
      const label = form.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`);
      if (label?.textContent?.trim()) return label.textContent.trim();
    }
    // 2. 父级 label
    const parentLabel = el.closest('label');
    if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();
    // 3. 前面的兄弟元素
    const prev = el.previousElementSibling;
    if (prev && ['LABEL', 'SPAN', 'TD', 'TH', 'DT', 'B', 'STRONG'].includes(prev.tagName)) {
      if (prev.textContent?.trim()) return prev.textContent.trim();
    }
    // 4. 同行 td（表格布局的表单）
    const parentTd = el.closest('td');
    if (parentTd) {
      const prevTd = parentTd.previousElementSibling;
      if (prevTd?.textContent?.trim()) return prevTd.textContent.trim();
    }
    // 5. 同行 tr 中的第一个 td/th
    const parentTr = el.closest('tr');
    if (parentTr) {
      const firstCell = parentTr.querySelector('td, th');
      if (firstCell && firstCell !== el.closest('td') && firstCell.textContent?.trim()) {
        return firstCell.textContent.trim();
      }
    }
  } catch { /* 安全忽略 */ }
  return '';
}

/**
 * 检测页面中的简单图片验证码
 * 返回 { imgElement, inputSelector } 或 null
 */
function detectSimpleCaptcha(): { imgElement: HTMLImageElement; inputSelector: string } | null {
  const imgs = document.querySelectorAll('img');

  for (const img of imgs) {
    // Skip images inside complex captcha containers
    const isInsideComplex = COMPLEX_CAPTCHA_SELECTORS.some(sel => {
      try { return img.closest(sel) !== null; } catch { return false; }
    });
    if (isInsideComplex) continue;

    // Check if any attribute contains a captcha keyword
    const attrs = [
      img.id || '',
      img.getAttribute('name') || '',
      img.className || '',
      img.src || '',
      img.alt || '',
    ];
    const isCaptchaImg = attrs.some(attr =>
      CAPTCHA_IMAGE_KEYWORDS.some(kw => attr.toLowerCase().includes(kw))
    );
    if (!isCaptchaImg) continue;

    // Found a captcha image — now locate the associated text input
    let input: HTMLInputElement | null = null;

    // Strategy 1: Same <form> parent — find input with name/id matching keywords
    const form = img.closest('form');
    if (form) {
      const textInputs = form.querySelectorAll<HTMLInputElement>('input[type="text"]');
      for (const ti of textInputs) {
        const tiAttrs = [(ti.name || ''), (ti.id || '')];
        const matches = tiAttrs.some(a =>
          CAPTCHA_INPUT_KEYWORDS.some(kw => a.toLowerCase().includes(kw))
        );
        if (matches) { input = ti; break; }
      }
    }

    // Strategy 2: Adjacent sibling
    if (!input) {
      const next = img.nextElementSibling;
      if (next && next.tagName === 'INPUT' && (next as HTMLInputElement).type === 'text') {
        input = next as HTMLInputElement;
      }
    }
    if (!input) {
      const prev = img.previousElementSibling;
      if (prev && prev.tagName === 'INPUT' && (prev as HTMLInputElement).type === 'text') {
        input = prev as HTMLInputElement;
      }
    }

    // Strategy 3: Parent element — find any text input within parent
    if (!input && img.parentElement) {
      input = img.parentElement.querySelector<HTMLInputElement>('input[type="text"]');
    }

    if (!input) continue;

    return { imgElement: img as HTMLImageElement, inputSelector: buildSelector(input) };
  }

  return null;
}

/**
 * 提取验证码图片数据
 * 优先使用 src URL，跨域时回退到 Canvas base64，最终回退到截图裁剪
 */
async function extractCaptchaImageData(imgElement: HTMLImageElement): Promise<string> {
  const src = imgElement.src || '';

  // 1. If src is a data URI, use directly
  if (src.startsWith('data:image/')) {
    return src;
  }

  // 2. If src is a URL (absolute or relative), convert to absolute URL and use
  if (src) {
    try {
      const absoluteUrl = new URL(src, window.location.href).href;
      if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
        // Try Canvas approach first for better reliability with multimodal API
        if (imgElement.complete && imgElement.naturalWidth > 0) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(imgElement, 0, 0);
              return canvas.toDataURL('image/png');
            }
          } catch (e) {
            // Canvas tainted by cross-origin — fall through to URL
          }
        }
        return absoluteUrl;
      }
    } catch {
      // Invalid URL — continue to fallback
    }
  }

  // 3. Wait for image to load if not complete (3 second timeout)
  if (!imgElement.complete || imgElement.naturalWidth === 0) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      imgElement.onload = () => { clearTimeout(timeout); resolve(); };
      imgElement.onerror = () => { clearTimeout(timeout); resolve(); };
    });
  }

  // 4. Try Canvas again after waiting
  if (imgElement.complete && imgElement.naturalWidth > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(imgElement, 0, 0);
        return canvas.toDataURL('image/png');
      }
    } catch {
      // Canvas tainted — fall through
    }
  }

  // 5. Final fallback: return the src URL if available, otherwise empty string
  if (src) {
    try {
      return new URL(src, window.location.href).href;
    } catch { /* ignore */ }
  }

  return '';
}


/**
 * 捕获页面中所有表单的结构快照
 */
export async function capturePageSnapshot(): Promise<PageSnapshot> {
  const title = document.querySelector('h1')?.textContent?.trim() || document.title.trim();

  // 检测页面语言
  const pageLang = document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') || '';

  // 提取正文摘要
  let bodyExcerpt = '';
  for (const sel of ['article', '.post-content', '.entry-content', 'main', 'body']) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) {
      bodyExcerpt = el.textContent.trim().substring(0, 2000);
      break;
    }
  }

  // 扫描所有表单
  const formSnapshots: PageSnapshot['forms'] = [];
  const allForms = document.querySelectorAll('form');

  for (const form of allForms) {
    const interactiveEls = form.querySelectorAll(
      'input, textarea, select, button, [contenteditable="true"]'
    );
    if (interactiveEls.length === 0) continue;

    const elements: SnapshotElement[] = [];
    for (const el of interactiveEls) {
      const tag = el.tagName.toLowerCase();
      const inputType = el.getAttribute('type') || undefined;

      // 跳过 hidden 字段
      if (inputType === 'hidden') continue;

      const entry: SnapshotElement = {
        selector: buildSelector(el),
        tag,
        type: inputType,
        name: el.getAttribute('name') || undefined,
        id: el.getAttribute('id') || undefined,
        placeholder: el.getAttribute('placeholder') || undefined,
        label: findLabel(el, form),
        value: (el as HTMLInputElement).value || undefined,
      };

      // button / submit 的可见文本
      if (tag === 'button' || inputType === 'submit') {
        entry.text = el.textContent?.trim() || (el as HTMLInputElement).value || undefined;
      }

      elements.push(entry);
    }

    if (elements.length > 0) {
      formSnapshots.push({
        selector: buildSelector(form),
        elements,
      });
    }
  }

  // 也检查表单外的 contenteditable
  const standaloneEditable = document.querySelector(
    'div[contenteditable="true"]:not(form div[contenteditable="true"])'
  );
  if (standaloneEditable) {
    formSnapshots.push({
      selector: buildSelector(standaloneEditable),
      elements: [{
        selector: buildSelector(standaloneEditable),
        tag: 'div',
        type: 'contenteditable',
        label: '评论内容',
      }],
    });
  }

  // CAPTCHA 检测
  let hasCaptcha = false;
  const captchaSelectors = ['[class*="captcha"]', '[class*="recaptcha"]', '.g-recaptcha'];
  for (const sel of captchaSelectors) {
    if (document.querySelector(sel)) { hasCaptcha = true; break; }
  }
  if (!hasCaptcha) {
    for (const iframe of document.querySelectorAll('iframe')) {
      const src = (iframe.getAttribute('src') || '').toLowerCase();
      if (src.includes('captcha') || src.includes('recaptcha')) { hasCaptcha = true; break; }
    }
  }

  // HTML allowed 检测
  const htmlHints = ['可以使用的 HTML 标签', 'You may use these HTML tags', 'allowed HTML tags'];
  const pageText = document.body?.textContent || '';
  const htmlAllowed = htmlHints.some(h => pageText.includes(h));

  // 提取页面上的错误/警告信息
  const errorMessages: string[] = [];
  const errorSelectors = [
    '.error', '.alert', '.warning', '.notice', '.message',
    '[class*="error"]', '[class*="alert"]', '[class*="warning"]',
    '[role="alert"]', '.flash', '.notification',
  ];
  for (const sel of errorSelectors) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent?.trim();
        if (text && text.length < 500 && text.length > 3) {
          errorMessages.push(text);
        }
      }
    } catch { /* ignore */ }
  }

  // 简单图片验证码检测
  let captchaInfo: CaptchaInfo | undefined;
  try {
    const detected = detectSimpleCaptcha();
    if (detected) {
      const imageData = await extractCaptchaImageData(detected.imgElement);
      if (imageData) {
        captchaInfo = {
          imageData,
          inputSelector: detected.inputSelector,
          type: 'simple_image',
        };
      }
    }
  } catch { /* 安全忽略，不影响主流程 */ }

  return { title, bodyExcerpt, forms: formSnapshots, hasCaptcha, captchaInfo, htmlAllowed, errorMessages, pageLang };
}


// ============================================================
// 模拟人类操作的执行引擎
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

/**
 * 平滑滚动到元素
 */
async function scrollTo(el: Element): Promise<void> {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(800);
}

/**
 * 模拟逐字输入（触发完整的键盘事件链）
 */
async function simulateTyping(el: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
  await scrollTo(el);
  await randomDelay(200, 400);

  // 聚焦
  el.focus();
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  await randomDelay(100, 250);

  // 清空
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));

  // 逐字符
  for (const char of text) {
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: char, bubbles: true, cancelable: true,
    }));
    el.value += char;
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertText', data: char,
    }));
    el.dispatchEvent(new KeyboardEvent('keyup', {
      key: char, bubbles: true, cancelable: true,
    }));

    // 人类打字节奏
    await randomDelay(Math.random() < 0.1 ? 120 : 30, Math.random() < 0.1 ? 300 : 90);
  }

  el.dispatchEvent(new Event('change', { bubbles: true }));
  // 失焦，让表单验证生效
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  await randomDelay(200, 400);
}

/**
 * 模拟对 contenteditable 的输入
 */
async function simulateContentEditableTyping(el: HTMLElement, content: string): Promise<void> {
  await scrollTo(el);
  await randomDelay(200, 400);
  el.focus();
  el.innerHTML = '';
  await randomDelay(100, 200);
  el.innerHTML = content;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  await randomDelay(300, 500);
}

/**
 * 执行 AI 返回的操作指令列表
 */
export async function executeActions(actions: AIAction[]): Promise<{ success: boolean; error?: string }> {
  for (const action of actions) {
    const el = document.querySelector(action.selector);
    if (!el) {
      console.warn(`[auto-comment] 找不到元素: ${action.selector}`);
      continue; // 跳过找不到的元素，继续执行
    }

    switch (action.type) {
      case 'scroll':
        await scrollTo(el);
        await randomDelay(300, 600);
        break;

      case 'type': {
        const value = action.value || '';
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          await simulateTyping(el, value);
        } else if ((el as HTMLElement).isContentEditable) {
          await simulateContentEditableTyping(el as HTMLElement, value);
        }
        await randomDelay(300, 600);
        break;
      }

      case 'click':
        await scrollTo(el);
        await randomDelay(300, 500);
        (el as HTMLElement).click();
        break;
    }
  }

  return { success: true };
}


// ============================================================
// 消息监听器（防止重复注册）
// ============================================================

if (!(window as any).__autoCommentListenerRegistered) {
  (window as any).__autoCommentListenerRegistered = true;

  chrome.runtime.onMessage.addListener(
    (message: { action: string; payload: any }, _sender, sendResponse) => {

      // 截取页面快照
      if (message.action === 'snapshot-page') {
        (async () => {
          try {
            const snapshot = await capturePageSnapshot();
            sendResponse({ success: true, snapshot });
          } catch (error: any) {
            sendResponse({ success: false, error: `页面快照捕获失败: ${error?.message || error}` });
          }
        })();
        return true;
      }

      // 执行 AI 指令
      if (message.action === 'execute-actions') {
        const { actions } = message.payload as { actions: AIAction[] };
        (async () => {
          try {
            const result = await executeActions(actions);
            sendResponse(result);
          } catch (error) {
            sendResponse({ success: false, error: '操作执行失败' });
          }
        })();
        return true;
      }

      return true;
    }
  );
}
