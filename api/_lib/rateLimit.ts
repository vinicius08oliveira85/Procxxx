/**
 * Rate limit por IP partilhado pelas funções da Vercel e pelo servidor Express.
 *
 * Só ficheiros em `api/_lib/` (prefixo `_`) não viram funções na Vercel, mas
 * continuam a ser empacotados quando importados. O estado é em memória e
 * por instância — é um travão de custo, não um limite distribuído: para várias
 * instâncias use um store partilhado (ex.: Upstash/Redis).
 */

export type HeaderBag = Record<string, string | string[] | undefined>;

/** Máximo de pedidos de IA por minuto, configurável por `AI_RATE_LIMIT_PER_MIN`. */
export function rateLimitMaxFromEnv(): number {
  const parsed = Number(process.env.AI_RATE_LIMIT_PER_MIN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

/**
 * IP do cliente. `x-real-ip` (injetado pela plataforma) tem prioridade;
 * em `x-forwarded-for` usa-se a última entrada, que é a acrescentada pelo proxy
 * — as anteriores podem vir do próprio cliente e ser falsificadas.
 */
export function clientIpFromHeaders(headers: HeaderBag, fallback = 'unknown'): string {
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  if (raw) {
    const parts = raw.split(',');
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }
  return fallback || 'unknown';
}

export type RateLimitDecision = { limited: boolean; retryAfterSeconds: number };

export type RateLimiter = {
  check(key: string): RateLimitDecision;
};

export type RateLimiterOptions = {
  windowMs?: number;
  max?: number;
  /** Acima disto, entradas expiradas são removidas antes de criar novas. */
  maxEntries?: number;
  now?: () => number;
};

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 20;
  const maxEntries = options.maxEntries ?? 1000;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function pruneExpired(current: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= current) buckets.delete(key);
    }
  }

  return {
    check(key) {
      const current = now();
      if (buckets.size > maxEntries) pruneExpired(current);

      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= current) {
        buckets.set(key, { count: 1, resetAt: current + windowMs });
        return { limited: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      }

      bucket.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - current) / 1000));
      return { limited: bucket.count > max, retryAfterSeconds };
    },
  };
}
