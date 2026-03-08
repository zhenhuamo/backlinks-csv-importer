# Implementation Plan: 截图 + DOM 快照融合验证

## Overview

将页面截图能力集成到现有的 Step 4 提交后验证循环中，通过 VL 视觉模型分析截图 + DOM 快照来判断评论提交结果，替代现有的纯 DOM 文本验证。实现按模块递增：类型定义 → 截图采集 → 评论区滚动 → VL 分析 → 消息路由 → 验证循环集成 → 降级处理。

## Tasks

- [x] 1. 新增类型定义和消息 action 扩展
  - [x] 1.1 在 `src/types.ts` 中新增 `ScreenshotResult`、`VLVerifyPayload`、`ScrollToCommentsResult` 接口
    - `ScreenshotResult`: `{ success, screenshot?, url?, timestamp?, error? }`
    - `VLVerifyPayload`: `{ screenshots, snapshot, apiKey, commentContent? }`
    - `ScrollToCommentsResult`: `{ success, found, scrolledTo, previousScrollY, error? }`
    - _Requirements: 1.1, 1.4, 2.1, 3.1_
  - [x] 1.2 扩展 `MessageAction` 类型，新增 `'capture-screenshot' | 'scroll-to-comments' | 'restore-scroll' | 'post-submit-analyze-vl'`
    - _Requirements: 5.4_

- [x] 2. 实现 ScreenshotCapturer（Background Worker）
  - [x] 2.1 在 `src/background.ts` 中实现 `captureScreenshot(tabId)` 函数
    - 调用 `chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 80 })`
    - 检查 base64 数据大小是否 <= 500KB
    - 超过 500KB 时降低 quality（60 → 40 → 20）重新压缩
    - 返回 `ScreenshotResult`，包含 screenshot、url、timestamp
    - 失败时返回 `{ success: false, error }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2_
  - [ ]* 2.2 Write property test for ScreenshotResult 结构完整性
    - **Property 1: 截图结果结构完整性**
    - 对任意成功的 `ScreenshotResult`（`success === true`），验证 `screenshot` 非空、`url` 非空、`timestamp` 为正整数
    - **Validates: Requirements 1.1, 1.4**
  - [ ]* 2.3 Write property test for 截图大小控制
    - **Property 6: 截图大小控制**
    - 生成随机大小的 base64 数据，验证压缩后大小 <= 500KB（去除 data URI 前缀后）
    - **Validates: Requirements 7.1, 7.2**

- [-] 3. 实现 CommentAreaScroller（Content Script）
  - [x] 3.1 在 `src/content-script.ts` 中实现 `scrollToComments()` 函数
    - 定义 `COMMENT_AREA_SELECTORS` 列表（`#comments`, `.comments`, `#respond`, `.comment-list` 等）
    - 记录当前 `window.scrollY` 位置
    - 遍历选择器查找评论区域，找到则 `scrollIntoView({ behavior: 'instant' })`
    - 未找到则 `window.scrollTo(0, document.body.scrollHeight)` 滚动到底部
    - 等待 500ms 后返回 `ScrollToCommentsResult`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 3.2 在 `src/content-script.ts` 中实现 `restoreScrollPosition(savedPosition)` 函数
    - 调用 `window.scrollTo(0, savedPosition)` 恢复滚动位置
    - _Requirements: 2.4_
  - [x] 3.3 在 Content Script 消息监听器中注册 `scroll-to-comments` 和 `restore-scroll` 消息处理
    - `scroll-to-comments`: 调用 `scrollToComments()` 并返回结果
    - `restore-scroll`: 调用 `restoreScrollPosition(payload.scrollY)` 并返回成功
    - _Requirements: 2.2, 2.4, 5.4_
  - [ ]* 3.4 Write property test for 滚动位置恢复
    - **Property 2: 滚动位置恢复（Round-Trip）**
    - 对任意初始 scrollY 值，执行 scrollToComments() 后再 restoreScrollPosition(scrollY)，最终 scrollY 应等于初始值
    - **Validates: Requirements 2.4**

