import { parseCSV, parseSourcePageInfo, parseAnchorInfo, parseDate } from '../csv-parser';

describe('parseSourcePageInfo', () => {
  it('parses full source page info with all optional fields', () => {
    const result = parseSourcePageInfo(
      'https://example.com/page | CMS | EN | 移动友好'
    );
    expect(result).toEqual({
      url: 'https://example.com/page',
      pageType: 'CMS',
      language: 'EN',
      mobileFriendly: true,
    });
  });

  it('parses source page info with URL only', () => {
    const result = parseSourcePageInfo(
      'https://www.thaiticketmajor.com/page.php?wid=492'
    );
    expect(result).toEqual({
      url: 'https://www.thaiticketmajor.com/page.php?wid=492',
    });
  });

  it('parses source page info with partial optional fields', () => {
    const result = parseSourcePageInfo(
      'https://example.com | 博客 | 移动友好'
    );
    expect(result).toEqual({
      url: 'https://example.com',
      pageType: '博客',
      mobileFriendly: true,
    });
  });

  it('parses source page info with language but no page type', () => {
    const result = parseSourcePageInfo(
      'https://rdinnovation.onf.fr/news/43 | EN | 移动友好'
    );
    expect(result).toEqual({
      url: 'https://rdinnovation.onf.fr/news/43',
      language: 'EN',
      mobileFriendly: true,
    });
  });

  it('parses source page info with 留言板 type', () => {
    const result = parseSourcePageInfo(
      'https://example.com/forum | 留言板 | FR | 移动友好'
    );
    expect(result).toEqual({
      url: 'https://example.com/forum',
      pageType: '留言板',
      language: 'FR',
      mobileFriendly: true,
    });
  });

  it('throws on empty field', () => {
    expect(() => parseSourcePageInfo('')).toThrow('Source page URL is required');
  });
});

describe('parseAnchorInfo', () => {
  it('parses anchor info with link type and attributes', () => {
    const result = parseAnchorInfo(
      'https://crazycattle3d.io/ | 文本 | Nofollow'
    );
    expect(result).toEqual({
      targetUrl: 'https://crazycattle3d.io/',
      linkType: '文本',
      attributes: ['Nofollow'],
    });
  });

  it('parses anchor info with multiple attributes', () => {
    const result = parseAnchorInfo(
      'https://crazycattle3d.io/ | 文本 | 内容 | Nofollow | UGC'
    );
    expect(result).toEqual({
      targetUrl: 'https://crazycattle3d.io/',
      linkType: '文本',
      attributes: ['内容', 'Nofollow', 'UGC'],
    });
  });

  it('parses anchor info with URL only', () => {
    const result = parseAnchorInfo('https://crazycattle3d.io/');
    expect(result).toEqual({
      targetUrl: 'https://crazycattle3d.io/',
      attributes: [],
    });
  });

  it('parses anchor info with 图片 link type', () => {
    const result = parseAnchorInfo(
      'https://example.com/img | 图片 | Nofollow'
    );
    expect(result).toEqual({
      targetUrl: 'https://example.com/img',
      linkType: '图片',
      attributes: ['Nofollow'],
    });
  });

  it('throws on empty field', () => {
    expect(() => parseAnchorInfo('')).toThrow('Target URL is required');
  });
});

describe('parseDate', () => {
  it('parses absolute Chinese date format', () => {
    expect(parseDate('2026年2月8日')).toBe('2026-02-08');
  });

  it('parses absolute date with double-digit month and day', () => {
    expect(parseDate('2025年12月15日')).toBe('2025-12-15');
  });

  it('parses relative date format', () => {
    const result = parseDate('12 天前');
    // Should be a valid ISO date
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify it's approximately 12 days ago
    const parsed = new Date(result);
    const now = new Date();
    const diffMs = now.getTime() - parsed.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(12);
  });

  it('parses "N 小时前" format', () => {
    const result = parseDate('14 小时前');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parses "昨天" format', () => {
    const result = parseDate('昨天');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const parsed = new Date(result);
    const now = new Date();
    const diffMs = now.getTime() - parsed.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(1);
  });

  it('throws on unrecognized format', () => {
    expect(() => parseDate('invalid')).toThrow('Unrecognized date format');
  });

  it('throws on empty string', () => {
    expect(() => parseDate('')).toThrow('Unrecognized date format');
  });
});

