/// <reference lib="webworker" />
/**
 * Worker de parsing: lê o ficheiro e devolve as folhas prontas.
 * Mantém `XLSX.read`/`sheet_to_json` fora da thread principal (ficheiros grandes
 * deixavam de responder ao clique).
 */
import { parseWorkbook, EmptyWorkbookError, type WorkbookParseInput } from '../lib/workbookParser';
import type { ExcelData } from '../types/lookupTask';

export type ParseRequest = {
  id: number;
  input: WorkbookParseInput;
};

export type ParseResponse =
  | { id: number; data: ExcelData }
  | { id: number; errorCode: 'EMPTY_WORKBOOK' | 'UNREADABLE' };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { id, input } = event.data;
  try {
    ctx.postMessage({ id, data: parseWorkbook(input) } satisfies ParseResponse);
  } catch (err) {
    const errorCode: 'EMPTY_WORKBOOK' | 'UNREADABLE' =
      err instanceof EmptyWorkbookError ? 'EMPTY_WORKBOOK' : 'UNREADABLE';
    ctx.postMessage({ id, errorCode } satisfies ParseResponse);
  }
};
