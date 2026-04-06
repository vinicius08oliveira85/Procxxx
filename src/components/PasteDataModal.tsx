import React, { useEffect, useMemo, useDeferredValue, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  FileJson,
  Loader2,
  Table as TableIcon,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { normalizeExcelRow } from '../lib/excelRowNormalize';
import { downloadJsonFile } from '../lib/exportResult';
import { orderColumnsForLeagueTable, toLeagueTablePayload } from '../lib/leagueTableShape';
import {
  parsePastedTable,
  type PasteParseStatus,
  type PastePreviewState,
} from '../lib/pasteTableParser';
import type { ExcelData } from '../types/lookupTask';

const PREVIEW_MAX_ROWS = 20;

export type PasteDataModalProps = {
  open: boolean;
  onClose: () => void;
  tableLabel?: string;
  onAccept: (data: ExcelData) => void;
};

export function PasteDataModal({ open, onClose, tableLabel, onAccept }: PasteDataModalProps) {
  const [text, setText] = useState('');
  const [hasHeaders, setHasHeaders] = useState(true);
  /** Vazio = automático; número = colunas à esquerda sem categoria (cabeçalho em 2 linhas). */
  const [leadingUngroupedInput, setLeadingUngroupedInput] = useState('');
  const deferredText = useDeferredValue(text);
  const isProcessing = text !== deferredText;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setText('');
      setHasHeaders(true);
      setLeadingUngroupedInput('');
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => textareaRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [open]);

  const parseOptions = useMemo(() => {
    const t = leadingUngroupedInput.trim();
    if (t === '') return undefined;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return { leadingUngroupedColumns: n };
  }, [leadingUngroupedInput]);

  const preview: PastePreviewState = useMemo(
    () => parsePastedTable(deferredText, hasHeaders, parseOptions),
    [deferredText, hasHeaders, parseOptions]
  );

  const displayStatus: PasteParseStatus | 'processing' = isProcessing ? 'processing' : preview.status;
  const displayMessage = isProcessing ? 'A processar texto colado…' : preview.message;

  const previewRows = preview.rows;
  const columns = useMemo(() => {
    return previewRows && previewRows.length > 0 ? Object.keys(previewRows[0]) : [];
  }, [previewRows]);

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

  const handleLeagueTableJson = () => {
    if (!previewRows?.length || columns.length === 0) return;
    const { order, metricKey } = orderColumnsForLeagueTable(columns);
    const payload = toLeagueTablePayload(previewRows as Record<string, unknown>[], order, {
      title: 'League Table',
      metricColumnKey: metricKey,
    });
    if (!payload) return;
    downloadJsonFile(payload, 'league_table.json');
  };

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
            <h2
              id="paste-data-modal-title"
              className="flex items-center gap-2 truncate text-sm font-bold tracking-tight sm:text-base"
            >
              <Clipboard size={18} className="shrink-0 text-blue-500" aria-hidden />
              Colar dados
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
          <div
            className={cn(
              'flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-xs font-medium leading-snug',
              displayStatus === 'waiting' &&
                'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100',
              displayStatus === 'processing' &&
                'border-blue-500/25 bg-blue-500/10 text-blue-900 dark:text-blue-100',
              displayStatus === 'ready' &&
                'border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
              (displayStatus === 'no_data' || displayStatus === 'header_only') &&
                'border-orange-500/25 bg-orange-500/10 text-orange-900 dark:text-orange-100'
            )}
            role="status"
            aria-live="polite"
          >
            {displayStatus === 'processing' ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : displayStatus === 'ready' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            )}
            <span>{displayMessage}</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Cole os dados (Excel, Sheets, CSV ou logs)
              </span>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole aqui. A estruturação é instantânea no dispositivo — sem envio à rede."
                className={cn(
                  'min-h-[140px] resize-y rounded-2xl border border-white/20 bg-white/40 px-4 py-3 text-sm',
                  'text-zinc-900 placeholder:text-zinc-400 outline-none ring-0 transition-shadow',
                  'focus:border-blue-500/40 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]',
                  'dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100 dark:placeholder:text-zinc-500'
                )}
              />
            </label>

            <div className="flex flex-wrap items-center gap-4 py-1">
              <label className="group flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasHeaders}
                  onChange={(e) => setHasHeaders(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200">
                  Primeira linha é o cabeçalho
                </span>
              </label>
            </div>

            {hasHeaders ? (
              <details className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 dark:border-white/10 dark:bg-zinc-950/40">
                <summary className="cursor-pointer text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  Ajuste fino · duas linhas de cabeçalho (categorias)
                </summary>
                <p className="mt-2 text-[11px] leading-snug text-zinc-500 dark:text-zinc-500">
                  Se a primeira linha tiver menos colunas que a segunda (ex.: FBref), tentamos alinhar
                  automaticamente. Use o campo abaixo só se precisar forçar quantas colunas à esquerda não
                  pertencem a nenhuma categoria.
                </p>
                <label className="mt-2 flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    Colunas sem categoria à esquerda (vazio = automático)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={leadingUngroupedInput}
                    onChange={(e) => setLeadingUngroupedInput(e.target.value)}
                    placeholder="ex.: 4"
                    className="max-w-[120px] rounded-lg border border-white/20 bg-white/40 px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900/60"
                  />
                </label>
              </details>
            ) : null}
          </div>

          {previewRows && previewRows.length > 0 ? (
            <div className="flex min-h-0 flex-col gap-2">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <TableIcon className="h-3.5 w-3.5" aria-hidden />
                Pré-visualização ({Math.min(previewRows.length, PREVIEW_MAX_ROWS)} de {previewRows.length}{' '}
                linhas)
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
                      <tr key={i} className="border-b border-white/10 last:border-0 dark:border-white/5">
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="max-w-[200px] truncate px-3 py-1.5 text-zinc-700 dark:text-zinc-300"
                          >
                            {row[col] === null || row[col] === undefined ? '' : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleLeagueTableJson}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-bold text-violet-800 transition-colors hover:bg-violet-500/15 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/20"
                  title='JSON com firstColumnHeader, headers e rows { metric, values[] }'
                >
                  <FileJson size={18} className="shrink-0" aria-hidden />
                  League Table JSON
                </button>
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="rounded-2xl border border-white/20 bg-white/20 px-5 py-2.5 text-sm font-bold text-zinc-800 transition-colors hover:bg-white/30 dark:border-white/10 dark:bg-zinc-800/40 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isProcessing}
                  className="fluent-button fluent-button-primary rounded-2xl px-6 py-2.5 text-sm font-bold shadow-lg shadow-blue-500/20 disabled:pointer-events-none disabled:opacity-50"
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
