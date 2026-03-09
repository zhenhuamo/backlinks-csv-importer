const HONEYPOT_TEXT_PATTERNS = [
  'leave this field empty',
  'we use this field to detect spam bots',
  'if you fill this in, you will be marked as a spammer',
  'marked as a spammer',
  'do not fill',
  'anti-spam',
  'honeypot',
];

const HONEYPOT_ATTR_PATTERNS = [
  'honeypot',
  'captcha2_h',
  '-hp',
  '_hp',
  'hp-',
];

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function isTextEntryControl(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;

  const inputType = normalizeText(el.type || 'text');
  return ![
    'hidden', 'checkbox', 'radio', 'submit', 'button', 'reset',
    'range', 'color', 'date', 'datetime-local', 'month', 'time',
    'week', 'file', 'image',
  ].includes(inputType);
}

function hasVisuallyHiddenStyles(style: CSSStyleDeclaration): boolean {
  const clip = normalizeText(style.clip);
  const clipPath = normalizeText(style.clipPath);

  return clip.includes('rect(1px, 1px, 1px, 1px)')
    || clip.includes('rect(0px, 0px, 0px, 0px)')
    || clipPath.includes('inset(50%)')
    || clipPath.includes('circle(0')
    || style.pointerEvents === 'none';
}

function isOffscreen(rect: DOMRect): boolean {
  return rect.right < -50 || rect.bottom < -50 || rect.left < -500 || rect.top < -500;
}

function getFieldSignals(el: Element): string[] {
  return [
    el.getAttribute('name'),
    el.getAttribute('id'),
    el.getAttribute('placeholder'),
    el.getAttribute('aria-label'),
    el.getAttribute('class'),
    el.getAttribute('autocomplete'),
    el.getAttribute('data-form-type'),
    el.textContent,
  ].map(normalizeText).filter(Boolean);
}

export function isLikelyHoneypotField(el: Element): boolean {
  const signals = getFieldSignals(el);

  if (signals.some((signal) => HONEYPOT_TEXT_PATTERNS.some((pattern) => signal.includes(pattern)))) {
    return true;
  }

  if (signals.some((signal) => HONEYPOT_ATTR_PATTERNS.some((pattern) => signal.includes(pattern)))) {
    return true;
  }

  const ariaHidden = normalizeText(el.getAttribute('aria-hidden')) === 'true';
  const tabIndex = el.getAttribute('tabindex');
  if (ariaHidden && tabIndex === '-1') {
    return true;
  }

  return false;
}

export function isElementVisibleForInteraction(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hidden) return false;
  if (normalizeText(el.getAttribute('aria-hidden')) === 'true') return false;
  if (el instanceof HTMLInputElement && normalizeText(el.type) === 'hidden') return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  if (hasVisuallyHiddenStyles(style)) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (isOffscreen(rect)) return false;

  if (isTextEntryControl(el) && (rect.width < 24 || rect.height < 8)) {
    return false;
  }

  return true;
}

export function shouldExposeElementToAI(el: Element): boolean {
  if (!isElementVisibleForInteraction(el)) return false;
  if (isLikelyHoneypotField(el)) return false;
  return true;
}

export function isSafeActionTarget(el: Element, actionType: 'scroll' | 'click' | 'type'): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (actionType === 'scroll') return true;
  if (isLikelyHoneypotField(el)) return false;
  return isElementVisibleForInteraction(el);
}

