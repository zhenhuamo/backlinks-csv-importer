# 实现计划：验证码自动识别

## 概述

基于需求文档和设计文档，将验证码自动检测、AI 识别和自动填写功能分解为增量式编码任务。每个任务在前一个任务的基础上构建，最终将所有组件串联集成。代码语言为 TypeScript，测试使用 Jest + fast-check。

## 任务

- [x] 1. 扩展类型定义和常量
  - [x] 1.1 在 `src/types.ts` 中新增 `CaptchaInfo` 接口、扩展 `PageSnapshot` 添加可选 `captchaInfo` 字段、在 `MessageAction` 联合类型中添加 `'captcha-recognize'`
    - 定义 `CaptchaInfo` 接口：`imageData: string`、`inputSelector: string`、`type: 'simple_image'`
    - `PageSnapshot` 新增 `captchaInfo?: CaptchaInfo`
    - `MessageAction` 新增 `'captcha-recognize'`
    - _需求: 6.1, 6.2, 6.3, 7.1_

  - [x] 1.2 在 `src/content-script.ts` 顶部新增验证码检测关键词常量和复杂验证码选择器常量
    - `CAPTCHA_IMAGE_KEYWORDS`、`CAPTCHA_INPUT_KEYWORDS`、`COMPLEX_CAPTCHA_SELECTORS`
    - _需求: 1.1, 1.4_

  - [x] 1.3 在 `src/auto-comment.ts` 中新增验证码错误关键词常量 `CAPTCHA_ERROR_KEYWORDS`
    - _需求: 5.1_

- [x] 2. 实现验证码检测器
  - [x] 2.1 在 `src/content-script.ts` 中实现 `detectSimpleCaptcha(): CaptchaInfo | null` 函数
    - 扫描所有 `<img>` 元素，检查属性是否包含 `CAPTCHA_IMAGE_KEYWORDS` 中的关键词（不区分大小写）
    - 定位关联输入框：同一表单内关键词匹配 → 相邻兄弟 → 父元素内
    - 检测复杂验证码（reCAPTCHA/hCaptcha）并仅设置 `hasCaptcha = true`
    - 找不到关联输入框时返回 `null`
    - _需求: 1.1, 1.2, 1.4, 1.5_

  - [ ]* 2.2 编写属性测试：验证码图片关键词检测正确性
    - **Property 1: 验证码图片关键词检测正确性**
    - **验证: 需求 1.1, 1.5**

  - [ ]* 2.3 编写属性测试：验证码关联输入框定位
    - **Property 2: 验证码关联输入框定位**
    - **验证: 需求 1.2**

  - [ ]* 2.4 编写属性测试：简单验证码与复杂验证码独立标记
    - **Property 3: 简单验证码与复杂验证码独立标记**
    - **验证: 需求 1.4, 6.3**

- [x] 3. 实现验证码图片数据提取
  - [x] 3.1 在 `src/content-script.ts` 中实现 `extractCaptchaImageData(imgElement: HTMLImageElement): Promise<string>` 函数
    - 优先级：data URI 直接使用 → 完整/相对 URL（转绝对 URL）→ Canvas base64 → `captureVisibleTab` 截图裁剪
    - 处理跨域 Canvas 污染（SecurityError 回退）
    - 处理图片未加载完成（等待 onload，3 秒超时）
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 修改 `capturePageSnapshot()` 函数，在快照捕获时调用 `detectSimpleCaptcha()` 并将结果填入 `PageSnapshot.captchaInfo`
    - 如果 `detectSimpleCaptcha` 返回非 null，调用 `extractCaptchaImageData` 获取图片数据
    - 注意：`capturePageSnapshot` 需改为 async 函数
    - _需求: 1.3, 2.5, 6.1_

  - [ ]* 3.3 编写属性测试：图片数据提取格式有效性
    - **Property 4: 图片数据提取格式有效性**
    - **验证: 需求 2.1, 2.2, 2.5**

