/**
 * Cliente HTTP para sugestões de configuração via API no servidor (Gemini).
 */

export type SuggestConfigPayload = {
  headersA: string[];
  headersB: string[];
  headersC?: string[];
  sampleRowsA?: Record<string, string>[];
  sampleRowsB?: Record<string, string>[];
  sampleRowsC?: Record<string, string>[];
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
  payload: SuggestConfigPayload
): Promise<SuggestConfigApiResponse> {
  const res = await fetch(suggestConfigUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

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

/** Amostra linhas da planilha para enviar ao modelo (valores truncados como string). */
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
      out[k] = s;
    }
    return out;
  });
}
