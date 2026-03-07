/**
 * @jest-environment jsdom
 */
import { analyzeHtml, COMMENT_FORM_SELECTORS, AUTHOR_INPUT_PATTERNS, LOGIN_BARRIER_TEXTS } from '../page-analyzer';

describe('analyzeHtml', () => {
  describe('评论表单正向信号检测', () => {
    it('检测 form 内嵌 textarea', () => {
      const html = '<html><body><form><textarea></textarea></form></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(true);
      expect(result.hasLoginBarrier).toBe(false);
    });

    it('检测 WordPress commentform (id="commentform")', () => {
      const html = '<html><body><div id="commentform"></div></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(true);
    });

    it('检测 Disqus (id="disqus_thread")', () => {
      const html = '<html><body><div id="disqus_thread"></div></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(true);
    });

    it('检测 author 输入框 (name 属性)', () => {
      const html = '<html><body><input name="comment_author" /></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(true);
    });

    it('检测 email 输入框 (id 属性)', () => {
      const html = '<html><body><input id="user_email" /></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(true);
    });

    it('检测 url/website 输入框', () => {
      const html = '<html><body><input name="website" /></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(true);
    });

    it('无评论表单信号时返回 false', () => {
      const html = '<html><body><p>Hello world</p></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(false);
    });

    it('textarea 不在 form 内时不算正向信号', () => {
      const html = '<html><body><textarea></textarea></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(false);
    });
  });

  describe('登录拦截信号检测', () => {
    it('检测 "log in to comment"', () => {
      const html = '<html><body><p>You must log in to comment.</p></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasLoginBarrier).toBe(true);
    });

    it('检测 "sign in to comment"', () => {
      const html = '<html><body><p>Please Sign In To Comment</p></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasLoginBarrier).toBe(true);
    });

    it('检测 "登录后评论"', () => {
      const html = '<html><body><p>登录后评论</p></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasLoginBarrier).toBe(true);
    });

    it('检测 "请先登录"', () => {
      const html = '<html><body><span>请先登录</span></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasLoginBarrier).toBe(true);
    });

    it('无登录拦截信号时返回 false', () => {
      const html = '<html><body><p>Leave a comment below</p></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasLoginBarrier).toBe(false);
    });
  });

  describe('组合场景', () => {
    it('同时检测到评论表单和登录拦截', () => {
      const html = '<html><body><form id="commentform"><textarea></textarea></form><p>请先登录</p></body></html>';
      const result = analyzeHtml(html);
      expect(result.hasCommentForm).toBe(true);
      expect(result.hasLoginBarrier).toBe(true);
    });

    it('空 HTML 返回全 false', () => {
      const result = analyzeHtml('');
      expect(result.hasCommentForm).toBe(false);
      expect(result.hasLoginBarrier).toBe(false);
    });
  });

  describe('导出常量', () => {
    it('COMMENT_FORM_SELECTORS 包含预期选择器', () => {
      expect(COMMENT_FORM_SELECTORS).toContain('form textarea');
      expect(COMMENT_FORM_SELECTORS).toContain('#commentform');
      expect(COMMENT_FORM_SELECTORS).toContain('#disqus_thread');
    });

    it('AUTHOR_INPUT_PATTERNS 包含预期模式', () => {
      expect(AUTHOR_INPUT_PATTERNS).toEqual(['author', 'email', 'url', 'website']);
    });

    it('LOGIN_BARRIER_TEXTS 包含预期文本', () => {
      expect(LOGIN_BARRIER_TEXTS).toContain('log in to comment');
      expect(LOGIN_BARRIER_TEXTS).toContain('sign in to comment');
      expect(LOGIN_BARRIER_TEXTS).toContain('登录后评论');
      expect(LOGIN_BARRIER_TEXTS).toContain('请先登录');
    });
  });
});
