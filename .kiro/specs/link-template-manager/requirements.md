# 需求文档

## 简介

在现有的 backlinks-csv-importer-extension Chrome 扩展中新增"外链模板"功能。用户可以预先配置外链信息模板（包含名称、网址、关键词），在浏览"可评论"页面时快速复制模板字段值用于发布外链评论。模板数据持久化保存在 chrome.storage.local 中，支持增删改查操作。

## 术语表

- **Side_Panel**: Chrome 扩展的侧边栏面板，承载所有 UI 交互
- **Link_Template**: 外链模板，包含名称（Name）、网址（URL）、关键词（Keyword）三个字段的数据结构
- **Template_Manager**: 外链模板管理模块，负责模板的增删改查和 UI 渲染
- **Storage_Layer**: 存储层，基于 chrome.storage.local 的数据持久化模块
- **Clipboard_API**: 浏览器剪贴板 API（navigator.clipboard.writeText），用于复制文本到剪贴板

## 需求

### 需求 1：外链模板数据结构与存储

**用户故事：** 作为外链推广人员，我想要持久化保存外链模板信息，以便关闭浏览器后再次打开时模板数据不会丢失。

#### 验收标准

1. THE Storage_Layer SHALL 使用独立的存储键（linkTemplates）将 Link_Template 列表序列化为 JSON 字符串保存到 chrome.storage.local
2. THE Link_Template SHALL 包含以下字段：唯一标识符（id）、名称（name）、网址（url）、关键词（keyword）
3. WHEN Side_Panel 初始化时，THE Template_Manager SHALL 从 Storage_Layer 加载已保存的 Link_Template 列表并渲染到界面
4. IF Storage_Layer 读取数据失败，THEN THE Template_Manager SHALL 返回空列表并在控制台记录错误信息

### 需求 2：添加外链模板

**用户故事：** 作为外链推广人员，我想要添加新的外链模板，以便保存常用的外链信息供后续快速使用。

#### 验收标准

1. THE Side_Panel SHALL 在外链模板区域显示一个"添加模板"按钮
2. WHEN 用户点击"添加模板"按钮时，THE Template_Manager SHALL 显示一个包含名称、网址、关键词三个输入框的表单
3. WHEN 用户填写完表单并点击"保存"按钮时，THE Template_Manager SHALL 生成唯一标识符、创建 Link_Template 对象、追加到列表并保存到 Storage_Layer
4. WHEN 保存成功后，THE Template_Manager SHALL 清空表单输入框并刷新模板列表显示
5. IF 用户提交表单时名称字段为空，THEN THE Template_Manager SHALL 阻止保存并提示用户"名称不能为空"
6. WHEN 用户点击"取消"按钮时，THE Template_Manager SHALL 隐藏表单并清空输入内容

### 需求 3：显示外链模板列表

**用户故事：** 作为外链推广人员，我想要查看所有已保存的外链模板，以便快速找到需要使用的模板信息。

#### 验收标准

1. THE Template_Manager SHALL 以卡片形式逐条显示所有已保存的 Link_Template
2. THE Template_Manager SHALL 在每条 Link_Template 卡片中显示三行信息：名称、网址、关键词，每行格式为"标签: 值"
3. THE Template_Manager SHALL 在每个字段值旁边显示一个复制按钮（📋 图标）
4. WHEN 没有已保存的 Link_Template 时，THE Template_Manager SHALL 显示"暂无模板，请点击添加"的提示文本

### 需求 4：复制模板字段值

**用户故事：** 作为外链推广人员，我想要一键复制模板中的某个字段值到剪贴板，以便快速粘贴到评论表单中。

#### 验收标准

1. WHEN 用户点击某个字段旁边的复制按钮时，THE Template_Manager SHALL 调用 Clipboard_API 将该字段的值写入系统剪贴板
2. WHEN 复制成功后，THE Template_Manager SHALL 将复制按钮图标临时变为"✅"并在 1 秒后恢复为"📋"
3. IF Clipboard_API 调用失败，THEN THE Template_Manager SHALL 在控制台记录错误信息

### 需求 5：编辑外链模板

**用户故事：** 作为外链推广人员，我想要编辑已保存的外链模板，以便在外链信息变更时及时更新。

#### 验收标准

1. THE Template_Manager SHALL 在每条 Link_Template 卡片上显示一个"编辑"按钮
2. WHEN 用户点击"编辑"按钮时，THE Template_Manager SHALL 将该卡片切换为可编辑的表单模式，表单中预填充当前字段值
3. WHEN 用户修改字段并点击"保存"按钮时，THE Template_Manager SHALL 更新对应的 Link_Template 对象并保存到 Storage_Layer
4. WHEN 用户点击"取消"按钮时，THE Template_Manager SHALL 放弃修改并恢复为卡片显示模式
5. IF 用户编辑时将名称字段清空，THEN THE Template_Manager SHALL 阻止保存并提示用户"名称不能为空"

### 需求 6：删除外链模板

**用户故事：** 作为外链推广人员，我想要删除不再需要的外链模板，以便保持模板列表整洁。

#### 验收标准

1. THE Template_Manager SHALL 在每条 Link_Template 卡片上显示一个"删除"按钮
2. WHEN 用户点击"删除"按钮时，THE Template_Manager SHALL 显示确认对话框，内容为"确定要删除该模板吗？"
3. WHEN 用户确认删除后，THE Template_Manager SHALL 从列表中移除对应的 Link_Template 并保存更新后的列表到 Storage_Layer
4. WHEN 删除成功后，THE Template_Manager SHALL 刷新模板列表显示

### 需求 7：外链模板 UI 集成

**用户故事：** 作为外链推广人员，我想要在 Side Panel 中方便地访问外链模板功能，以便与现有的外链数据导入功能无缝配合使用。

#### 验收标准

1. THE Side_Panel SHALL 在现有工具栏区域添加一个"外链模板"按钮，用于展开或收起模板管理区域
2. WHEN 用户点击"外链模板"按钮时，THE Side_Panel SHALL 切换模板管理区域的显示与隐藏状态
3. THE Template_Manager SHALL 使用与现有 Side_Panel 一致的视觉风格（字体、颜色、圆角、间距）
4. THE Template_Manager SHALL 所有 UI 文本使用中文显示
