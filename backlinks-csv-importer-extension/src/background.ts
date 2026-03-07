// Service Worker: opens the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

import { generateComment, analyzePageAndPlan, analyzePostSubmit, retryWithErrorContext, recognizeCaptcha } from './ai-comment-generator';

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
    const { snapshot, template, apiKey } = payload as any;
    (async () => {
      try {
        const r = await analyzePageAndPlan(snapshot, template, apiKey);
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
    const { snapshot, template, apiKey, errorMessage, failedComment, attemptNumber } = payload as {
      snapshot: any; template: any; apiKey: string;
      errorMessage: string; failedComment: string; attemptNumber: number;
    };
    (async () => {
      try {
        const r = await retryWithErrorContext(snapshot, template, apiKey, errorMessage, failedComment, attemptNumber);
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
