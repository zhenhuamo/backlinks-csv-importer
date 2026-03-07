import { BacklinkRecord } from '../types';
import { saveRecords, loadRecords, clearRecords, mergeAndSave, StorageError } from '../storage';

// --- Chrome storage mock ---
const mockStorage: Record<string, any> = {};

(global as any).chrome = {
  storage: {
    local: {
      get: jest.fn((keys: string | string[]) => {
        const keyList = typeof keys === 'string' ? [keys] : keys;
        const result: Record<string, any> = {};
        for (const k of keyList) {
          if (k in mockStorage) result[k] = mockStorage[k];
        }
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, any>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        const keyList = typeof keys === 'string' ? [keys] : keys;
        for (const k of keyList) delete mockStorage[k];
        return Promise.resolve();
      }),
    },
  },
};

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

beforeEach(() => {
  // Clear mock storage and reset call counts
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key];
  }
  jest.clearAllMocks();
});

describe('saveRecords', () => {
  it('saves records as JSON to chrome.storage.local', async () => {
    const records = [makeRecord('https://a.com', 'https://t.com', '2025-06-01')];
    await saveRecords(records);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      backlinks: JSON.stringify(records),
    });
    expect(mockStorage['backlinks']).toBe(JSON.stringify(records));
  });

  it('saves empty array', async () => {
    await saveRecords([]);
    expect(mockStorage['backlinks']).toBe('[]');
  });

  it('throws StorageError when chrome.storage.local.set fails', async () => {
    (chrome.storage.local.set as jest.Mock).mockRejectedValueOnce(new Error('quota exceeded'));

    const err = await saveRecords([makeRecord('https://a.com', 'https://t.com', '2025-01-01')])
      .catch((e: any) => e);

    expect(err).toBeInstanceOf(StorageError);
    expect(err.message).toBe('数据保存失败，请检查浏览器存储空间');
  });
});

describe('loadRecords', () => {
  it('loads and deserializes records from chrome.storage.local', async () => {
    const records = [makeRecord('https://a.com', 'https://t.com', '2025-06-01')];
    mockStorage['backlinks'] = JSON.stringify(records);

    const loaded = await loadRecords();
    expect(loaded).toEqual(records);
  });

  it('returns empty array when no data exists', async () => {
    const loaded = await loadRecords();
    expect(loaded).toEqual([]);
  });

  it('returns empty array and logs error when chrome.storage.local.get fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (chrome.storage.local.get as jest.Mock).mockRejectedValueOnce(new Error('read error'));

    const loaded = await loadRecords();
    expect(loaded).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe('clearRecords', () => {
  it('removes backlinks key from chrome.storage.local', async () => {
    mockStorage['backlinks'] = JSON.stringify([makeRecord('https://a.com', 'https://t.com', '2025-01-01')]);

    await clearRecords();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('backlinks');
    expect(mockStorage['backlinks']).toBeUndefined();
  });

  it('throws StorageError when chrome.storage.local.remove fails', async () => {
    (chrome.storage.local.remove as jest.Mock).mockRejectedValueOnce(new Error('remove error'));

    await expect(clearRecords()).rejects.toThrow(StorageError);
  });
});

describe('mergeAndSave', () => {
  it('merges new records with existing and deduplicates', async () => {
    const existing = [makeRecord('https://a.com', 'https://t1.com', '2025-01-01', { pageAS: 5 })];
    mockStorage['backlinks'] = JSON.stringify(existing);

    const newRecords = [
      makeRecord('https://b.com', 'https://t2.com', '2025-06-01', { pageAS: 20 }),
    ];

    const result = await mergeAndSave(newRecords);
    expect(result.records).toHaveLength(2);
    expect(result.removedCount).toBe(0);

    // Verify saved data
    const saved = JSON.parse(mockStorage['backlinks']);
    expect(saved).toHaveLength(2);
  });

  it('deduplicates when new records overlap with existing', async () => {
    const existing = [makeRecord('https://a.com', 'https://t1.com', '2025-01-01', { pageAS: 5 })];
    mockStorage['backlinks'] = JSON.stringify(existing);

    const newRecords = [
      makeRecord('https://a.com', 'https://t1.com', '2025-06-15', { pageAS: 20 }),
    ];

    const result = await mergeAndSave(newRecords);
    expect(result.records).toHaveLength(1);
    expect(result.removedCount).toBe(1);
    expect(result.records[0].lastSeenDate).toBe('2025-06-15');
    expect(result.records[0].pageAS).toBe(20);
  });

  it('works when no existing data', async () => {
    const newRecords = [
      makeRecord('https://a.com', 'https://t1.com', '2025-06-01'),
      makeRecord('https://b.com', 'https://t2.com', '2025-06-01'),
    ];

    const result = await mergeAndSave(newRecords);
    expect(result.records).toHaveLength(2);
    expect(result.removedCount).toBe(0);
  });

  it('handles URL normalization during merge deduplication', async () => {
    const existing = [makeRecord('http://a.com/page/', 'https://t1.com', '2025-01-01')];
    mockStorage['backlinks'] = JSON.stringify(existing);

    const newRecords = [
      makeRecord('https://a.com/page', 'https://t1.com', '2025-06-15'),
    ];

    const result = await mergeAndSave(newRecords);
    expect(result.records).toHaveLength(1);
    expect(result.removedCount).toBe(1);
  });
});
