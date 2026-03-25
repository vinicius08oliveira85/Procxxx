/**
 * Vercel Serverless: mesma rota que o Express em desenvolvimento.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  try {
    const result = await runSuggestConfig(req.body, apiKey, model);
    res.status(200).json(result);
  } catch (e) {
    if (e instanceof ZodError) {
      res.status(400).json({ error: 'Corpo da requisição inválido.' });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'MODEL_SCHEMA_MISMATCH' || msg === 'MODEL_JSON_PARSE') {
      res.status(502).json({ error: 'A resposta do modelo não pôde ser interpretada. Tente novamente.' });
      return;
    }
    if (msg === 'EMPTY_MODEL_RESPONSE') {
      res.status(502).json({ error: 'O modelo não retornou conteúdo. Tente novamente.' });
      return;
    }
    console.error('[suggest-config]', msg);
    res.status(502).json({ error: 'Falha ao consultar o modelo. Tente novamente mais tarde.' });
  }
}
