# Implementation Plan: 自动评论功能 (Auto Comment)

## Overview

Incrementally implement the auto-comment feature for the Backlinks CSV Importer Chrome Extension. The plan starts with foundational types and manifest changes, builds up the content script DOM operations, AI comment generator, background message relay, orchestrator, and finally the Side Panel UI integration. Each task builds on previous ones, ending with full wiring and integration.

## Tasks

- [x] 1. Add type definitions and update manifest
  - [x] 1.1 Add new type definitions to `src/types.ts`
    - Add `CommentFormType`, `CommentFormInfo`, `ContentExtractionResult`, `GenerateCommentParams`, `GenerateCommentResult`, `FillAndSubmitParams`, `FillAndSubmitResult`, `MessageAction`, and `Message` interfaces/types as specified in the design
    - _Requirements: 1.1, 1.2, 3.1_

  - [x] 1.2 Update `manifest.json` with new permissions
    - Add `"scripting"` and `"activeTab"` to the `permissions` array
    - Preserve existing `"storage"`, `"sidePanel"` permissions and `"<all_urls>"` host_permissions
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement Content Script DOM operations (`src/content-script.ts`)
  - [x] 2.1 Implement `extractTitle` and `extractBody` functions
    - `extractTitle`: prioritize `h1` tag text, fall back to `document.title`
    - `extractBody`: prioritize `article` → `.post-content` → `.entry-content` → `main` → `body`; strip HTML tags; truncate to 2000 chars
    - Export both functions for testability
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.2 Write property test: title extraction priority
    - **Property 4: 文章标题提取优先级**
    - **Validates: Requirements 4.1**

  - [ ]* 2.3 Write property test: body extraction invariants
    - **Property 5: 文章正文提取不变量**
    - **Validates: Requirements 4.3, 4.4**

  - [x] 2.4 Implement `detectCommentForm`, `detectCaptcha`, `detectHtmlAllowed` functions
    - `detectCommentForm`: waterfall detection WordPress → generic → richtext → none; identify all field presence flags
    - `detectCaptcha`: check CAPTCHA CSS classes, iframes, input/label text signals
    - `detectHtmlAllowed`: check page text for HTML-allowed hint strings
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 2.5 Write property test: form detection priority
    - **Property 1: 表单检测优先级**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ]* 2.6 Write property test: CAPTCHA detection accuracy
    - **Property 2: CAPTCHA 检测准确性**
    - **Validates: Requirements 3.6**

  - [ ]* 2.7 Write property test: HTML allowed detection accuracy
    - **Property 3: HTML 允许检测准确性**
    - **Validates: Requirements 3.7**

  - [x] 2.8 Implement `fillForm` and `submitForm` functions
    - `fillForm`: fill comment text into textarea or contenteditable div; fill name/url fields from LinkTemplate; trigger `input` + `change` events on each field; use `innerHTML` for richtext
    - `submitForm`: click submit button only when `hasCaptcha` is false
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2_

  - [ ]* 2.9 Write property test: form fill completeness
    - **Property 10: 表单填充完整性**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.5**

  - [ ]* 2.10 Write property test: event triggering after fill
    - **Property 11: 填充后事件触发**
    - **Validates: Requirements 6.4**

  - [ ]* 2.11 Write property test: CAPTCHA conditional submit
    - **Property 12: CAPTCHA 条件提交**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 2.12 Implement content script message listener
    - Listen for `extract-content` and `fill-and-submit` messages via `chrome.runtime.onMessage`
    - For `extract-content`: call extractTitle, extractBody, detectCommentForm, return `ContentExtractionResult`
    - For `fill-and-submit`: call fillForm, conditionally submitForm, return `FillAndSubmitResult`
    - Send error message "未检测到评论表单" when formType is `none`; "未能提取文章内容" when body is empty
    - _Requirements: 3.5, 4.5, 7.3, 7.4, 9.4_

