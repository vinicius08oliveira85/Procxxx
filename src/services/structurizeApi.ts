/**
 * Cliente HTTP para structurize via API no servidor (Gemini).
 */

export class StructurizeApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'StructurizeApiError';
  }
}

function structurizeUrl(): string {
  const path = '/api/ai/structurize';
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
      'API não encontrada (404). Rode a API (ex.: npm run dev ou dev:api na porta 3001). ' +
      'Com front só na 3000, defina VITE_API_ORIGIN=http://localhost:3001 no .env.local.'
    );
  }
  if (status === 429) {
    return 'Limite de pedidos ao Gemini (429). Aguarde e tente de novo.';
  }
  if (status === 502 || status === 504) {
    return 'Não foi possível contactar a API ou o modelo falhou. Tente de novo.';
  }
  if (status === 500) {
    return 'Erro interno na API (500). Confira logs do servidor e GEMINI_API_KEY.';
  }
  return `Erro HTTP ${status}`;
}

export type StructurizeApiResponse = {
  rows: Record<string, unknown>[];
};

export async function fetchStructurize(text: string): Promise<StructurizeApiResponse> {
  const res = await fetch(structurizeUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    rows?: Record<string, unknown>[];
  };

  if (!res.ok) {
    throw new StructurizeApiError(data.error || httpErrorMessage(res.status), res.status);
  }

  if (!Array.isArray(data.rows)) {
    throw new StructurizeApiError('Resposta inválida do servidor.');
  }

  return { rows: data.rows };
}
