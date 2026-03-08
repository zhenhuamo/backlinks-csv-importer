# 实现计划：暂停与取消操作

## 概述

基于设计文档，按增量方式实现暂停/取消功能：先构建核心控制器，再改造 Rate Limiter，然后集成到自动评论流程，最后更新 UI 和键盘快捷键。每一步都在前一步基础上构建，确保无孤立代码。

## 任务

- [x] 1. 实现 OperationController 核心模块
  - [x] 1.1 创建 `src/operation-controller.ts`，实现 `CancelledError` 自定义错误类和 `OperationController` 类
    - 实现 `CancelledError extends Error`，`name` 设为 `'CancelledError'`
    - 实现 `OperationController` 类，包含 `state`、`signal`、`start()`、`pause()`、`resume()`、`cancel()`、`reset()` 方法
    - 实现 `waitIfPaused()` 方法：暂停时返回一个 pending Promise，resume 时 resolve
    - 实现 `throwIfCancelled()` 方法：已取消时抛出 `CancelledError`
    - 状态转换规则：idle→running、running→paused、paused→running、running→cancelled、paused→cancelled、cancelled→idle；非法转换静默忽略
    - 导出 `CancelledError`、`OperationController`、`OperationState` 类型
    - _需求: 1.2, 2.2, 3.2_

  - [ ]* 1.2 编写 OperationController 单元测试
    - 创建 `src/__tests__/operation-controller.test.ts`
    - 测试所有合法状态转换路径
    - 测试非法状态转换被忽略
    - 测试 `waitIfPaused()` 在暂停时阻塞、resume 后解除
    - 测试 `throwIfCancelled()` 在取消后抛出 CancelledError
    - 测试 `cancel()` 调用 `AbortController.abort()`
    - _需求: 1.2, 2.2, 3.2_

  - [ ]* 1.3 编写属性测试：状态机转换合法性
    - **Property 1: 状态机转换合法性**
    - 在 `src/__tests__/operation-controller.test.ts` 中使用 fast-check 生成随机操作序列（start/pause/resume/cancel/reset）
    - 验证任意操作序列后状态始终为 `idle | running | paused | cancelled` 之一
    - 验证状态转换始终遵循合法路径
    - **验证: 需求 1.2, 2.2, 3.2**

- [x] 2. 改造 Rate Limiter 支持暂停/取消
  - [x] 2.1 修改 `src/rate-limiter.ts` 的 `executeWithRateLimit` 函数
    - 新增可选参数 `controller?: OperationController`
    - 在每个任务 `acquire()` 之后、执行之前插入 `controller.throwIfCancelled()` 和 `await controller.waitIfPaused()` 检查
    - 取消时通过 `CancelledError` 中断整个流程
    - 将 `controller.signal` 传递给 `withTimeout`，使正在执行的请求可被 abort
    - 保持无 controller 时的原有行为不变
    - _需求: 1.2, 1.4, 1.5, 2.2_

  - [ ]* 2.2 编写 Rate Limiter 暂停/取消集成测试
    - 创建 `src/__tests__/rate-limiter-pause-cancel.test.ts`
    - 测试暂停后无新任务启动，已完成结果保留
    - 测试恢复后继续执行剩余任务
    - 测试取消后抛出 CancelledError
    - 测试进度回调在暂停/取消时正确报告
    - 测试空任务列表的暂停/取消
    - _需求: 1.2, 1.4, 1.5, 2.2, 2.4_

  - [ ]* 2.3 编写属性测试：暂停保留已完成进度且阻止新任务
    - **Property 2: 暂停保留已完成进度且阻止新任务**
    - 使用 fast-check 生成随机任务列表和暂停时机
    - 验证暂停时已完成的任务结果全部保留，暂停期间无新任务开始
    - **验证: 需求 1.2, 1.4**

  - [ ]* 2.4 编写属性测试：暂停-恢复往返等价性
    - **Property 3: 暂停-恢复往返等价性**
    - 使用 fast-check 生成随机任务列表
    - 对比暂停/恢复后最终结果与直接执行的结果完全相同
    - **验证: 需求 1.5**

  - [ ]* 2.5 编写属性测试：取消中止执行并丢弃结果
    - **Property 4: 取消中止执行并丢弃结果**
    - 使用 fast-check 生成随机任务列表和取消时机
    - 验证取消后抛出 `CancelledError`，且取消后无新任务开始
    - **验证: 需求 2.2, 2.4**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 自动评论取消支持
  - [x] 4.1 修改 `src/auto-comment.ts` 的 `runAutoComment` 函数，接受 `OperationController` 参数
    - 在 Step 1（截取快照）之后插入 `controller.throwIfCancelled()`
    - 在 Step 2（AI 分析）之后插入 `controller.throwIfCancelled()`
    - 在 Step 3（执行操作）之前插入 `controller.throwIfCancelled()`
    - 在 Step 4（验证循环）每轮开始时插入 `controller.throwIfCancelled()`
    - 在 catch 块中通过 `instanceof CancelledError` 区分取消和真正错误
    - 特殊处理：表单已提交后取消显示警告消息「评论可能已提交，请检查页面确认」
    - 取消时显示状态消息「评论操作已取消」
    - _需求: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 4.2 编写属性测试：自动评论取消阻止后续步骤
    - **Property 5: 自动评论取消阻止后续步骤**
    - 使用 fast-check 生成随机取消步骤索引
    - 验证取消后不执行后续步骤
    - **验证: 需求 3.2, 3.4, 3.5**

