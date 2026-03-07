import { BacklinkRecord, FilterResult } from './types';

/** 预过滤排除规则：URL 路径中包含这些模式的将被标记为 filtered_out */
export const EXCLUDE_PATTERNS: string[] = [
  '/profile', '/user/', '/member/',
  '/login', '/register', '/signin', '/signup',
  '/gallery', '/archive', '/category', '/tag/',
];

/**
 * 对 URL 执行静态规则匹配，判断是否应被排除。
 * 匹配规则：URL 路径（pathname）中是否包含排除模式（大小写不敏感）。
 * 不发起任何网络请求。无效 URL 返回 false。
 */
export function shouldFilter(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return EXCLUDE_PATTERNS.some(pattern => pathname.includes(pattern));
  } catch {
    return false;
  }
}

/**
 * 对 BacklinkRecord 列表执行批量预过滤。
 * 返回被排除的记录（filtered）和待分析的记录（pending）。
 */
export function applyStaticFilter(records: BacklinkRecord[]): FilterResult {
  const filtered: BacklinkRecord[] = [];
  const pending: BacklinkRecord[] = [];

  for (const record of records) {
    if (shouldFilter(record.sourcePageInfo.url)) {
      filtered.push(record);
    } else {
      pending.push(record);
    }
  }

  return { filtered, pending };
}
