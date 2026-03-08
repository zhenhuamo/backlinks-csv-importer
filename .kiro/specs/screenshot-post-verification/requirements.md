# Requirements Document

## Introduction

当前 Chrome 扩展的提交后验证逻辑依赖 DOM 文本快照（bodyExcerpt 仅截取前 2000 字符），导致大量误判：评论已成功提交但被判定为失败。本功能通过引入页面截图 + VL 视觉模型，让 AI 像人一样"看"页面来判断提交结果，结合截图（视觉判断）和 DOM 快照（提供可操作的元素选择器），显著提升验证准确率。

## Glossary

- **Screenshot_Capturer**: 负责调用 `chrome.tabs.captureVisibleTab()` 截取当前可见页面截图的模块
- **VL_Analyzer**: 使用 VL（Vision-Language）视觉模型分析页面截图并判断提交结果的模块
- **Post_Submit_Verifier**: 提交后验证的主控模块，协调截图采集、DOM 快照和 VL 分析
- **Content_Script**: 运行在目标网页中的内容脚本，负责 DOM 操作和页面滚动
- **Background_Worker**: Chrome 扩展的 Service Worker，负责消息路由和 API 调用
- **DOM_Snapshot**: 通过 `capturePageSnapshot()` 采集的页面结构化数据，包含表单元素和选择器
- **VL_Model**: 支持图文多模态输入的视觉语言模型（项目已有 `selectedCaptchaModel` 配置）
- **Verification_Result**: 验证分析的结果对象，包含状态（success/error/confirmation_page/unknown）、消息和可执行操作

## Requirements

### Requirement 1: 页面截图采集

**User Story:** 作为扩展用户，我希望在评论提交后系统能截取页面截图，以便 AI 通过视觉方式判断提交结果。

#### Acceptance Criteria

1. WHEN 评论表单提交完成且页面加载稳定后，THE Screenshot_Capturer SHALL 调用 `chrome.tabs.captureVisibleTab()` 截取当前可见区域的截图并返回 base64 编码的图片数据
2. THE Screenshot_Capturer SHALL 将截图格式设置为 JPEG 且质量参数设置为 80，以平衡图片清晰度和数据传输大小
3. IF `chrome.tabs.captureVisibleTab()` 调用失败，THEN THE Screenshot_Capturer SHALL 返回包含错误信息的失败结果，且验证流程回退到仅使用 DOM 快照的方式
4. WHEN 截图采集成功后，THE Screenshot_Capturer SHALL 在截图数据中包含截图时的页面 URL 和时间戳

### Requirement 2: 评论区智能滚动截图

**User Story:** 作为扩展用户，我希望系统能滚动到评论区域再截图，以便捕获评论提交后的实际显示状态。

#### Acceptance Criteria

1. WHEN 首次截图完成后，THE Content_Script SHALL 尝试定位页面中的评论区域（通过常见选择器如 `#comments`、`.comments`、`#respond`、`.comment-list` 等）
2. WHEN 评论区域被定位到且不在当前可见区域内，THE Content_Script SHALL 将页面滚动到评论区域并等待 500ms 后通知 Screenshot_Capturer 进行第二次截图
3. IF 评论区域无法定位，THEN THE Content_Script SHALL 将页面滚动到底部并等待 500ms 后通知 Screenshot_Capturer 进行第二次截图
4. WHEN 滚动截图完成后，THE Content_Script SHALL 将页面滚动位置恢复到截图前的原始位置

### Requirement 3: VL 视觉模型分析

**User Story:** 作为扩展用户，我希望 AI 能通过"看"页面截图来判断评论是否提交成功，而不仅仅依赖 DOM 文本。

#### Acceptance Criteria

