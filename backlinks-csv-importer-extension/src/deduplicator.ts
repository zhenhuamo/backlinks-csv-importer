import { BacklinkRecord, DeduplicationResult } from './types';

/**
 * URL 标准化
 * - 统一为 https 协议
 * - 移除尾部斜杠（保留根路径 "https://host" 形式）
 * - 对查询参数按字母排序
 */
export function normalizeUrl(url: string): string {
  if (!url || url.trim() === '') return '';

  let normalized = url.trim();

  // Add protocol if missing
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  // Unify to HTTPS
  normalized = normalized.replace(/^http:\/\//i, 'https://');

  // Parse URL to sort query parameters
  try {
    const parsed = new URL(normalized);

    // Remove fragment/hash
    parsed.hash = '';

    // Sort query parameters alphabetically
    const params = Array.from(parsed.searchParams.entries());
    params.sort((a, b) => a[0].localeCompare(b[0]));
    parsed.search = '';
    if (params.length > 0) {
      const sp = new URLSearchParams();
      for (const [key, value] of params) {
        sp.append(key, value);
      }
      parsed.search = sp.toString();
    }

    normalized = parsed.toString();
  } catch {
    // If URL parsing fails, just return what we have
  }

  // Remove trailing slash, but only from the path portion
  // "https://example.com/" → "https://example.com"
  // "https://example.com/path/" → "https://example.com/path"
  normalized = normalized.replace(/\/+$/, '');

  return normalized;
}

/**
 * 对外链记录列表进行去重
 * - 唯一键: normalizeUrl(sourceUrl)（同一个源页面只保留一条记录）
 * - 重复时保留"上次发现日期"最新的记录
 */
export function deduplicate(records: BacklinkRecord[]): DeduplicationResult {
  const map = new Map<string, BacklinkRecord>();

  for (const record of records) {
    const key = normalizeUrl(record.sourcePageInfo.url);

    const existing = map.get(key);
    if (!existing) {
      map.set(key, record);
    } else {
      // Keep the record with the latest lastSeenDate
      if (record.lastSeenDate > existing.lastSeenDate) {
        map.set(key, record);
      }
    }
  }

  const deduplicated = Array.from(map.values());
  return {
    records: deduplicated,
    removedCount: records.length - deduplicated.length,
  };
}
