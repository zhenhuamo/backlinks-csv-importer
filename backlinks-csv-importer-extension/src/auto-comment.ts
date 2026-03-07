import { LinkTemplate } from './types';

/**
 * 更新 Side Panel 状态区域文本和样式
 */
export function updateStatus(text: string, type: 'info' | 'success' | 'warning' | 'error'): void {
  const el = document.getElementById('auto-comment-status');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('status-info', 'status-success', 'status-warning', 'status-error');
  el.classList.add(`status-${type}`);
  el.hidden = false;
}
/**
 * 检查评论内容是否在页面正文中可见（不区分大小写的子串匹配）
 */
export function isCommentVisibleOnPage(bodyExcerpt: string, comment: string): boolean {
  if (!comment || comment.trim().length === 0) return false;
  if (!bodyExcerpt) return false;
  return bodyExcerpt.toLowerCase().includes(comment.toLowerCase());
}


/**
 * 获取当前选中的 LinkTemplate
 */
export async function getSelectedTemplate(): Promise<LinkTemplate | null> {
  const select = document.getElementById('template-select') as HTMLSelectElement;
  if (!select || !select.value) return null;
  const { loadTemplates } = await import('./link-template-storage');
  const templates = await loadTemplates();
  return templates.find(t => t.id === select.value) || null;
}

/**
 * 从 chrome.storage.local 加载 API Key
 */
export async function loadApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(['dashscopeApiKey']);
  return result.dashscopeApiKey || null;
}

/**
 * AI 驱动的自动评论流程：
 * 1. 截取页面快照
 * 2. AI 分析页面 + 生成评论 + 规划操作
 * 3. 按 AI 指令逐步执行（滚动、输入、点击）
 */
