/**
 * Vercel Serverless + reutilização no Express (export runSuggestConfig).
 * Toda a lógica fica neste arquivo: a Vercel não empacota imports relativos entre ficheiros api/** de forma fiável em ESM.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z, ZodError } from 'zod';

// --- Prompts (antes geminiPrompts.ts) ---

const SUGGEST_CONFIG_SYSTEM_INSTRUCTION = `Você é um assistente especializado em cruzamento de planilhas (tipo PROCV/XLOOKUP).
Analise os cabeçalhos e, se fornecidas, linhas de amostra. Responda APENAS com um único objeto JSON (sem markdown, sem comentários).
Use exatamente os nomes de colunas que aparecem nos cabeçalhos fornecidos — não invente nomes.
Regras:
- keyA e keyB devem ser colunas que representem o mesmo identificador nas duas tabelas (ex.: código, CPF, e-mail).
- selectedColsB: colunas da tabela B que o usuário provavelmente quer trazer para a tabela principal (exclua a chave B se for redundante copiar).
- selectedColsA: opcional; se omitir ou vazio, o front pode manter a seleção atual. Se sugerir, use apenas nomes de headersA.
- Se houver Tabela C (terceira): preencha keyA_C (coluna em A), keyC (coluna em C) e selectedColsC quando fizer sentido.
- Se não houver Tabela C, omita keyA_C, keyC e selectedColsC ou use strings vazias e arrays vazios.
Campo opcional "notes": breve explicação em português para o usuário (uma ou duas frases).`;

type SuggestConfigPromptInput = {
  headersA: string[];
  headersB: string[];
  headersC?: string[];
  sampleRowsA?: Record<string, string>[];
  sampleRowsB?: Record<string, string>[];
  sampleRowsC?: Record<string, string>[];
};

function buildSuggestConfigUserMessage(input: SuggestConfigPromptInput): string {
  const hasC = Boolean(input.headersC && input.headersC.length > 0);
  const parts: string[] = [
    'Tabela principal (A) — cabeçalhos:',
    JSON.stringify(input.headersA),
    '\nTabela de busca (B) — cabeçalhos:',
    JSON.stringify(input.headersB),
  ];
  if (hasC && input.headersC) {
    parts.push('\nTabela extra (C) — cabeçalhos:', JSON.stringify(input.headersC));
  }
  if (input.sampleRowsA?.length) {
    parts.push('\nAmostra de linhas (A), até 12 linhas, valores como string:', JSON.stringify(input.sampleRowsA));
  }
  if (input.sampleRowsB?.length) {
    parts.push('\nAmostra de linhas (B):', JSON.stringify(input.sampleRowsB));
  }
  if (hasC && input.sampleRowsC?.length) {
    parts.push('\nAmostra de linhas (C):', JSON.stringify(input.sampleRowsC));
  }
  parts.push(`
Retorne JSON com o formato:
{
  "keyA": string,
  "keyB": string,
  "selectedColsB": string[],
  "selectedColsA"?: string[],
  "keyA_C"?: string,
  "keyC"?: string,
  "selectedColsC"?: string[],
  "notes"?: string
}`);
  return parts.join('\n');
}

// --- Núcleo suggestConfig (antes suggestConfig.ts) ---

const MAX_LOG_SNIPPET = 1200;

/** Trecho seguro para logs (sem dados sensíveis; evita linhas gigantes). */
function clipForLog(s: string, max = MAX_LOG_SNIPPET): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

