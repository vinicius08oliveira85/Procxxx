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

async function handleSuggest(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'Serviço de IA indisponível: defina GEMINI_API_KEY no ambiente do servidor.',
    });
    return;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const body = parseBody(req);
  if (body === undefined) {
    res.status(400).json({ error: 'Corpo JSON ausente ou inválido.' });
    return;
  }

  try {
    const result = await runSuggestConfig(body, apiKey, model);
    res.status(200).json(result);
  } catch (e) {
    if (isZodLike(e)) {
      res.status(400).json({ error: 'Corpo da requisição inválido.' });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'GEMINI_AUTH') {
      res.status(502).json({
        error: 'Chave Gemini inválida ou sem permissão. Confira GEMINI_API_KEY no painel da Vercel (Production e Preview).',
      });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_')) {
      res.status(502).json({
        error: 'A API do Gemini recusou a requisição. Verifique cota, modelo (GEMINI_MODEL) e os logs da função.',
      });
      return;
    }
    if (msg === 'MODEL_SCHEMA_MISMATCH' || msg === 'MODEL_JSON_PARSE') {
      res.status(502).json({ error: 'A resposta do modelo não pôde ser interpretada. Tente novamente.' });
      return;
    }
    if (msg === 'EMPTY_MODEL_RESPONSE') {
      res.status(502).json({ error: 'O modelo não retornou conteúdo. Tente novamente.' });
      return;
    }
    console.error('[suggest-config]', msg, e);
    res.status(502).json({ error: 'Falha ao consultar o modelo. Tente novamente mais tarde.' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    await handleSuggest(req, res);
  } catch (top: unknown) {
    console.error('[suggest-config] fatal', top);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Erro interno na função. Consulte os logs em Vercel → Functions.',
      });
    }
  }
}
