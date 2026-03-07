import type { AnalysisResult, CommentStatus } from './types';

/**
 * 根据 AnalysisResult 综合判定最终 CommentStatus
 * 优先级：login_required > commentable > uncertain
 */
export function resolveStatus(result: AnalysisResult): CommentStatus {
  if (result.redirectedToLogin || result.hasLoginBarrier) {
    return 'login_required';
  }
  if (result.hasCommentForm) {
    return 'commentable';
  }
  return 'uncertain';
}