- [x] 3. Checkpoint - Content Script
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement AI Comment Generator (`src/ai-comment-generator.ts`)
  - [x] 4.1 Implement `buildSystemPrompt` and `buildUserPrompt` functions
    - `buildSystemPrompt(htmlAllowed)`: when `true`, instruct AI to use `<a href="url">keyword</a>` format; when `false`, instruct plain text mention
    - `buildUserPrompt(title, body, template)`: include article title, body excerpt, template name/url/keyword
    - _Requirements: 5.3, 5.4, 5.5_

  - [ ]* 4.2 Write property test: prompt link format consistency
    - **Property 6: Prompt 链接格式与 htmlAllowed 一致性**
    - **Validates: Requirements 5.4, 5.5**

  - [x] 4.3 Implement `generateComment` function
    - Build request body with `model: "qwen-plus"`, messages array (system + user), `Authorization: Bearer {apiKey}` header
    - POST to `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
    - Parse `choices[0].message.content` from response
    - Handle errors: 401 → "API Key 无效，请检查设置", 429 → "API 调用频率超限，请稍后重试", network → "网络错误，请检查网络连接"
    - Return "请先在设置中配置 API Key" when apiKey is empty
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8_

  - [ ]* 4.4 Write property test: API request format correctness
    - **Property 7: API 请求格式正确性**
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 4.5 Write property test: API response parsing
    - **Property 8: API 响应解析**
    - **Validates: Requirements 5.6**

  - [ ]* 4.6 Write property test: API error mapping
    - **Property 9: API 错误映射**
    - **Validates: Requirements 5.7**

- [x] 5. Checkpoint - AI Comment Generator
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Extend Background Script (`src/background.ts`)
  - [x] 6.1 Add message relay and content script injection
    - Add `chrome.runtime.onMessage` listener to handle: `extract-content` (inject content-script via `chrome.scripting.executeScript`, then forward), `generate-comment` (call `generateComment` and return result), `fill-and-submit` (forward to content script via `chrome.tabs.sendMessage`)
    - Relay content script responses back to Side Panel
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [x] 6.2 Add esbuild entry point for content script
    - Update build configuration to bundle `src/content-script.ts` as a separate output file
    - _Requirements: 9.3_

- [x] 7. Implement Auto Comment Orchestrator (`src/auto-comment.ts`)
  - [x] 7.1 Implement `initAutoComment`, `runAutoComment`, `updateStatus`, `getSelectedTemplate`, `loadApiKey`
    - `runAutoComment`: validate preconditions (selected template, API key) → get active tab → send `extract-content` → send `generate-comment` → send `fill-and-submit` → handle result
    - `updateStatus`: update `#auto-comment-status` element text and CSS class (info/success/warning/error)
    - Disable button during execution, re-enable on completion (success, failure, or CAPTCHA)
    - Show progress text: "正在提取文章内容...", "正在生成评论...", "正在填充表单..."
    - Error messages: "请先选择一个外链模板", "请先在设置中配置 API Key", "无法与页面通信，请刷新页面后重试"
    - Success: "评论已提交" (green), CAPTCHA: "检测到验证码，请手动完成验证码并提交" (yellow)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.6, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 7.2 Write property test: button restore after flow
    - **Property 15: 流程完成后按钮恢复**
    - **Validates: Requirements 8.6**

- [x] 8. Implement Side Panel UI (`sidepanel.html`, `sidepanel.css`, `src/sidepanel.ts`)
  - [x] 8.1 Add HTML elements to `sidepanel.html`
    - Add settings button (`#settings-btn`, ⚙️ icon) in toolbar area
    - Add API Key config section (`#api-key-section`): password input + save button, initially hidden
    - Add auto-comment button (`#auto-comment-btn`) in toolbar area
    - Add status display area (`#auto-comment-status`) below the button
    - All UI text in Chinese
    - _Requirements: 2.1, 2.2, 2.3, 8.1, 10.1, 10.2, 10.3_

  - [x] 8.2 Add CSS styles to `sidepanel.css`
    - Style new elements to match existing toolbar visual style (font, color, border-radius, spacing)
    - Status area colors: `.status-success` green, `.status-warning` yellow, `.status-error` red, `.status-info` default
    - _Requirements: 10.2, 10.4, 10.5, 10.6_

  - [x] 8.3 Add API Key settings logic to `src/sidepanel.ts`
    - Toggle `#api-key-section` visibility on settings button click
    - Save API Key to `chrome.storage.local` on save button click; show "保存成功" on success
    - Block save and show "API Key 不能为空" if input is empty/whitespace
    - Load saved API Key on init and populate input
    - _Requirements: 2.2, 2.4, 2.5, 2.6_

  - [ ]* 8.4 Write property test: API Key round-trip
    - **Property 13: API Key 存取往返**
    - **Validates: Requirements 2.4**

  - [ ]* 8.5 Write property test: empty API Key rejection
    - **Property 14: 空 API Key 拒绝**
    - **Validates: Requirements 2.6**

  - [x] 8.6 Wire auto-comment orchestrator into Side Panel init
    - Import and call `initAutoComment()` from the Side Panel `init` function
    - _Requirements: 8.1, 8.2_

- [x] 9. Checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Final wiring and build verification
  - [x] 10.1 Verify esbuild bundles all new modules correctly
    - Ensure `content-script.js`, `background.js`, `sidepanel.js` are all produced by the build
    - Run `npm run build` and verify no errors
    - _Requirements: 1.1, 1.2, 9.3_

  - [x] 10.2 Run full test suite
    - Run `npm test` and ensure all existing 111 tests plus new tests pass
    - _Requirements: all_

- [x] 11. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each property test maps to a specific correctness property from the design document
- All 15 correctness properties have corresponding test sub-tasks
- Test files: `src/__tests__/content-script.test.ts`, `src/__tests__/ai-comment-generator.test.ts`, `src/__tests__/auto-comment.test.ts`
- All UI text must be in Chinese per Requirements 10.1
- TypeScript is the implementation language; esbuild is the bundler
