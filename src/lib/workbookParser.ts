/**
 * Leitura de planilhas — puro (sem DOM), executado no Web Worker de parsing.
 * Recebe o conteúdo já lido do `File` (texto para CSV/TSV, binário para Excel).
 */
import * as XLSX from 'xlsx';
import { normalizeExcelRow } from './excelRowNormalize';
import type { ExcelData, LookupRow } from '../types/lookupTask';

export type WorkbookParseInput = {
  fileName: string;
  /** Conteúdo de CSV/TSV (já sem decisão de encoding). */
  text: string | null;
  /** Conteúdo binário de .xlsx/.xls/.ods/... */
  buffer: ArrayBuffer | null;
};

/** Códigos devolvidos ao cliente (mensagem amigável é montada lá, com o nome do ficheiro). */
export class EmptyWorkbookError extends Error {
  constructor() {
    super('EMPTY_WORKBOOK');
    this.name = 'EmptyWorkbookError';
  }
}

/**
 * Converte o conteúdo num `ExcelData` (todas as folhas, linhas normalizadas).
 * Lança `EmptyWorkbookError` quando o ficheiro não tem folhas ou não tem linhas.
 */
export function parseWorkbook(input: WorkbookParseInput): ExcelData {
  // O BOM do UTF-8 entraria no nome da primeira coluna ("\uFEFFNome") e
  // impediria o casamento com a chave homónima da outra tabela.
  const workbook =
    input.text !== null
      ? XLSX.read(input.text.replace(/^\uFEFF/, ''), { type: 'string' })
      : XLSX.read(input.buffer as ArrayBuffer, { type: 'array', cellDates: true });

  if (!workbook.SheetNames.length) throw new EmptyWorkbookError();

  const sheets: Record<string, LookupRow[]> = {};
  for (const name of workbook.SheetNames) {
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name]!, {
      defval: '',
    });
    sheets[name] = raw.map(normalizeExcelRow);
  }

  // Um ficheiro corrompido pode ser lido como uma folha vazia: sem linhas em
  // nenhuma folha não há dados para cruzar.
  const hasAnyRows = Object.values(sheets).some((rows) => rows.length > 0);
  if (!hasAnyRows) throw new EmptyWorkbookError();

  return {
    name: input.fileName,
    sheets,
    selectedSheet: workbook.SheetNames[0]!,
  };
}
