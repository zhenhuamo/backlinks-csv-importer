import { BacklinkRecord, CommentStatusMap, DeduplicationResult } from './types';
import { deduplicate } from './deduplicator';

const STORAGE_KEY = 'backlinks';
const COMMENT_STATUS_KEY = 'commentStatuses';

/** Custom error class for storage operations */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * 保存外链记录到 chrome.storage.local
 * 序列化为 JSON 格式
 */
export async function saveRecords(records: BacklinkRecord[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(records) });
  } catch {
    throw new StorageError('数据保存失败，请检查浏览器存储空间');
  }
}

/**
 * 从 chrome.storage.local 加载已保存的外链记录
 * 反序列化 JSON 为 BacklinkRecord 列表
 * 读取失败时返回空列表
 */
export async function loadRecords(): Promise<BacklinkRecord[]> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const data = result[STORAGE_KEY];
    if (!data) return [];
    return JSON.parse(data as string) as BacklinkRecord[];
  } catch (error) {
    console.error('数据加载失败，请重新导入', error);
    return [];
  }
}

/**
 * 清除所有已保存的外链记录及评论状态
 */
export async function clearRecords(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    await clearCommentStatuses();
  } catch {
    throw new StorageError('数据清除失败');
  }
}

/**
 * 合并新数据与已有数据，并执行去重
 * 加载已有数据 → 拼接新数据 → 去重 → 保存
 */
export async function mergeAndSave(newRecords: BacklinkRecord[]): Promise<DeduplicationResult> {
  const existing = await loadRecords();
  const combined = [...existing, ...newRecords];
  const result = deduplicate(combined);
  await saveRecords(result.records);
  return result;
}

/**
 * 保存评论状态映射到 chrome.storage.local
 * 序列化为 JSON 字符串
 */
export async function saveCommentStatuses(statuses: CommentStatusMap): Promise<void> {
  try {
    await chrome.storage.local.set({ [COMMENT_STATUS_KEY]: JSON.stringify(statuses) });
  } catch {
    throw new StorageError('评论状态保存失败，请检查浏览器存储空间');
  }
}

/**
 * 从 chrome.storage.local 加载评论状态映射
 * 读取失败或数据不存在时返回空对象
 */
export async function loadCommentStatuses(): Promise<CommentStatusMap> {
  try {
    const result = await chrome.storage.local.get([COMMENT_STATUS_KEY]);
    const data = result[COMMENT_STATUS_KEY];
    if (!data) return {};
    return JSON.parse(data as string) as CommentStatusMap;
  } catch {
    return {};
  }
}

/**
 * 清除所有评论状态数据
 */
export async function clearCommentStatuses(): Promise<void> {
  try {
    await chrome.storage.local.remove(COMMENT_STATUS_KEY);
  } catch {
    throw new StorageError('评论状态清除失败');
  }
}
