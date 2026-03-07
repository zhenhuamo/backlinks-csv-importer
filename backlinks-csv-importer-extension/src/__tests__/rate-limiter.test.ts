import { executeWithRateLimit, RateLimiterOptions } from '../rate-limiter';

describe('executeWithRateLimit', () => {
  const defaultOptions: RateLimiterOptions = {
    maxConcurrent: 3,
    delayMs: 0, // Use 0 delay for fast tests
    timeoutMs: 5000,
  };

  it('returns empty array for empty task list', async () => {
    const results = await executeWithRateLimit([], defaultOptions);
    expect(results).toEqual([]);
  });

  it('executes all tasks and returns results in order', async () => {
    const tasks = [
      () => Promise.resolve('a'),
      () => Promise.resolve('b'),
      () => Promise.resolve('c'),
    ];
    const results = await executeWithRateLimit(tasks, defaultOptions);
    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('preserves result order even when tasks complete out of order', async () => {
    const tasks = [
      () => new Promise<number>(resolve => setTimeout(() => resolve(1), 50)),
      () => new Promise<number>(resolve => setTimeout(() => resolve(2), 10)),
      () => new Promise<number>(resolve => setTimeout(() => resolve(3), 30)),
    ];
    const results = await executeWithRateLimit(tasks, defaultOptions);
    expect(results).toEqual([1, 2, 3]);
  });

  it('limits concurrency to maxConcurrent', async () => {
    let currentRunning = 0;
    let maxObserved = 0;

    const makeTask = (id: number) => async () => {
      currentRunning++;
      maxObserved = Math.max(maxObserved, currentRunning);
      await new Promise(resolve => setTimeout(resolve, 30));
      currentRunning--;
      return id;
    };

    const tasks = Array.from({ length: 10 }, (_, i) => makeTask(i));
    const options: RateLimiterOptions = { maxConcurrent: 3, delayMs: 0, timeoutMs: 5000 };

    await executeWithRateLimit(tasks, options);
    expect(maxObserved).toBeLessThanOrEqual(3);
    expect(maxObserved).toBeGreaterThan(0);
  });

  it('respects maxConcurrent of 1 (sequential execution)', async () => {
    let currentRunning = 0;
    let maxObserved = 0;

    const makeTask = (id: number) => async () => {
      currentRunning++;
      maxObserved = Math.max(maxObserved, currentRunning);
      await new Promise(resolve => setTimeout(resolve, 10));
      currentRunning--;
      return id;
    };

    const tasks = Array.from({ length: 5 }, (_, i) => makeTask(i));
    const options: RateLimiterOptions = { maxConcurrent: 1, delayMs: 0, timeoutMs: 5000 };

    await executeWithRateLimit(tasks, options);
    expect(maxObserved).toBe(1);
  });

  it('calls onProgress after each task completes', async () => {
    const progressCalls: Array<[number, number]> = [];
    const tasks = [
      () => Promise.resolve('a'),
      () => Promise.resolve('b'),
      () => Promise.resolve('c'),
    ];

    await executeWithRateLimit(tasks, defaultOptions, (completed, total) => {
      progressCalls.push([completed, total]);
    });

    expect(progressCalls).toHaveLength(3);
    // All calls should have total = 3
    for (const [, total] of progressCalls) {
      expect(total).toBe(3);
    }
    // Completed values should include 1, 2, 3 (order may vary due to concurrency)
    const completedValues = progressCalls.map(([c]) => c).sort();
    expect(completedValues).toEqual([1, 2, 3]);
  });

  it('throws error when a task times out', async () => {
    const tasks = [
      () => new Promise<string>(resolve => setTimeout(() => resolve('done'), 200)),
    ];
    const options: RateLimiterOptions = { maxConcurrent: 1, delayMs: 0, timeoutMs: 50 };

    await expect(executeWithRateLimit(tasks, options)).rejects.toThrow('Task timed out');
  });

  it('throws error when a task rejects', async () => {
    const tasks = [
      () => Promise.reject(new Error('task failed')),
    ];

    await expect(executeWithRateLimit(tasks, defaultOptions)).rejects.toThrow('task failed');
  });

  it('applies delay between tasks', async () => {
    const timestamps: number[] = [];
    const makeTask = () => async () => {
      timestamps.push(Date.now());
      return true;
    };

    const tasks = [makeTask(), makeTask(), makeTask()];
    const options: RateLimiterOptions = { maxConcurrent: 1, delayMs: 50, timeoutMs: 5000 };

    await executeWithRateLimit(tasks, options);

    // With maxConcurrent=1 and delayMs=50, tasks run sequentially with delay
    // Second task should start at least 50ms after first
    expect(timestamps).toHaveLength(3);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(40); // Allow small timing variance
    }
  });

  it('handles a single task correctly', async () => {
    const tasks = [() => Promise.resolve(42)];
    const results = await executeWithRateLimit(tasks, defaultOptions);
    expect(results).toEqual([42]);
  });

  it('handles more tasks than maxConcurrent', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => () => Promise.resolve(i));
    const options: RateLimiterOptions = { maxConcurrent: 2, delayMs: 0, timeoutMs: 5000 };

    const results = await executeWithRateLimit(tasks, options);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
