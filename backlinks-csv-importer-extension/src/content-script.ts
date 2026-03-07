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

import { PageSnapshot, SnapshotElement, AIAction } from './types';

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
 * 捕获页面中所有表单的结构快照
 */
export function capturePageSnapshot(): PageSnapshot {
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

  return { title, bodyExcerpt, forms: formSnapshots, hasCaptcha, htmlAllowed, errorMessages, pageLang };
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
        try {
          const snapshot = capturePageSnapshot();
          sendResponse({ success: true, snapshot });
        } catch (error: any) {
          sendResponse({ success: false, error: `页面快照捕获失败: ${error?.message || error}` });
        }
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
