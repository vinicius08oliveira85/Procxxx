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

export async function fetchSuggestConfig(
  payload: SuggestConfigPayload
): Promise<SuggestConfigApiResponse> {
  const res = await fetch('/api/ai/suggest-config', {
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
    throw new AiSuggestError(data.error || `Erro HTTP ${res.status}`, res.status);
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
