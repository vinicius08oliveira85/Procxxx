/**
 * Parser local para texto colado (TSV/CSV delimitado) — sem rede.
 * Suporta cabeçalho em duas linhas (categorias + colunas), p.ex. tabelas estilo FBref.
 */

export const PASTE_DELIMITER_SAMPLE_LINES = 12;

export type PasteDelimiter = '\t' | ';' | ',';

export type ParsePastedTableOptions = {
  /** Colunas à esquerda sem categoria (sobrepõe a heurística automática). */
  leadingUngroupedColumns?: number;
};

export function detectDelimiter(lines: string[]): PasteDelimiter {
  const sample = lines.slice(0, PASTE_DELIMITER_SAMPLE_LINES);
  if (sample.some((l) => l.includes('\t'))) return '\t';
  if (sample.some((l) => l.includes(';'))) return ';';
  return ',';
}

export function splitRow(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((c) => c.trim());
}

export function uniquifyHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h) => {
    const base = (h ?? '').trim() || 'Coluna';
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/** Reparte `total` em `parts` partes inteiras o mais igual possível. */
export function splitEven(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Herda célula vazia da categoria não vazia à esquerda (export Excel com merges). */
export function forwardFillCategoryRow(cells: string[]): string[] {
  const N = cells.length;
  const out = new Array<string>(N);
  let last = '';
  for (let i = 0; i < N; i++) {
    const t = (cells[i] ?? '').trim();
    if (t) last = t;
    out[i] = last;
  }
  return out;
}

function normGroup(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Perfis de largura conhecidos (rest = N - L) para rótulos típicos "Playing Time / Performance / Per 90".
 */
export function inferKnownGroupSpans(groups: string[], rest: number): number[] | null {
  if (groups.length !== 3) return null;
  const g = groups.map(normGroup);
  const playing = g[0].includes('playing') && g[0].includes('time');
  const perf = g[1].includes('performance');
  const p90 = g[2].includes('90') && (g[2].includes('minute') || g[2].includes('min') || g[2].includes('per'));
  if (!playing || !perf || !p90) return null;
  if (rest === 17) return [4, 8, 5];
  return null;
}

/**
 * Linha de categorias com menos células que a linha de cabeçalhos: expande para N colunas.
 */
export function buildSparseCategoryParents(
  topCells: string[],
  bottomColCount: number,
  bottomFirstCell: string,
  options?: ParsePastedTableOptions
): string[] {
  const groups = topCells.map((t) => t.trim()).filter(Boolean);
  const G = groups.length;
  const N = bottomColCount;
  if (G === 0) return Array(N).fill('');

  let L: number;
  if (options?.leadingUngroupedColumns != null && options.leadingUngroupedColumns >= 0) {
    L = Math.min(options.leadingUngroupedColumns, N - G);
  } else {
    const firstNonEmpty = topCells.findIndex((c) => c.trim() !== '');
    const squad = bottomFirstCell.trim().toLowerCase() === 'squad';
    if (squad && G >= 2) {
      L = Math.max(4, firstNonEmpty >= 0 ? firstNonEmpty : 0);
    } else {
      L = firstNonEmpty >= 0 ? firstNonEmpty : 0;
    }
    L = Math.min(L, N - 1);
  }

  const rest = N - L;
  if (rest <= 0) return Array(N).fill('');

  let spans = inferKnownGroupSpans(groups, rest) ?? splitEven(rest, G);
  const sumSpans = spans.reduce((a, b) => a + b, 0);
  if (sumSpans !== rest) {
    const d = rest - sumSpans;
    spans = [...spans];
    spans[spans.length - 1] = (spans[spans.length - 1] ?? 0) + d;
  }

  const out: string[] = [];
  for (let i = 0; i < L; i++) out.push('');
  for (let g = 0; g < G; g++) {
    const w = spans[g] ?? 0;
    for (let j = 0; j < w; j++) out.push(groups[g]);
  }
  while (out.length < N) out.push(groups[G - 1] ?? '');
  return out.slice(0, N);
}

/** Cabeçalho em duas linhas: linha de categorias mais curta ou mesma largura com células vazias (merge). */
export function isTwoLineHeaderLayout(r0: string[], r1: string[]): boolean {
  if (r1.length === 0) return false;
  if (r0.length > r1.length) return false;
  if (r0.length < r1.length) return true;
  return r0.some((c) => !c.trim());
}

export function mergeTwoHeaderRows(
  r0: string[],
  r1: string[],
  options?: ParsePastedTableOptions
): string[] {
  const N = r1.length;
  let parents: string[];

  if (r0.length === N) {
    parents = forwardFillCategoryRow(r0);
  } else {
    parents = buildSparseCategoryParents(r0, N, r1[0] ?? '', options);
  }

  const combined = r1.map((sub, i) => {
    const p = (parents[i] ?? '').trim();
    return p ? `${p} / ${sub}` : sub;
  });
  return uniquifyHeaders(combined);
}

export type PasteParseStatus = 'waiting' | 'no_data' | 'header_only' | 'ready';

export type PastePreviewState = {
  rows: Record<string, unknown>[] | null;
  status: PasteParseStatus;
  delimiter: PasteDelimiter | null;
  message: string;
};

/**
 * Converte texto colado em linhas de objetos (pré-visualização / ExcelData).
 */
export function parsePastedTable(
  input: string,
  hasHeaders: boolean,
  options?: ParsePastedTableOptions
): PastePreviewState {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      rows: null,
      status: 'waiting',
      delimiter: null,
      message: 'Aguardando colagem — cole dados do Excel, Google Sheets ou texto delimitado.',
    };
  }

  const lines = input.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    return {
      rows: null,
      status: 'no_data',
      delimiter: null,
      message: 'Nenhuma linha válida (só espaços em branco).',
    };
  }

  const delimiter = detectDelimiter(lines);

  let headers: string[];
  let dataLines: string[];
  let headerNote = '';

  if (hasHeaders) {
    const r0 = splitRow(lines[0], delimiter);
    const r1 = splitRow(lines[1] ?? '', delimiter);

    if (lines.length >= 2 && isTwoLineHeaderLayout(r0, r1)) {
      headers = mergeTwoHeaderRows(r0, r1, options);
      dataLines = lines.slice(2);
      headerNote = ' · cabeçalho em 2 linhas (categorias + colunas)';
      if (dataLines.length === 0) {
        return {
          rows: null,
          status: 'header_only',
          delimiter,
          message:
            'Só existem as duas linhas de cabeçalho. Adicione linhas de dados.' + headerNote,
        };
      }
    } else {
      const rawHeaders = splitRow(lines[0], delimiter);
      headers = uniquifyHeaders(rawHeaders);
      dataLines = lines.slice(1);
      if (dataLines.length === 0) {
        return {
          rows: null,
          status: 'header_only',
          delimiter,
          message: 'Só existe o cabeçalho. Adicione linhas de dados abaixo da primeira linha.',
        };
      }
    }
  } else {
    const maxCols = Math.max(1, ...lines.map((l) => splitRow(l, delimiter).length));
    headers = Array.from({ length: maxCols }, (_, i) => `Coluna ${i + 1}`);
    dataLines = lines;
  }

  const rows: Record<string, unknown>[] = dataLines.map((line) => {
    const cells = splitRow(line, delimiter);
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? '';
    });
    return row;
  });

  const delimiterLabel =
    delimiter === '\t' ? 'tab' : delimiter === ';' ? 'ponto e vírgula' : 'vírgula';

  return {
    rows,
    status: 'ready',
    delimiter,
    message: `${rows.length} linha(s) · delimitador: ${delimiterLabel}${headerNote}`,
  };
}
