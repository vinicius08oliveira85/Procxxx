import { describe, expect, it } from 'vitest';
import { DEFAULT_DENSITY, isDensity, readStoredDensity } from './uiDensity';

describe('densidade da interface', () => {
  it('só aceita os valores conhecidos', () => {
    expect(isDensity('compact')).toBe(true);
    expect(isDensity('comfortable')).toBe(true);
    expect(isDensity('wide')).toBe(false);
    expect(isDensity(null)).toBe(false);
  });

  it('cai no padrão quando não há storage disponível', () => {
    expect(readStoredDensity()).toBe(DEFAULT_DENSITY);
  });
});