describe('parseCSV', () => {
  const header =
    '页面 AS,源页面标题和 URL,外部链接,内部链接,锚链接和目标 URL,首次发现日期,上次发现日期';

  it('parses a valid CSV with one data row', () => {
    const csv = `${header}\n14,https://example.com | CMS | EN | 移动友好,4,59,https://crazycattle3d.io/ | 文本 | Nofollow,2026年2月8日,2026年2月8日`;
    const result = parseCSV(csv);

    expect(result.totalRows).toBe(1);
    expect(result.failedRows).toBe(0);
    expect(result.records).toHaveLength(1);

    const record = result.records[0];
    expect(record.pageAS).toBe(14);
    expect(record.externalLinks).toBe(4);
    expect(record.sourcePageInfo.url).toBe('https://example.com');
    expect(record.sourcePageInfo.pageType).toBe('CMS');
    expect(record.sourcePageInfo.language).toBe('EN');
    expect(record.sourcePageInfo.mobileFriendly).toBe(true);
    expect(record.anchorInfo.targetUrl).toBe('https://crazycattle3d.io/');
    expect(record.anchorInfo.linkType).toBe('文本');
    expect(record.anchorInfo.attributes).toEqual(['Nofollow']);
    expect(record.firstSeenDate).toBe('2026-02-08');
    expect(record.lastSeenDate).toBe('2026-02-08');
  });

  it('returns empty result for empty CSV', () => {
    const result = parseCSV('');
    expect(result.totalRows).toBe(0);
    expect(result.failedRows).toBe(0);
    expect(result.records).toHaveLength(0);
  });

  it('returns empty result for header-only CSV', () => {
    const result = parseCSV(header);
    expect(result.totalRows).toBe(0);
    expect(result.records).toHaveLength(0);
  });

  it('skips rows with non-numeric pageAS', () => {
    const csv = `${header}\nabc,https://example.com,4,59,https://target.com,2026年2月8日,2026年2月8日`;
    const result = parseCSV(csv);
    expect(result.totalRows).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.records).toHaveLength(0);
  });

  it('skips rows with non-numeric externalLinks', () => {
    const csv = `${header}\n14,https://example.com,abc,59,https://target.com,2026年2月8日,2026年2月8日`;
    const result = parseCSV(csv);
    expect(result.totalRows).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.records).toHaveLength(0);
  });

  it('skips rows with invalid date format', () => {
    const csv = `${header}\n14,https://example.com,4,59,https://target.com,invalid-date,2026年2月8日`;
    const result = parseCSV(csv);
    expect(result.totalRows).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.records).toHaveLength(0);
  });

  it('parses multiple rows and counts failures correctly', () => {
    const csv = [
      header,
      '14,https://a.com | 博客,50,267,https://target.com | 文本 | Nofollow,2025年12月15日,2026年2月15日',
      'bad,https://b.com,4,59,https://target.com,2026年2月8日,2026年2月8日',
      '13,https://c.com | 留言板 | FR | 移动友好,11,135,https://target.com | 文本 | 内容,2025年8月2日,2026年2月10日',
    ].join('\n');

    const result = parseCSV(csv);
    expect(result.totalRows).toBe(3);
    expect(result.failedRows).toBe(1);
    expect(result.records).toHaveLength(2);
  });

  it('ignores the internal links field (index 3)', () => {
    const csv = `${header}\n14,https://example.com,4,999,https://target.com,2026年2月8日,2026年2月8日`;
    const result = parseCSV(csv);
    const record = result.records[0];
    // The record should not have any internalLinks property
    expect(record).not.toHaveProperty('internalLinks');
    expect(record.externalLinks).toBe(4);
  });
});
