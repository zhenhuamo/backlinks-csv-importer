# 实施计划：URL 评论可用性检测

## 概述

基于两阶段清洗架构，按模块逐步实现：先建立类型定义和核心纯函数模块（Static Rule Engine、Page Analyzer、Status Resolver），再实现 Rate Limiter，然后扩展 Storage 层，最后集成到 Side Panel UI。每个模块实现后紧跟属性测试和单元测试，确保增量验证。

## 任务

- [x] 1. 新增类型定义与 manifest 权限配置
  - [x] 1.1 在 `src/types.ts` 中新增 CommentStatus、AnalysisResult、FilterResult、CleansingStats、CommentStatusMap 类型定义及 COMMENT_STATUS_LABELS 常量
    - 按设计文档数据模型部分定义所有新增类型
    - _需求：3.1, 3.2, 3.3, 3.4, 6.1_
  - [x] 1.2 在 `manifest.json` 中新增 `host_permissions: ["<all_urls>"]`，保留现有 `storage` 和 `sidePanel` 权限
    - _需求：9.1, 9.2_

- [x] 2. 实现 Static Rule Engine 模块
  - [x] 2.1 创建 `src/static-rule-engine.ts`，实现 `shouldFilter(url)` 和 `applyStaticFilter(records)` 函数
    - 定义 EXCLUDE_PATTERNS 排除模式列表
    - shouldFilter 解析 URL pathname 进行模式匹配，不发起网络请求
    - applyStaticFilter 将记录分为 filtered 和 pending 两组
    - _需求：1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [ ]* 2.2 编写属性测试：静态过滤分区完整性
    - **属性 1：静态过滤分区完整性**
    - 使用 fast-check 生成随机 BacklinkRecord 列表，验证 filtered.length + pending.length === 原始列表长度，且无遗漏无重复
    - **验证需求：1.1**
  - [ ]* 2.3 编写属性测试：排除模式匹配正确性
    - **属性 2：排除模式匹配正确性**
    - 使用 fast-check 生成包含排除模式的随机 URL，验证 shouldFilter 返回 true
    - **验证需求：1.2, 1.3, 1.4**
  - [ ]* 2.4 编写属性测试：非排除 URL 保留正确性
    - **属性 3：非排除 URL 保留正确性**
    - 使用 fast-check 生成不包含任何排除模式的随机 URL，验证 shouldFilter 返回 false
    - **验证需求：1.5, 1.6**

- [x] 3. 实现 Page Analyzer 模块
  - [x] 3.1 创建 `src/page-analyzer.ts`，实现 `analyzeHtml(html)` 纯函数
    - 使用 DOMParser 解析 HTML
    - 检测 textarea+form 组合、WordPress commentform（id="commentform"）、Disqus（id="disqus_thread"）
    - 检测 author/email/url/website 输入框（input 的 name 或 id 属性）
    - 检测登录拦截文本（"log in to comment"、"sign in to comment"、"登录后评论"、"请先登录"）
    - _需求：2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 3.2 在 `src/page-analyzer.ts` 中实现 `fetchAndAnalyze(url, signal?)` 函数
    - 使用 fetch API，设置 `redirect: "manual"` 捕获重定向
    - 检测 3xx 重定向到登录页（/login、/signin、/auth）→ redirectedToLogin
    - 处理 fetch 失败（网络错误、超时、4xx/5xx）→ fetchError
    - 调用 analyzeHtml 解析成功获取的 HTML
    - _需求：2.1, 2.7, 2.8_
  - [ ]* 3.3 编写属性测试：评论表单正向信号检测
    - **属性 4：评论表单正向信号检测**
    - 使用 fast-check 生成包含 textarea+form / commentform / disqus_thread 的随机 HTML，验证 analyzeHtml(html).hasCommentForm 为 true
    - **验证需求：2.2, 2.4, 2.5**
  - [ ]* 3.4 编写属性测试：免登录评论输入框检测
    - **属性 5：免登录评论输入框检测**
    - 使用 fast-check 生成包含 author/email/url/website input 的随机 HTML，验证 analyzeHtml(html).hasCommentForm 为 true
    - **验证需求：2.3**
  - [ ]* 3.5 编写属性测试：登录拦截文本检测
    - **属性 6：登录拦截文本检测**
    - 使用 fast-check 生成包含登录拦截文本的随机 HTML，验证 analyzeHtml(html).hasLoginBarrier 为 true
    - **验证需求：2.6**
  - [ ]* 3.6 编写单元测试：fetchAndAnalyze 网络行为
    - 使用 mock fetch 测试：重定向到登录页返回 redirectedToLogin=true、fetch 失败返回 fetchError=true、4xx/5xx 返回 fetchError=true
    - 测试具体 WordPress/Disqus HTML 样本的解析结果
    - _需求：2.1, 2.7, 2.8_

- [x] 4. 实现 Status Resolver 模块
  - [x] 4.1 创建 `src/status-resolver.ts`，实现 `resolveStatus(result)` 纯函数
    - 判定优先级：redirectedToLogin || hasLoginBarrier → "login_required"；hasCommentForm && !hasLoginBarrier → "commentable"；其他 → "uncertain"
    - _需求：3.1, 3.2, 3.3_
  - [ ]* 4.2 编写属性测试：评论状态综合判定正确性
    - **属性 7：评论状态综合判定正确性**
    - 使用 fast-check 生成随机 AnalysisResult，验证 resolveStatus 返回值符合优先级规则
    - **验证需求：3.1, 3.2, 3.3**

