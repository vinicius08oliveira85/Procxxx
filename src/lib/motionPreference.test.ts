import { describe, expect, it } from 'vitest';
import { isReducedMotion, motionConfigMode } from './motionPreference';

describe('preferência de movimento', () => {
  it('segue o sistema no modo "system"', () => {
    expect(isReducedMotion('system', true)).toBe(true);
    expect(isReducedMotion('system', false)).toBe(false);
  });

  it('"reduce" reduz mesmo quando o sistema permite animações', () => {
    expect(isReducedMotion('reduce', false)).toBe(true);
  });

  it('"full" anima mesmo quando o sistema pede redução', () => {
    expect(isReducedMotion('full', true)).toBe(false);
  });

  it('traduz cada modo para o MotionConfig', () => {
    expect(motionConfigMode('system')).toBe('user');
    expect(motionConfigMode('reduce')).toBe('always');
    expect(motionConfigMode('full')).toBe('never');
  });
});