- [x] 5. Side Panel UI 集成
  - [x] 5.1 修改 `src/sidepanel.ts`，创建 `cleanseController` 和 `autoCommentController` 实例
    - 在模块顶部导入 `OperationController` 和 `CancelledError`
    - 创建两个控制器实例
    - _需求: 1.1, 3.1_

  - [x] 5.2 改造 `handleCleanse` 函数集成暂停/取消控制
    - 调用 `cleanseController.start()` 开始操作
    - 将 `cleanseController` 传递给 `executeWithRateLimit`
    - 在 catch 块中通过 `instanceof CancelledError` 处理取消：丢弃结果、恢复 UI
    - 操作完成或取消后调用 `cleanseController.reset()`
    - _需求: 1.2, 1.4, 1.5, 2.2, 2.3, 2.4_

  - [x] 5.3 实现清洗操作按钮状态切换
    - 运行中：「清洗URL」按钮文本变为「暂停」，显示「取消」按钮
    - 暂停中：「暂停」按钮文本变为「继续」，「取消」按钮保持可见
    - 点击「暂停」调用 `cleanseController.pause()`，点击「继续」调用 `cleanseController.resume()`
    - 点击「取消」显示 `confirm('确定要取消清洗操作吗？已完成的进度将丢失。')` 确认后调用 `cleanseController.cancel()`
    - idle 状态恢复原始按钮
    - _需求: 1.1, 1.3, 1.6, 2.1, 2.3, 2.5_

  - [x] 5.4 实现自动评论按钮状态切换
    - 运行中：「自动评论」按钮文本变为「取消评论」
    - 点击「取消评论」调用 `autoCommentController.cancel()`
    - 将 `autoCommentController` 传递给 `runAutoComment`
    - 取消后恢复按钮到可用状态
    - _需求: 3.1, 3.2, 3.3_

  - [x] 5.5 实现操作状态指示
    - 清洗运行中显示「正在清洗...」状态文本
    - 清洗暂停时显示「已暂停」状态文本，进度条颜色变为黄色（`#f59e0b`）
    - 恢复运行时进度条颜色恢复蓝色
    - 操作完成、取消或出错后 3 秒内恢复按钮到可用状态
    - _需求: 4.1, 4.2, 4.3, 4.4_

- [x] 6. 键盘快捷键支持
  - [x] 6.1 在 `src/sidepanel.ts` 中添加 Escape 键监听
    - 在 `document` 上监听 `keydown` 事件
    - 清洗运行中按 Escape → 调用 `cleanseController.pause()`
    - 自动评论运行中按 Escape → 调用 `autoCommentController.cancel()`
    - 确保与按钮操作产生相同的 UI 反馈
    - _需求: 5.1, 5.2, 5.3_

  - [ ]* 6.2 编写属性测试：Escape 键与按钮操作等价性
    - **Property 6: Escape 键与按钮操作等价性**
    - 使用 fast-check 生成随机操作状态
    - 验证 Escape 键触发的状态变更与点击按钮产生相同结果
    - **验证: 需求 5.3**

- [x] 7. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选，可跳过以加快 MVP 进度
- 每个任务引用了具体需求编号以确保可追溯性
- 属性测试使用 fast-check（已安装），每个属性对应设计文档中的正确性属性
- TypeScript 为实现语言，与现有代码库一致
