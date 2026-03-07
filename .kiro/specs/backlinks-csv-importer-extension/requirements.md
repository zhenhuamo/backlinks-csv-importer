# 需求文档

## 简介

本功能是一个 Chrome 浏览器扩展插件，用于导入特定格式的 CSV 外链（Backlinks）数据文件。该 CSV 文件包含指向 crazycattle3d.io 域名的外链信息，来源页面分布在全球各类网站（论坛、博客、CMS、留言板等），语言涵盖中英日韩俄法等。插件需要解析 CSV 数据、提取外链相关字段（忽略内部链接数据）、对外链进行去重处理，并以结构化方式展示导入结果。

## 术语表

- **Extension**：Chrome 浏览器扩展插件，本系统的主体
- **CSV_Parser**：CSV 文件解析模块，负责读取和解析 CSV 格式的外链数据
- **Deduplicator**：去重模块，负责识别和移除重复的外链记录
- **Backlink_Record**：单条外链记录，包含页面 AS、源页面信息、外部链接数、锚链接信息、日期等字段（不包含内部链接字段）
- **Page_AS**：页面权威分数（Authority Score），数值类型，表示页面的权威程度
- **Source_Page_Info**：源页面信息，包含 URL、页面类型（博客/CMS/留言板等）、语言代码、是否移动友好等属性，各属性之间用 ` | ` 分隔
- **Anchor_Info**：锚链接和目标 URL 信息，包含目标 URL、链接类型（文本/图片）、链接属性（Nofollow/UGC/内容/新增/页脚等），各属性之间用 ` | ` 分隔
- **Discovery_Date**：发现日期，支持中文绝对日期格式（如"2026年2月8日"）和相对日期格式（如"12 天前"）
- **Import_Result**：导入结果，包含成功导入的记录数、去重移除的记录数、解析失败的记录数等统计信息
- **Storage**：浏览器本地存储模块，负责持久化保存导入的外链数据

## 需求

### 需求 1：CSV 文件选择与读取

**用户故事：** 作为 SEO 分析人员，我希望能够在 Chrome 插件中选择并读取本地 CSV 外链数据文件，以便将外链数据导入到插件中进行管理。

#### 验收标准

1. WHEN 用户点击导入按钮，THE Extension SHALL 打开文件选择对话框，仅允许选择 `.csv` 格式的文件
2. WHEN 用户选择了一个有效的 CSV 文件，THE Extension SHALL 读取该文件的全部内容并传递给 CSV_Parser 进行解析
3. WHILE 文件正在读取中，THE Extension SHALL 显示加载进度指示器
4. IF 用户选择的文件不是有效的 CSV 格式，THEN THE Extension SHALL 显示错误提示"请选择有效的 CSV 文件"

### 需求 2：CSV 数据解析

**用户故事：** 作为 SEO 分析人员，我希望插件能够正确解析特定格式的 CSV 外链数据，以便将每一行数据转换为结构化的外链记录。

#### 验收标准

1. WHEN CSV_Parser 接收到 CSV 文件内容，THE CSV_Parser SHALL 识别并跳过第一行表头（"页面 AS,源页面标题和 URL,外部链接,内部链接,锚链接和目标 URL,首次发现日期,上次发现日期"）
2. WHEN CSV_Parser 解析一行数据，THE CSV_Parser SHALL 将该行拆分为 7 个字段（页面 AS、源页面标题和 URL、外部链接、内部链接、锚链接和目标 URL、首次发现日期、上次发现日期），但仅提取并存储除"内部链接"以外的 6 个字段到 Backlink_Record 中
3. WHEN CSV_Parser 解析"源页面标题和 URL"字段，THE CSV_Parser SHALL 使用 ` | ` 作为分隔符提取源页面 URL、页面类型、语言代码、移动友好属性（各子属性均为可选，仅 URL 为必填）
4. WHEN CSV_Parser 解析"锚链接和目标 URL"字段，THE CSV_Parser SHALL 使用 ` | ` 作为分隔符提取目标 URL、链接类型、链接属性列表（如 Nofollow、UGC、内容、新增、页脚等）
5. WHEN CSV_Parser 解析日期字段，THE CSV_Parser SHALL 支持中文绝对日期格式（如"2026年2月8日"）和相对日期格式（如"12 天前"、"7 天前"）
6. IF 某一行数据字段数量不等于 7 或包含无法解析的内容，THEN THE CSV_Parser SHALL 跳过该行并将该行记录为解析失败
7. THE CSV_Parser SHALL 将页面 AS、外部链接字段解析为整数类型

### 需求 3：外链去重处理