1. WHEN 截图数据和 DOM 快照均已就绪，THE VL_Analyzer SHALL 将截图（base64 图片）和 DOM 快照文本一起发送给 VL_Model 进行多模态分析
2. THE VL_Analyzer SHALL 使用项目已配置的 VL 模型（`selectedCaptchaModel`）进行截图分析
3. THE VL_Analyzer SHALL 在发送给 VL_Model 的 prompt 中明确要求模型从截图中识别以下视觉信号：感谢/成功提示、评论出现在评论列表中、表单已清空、错误提示信息、确认页面按钮
4. WHEN 有两张截图（可见区域 + 评论区域）时，THE VL_Analyzer SHALL 将两张截图同时发送给 VL_Model 以提供更完整的页面视觉上下文
5. THE VL_Analyzer SHALL 返回与现有 `PostSubmitResult` 兼容的结果结构，包含 status（success/error/confirmation_page/unknown）、message 和 actions 字段

### Requirement 4: 截图与 DOM 快照融合验证

**User Story:** 作为扩展用户，我希望系统结合截图视觉判断和 DOM 快照信息来做出更准确的验证决策。

#### Acceptance Criteria

1. THE Post_Submit_Verifier SHALL 同时采集页面截图和 DOM 快照，并将两者一起提供给 VL_Analyzer 进行综合分析
2. WHEN VL_Analyzer 判定为 confirmation_page 时，THE Post_Submit_Verifier SHALL 从 DOM 快照中提取确认按钮的 CSS 选择器并包含在 actions 中
3. IF 截图采集失败，THEN THE Post_Submit_Verifier SHALL 使用仅 DOM 快照的方式调用现有的 `analyzePostSubmit` 函数作为降级方案
4. THE Post_Submit_Verifier SHALL 在 prompt 中指示 VL_Model 优先依据截图视觉信息判断，DOM 快照作为辅助信息提供可操作的元素选择器

### Requirement 5: 权限与消息路由

**User Story:** 作为扩展开发者，我希望扩展具备截图所需的权限，并且消息路由能正确处理截图相关的通信。

#### Acceptance Criteria

1. THE Background_Worker SHALL 在 manifest.json 的 permissions 中声明截图所需的权限（如有必要）
2. WHEN 收到截图请求消息时，THE Background_Worker SHALL 调用 `chrome.tabs.captureVisibleTab()` 并将结果返回给请求方
3. WHEN 收到带截图的验证分析请求时，THE Background_Worker SHALL 将截图数据和 DOM 快照一起转发给 VL_Analyzer
4. THE Background_Worker SHALL 为截图采集和 VL 分析定义新的消息 action 类型，并注册对应的消息处理器

### Requirement 6: 验证循环集成

**User Story:** 作为扩展用户，我希望截图验证无缝集成到现有的 Step 4 验证循环中，不影响现有的确认页处理和重试逻辑。

#### Acceptance Criteria

1. THE Post_Submit_Verifier SHALL 替换 Step 4 验证循环中现有的纯 DOM 快照验证调用，改为使用截图 + DOM 快照的融合验证
2. WHEN 验证循环中需要重新验证时（如确认页提交后），THE Post_Submit_Verifier SHALL 重新采集截图和 DOM 快照
3. THE Post_Submit_Verifier SHALL 保持与现有验证循环相同的最大重试次数（5 轮）和错误处理逻辑
4. WHEN VL 分析返回 confirmation_page 且包含 actions 时，THE Post_Submit_Verifier SHALL 执行 actions 后继续验证循环（与现有逻辑一致）
5. THE Post_Submit_Verifier SHALL 保留现有的 `isCommentVisibleOnPage` 作为 unknown 状态下的最终兜底检查

### Requirement 7: 性能与数据大小控制

**User Story:** 作为扩展用户，我希望截图验证不会显著增加等待时间或导致 API 请求失败。

#### Acceptance Criteria

1. THE Screenshot_Capturer SHALL 将单张截图的 base64 数据大小控制在 500KB 以内（通过 JPEG 质量参数调节）
2. WHEN 截图数据超过 500KB 时，THE Screenshot_Capturer SHALL 降低 JPEG 质量参数并重新压缩直到满足大小限制
3. THE Post_Submit_Verifier SHALL 在截图采集和 VL 分析的总耗时超过 15 秒时进行超时处理，回退到仅 DOM 快照验证
4. THE VL_Analyzer SHALL 在 API 请求中设置 30 秒的超时时间
