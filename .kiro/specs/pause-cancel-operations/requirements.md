# 需求文档

## 简介

为 Backlinks CSV Importer 扩展的两个长时间运行操作添加暂停和取消功能：
1. **清洗 URL 分析操作** — 通过 Rate Limiter 批量抓取并分析 URL 的评论可用性
2. **自动提交评论操作** — AI 驱动的页面分析、评论生成与自动提交流程

用户在误触发操作或需要中途停止时，可以暂停（保留已完成进度）或取消（终止并回退）操作。

## 术语表

- **Side_Panel**: Chrome 扩展的侧边栏面板，承载所有用户交互界面
- **Cleanse_Operation**: 清洗操作，批量抓取 URL 并分析评论表单可用性的过程，由 `handleCleanse` 函数驱动
- **Auto_Comment_Operation**: 自动评论操作，AI 分析页面、生成评论并模拟人类操作提交的过程，由 `runAutoComment` 函数驱动
- **Rate_Limiter**: 限速调度器，控制并发数和请求间隔的异步任务执行模块
- **Operation_Controller**: 操作控制器，管理操作生命周期状态（运行中、已暂停、已取消）的模块
- **Progress_State**: 进度状态，记录操作已完成的任务数和中间结果的数据结构

## 需求

### 需求 1：清洗操作暂停功能

**用户故事：** 作为扩展用户，我想要在清洗 URL 分析过程中暂停操作，以便我可以稍后继续分析而不丢失已完成的进度。

#### 验收标准

1. WHILE Cleanse_Operation 正在运行, THE Side_Panel SHALL 显示一个「暂停」按钮替代原来的「清洗URL」按钮
2. WHEN 用户点击「暂停」按钮, THE Operation_Controller SHALL 在当前正在执行的请求完成后停止发起新的请求
3. WHILE Cleanse_Operation 处于暂停状态, THE Side_Panel SHALL 将「暂停」按钮文本更新为「继续」
4. WHILE Cleanse_Operation 处于暂停状态, THE Progress_State SHALL 保留所有已完成 URL 的分析结果
5. WHEN 用户点击「继续」按钮, THE Rate_Limiter SHALL 从上次暂停的位置继续执行剩余的 URL 分析任务
6. WHILE Cleanse_Operation 处于暂停状态, THE Side_Panel SHALL 继续显示当前进度条和已完成数量

### 需求 2：清洗操作取消功能

**用户故事：** 作为扩展用户，我想要在清洗 URL 分析过程中取消操作，以便我可以在误触发后立即终止分析。

#### 验收标准

1. WHILE Cleanse_Operation 正在运行或处于暂停状态, THE Side_Panel SHALL 显示一个「取消」按钮
2. WHEN 用户点击「取消」按钮, THE Operation_Controller SHALL 中止所有正在进行的网络请求
3. WHEN Cleanse_Operation 被取消, THE Side_Panel SHALL 恢复到清洗操作开始前的界面状态
4. WHEN Cleanse_Operation 被取消, THE Operation_Controller SHALL 丢弃本次清洗操作中所有已获取的分析结果
5. WHEN 用户点击「取消」按钮, THE Side_Panel SHALL 显示确认提示「确定要取消清洗操作吗？已完成的进度将丢失。」

### 需求 3：自动评论操作取消功能

**用户故事：** 作为扩展用户，我想要在自动提交评论过程中取消操作，以便我可以在发现问题时立即停止提交。

#### 验收标准

1. WHILE Auto_Comment_Operation 正在运行, THE Side_Panel SHALL 显示一个「取消评论」按钮替代原来的「自动评论」按钮
2. WHEN 用户点击「取消评论」按钮, THE Operation_Controller SHALL 在当前步骤完成后停止执行后续步骤
3. WHEN Auto_Comment_Operation 被取消, THE Side_Panel SHALL 显示状态消息「评论操作已取消」
4. WHEN Auto_Comment_Operation 在 AI 分析阶段被取消, THE Operation_Controller SHALL 不执行任何页面操作指令
5. WHEN Auto_Comment_Operation 在操作执行阶段被取消, THE Operation_Controller SHALL 不执行后续的验证和重试步骤
6. IF Auto_Comment_Operation 在表单已提交后被取消, THEN THE Side_Panel SHALL 显示警告消息「评论可能已提交，请检查页面确认」

### 需求 4：操作状态指示

**用户故事：** 作为扩展用户，我想要清楚地看到当前操作的状态，以便我知道操作是否正在运行、已暂停或已取消。

#### 验收标准

1. WHILE Cleanse_Operation 正在运行, THE Side_Panel SHALL 在进度区域显示「正在清洗...」状态文本
2. WHILE Cleanse_Operation 处于暂停状态, THE Side_Panel SHALL 在进度区域显示「已暂停」状态文本，并将进度条颜色更改为黄色
3. WHILE Auto_Comment_Operation 正在运行, THE Side_Panel SHALL 在状态区域显示当前步骤描述（如「正在分析页面结构...」）
4. THE Side_Panel SHALL 在操作完成、取消或出错后的 3 秒内恢复按钮到可用状态

### 需求 5：键盘快捷键支持

**用户故事：** 作为扩展用户，我想要通过键盘快捷键暂停或取消操作，以便我可以快速响应而不需要精确点击按钮。

#### 验收标准

1. WHEN 用户在 Cleanse_Operation 运行期间按下 Escape 键, THE Operation_Controller SHALL 暂停清洗操作
2. WHEN 用户在 Auto_Comment_Operation 运行期间按下 Escape 键, THE Operation_Controller SHALL 取消评论操作
3. WHEN 操作因 Escape 键被暂停或取消, THE Side_Panel SHALL 与点击按钮产生相同的界面反馈
