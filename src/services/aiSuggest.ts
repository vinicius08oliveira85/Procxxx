/**
 * Cliente HTTP para sugestões de configuração via API no servidor (Gemini).
 */

import type { AiSuggestContextPayload } from '../lib/buildAiSuggestContext';
import { maskSensitiveValue } from '../lib/maskSensitive';

export type { AiSuggestContextPayload } from '../lib/buildAiSuggestContext';

export type SuggestConfigPayload = {
  headersA: string[];
  headersB: string[];
  headersC?: string[];
  sampleRowsA?: Record<string, string>[];
  sampleRowsB?: Record<string, string>[];
  sampleRowsC?: Record<string, string>[];
  userIntent?: string;
  context?: AiSuggestContextPayload;
};

export type SuggestConfigSuggestion = {
  keyA?: string;
  keyB?: string;
  selectedColsA?: string[];
  selectedColsB?: string[];
  keyA_C?: string;
  keyC?: string;
  selectedColsC?: string[];
};

export type SuggestConfigApiResponse = {
  suggestion: SuggestConfigSuggestion;
  warnings: string[];
  notes?: string;
};

export class AiSuggestError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'AiSuggestError';
  }
}

export const MAX_USER_INTENT_LEN = 500;
/** Teto de espera da sugestão (Vercel: maxDuration 60s). */
export const AI_SUGGEST_TIMEOUT_MS = 60_000;

function suggestConfigUrl(): string {
  const path = '/api/ai/suggest-config';
  const raw =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_ORIGIN
      ? String(import.meta.env.VITE_API_ORIGIN).trim()
      : '';
  if (!raw) return path;
  const base = raw.replace(/\/$/, '');
  return `${base}${path}`;
}

function httpErrorMessage(status: number): string {
  if (status === 404) {
    return (
      'API não encontrada (404). Rode `npm run dev` (API + front) ou em outro terminal `npm run dev:api` com a API na porta 3001. ' +
      'Se usar só o front (`npm run dev:web`), defina no .env.local: VITE_API_ORIGIN=http://localhost:3001 e mantenha a API rodando. ' +
      'Com `npm run preview`, inicie também a API antes.'
    );
  }
  if (status === 429) {
    return 'Limite de pedidos ao Gemini (429). Aguarde e tente de novo; em produção verifique cota no Google AI Studio.';
  }
  if (status === 502 || status === 504) {
    return 'Não foi possível contatar a API (proxy/servidor). Verifique se o servidor na porta 3001 está ativo.';
  }
  if (status === 500) {
    return (
      'Erro interno na API (500). Na Vercel: Deployments → Functions → logs; confira GEMINI_API_KEY no ambiente do deploy e Node >= 20.'
    );
  }
  return `Erro HTTP ${status}`;
}

export async function fetchSuggestConfig(
  payload: SuggestConfigPayload,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<SuggestConfigApiResponse> {
  const timeoutMs = options.timeoutMs ?? AI_SUGGEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort);

  let res: Response;
  try {
    res = await fetch(suggestConfigUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    if (options.signal?.aborted) throw new AiSuggestError('Pedido cancelado.');
    if (controller.signal.aborted) {
      throw new AiSuggestError(
        `A sugestão demorou mais de ${Math.round(timeoutMs / 1000)}s e foi interrompida. Tente de novo.`
      );
    }
    throw new AiSuggestError(
      'Não foi possível contactar a API do assistente. Verifique a ligação e se o servidor está a correr.'
    );
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    suggestion?: SuggestConfigSuggestion;
    warnings?: string[];
    notes?: string;
  };

  if (!res.ok) {
    throw new AiSuggestError(
      data.error || httpErrorMessage(res.status),
      res.status
    );
  }

  if (!data.suggestion || !Array.isArray(data.warnings)) {
    throw new AiSuggestError('Resposta inválida do servidor.');
  }

  return {
    suggestion: data.suggestion,
    warnings: data.warnings,
    notes: data.notes,
  };
}

const MAX_ROWS = 12;
const MAX_CELL = 120;

/**
 * Amostra de linhas para enviar ao modelo: valores truncados e com dados
 * pessoais mascarados (CPF/CNPJ/telefone/e-mail) antes de saírem do browser.
 */
export function buildSampleRowsForAi(
  rows: Record<string, unknown>[] | undefined,
  maxRows = MAX_ROWS,
  maxCellLen = MAX_CELL
): Record<string, string>[] {
  if (!rows?.length) return [];
  return rows.slice(0, maxRows).map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      let s = v === null || v === undefined ? '' : String(v);
      if (s.length > maxCellLen) s = `${s.slice(0, maxCellLen)}…`;
      out[k] = maskSensitiveValue(s);
    }
    return out;
  });
}
