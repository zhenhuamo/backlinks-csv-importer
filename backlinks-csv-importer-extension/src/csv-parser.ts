import Papa from 'papaparse';
import {
  BacklinkRecord,
  SourcePageInfo,
  AnchorInfo,
  ParseResult,
} from './types';

/** Known page types in the CSV data */
const PAGE_TYPES = new Set(['博客', 'CMS', '留言板']);

/** Known language codes */
const LANGUAGE_CODES = new Set(['EN', 'FR', 'ZH', 'KO', 'RU', 'JA', 'DE', 'ES', 'IT', 'PT']);

/** Mobile friendly indicator */
const MOBILE_FRIENDLY = '移动友好';

/** Known link types */
const LINK_TYPES = new Set(['文本', '图片']);

/**
 * Parse CSV file content into structured backlink records.
 * - Uses PapaParse to split CSV rows
 * - Skips the header row
 * - Ignores the "内部链接" field (index 3)
 * - Tracks failed rows
 */
export function parseCSV(csvContent: string): ParseResult {
  const parsed = Papa.parse<string[]>(csvContent, {
    header: false,
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  if (rows.length === 0) {
    return { records: [], failedRows: 0, totalRows: 0 };
  }

  // Skip header row
  const dataRows = rows.slice(1);
  const totalRows = dataRows.length;
  const records: BacklinkRecord[] = [];
  let failedRows = 0;

  for (const row of dataRows) {
    try {
      if (row.length !== 7) {
        failedRows++;
        continue;
      }

      const pageAS = parseInt(row[0].trim(), 10);
      if (isNaN(pageAS)) {
        failedRows++;
        continue;
      }

      const externalLinks = parseInt(row[2].trim(), 10);
      if (isNaN(externalLinks)) {
        failedRows++;
        continue;
      }

      // Index 3 is 内部链接 — ignored
      const sourcePageInfo = parseSourcePageInfo(row[1].trim());
      const anchorInfo = parseAnchorInfo(row[4].trim());
      const firstSeenDate = parseDate(row[5].trim());
      const lastSeenDate = parseDate(row[6].trim());

      records.push({
        pageAS,
        sourcePageInfo,
        externalLinks,
        anchorInfo,
        firstSeenDate,
        lastSeenDate,
      });
    } catch {
      failedRows++;
    }
  }

  return { records, failedRows, totalRows };
}

/**
 * Parse the "源页面标题和 URL" field.
 * Format: "URL | pageType | languageCode | 移动友好" (last three optional)
 */
export function parseSourcePageInfo(field: string): SourcePageInfo {
  const parts = field.split(' | ').map((p) => p.trim());
  const url = parts[0];

  if (!url) {
    throw new Error('Source page URL is required');
  }

  const result: SourcePageInfo = { url };

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part === MOBILE_FRIENDLY) {
      result.mobileFriendly = true;
    } else if (PAGE_TYPES.has(part)) {
      result.pageType = part;
    } else if (LANGUAGE_CODES.has(part)) {
      result.language = part;
    }
  }

  return result;
}

/**
 * Parse the "锚链接和目标 URL" field.
 * Format: "targetURL | linkType | attr1 | attr2 | ..."
 */
export function parseAnchorInfo(field: string): AnchorInfo {
  const parts = field.split(' | ').map((p) => p.trim());
  const targetUrl = parts[0];

  if (!targetUrl) {
    throw new Error('Target URL is required');
  }

  const result: AnchorInfo = { targetUrl, attributes: [] };

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (LINK_TYPES.has(part)) {
      result.linkType = part;
    } else if (part) {
      result.attributes.push(part);
    }
  }

  return result;
}

/** Format a Date object to YYYY-MM-DD */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a date string in Chinese absolute format or relative format.
 * - Absolute: "YYYY年M月D日" → "YYYY-MM-DD"
 * - Relative: "N 天前" → ISO 8601 date N days ago from today
 * Throws on unrecognized format.
 */
export function parseDate(dateStr: string): string {
  const trimmed = dateStr.trim();

  // Try absolute format: YYYY年M月D日
  const absoluteMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (absoluteMatch) {
    const year = parseInt(absoluteMatch[1], 10);
    const month = parseInt(absoluteMatch[2], 10);
    const day = parseInt(absoluteMatch[3], 10);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try relative format: N 天前
  const relativeMatch = trimmed.match(/^(\d+)\s*天前$/);
  if (relativeMatch) {
    const daysAgo = parseInt(relativeMatch[1], 10);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return formatDate(date);
  }

  // N 小时前 → today
  const hoursMatch = trimmed.match(/^(\d+)\s*小时前$/);
  if (hoursMatch) {
    const date = new Date();
    date.setHours(date.getHours() - parseInt(hoursMatch[1], 10));
    return formatDate(date);
  }

  // N 分钟前 → today
  const minutesMatch = trimmed.match(/^(\d+)\s*分钟前$/);
  if (minutesMatch) {
    return formatDate(new Date());
  }

  // 昨天
  if (trimmed === '昨天') {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatDate(date);
  }

  throw new Error(`Unrecognized date format: "${trimmed}"`);
}
