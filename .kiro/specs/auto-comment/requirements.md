# 需求文档

## 简介

在现有的 Backlinks CSV Importer Chrome 扩展中新增"自动评论"功能。当用户打开一个被 URL 清洗功能标记为"✅ 可评论"的博客页面时，可以点击"自动评论"按钮，扩展将自动提取博客文章内容，结合当前选中的外链模板（名称、网址、关键词），调用通义千问（Qwen）AI 生成一条自然融入外链的评论，然后自动填充并提交评论表单。该功能需要支持多种评论表单样式（WordPress、日式 CGI/BBS、泰式博客、富文本编辑器等），并能智能处理 CAPTCHA 和 HTML 允许的场景。

## 术语表

- **Side_Panel**: Chrome 扩展的侧边栏面板，承载所有 UI 交互
- **Auto_Comment_Orchestrator**: 自动评论编排模块，协调从内容提取到评论提交的完整流程
- **Content_Script**: 内容脚本，注入到博客页面中执行 DOM 操作（提取文章、检测表单、填充字段、提交表单）
- **AI_Comment_Generator**: AI 评论生成模块，调用通义千问 DashScope API 生成评论文本
- **DashScope_API**: 通义千问的 OpenAI 兼容 API 接口（https://dashscope.aliyuncs.com/compatible-mode/v1）
- **Link_Template**: 外链模板，包含名称（name）、网址（url）、关键词（keyword）的数据结构
- **Comment_Form_Detector**: 评论表单检测器，识别页面上的评论表单类型和字段
- **Background_Script**: Chrome 扩展的 Service Worker，负责 Side_Panel 与 Content_Script 之间的消息传递
- **CAPTCHA**: 验证码，部分博客页面用于防止自动提交的人机验证机制
- **API_Key**: 用户配置的通义千问 DashScope API 密钥

## 需求

### 需求 1：Manifest 权限更新

**用户故事：** 作为开发者，我需要扩展具备脚本注入和活动标签页访问权限，以便 Content_Script 能够注入到博客页面中执行 DOM 操作。

#### 验收标准

1. THE manifest.json SHALL 在 permissions 数组中包含 "scripting" 权限
2. THE manifest.json SHALL 在 permissions 数组中包含 "activeTab" 权限
3. THE manifest.json SHALL 保留现有的 "storage"、"sidePanel" 权限和 "<all_urls>" host_permissions 不变

### 需求 2：API Key 设置界面

**用户故事：** 作为外链推广人员，我想要在 Side Panel 中配置通义千问 API 密钥，以便扩展能够调用 AI 生成评论。

#### 验收标准

1. THE Side_Panel SHALL 在工具栏区域显示一个"设置"按钮（⚙️ 图标），用于展开或收起 API Key 配置区域
2. WHEN 用户点击"设置"按钮时，THE Side_Panel SHALL 切换 API Key 配置区域的显示与隐藏状态
3. THE Side_Panel SHALL 在配置区域显示一个密码类型的输入框（type="password"）和一个"保存"按钮
4. WHEN 用户输入 API Key 并点击"保存"按钮时，THE Side_Panel SHALL 将 API Key 保存到 chrome.storage.local 并显示"保存成功"提示
5. WHEN Side_Panel 初始化时，THE Side_Panel SHALL 从 chrome.storage.local 加载已保存的 API Key 并填充到输入框中
6. IF 用户尝试保存空的 API Key，THEN THE Side_Panel SHALL 阻止保存并提示"API Key 不能为空"

### 需求 3：评论表单类型检测

**用户故事：** 作为外链推广人员，我想要扩展能自动识别不同博客平台的评论表单样式，以便正确填充评论内容。

#### 验收标准

