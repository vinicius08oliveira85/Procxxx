/// <reference lib="webworker" />
import { applyLookup, type LookupPayload, type LookupWorkerMessage } from '../lib/lookupEngine';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<LookupPayload>) => {
  let message: LookupWorkerMessage;
  try {
    message = applyLookup(event.data);
  } catch (err) {
    message = { error: err instanceof Error ? err.message : String(err) };
  }
  ctx.postMessage(message);
};