async function geminiGenerateJsonText(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userText: string
): Promise<string> {
  const modelId = model.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
          temperature: 0.2,
        },
      }),
    });
  } catch (netErr) {
    console.error('[suggest-config][gemini] fetch failed', {
      model: modelId,
      message: netErr instanceof Error ? netErr.message : String(netErr),
    });
    throw new Error('GEMINI_NETWORK');
  }

  const rawBody = await res.text();
  let data: Record<string, unknown> = {};
  try {
    if (rawBody) data = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    console.error('[suggest-config][gemini] response body is not JSON', {
      httpStatus: res.status,
      model: modelId,
      bodyPreview: clipForLog(rawBody),
    });
    throw new Error(`GEMINI_HTTP_${res.status}: corpo da resposta não é JSON válido`);
  }

  if (!res.ok) {
    const errObj = data.error as { message?: string; status?: string } | undefined;
    const detail = errObj?.message ?? res.statusText;
    console.error('[suggest-config][gemini] API HTTP error', {
      httpStatus: res.status,
      model: modelId,
      /** Se preenchido, sobrescreve o default do código (ver Vercel → Environment Variables). */
      GEMINI_MODEL_env: process.env.GEMINI_MODEL ?? null,
      googleMessage: detail,
      googleStatus: errObj?.status ?? null,
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('GEMINI_AUTH');
    }
    throw new Error(`GEMINI_HTTP_${res.status}: ${detail}`);
  }

  const candidates = data.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
    | undefined;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== 'string') {
    const c0 = candidates?.[0];
    console.error('[suggest-config][gemini] empty or missing text', {
      model: modelId,
      responseKeys: Object.keys(data),
      promptFeedback: data.promptFeedback ?? null,
      finishReason: c0?.finishReason ?? null,
      candidatesLength: candidates?.length ?? 0,
    });
    throw new Error('EMPTY_MODEL_RESPONSE');
  }
  return text;
}

const rowSampleSchema = z.record(z.string(), z.string());

const suggestConfigRequestSchema = z.object({
  headersA: z.array(z.string()).max(400),
  headersB: z.array(z.string()).max(400),
  headersC: z.array(z.string()).max(400).optional(),
  sampleRowsA: z.array(rowSampleSchema).max(12).optional(),
  sampleRowsB: z.array(rowSampleSchema).max(12).optional(),
  sampleRowsC: z.array(rowSampleSchema).max(12).optional(),
});

