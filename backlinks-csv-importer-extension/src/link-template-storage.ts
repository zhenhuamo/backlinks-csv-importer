import { LinkTemplate } from './types';
import { StorageError } from './storage';

const STORAGE_KEY = 'linkTemplates';

/**
 * 生成唯一标识符
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 保存模板列表到 chrome.storage.local
 */
export async function saveTemplates(templates: LinkTemplate[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(templates) });
  } catch {
    throw new StorageError('模板保存失败，请检查浏览器存储空间');
  }
}

/**
 * 从 chrome.storage.local 加载模板列表
 * 失败返回空数组
 */
export async function loadTemplates(): Promise<LinkTemplate[]> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const data = result[STORAGE_KEY];
    if (!data) return [];
    return JSON.parse(data as string) as LinkTemplate[];
  } catch (error) {
    console.error('模板加载失败', error);
    return [];
  }
}
