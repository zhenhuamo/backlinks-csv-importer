/**
 * Operation Controller 模块
 * 管理长时间运行操作的生命周期状态（运行中、已暂停、已取消）
 */

export type OperationState = 'idle' | 'running' | 'paused' | 'cancelled';

/**
 * 自定义取消错误，用于区分用户主动取消和运行时错误
 */
export class CancelledError extends Error {
  constructor(message = '操作已取消') {
    super(message);
    this.name = 'CancelledError';
  }
}

/**
 * 操作控制器，管理操作生命周期状态机
 *
 * 状态转换规则：
 *   idle → running       (start)
 *   running → paused     (pause)
 *   paused → running     (resume)
 *   running → cancelled  (cancel)
 *   paused → cancelled   (cancel)
 *   cancelled → idle     (reset)
 *
 * 非法转换静默忽略。
 */
export class OperationController {
  private _state: OperationState = 'idle';
  private _abortController: AbortController | null = null;
  private _pauseResolve: (() => void) | null = null;

  get state(): OperationState {
    return this._state;
  }

  get signal(): AbortSignal {
    if (!this._abortController) {
      // 返回一个不会被 abort 的默认 signal
      this._abortController = new AbortController();
    }
    return this._abortController.signal;
  }

  /** idle → running，创建新的 AbortController */
  start(): void {
    if (this._state !== 'idle') return;
    this._abortController = new AbortController();
    this._state = 'running';
  }

  /** running → paused */
  pause(): void {
    if (this._state !== 'running') return;
    this._state = 'paused';
  }

  /** paused → running，解除暂停阻塞 */
  resume(): void {
    if (this._state !== 'paused') return;
    this._state = 'running';
    if (this._pauseResolve) {
      this._pauseResolve();
      this._pauseResolve = null;
    }
  }

  /** running|paused → cancelled，调用 abort() */
  cancel(): void {
    if (this._state !== 'running' && this._state !== 'paused') return;
    // 如果处于暂停状态，先解除暂停阻塞再取消
    if (this._state === 'paused' && this._pauseResolve) {
      this._pauseResolve();
      this._pauseResolve = null;
    }
    this._state = 'cancelled';
    if (this._abortController) {
      this._abortController.abort();
    }
  }

  /** cancelled → idle，重置所有内部状态 */
  reset(): void {
    if (this._state !== 'cancelled') return;
    this._state = 'idle';
    this._abortController = null;
    this._pauseResolve = null;
  }

  /**
   * 在任务循环中调用，暂停时 await 此方法会阻塞直到 resume
   * 非暂停状态立即返回
   */
  waitIfPaused(): Promise<void> {
    if (this._state !== 'paused') {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      this._pauseResolve = resolve;
    });
  }

  /**
   * 检查是否已取消，已取消则抛出 CancelledError
   */
  throwIfCancelled(): void {
    if (this._state === 'cancelled') {
      throw new CancelledError();
    }
  }
}
