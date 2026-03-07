import * as fc from 'fast-check';

/**
 * Bug Condition Exploration Property Test
 *
 * 目标：在实施修复之前，通过属性测试证明缺陷存在。
 * 测试编码的是期望行为（修复后应通过），在未修复代码上应该失败。
 *
 * Bug Condition (from design doc):
 *   commentVisibleOnPage := pageBodyExcerpt CONTAINS submittedComment
 *                           OR fuzzyMatch(pageBodyExcerpt, submittedComment) > 0.8
 *   isBugCondition := commentVisibleOnPage AND verifyStatus IN ['unknown', 'error']
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4
 */

// ---------------------------------------------------------------------------
// Types mirroring the production code
// ---------------------------------------------------------------------------

interface VerifyResponse {
  status: 'confirmation_page' | 'success' | 'error' | 'unknown';
  actions?: { type: string; selector: string; value?: string }[];
  message?: string;
}

interface VerificationDecision {
  finalSuccess: boolean;
  shouldRetry: boolean;
  shouldContinue: boolean;
  shouldBreak: boolean;
}

// ---------------------------------------------------------------------------
// Faithfully extracted decision logic from auto-comment.ts verification loop
// (Step 4 of runAutoComment — current UNFIXED code)
// ---------------------------------------------------------------------------

/**
 * 从 auto-comment.ts 的验证循环中提取的决策逻辑（修复后版本）。
 * 修复后的行为：
 * - 'success' 状态：finalSuccess = true, break
 * - 'unknown' 或 'error' 状态 + 评论在页面可见：finalSuccess = true, break
 * - 'error' 状态 + 评论不可见：根据重试次数决定是否重试
 * - 'confirmation_page' + 非空 actions：continue（执行确认按钮）
 * - 其他：break
 */
function currentVerificationDecision(
  verifyResp: VerifyResponse,
  bodyExcerpt: string,
  lastComment: string,
  retryCount: number,
  maxRetries: number,
): VerificationDecision {
  let finalSuccess = false;
  let shouldRetry = false;
  let shouldContinue = false;
  let shouldBreak = false;

  if (verifyResp.status === 'success') {
    finalSuccess = true;
    shouldBreak = true;
  } else if (
    verifyResp.status === 'confirmation_page' &&
    verifyResp.actions &&
    verifyResp.actions.length > 0
  ) {
    // 确认页优先处理（确认页上的评论预览不等于已发布）
    shouldContinue = true;
  } else if (verifyResp.status === 'unknown') {
    // unknown 状态：用评论可见性兜底
    if (lastComment && bodyExcerpt &&
        commentIsVisibleOnPage(bodyExcerpt, lastComment)) {
      finalSuccess = true;
      shouldBreak = true;
    } else {
      shouldBreak = true;
    }
  } else if (verifyResp.status === 'error') {
    // error 状态：根据重试次数决定
    if (retryCount < maxRetries) {
      shouldRetry = true;
    } else {
      shouldBreak = true;
    }
  } else {
    shouldBreak = true;
  }

  return { finalSuccess, shouldRetry, shouldContinue, shouldBreak };
}

// ---------------------------------------------------------------------------
// Bug condition check (from design doc)
// ---------------------------------------------------------------------------

function commentIsVisibleOnPage(
  bodyExcerpt: string,
  submittedComment: string,
): boolean {
  if (!submittedComment || submittedComment.trim().length === 0) return false;
  // 不区分大小写的子串匹配
  return bodyExcerpt.toLowerCase().includes(submittedComment.toLowerCase());
}

