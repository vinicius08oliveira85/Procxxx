/// <reference lib="webworker" />
import { applyLookup, type LookupPayload, type LookupWorkerMessage } from '../lib/lookupEngine';

declare const self: DedicatedWorkerGlobalScope;

// Erro global (ex.: falha ao importar módulo dentro do worker) — avisa o cliente
// em vez de falhar silenciosamente.
self.addEventListener('error', (event: ErrorEvent) => {
  self.postMessage({ error: `Erro interno do worker: ${event.message}` } satisfies LookupWorkerMessage);
});

self.onmessage = (event: MessageEvent<LookupPayload>) => {
  let message: LookupWorkerMessage;
  try {
    message = applyLookup(event.data);
  } catch (err) {
    message = { error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(message);
};
