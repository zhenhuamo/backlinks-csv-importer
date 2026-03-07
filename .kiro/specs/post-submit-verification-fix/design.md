# 提交后验证修复 缺陷修复设计

## 概述

自动评论功能的提交后验证环节（`analyzePostSubmit`）无法正确识别评论已成功提交的状态，导致错误触发重试逻辑。核心问题有两个：(1) AI 提示词缺少原始评论内容作为参照，无法通过在页面中查找评论文本来判断成功；(2) 验证循环对 `unknown` 状态处理不当，且重试前未检查评论是否已可见。

修复策略：将原始评论内容传递到验证链路中，增强 AI 提示词的成功信号识别能力，改进验证循环的状态处理逻辑，并在重试前增加评论可见性检查作为安全网。

## 术语表

- **Bug_Condition (C)**：提交后验证返回 `unknown` 或 `error`，但评论实际已成功提交并可见于页面中
- **Property (P)**：当评论已成功提交时，系统应正确识别为 `success` 并停止重试
- **Preservation**：确认页处理、真正的错误重试、验证码提示等现有行为必须保持不变
- **`analyzePostSubmit`**：`ai-comment-generator.ts` 中的函数，调用 AI 分析提交后的页面状态，返回 `success`/`error`/`confirmation_page`/`unknown`
- **`runAutoComment`**：`auto-comment.ts` 中的主流程函数，包含提交后验证循环（Step 4）
- **`post-submit-analyze`**：`background.ts` 中的消息处理器，桥接 side panel 与 `analyzePostSubmit` 函数
- **`lastComment`**：验证循环中保存的最近一次提交的评论文本

## 缺陷详情

### 故障条件

当评论已成功提交（页面刷新后评论出现在页面正文中），但 `analyzePostSubmit` 因缺少原始评论内容而无法匹配，返回 `unknown` 或 `error` 时，触发缺陷。验证循环随后要么显示模糊提示（`unknown` 时 break），要么在已清空的表单上尝试重新提交（`error` 时重试），触发浏览器 HTML5 required 字段验证。

**形式化规约：**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { verifyStatus: string, pageBodyExcerpt: string, submittedComment: string }
  OUTPUT: boolean

  commentVisibleOnPage := pageBodyExcerpt CONTAINS submittedComment
                          OR fuzzyMatch(pageBodyExcerpt, submittedComment) > 0.8

  RETURN commentVisibleOnPage
         AND input.verifyStatus IN ['unknown', 'error']
