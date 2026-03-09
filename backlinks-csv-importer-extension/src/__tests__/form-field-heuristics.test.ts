/** @jest-environment jsdom */

import {
  isElementVisibleForInteraction,
  isLikelyHoneypotField,
  shouldExposeElementToAI,
  isSafeActionTarget,
} from '../form-field-heuristics';

function mockRect(el: Element, rect: Partial<DOMRect>): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: rect.x ?? 0,
      y: rect.y ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      top: rect.top ?? rect.y ?? 0,
      right: rect.right ?? ((rect.x ?? 0) + (rect.width ?? 0)),
      bottom: rect.bottom ?? ((rect.y ?? 0) + (rect.height ?? 0)),
      left: rect.left ?? rect.x ?? 0,
      toJSON: () => ({}),
    }),
  });
}

describe('form-field-heuristics', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes a normal visible comment textarea to AI', () => {
    const textarea = document.createElement('textarea');
    textarea.name = 'b8310b6be9';
    textarea.placeholder = 'Message goes here';
    document.body.appendChild(textarea);
    mockRect(textarea, { x: 30, y: 200, width: 750, height: 218 });

    expect(isElementVisibleForInteraction(textarea)).toBe(true);
    expect(isLikelyHoneypotField(textarea)).toBe(false);
    expect(shouldExposeElementToAI(textarea)).toBe(true);
    expect(isSafeActionTarget(textarea, 'type')).toBe(true);
  });

  it('filters visually hidden wordpress honeypot textarea', () => {
    const textarea = document.createElement('textarea');
    textarea.id = 'comment';
    textarea.setAttribute('name', 'comment');
    textarea.setAttribute('aria-label', 'hp-comment');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.clip = 'rect(1px, 1px, 1px, 1px)';
    textarea.style.position = 'absolute';
    document.body.appendChild(textarea);
    mockRect(textarea, { x: 30, y: 300, width: 2, height: 2 });

    expect(isLikelyHoneypotField(textarea)).toBe(true);
    expect(isElementVisibleForInteraction(textarea)).toBe(false);
    expect(shouldExposeElementToAI(textarea)).toBe(false);
    expect(isSafeActionTarget(textarea, 'type')).toBe(false);
  });

  it('filters anti-spam trap input moved offscreen', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'captcha2_h';
    input.placeholder = 'We use this field to detect spam bots. If you fill this in, you will be marked as a spammer.';
    document.body.appendChild(input);
    mockRect(input, { x: -15189, y: 1200, width: 130, height: 42, left: -15189, right: -15059, top: 1200, bottom: 1242 });

    expect(isLikelyHoneypotField(input)).toBe(true);
    expect(isElementVisibleForInteraction(input)).toBe(false);
    expect(shouldExposeElementToAI(input)).toBe(false);
  });

  it('allows scrolling but blocks clicking hidden honeypot fields', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-hidden', 'true');
    input.setAttribute('tabindex', '-1');
    document.body.appendChild(input);
    mockRect(input, { x: 0, y: 0, width: 100, height: 20 });

    expect(isSafeActionTarget(input, 'scroll')).toBe(true);
    expect(isSafeActionTarget(input, 'click')).toBe(false);
  });
});