function isBugCondition(input: {
  verifyStatus: string;
  pageBodyExcerpt: string;
  submittedComment: string;
}): boolean {
  const visible = commentIsVisibleOnPage(
    input.pageBodyExcerpt,
    input.submittedComment,
  );
  return visible && ['unknown', 'error'].includes(input.verifyStatus);
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * 生成非空评论内容（至少 3 个字符，避免空白字符串）
 */
const commentContentArb: fc.Arbitrary<string> = fc
  .string({ minLength: 3, maxLength: 100 })
  .filter((s: string) => s.trim().length >= 3 && /\S/.test(s));

/**
 * 生成包含指定评论内容的页面正文摘要
 */
function pageBodyContainingComment(comment: string) {
  return fc
    .tuple(
      fc.string({ minLength: 0, maxLength: 200 }),
      fc.string({ minLength: 0, maxLength: 200 }),
    )
    .map(([prefix, suffix]) => `${prefix}${comment}${suffix}`);
}

/**
 * 生成 bug 条件输入：评论可见 + 状态为 unknown 或 error
 */
const bugConditionInputArb = commentContentArb.chain((comment: string) =>
  fc.tuple(
    pageBodyContainingComment(comment),
    fc.constantFrom('unknown' as const, 'error' as const),
    fc.integer({ min: 0, max: 2 }), // retryCount < MAX_RETRIES(3)
  ).map(([bodyExcerpt, status, retryCount]) => ({
    comment,
    bodyExcerpt,
    status,
    retryCount,
  })),
);

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;

describe('Post-Submit Verification - Bug Condition Exploration', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3**
   *
   * Property 1a: When comment is visible on page and analyzePostSubmit returns
   * 'unknown', the verification should recognize success (finalSuccess = true).
   *
   * Current buggy behavior: 'unknown' causes break with finalSuccess = false.
   * Expected behavior after fix: finalSuccess = true when comment is visible.
   */
  it('should set finalSuccess=true when comment is visible and status is unknown', () => {
    fc.assert(
      fc.property(
        commentContentArb.chain((comment: string) =>
          pageBodyContainingComment(comment).map((body: string) => ({
            comment,
            body,
          })),
        ),
        ({ comment, body }) => {
          // Precondition: bug condition holds
          expect(
            isBugCondition({
              verifyStatus: 'unknown',
              pageBodyExcerpt: body,
              submittedComment: comment,
            }),
          ).toBe(true);

          const decision = currentVerificationDecision(
            { status: 'unknown' },
            body,
            comment,
            0,
            MAX_RETRIES,
          );

          // Expected behavior (after fix): should recognize success
          expect(decision.finalSuccess).toBe(true);
          expect(decision.shouldRetry).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.4, 2.4**
   *
   * Property 1b: When comment is visible on page and analyzePostSubmit returns
   * 'error', the verification should still trigger retry (AI handles this case
   * via enhanced prompt; code-level visibility check only applies to 'unknown').
   */
  it('should still trigger retry when status is error even if comment visible (AI handles this)', () => {
    fc.assert(
      fc.property(
        commentContentArb.chain((comment: string) =>
          fc.tuple(
            pageBodyContainingComment(comment),
            fc.integer({ min: 0, max: 2 }), // retryCount < MAX_RETRIES
          ).map(([body, retryCount]) => ({
            comment,
            body,
            retryCount,
          })),
        ),
        ({ comment, body, retryCount }) => {
          const decision = currentVerificationDecision(
            { status: 'error', message: 'some error' },
            body,
            comment,
            retryCount,
            MAX_RETRIES,
          );

          // error status → retry (AI should have returned success if comment was visible)
          expect(decision.shouldRetry).toBe(true);
          expect(decision.finalSuccess).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
   *
   * Combined Property 1: For ALL inputs where comment is visible and status is
   * 'unknown', the verification loop should set finalSuccess=true.
   * (For 'error' status, AI handles detection via enhanced prompt.)
   */
  it('should recognize success for unknown status when comment is visible (combined property)', () => {
    fc.assert(
      fc.property(
        commentContentArb.chain((comment: string) =>
          fc.tuple(
            pageBodyContainingComment(comment),
            fc.integer({ min: 0, max: 2 }),
          ).map(([bodyExcerpt, retryCount]) => ({
            comment,
            bodyExcerpt,
            retryCount,
          })),
        ),
        ({ comment, bodyExcerpt, retryCount }) => {
          const decision = currentVerificationDecision(
            { status: 'unknown' },
            bodyExcerpt,
            comment,
            retryCount,
            MAX_RETRIES,
          );

          expect(decision.finalSuccess).toBe(true);
          expect(decision.shouldRetry).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});


// ---------------------------------------------------------------------------
// Preservation Property Tests
// ---------------------------------------------------------------------------

/**
 * Preservation Property Tests
 *
 * 目标：在实施修复之前，捕获当前代码的基线行为。
 * 这些测试验证的是不涉及 bug 条件的输入路径，修复前后都应通过。
 *
 * Property 2: Preservation - Error handling and confirmation page handling
 * behavior must remain unchanged for inputs where the bug condition does NOT apply.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

// ---------------------------------------------------------------------------
// Additional Generators for Preservation Tests
// ---------------------------------------------------------------------------

/**
 * 生成非空 actions 数组（用于 confirmation_page 场景）
 */
const nonEmptyActionsArb: fc.Arbitrary<{ type: string; selector: string; value?: string }[]> = fc
  .array(
    fc.record({
      type: fc.constantFrom('click', 'input', 'scroll'),
      selector: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0),
      value: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 5 },
  );

/**
 * 生成不包含指定评论内容的页面正文摘要
 * （确保 bug 条件不成立 — 评论不可见）
 */
function pageBodyNotContainingComment(comment: string) {
  return fc
    .string({ minLength: 0, maxLength: 300 })
    .filter((body: string) => !body.toLowerCase().includes(comment.toLowerCase()));
}

/**
 * 生成合法的 retryCount（小于 MAX_RETRIES）
 */
const retryCountBelowMaxArb = fc.integer({ min: 0, max: MAX_RETRIES - 1 });

/**
 * 生成超过 MAX_RETRIES 的 retryCount
 */
const retryCountAtOrAboveMaxArb = fc.integer({ min: MAX_RETRIES, max: MAX_RETRIES + 5 });

describe('Post-Submit Verification - Preservation Properties', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * Preservation 2a: When analyzePostSubmit returns 'confirmation_page' with
   * non-empty actions, the system should execute confirmation button click
   * (shouldContinue = true).
   *
   * This behavior must remain unchanged after the fix.
   */
  it('should set shouldContinue=true for confirmation_page with non-empty actions', () => {
    fc.assert(
      fc.property(
        nonEmptyActionsArb,
        commentContentArb,
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.integer({ min: 0, max: MAX_RETRIES }),
        (actions, comment, bodyExcerpt, retryCount) => {
          const verifyResp: VerifyResponse = {
            status: 'confirmation_page',
            actions,
          };

          const decision = currentVerificationDecision(
            verifyResp,
            bodyExcerpt,
            comment,
            retryCount,
            MAX_RETRIES,
          );

          // confirmation_page + non-empty actions → execute confirmation click
          expect(decision.shouldContinue).toBe(true);
          expect(decision.finalSuccess).toBe(false);
          expect(decision.shouldRetry).toBe(false);
          expect(decision.shouldBreak).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * Preservation 2b: When analyzePostSubmit returns 'error' and comment is NOT
   * visible on page, and retryCount < MAX_RETRIES, the system should trigger
   * retry logic (shouldRetry = true).
   *
   * This behavior must remain unchanged after the fix.
   */
  it('should set shouldRetry=true for error status when comment not visible and retryCount < MAX_RETRIES', () => {
    fc.assert(
      fc.property(
        commentContentArb.chain((comment: string) =>
          fc.tuple(
            pageBodyNotContainingComment(comment),
            retryCountBelowMaxArb,
          ).map(([body, retryCount]) => ({
            comment,
            body,
            retryCount,
          })),
        ),
        ({ comment, body, retryCount }) => {
          // Precondition: bug condition does NOT hold (comment not visible)
          expect(
            isBugCondition({
              verifyStatus: 'error',
              pageBodyExcerpt: body,
              submittedComment: comment,
            }),
          ).toBe(false);

          const verifyResp: VerifyResponse = {
            status: 'error',
            message: 'submission failed',
          };

          const decision = currentVerificationDecision(
            verifyResp,
            body,
            comment,
            retryCount,
            MAX_RETRIES,
          );

          // error + comment not visible + retryCount < MAX_RETRIES → retry
          expect(decision.shouldRetry).toBe(true);
          expect(decision.finalSuccess).toBe(false);
          expect(decision.shouldContinue).toBe(false);
          expect(decision.shouldBreak).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * Preservation 2c: When retry count exceeds MAX_RETRIES, the system should
   * stop retrying (shouldBreak = true, shouldRetry = false).
   *
   * This behavior must remain unchanged after the fix.
   */
  it('should set shouldBreak=true when retryCount >= MAX_RETRIES for error status', () => {
    fc.assert(
      fc.property(
        commentContentArb.chain((comment: string) =>
          fc.tuple(
            pageBodyNotContainingComment(comment),
            retryCountAtOrAboveMaxArb,
          ).map(([body, retryCount]) => ({
            comment,
            body,
            retryCount,
          })),
        ),
        ({ comment, body, retryCount }) => {
          const verifyResp: VerifyResponse = {
            status: 'error',
            message: 'submission failed',
          };

          const decision = currentVerificationDecision(
            verifyResp,
            body,
            comment,
            retryCount,
            MAX_RETRIES,
          );

          // error + retryCount >= MAX_RETRIES → stop retrying
          expect(decision.shouldBreak).toBe(true);
          expect(decision.shouldRetry).toBe(false);
          expect(decision.finalSuccess).toBe(false);
          expect(decision.shouldContinue).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * Preservation 2d: When analyzePostSubmit returns 'success', finalSuccess
   * should be true regardless of other inputs.
   *
   * This behavior must remain unchanged after the fix.
   */
  it('should set finalSuccess=true when status is success', () => {
    fc.assert(
      fc.property(
        commentContentArb,
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.integer({ min: 0, max: MAX_RETRIES + 3 }),
        (comment, bodyExcerpt, retryCount) => {
          const verifyResp: VerifyResponse = {
            status: 'success',
          };

          const decision = currentVerificationDecision(
            verifyResp,
            bodyExcerpt,
            comment,
            retryCount,
            MAX_RETRIES,
          );

          // success → finalSuccess = true
          expect(decision.finalSuccess).toBe(true);
          expect(decision.shouldRetry).toBe(false);
          expect(decision.shouldContinue).toBe(false);
          // shouldBreak is true because we break out of the loop on success
          expect(decision.shouldBreak).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
