# 需求文档

## 简介

在自动评论流程中，当页面包含简单的数字/文字图片验证码（非 reCAPTCHA/hCaptcha 等复杂验证码）时，系统应能自动检测验证码图片、利用 AI 多模态视觉能力识别验证码内容、并自动填写验证码字段完成提交，从而减少人工干预，提升自动评论的成功率。

## 术语表

- **Captcha_Detector**：验证码检测模块，负责在页面快照中识别简单图片验证码元素
- **Captcha_Recognizer**：验证码识别模块，负责将验证码图片发送给 AI 多模态 API 进行内容识别
- **Content_Script**：Chrome 扩展的内容脚本，运行在目标网页上下文中，负责 DOM 操作和数据提取
- **AI_Planner**：AI 分析规划模块（即 `analyzePageAndPlan`），负责分析页面结构、生成评论和规划操作指令
- **Background_Service**：Chrome 扩展的后台服务（Service Worker），负责消息路由和 API 调用
- **Simple_Captcha**：简单图片验证码，指由图片展示数字或文字、用户需手动输入的验证码类型（区别于 reCAPTCHA、hCaptcha 等交互式验证码）
- **DashScope_API**：阿里云通义千问 API，支持多模态（图片+文字）输入

## 需求

### 需求 1：简单图片验证码检测

**用户故事：** 作为自动评论流程的使用者，我希望系统能自动检测页面中的简单图片验证码，以便后续进行自动识别和填写。

#### 验收标准

1. WHEN Content_Script 执行页面快照捕获时，THE Captcha_Detector SHALL 扫描页面中与验证码相关的 `<img>` 元素（通过 `id`、`name`、`class`、`src`、`alt` 属性中包含 "captcha"、"verify"、"验证码"、"認証" 等关键词匹配）
2. WHEN Captcha_Detector 发现疑似验证码图片时，THE Captcha_Detector SHALL 同时定位与该图片关联的文本输入框（通过相邻 DOM 关系、相同表单内的 input 元素、或 name/id 包含 "captcha"/"verify"/"验证码" 的输入框）
3. WHEN Captcha_Detector 检测到简单图片验证码时，THE Content_Script SHALL 在 PageSnapshot 中设置 `hasCaptcha` 为 true，并附带验证码图片信息（图片的 src URL 或 base64 数据）和对应输入框的 CSS 选择器
4. WHILE 页面同时包含 reCAPTCHA/hCaptcha 等复杂验证码和简单图片验证码时，THE Captcha_Detector SHALL 分别标记两种验证码类型，仅对简单图片验证码尝试自动识别
5. IF Captcha_Detector 未能在页面中找到任何验证码元素，THEN THE Content_Script SHALL 保持 `hasCaptcha` 为 false，流程正常继续

### 需求 2：验证码图片数据提取

**用户故事：** 作为系统的 AI 识别模块，我需要获取验证码图片的可用数据，以便发送给多模态 AI 进行内容识别。

#### 验收标准

1. WHEN Captcha_Detector 定位到验证码图片元素时，THE Content_Script SHALL 提取该图片的数据，优先使用图片的 `src` 属性（如果是完整 URL 或 data URI）
2. IF 验证码图片的 `src` 是相对路径，THEN THE Content_Script SHALL 将其转换为绝对 URL
3. IF 验证码图片因跨域限制无法通过 URL 直接访问，THEN THE Content_Script SHALL 使用 Canvas API 将图片绘制到 canvas 上并导出为 base64 格式的 data URI
4. IF 图片数据提取失败（如 canvas 被污染、图片未加载完成），THEN THE Content_Script SHALL 回退到使用 `chrome.tabs.captureVisibleTab` 截取页面可见区域截图，并裁剪出验证码图片区域
5. THE Content_Script SHALL 将提取到的验证码图片数据以 base64 编码的 data URI 格式或可访问的 URL 格式传递给 Background_Service

### 需求 3：AI 多模态验证码识别

**用户故事：** 作为自动评论流程的使用者，我希望 AI 能通过视觉能力识别简单图片验证码中的数字或文字内容，以便自动填写验证码字段。

#### 验收标准

