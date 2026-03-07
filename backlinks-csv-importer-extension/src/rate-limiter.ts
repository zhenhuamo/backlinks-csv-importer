/**
 * Rate Limiter 模块
 * 控制并发数、请求间隔和超时的异步任务调度器
 */

export interface RateLimiterOptions {
  maxConcurrent: number;   // 最大并发数，默认 3
  delayMs: number;         // 请求间隔，默认 500ms
  timeoutMs: number;       // 单个请求超时，默认 10000ms
}

/**
 * 延迟指定毫秒数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 用 Promise.race 实现超时包装
 * 如果任务在 timeoutMs 内未完成，则抛出超时错误
 */
function withTimeout<T>(task: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    task().then(
      result => {
        clearTimeout(timer);
        resolve(result);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * 限速执行异步任务队列
 * - 使用信号量模式控制最大并发数
 * - 每个任务完成后等待 delayMs 再释放信号量槽位
 * - 通过 Promise.race 实现超时控制
 * - 通过 onProgress 回调报告进度
 * - 返回结果数组，顺序与输入 tasks 一致
 * - 如果任务超时或抛出错误，该错误会被重新抛出（调用方应在 task 内部处理错误）
 */
export async function executeWithRateLimit<T>(
  tasks: Array<() => Promise<T>>,
  options: RateLimiterOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<T[]> {
  const { maxConcurrent, delayMs, timeoutMs } = options;
  const total = tasks.length;

  if (total === 0) {
    return [];
  }

  // Pre-allocate results array to maintain input order
  const results: (T | undefined)[] = new Array(total);
  const errors: (Error | undefined)[] = new Array(total);
  let completed = 0;

  // Semaphore: resolvers waiting for a free slot
  let activeCount = 0;
  const waitQueue: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (activeCount < maxConcurrent) {
      activeCount++;
      return;
    }
    return new Promise<void>(resolve => {
      waitQueue.push(resolve);
    });
  }

  async function release(): Promise<void> {
    // Wait delayMs before releasing the slot to enforce request spacing
    if (delayMs > 0) {
      await delay(delayMs);
    }
    if (waitQueue.length > 0) {
      const next = waitQueue.shift()!;
      next();
    } else {
      activeCount--;
    }
  }

  // Execute all tasks with semaphore-controlled concurrency
  const taskPromises = tasks.map(async (task, index) => {
    await acquire();
    try {
      const result = await withTimeout(task, timeoutMs);
      results[index] = result;
    } catch (error) {
      errors[index] = error instanceof Error ? error : new Error(String(error));
    } finally {
      completed++;
      if (onProgress) {
        onProgress(completed, total);
      }
      await release();
    }
  });

  await Promise.all(taskPromises);

  // Check for errors — if any task failed, throw the first error
  for (let i = 0; i < total; i++) {
    if (errors[i]) {
      throw errors[i];
    }
  }

  return results as T[];
}
