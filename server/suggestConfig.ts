import { GoogleGenAI } from '@google/genai/node';
import { z } from 'zod';
import {
  SUGGEST_CONFIG_SYSTEM_INSTRUCTION,
  buildSuggestConfigUserMessage,
  type SuggestConfigPromptInput,
} from '../src/ai/prompts.ts';

const rowSampleSchema = z.record(z.string(), z.string());

export const suggestConfigRequestSchema = z.object({
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
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: userMessage,
    config: {
      systemInstruction: SUGGEST_CONFIG_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      maxOutputTokens: 2048,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }

  let json: unknown;
  try {
    json = parseJsonFromModelText(text);
  } catch {
    throw new Error('MODEL_JSON_PARSE');
  }

  const aiParsed = aiRawSchema.safeParse(json);
  if (!aiParsed.success) {
    throw new Error('MODEL_SCHEMA_MISMATCH');
  }

  return sanitizeSuggestion(aiParsed.data, parsed.headersA, parsed.headersB, headersC);
}