- [x] 4. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 5. 实现验证码识别器
  - [x] 5.1 在 `src/ai-comment-generator.ts` 中实现 `recognizeCaptcha(imageData: string, apiKey: string): Promise<{ success: boolean; text?: string; error?: string }>` 函数
    - 使用 `qwen-vl-plus` 模型，复用现有 `DASHSCOPE_ENDPOINT`（OpenAI 兼容格式）
    - 构建多模态消息（`image_url` + `text` prompt）
    - 结果清洗：去除空格、标点等非验证码字符
    - 错误处理：401 → "API Key 无效"，429 → "API 调用频率超限"，空结果 → 识别失败
    - 导出该函数供 `background.ts` 使用
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.2 编写属性测试：验证码识别结果清洗
    - **Property 5: 验证码识别结果清洗**
    - **验证: 需求 3.3**

  - [ ]* 5.3 编写单元测试：验证码识别器 API 调用和错误处理
    - 测试 API 返回 401/429 时的错误信息
    - 测试 API 返回空结果时的处理
    - 测试正常识别结果的清洗（如 `" A b 3 D "` → `"Ab3D"`）
    - _需求: 3.3, 3.4, 3.5, 3.6_

- [x] 6. 集成 AI Planner 和 Background 消息路由
  - [x] 6.1 修改 `src/ai-comment-generator.ts` 中的 `analyzePageAndPlan()` 函数，在调用 AI 规划前处理验证码
    - 当 `snapshot.captchaInfo?.type === 'simple_image'` 时，先调用 `recognizeCaptcha`
    - 识别成功：在 actions 中插入验证码填写的 `type` 操作，不设置 `hasCaptcha = true`
    - 识别失败：设置 `hasCaptcha = true`，不包含提交按钮点击操作
    - _需求: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 在 `src/background.ts` 中新增 `captcha-recognize` 消息处理分支
    - 接收 `{ imageData, apiKey }` 参数
    - 参数校验：缺少 imageData 或 apiKey 时返回失败响应
    - 调用 `recognizeCaptcha` 并返回结果
    - _需求: 7.1, 7.2, 7.3_

  - [ ]* 6.3 编写属性测试：验证码识别成功时的操作指令完整性
    - **Property 6: 验证码识别成功时的操作指令完整性**
    - **验证: 需求 4.1, 4.2, 4.3**

  - [ ]* 6.4 编写属性测试：验证码识别失败时的回退行为
    - **Property 7: 验证码识别失败时的回退行为**
    - **验证: 需求 4.4**

  - [ ]* 6.5 编写属性测试：captcha-recognize 消息参数校验
    - **Property 9: captcha-recognize 消息参数校验**
    - **验证: 需求 7.3**

- [x] 7. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 8. 实现验证码重试流程
  - [x] 8.1 修改 `src/auto-comment.ts` 中的 `runAutoComment()` 函数，增加验证码错误检测和重试逻辑
    - 在提交后验证循环中，当 `verifyResp.status === 'error'` 且 message 包含 `CAPTCHA_ERROR_KEYWORDS` 中的关键词时，识别为验证码错误
    - 验证码重试独立计数（最多 2 次），与现有评论内容重试（最多 3 次）分开
    - 重试时：重新截取快照 → 重新 AI 分析（含新验证码识别）→ 重新执行操作
    - 达到重试上限时显示"验证码多次识别失败，请手动完成验证码并提交"
    - _需求: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 8.2 编写属性测试：验证码错误信息分类
    - **Property 8: 验证码错误信息分类**
    - **验证: 需求 5.1**

  - [ ]* 8.3 编写单元测试：验证码重试流程
    - 测试验证码错误被正确识别（与评论内容错误区分）
    - 测试重试 2 次后停止并显示手动处理提示
    - _需求: 5.1, 5.2, 5.3, 5.4_

- [x] 9. 端到端集成和构建验证
  - [x] 9.1 更新 `content-script.ts` 中的消息监听器，确保 `snapshot-page` 消息处理支持异步的 `capturePageSnapshot()`
    - 由于 `capturePageSnapshot` 改为 async，需要更新消息监听中的调用方式
    - _需求: 1.3, 2.5_

  - [x] 9.2 验证 esbuild 构建通过，确保新增代码正确打包
    - 确保 `recognizeCaptcha` 的导入导出在 `background.ts` 和 `ai-comment-generator.ts` 之间正确连接
    - 确保类型定义在所有引用文件中一致
    - _需求: 全部_

- [x] 10. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求条款以确保可追溯性
- 属性测试验证设计文档中定义的通用正确性属性
- 单元测试验证具体示例和边界情况
- 项目使用 Jest + fast-check 进行测试，esbuild 进行构建打包