**用户故事：** 作为 SEO 分析人员，我希望导入时能够自动去除重复的外链记录，以便获得准确的外链数据集。

#### 验收标准

1. WHEN Deduplicator 接收到解析后的 Backlink_Record 列表，THE Deduplicator SHALL 基于"源页面 URL"和"目标 URL"的组合作为唯一键进行去重
2. WHEN 存在重复记录时，THE Deduplicator SHALL 保留"上次发现日期"最新的那条记录
3. THE Deduplicator SHALL 在去重前对源页面 URL 进行标准化处理，包括移除尾部斜杠、统一 HTTP/HTTPS 协议、移除 URL 中无关的查询参数排序差异
4. THE Deduplicator SHALL 返回去重后的 Backlink_Record 列表以及被移除的重复记录数量

### 需求 4：导入结果展示

**用户故事：** 作为 SEO 分析人员，我希望导入完成后能够看到导入结果的统计摘要和外链数据列表，以便快速了解导入情况。

#### 验收标准

1. WHEN 导入流程完成，THE Extension SHALL 显示 Import_Result 统计摘要，包含：总行数、成功导入数、去重移除数、解析失败数
2. WHEN 导入流程完成，THE Extension SHALL 以表格形式展示去重后的 Backlink_Record 列表，包含页面 AS、源页面 URL、外部链接数、目标 URL、链接类型、首次发现日期、上次发现日期等列（不包含内部链接列）
3. THE Extension SHALL 支持按页面 AS 降序对外链列表进行默认排序
4. WHEN 用户点击表格列标题，THE Extension SHALL 按该列对外链列表进行升序或降序排序切换

### 需求 5：数据持久化存储

**用户故事：** 作为 SEO 分析人员，我希望导入的外链数据能够保存在浏览器本地，以便关闭插件后再次打开时仍能查看之前导入的数据。

#### 验收标准

1. WHEN 导入流程成功完成，THE Storage SHALL 将去重后的 Backlink_Record 列表保存到 Chrome 浏览器的本地存储中
2. WHEN 用户打开 Extension 的侧边栏面板，THE Extension SHALL 从 Storage 中加载已保存的 Backlink_Record 列表并展示
3. WHEN 用户再次导入新的 CSV 文件，THE Storage SHALL 将新数据与已有数据合并，并再次执行去重处理
4. IF Storage 存储操作失败，THEN THE Extension SHALL 显示错误提示并保留当前内存中的数据不丢失

### 需求 6：数据清除

**用户故事：** 作为 SEO 分析人员，我希望能够清除所有已导入的外链数据，以便重新开始数据分析。

#### 验收标准

1. WHEN 用户点击"清除数据"按钮，THE Extension SHALL 显示确认对话框，提示"确定要清除所有已导入的外链数据吗？"
2. WHEN 用户确认清除操作，THE Storage SHALL 删除所有已保存的 Backlink_Record 数据，THE Extension SHALL 将界面恢复到初始空状态
3. WHEN 用户取消清除操作，THE Extension SHALL 保持当前数据和界面不变

### 需求 7：CSV 数据序列化与反序列化

**用户故事：** 作为 SEO 分析人员，我希望导入的外链数据能够被正确地序列化存储和反序列化读取，以确保数据在存取过程中不丢失或损坏。

#### 验收标准

1. THE Extension SHALL 将 Backlink_Record 列表序列化为 JSON 格式进行存储
2. THE Extension SHALL 将存储的 JSON 数据反序列化为 Backlink_Record 列表进行展示
3. FOR ALL 有效的 Backlink_Record 列表，序列化后再反序列化 SHALL 产生与原始列表等价的对象（往返一致性）

### 需求 8：侧边栏固定显示

**用户故事：** 作为 SEO 分析人员，我希望插件点击后能够固定显示在浏览器侧边栏中，切换到其它页面标签时不会消失，以便在浏览不同网页时持续查看和操作外链数据。

#### 验收标准

1. WHEN 用户点击扩展图标，THE Extension SHALL 使用 Chrome Side Panel API（chrome.sidePanel）在浏览器右侧打开侧边栏面板
2. WHEN 侧边栏面板已打开且用户切换到其它浏览器标签页，THE Extension SHALL 保持侧边栏面板持续显示，不关闭也不重置状态
3. WHEN 侧边栏面板已打开且用户再次点击扩展图标，THE Extension SHALL 关闭侧边栏面板
4. THE Extension SHALL 在 manifest.json 中声明 "sidePanel" 权限，并配置 side_panel 的默认页面路径
5. WHEN 侧边栏面板打开时，THE Extension SHALL 展示与原 Popup 相同的完整功能界面（文件导入、数据展示、排序、清除等）