async function runAutoComment(): Promise<void> {
  const btn = document.getElementById('auto-comment-btn') as HTMLButtonElement;

  try {
    // 验证前置条件
    const template = await getSelectedTemplate();
    if (!template) {
      updateStatus('请先选择一个外链模板', 'error');
      return;
    }

    const apiKey = await loadApiKey();
    if (!apiKey) {
      updateStatus('请先在设置中配置 API Key', 'error');
      return;
    }

    btn.disabled = true;

    // 获取当前标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) {
      updateStatus('无法获取当前标签页', 'error');
      return;
    }

    // Step 1: 截取页面快照
    updateStatus('正在分析页面结构...', 'info');
    let snapshotResp: any;
    try {
      snapshotResp = await chrome.runtime.sendMessage({
        action: 'snapshot-page',
        payload: { tabId },
      });
    } catch (e: any) {
      updateStatus(`页面通信失败: ${e?.message || e}`, 'error');
      return;
    }
    if (!snapshotResp) {
      updateStatus('未收到页面响应，请刷新扩展后重试（chrome://extensions 点击刷新）', 'error');
      return;
    }
    if (!snapshotResp.success) {
      updateStatus(snapshotResp.error || '页面分析失败（未知原因）', 'error');
      return;
    }

    const { snapshot } = snapshotResp;

    if (!snapshot.forms || snapshot.forms.length === 0) {
      updateStatus('未在页面中检测到评论表单', 'error');
      return;
    }

    // Step 2: AI 分析 + 生成评论 + 规划操作
    updateStatus('AI 正在理解页面并生成评论...', 'info');
    const analyzeResp = await chrome.runtime.sendMessage({
      action: 'ai-analyze',
      payload: { snapshot, template, apiKey },
    });
    if (!analyzeResp?.success) {
      updateStatus(analyzeResp?.error || 'AI 分析失败', 'error');
      return;
    }

    const { actions, hasCaptcha } = analyzeResp;

    if (!actions || actions.length === 0) {
      updateStatus('AI 未能规划操作指令，请重试', 'error');
      return;
    }

    // Step 3: 执行操作指令（模拟人类操作）
    updateStatus('正在模拟人类操作（请勿切换标签页）...', 'info');
    const execResp = await chrome.runtime.sendMessage({
      action: 'execute-actions',
      payload: { tabId, actions },
    });

    if (!execResp?.success) {
      updateStatus(execResp?.error || '操作执行失败', 'error');
      return;
    }

    // Step 4: 提交后验证 + 自动纠错循环（最多 5 轮：确认页 + 重试）
    let finalSuccess = false;
    let finalCaptcha = hasCaptcha;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let lastComment = analyzeResp.comment || '';

    for (let round = 0; round < 5; round++) {
      // 等待页面加载/跳转
      updateStatus('等待页面响应...', 'info');
      await new Promise(r => setTimeout(r, 3000));

      // 重新截取快照
      let verifySnapshot: any;
      try {
        const snapResp = await chrome.runtime.sendMessage({
          action: 'snapshot-page',
          payload: { tabId },
        });
        if (!snapResp?.success) break;
        verifySnapshot = snapResp.snapshot;
      } catch {
        break;
      }

      // AI 分析提交后的页面状态
      updateStatus('正在验证提交结果...', 'info');
      const verifyResp = await chrome.runtime.sendMessage({
        action: 'post-submit-analyze',
        payload: { snapshot: verifySnapshot, apiKey, commentContent: lastComment },
      });

      if (!verifyResp?.success) break;

      if (verifyResp.status === 'success') {
        finalSuccess = true;
        break;
      }

      // 确认页处理（优先于可见性检查，因为确认页上的评论预览不等于已发布）
      if (verifyResp.status === 'confirmation_page' && verifyResp.actions?.length > 0) {
        updateStatus('检测到确认页面，正在点击提交...', 'info');
        const confirmResp = await chrome.runtime.sendMessage({
          action: 'execute-actions',
          payload: { tabId, actions: verifyResp.actions },
        });
        if (!confirmResp?.success) {
          updateStatus('确认提交失败', 'error');
          return;
        }
        continue;
      }

      // 评论可见性安全网：仅在 unknown 状态时检查（AI 无法确定时用可见性兜底）
      if (verifyResp.status === 'unknown') {
        if (lastComment && verifySnapshot?.bodyExcerpt &&
            isCommentVisibleOnPage(verifySnapshot.bodyExcerpt, lastComment)) {
          finalSuccess = true;
          break;
        }
        // unknown + 评论不可见：break，显示模糊提示
        break;
      }

      if (verifyResp.status === 'error') {
        // 还有重试次数，自动纠错（仅在评论不可见时才到达此处）
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const errMsg = verifyResp.message || '未知错误';
          updateStatus(`提交失败（${errMsg}），正在自动修正并重试（${retryCount}/${MAX_RETRIES}）...`, 'info');

          // 重新截取快照（包含错误信息）
          const retrySnapResp = await chrome.runtime.sendMessage({
            action: 'snapshot-page',
            payload: { tabId },
          });
          if (!retrySnapResp?.success) {
            updateStatus('提交失败: ' + errMsg, 'error');
            return;
          }

          // 用带错误上下文的重试接口，让 AI 理解问题并修正
          const retryAnalyze = await chrome.runtime.sendMessage({
            action: 'ai-retry-comment',
            payload: {
              snapshot: retrySnapResp.snapshot,
              template,
              apiKey,
              errorMessage: errMsg,
              failedComment: lastComment,
              attemptNumber: retryCount,
            },
          });
          if (!retryAnalyze?.success || !retryAnalyze.actions?.length) {
            updateStatus('提交失败: ' + errMsg, 'error');
            return;
          }

          lastComment = retryAnalyze.comment || lastComment;

          updateStatus(`正在重新填写并提交（第 ${retryCount} 次重试）...`, 'info');
          const retryExec = await chrome.runtime.sendMessage({
            action: 'execute-actions',
            payload: { tabId, actions: retryAnalyze.actions },
          });
          if (!retryExec?.success) {
            updateStatus('重试执行失败', 'error');
            return;
          }
          continue;
        }

        updateStatus('多次重试后仍失败: ' + (verifyResp.message || '页面报错'), 'error');
        return;
      }

      break;
    }

    if (finalCaptcha) {
      updateStatus('检测到验证码，已填写表单，请手动完成验证码并提交', 'warning');
    } else if (finalSuccess) {
      updateStatus('评论已成功发布 ✓', 'success');
    } else {
      updateStatus('操作已完成，请检查页面确认评论是否发布成功', 'warning');
    }
  } catch (error: any) {
    updateStatus(`出错: ${error?.message || error}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

/**
 * 初始化自动评论模块，绑定按钮事件
 */
export function initAutoComment(): void {
  const btn = document.getElementById('auto-comment-btn');
  if (btn) {
    btn.addEventListener('click', () => { runAutoComment(); });
  }
}
