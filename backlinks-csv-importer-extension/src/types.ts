/** 源页面信息 */
export interface SourcePageInfo {
  url: string;                 // 源页面 URL（必填）
  pageType?: string;           // 页面类型：博客、CMS、留言板等（可选）
  language?: string;           // 语言代码：EN、FR、ZH、KO、RU 等（可选）
  mobileFriendly?: boolean;    // 是否移动友好（可选）
}

/** 锚链接信息 */
export interface AnchorInfo {
  targetUrl: string;           // 目标 URL
  linkType?: string;           // 链接类型：文本、图片
  attributes: string[];        // 链接属性列表：Nofollow、UGC、内容、新增、页脚等
}

/** 单条外链记录（不包含内部链接字段） */
export interface BacklinkRecord {
  pageAS: number;              // 页面权威分数，整数
  sourcePageInfo: SourcePageInfo;  // 源页面信息
  externalLinks: number;       // 外部链接数，整数
  anchorInfo: AnchorInfo;      // 锚链接和目标 URL 信息
  firstSeenDate: string;       // 首次发现日期，ISO 8601 格式
  lastSeenDate: string;        // 上次发现日期，ISO 8601 格式
}

/** CSV 解析结果 */
export interface ParseResult {
  records: BacklinkRecord[];
  failedRows: number;
  totalRows: number;
}

/** 去重结果 */
export interface DeduplicationResult {
  records: BacklinkRecord[];
  removedCount: number;
}

/** 导入结果统计 */
export interface ImportResult {
  totalRows: number;           // CSV 总行数（不含表头）
  successCount: number;        // 成功解析的记录数
  duplicateCount: number;      // 去重移除的记录数
  failedCount: number;         // 解析失败的行数
}

/** 评论可用性状态 */
export type CommentStatus = 'commentable' | 'login_required' | 'uncertain' | 'filtered_out';

/** 评论状态显示标签映射 */
export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  commentable: '✅ 可评论',
  login_required: '❌ 需登录',
  uncertain: '⚠️ 不确定',
  filtered_out: '🚫 已过滤',
};

/** 页面分析结果 */
export interface AnalysisResult {
  url: string;
  hasCommentForm: boolean;
  hasLoginBarrier: boolean;
  fetchError: boolean;
  redirectedToLogin: boolean;
}

/** 静态规则预过滤结果 */
export interface FilterResult {
  filtered: BacklinkRecord[];
  pending: BacklinkRecord[];
}

/** 清洗统计摘要 */
export interface CleansingStats {
  commentable: number;
  loginRequired: number;
  uncertain: number;
  filteredOut: number;
}

/** Comment_Status 映射：sourceUrl → CommentStatus */
export type CommentStatusMap = Record<string, CommentStatus>;

/** 外链模板 */
export interface LinkTemplate {
  id: string;       // 唯一标识符
  name: string;     // 模板名称（必填，非空）
  url: string;      // 网址
  keyword: string;  // 关键词
}


/** 评论表单类型 */
export type CommentFormType = 'wordpress' | 'generic' | 'richtext' | 'none';

/** 表单检测结果 */
export interface CommentFormInfo {
  formType: CommentFormType;
  hasNameField: boolean;
  hasEmailField: boolean;
  hasUrlField: boolean;
  hasCaptcha: boolean;
  htmlAllowed: boolean;
}

/** Content Script 提取结果 */
export interface ContentExtractionResult {
  success: boolean;
  title?: string;
  body?: string;
  formInfo?: CommentFormInfo;
  error?: string;
}

/** AI 生成请求参数 */
export interface GenerateCommentParams {
  title: string;
  body: string;
  template: LinkTemplate;
  htmlAllowed: boolean;
}

/** AI 生成结果 */
export interface GenerateCommentResult {
  success: boolean;
  comment?: string;
  error?: string;
}

/** 填充提交请求参数 */
export interface FillAndSubmitParams {
  comment: string;
  template: LinkTemplate;
  formInfo: CommentFormInfo;
}

/** 填充提交结果 */
export interface FillAndSubmitResult {
  success: boolean;
  captchaDetected: boolean;
  error?: string;
}

/** Background Script 消息协议 */
export type MessageAction =
  | 'auto-comment:start'
  | 'extract-content'
  | 'content-result'
  | 'generate-comment'
  | 'comment-generated'
  | 'fill-and-submit'
  | 'submit-result'
  | 'auto-comment:result'
  | 'snapshot-page'
  | 'ai-analyze'
  | 'execute-actions';

export interface Message {
  action: MessageAction;
  payload: unknown;
}

/** 页面快照中的交互元素 */
export interface SnapshotElement {
  selector: string;       // 唯一 CSS 选择器
  tag: string;            // 标签名
  type?: string;          // input type
  name?: string;          // name 属性
  id?: string;            // id 属性
  placeholder?: string;   // placeholder
  label?: string;         // 关联的 label 文本
  text?: string;          // 元素可见文本（button/submit）
  value?: string;         // 当前值
}

/** 页面快照 */
export interface PageSnapshot {
  title: string;
  bodyExcerpt: string;
  forms: {
    selector: string;
    elements: SnapshotElement[];
  }[];
  hasCaptcha: boolean;
  htmlAllowed: boolean;
  errorMessages?: string[];
  pageLang?: string;
}

/** AI 返回的单个操作指令 */
export interface AIAction {
  type: 'scroll' | 'click' | 'type';
  selector: string;
  value?: string;
}

/** AI 分析结果 */
export interface AIAnalyzeResult {
  success: boolean;
  comment?: string;
  actions?: AIAction[];
  hasCaptcha?: boolean;
  error?: string;
}
