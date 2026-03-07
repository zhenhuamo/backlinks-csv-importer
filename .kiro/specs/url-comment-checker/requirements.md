# 需求文档

## 简介

在现有的 Backlinks CSV Importer Chrome 扩展中添加 URL 评论可用性检测功能。该功能对去重后的源 URL 进行两阶段清洗：先通过静态规则预过滤排除明显不可评论的页面，再通过主动抓取页面 HTML 分析评论表单特征，最终为每个 URL 标注评论可用性状态（✅ 可评论 / ❌ 需登录 / ⚠️ 不确定）。

## 术语表

- **URL_Filter（URL 过滤器）**: 负责对源 URL 列表执行静态规则预过滤和主动抓取分析的模块
- **Static_Rule_Engine（静态规则引擎）**: 基于 URL 路径模式进行预过滤的子模块，无需网络请求
- **Page_Analyzer（页面分析器）**: 通过 fetch 抓取页面 HTML 并解析 DOM 检测评论表单特征的子模块
- **Comment_Status（评论状态）**: URL 的评论可用性标签，取值为 "commentable"（✅ 可评论）、"login_required"（❌ 需登录）、"uncertain"（⚠️ 不确定）、"filtered_out"（🚫 已过滤）
- **BacklinkRecord**: 现有数据模型，包含 sourcePageInfo.url、anchorInfo、pageAS 等字段
- **Side_Panel（侧面板）**: Chrome 扩展的 Side Panel UI 界面
- **Rate_Limiter（限速器）**: 控制并发请求数量和请求间隔的机制

## 需求

### 需求 1：静态规则预过滤

**用户故事：** 作为 SEO 从业者，我想通过 URL 模式快速排除明显不可评论的页面，以便节省后续抓取分析的时间。

#### 验收标准

1. WHEN 用户触发 URL 清洗操作, THE Static_Rule_Engine SHALL 对去重后的 BacklinkRecord 列表中每条记录的 sourcePageInfo.url 执行模式匹配
2. THE Static_Rule_Engine SHALL 将 URL 路径中包含 "/profile"、"/user/"、"/member/" 模式的 URL 标记为 "filtered_out" 状态
3. THE Static_Rule_Engine SHALL 将 URL 路径中包含 "/login"、"/register"、"/signin"、"/signup" 模式的 URL 标记为 "filtered_out" 状态
4. THE Static_Rule_Engine SHALL 将 URL 路径中包含 "/gallery"、"/archive"、"/category"、"/tag/" 模式的 URL 标记为 "filtered_out" 状态
5. THE Static_Rule_Engine SHALL 将 URL 路径中包含 "forum.php"、"viewtopic.php"、"discuss.php"、"thread" 模式的 URL 保留为待分析状态
6. THE Static_Rule_Engine SHALL 将未匹配任何排除规则的 URL 保留为待分析状态
7. THE Static_Rule_Engine SHALL 在执行预过滤时不发起任何网络请求

### 需求 2：页面抓取与评论表单检测

**用户故事：** 作为 SEO 从业者，我想自动检测页面是否有开放的评论区，以便快速找到可以留评论的外链页面。

#### 验收标准

1. WHEN 一个 URL 通过静态规则预过滤后处于待分析状态, THE Page_Analyzer SHALL 使用 fetch API 请求该 URL 的 HTML 内容
2. WHEN 页面 HTML 中包含 `<textarea>` 与 `<form>` 的组合, THE Page_Analyzer SHALL 将该特征作为评论表单存在的正向信号
3. WHEN 页面 HTML 中包含 name、email、website 输入框（`<input>` 元素的 name 或 id 属性包含 "author"、"email"、"url"、"website"）, THE Page_Analyzer SHALL 将该特征作为免登录评论的正向信号
4. WHEN 页面 HTML 中包含 WordPress 评论表单标识（id 为 "commentform" 的元素）, THE Page_Analyzer SHALL 将该特征作为评论表单存在的正向信号
5. WHEN 页面 HTML 中包含 Disqus 评论系统标识（id 为 "disqus_thread" 的元素）, THE Page_Analyzer SHALL 将该特征作为评论表单存在的正向信号
6. WHEN 页面 HTML 中包含 "log in to comment"、"登录后评论"、"请先登录"、"sign in to comment" 等文本, THE Page_Analyzer SHALL 将该特征作为需要登录评论的信号
7. IF fetch 请求返回 3xx 重定向状态码且重定向目标 URL 包含 "/login"、"/signin"、"/auth" 路径, THEN THE Page_Analyzer SHALL 将该 URL 标记为 "login_required" 状态
8. IF fetch 请求失败（网络错误、超时或返回 4xx/5xx 状态码）, THEN THE Page_Analyzer SHALL 将该 URL 标记为 "uncertain" 状态

### 需求 3：评论状态综合判定

**用户故事：** 作为 SEO 从业者，我想获得每个 URL 的明确评论可用性标签，以便快速决定是否值得访问该页面。

#### 验收标准

