/**
 * Contexto leve (amostra limitada) para enriquecer o pedido ao assistente IA.
 */

export const AI_CONTEXT_SAMPLE_MAX_ROWS = 500;
export const AI_CONTEXT_MAX_COLUMNS_PER_TABLE = 20;
export const AI_CONTEXT_MAX_HINTS = 10;
export const AI_CONTEXT_EXAMPLES_PER_PAIR = 5;
export const AI_CONTEXT_VALUE_MAX_LEN = 80;

export type AiSuggestColumnStat = {
  table: 'A' | 'B';
  name: string;
  nonEmptyRatio: number;
  approxUniqueCount: number;
};

export type AiSuggestKeyAlignmentHint = {
  columnInA: string;
  columnInB: string;
  examplesInANotInB: string[];
};

export type AiSuggestContextPayload = {
  rowCountA: number;
  rowCountB: number;
  columnStats?: AiSuggestColumnStat[];
  keyAlignmentHints?: AiSuggestKeyAlignmentHint[];
};

function normHeader(s: string): string {
  return s.trim().toLowerCase();
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function isEmptyCell(v: unknown): boolean {
  return cellToString(v) === '';
}

function computeColumnStatsForTable(
  table: 'A' | 'B',
  headers: string[],
  sampleRows: Record<string, unknown>[],
  maxCols: number
): AiSuggestColumnStat[] {
  const cols = headers.slice(0, maxCols);
  const n = sampleRows.length;
  if (n === 0) {
    return cols.map(name => ({
      table,
      name,
      nonEmptyRatio: 0,
      approxUniqueCount: 0,
    }));
  }

  return cols.map(name => {
    const values = sampleRows.map(r => cellToString(r[name]));
    const nonEmpty = values.filter(s => s !== '').length;
    const nonEmptyRatio = Math.round((nonEmpty / n) * 1000) / 1000;
    const approxUniqueCount = new Set(values.filter(s => s !== '')).size;
    return { table, name, nonEmptyRatio, approxUniqueCount };
  });
}

/**
 * Pares de colunas com o mesmo nome normalizado entre A e B; exemplos de valor em A ausentes na amostra de B.
 */
function buildKeyAlignmentHints(
  headersA: string[],
  headersB: string[],
  sampleA: Record<string, unknown>[],
  sampleB: Record<string, unknown>[]
): AiSuggestKeyAlignmentHint[] {
  const hints: AiSuggestKeyAlignmentHint[] = [];
  const bByNorm = new Map<string, string>();
  for (const h of headersB) {
    bByNorm.set(normHeader(h), h);
  }

  for (const hA of headersA) {
    const n = normHeader(hA);
    const hB = bByNorm.get(n);
    if (!hB) continue;

    const setB = new Set<string>();
    for (const row of sampleB) {
      const s = cellToString(row[hB]);
      if (s !== '') setB.add(s);
    }

    const examples: string[] = [];
    for (const row of sampleA) {
      if (examples.length >= AI_CONTEXT_EXAMPLES_PER_PAIR) break;
      const s = cellToString(row[hA]);
      if (s === '') continue;
      if (!setB.has(s)) {
        const clipped = s.length > AI_CONTEXT_VALUE_MAX_LEN ? `${s.slice(0, AI_CONTEXT_VALUE_MAX_LEN)}…` : s;
        if (!examples.includes(clipped)) examples.push(clipped);
      }
    }

    hints.push({ columnInA: hA, columnInB: hB, examplesInANotInB: examples });
    if (hints.length >= AI_CONTEXT_MAX_HINTS) break;
  }

  return hints.filter(h => h.examplesInANotInB.length > 0);
}

export function buildAiSuggestContext(
  sheetA: Record<string, unknown>[],
  sheetB: Record<string, unknown>[],
  headersA: string[],
  headersB: string[]
): AiSuggestContextPayload {
  const rowCountA = sheetA.length;
  const rowCountB = sheetB.length;
  const sampleA = sheetA.slice(0, AI_CONTEXT_SAMPLE_MAX_ROWS);
  const sampleB = sheetB.slice(0, AI_CONTEXT_SAMPLE_MAX_ROWS);

  const statsA = computeColumnStatsForTable('A', headersA, sampleA, AI_CONTEXT_MAX_COLUMNS_PER_TABLE);
  const statsB = computeColumnStatsForTable('B', headersB, sampleB, AI_CONTEXT_MAX_COLUMNS_PER_TABLE);
  const columnStats = [...statsA, ...statsB];

  const keyAlignmentHints = buildKeyAlignmentHints(headersA, headersB, sampleA, sampleB);

  return {
    rowCountA,
    rowCountB,
    columnStats,
    keyAlignmentHints: keyAlignmentHints.length > 0 ? keyAlignmentHints : undefined,
  };
}
