import { CommentStatusMap } from '../types';
import {
  saveCommentStatuses,
  loadCommentStatuses,
  clearCommentStatuses,
  clearRecords,
  StorageError,
} from '../storage';

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

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key];
  }
  jest.clearAllMocks();
});

describe('saveCommentStatuses', () => {
  it('saves statuses as JSON string to chrome.storage.local', async () => {
    const statuses: CommentStatusMap = {
      'https://example.com/blog/1': 'commentable',
      'https://example.com/forum/2': 'login_required',
    };
    await saveCommentStatuses(statuses);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      commentStatuses: JSON.stringify(statuses),
    });
    expect(mockStorage['commentStatuses']).toBe(JSON.stringify(statuses));
  });

  it('saves empty object', async () => {
    await saveCommentStatuses({});
    expect(mockStorage['commentStatuses']).toBe('{}');
  });

  it('throws StorageError with correct message when set fails', async () => {
    (chrome.storage.local.set as jest.Mock).mockRejectedValueOnce(new Error('quota exceeded'));

    const err = await saveCommentStatuses({ 'https://a.com': 'commentable' }).catch((e: any) => e);
    expect(err).toBeInstanceOf(StorageError);
    expect(err.message).toBe('评论状态保存失败，请检查浏览器存储空间');
  });
});

describe('loadCommentStatuses', () => {
  it('loads and parses statuses from chrome.storage.local', async () => {
    const statuses: CommentStatusMap = {
      'https://example.com/blog/1': 'commentable',
      'https://example.com/page': 'uncertain',
    };
    mockStorage['commentStatuses'] = JSON.stringify(statuses);

    const loaded = await loadCommentStatuses();
    expect(loaded).toEqual(statuses);
  });

  it('returns empty object when no data exists', async () => {
    const loaded = await loadCommentStatuses();
    expect(loaded).toEqual({});
  });

  it('returns empty object when chrome.storage.local.get fails', async () => {
    (chrome.storage.local.get as jest.Mock).mockRejectedValueOnce(new Error('read error'));

    const loaded = await loadCommentStatuses();
    expect(loaded).toEqual({});
  });
});

describe('clearCommentStatuses', () => {
  it('removes commentStatuses key from chrome.storage.local', async () => {
    mockStorage['commentStatuses'] = JSON.stringify({ 'https://a.com': 'commentable' });

    await clearCommentStatuses();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('commentStatuses');
    expect(mockStorage['commentStatuses']).toBeUndefined();
  });

  it('throws StorageError when remove fails', async () => {
    (chrome.storage.local.remove as jest.Mock).mockRejectedValueOnce(new Error('remove error'));

    await expect(clearCommentStatuses()).rejects.toThrow(StorageError);
  });
});

describe('clearRecords also clears comment statuses', () => {
  it('removes both backlinks and commentStatuses keys', async () => {
    mockStorage['backlinks'] = JSON.stringify([]);
    mockStorage['commentStatuses'] = JSON.stringify({ 'https://a.com': 'commentable' });

    await clearRecords();
    expect(mockStorage['backlinks']).toBeUndefined();
    expect(mockStorage['commentStatuses']).toBeUndefined();
  });
});
