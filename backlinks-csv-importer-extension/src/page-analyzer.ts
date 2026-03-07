import type { AnalysisResult } from './types';

/** 评论表单正向信号 CSS 选择器 */
export const COMMENT_FORM_SELECTORS = [
  'form textarea',    // textarea + form 组合
  '#commentform',     // WordPress 评论表单
  '#disqus_thread',   // Disqus 评论系统
];

/** 免登录评论输入框关键词（匹配 input 的 name 或 id 属性，不区分大小写） */
export const AUTHOR_INPUT_PATTERNS = ['author', 'email', 'url', 'website'];

/** 登录拦截信号文本（不区分大小写） */
export const LOGIN_BARRIER_TEXTS = [
  'log in to comment',
  'sign in to comment',
  '登录后评论',
  '请先登录',
];

/** 登录重定向路径模式 */
export const LOGIN_REDIRECT_PATTERNS = ['/login', '/signin', '/auth'];

/**
 * 解析 HTML 文本，检测评论表单特征（纯函数）
 * - 使用 DOMParser 解析 HTML
 * - 检测 textarea+form、WordPress commentform、Disqus
 * - 检测 author/email/url/website 输入框
 * - 检测登录拦截文本
 */
export function analyzeHtml(html: string): { hasCommentForm: boolean; hasLoginBarrier: boolean } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 检测评论表单正向信号
  const hasCommentForm = detectCommentForm(doc);

  // 检测登录拦截信号
  const hasLoginBarrier = detectLoginBarrier(doc);

  return { hasCommentForm, hasLoginBarrier };
}

/**
 * 检测评论表单正向信号
 */
function detectCommentForm(doc: Document): boolean {
  // 检查 CSS 选择器匹配
  for (const selector of COMMENT_FORM_SELECTORS) {
    if (doc.querySelector(selector)) {
      return true;
    }
  }

  // 检查 input 元素的 name 或 id 属性是否包含关键词
  const inputs = doc.querySelectorAll('input');
  for (const input of inputs) {
    const name = (input.getAttribute('name') || '').toLowerCase();
    const id = (input.getAttribute('id') || '').toLowerCase();
    for (const pattern of AUTHOR_INPUT_PATTERNS) {
      if (name.includes(pattern) || id.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检测登录拦截信号（不区分大小写文本匹配）
 */
function detectLoginBarrier(doc: Document): boolean {
  const textContent = (doc.body?.textContent || '').toLowerCase();
  return LOGIN_BARRIER_TEXTS.some(text => textContent.includes(text.toLowerCase()));
}

/**
 * 抓取页面 HTML 并分析评论表单特征
 * - 使用 fetch API，redirect: "manual" 捕获重定向
 * - 超时由调用方（Rate Limiter）通过 AbortController 控制
 * - 返回原始分析信号，不做最终状态判定
 */
export async function fetchAndAnalyze(url: string, signal?: AbortSignal): Promise<AnalysisResult> {
  try {
    const response = await fetch(url, { redirect: 'manual', signal });

    // 3xx 重定向：检查是否重定向到登录页
    if (response.status >= 300 && response.status < 400) {
      const location = (response.headers.get('Location') || '').toLowerCase();
      const redirectedToLogin = LOGIN_REDIRECT_PATTERNS.some(pattern => location.includes(pattern));
      return {
        url,
        hasCommentForm: false,
        hasLoginBarrier: false,
        fetchError: false,
        redirectedToLogin,
      };
    }

    // 4xx/5xx 错误
    if (response.status >= 400) {
      return {
        url,
        hasCommentForm: false,
        hasLoginBarrier: false,
        fetchError: true,
        redirectedToLogin: false,
      };
    }

    // 2xx 成功：解析 HTML
    const html = await response.text();
    const { hasCommentForm, hasLoginBarrier } = analyzeHtml(html);
    return {
      url,
      hasCommentForm,
      hasLoginBarrier,
      fetchError: false,
      redirectedToLogin: false,
    };
  } catch {
    // 网络错误、abort 等
    return {
      url,
      hasCommentForm: false,
      hasLoginBarrier: false,
      fetchError: true,
      redirectedToLogin: false,
    };
  }
}