1. WHEN Page_Analyzer 检测到评论表单存在的正向信号且未检测到登录拦截信号, THE URL_Filter SHALL 将该 URL 的 Comment_Status 设置为 "commentable"
2. WHEN Page_Analyzer 检测到登录拦截信号, THE URL_Filter SHALL 将该 URL 的 Comment_Status 设置为 "login_required"
3. WHEN Page_Analyzer 未检测到评论表单存在的正向信号且未检测到登录拦截信号, THE URL_Filter SHALL 将该 URL 的 Comment_Status 设置为 "uncertain"
4. WHEN Static_Rule_Engine 将 URL 标记为已过滤, THE URL_Filter SHALL 将该 URL 的 Comment_Status 设置为 "filtered_out"

### 需求 4：请求限速控制

**用户故事：** 作为 SEO 从业者，我想让抓取过程有合理的限速，以避免因请求过快被目标网站封禁 IP。

#### 验收标准

1. WHILE URL 清洗任务正在执行, THE Rate_Limiter SHALL 将同时进行的 fetch 请求数量限制为 3 个以内
2. WHILE URL 清洗任务正在执行, THE Rate_Limiter SHALL 在每个 fetch 请求完成后等待 500 毫秒再发起下一个请求
3. THE Rate_Limiter SHALL 为每个 fetch 请求设置 10 秒的超时时间

### 需求 5：UI 交互 — 清洗触发与进度展示

**用户故事：** 作为 SEO 从业者，我想在去重完成后看到"清洗 URL"按钮并实时了解清洗进度，以便掌控整个流程。

#### 验收标准

1. WHEN 去重操作完成且存在至少一条 BacklinkRecord, THE Side_Panel SHALL 显示"清洗 URL"按钮
2. WHEN 用户点击"清洗 URL"按钮, THE Side_Panel SHALL 禁用该按钮并显示进度条
3. WHILE URL 清洗任务正在执行, THE Side_Panel SHALL 实时更新进度条，显示已完成数量与总数量（格式为 "已检查 X / Y"）
4. WHEN URL 清洗任务完成, THE Side_Panel SHALL 启用"清洗 URL"按钮并隐藏进度条
5. WHEN URL 清洗任务完成, THE Side_Panel SHALL 显示清洗统计摘要（可评论数、需登录数、不确定数、已过滤数）

### 需求 6：UI 交互 — 结果展示与筛选

**用户故事：** 作为 SEO 从业者，我想在数据表格中看到每个 URL 的评论状态并按状态筛选，以便快速定位可评论的页面。

#### 验收标准

1. WHEN URL 清洗完成, THE Side_Panel SHALL 在数据表格中增加"评论状态"列，显示每条记录的 Comment_Status 标签（✅ 可评论 / ❌ 需登录 / ⚠️ 不确定 / 🚫 已过滤）
2. WHEN URL 清洗完成, THE Side_Panel SHALL 在表格上方显示状态筛选控件，包含"全部"、"✅ 可评论"、"❌ 需登录"、"⚠️ 不确定"、"🚫 已过滤"选项
3. WHEN 用户选择某个状态筛选选项, THE Side_Panel SHALL 仅显示匹配该状态的记录
4. WHEN 用户选择"全部"筛选选项, THE Side_Panel SHALL 显示所有记录

### 需求 7：手动状态修改

**用户故事：** 作为 SEO 从业者，我想手动修改自动检测的评论状态，以便纠正误判结果。

#### 验收标准

1. WHEN 用户点击某条记录的评论状态标签, THE Side_Panel SHALL 显示状态选择下拉菜单，包含 "commentable"、"login_required"、"uncertain" 三个选项
2. WHEN 用户从下拉菜单中选择新状态, THE Side_Panel SHALL 立即更新该记录的 Comment_Status 并刷新表格显示
3. WHEN 用户修改某条记录的 Comment_Status, THE Side_Panel SHALL 将修改后的状态持久化到 chrome.storage.local

### 需求 8：评论状态数据持久化

**用户故事：** 作为 SEO 从业者，我想让评论状态检测结果在关闭扩展后仍然保留，以避免重复检测。

#### 验收标准

1. WHEN URL 清洗任务为某条 BacklinkRecord 确定 Comment_Status, THE URL_Filter SHALL 将该状态保存到 chrome.storage.local
2. WHEN Side_Panel 加载已有数据, THE Side_Panel SHALL 读取并显示之前保存的 Comment_Status
3. IF 用户清除所有数据, THEN THE Side_Panel SHALL 同时清除所有 Comment_Status 数据

### 需求 9：扩展权限配置

**用户故事：** 作为开发者，我想确保 Chrome 扩展拥有跨域请求权限，以便 fetch API 能够请求任意外部 URL。

#### 验收标准

1. THE manifest.json SHALL 在 host_permissions 字段中包含 "<all_urls>" 权限声明
2. THE manifest.json SHALL 保留现有的 "storage" 和 "sidePanel" 权限声明
