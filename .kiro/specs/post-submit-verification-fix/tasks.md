# 实施计划

- [x] 1. 编写缺陷条件探索性测试
  - **Property 1: Fault Condition** - 评论已可见时 analyzePostSubmit 返回 unknown/error 导致验证失败
  - **重要**: 此属性测试必须在实施修复之前编写
  - **目标**: 通过反例证明缺陷存在
  - **范围化 PBT 方法**: 针对具体故障场景 — 当 `verifySnapshot.bodyExcerpt` 包含 `lastComment` 但 `analyzePostSubmit` 返回 `unknown` 或 `error` 时，验证循环未能识别成功
  - 使用 fast-check 生成随机评论内容和包含该评论的页面快照
  - 模拟 `analyzePostSubmit` 返回 `unknown` 状态，验证当前代码中验证循环直接 break 且 `finalSuccess` 为 false（缺陷行为）
  - 模拟 `analyzePostSubmit` 返回 `error` 状态，验证当前代码在评论已可见时仍触发重试逻辑（缺陷行为）
  - 测试断言应匹配设计文档中的期望行为：当 `isBugCondition(input)` 为 true 时，修复后应 `finalSuccess = true` 且不触发重试
  - 在未修复代码上运行测试
  - **预期结果**: 测试失败（这是正确的 — 证明缺陷存在）
  - 记录发现的反例以理解根本原因
  - 当测试编写完成、运行并记录失败后，标记任务完成
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. 编写保持性属性测试（在实施修复之前）
  - **Property 2: Preservation** - 评论未可见时的错误处理和确认页处理行为保持不变
  - **重要**: 遵循观察优先方法论
  - 观察: 在未修复代码上，当 `analyzePostSubmit` 返回 `confirmation_page` 且包含 actions 时，系统执行确认按钮点击（`execute-actions`）并 continue 循环
  - 观察: 在未修复代码上，当 `analyzePostSubmit` 返回 `error` 且评论不在页面中时，系统触发 `ai-retry-comment` 重试逻辑（在 `retryCount < MAX_RETRIES` 时）
  - 观察: 在未修复代码上，当重试次数超过 `MAX_RETRIES` 时，系统显示失败信息并 return
  - 观察: 在未修复代码上，当 `hasCaptcha` 为 true 时，最终显示验证码提示
  - 使用 fast-check 生成属性测试:
    - 对于所有 `confirmation_page` 状态 + 非空 actions 的输入，系统发送 `execute-actions` 消息
    - 对于所有 `error` 状态 + 评论不在 bodyExcerpt 中的输入，系统触发重试（retryCount < MAX_RETRIES 时）
    - 对于所有超过 MAX_RETRIES 的 `error` 输入，系统显示失败并停止
  - 在未修复代码上运行测试
  - **预期结果**: 测试通过（确认基线行为已被捕获）
  - 当测试编写完成、运行并在未修复代码上通过后，标记任务完成
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 修复提交后验证逻辑

  - [x] 3.1 修改 `analyzePostSubmit` 函数签名和 AI 提示词
    - 在 `ai-comment-generator.ts` 中为 `analyzePostSubmit` 增加可选参数 `commentContent?: string`
    - 增强 AI 系统提示词：添加在页面正文中搜索原始评论内容的规则，添加多种成功信号识别指导（表单清空、感谢信息、评论出现在列表中、URL 变化、待审核提示等），添加不同网站行为差异说明
    - 增强 AI 用户提示词：当 `commentContent` 存在时，在用户提示词中包含原始评论内容，标注为【刚提交的评论内容】
    - _Bug_Condition: isBugCondition(input) where commentVisibleOnPage AND verifyStatus IN ['unknown', 'error']_
    - _Expected_Behavior: AI 能够通过在 bodyExcerpt 中匹配评论内容来正确返回 success_
    - _Preservation: confirmation_page 和真正 error 的识别逻辑不受影响_
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 3.2 更新 `background.ts` 消息处理器
    - 在 `post-submit-analyze` 处理器中从 payload 解构 `commentContent` 字段
    - 将 `commentContent` 传递给 `analyzePostSubmit` 函数调用
    - _Bug_Condition: 消息链路缺少评论内容传递_
    - _Expected_Behavior: commentContent 从 payload 正确传递到 analyzePostSubmit_
    - _Preservation: 其他消息处理器不受影响_
    - _Requirements: 2.1_

  - [x] 3.3 改进 `auto-comment.ts` 验证循环逻辑
    - 在 `post-submit-analyze` 消息 payload 中添加 `commentContent: lastComment`
    - 改进 `unknown` 状态处理：不触发重试，检查 `verifySnapshot.bodyExcerpt` 是否包含 `lastComment`（不区分大小写），如果评论可见则设置 `finalSuccess = true`，否则显示更积极的提示
    - 在 `error` 分支进入重试前，增加评论可见性安全网：检查 `verifySnapshot.bodyExcerpt` 是否包含 `lastComment`，如果评论已可见则判定为成功并 break
    - _Bug_Condition: unknown 状态直接 break 且 error 状态不检查评论可见性_
    - _Expected_Behavior: 评论可见时 finalSuccess = true，不触发重试_
    - _Preservation: confirmation_page 处理、captcha 提示、MAX_RETRIES 限制不受影响_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 验证缺陷条件探索性测试现在通过
    - **Property 1: Expected Behavior** - 评论已可见时应识别为成功
    - **重要**: 重新运行任务 1 中的同一测试 — 不要编写新测试
    - 任务 1 的测试编码了期望行为
    - 当此测试通过时，确认期望行为已满足
    - 运行任务 1 中的缺陷条件探索性测试
    - **预期结果**: 测试通过（确认缺陷已修复）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 验证保持性测试仍然通过
    - **Property 2: Preservation** - 评论未可见时的错误处理行为保持不变
    - **重要**: 重新运行任务 2 中的同一测试 — 不要编写新测试
    - 运行任务 2 中的保持性属性测试
    - **预期结果**: 测试通过（确认无回归）
    - 确认修复后所有测试仍然通过（无回归）

- [x] 4. 检查点 - 确保所有测试通过
  - 运行完整测试套件，确保所有测试通过
  - 如有问题，询问用户
