import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders, createRateLimiter } from './rateLimit';

describe('clientIpFromHeaders', () => {
  it('prefere x-real-ip', () => {
    expect(
      clientIpFromHeaders({ 'x-real-ip': '10.0.0.1', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    ).toBe('10.0.0.1');
  });

  it('usa a última entrada de x-forwarded-for (a do proxy)', () => {
    expect(clientIpFromHeaders({ 'x-forwarded-for': 'spoofed, 203.0.113.9' })).toBe('203.0.113.9');
    expect(clientIpFromHeaders({ 'x-forwarded-for': ['a', '198.51.100.7'] })).toBe('198.51.100.7');
  });

  it('cai no fallback sem cabeçalhos', () => {
    expect(clientIpFromHeaders({}, '127.0.0.1')).toBe('127.0.0.1');
    expect(clientIpFromHeaders({})).toBe('unknown');
  });
});

describe('createRateLimiter', () => {
  it('bloqueia acima do máximo e informa retry-after', () => {
    const time = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => time });

    expect(limiter.check('a').limited).toBe(false);
    expect(limiter.check('a').limited).toBe(false);
    const blocked = limiter.check('a');
    expect(blocked.limited).toBe(true);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it('isola contadores por chave', () => {
    const limiter = createRateLimiter({ max: 1, now: () => 0 });
    expect(limiter.check('a').limited).toBe(false);
    expect(limiter.check('b').limited).toBe(false);
    expect(limiter.check('a').limited).toBe(true);
  });

  it('reinicia após a janela', () => {
    let time = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => time });
    expect(limiter.check('a').limited).toBe(false);
    time = 1001;
    expect(limiter.check('a').limited).toBe(false);
  });
});