END FUNCTION
```

### 示例

- **WordPress 站点**：评论提交后页面刷新，评论出现在评论列表中，表单被清空。`analyzePostSubmit` 因不知道原始评论内容，无法确认页面中的评论就是刚提交的，返回 `unknown` → 显示模糊提示"请检查页面确认评论是否发布成功"
- **通用博客站点**：评论提交后 AJAX 更新，评论出现在列表中。AI 返回 `unknown`（因为没有明确的感谢信息）→ 同上
- **日本网站**：评论提交后页面跳转到文章页，评论已显示。AI 返回 `error`（误判页面变化为错误）→ 系统尝试在已清空的表单上重新提交 → 触发浏览器 required 字段验证弹窗
- **边界情况**：评论包含特殊字符或 HTML 标签，页面渲染后文本与原始内容略有差异 → 需要模糊匹配

## 期望行为

### 保持不变的行为

**不变行为：**
- 当 `analyzePostSubmit` 返回 `confirmation_page` 且包含操作指令时，系统必须继续执行确认页上的按钮点击
- 当 `analyzePostSubmit` 返回 `error` 且评论确实未出现在页面上时，系统必须继续触发重试逻辑
- 验证码（captcha）检测和用户提示流程必须保持不变
- 初始页面分析和评论生成阶段（Step 1-3）不受影响
- 重试次数超过 `MAX_RETRIES` 且评论确实未成功时，显示失败信息并停止

**范围：**
所有不涉及提交后验证状态判断的输入应完全不受本次修复影响，包括：
- 初始页面快照和 AI 分析流程
- 评论生成和表单填充流程
- 操作指令执行流程
- 确认页检测和处理流程（当评论确实未提交时）

## 假设的根本原因

基于缺陷分析，最可能的问题是：

1. **`analyzePostSubmit` 缺少评论内容参数**：函数签名为 `(snapshot, apiKey)`，没有接收原始评论内容。AI 提示词中也没有包含评论文本，导致 AI 无法通过在 `bodyExcerpt` 中查找评论来判断成功。
   - 当前 AI 只能依赖"感谢信息"等通用信号，对于直接刷新显示评论的站点无法判断
   - `snapshotToText(snapshot)` 和 `snapshot.bodyExcerpt` 中可能包含评论文本，但 AI 不知道要找什么

2. **消息传递链路缺少评论内容**：`auto-comment.ts` 发送 `post-submit-analyze` 消息时 payload 只有 `{ snapshot, apiKey }`，`background.ts` 处理器也只解构这两个字段，没有传递 `lastComment`

3. **`unknown` 状态处理过于消极**：验证循环中 `unknown` 状态直接 `break` 跳出，最终显示模糊的 warning 提示。实际上 `unknown` 意味着"没有明确的错误信号"，应该被视为可能的成功

4. **重试前缺少评论可见性检查**：当 AI 返回 `error` 时，系统直接进入重试流程，没有先检查 `verifySnapshot.bodyExcerpt` 中是否已包含 `lastComment`。如果评论已可见，重试是多余且有害的

## 正确性属性

Property 1: 故障条件 - 评论已可见时应识别为成功

_For any_ 输入，当评论已成功提交且页面快照的 `bodyExcerpt` 中包含已提交的评论内容（`isBugCondition` 返回 true）时，修复后的验证流程 SHALL 将最终状态判定为成功（`finalSuccess = true`），不触发重试逻辑，并向用户显示成功提示。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: 保持不变 - 评论未可见时的错误处理行为

_For any_ 输入，当评论未出现在页面快照中（`isBugCondition` 返回 false）且 `analyzePostSubmit` 返回 `error` 状态时，修复后的验证流程 SHALL 与原始流程产生相同的行为：触发重试逻辑（在重试次数内）或显示失败信息（超过重试次数），保持现有的错误恢复机制不变。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## 修复实现

### 所需变更

假设根本原因分析正确：

**文件**: `backlinks-csv-importer-extension/src/ai-comment-generator.ts`

**函数**: `analyzePostSubmit`

**具体变更**:
1. **增加 `commentContent` 参数**：修改函数签名，增加可选的 `commentContent?: string` 参数
2. **增强 AI 系统提示词**：
   - 添加指导 AI 在页面正文中搜索原始评论内容的规则
   - 添加多种成功信号的识别指导（表单清空、感谢信息、评论出现在列表中、URL 变化、待审核提示等）
   - 添加对不同网站行为差异的说明（WordPress 直接刷新、日本网站确认页、AJAX 无刷新等）
3. **增强 AI 用户提示词**：在用户提示词中包含原始评论内容，标注为【刚提交的评论内容】

---

**文件**: `backlinks-csv-importer-extension/src/background.ts`

**处理器**: `post-submit-analyze` 消息处理器

**具体变更**:
1. **传递评论内容**：从 payload 中解构 `commentContent` 字段
2. **调用更新**：将 `commentContent` 传递给 `analyzePostSubmit` 函数

---

**文件**: `backlinks-csv-importer-extension/src/auto-comment.ts`

**函数**: `runAutoComment` 的验证循环（Step 4）

**具体变更**:
1. **发送评论内容**：在 `post-submit-analyze` 消息的 payload 中添加 `commentContent: lastComment`
2. **改进 `unknown` 状态处理**：将 `unknown` 视为可能的成功，不触发重试，显示更积极的提示（如"评论可能已成功发布，请检查页面确认"），或者在 `unknown` 时也执行评论可见性检查
3. **增加评论可见性安全网**：在 `error` 分支进入重试前，检查 `verifySnapshot.bodyExcerpt` 是否包含 `lastComment`（不区分大小写的子串匹配）。如果评论已可见，判定为成功并 break
4. **`unknown` + 评论可见 = 成功**：在 `unknown` 分支也检查评论可见性，如果可见则设置 `finalSuccess = true`

---

**文件**: `backlinks-csv-importer-extension/src/types.ts`（可选）

**具体变更**:
1. 如果需要，更新 `MessageAction` 类型以保持类型安全（当前 `post-submit-analyze` 未在 `MessageAction` 联合类型中，可考虑添加）

## 测试策略

### 验证方法

测试策略分两阶段：首先在未修复代码上复现缺陷（探索性测试），然后验证修复的正确性和行为保持。

### 探索性故障条件检查

**目标**：在实施修复前，复现缺陷并确认根本原因分析。如果复现结果与假设不符，需要重新分析。

**测试计划**：构造模拟场景，验证当前代码在评论已成功提交但 AI 返回 `unknown`/`error` 时的行为。

**测试用例**：
1. **WordPress 刷新场景**：模拟 `analyzePostSubmit` 返回 `unknown`，验证循环直接 break，最终显示 warning 提示（在未修复代码上会失败 — 无法识别成功）
2. **AI 误判为 error 场景**：模拟 `analyzePostSubmit` 返回 `error`，验证系统尝试在已清空表单上重新提交（在未修复代码上会触发 required 验证）
3. **评论内容缺失场景**：检查 `analyzePostSubmit` 的 AI 提示词中是否包含原始评论内容（在未修复代码上不包含）
4. **消息传递链路检查**：验证 `post-submit-analyze` 消息 payload 中是否包含评论内容（在未修复代码上不包含）

**预期反例**：
- `analyzePostSubmit` 在评论已可见的页面上返回 `unknown` 而非 `success`
- 验证循环在 `error` 状态时不检查评论可见性就直接重试
- 可能原因：AI 提示词缺少评论内容参照、验证循环缺少可见性检查

### 修复检查

**目标**：验证对于所有触发缺陷条件的输入，修复后的函数产生期望行为。

**伪代码：**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := runAutoComment_fixed(input)
  ASSERT result.finalSuccess == true
  ASSERT result.retryTriggered == false
  ASSERT result.statusMessage CONTAINS '成功'
END FOR
```

