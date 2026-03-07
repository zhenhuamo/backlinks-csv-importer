# 缺陷修复需求文档

## 简介

自动评论功能在评论成功提交后，提交后验证环节（`post-submit-analyze`）未能正确识别成功状态，导致错误触发重试逻辑。重试时表单已被页面刷新清空，在空表单上重新提交触发了浏览器 HTML5 required 字段验证弹窗。

根本原因有两个：
1. `analyzePostSubmit` 的 AI 提示词没有接收到刚提交的评论内容，AI 无法通过在页面中查找该评论文本来判断是否成功
2. 验证循环在 AI 返回 `unknown` 状态时直接跳出循环，没有进一步尝试判断成功，且重试前未检查评论是否已经显示在页面上

## 缺陷分析

### 当前行为（缺陷）

1.1 WHEN 评论已成功提交且页面刷新后显示了新评论 THEN 系统的 `analyzePostSubmit` 因缺少原始评论内容作为参照，无法将页面中出现的评论文本与刚提交的内容进行匹配，导致返回 `unknown` 而非 `success`

1.2 WHEN `analyzePostSubmit` 返回 `unknown` 状态 THEN 验证循环直接 break 跳出，最终显示"操作已完成，请检查页面确认评论是否发布成功"的模糊提示，未能明确告知用户成功

1.3 WHEN WordPress 等站点提交后页面刷新、表单被清空（这实际上是成功的信号） THEN 系统未将"表单已清空 + 页面正文中出现评论内容"识别为成功状态

1.4 WHEN `analyzePostSubmit` 返回 `error` 状态触发重试逻辑 THEN 系统未检查评论是否已经显示在页面上就直接尝试重新提交，在已清空的表单上触发浏览器原生的 required 字段验证

1.5 WHEN AI 提示词中没有指导 AI 考虑不同网站的提交后行为差异（WordPress 直接刷新、日本网站跳转确认页、AJAX 无刷新等） THEN AI 对多样化的成功场景判断能力不足，容易误判

### 期望行为（正确）

2.1 WHEN 评论已成功提交且页面刷新后显示了新评论 THEN 系统 SHALL 将原始评论内容传递给 `analyzePostSubmit`，使 AI 能够在页面正文中搜索匹配的评论文本，从而正确识别为 `success`

2.2 WHEN `analyzePostSubmit` 返回 `unknown` 状态 THEN 系统 SHALL 将其视为可能的成功（因为没有明确的错误信号），向用户显示更积极的提示，且不触发重试逻辑

2.3 WHEN WordPress 等站点提交后页面刷新、表单被清空且页面正文中出现了提交的评论内容 THEN 系统 SHALL 将此识别为 `success` 状态

2.4 WHEN 验证循环准备触发重试逻辑前 THEN 系统 SHALL 先检查页面快照中是否已包含之前提交的评论内容，如果评论已可见则判定为成功并停止重试

2.5 WHEN AI 分析提交后页面状态时 THEN 系统 SHALL 在提示词中指导 AI 综合考虑多种成功信号：感谢信息、评论出现在列表中、表单被清空、页面 URL 变化、评论待审核提示等，以适应不同网站的行为差异

### 不变行为（回归防护）

3.1 WHEN `analyzePostSubmit` 明确识别到 `confirmation_page` 状态（如日本网站的预览确认页） THEN 系统 SHALL CONTINUE TO 执行确认页上的提交按钮点击操作

3.2 WHEN `analyzePostSubmit` 明确识别到 `error` 状态且评论确实未出现在页面上 THEN 系统 SHALL CONTINUE TO 触发重试逻辑，使用 `ai-retry-comment` 生成新评论并重新提交

3.3 WHEN 页面存在验证码（captcha） THEN 系统 SHALL CONTINUE TO 提示用户手动完成验证码并提交

3.4 WHEN 初始页面分析和评论生成阶段（Step 1-3） THEN 系统 SHALL CONTINUE TO 按原有流程执行快照、AI 分析、操作执行，不受本次修复影响

3.5 WHEN 重试次数超过 MAX_RETRIES 且评论确实未成功 THEN 系统 SHALL CONTINUE TO 显示失败信息并停止重试