1. THE Comment_Form_Detector SHALL 按以下优先级顺序检测评论表单类型：WordPress 模式（#commentform 或 #respond 选择器）→ 通用表单模式（包含 textarea 和 submit 按钮的 form）→ 富文本编辑器模式（contenteditable 属性的 div 元素）→ 检测失败
2. WHEN 检测到 WordPress 模式时，THE Comment_Form_Detector SHALL 识别评论内容字段（#comment textarea）、姓名字段（input[name="author"]）、邮箱字段（input[name="email"]）、网址字段（input[name="url"]）和提交按钮
3. WHEN 检测到通用表单模式时，THE Comment_Form_Detector SHALL 识别 textarea 元素、所有 text/email 类型的 input 元素、以及 submit 类型的按钮
4. WHEN 检测到富文本编辑器模式时，THE Comment_Form_Detector SHALL 识别 contenteditable 的 div 元素和页面上的"Publish"或类似提交按钮
5. IF Comment_Form_Detector 未检测到任何评论表单，THEN THE Content_Script SHALL 向 Side_Panel 返回错误信息"未检测到评论表单"
6. THE Comment_Form_Detector SHALL 检测页面是否存在 CAPTCHA 元素（包括常见 CAPTCHA class 名称、iframe、或标签含有 captcha/验证码 关键词的输入框）
7. THE Comment_Form_Detector SHALL 检测页面是否允许在评论中使用 HTML 标签（通过检测页面中包含"可以使用的 HTML 标签"、"You may use these HTML tags"、"allowed HTML tags" 等提示文本）

### 需求 4：博客文章内容提取

**用户故事：** 作为外链推广人员，我想要扩展能自动提取当前博客页面的文章内容，以便 AI 能根据文章主题生成相关评论。

#### 验收标准

1. WHEN Content_Script 注入到博客页面后，THE Content_Script SHALL 提取页面的文章标题（优先使用 h1 标签，其次使用 document.title）
2. THE Content_Script SHALL 提取文章正文内容（优先使用 article 标签，其次使用 .post-content、.entry-content、main 等常见内容选择器，最后回退到 body）
3. THE Content_Script SHALL 将提取的正文内容截断为前 2000 个字符，避免超出 AI API 的 token 限制
4. THE Content_Script SHALL 去除提取内容中的 HTML 标签，仅保留纯文本
5. IF Content_Script 未能提取到有效的文章内容（正文为空），THEN THE Content_Script SHALL 向 Side_Panel 返回错误信息"未能提取文章内容"

### 需求 5：AI 评论生成

**用户故事：** 作为外链推广人员，我想要 AI 根据博客文章内容和我的外链模板生成一条自然的评论，以便评论看起来与文章相关且自然地包含我的外链。

#### 验收标准

1. WHEN Auto_Comment_Orchestrator 收到文章内容和 Link_Template 数据后，THE AI_Comment_Generator SHALL 调用 DashScope_API（https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions）生成评论
2. THE AI_Comment_Generator SHALL 在 API 请求中使用 OpenAI 兼容格式，包含 model 字段（qwen-plus）、messages 数组（system prompt + user prompt）、和 Authorization header（Bearer {API_Key}）
3. THE AI_Comment_Generator SHALL 在 system prompt 中指示 AI 生成一条与文章内容相关的自然评论，评论中需自然地融入 Link_Template 的网址和关键词
4. WHEN 页面允许 HTML 标签时，THE AI_Comment_Generator SHALL 在 prompt 中指示 AI 使用 `<a href="url">keyword</a>` 格式嵌入链接
5. WHEN 页面不允许 HTML 标签时，THE AI_Comment_Generator SHALL 在 prompt 中指示 AI 以纯文本方式自然提及网址和关键词
6. THE AI_Comment_Generator SHALL 将生成的评论文本返回给 Auto_Comment_Orchestrator
7. IF DashScope_API 返回错误（网络错误、401 未授权、429 限流等），THEN THE AI_Comment_Generator SHALL 返回包含具体错误描述的错误信息
8. IF API Key 未配置，THEN THE AI_Comment_Generator SHALL 返回错误信息"请先在设置中配置 API Key"

### 需求 6：评论表单自动填充

**用户故事：** 作为外链推广人员，我想要扩展自动将 AI 生成的评论和外链模板信息填充到评论表单中，以便我不需要手动复制粘贴。

#### 验收标准

1. WHEN AI 评论生成成功后，THE Content_Script SHALL 将评论文本填充到检测到的评论内容字段中（textarea 或 contenteditable div）
2. WHEN 评论表单包含姓名字段时，THE Content_Script SHALL 将 Link_Template 的 name 值填充到姓名字段
3. WHEN 评论表单包含网址/URL 字段时，THE Content_Script SHALL 将 Link_Template 的 url 值填充到网址字段
4. THE Content_Script SHALL 在填充每个字段后触发 input 和 change 事件，确保页面的表单验证逻辑能正确响应
5. WHEN 评论表单为富文本编辑器（contenteditable div）时，THE Content_Script SHALL 使用 innerHTML 设置内容并触发 input 事件

