/**
 * Textos usados pelo endpoint de sugestão de configuração (servidor + documentação).
 * O modelo deve responder apenas com JSON válido (reforçado por responseMimeType no servidor).
 */

export const SUGGEST_CONFIG_SYSTEM_INSTRUCTION = `Você é um assistente especializado em cruzamento de planilhas (tipo PROCV/XLOOKUP).
Analise os cabeçalhos e, se fornecidas, linhas de amostra. Responda APENAS com um único objeto JSON (sem markdown, sem comentários).
Use exatamente os nomes de colunas que aparecem nos cabeçalhos fornecidos — não invente nomes.
Regras:
- keyA e keyB devem ser colunas que representem o mesmo identificador nas duas tabelas (ex.: código, CPF, e-mail).
- selectedColsB: colunas da tabela B que o usuário provavelmente quer trazer para a tabela principal (exclua a chave B se for redundante copiar).
- selectedColsA: opcional; se omitir ou vazio, o front pode manter a seleção atual. Se sugerir, use apenas nomes de headersA.
- Se houver Tabela C (terceira): preencha keyA_C (coluna em A), keyC (coluna em C) e selectedColsC quando fizer sentido.
- Se não houver Tabela C, omita keyA_C, keyC e selectedColsC ou use strings vazias e arrays vazios.
Campo opcional "notes": breve explicação em português para o usuário (uma ou duas frases).`;

export type SuggestConfigPromptInput = {
  headersA: string[];
  headersB: string[];
  headersC?: string[];
  sampleRowsA?: Record<string, string>[];
  sampleRowsB?: Record<string, string>[];
  sampleRowsC?: Record<string, string>[];
};

/**
 * Monta o texto do usuário enviado ao modelo (cabeçalhos + amostras truncadas).
 */
export function buildSuggestConfigUserMessage(input: SuggestConfigPromptInput): string {
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

/** Schema esperado na resposta (documentação / alinhamento com o servidor). */
export const SUGGEST_CONFIG_JSON_SHAPE = `{
  "keyA": string,
  "keyB": string,
  "selectedColsB": string[],
  "selectedColsA"?: string[],
  "keyA_C"?: string,
  "keyC"?: string,
  "selectedColsC"?: string[],
  "notes"?: string
}` as const;
