/**
 * Cliente do worker de parsing: valida o tamanho, lê o `File` e devolve `ExcelData`.
 */
import { isPlainTextUpload, validateUploadSize } from '../lib/uploadLimits';
import type { ExcelData } from '../types/lookupTask';
import type { ParseRequest, ParseResponse } from '../workers/parse.worker';
import type { WorkbookParseInput } from '../lib/workbookParser';

const PARSE_TIMEOUT_MS = 120_000;

export class WorkbookParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkbookParseError';
  }
}

/** O ambiente não conseguiu criar/usar o Worker — ainda dá para tentar na thread principal. */
class WorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerUnavailableError';
  }
}

function unreadableMessage(fileName: string): string {
  const ext = (fileName.split('.').pop() ?? '').toUpperCase();
  return `Não foi possível ler o arquivo "${fileName}"${ext ? ` (${ext})` : ''}. Verifique se o formato é suportado e se o arquivo não está corrompido.`;
}

function emptyWorkbookMessage(): string {
  return 'O arquivo não contém planilhas ou está vazio.';
}

function createParseWorker(): Worker {
  try {
    return new Worker(new URL('../workers/parse.worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch (error) {
    throw new WorkerUnavailableError(error instanceof Error ? error.message : String(error));
  }
}

function parseInWorker(input: WorkbookParseInput): Promise<ExcelData> {
  const worker = createParseWorker();

  return new Promise<ExcelData>((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new WorkbookParseError(`O arquivo "${input.fileName}" demorou demais para ser lido.`));
    }, PARSE_TIMEOUT_MS);

    /** Fecha o worker e limpa o timeout uma única vez por desfecho. */
    const finish = (action: () => void) => {
      clearTimeout(timer);
      action();
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      const message = event.data;
      if ('data' in message) {
        finish(() => resolve(message.data));
        return;
      }
      finish(() =>
        reject(
          new WorkbookParseError(
            message.errorCode === 'EMPTY_WORKBOOK' ? emptyWorkbookMessage() : unreadableMessage(input.fileName)
          )
        )
      );
    };

    worker.onerror = () => {
      finish(() => reject(new WorkbookParseError(unreadableMessage(input.fileName))));
    };

    try {
      const transfer: Transferable[] = input.buffer ? [input.buffer] : [];
      worker.postMessage({ id: 1, input } satisfies ParseRequest, transfer);
    } catch (error) {
      finish(() =>
        reject(new WorkerUnavailableError(error instanceof Error ? error.message : String(error)))
      );
    }
  });
}

/**
 * Fallback sem Worker (CSP restritiva, browser antigo). O import é dinâmico para
 * o `xlsx` não entrar no bundle inicial.
 */
async function parseOnMainThread(input: WorkbookParseInput): Promise<ExcelData> {
  if (input.buffer && input.buffer.byteLength === 0) {
    // O buffer foi transferido para um worker que falhou: já não está acessível.
    throw new WorkbookParseError(unreadableMessage(input.fileName));
  }

  const { parseWorkbook, EmptyWorkbookError } = await import('../lib/workbookParser');
  try {
    return parseWorkbook(input);
  } catch (error) {
    if (error instanceof EmptyWorkbookError) throw new WorkbookParseError(emptyWorkbookMessage());
    throw new WorkbookParseError(unreadableMessage(input.fileName));
  }
}

/**
 * Lê e interpreta um ficheiro de planilha.
 * Lança `WorkbookParseError` com mensagem pronta para o utilizador.
 */
export async function parseWorkbookFile(file: File): Promise<ExcelData> {
  const sizeError = validateUploadSize(file.size);
  if (sizeError) throw new WorkbookParseError(sizeError);

  const isText = isPlainTextUpload(file.name);
  const input: WorkbookParseInput = {
    fileName: file.name,
    text: isText ? await file.text() : null,
    buffer: isText ? null : await file.arrayBuffer(),
  };

  try {
    return await parseInWorker(input);
  } catch (error) {
    // Só falhas de ambiente caem para a thread principal; erros de leitura do
    // ficheiro (corrompido/vazio) mantêm a mensagem específica.
    if (!(error instanceof WorkerUnavailableError)) throw error;
    return parseOnMainThread(input);
  }
}