### 需求 7：评论自动提交与 CAPTCHA 处理

**用户故事：** 作为外链推广人员，我想要扩展在填充评论后自动提交，但在遇到 CAPTCHA 时提醒我手动处理，以便我能高效地发布评论同时正确处理验证码。

#### 验收标准

1. WHEN 评论表单填充完成且页面未检测到 CAPTCHA 时，THE Content_Script SHALL 自动点击提交按钮提交评论
2. WHEN 评论表单填充完成且页面检测到 CAPTCHA 时，THE Content_Script SHALL 填充所有非 CAPTCHA 字段但不自动提交
3. WHEN 页面检测到 CAPTCHA 时，THE Content_Script SHALL 向 Side_Panel 发送消息，提示用户"检测到验证码，请手动完成验证码并提交"
4. WHEN 评论提交成功后（无 CAPTCHA 场景），THE Content_Script SHALL 向 Side_Panel 发送提交成功的消息

### 需求 8：自动评论流程编排

**用户故事：** 作为外链推广人员，我想要点击一个按钮就能完成从内容提取到评论提交的完整流程，以便操作简单高效。

#### 验收标准

1. THE Side_Panel SHALL 在工具栏区域显示一个"自动评论"按钮
2. WHEN 用户点击"自动评论"按钮时，THE Auto_Comment_Orchestrator SHALL 按以下顺序执行流程：获取当前活动标签页 → 注入 Content_Script → 提取文章内容 → 检测评论表单 → 调用 AI 生成评论 → 发送评论数据到 Content_Script → 填充并提交表单
3. WHILE 自动评论流程执行中，THE Side_Panel SHALL 禁用"自动评论"按钮并显示当前步骤的进度状态文本（如"正在提取文章内容..."、"正在生成评论..."、"正在填充表单..."）
4. IF 当前未选中任何 Link_Template，THEN THE Auto_Comment_Orchestrator SHALL 中止流程并提示用户"请先选择一个外链模板"
5. IF 流程中任何步骤失败，THEN THE Auto_Comment_Orchestrator SHALL 中止流程并在 Side_Panel 显示具体的错误信息
6. WHEN 流程完成后（成功或失败），THE Side_Panel SHALL 恢复"自动评论"按钮为可用状态

### 需求 9：消息传递机制

**用户故事：** 作为开发者，我需要 Side_Panel、Background_Script 和 Content_Script 之间有可靠的消息传递机制，以便各模块能协调完成自动评论流程。

#### 验收标准

1. THE Background_Script SHALL 监听来自 Side_Panel 的消息并转发给对应标签页的 Content_Script
2. THE Background_Script SHALL 监听来自 Content_Script 的消息并转发给 Side_Panel
3. THE Auto_Comment_Orchestrator SHALL 使用 chrome.scripting.executeScript API 将 Content_Script 注入到活动标签页
4. THE Content_Script SHALL 使用 chrome.runtime.sendMessage 向 Background_Script 发送消息
5. THE Side_Panel SHALL 使用 chrome.tabs.sendMessage 向指定标签页的 Content_Script 发送消息
6. WHEN 消息传递失败时（如标签页已关闭），THE Auto_Comment_Orchestrator SHALL 捕获错误并在 Side_Panel 显示"无法与页面通信，请刷新页面后重试"

### 需求 10：自动评论 UI 集成

**用户故事：** 作为外链推广人员，我想要自动评论功能与现有 Side Panel 界面风格一致，以便获得统一的使用体验。

#### 验收标准

1. THE Side_Panel SHALL 所有新增 UI 文本使用中文显示
2. THE Side_Panel SHALL 新增的按钮和区域使用与现有工具栏一致的视觉风格（字体、颜色、圆角、间距）
3. THE Side_Panel SHALL 在"自动评论"按钮下方显示一个状态区域，用于展示流程进度和结果信息
4. WHEN 自动评论流程成功完成时，THE Side_Panel SHALL 在状态区域显示绿色的成功提示"评论已提交"
5. WHEN 自动评论流程遇到 CAPTCHA 时，THE Side_Panel SHALL 在状态区域显示黄色的警告提示"检测到验证码，请手动完成验证码并提交"
6. WHEN 自动评论流程失败时，THE Side_Panel SHALL 在状态区域显示红色的错误提示及具体错误信息
