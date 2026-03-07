import { normalizeUrl, deduplicate } from '../deduplicator';
import { BacklinkRecord } from '../types';

function makeRecord(
  sourceUrl: string,
  targetUrl: string,
  lastSeenDate: string,
  overrides: Partial<BacklinkRecord> = {}
): BacklinkRecord {
  return {
    pageAS: 10,
    sourcePageInfo: { url: sourceUrl },
    externalLinks: 5,
    anchorInfo: { targetUrl, attributes: [] },
    firstSeenDate: '2025-01-01',
    lastSeenDate,
    ...overrides,
  };
}

describe('normalizeUrl', () => {
  it('removes trailing slash from path', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
  });

  it('removes trailing slash from root URL', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
  });

  it('converts http to https', () => {
    expect(normalizeUrl('http://example.com/page')).toBe('https://example.com/page');
  });

  it('sorts query parameters alphabetically', () => {
    expect(normalizeUrl('https://example.com/page?z=1&a=2&m=3')).toBe(
      'https://example.com/page?a=2&m=3&z=1'
    );
  });

  it('adds https protocol when missing', () => {
    expect(normalizeUrl('example.com/page')).toBe('https://example.com/page');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeUrl('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeUrl('   ')).toBe('');
  });

  it('is idempotent', () => {
    const url = 'http://example.com/page/?b=2&a=1';
    const once = normalizeUrl(url);
    const twice = normalizeUrl(once);
    expect(twice).toBe(once);
  });

  it('handles URL with no path and no trailing slash', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('handles case-insensitive protocol replacement', () => {
    expect(normalizeUrl('HTTP://Example.com/Page')).toBe('https://example.com/Page');
  });
});

describe('deduplicate', () => {
  it('returns all records when there are no duplicates', () => {
    const records = [
      makeRecord('https://a.com', 'https://target.com', '2025-06-01'),
      makeRecord('https://b.com', 'https://target.com', '2025-06-01'),
    ];
    const result = deduplicate(records);
    expect(result.records).toHaveLength(2);
    expect(result.removedCount).toBe(0);
  });

  it('keeps the record with the latest lastSeenDate when duplicates exist', () => {
    const records = [
      makeRecord('https://a.com', 'https://target.com', '2025-01-01', { pageAS: 5 }),
      makeRecord('https://a.com', 'https://target.com', '2025-06-15', { pageAS: 20 }),
      makeRecord('https://a.com', 'https://target.com', '2025-03-10', { pageAS: 12 }),
    ];
    const result = deduplicate(records);
    expect(result.records).toHaveLength(1);
    expect(result.removedCount).toBe(2);
    expect(result.records[0].pageAS).toBe(20);
    expect(result.records[0].lastSeenDate).toBe('2025-06-15');
  });

  it('deduplicates by source URL only (same source, different targets)', () => {
    const records = [
      makeRecord('https://a.com', 'https://t1.com', '2025-01-01'),
      makeRecord('https://a.com', 'https://t2.com', '2025-06-01'),
    ];
    const result = deduplicate(records);
    expect(result.records).toHaveLength(1);
    expect(result.removedCount).toBe(1);
    expect(result.records[0].lastSeenDate).toBe('2025-06-01');
  });

  it('handles multiple duplicate groups', () => {
    const records = [
      makeRecord('https://a.com', 'https://t1.com', '2025-01-01'),
      makeRecord('https://a.com', 'https://t1.com', '2025-06-01'),
      makeRecord('https://b.com', 'https://t2.com', '2025-02-01'),
      makeRecord('https://b.com', 'https://t2.com', '2025-05-01'),
    ];
    const result = deduplicate(records);
    expect(result.records).toHaveLength(2);
    expect(result.removedCount).toBe(2);
  });

  it('returns empty list for empty input', () => {
    const result = deduplicate([]);
    expect(result.records).toHaveLength(0);
    expect(result.removedCount).toBe(0);
  });

  it('normalizes URLs before deduplication (http vs https)', () => {
    const records = [
      makeRecord('http://a.com', 'https://target.com', '2025-01-01'),
      makeRecord('https://a.com', 'https://target.com', '2025-06-01'),
    ];
    const result = deduplicate(records);
    expect(result.records).toHaveLength(1);
    expect(result.removedCount).toBe(1);
    expect(result.records[0].lastSeenDate).toBe('2025-06-01');
  });

  it('normalizes URLs before deduplication (trailing slash)', () => {
    const records = [
      makeRecord('https://a.com/page/', 'https://target.com', '2025-06-01'),
      makeRecord('https://a.com/page', 'https://target.com', '2025-01-01'),
    ];
    const result = deduplicate(records);
    expect(result.records).toHaveLength(1);
    expect(result.removedCount).toBe(1);
    expect(result.records[0].lastSeenDate).toBe('2025-06-01');
  });

  it('normalizes URLs before deduplication (fragment removal)', () => {
    const records = [
      makeRecord('https://a.com/page#section1', 'https://target.com', '2025-06-01'),
      makeRecord('https://a.com/page#section2', 'https://target.com', '2025-01-01'),
    ];
    const result = deduplicate(records);
    expect(result.records).toHaveLength(1);
    expect(result.removedCount).toBe(1);
  });

  it('satisfies count invariant: records + removedCount = input length', () => {
    const records = [
      makeRecord('https://a.com', 'https://t1.com', '2025-01-01'),
      makeRecord('https://a.com', 'https://t1.com', '2025-06-01'),
      makeRecord('https://b.com', 'https://t2.com', '2025-03-01'),
      makeRecord('https://c.com', 'https://t3.com', '2025-04-01'),
      makeRecord('https://c.com', 'https://t3.com', '2025-05-01'),
    ];
    const result = deduplicate(records);
    expect(result.records.length + result.removedCount).toBe(records.length);
  });
});
