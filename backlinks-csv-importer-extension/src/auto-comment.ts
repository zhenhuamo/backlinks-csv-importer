import { LinkTemplate } from './types';
import { setModel, setCaptchaModel, setThinkingEnabled, DEFAULT_MODEL, DEFAULT_CAPTCHA_MODEL } from './ai-comment-generator';
import { OperationController, CancelledError } from './operation-controller';

/** 验证码错误关键词（用于重试判断） */
const CAPTCHA_ERROR_KEYWORDS = ['验证码', 'captcha', '認証コード', '認証', 'verification code', 'wrong code', 'incorrect code'];

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
  const result = await chrome.storage.local.get(['dashscopeApiKey']) as { dashscopeApiKey?: string };
  return typeof result.dashscopeApiKey === 'string' ? result.dashscopeApiKey : null;
}

/**
 * 从 chrome.storage.local 加载模型设置并应用
 */
export async function loadModelSettings(): Promise<void> {
  const result = await chrome.storage.local.get(['selectedModel', 'selectedCaptchaModel', 'thinkingEnabled']) as {
    selectedModel?: string;
    selectedCaptchaModel?: string;
    thinkingEnabled?: boolean;
  };
  setModel(typeof result.selectedModel === 'string' ? result.selectedModel : DEFAULT_MODEL);
  setCaptchaModel(typeof result.selectedCaptchaModel === 'string' ? result.selectedCaptchaModel : DEFAULT_CAPTCHA_MODEL);
  setThinkingEnabled(result.thinkingEnabled === true);
}

/**
 * 判断错误信息是否为验证码相关错误
 */
