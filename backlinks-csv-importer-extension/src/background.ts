// Service Worker: opens the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

import type { ScreenshotResult } from './types';
import { generateComment, analyzePageAndPlan, analyzePostSubmit, retryWithErrorContext, recognizeCaptcha, analyzePostSubmitWithScreenshot } from './ai-comment-generator';

const MAX_SCREENSHOT_BYTES = 512000; // 500KB

/**
 * Capture a screenshot of the visible area of the tab.
 * Compresses JPEG quality progressively if the result exceeds 500KB.
 */
export async function captureScreenshot(tabId: number): Promise<ScreenshotResult> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const windowId = tab.windowId;
    const url = tab.url || '';

    const qualities = [80, 60, 40, 20];
    let screenshot: string | undefined;

    for (const quality of qualities) {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'jpeg',
        quality,
      });

      // Check size: strip the data URI prefix to measure raw base64 bytes
      const prefixEnd = dataUrl.indexOf(',');
      const base64Data = prefixEnd >= 0 ? dataUrl.substring(prefixEnd + 1) : dataUrl;

      if (base64Data.length <= MAX_SCREENSHOT_BYTES) {
        screenshot = dataUrl;
        break;
      }

      // On the last quality level, accept whatever we get
      if (quality === qualities[qualities.length - 1]) {
        screenshot = dataUrl;
      }
    }

    if (!screenshot) {
      return { success: false, error: '截图数据为空' };
    }

    return {
      success: true,
      screenshot,
      url,
      timestamp: Date.now(),
    };
  } catch (e: any) {
    return { success: false, error: '截图失败: ' + (e?.message || e) };
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-script.js'],
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { action, payload } = message;

  if (action === 'snapshot-page') {
    const { tabId } = payload as { tabId: number };
    (async () => {
      try {
        await ensureContentScript(tabId);
        const r = await chrome.tabs.sendMessage(tabId, {
          action: 'snapshot-page', payload: {},
        });
        sendResponse(r);
      } catch (e: any) {
        sendResponse({ success: false, error: '页面通信失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  if (action === 'ai-analyze') {
    const { snapshot, template, apiKey, screenshots } = payload as any;
    (async () => {
      try {
        const r = await analyzePageAndPlan(snapshot, template, apiKey, screenshots);
        sendResponse(r);
      } catch (e: any) {
        sendResponse({ success: false, error: 'AI分析失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  // AI 驱动流程：执行操作指令
  if (action === 'execute-actions') {
    const { tabId, actions } = payload as { tabId: number; actions: any[] };
    (async () => {
      try {
        await ensureContentScript(tabId);
        const r = await chrome.tabs.sendMessage(tabId, {
          action: 'execute-actions', payload: { actions },
        });
        sendResponse(r);
      } catch (e: any) {
        sendResponse({ success: false, error: '操作执行失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  // AI 驱动流程：提交后验证页面状态
  if (action === 'post-submit-analyze') {
    const { snapshot, apiKey, commentContent } = payload as { snapshot: any; apiKey: string; commentContent?: string };
    (async () => {
      try {
        const r = await analyzePostSubmit(snapshot, apiKey, commentContent);
        sendResponse({ success: true, ...r });
      } catch (e: any) {
        sendResponse({ success: false, status: 'unknown', message: '验证失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  // AI 驱动流程：提交失败后重试（带错误上下文）
  if (action === 'ai-retry-comment') {
    const { snapshot, template, apiKey, errorMessage, failedComment, attemptNumber, screenshots } = payload as {
      snapshot: any; template: any; apiKey: string;
      errorMessage: string; failedComment: string; attemptNumber: number; screenshots?: string[];
    };
    (async () => {
      try {
        const r = await retryWithErrorContext(snapshot, template, apiKey, errorMessage, failedComment, attemptNumber, screenshots);
        sendResponse(r);
      } catch (e: any) {
        sendResponse({ success: false, error: '重试失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  // 验证码识别
  if (action === 'captcha-recognize') {
    const { imageData, apiKey } = payload as { imageData: string; apiKey: string };
    (async () => {
      try {
        if (!imageData) {
          sendResponse({ success: false, error: '验证码图片数据缺失' });
          return;
        }
        if (!apiKey) {
          sendResponse({ success: false, error: 'API Key 缺失' });
          return;
        }
        const r = await recognizeCaptcha(imageData, apiKey);
        sendResponse(r);
      } catch (e: any) {
        sendResponse({ success: false, error: '验证码识别失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  // 截取当前可见区域截图
  if (action === 'capture-screenshot') {
    const { tabId } = payload as { tabId: number };
    (async () => {
      try {
        const r = await captureScreenshot(tabId);
        sendResponse(r);
      } catch (e: any) {
        sendResponse({ success: false, error: '截图失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  // 滚动到评论区并截图，然后恢复滚动位置
  if (action === 'scroll-and-capture') {
    const { tabId } = payload as { tabId: number };
    (async () => {
      try {
        await ensureContentScript(tabId);
        // 1. 滚动到评论区
        const scrollResult = await chrome.tabs.sendMessage(tabId, {
          action: 'scroll-to-comments', payload: {},
        });
        // 2. 截取评论区截图
        const screenshotResult = await captureScreenshot(tabId);
        // 3. 恢复滚动位置
        if (scrollResult?.previousScrollY !== undefined) {
          await chrome.tabs.sendMessage(tabId, {
            action: 'restore-scroll', payload: { scrollY: scrollResult.previousScrollY },
          });
        }
        sendResponse({
          screenshot2: screenshotResult.success ? screenshotResult.screenshot : null,
          scrollResult,
        });
      } catch (e: any) {
        sendResponse({ screenshot2: null, scrollResult: null, error: '滚动截图失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  // VL 视觉模型分析截图 + DOM 快照
  if (action === 'post-submit-analyze-vl') {
    const vlPayload = payload as { screenshots: string[]; snapshot: any; apiKey: string; commentContent?: string };
    (async () => {
      try {
        const r = await analyzePostSubmitWithScreenshot({
          screenshots: vlPayload.screenshots,
          snapshot: vlPayload.snapshot,
          apiKey: vlPayload.apiKey,
          commentContent: vlPayload.commentContent,
        });
        sendResponse({ success: true, ...r });
      } catch (e: any) {
        sendResponse({ success: false, status: 'unknown', message: 'VL 分析失败: ' + (e?.message || e) });
      }
    })();
    return true;
  }

  if (action === 'extract-content') {
    const { tabId } = payload as { tabId: number };
    (async () => {
      try {
        await ensureContentScript(tabId);
        const r = await chrome.tabs.sendMessage(tabId, {
          action: 'extract-content', payload: {},
        });
        sendResponse(r);
      } catch (e) {
        sendResponse({ success: false, error: '无法与页面通信，请刷新页面后重试' });
      }
    })();
    return true;
  }

  if (action === 'generate-comment') {
    const { title, body, template, htmlAllowed, apiKey } = payload as {
      title: string; body: string;
      template: { name: string; url: string; keyword: string };
      htmlAllowed: boolean; apiKey: string;
    };
    (async () => {
      try {
        const r = await generateComment(
          { title, body, template: template as any, htmlAllowed }, apiKey
        );
        sendResponse(r);
      } catch (e) {
        sendResponse({ success: false, error: 'AI评论生成失败' });
      }
    })();
    return true;
  }

  if (action === 'fill-and-submit') {
    const { tabId, comment, template, formInfo } = payload as {
      tabId: number; comment: string; template: any; formInfo: any;
    };
    (async () => {
      try {
        const r = await chrome.tabs.sendMessage(tabId, {
          action: 'fill-and-submit', payload: { comment, template, formInfo },
        });
        sendResponse(r);
      } catch (e) {
        sendResponse({ success: false, error: '无法与页面通信，请刷新页面后重试' });
      }
    })();
    return true;
  }
});
