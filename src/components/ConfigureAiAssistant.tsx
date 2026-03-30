import React, { useMemo, useState } from 'react';
import { Sparkles, Loader2, Check, X, Wand2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { computeAutoDetectLookup } from '../lib/autoDetectLookupConfig';
import { buildAiSuggestContext } from '../lib/buildAiSuggestContext';
import {
  fetchSuggestConfig,
  buildSampleRowsForAi,
  AiSuggestError,
  MAX_USER_INTENT_LEN,
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
  /** Layout compacto alinhado ao painel lateral da etapa Configurar. */
  variant?: 'default' | 'bento';
}

function formatKeyPair(keyA: string, keyB: string): string {
  if (!keyA && !keyB) return '—';
  return `${keyA || '—'} ↔ ${keyB || '—'}`;
}

export function ConfigureAiAssistant({
  fileA,
  fileB,
  fileC,
  headersA,
  headersB,
  headersC,
  onApply,
  variant = 'default',
}: ConfigureAiAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SuggestConfigApiResponse | null>(null);
  const [userIntent, setUserIntent] = useState('');

  const canRun = Boolean(fileA && fileB && headersA.length && headersB.length);

  const autoSuggestion = useMemo(
    () => (headersA.length && headersB.length ? computeAutoDetectLookup(headersA, headersB) : null),
    [headersA, headersB]
  );

  const handleRequest = async () => {
    if (!canRun || !fileA || !fileB) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const sheetA = fileA.sheets[fileA.selectedSheet] ?? [];
      const sheetB = fileB.sheets[fileB.selectedSheet] ?? [];
      const sheetC = fileC ? (fileC.sheets[fileC.selectedSheet] ?? []) : [];

      const intent = userIntent.trim().slice(0, MAX_USER_INTENT_LEN);

      const payload = {
        headersA,
        headersB,
        ...(headersC.length > 0 ? { headersC } : {}),
        sampleRowsA: buildSampleRowsForAi(sheetA),
        sampleRowsB: buildSampleRowsForAi(sheetB),
        ...(headersC.length > 0 && sheetC.length > 0
          ? { sampleRowsC: buildSampleRowsForAi(sheetC) }
          : {}),
        ...(intent ? { userIntent: intent } : {}),
        context: buildAiSuggestContext(sheetA, sheetB, headersA, headersB),
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

  const handleApplyAutoOnly = () => {
    if (!autoSuggestion) return;
    const patch: ApplyPatch = {};
    if (autoSuggestion.keyA) patch.keyA = autoSuggestion.keyA;
    if (autoSuggestion.keyB) patch.keyB = autoSuggestion.keyB;
    if (autoSuggestion.selectedColsB.length) patch.selectedColsB = autoSuggestion.selectedColsB;
    onApply(patch);
    setPreview(null);
  };

  const ia = preview?.suggestion;

  const isBento = variant === 'bento';

  return (
    <div
      className={cn(
        isBento
          ? 'rounded-xl border border-[#434655]/15 p-5 backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.35)]'
          : 'fluent-card p-4 border border-violet-500/20 dark:border-violet-400/15 bg-violet-500/[0.04] dark:bg-violet-500/[0.06]'
      )}
      style={
        isBento
          ? {
              background: 'rgba(28, 27, 27, 0.72)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }
          : undefined
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-500 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Assistente IA (Gemini)</h3>
            <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">
              Útil quando os <strong className="text-zinc-600 dark:text-zinc-400">nomes das colunas diferem</strong>, há{' '}
              <strong className="text-zinc-600 dark:text-zinc-400">muitas colunas</strong> ou o botão{' '}
              <strong className="text-zinc-600 dark:text-zinc-400">Configuração Automática</strong> não acerta. A chave da
              API fica só no servidor. Enviamos estatísticas leves e uma amostra de linhas.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRequest}
          disabled={!canRun || loading}
          className={cn(
            'shrink-0 flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold transition-all border w-full sm:w-auto',
            canRun && !loading
              ? 'bg-violet-600 text-white border-violet-500 hover:bg-violet-500 shadow-lg shadow-violet-500/20'
              : 'opacity-50 cursor-not-allowed border-zinc-200 dark:border-zinc-700 text-zinc-500'
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Consultando…' : 'Sugerir com IA'}
        </button>
      </div>

      {canRun && (
        <div className="mt-3 space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-0.5">
            O que queres cruzar? (opcional)
          </label>
          <textarea
            value={userIntent}
            onChange={(e) => setUserIntent(e.target.value.slice(0, MAX_USER_INTENT_LEN))}
            placeholder="Ex.: cruzar alunos pela matrícula; trazer notas e turma da planilha B…"
            rows={2}
            className="w-full text-xs rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-200 px-3 py-2 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <p className="text-xs text-zinc-500">{userIntent.length}/{MAX_USER_INTENT_LEN}</p>
        </div>
      )}

      {!canRun && (
        <p className="text-xs text-zinc-500 mt-3 font-medium">Carregue as tabelas A e B para habilitar a sugestão.</p>
      )}

      {error && (
        <div className="mt-3 text-xs text-red-600 dark:text-red-400 font-medium rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-3 border-t border-zinc-200/50 dark:border-white/10 pt-4">
          {autoSuggestion && ia && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Automático (local) vs IA</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-zinc-200/80 dark:border-white/10 px-2 py-2 bg-black/[0.02] dark:bg-white/[0.03]">
                  <span className="font-bold text-zinc-500 block mb-1">Chaves</span>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {formatKeyPair(autoSuggestion.keyA, autoSuggestion.keyB)}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-zinc-600 dark:text-zinc-400',
                      (autoSuggestion.keyA !== ia.keyA || autoSuggestion.keyB !== ia.keyB) &&
                        'text-amber-700 dark:text-amber-400 font-semibold'
                    )}
                  >
                    IA: {formatKeyPair(ia.keyA ?? '', ia.keyB ?? '')}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200/80 dark:border-white/10 px-2 py-2 bg-black/[0.02] dark:bg-white/[0.03]">
                  <span className="font-bold text-zinc-500 block mb-1">Colunas B sugeridas</span>
                  <p className="text-zinc-700 dark:text-zinc-300">{autoSuggestion.selectedColsB.length} (automático)</p>
                  <p
                    className={cn(
                      'mt-1 text-zinc-600 dark:text-zinc-400',
                      autoSuggestion.selectedColsB.length !== (ia.selectedColsB?.length ?? 0) &&
                        'text-amber-700 dark:text-amber-400 font-semibold'
                    )}
                  >
                    {ia.selectedColsB?.length ?? 0} (IA)
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200/80 dark:border-white/10 px-2 py-2 bg-black/[0.02] dark:bg-white/[0.03] sm:col-span-1">
                  <span className="font-bold text-zinc-500 block mb-1">Tabela C</span>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    IA: {ia.keyA_C || ia.keyC ? `${ia.keyA_C ?? '—'} / ${ia.keyC ?? '—'}` : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {preview.notes && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{preview.notes}</p>
          )}
          <pre className="text-[10px] font-mono p-3 rounded-xl bg-black/5 dark:bg-white/5 border dark:border-white/10 border-black/10 overflow-x-auto max-h-40 text-zinc-700 dark:text-zinc-300">
            {JSON.stringify(preview.suggestion, null, 2)}
          </pre>
          {preview.warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400/90 space-y-1 list-disc pl-4">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirmApply}
              className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Aplicar sugestão da IA
            </button>
            {autoSuggestion && (autoSuggestion.keyA || autoSuggestion.selectedColsB.length > 0) && (
              <button
                type="button"
                onClick={handleApplyAutoOnly}
                className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Aplicar configuração automática (local)
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 text-sm font-bold text-zinc-600 dark:text-zinc-300"
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
