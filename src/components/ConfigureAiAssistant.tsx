import React, { useState } from 'react';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  fetchSuggestConfig,
  buildSampleRowsForAi,
  AiSuggestError,
  type SuggestConfigApiResponse,
} from '../services/aiSuggest';

/** Subconjunto dos dados de planilha usado apenas para amostragem. */
type WorkbookSlice = {
  sheets: { [sheetName: string]: Record<string, unknown>[] };
  selectedSheet: string;
};

type ApplyPatch = {
  keyA?: string;
  keyB?: string;
  selectedColsA?: string[];
  selectedColsB?: string[];
  keyA_C?: string;
  keyC?: string;
  selectedColsC?: string[];
};

interface ConfigureAiAssistantProps {
  fileA: WorkbookSlice | null;
  fileB: WorkbookSlice | null;
  fileC: WorkbookSlice | null;
  headersA: string[];
  headersB: string[];
  headersC: string[];
  onApply: (patch: ApplyPatch) => void;
}

export function ConfigureAiAssistant({
  fileA,
  fileB,
  fileC,
  headersA,
  headersB,
  headersC,
  onApply,
}: ConfigureAiAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SuggestConfigApiResponse | null>(null);

  const canRun = Boolean(fileA && fileB && headersA.length && headersB.length);

  const handleRequest = async () => {
    if (!canRun || !fileA || !fileB) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const sheetA = fileA.sheets[fileA.selectedSheet] ?? [];
      const sheetB = fileB.sheets[fileB.selectedSheet] ?? [];
      const sheetC = fileC ? (fileC.sheets[fileC.selectedSheet] ?? []) : [];

      const payload = {
        headersA,
        headersB,
        ...(headersC.length > 0 ? { headersC } : {}),
        sampleRowsA: buildSampleRowsForAi(sheetA),
        sampleRowsB: buildSampleRowsForAi(sheetB),
        ...(headersC.length > 0 && sheetC.length > 0
          ? { sampleRowsC: buildSampleRowsForAi(sheetC) }
          : {}),
      };

      const result = await fetchSuggestConfig(payload);
      setPreview(result);
    } catch (e) {
      const msg =
        e instanceof AiSuggestError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Falha ao obter sugestão.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmApply = () => {
    if (!preview?.suggestion) return;
    const s = preview.suggestion;
    const patch: ApplyPatch = {};
    if (s.keyA) patch.keyA = s.keyA;
    if (s.keyB) patch.keyB = s.keyB;
    if (s.selectedColsA?.length) patch.selectedColsA = s.selectedColsA;
    if (s.selectedColsB?.length) patch.selectedColsB = s.selectedColsB;
    if (s.keyA_C) patch.keyA_C = s.keyA_C;
    if (s.keyC) patch.keyC = s.keyC;
    if (s.selectedColsC?.length) patch.selectedColsC = s.selectedColsC;
    onApply(patch);
    setPreview(null);
  };

  return (
    <div className="fluent-card p-4 border border-violet-500/20 dark:border-violet-400/15 bg-violet-500/[0.04] dark:bg-violet-500/[0.06]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-500 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Assistente IA (Gemini)</h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">
              Analisa cabeçalhos e uma amostra das linhas e sugere chaves e colunas de retorno. A chave da API fica
              apenas no servidor.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRequest}
          disabled={!canRun || loading}
          className={cn(
            'shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border',
            canRun && !loading
              ? 'bg-violet-600 text-white border-violet-500 hover:bg-violet-500 shadow-lg shadow-violet-500/20'
              : 'opacity-50 cursor-not-allowed border-zinc-200 dark:border-zinc-700 text-zinc-500'
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Consultando…' : 'Sugerir com IA'}
        </button>
      </div>

      {!canRun && (
        <p className="text-[10px] text-zinc-500 mt-3 font-medium">Carregue as tabelas A e B para habilitar a sugestão.</p>
      )}

      {error && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400 font-medium rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-3 border-t border-zinc-200/50 dark:border-white/10 pt-4">
          {preview.notes && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{preview.notes}</p>
          )}
          <pre className="text-[10px] font-mono p-3 rounded-xl bg-black/5 dark:bg-white/5 border dark:border-white/10 border-black/10 overflow-x-auto max-h-40 text-zinc-700 dark:text-zinc-300">
            {JSON.stringify(preview.suggestion, null, 2)}
          </pre>
          {preview.warnings.length > 0 && (
            <ul className="text-[10px] text-amber-700 dark:text-amber-400/90 space-y-1 list-disc pl-4">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirmApply}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Aplicar sugestão
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 text-xs font-bold text-zinc-600 dark:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
