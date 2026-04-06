/**
 * Vercel Serverless + reutilização no Express (export runStructurize).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z, ZodError } from 'zod';

const SYSTEM_INSTRUCTION = `Você é um especialista em estruturação de dados. 
Sua tarefa é receber um texto bruto (que pode ser uma lista, log, extrato ou dados colados de um PDF/Excel) e convertê-lo em um array de objetos JSON estruturado.
Regras:
1. Identifique os cabeçalhos mais lógicos.
2. Limpe valores (remova espaços extras, normalize datas se possível).
3. Retorne APENAS um objeto JSON com a chave "rows" contendo o array de objetos.
4. Se o texto estiver muito bagunçado, tente inferir a estrutura por padrões repetitivos.
5. Não use markdown na resposta, apenas o JSON puro.`;

export const structurizeBodySchema = z.object({
  text: z.string().min(1).max(100000),
});

const structurizeResponseSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
});

export type StructurizeResult = { rows: Record<string, unknown>[] };

export async function runStructurize(
  text: string,
  apiKey: string,
  model: string
): Promise<StructurizeResult> {
  const modelId = model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: `Estruture o seguinte texto:\n\n${text}` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });
  } catch {
    throw new Error('GEMINI_NETWORK');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('GEMINI_HTTP_PARSE');
  }

  const errMsg =
    typeof data === 'object' && data !== null && 'error' in data
      ? String((data as { error?: { message?: string } }).error?.message ?? '')
      : '';

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('GEMINI_AUTH');
    if (response.status === 429) throw new Error(`GEMINI_HTTP_429${errMsg ? `: ${errMsg}` : ''}`);
    if (response.status >= 400) throw new Error(`GEMINI_HTTP_${response.status}${errMsg ? `: ${errMsg}` : ''}`);
    throw new Error(errMsg || 'Erro na API do Gemini');
  }

  const rawText = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
    .candidates?.[0]?.content?.parts?.[0]?.text;
  if (rawText == null || String(rawText).trim() === '') {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(rawText));
  } catch {
    throw new Error('MODEL_JSON_PARSE');
  }

  const validated = structurizeResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error('STRUCTURIZE_INVALID_ROWS');
  }

  return { rows: validated.data.rows };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'API Key não configurada' });
    return;
  }

  try {
    const { text } = structurizeBodySchema.parse(req.body);
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const result = await runStructurize(text, apiKey, model);
    res.status(200).json(result);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: 'Corpo inválido: envie { "text": string } com 1–100000 caracteres.' });
      return;
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === 'STRUCTURIZE_INVALID_ROWS') {
      res.status(502).json({
        error: 'A resposta do modelo não contém um array "rows" de objetos válido. Tente novamente.',
      });
      return;
    }
    if (msg === 'MODEL_JSON_PARSE' || msg === 'EMPTY_MODEL_RESPONSE') {
      res.status(502).json({ error: 'A resposta do modelo não pôde ser interpretada. Tente novamente.' });
      return;
    }
    if (msg === 'GEMINI_AUTH') {
      res.status(502).json({
        error: 'Chave Gemini inválida ou sem permissão. Confira GEMINI_API_KEY no ambiente.',
      });
      return;
    }
    if (msg === 'GEMINI_NETWORK') {
      res.status(502).json({ error: 'Não foi possível contactar a API do Gemini (rede). Tente de novo.' });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_429')) {
      res.status(429).json({
        error:
          'Limite de uso do Gemini atingido. Aguarde e tente de novo. https://ai.google.dev/gemini-api/docs/rate-limits',
      });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_')) {
      res.status(502).json({ error: 'A API do Gemini recusou a requisição. Verifique cota e GEMINI_MODEL.' });
      return;
    }
    res.status(500).json({ error: msg || 'Erro interno' });
  }
}