- [x] 4. Checkpoint - 确保截图采集和滚动模块测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 实现 VLAnalyzer（ai-comment-generator.ts）
  - [x] 5.1 在 `src/ai-comment-generator.ts` 中实现 `buildVLVerifySystemPrompt()` 函数
    - 构建 VL 验证的 system prompt，包含视觉信号关键词：感谢/成功提示、评论列表、表单清空、错误提示、确认页面按钮
    - 明确指示模型优先依据截图视觉信息判断，DOM 快照作为辅助
    - _Requirements: 3.3, 4.4_
  - [x] 5.2 在 `src/ai-comment-generator.ts` 中实现 `buildVLVerifyUserPrompt(snapshot, commentContent)` 函数
    - 将 DOM 快照文本和评论内容组合为 user prompt 的文本部分
    - _Requirements: 3.1, 4.1_
  - [x] 5.3 在 `src/ai-comment-generator.ts` 中实现 `analyzePostSubmitWithScreenshot(params: VLAnalyzeParams)` 函数
    - 使用 `currentCaptchaModel`（VL 模型）
    - 构建多模态消息：`image_url`（1-2 张截图）+ `text`（DOM 快照 + 评论内容）
    - 设置 30s API 超时（`AbortController`）
    - 解析返回的 JSON 为 `PostSubmitResult`
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 7.4_
  - [ ]* 5.4 Write property test for VL Prompt 关键词
    - **Property 3: VL Prompt 包含必要视觉信号关键词且优先截图**
    - 调用 `buildVLVerifySystemPrompt()`，验证文本包含视觉信号关键词和优先截图指令
    - **Validates: Requirements 3.3, 4.4**
  - [ ]* 5.5 Write property test for 双截图消息结构
    - **Property 4: 双截图消息结构正确性**
    - 对包含 2 张截图的输入，验证构建的消息中 `user.content` 包含恰好 2 个 `type: 'image_url'` 条目
    - **Validates: Requirements 3.4**
  - [ ]* 5.6 Write property test for VL 分析结果兼容性
    - **Property 5: VL 分析结果兼容 PostSubmitResult**
    - 模拟 VL API 返回随机有效 JSON，验证 status 为合法枚举值，confirmation_page 时 actions 非空且含 selector
    - **Validates: Requirements 3.5, 4.2**

- [x] 6. 注册消息路由（Background Worker）
  - [x] 6.1 在 `src/background.ts` 中注册 `capture-screenshot` 消息处理器
    - 接收 `{ tabId }`，调用 `captureScreenshot(tabId)`，返回 `ScreenshotResult`
    - _Requirements: 5.2_
  - [x] 6.2 在 `src/background.ts` 中注册 `scroll-and-capture` 消息处理器
    - 发送 `scroll-to-comments` 到 Content Script → 等待滚动完成 → 调用 `captureScreenshot(tabId)` → 发送 `restore-scroll` 恢复位置
    - 返回 `{ screenshot2: base64, scrollResult }`
    - _Requirements: 2.2, 5.2, 5.3_
  - [x] 6.3 在 `src/background.ts` 中注册 `post-submit-analyze-vl` 消息处理器
    - 接收 `VLVerifyPayload`，调用 `analyzePostSubmitWithScreenshot()`，返回 `PostSubmitResult`
    - _Requirements: 5.3_
  - [ ]* 6.4 Write unit tests for 消息路由
    - 验证 `capture-screenshot`、`scroll-and-capture`、`post-submit-analyze-vl` 消息正确路由到对应处理函数
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 7. Checkpoint - 确保所有模块和消息路由测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 集成到 Step 4 验证循环（auto-comment.ts）
  - [x] 8.1 在 `src/auto-comment.ts` 中实现 `captureAndVerify(tabId, apiKey, commentContent)` 函数
    - 设置 15s 总超时 deadline
    - 截取首屏截图（`capture-screenshot`）
    - 滚动到评论区 + 截取第二张截图（`scroll-and-capture`）
    - 采集 DOM 快照（`snapshot-page`）
    - 检查是否超时，超时则降级
    - 调用 VL 分析（`post-submit-analyze-vl`）或降级到纯 DOM 分析（`post-submit-analyze`）
    - 返回 `{ success, status, actions, message }`
    - _Requirements: 4.1, 4.3, 6.1, 7.3_
  - [x] 8.2 修改 Step 4 验证循环，将现有的 `snapshot-page` + `post-submit-analyze` 调用替换为 `captureAndVerify()`
    - 保持现有的最大 5 轮循环、确认页处理、`isCommentVisibleOnPage` 兜底检查
    - 确认页提交后重新调用 `captureAndVerify()` 进行验证
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 8.3 Write unit tests for 验证循环集成
    - 测试截图成功路径：验证调用 VL 分析
    - 测试截图失败降级：验证回退到纯 DOM 快照验证
    - 测试 15s 超时降级：验证超时后回退
    - 测试 confirmation_page 处理：验证执行 actions 后继续循环
    - 测试 unknown 状态兜底：验证 `isCommentVisibleOnPage` 仍被调用
    - _Requirements: 4.3, 6.1, 6.2, 6.3, 6.4, 6.5, 7.3_

- [x] 9. 检查 manifest.json 权限
  - [x] 9.1 检查 `manifest.json` 中是否需要新增截图权限
    - `chrome.tabs.captureVisibleTab()` 需要 `activeTab` 权限（已存在）
    - 如果需要额外权限则添加，否则无需修改
    - _Requirements: 5.1_

- [x] 10. Final checkpoint - 确保所有测试通过，完整流程验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- 所有 Chrome API 在测试中使用 mock/stub 替代
- 降级策略贯穿整个实现：截图失败 → 纯 DOM 快照验证（现有 `analyzePostSubmit`）