const aiRawSchema = z.object({
  keyA: z.string(),
  keyB: z.string(),
  selectedColsB: z.array(z.string()),
  selectedColsA: z.array(z.string()).optional(),
  keyA_C: z.string().optional(),
  keyC: z.string().optional(),
  selectedColsC: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type SuggestConfigSuggestion = {
  keyA?: string;
  keyB?: string;
  selectedColsA?: string[];
  selectedColsB?: string[];
  keyA_C?: string;
  keyC?: string;
  selectedColsC?: string[];
};

export type SuggestConfigResponseBody = {
  suggestion: SuggestConfigSuggestion;
  warnings: string[];
  notes?: string;
};

function parseJsonFromModelText(raw: string): unknown {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  const inner = fence ? fence[1].trim() : t;
  return JSON.parse(inner) as unknown;
}

function sanitizeSuggestion(
  raw: z.infer<typeof aiRawSchema>,
  headersA: string[],
  headersB: string[],
  headersC: string[] | undefined
): { suggestion: SuggestConfigSuggestion; warnings: string[]; notes?: string } {
  const warnings: string[] = [];
  const setA = new Set(headersA);
  const setB = new Set(headersB);
  const setC = headersC && headersC.length > 0 ? new Set(headersC) : null;

  const suggestion: SuggestConfigSuggestion = {};

  if (raw.keyA && setA.has(raw.keyA)) suggestion.keyA = raw.keyA;
  else if (raw.keyA) warnings.push(`keyA "${raw.keyA}" não existe nos cabeçalhos da Tabela A.`);

  if (raw.keyB && setB.has(raw.keyB)) suggestion.keyB = raw.keyB;
  else if (raw.keyB) warnings.push(`keyB "${raw.keyB}" não existe nos cabeçalhos da Tabela B.`);

  const colsB = raw.selectedColsB.filter(c => setB.has(c));
  const droppedB = raw.selectedColsB.filter(c => !setB.has(c));
  droppedB.forEach(c => warnings.push(`Coluna B ignorada (nome inválido): "${c}".`));
  if (colsB.length > 0) suggestion.selectedColsB = colsB;
  else warnings.push('Nenhuma coluna válida em selectedColsB.');

  if (raw.selectedColsA && raw.selectedColsA.length > 0) {
    const colsA = raw.selectedColsA.filter(c => setA.has(c));
    raw.selectedColsA.filter(c => !setA.has(c)).forEach(c => warnings.push(`Coluna A ignorada: "${c}".`));
    if (colsA.length > 0) suggestion.selectedColsA = colsA;
  }

  if (setC) {
    if (raw.keyA_C && setA.has(raw.keyA_C)) suggestion.keyA_C = raw.keyA_C;
    else if (raw.keyA_C) warnings.push(`keyA_C "${raw.keyA_C}" inválido para Tabela A.`);

    if (raw.keyC && setC.has(raw.keyC)) suggestion.keyC = raw.keyC;
    else if (raw.keyC) warnings.push(`keyC "${raw.keyC}" inválido para Tabela C.`);

    if (raw.selectedColsC && raw.selectedColsC.length > 0) {
      const colsC = raw.selectedColsC.filter(c => setC.has(c));
      raw.selectedColsC.filter(c => !setC.has(c)).forEach(c => warnings.push(`Coluna C ignorada: "${c}".`));
      if (colsC.length > 0) suggestion.selectedColsC = colsC;
    }
  }

  return { suggestion, warnings, notes: raw.notes };
}

/** Usado pela função Vercel e pelo Express em `server/index.ts`. */
export async function runSuggestConfig(
  body: unknown,
  apiKey: string,
  model: string
): Promise<SuggestConfigResponseBody> {
  const parsed = suggestConfigRequestSchema.parse(body);
  const headersC = parsed.headersC?.length ? parsed.headersC : undefined;

  const promptInput: SuggestConfigPromptInput = {
    headersA: parsed.headersA,
    headersB: parsed.headersB,
    headersC,
    sampleRowsA: parsed.sampleRowsA,
    sampleRowsB: parsed.sampleRowsB,
    sampleRowsC: headersC ? parsed.sampleRowsC : undefined,
  };

  const userMessage = buildSuggestConfigUserMessage(promptInput);
  const text = await geminiGenerateJsonText(
    apiKey,
    model,
    SUGGEST_CONFIG_SYSTEM_INSTRUCTION,
    userMessage
  );

  let json: unknown;
  try {
    json = parseJsonFromModelText(text);
  } catch {
    console.error('[suggest-config][gemini] model output is not valid JSON', {
      model,
      textPreview: clipForLog(text, 800),
    });
    throw new Error('MODEL_JSON_PARSE');
  }

  const aiParsed = aiRawSchema.safeParse(json);
  if (!aiParsed.success) {
    console.error('[suggest-config][gemini] model JSON does not match schema', {
      model,
      zodIssues: aiParsed.error.issues.slice(0, 16),
    });
    throw new Error('MODEL_SCHEMA_MISMATCH');
  }

  return sanitizeSuggestion(aiParsed.data, parsed.headersA, parsed.headersB, headersC);
}

// --- Handler Vercel ---

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

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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
    if (msg === 'GEMINI_NETWORK') {
      sendJson(res, 502, {
        error: 'Não foi possível contactar a API do Gemini (rede). Tente de novo ou veja os logs da função.',
      });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_429')) {
      const retryM = /Please retry in ([\d.]+)s/i.exec(msg);
      const sec = retryM ? Math.ceil(parseFloat(retryM[1])) : undefined;
      const waitHint =
        sec != null && sec > 0 ? ` Tente de novo daqui a cerca de ${sec}s.` : ' Aguarde um minuto e tente de novo.';
      sendJson(res, 429, {
        error:
          'Limite de uso do Gemini atingido (cota do plano gratuito ou pedidos por minuto).' +
          waitHint +
          ' Consulte limites e faturação: https://ai.google.dev/gemini-api/docs/rate-limits',
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