function isCaptchaError(message: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return CAPTCHA_ERROR_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

export function actionsAttemptSubmit(actions?: Pick<{ type: string }, 'type'>[]): boolean {
  return Boolean(actions?.some((action) => action.type === 'click'));
}

export function shouldShowManualCaptcha(hasCaptcha?: boolean, actions?: Pick<{ type: string }, 'type'>[]): boolean {
  return Boolean(hasCaptcha) && !actionsAttemptSubmit(actions);
}


/**
 * 截图 + VL 视觉模型验证：截取截图并调用 VL 分析，失败时降级为纯 DOM 快照验证
 * @param tabId 当前标签页 ID
 * @param apiKey DashScope API Key
 * @param commentContent 刚提交的评论内容
 * @returns 验证结果，兼容 PostSubmitResult
 */
async function captureAndVerify(
  tabId: number,
  apiKey: string,
  commentContent: string
): Promise<{ success: boolean; status?: string; actions?: any[]; message?: string }> {
  const deadline = Date.now() + 15000; // 15s 总超时

  const screenshots: string[] = [];

  try {
    // 1. 截取首屏截图
    const screenshot1Resp = await chrome.runtime.sendMessage({
      action: 'capture-screenshot',
      payload: { tabId },
    });
    if (screenshot1Resp?.success && screenshot1Resp.screenshot) {
      screenshots.push(screenshot1Resp.screenshot);
    }

    // 2. 滚动到评论区 + 截取第二张截图
    if (Date.now() < deadline) {
      const scrollCaptureResp = await chrome.runtime.sendMessage({
        action: 'scroll-and-capture',
        payload: { tabId },
      });
      if (scrollCaptureResp?.screenshot2) {
        screenshots.push(scrollCaptureResp.screenshot2);
      }
    }
  } catch {
    // 截图失败，继续降级
  }

  // 3. 采集 DOM 快照
  let verifySnapshot: any = null;
  try {
    const snapResp = await chrome.runtime.sendMessage({
      action: 'snapshot-page',
      payload: { tabId },
    });
    if (snapResp?.success) {
      verifySnapshot = snapResp.snapshot;
    }
  } catch {
    // DOM 快照失败
  }

  if (!verifySnapshot) {
    return { success: false, message: '无法获取页面快照' };
  }

  // 4. 检查是否超时
  if (Date.now() >= deadline || screenshots.length === 0) {
    // 降级为纯 DOM 快照验证
    try {
      const fallbackResp = await chrome.runtime.sendMessage({
        action: 'post-submit-analyze',
        payload: { snapshot: verifySnapshot, apiKey, commentContent },
      });
      return fallbackResp || { success: false, message: '降级验证失败' };
    } catch {
      return { success: false, message: '降级验证失败' };
    }
  }

  // 5. 调用 VL 分析
  try {
    const vlResp = await chrome.runtime.sendMessage({
      action: 'post-submit-analyze-vl',
      payload: { screenshots, snapshot: verifySnapshot, apiKey, commentContent },
    });
    if (vlResp?.success) {
      return vlResp;
    }
    // VL 分析失败，降级
    const fallbackResp = await chrome.runtime.sendMessage({
      action: 'post-submit-analyze',
      payload: { snapshot: verifySnapshot, apiKey, commentContent },
    });
    return fallbackResp || { success: false, message: '验证失败' };
  } catch {
    // VL 失败，降级
    try {
      const fallbackResp = await chrome.runtime.sendMessage({
        action: 'post-submit-analyze',
        payload: { snapshot: verifySnapshot, apiKey, commentContent },
      });
      return fallbackResp || { success: false, message: '验证失败' };
    } catch {
      return { success: false, message: '验证失败' };
    }
  }
}

async function capturePlanningScreenshots(tabId: number): Promise<string[]> {
  const screenshots: string[] = [];

  try {
    const screenshot1Resp = await chrome.runtime.sendMessage({
      action: 'capture-screenshot',
      payload: { tabId },
    });
    if (screenshot1Resp?.success && screenshot1Resp.screenshot) {
      screenshots.push(screenshot1Resp.screenshot);
    }

    const scrollCaptureResp = await chrome.runtime.sendMessage({
      action: 'scroll-and-capture',
      payload: { tabId },
    });
    if (scrollCaptureResp?.screenshot2) {
      screenshots.push(scrollCaptureResp.screenshot2);
    }
  } catch {
    return screenshots;
  }

  return screenshots;
}

/**
 * AI 驱动的自动评论流程：
 * 1. 截取页面快照
 * 2. AI 分析页面 + 生成评论 + 规划操作
 * 3. 按 AI 指令逐步执行（滚动、输入、点击）
 */
export async function runAutoComment(controller?: OperationController): Promise<void> {
  const btn = document.getElementById('auto-comment-btn') as HTMLButtonElement;

  // 跟踪表单是否已提交（用于取消时的特殊警告）
  let formSubmitted = false;

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

    // 加载用户选择的模型设置
    await loadModelSettings();

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

    // 取消检查点：Step 1（截取快照）之后
    controller?.throwIfCancelled();

    if (!snapshot.forms || snapshot.forms.length === 0) {
      updateStatus('未在页面中检测到评论表单', 'error');
      return;
    }

    updateStatus('正在采集页面视觉线索...', 'info');
    const planningScreenshots = await capturePlanningScreenshots(tabId);

    // Step 2: AI 分析 + 生成评论 + 规划操作
    updateStatus('AI 正在理解页面并生成评论...', 'info');
    const analyzeResp = await chrome.runtime.sendMessage({
      action: 'ai-analyze',
      payload: { snapshot, template, apiKey, screenshots: planningScreenshots },
    });
    if (!analyzeResp?.success) {
      updateStatus(analyzeResp?.error || 'AI 分析失败', 'error');
      return;
    }

    const { actions, hasCaptcha } = analyzeResp;

    // 取消检查点：Step 2（AI 分析）之后
    controller?.throwIfCancelled();

    if (!actions || actions.length === 0) {
      updateStatus('AI 未能规划操作指令，请重试', 'error');
      return;
    }

    // 取消检查点：Step 3（执行操作）之前
    controller?.throwIfCancelled();

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

    // 仅当本轮动作包含点击提交时，才标记已尝试提交
    formSubmitted = actionsAttemptSubmit(actions);

    // Step 4: 提交后验证 + 自动纠错循环（最多 5 轮：确认页 + 重试）
    let finalSuccess = false;
    let finalCaptcha = shouldShowManualCaptcha(hasCaptcha, actions);
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let captchaRetryCount = 0;
    const MAX_CAPTCHA_RETRIES = 2;
    let lastComment = analyzeResp.comment || '';

    for (let round = 0; round < 5; round++) {
      // 取消检查点：Step 4（验证循环）每轮开始时
      controller?.throwIfCancelled();

      // 等待页面加载/跳转（5秒，给慢速网站足够的刷新时间）
      updateStatus('等待页面响应...', 'info');
      await new Promise(r => setTimeout(r, 5000));

      // 使用截图 + VL 视觉模型验证（失败时自动降级为纯 DOM 快照验证）
      updateStatus('正在截图并验证提交结果...', 'info');
      const verifyResp = await captureAndVerify(tabId, apiKey, lastComment);

      if (!verifyResp?.success) break;

      if (verifyResp.status === 'success') {
        finalSuccess = true;
        finalCaptcha = false;
        break;
      }

      // 确认页处理（优先于可见性检查，因为确认页上的评论预览不等于已发布）
      if (verifyResp.status === 'confirmation_page' && (verifyResp.actions?.length ?? 0) > 0) {
        updateStatus('检测到确认页面，正在点击提交...', 'info');
        const confirmResp = await chrome.runtime.sendMessage({
          action: 'execute-actions',
          payload: { tabId, actions: verifyResp.actions },
        });
        if (!confirmResp?.success) {
          updateStatus('确认提交失败', 'error');
          return;
        }
        formSubmitted = actionsAttemptSubmit(verifyResp.actions);
        finalCaptcha = false;
        continue;
      }

      // 评论可见性安全网：仅在 unknown 状态时检查（AI 无法确定时用可见性兜底）
      if (verifyResp.status === 'unknown') {
        // 获取 DOM 快照用于可见性检查
        let bodyExcerpt = '';
        try {
          const snapResp = await chrome.runtime.sendMessage({
            action: 'snapshot-page',
            payload: { tabId },
          });
          if (snapResp?.success) {
            bodyExcerpt = snapResp.snapshot?.bodyExcerpt || '';
          }
        } catch { /* ignore */ }

        if (lastComment && bodyExcerpt &&
            isCommentVisibleOnPage(bodyExcerpt, lastComment)) {
          finalSuccess = true;
          break;
        }
        // unknown + 评论不可见：break，显示模糊提示
        break;
      }

      if (verifyResp.status === 'error') {
        const errMsg = verifyResp.message || '未知错误';
        
        // 验证码错误：独立重试逻辑
        if (isCaptchaError(errMsg)) {
          if (captchaRetryCount < MAX_CAPTCHA_RETRIES) {
            captchaRetryCount++;
            updateStatus(`验证码识别错误，正在重新获取验证码并重试（${captchaRetryCount}/${MAX_CAPTCHA_RETRIES}）...`, 'info');

            // 重新截取快照（获取刷新后的新验证码图片）
            const captchaSnapResp = await chrome.runtime.sendMessage({
              action: 'snapshot-page',
              payload: { tabId },
            });
            if (!captchaSnapResp?.success) {
              updateStatus('验证码重试失败: 无法获取页面快照', 'error');
              return;
            }

            // 重新 AI 分析（含新验证码识别）
            const captchaRetryScreenshots = await capturePlanningScreenshots(tabId);
            const captchaRetryAnalyze = await chrome.runtime.sendMessage({
              action: 'ai-analyze',
              payload: { snapshot: captchaSnapResp.snapshot, template, apiKey, screenshots: captchaRetryScreenshots },
            });
            if (!captchaRetryAnalyze?.success || !captchaRetryAnalyze.actions?.length) {
              updateStatus('验证码重试失败: AI 分析失败', 'error');
              return;
            }

            lastComment = captchaRetryAnalyze.comment || lastComment;
            finalCaptcha = shouldShowManualCaptcha(captchaRetryAnalyze.hasCaptcha, captchaRetryAnalyze.actions);

            updateStatus(`正在重新填写验证码并提交（第 ${captchaRetryCount} 次重试）...`, 'info');
            const captchaRetryExec = await chrome.runtime.sendMessage({
              action: 'execute-actions',
              payload: { tabId, actions: captchaRetryAnalyze.actions },
            });
            if (!captchaRetryExec?.success) {
              updateStatus('验证码重试执行失败', 'error');
              return;
            }
            formSubmitted = actionsAttemptSubmit(captchaRetryAnalyze.actions);
            continue;
          }
          
          // 验证码重试次数用完
          finalCaptcha = true;
          updateStatus('验证码多次识别失败，请手动完成验证码并提交', 'warning');
          return;
        }

        // 非验证码错误：使用现有的评论内容重试逻辑
        if (retryCount < MAX_RETRIES) {
          retryCount++;
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
          const retryScreenshots = await capturePlanningScreenshots(tabId);
          const retryAnalyze = await chrome.runtime.sendMessage({
            action: 'ai-retry-comment',
            payload: {
              snapshot: retrySnapResp.snapshot,
              template,
              apiKey,
              errorMessage: errMsg,
              failedComment: lastComment,
              attemptNumber: retryCount,
              screenshots: retryScreenshots,
            },
          });
          if (!retryAnalyze?.success || !retryAnalyze.actions?.length) {
            updateStatus('提交失败: ' + errMsg, 'error');
            return;
          }

          lastComment = retryAnalyze.comment || lastComment;
          finalCaptcha = shouldShowManualCaptcha(retryAnalyze.hasCaptcha, retryAnalyze.actions);

          updateStatus(`正在重新填写并提交（第 ${retryCount} 次重试）...`, 'info');
          const retryExec = await chrome.runtime.sendMessage({
            action: 'execute-actions',
            payload: { tabId, actions: retryAnalyze.actions },
          });
          if (!retryExec?.success) {
            updateStatus('重试执行失败', 'error');
            return;
          }
          formSubmitted = actionsAttemptSubmit(retryAnalyze.actions);
          continue;
        }

        updateStatus('多次重试后仍失败: ' + (verifyResp.message || '页面报错'), 'error');
        return;
      }

      break;
    }

    if (finalSuccess) {
      updateStatus('评论已成功发布 ✓', 'success');
    } else if (finalCaptcha) {
      updateStatus('检测到需要人工处理的验证码，请完成后再提交', 'warning');
    } else {
      updateStatus('操作已完成，请检查页面确认评论是否发布成功', 'warning');
    }
  } catch (error: any) {
    if (error instanceof CancelledError) {
      if (formSubmitted) {
        updateStatus('评论可能已提交，请检查页面确认', 'warning');
      } else {
        updateStatus('评论操作已取消', 'info');
      }
    } else {
      updateStatus(`出错: ${error?.message || error}`, 'error');
    }
  } finally {
    btn.disabled = false;
  }
}

/**
 * 初始化自动评论模块
 * 注意：按钮事件绑定已移至 sidepanel.ts 中统一管理（支持取消控制）
 */
export function initAutoComment(): void {
  // Button click binding is now handled in sidepanel.ts
  // to integrate with OperationController for cancel support
}
