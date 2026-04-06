import React, { useCallback, useEffect, useState } from 'react';
import { Clipboard, Sparkles, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { normalizeExcelRow } from '../lib/excelRowNormalize';
import { fetchStructurize, StructurizeApiError } from '../services/structurizeApi';
import type { ExcelData } from '../types/lookupTask';

const PREVIEW_MAX_ROWS = 20;

export type PasteDataModalProps = {
  open: boolean;
  onClose: () => void;
  /** Rótulo opcional (ex.: qual tabela está a receber os dados). */
  tableLabel?: string;
  onAccept: (data: ExcelData) => void;
};

export function PasteDataModal({ open, onClose, tableLabel, onAccept }: PasteDataModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    if (!open) {
      setText('');
      setError(null);
      setPreviewRows(null);
      setLoading(false);
    }
  }, [open]);

  const handleStructurize = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setPreviewRows(null);
    try {
      const { rows } = await fetchStructurize(trimmed);
      if (!rows.length) {
        setError('O modelo não devolveu nenhuma linha. Reformule o texto ou tente de novo.');
        return;
      }
      setPreviewRows(rows);
    } catch (e) {
      const msg = e instanceof StructurizeApiError ? e.message : 'Não foi possível estruturar o texto.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [text]);

  const handleAccept = () => {
    if (!previewRows?.length) return;
    const rows = previewRows.map((r) => normalizeExcelRow(r as Record<string, unknown>));
    const data: ExcelData = {
      name: 'Dados Colados',
      sheets: { Dados: rows },
      selectedSheet: 'Dados',
    };
    onAccept(data);
    onClose();
  };

  const columns =
    previewRows && previewRows.length > 0 ? Object.keys(previewRows[0] as Record<string, unknown>) : [];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm font-jakarta"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-data-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          'windows-window w-full max-w-3xl max-h-[92vh] flex flex-col',
          'text-zinc-900 dark:text-zinc-100'
        )}
      >
        <header className="windows-titlebar shrink-0 rounded-t-[32px]">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="paste-data-modal-title" className="truncate text-sm font-bold tracking-tight sm:text-base">
              Colar e estruturar com IA
            </h2>
            {tableLabel ? (
              <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{tableLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="titlebar-button titlebar-button-close shrink-0 rounded-xl text-zinc-500 dark:text-zinc-400"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          <label className="flex min-h-0 flex-1 flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Texto bruto
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui logs, extratos, tabelas copiadas de PDF ou chat…"
              disabled={loading}
              className={cn(
                'min-h-[160px] flex-1 resize-y rounded-2xl border border-white/20 bg-white/40 px-4 py-3 text-sm',
                'text-zinc-900 placeholder:text-zinc-400 outline-none ring-0 transition-shadow',
                'focus:border-blue-500/40 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]',
                'dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100 dark:placeholder:text-zinc-500',
                'disabled:opacity-60'
              )}
            />
          </label>

          {error ? (
            <p
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleStructurize}
              disabled={loading || !text.trim()}
              className={cn(
                'fluent-button fluent-button-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold',
                'shadow-sm disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <Clipboard className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Estruturar com IA
            </button>
          </div>

          {previewRows && previewRows.length > 0 ? (
            <div className="flex min-h-0 flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Pré-visualização ({Math.min(previewRows.length, PREVIEW_MAX_ROWS)} de {previewRows.length} linhas)
              </p>
              <div
                className={cn(
                  'max-h-[240px] overflow-auto rounded-2xl border border-white/20 dark:border-white/10',
                  'bg-white/30 dark:bg-zinc-950/50'
                )}
              >
                <table className="w-full min-w-max border-collapse text-left text-xs">
                  <thead>
                    <tr className="sticky top-0 z-[1] border-b border-white/20 bg-white/80 dark:border-white/10 dark:bg-zinc-900/95">
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="whitespace-nowrap px-3 py-2 font-bold text-zinc-800 dark:text-zinc-100"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, PREVIEW_MAX_ROWS).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-white/10 last:border-0 dark:border-white/5"
                      >
                        {columns.map((col) => (
                          <td key={col} className="max-w-[200px] truncate px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                            {row[col] === null || row[col] === undefined ? '' : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/20 bg-white/20 px-5 py-2.5 text-sm font-bold text-zinc-800 transition-colors hover:bg-white/30 dark:border-white/10 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  className="fluent-button fluent-button-primary rounded-2xl px-5 py-2.5 text-sm font-bold"
                >
                  Aceitar tabela
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
