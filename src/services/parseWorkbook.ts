/**
 * Cliente do worker de parsing: valida o tamanho, lê o `File` e devolve `ExcelData`.
 */
import { isPlainTextUpload, validateUploadSize } from '../lib/uploadLimits';
import type { ExcelData } from '../types/lookupTask';
import type { ParseRequest, ParseResponse } from '../workers/parse.worker';

export class WorkbookParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkbookParseError';
  }
}

function unreadableMessage(fileName: string): string {
  const ext = (fileName.split('.').pop() ?? '').toUpperCase();
  return `Não foi possível ler o arquivo "${fileName}"${ext ? ` (${ext})` : ''}. Verifique se o formato é suportado e se o arquivo não está corrompido.`;
}

/**
 * Lê e interpreta um ficheiro de planilha.
 * Lança `WorkbookParseError` com mensagem pronta para o utilizador.
 */
export async function parseWorkbookFile(file: File): Promise<ExcelData> {
  const sizeError = validateUploadSize(file.size);
  if (sizeError) throw new WorkbookParseError(sizeError);

  const isText = isPlainTextUpload(file.name);
  const text = isText ? await file.text() : null;
  const buffer = isText ? null : await file.arrayBuffer();

  const worker = new Worker(new URL('../workers/parse.worker.ts', import.meta.url), {
    type: 'module',
  });

  try {
    return await new Promise<ExcelData>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<ParseResponse>) => {
        const message = event.data;
        if ('data' in message) {
          resolve(message.data);
          return;
        }
        reject(
          new WorkbookParseError(
            message.errorCode === 'EMPTY_WORKBOOK'
              ? 'O arquivo não contém planilhas ou está vazio.'
              : unreadableMessage(file.name)
          )
        );
      };
      worker.onerror = () => reject(new WorkbookParseError(unreadableMessage(file.name)));

      const request: ParseRequest = { id: 1, input: { fileName: file.name, text, buffer } };
      // Transfere o buffer para o worker (evita uma cópia de até 50 MB).
      worker.postMessage(request, buffer ? [buffer] : []);
    });
  } finally {
    worker.terminate();
  }
}
