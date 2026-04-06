/**
 * Parser local para texto colado (TSV/CSV delimitado) — sem rede.
 */

export const PASTE_DELIMITER_SAMPLE_LINES = 12;

export type PasteDelimiter = '\t' | ';' | ',';

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
export function parsePastedTable(input: string, hasHeaders: boolean): PastePreviewState {
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

  if (hasHeaders) {
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
    message: `${rows.length} linha(s) · delimitador: ${delimiterLabel}`,
  };
}
