/**
 * Vercel Serverless: mesma rota que o Express em desenvolvimento.
 * Import estático para o bundler incluir server/suggestConfig (import() com .ts quebra em runtime na Vercel).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { runSuggestConfig } from '../../server/suggestConfig.ts';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '512kb',
    },
  },
};

function isZodLike(e: unknown): boolean {
  if (e instanceof ZodError) return true;
  return (
    typeof e === 'object' &&
    e !== null &&
    'issues' in e &&
    Array.isArray((e as { issues: unknown }).issues)
  );
}

function parseBody(req: VercelRequest): unknown {
  const raw = req.body;
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  return raw;
}

/** Evita segundo 500 se res.json() falhar (ex.: headers já enviados). */
function sendJson(res: VercelResponse, status: number, payload: unknown): void {
  try {
    if (res.headersSent) return;
    res.status(status).json(payload);
  } catch (err) {
    console.error('[suggest-config] sendJson failed', err);
  }
}

async function handleSuggest(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    if (!res.headersSent) res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, {
      error: 'Serviço de IA indisponível: defina GEMINI_API_KEY no ambiente do servidor.',
    });
    return;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const body = parseBody(req);
  if (body === undefined) {
    sendJson(res, 400, { error: 'Corpo JSON ausente ou inválido.' });
    return;
  }

  try {
    const result = await runSuggestConfig(body, apiKey, model);
    sendJson(res, 200, result);
  } catch (e) {
    if (isZodLike(e)) {
      sendJson(res, 400, { error: 'Corpo da requisição inválido.' });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'GEMINI_AUTH') {
      sendJson(res, 502, {
        error:
          'Chave Gemini inválida ou sem permissão. Confira GEMINI_API_KEY no painel da Vercel (Production e Preview).',
      });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_')) {
      sendJson(res, 502, {
        error:
          'A API do Gemini recusou a requisição. Verifique cota, modelo (GEMINI_MODEL) e os logs da função.',
      });
      return;
    }
    if (msg === 'MODEL_SCHEMA_MISMATCH' || msg === 'MODEL_JSON_PARSE') {
      sendJson(res, 502, { error: 'A resposta do modelo não pôde ser interpretada. Tente novamente.' });
      return;
    }
    if (msg === 'EMPTY_MODEL_RESPONSE') {
      sendJson(res, 502, { error: 'O modelo não retornou conteúdo. Tente novamente.' });
      return;
    }
    console.error('[suggest-config]', msg, e);
    sendJson(res, 502, { error: 'Falha ao consultar o modelo. Tente novamente mais tarde.' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    await handleSuggest(req, res);
  } catch (top: unknown) {
    console.error('[suggest-config] fatal', top);
    sendJson(res, 500, {
      error: 'Erro interno na função. Consulte os logs em Vercel → Functions.',
    });
  }
}