1. WHEN Background_Service 收到包含验证码图片数据的识别请求时，THE Captcha_Recognizer SHALL 调用 DashScope_API 的多模态接口，发送验证码图片和识别指令
2. THE Captcha_Recognizer SHALL 在发送给 DashScope_API 的 prompt 中明确指示：识别图片中显示的验证码字符，只返回纯字符内容，不包含任何解释或额外文字
3. WHEN DashScope_API 返回识别结果时，THE Captcha_Recognizer SHALL 对结果进行清洗（去除空格、换行、标点等非验证码字符）
4. IF DashScope_API 调用失败或返回空结果，THEN THE Captcha_Recognizer SHALL 返回识别失败状态，流程回退到提示用户手动处理验证码
5. IF DashScope_API 返回 401 错误，THEN THE Captcha_Recognizer SHALL 返回 "API Key 无效" 错误信息
6. IF DashScope_API 返回 429 错误，THEN THE Captcha_Recognizer SHALL 返回 "API 调用频率超限" 错误信息

### 需求 4：验证码自动填写集成

**用户故事：** 作为自动评论流程的使用者，我希望识别出的验证码内容能自动填入对应的输入框，并继续完成表单提交，无需我手动干预。

#### 验收标准

1. WHEN AI_Planner 收到的 PageSnapshot 中包含简单验证码信息（图片数据和输入框选择器）时，THE AI_Planner SHALL 先调用 Captcha_Recognizer 识别验证码内容，再将识别结果纳入操作指令规划中
2. WHEN Captcha_Recognizer 成功返回验证码文本时，THE AI_Planner SHALL 在操作指令列表中包含一条 `type` 操作，将识别出的验证码文本填入对应的验证码输入框
3. WHEN 验证码已被自动识别并填写时，THE AI_Planner SHALL 在操作指令中包含 `click` 提交按钮的操作（不再设置 `hasCaptcha` 为 true）
4. IF Captcha_Recognizer 识别失败，THEN THE AI_Planner SHALL 设置 `hasCaptcha` 为 true，操作指令中不包含提交按钮的点击操作，流程回退到提示用户手动处理
5. WHEN 自动评论流程执行验证码填写操作时，THE Content_Script SHALL 使用与普通表单字段相同的模拟人类输入方式（逐字符输入、触发键盘事件）填写验证码

### 需求 5：验证码提交失败后的重试处理

**用户故事：** 作为自动评论流程的使用者，我希望当验证码识别错误导致提交失败时，系统能自动重新获取验证码并重试，而不是直接放弃。

#### 验收标准

1. WHEN 提交后验证阶段检测到验证码相关的错误信息（如"验证码错误"、"CAPTCHA incorrect"、"認証コードが正しくありません"）时，THE Auto_Comment_Flow SHALL 识别这是验证码错误而非评论内容错误
2. WHEN 检测到验证码错误且重试次数未超过上限时，THE Auto_Comment_Flow SHALL 重新截取页面快照以获取新的验证码图片（因为验证码通常在提交失败后会刷新）
3. WHEN 重新获取到新的验证码图片时，THE Captcha_Recognizer SHALL 对新验证码图片进行识别，并重新规划填写和提交操作
4. IF 验证码重试次数达到上限（2 次），THEN THE Auto_Comment_Flow SHALL 停止重试，提示用户"验证码多次识别失败，请手动完成验证码并提交"

### 需求 6：PageSnapshot 类型扩展

**用户故事：** 作为开发者，我需要 PageSnapshot 类型能承载验证码图片信息，以便在各模块间传递验证码数据。

#### 验收标准

1. THE PageSnapshot 接口 SHALL 包含一个可选的 `captchaInfo` 字段，类型为包含以下属性的对象：`imageData`（string，验证码图片的 base64 data URI 或 URL）、`inputSelector`（string，验证码输入框的 CSS 选择器）、`type`（string，值为 "simple_image"，标识验证码类型）
2. WHEN `captchaInfo` 存在且 `type` 为 "simple_image" 时，THE 系统各模块 SHALL 将其视为可自动识别的简单图片验证码
3. THE PageSnapshot 的 `hasCaptcha` 字段 SHALL 继续用于标识页面是否包含任何类型的验证码（包括复杂验证码），与 `captchaInfo` 字段独立存在

### 需求 7：消息路由扩展

**用户故事：** 作为系统架构的一部分，Background_Service 需要支持验证码识别的消息路由，以便 Side Panel 和 Content Script 能通过消息机制调用验证码识别功能。

#### 验收标准

1. THE Background_Service SHALL 支持 `captcha-recognize` 消息类型，接收包含验证码图片数据的请求并调用 Captcha_Recognizer 进行识别
2. WHEN Background_Service 收到 `captcha-recognize` 消息时，THE Background_Service SHALL 将图片数据转发给 Captcha_Recognizer，并将识别结果返回给调用方
3. IF `captcha-recognize` 消息中缺少必要的图片数据或 API Key，THEN THE Background_Service SHALL 返回包含具体错误描述的失败响应