### 保持检查

**目标**：验证对于所有不触发缺陷条件的输入，修复后的函数与原始函数产生相同结果。

**伪代码：**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT runAutoComment_original(input) = runAutoComment_fixed(input)
END FOR
```

**测试方法**：推荐使用属性测试进行保持检查，因为：
- 可以自动生成大量测试用例覆盖输入域
- 能捕获手动单元测试可能遗漏的边界情况
- 对所有非缺陷输入的行为不变性提供强保证

**测试计划**：先在未修复代码上观察非缺陷输入的行为，然后编写属性测试捕获该行为。

**测试用例**：
1. **确认页处理保持**：验证 `confirmation_page` 状态时仍然执行确认按钮点击，修复前后行为一致
2. **真正错误重试保持**：验证 `error` 状态且评论未可见时，重试逻辑仍然正常工作
3. **验证码提示保持**：验证 `hasCaptcha` 为 true 时仍然显示手动完成提示
4. **重试次数限制保持**：验证超过 `MAX_RETRIES` 时仍然停止重试并显示失败

### 单元测试

- 测试 `analyzePostSubmit` 接收 `commentContent` 参数后，AI 提示词中包含评论内容
- 测试验证循环中 `unknown` 状态不触发重试，显示积极提示
- 测试验证循环中 `error` 状态 + 评论可见时判定为成功
- 测试验证循环中 `error` 状态 + 评论不可见时正常重试
- 测试 `background.ts` 消息处理器正确传递 `commentContent`

### 属性测试

- 生成随机评论内容和页面快照，验证当快照包含评论内容时，无论 AI 返回什么状态，系统最终判定为成功
- 生成随机评论内容和不包含该内容的页面快照，验证 `error` 状态时重试逻辑正常触发
- 生成各种 `analyzePostSubmit` 返回值组合，验证 `confirmation_page` 处理逻辑不受影响

### 集成测试

- 端到端测试：模拟完整的评论提交流程，验证 WordPress 刷新场景下正确识别成功
- 端到端测试：模拟确认页场景，验证确认页处理流程不受影响
- 端到端测试：模拟真正的提交错误场景，验证重试逻辑在评论不可见时正常工作
