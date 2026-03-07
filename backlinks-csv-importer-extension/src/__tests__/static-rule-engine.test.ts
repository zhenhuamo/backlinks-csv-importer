import { shouldFilter, applyStaticFilter, EXCLUDE_PATTERNS } from '../static-rule-engine';
import { BacklinkRecord } from '../types';

function makeRecord(sourceUrl: string): BacklinkRecord {
  return {
    pageAS: 10,
    sourcePageInfo: { url: sourceUrl },
    externalLinks: 5,
    anchorInfo: { targetUrl: 'https://target.com', attributes: [] },
    firstSeenDate: '2025-01-01',
    lastSeenDate: '2025-06-01',
  };
}

describe('shouldFilter', () => {
  it.each([
    ['https://example.com/profile', '/profile'],
    ['https://example.com/user/123', '/user/'],
    ['https://example.com/member/abc', '/member/'],
    ['https://example.com/login', '/login'],
    ['https://example.com/register', '/register'],
    ['https://example.com/signin', '/signin'],
    ['https://example.com/signup', '/signup'],
    ['https://example.com/gallery', '/gallery'],
    ['https://example.com/archive', '/archive'],
    ['https://example.com/category', '/category'],
    ['https://example.com/tag/seo', '/tag/'],
  ])('returns true for URL containing %s pattern', (url) => {
    expect(shouldFilter(url)).toBe(true);
  });

  it('is case-insensitive on pathname', () => {
    expect(shouldFilter('https://example.com/Login')).toBe(true);
    expect(shouldFilter('https://example.com/USER/123')).toBe(true);
    expect(shouldFilter('https://example.com/Profile')).toBe(true);
  });

  it('returns false for URLs without exclude patterns', () => {
    expect(shouldFilter('https://example.com/blog/post-1')).toBe(false);
    expect(shouldFilter('https://example.com/article/123')).toBe(false);
  });

  it('returns false for forum-like URLs (should be kept for analysis)', () => {
    expect(shouldFilter('https://example.com/forum.php?id=1')).toBe(false);
    expect(shouldFilter('https://example.com/viewtopic.php?t=100')).toBe(false);
    expect(shouldFilter('https://example.com/thread/123')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(shouldFilter('not-a-url')).toBe(false);
    expect(shouldFilter('')).toBe(false);
  });

  it('checks pathname only, not query or fragment', () => {
    expect(shouldFilter('https://example.com/page?redirect=/login')).toBe(false);
  });
});

describe('applyStaticFilter', () => {
  it('splits records into filtered and pending', () => {
    const records = [
      makeRecord('https://example.com/user/123'),
      makeRecord('https://example.com/blog/post-1'),
      makeRecord('https://example.com/login'),
    ];
    const result = applyStaticFilter(records);
    expect(result.filtered).toHaveLength(2);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].sourcePageInfo.url).toBe('https://example.com/blog/post-1');
  });

  it('returns all records in pending when none match exclude patterns', () => {
    const records = [
      makeRecord('https://example.com/blog/post-1'),
      makeRecord('https://example.com/article/123'),
    ];
    const result = applyStaticFilter(records);
    expect(result.filtered).toHaveLength(0);
    expect(result.pending).toHaveLength(2);
  });

  it('returns empty arrays for empty input', () => {
    const result = applyStaticFilter([]);
    expect(result.filtered).toHaveLength(0);
    expect(result.pending).toHaveLength(0);
  });

  it('preserves total count: filtered + pending = input length', () => {
    const records = [
      makeRecord('https://example.com/user/1'),
      makeRecord('https://example.com/blog/1'),
      makeRecord('https://example.com/login'),
      makeRecord('https://example.com/article/1'),
    ];
    const result = applyStaticFilter(records);
    expect(result.filtered.length + result.pending.length).toBe(records.length);
  });
});
