import { actionsAttemptSubmit, shouldShowManualCaptcha } from '../auto-comment';

describe('auto-comment helpers', () => {
  it('detects submit attempt when actions contain click', () => {
    expect(actionsAttemptSubmit([{ type: 'scroll' }, { type: 'click' }])).toBe(true);
  });

  it('does not treat typing-only actions as submit attempt', () => {
    expect(actionsAttemptSubmit([{ type: 'scroll' }, { type: 'type' }])).toBe(false);
  });

  it('shows manual captcha only when captcha exists and no submit click is planned', () => {
    expect(shouldShowManualCaptcha(true, [{ type: 'type' }])).toBe(true);
    expect(shouldShowManualCaptcha(true, [{ type: 'click' }])).toBe(false);
    expect(shouldShowManualCaptcha(false, [{ type: 'type' }])).toBe(false);
  });
});