- [x] 5. Checkpoint - 核心纯函数模块验证
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 6. 实现 Rate Limiter 模块
  - [x] 6.1 创建 `src/rate-limiter.ts`，实现 `executeWithRateLimit(tasks, options, onProgress?)` 函数
    - 使用信号量模式控制最大并发数（默认 3）
    - 每个任务完成后等待 delayMs（默认 500ms）再调度下一个
    - 通过 AbortController 为每个任务设置 timeoutMs（默认 10000ms）超时
    - 通过 onProgress 回调报告进度
    - _需求：4.1, 4.2, 4.3_
  - [ ]* 6.2 编写属性测试：并发限制不变量
    - **属性 8：并发限制不变量**
    - 使用 fast-check 生成随机长度的异步任务列表，跟踪并发数，验证任意时刻不超过 maxConcurrent
    - **验证需求：4.1**

- [x] 7. 扩展 Storage 模块
  - [x] 7.1 在 `src/storage.ts` 中新增 `saveCommentStatuses`、`loadCommentStatuses`、`clearCommentStatuses` 方法
    - 使用 COMMENT_STATUS_KEY = 'commentStatuses' 存储到 chrome.storage.local
    - 在现有 clearRecords 方法中同时调用 clearCommentStatuses
    - _需求：8.1, 8.2, 8.3_
  - [ ]* 7.2 编写属性测试：Comment_Status 持久化往返一致性
    - **属性 10：Comment_Status 持久化往返一致性**
    - 使用 fast-check 生成随机 CommentStatusMap，验证 save 后 load 得到深度相等的对象
    - **验证需求：7.3, 8.1, 8.2**
  - [ ]* 7.3 编写属性测试：清除操作同时清除评论状态
    - **属性 11：清除操作同时清除评论状态**
    - 使用 fast-check 生成随机 CommentStatusMap，验证 clearCommentStatuses 后 loadCommentStatuses 返回空对象
    - **验证需求：8.3**

- [x] 8. Checkpoint - 后端模块完整验证
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 9. Side Panel UI — 清洗触发与进度展示
  - [x] 9.1 在 `sidepanel.html` 中添加"清洗 URL"按钮、进度条容器和统计摘要区域的 HTML 结构
    - 按钮文本："清洗 URL"
    - 进度格式："已检查 X / Y"
    - _需求：5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 9.2 在 `sidepanel.css` 中添加清洗按钮、进度条、统计摘要的样式
    - _需求：5.1, 5.2, 5.3, 5.5_
  - [x] 9.3 在 `src/sidepanel.ts` 中实现 `handleCleanse()` 函数
    - 点击按钮后：禁用按钮、显示进度条
    - 调用 applyStaticFilter 执行预过滤
    - 调用 executeWithRateLimit + fetchAndAnalyze + resolveStatus 执行主动抓取分析
    - 实时更新进度条（"已检查 X / Y"）
    - 完成后：保存结果到 Storage、启用按钮、隐藏进度条、显示统计摘要
    - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 3.4, 8.1_
  - [x] 9.4 在 `src/sidepanel.ts` 中将"清洗 URL"按钮绑定到 handleCleanse，仅在去重完成且存在记录时显示
    - _需求：5.1_

- [x] 10. Side Panel UI — 结果展示、筛选与手动修改
  - [x] 10.1 在 `sidepanel.html` 和 `sidepanel.css` 中添加状态筛选控件的 HTML 和样式
    - 筛选选项："全部"、"✅ 可评论"、"❌ 需登录"、"⚠️ 不确定"、"🚫 已过滤"
    - _需求：6.2_
  - [x] 10.2 在 `src/sidepanel.ts` 中实现 `renderTableWithStatus()` 函数
    - 在现有表格列后增加"评论状态"列
    - 显示对应的 CommentStatus 标签（✅ 可评论 / ❌ 需登录 / ⚠️ 不确定 / 🚫 已过滤）
    - 加载已有数据时读取并显示之前保存的 CommentStatus
    - _需求：6.1, 8.2_
  - [x] 10.3 在 `src/sidepanel.ts` 中实现 `renderStatusFilter()` 和状态筛选逻辑
    - 选择筛选选项后仅显示匹配状态的记录，选择"全部"显示所有记录
    - _需求：6.2, 6.3, 6.4_
  - [ ]* 10.4 编写属性测试：状态筛选正确性
    - **属性 9：状态筛选正确性**
    - 使用 fast-check 生成随机 BacklinkRecord 列表 + CommentStatusMap + 筛选状态，验证筛选结果中每条记录的状态都匹配所选筛选值
    - **验证需求：6.3, 6.4**
  - [x] 10.5 在 `src/sidepanel.ts` 中实现 `handleStatusChange()` 手动状态修改功能
    - 点击状态标签显示下拉菜单（commentable、login_required、uncertain 三个选项）
    - 选择新状态后立即更新记录并持久化到 chrome.storage.local
    - _需求：7.1, 7.2, 7.3_
  - [x] 10.6 在 `src/sidepanel.ts` 中确保清除所有数据时同时清除 CommentStatus 数据
    - 在现有清除逻辑中调用 clearCommentStatuses
    - _需求：8.3_

- [x] 11. Final Checkpoint - 全功能集成验证
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- Checkpoint 任务用于增量验证，确保每个阶段的正确性
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 所有 UI 文本使用中文
