import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Search,
  Filter,
  Columns2,
  List,
  Sigma,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Copy,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  type PivotAgg,
  type PivotLayout,
  computePivot,
  flattenPivotRows,
  formatPivotMeasureValue,
  getPivotableFields,
} from '../lib/pivotEngine';
import {
  buildPivotTableHtml,
  buildPivotTableTsv,
  copyPivotTableTsvAndHtml,
} from '../lib/pivotClipboard';

export interface PivotTableModalProps {
  open: boolean;
  onClose: () => void;
  /** Linhas já filtradas (mesma base da grade de resultados). */
  rows: Record<string, unknown>[];
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyLayout(): PivotLayout {
  return {
    filterFields: [],
    filterSelections: {},
    columnFields: [],
    rowFields: [],
    measures: [],
  };
}

function cloneLayout(l: PivotLayout): PivotLayout {
  return {
    ...l,
    filterSelections: Object.fromEntries(
      Object.entries(l.filterSelections).map(([k, v]) => [k, new Set(v)])
    ),
    measures: l.measures.map((m) => ({ ...m })),
  };
}

function removeFromExclusive(layout: PivotLayout, field: string): PivotLayout {
  return {
    ...layout,
    filterFields: layout.filterFields.filter((f) => f !== field),
    columnFields: layout.columnFields.filter((f) => f !== field),
    rowFields: layout.rowFields.filter((f) => f !== field),
  };
}

function fieldInExclusive(layout: PivotLayout, field: string): boolean {
  return (
    layout.filterFields.includes(field) ||
    layout.columnFields.includes(field) ||
    layout.rowFields.includes(field)
  );
}

function fieldUsed(layout: PivotLayout, field: string): boolean {
  return fieldInExclusive(layout, field) || layout.measures.some((m) => m.field === field);
}

const DND_TYPE = 'application/x-procx-pivot';

type DropZone = 'filters' | 'columns' | 'rows' | 'values';

function parseDragPayload(e: React.DragEvent): { field: string; measureId?: string } | null {
  try {
    const raw = e.dataTransfer.getData(DND_TYPE);
    if (!raw) return null;
    return JSON.parse(raw) as { field: string; measureId?: string };
  } catch {
    return null;
  }
}

function defaultExpandedPaths(root: import('../lib/pivotEngine').PivotTreeNode): Set<string> {
  const s = new Set<string>();
  function walk(n: import('../lib/pivotEngine').PivotTreeNode) {
    if (n.children.length > 0) s.add(n.path);
    for (const c of n.children) walk(c);
  }
  for (const c of root.children) walk(c);
  return s;
}

export function PivotTableModal({ open, onClose, rows }: PivotTableModalProps) {
  const [draft, setDraft] = useState<PivotLayout>(emptyLayout);
  const [committed, setCommitted] = useState<PivotLayout>(emptyLayout);
  const [deferUpdate, setDeferUpdate] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [openFilterField, setOpenFilterField] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const fields = useMemo(() => getPivotableFields(rows[0]), [rows]);

  const effectiveLayout = deferUpdate ? committed : draft;

  const layoutRef = useRef(effectiveLayout);
  layoutRef.current = effectiveLayout;

  const pivotResult = useMemo(
    () => computePivot(rows, effectiveLayout),
    [rows, effectiveLayout]
  );

  useEffect(() => {
    if (!open) return;
    const pr = computePivot(rows, layoutRef.current);
    setExpandedPaths(defaultExpandedPaths(pr.root));
  }, [open, rows.length, rows]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!deferUpdate) {
      setCommitted(cloneLayout(draft));
    }
  }, [draft, deferUpdate]);

  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) => f.toLowerCase().includes(q));
  }, [fields, fieldSearch]);

  const applyCommitted = useCallback(
    (layout: PivotLayout) => {
      const next = cloneLayout(layout);
      setCommitted(next);
      setDraft(next);
      const pr = computePivot(rows, next);
      setExpandedPaths(defaultExpandedPaths(pr.root));
    },
    [rows]
  );

  const syncDraftToCommitted = useCallback(() => {
    const next = cloneLayout(draft);
    setCommitted(next);
    setDraft(next);
    const pr = computePivot(rows, next);
    setExpandedPaths(defaultExpandedPaths(pr.root));
  }, [draft, rows]);

  useEffect(() => {
    if (!open) {
      setDraft(emptyLayout());
      setCommitted(emptyLayout());
      setDeferUpdate(false);
      setFieldSearch('');
      setOpenFilterField(null);
      setCopyStatus('idle');
    }
  }, [open]);

  const handleDrop = useCallback(
    (zone: DropZone, e: React.DragEvent) => {
      e.preventDefault();
      const p = parseDragPayload(e);
      if (!p) return;
      const { field, measureId } = p;

      setDraft((prev) => {
        let next = { ...prev, measures: [...prev.measures] };

        if (measureId) {
          next.measures = next.measures.filter((m) => m.id !== measureId);
        } else {
          next = removeFromExclusive(next, field);
        }

        if (zone === 'values') {
          next.measures.push({ id: newId(), field, agg: 'count' });
          return next;
        }

        next = removeFromExclusive(next, field);
        if (zone === 'filters') {
          next.filterFields = next.filterFields.includes(field)
            ? next.filterFields
            : [...next.filterFields, field];
        } else if (zone === 'columns') {
          next.columnFields = next.columnFields.includes(field)
            ? next.columnFields
            : [...next.columnFields, field];
        } else {
          next.rowFields = next.rowFields.includes(field) ? next.rowFields : [...next.rowFields, field];
        }
        return next;
      });

    },
    []
  );

  const removeChip = (zone: DropZone, field: string, measureId?: string) => {
    if (zone === 'filters') {
      setOpenFilterField((of) => (of === field ? null : of));
    }
    setDraft((prev) => {
      if (zone === 'values' && measureId) {
        return { ...prev, measures: prev.measures.filter((m) => m.id !== measureId) };
      }
      if (zone === 'filters') {
        const filterSelections = { ...prev.filterSelections };
        delete filterSelections[field];
        return {
          ...prev,
          filterFields: prev.filterFields.filter((f) => f !== field),
          filterSelections,
        };
      }
      if (zone === 'columns') {
        return { ...prev, columnFields: prev.columnFields.filter((f) => f !== field) };
      }
      if (zone === 'rows') {
        return { ...prev, rowFields: prev.rowFields.filter((f) => f !== field) };
      }
      return prev;
    });
  };

  const setMeasureAgg = (id: string, agg: PivotAgg) => {
    setDraft((prev) => ({
      ...prev,
      measures: prev.measures.map((m) => (m.id === id ? { ...m, agg } : m)),
    }));
  };

  const setMeasureShowAs = (id: string, mode: 'value' | 'percentOfTotal') => {
    setDraft((prev) => ({
      ...prev,
      measures: prev.measures.map((m) =>
        m.id === id ? { ...m, showAs: mode === 'percentOfTotal' ? 'percentOfTotal' : undefined } : m
      ),
    }));
  };

  const toggleCheckbox = (field: string, checked: boolean) => {
    setDraft((prev) => {
      if (!checked) {
        const filterSelections = { ...prev.filterSelections };
        delete filterSelections[field];
        return {
          ...prev,
          filterFields: prev.filterFields.filter((f) => f !== field),
          columnFields: prev.columnFields.filter((f) => f !== field),
          rowFields: prev.rowFields.filter((f) => f !== field),
          measures: prev.measures.filter((m) => m.field !== field),
          filterSelections,
        };
      }
      let next = removeFromExclusive(prev, field);
      next = { ...next, rowFields: [...next.rowFields, field] };
      return next;
    });
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });
  };

  const uniqueValuesForField = useCallback(
    (field: string): string[] => {
      const set = new Set<string>();
      for (const r of rows) {
        const v = r[field];
        set.add(v === null || v === undefined || v === '' ? '(vazio)' : String(v));
      }
      return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    },
    [rows]
  );

  const toggleFilterValue = (field: string, value: string) => {
    setDraft((prev) => {
      const cur = prev.filterSelections[field] ? new Set(prev.filterSelections[field]) : new Set<string>();
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      const filterSelections = { ...prev.filterSelections };
      if (cur.size === 0) delete filterSelections[field];
      else filterSelections[field] = cur;
      return { ...prev, filterSelections };
    });
  };

  const clearFilterSelection = (field: string) => {
    setDraft((prev) => {
      const filterSelections = { ...prev.filterSelections };
      delete filterSelections[field];
      return { ...prev, filterSelections };
    });
  };

  const flatRows = useMemo(
    () => flattenPivotRows(pivotResult.root, expandedPaths, true),
    [pivotResult.root, expandedPaths]
  );

  const copyPivotTable = useCallback(async () => {
    if (pivotResult.error || pivotResult.dataHeaders.length === 0) return;
    const formatCell = (val: number, colIndex: number) => {
      const mi = pivotResult.dataHeaders[colIndex]?.measureIndex ?? 0;
      const meas = effectiveLayout.measures[mi];
      const agg = meas?.agg ?? 'count';
      return formatPivotMeasureValue(val, agg, meas?.showAs);
    };
    try {
      const tsv = buildPivotTableTsv(
        pivotResult.dataHeaders,
        flatRows,
        pivotResult.grandTotal,
        formatCell
      );
      const html = buildPivotTableHtml(
        pivotResult.dataHeaders,
        flatRows,
        pivotResult.grandTotal,
        formatCell
      );
      await copyPivotTableTsvAndHtml(tsv, html);
      setCopyStatus('ok');
      window.setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
      window.setTimeout(() => setCopyStatus('idle'), 3500);
    }
  }, [
    pivotResult.error,
    pivotResult.dataHeaders,
    pivotResult.grandTotal,
    flatRows,
    effectiveLayout.measures,
  ]);

  if (!open) return null;

  const zoneClass =
    'min-h-[72px] rounded-xl border-2 border-dashed border-zinc-600/80 bg-zinc-900/40 p-2 flex flex-col gap-1 transition-colors';

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pivot-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/55 text-zinc-100 shadow-2xl backdrop-blur-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 backdrop-blur-xl">
          <h2 id="pivot-modal-title" className="text-base font-bold tracking-tight">
            Campos da Tabela Dinâmica
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex max-h-[40vh] min-h-0 shrink-0 flex-col border-b border-white/10 lg:max-h-none lg:w-[280px] lg:border-b-0 lg:border-r">
            <p className="text-xs text-zinc-400 px-3 pt-3 pb-1 font-medium">
              Escolha os campos para adicionar ao relatório:
            </p>
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="search"
                  placeholder="Pesquisar"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-600 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
                />
              </div>
            </div>
            <ul className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3 space-y-0.5">
              {filteredFields.map((f) => (
                <li key={f}>
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={fieldUsed(draft, f)}
                      onChange={(e) => toggleCheckbox(f, e.target.checked)}
                      className="rounded border-zinc-500"
                    />
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DND_TYPE, JSON.stringify({ field: f }));
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      className="truncate flex-1 flex items-center gap-1"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" aria-hidden />
                      {f}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
            <p className="text-xs text-zinc-400 px-4 pt-3 font-medium">
              Arraste os campos entre as áreas abaixo:
            </p>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DropZoneBox
                title="Filtros"
                icon={Filter}
                className={zoneClass}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop('filters', e)}
              >
                {draft.filterFields.map((f) => (
                  <div key={f}>
                    <FieldChip
                      label={f}
                      draggablePayload={{ field: f }}
                      onRemove={() => removeChip('filters', f)}
                      onClickFilter={() => setOpenFilterField((v) => (v === f ? null : f))}
                      showFilterHint
                      activeFilter={draft.filterSelections[f] && draft.filterSelections[f]!.size > 0}
                    />
                  </div>
                ))}
              </DropZoneBox>
              <DropZoneBox
                title="Colunas"
                icon={Columns2}
                className={zoneClass}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop('columns', e)}
              >
                {draft.columnFields.map((f) => (
                  <div key={f}>
                    <FieldChip
                      label={f}
                      draggablePayload={{ field: f }}
                      onRemove={() => removeChip('columns', f)}
                    />
                  </div>
                ))}
              </DropZoneBox>
              <DropZoneBox
                title="Linhas"
                icon={List}
                className={zoneClass}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop('rows', e)}
              >
                {draft.rowFields.map((f) => (
                  <div key={f}>
                    <FieldChip
                      label={f}
                      draggablePayload={{ field: f }}
                      onRemove={() => removeChip('rows', f)}
                    />
                  </div>
                ))}
              </DropZoneBox>
              <DropZoneBox
                title="Valores"
                icon={Sigma}
                className={zoneClass}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop('values', e)}
              >
                {draft.measures.map((m) => (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_TYPE, JSON.stringify({ field: m.field, measureId: m.id }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className={cn(
                      'flex items-center gap-1 flex-wrap rounded-lg border border-zinc-600/90 bg-zinc-800/80 px-2 py-1 text-xs backdrop-blur-sm'
                    )}
                  >
                    <GripVertical className="w-3 h-3 text-zinc-500 shrink-0" aria-hidden />
                    <select
                      value={m.agg}
                      onChange={(e) => setMeasureAgg(m.id, e.target.value as PivotAgg)}
                      className="rounded border border-zinc-600/80 bg-zinc-900/90 px-1 py-0.5 text-zinc-200 max-w-[140px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="count">Contagem</option>
                      <option value="sum">Soma</option>
                      <option value="avg">Média</option>
                      <option value="min">Mínimo</option>
                      <option value="max">Máximo</option>
                    </select>
                    <select
                      value={m.showAs === 'percentOfTotal' ? 'percentOfTotal' : 'value'}
                      onChange={(e) =>
                        setMeasureShowAs(m.id, e.target.value as 'value' | 'percentOfTotal')
                      }
                      className="rounded border border-zinc-600/80 bg-zinc-900/90 px-1 py-0.5 text-zinc-200 max-w-[118px]"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Exibir medida como"
                      title="Valor ou percentual do total"
                    >
                      <option value="value">Valor</option>
                      <option value="percentOfTotal">% do total</option>
                    </select>
                    <span className="truncate max-w-[120px]" title={m.field}>
                      {m.field}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeChip('values', m.field, m.id)}
                      className="ml-auto text-zinc-500 hover:text-red-400 p-0.5"
                      aria-label="Remover"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </DropZoneBox>
            </div>

            {openFilterField && draft.filterFields.includes(openFilterField) && (
              <div className="mx-4 mb-3 p-3 rounded-xl border border-zinc-600 bg-zinc-900/80">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-zinc-300">Valores de: {openFilterField}</span>
                  <button
                    type="button"
                    className="text-xs text-emerald-400 hover:underline"
                    onClick={() => clearFilterSelection(openFilterField)}
                  >
                    Limpar filtro (todos)
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mb-2">
                  Nenhuma seleção = mostrar todos. Marque valores para restringir.
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                  {uniqueValuesForField(openFilterField).map((v) => {
                    const sel = draft.filterSelections[openFilterField];
                    const active = sel && sel.size > 0;
                    const checked = active ? sel!.has(v) : false;
                    return (
                      <label key={v} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFilterValue(openFilterField, v)}
                        />
                        <span className="truncate">{v}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-zinc-700 bg-zinc-900/50">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={deferUpdate}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setDeferUpdate(v);
                    if (!v) syncDraftToCommitted();
                  }}
                />
                Adiar atualização do layout
              </label>
              <button
                type="button"
                onClick={() => {
                  applyCommitted(draft);
                  setDeferUpdate(false);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-colors"
              >
                Atualizar
              </button>
            </div>

            <div className="px-4 pb-4 flex-1 min-h-[200px]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Pré-visualização
                </h3>
                {!pivotResult.error && pivotResult.dataHeaders.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    {copyStatus === 'ok' && (
                      <span className="text-xs font-bold text-emerald-400">Copiado (TSV + HTML)</span>
                    )}
                    {copyStatus === 'error' && (
                      <span className="text-xs font-bold text-red-400">Não foi possível copiar</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyPivotTable()}
                      className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 transition-colors"
                    >
                      <Copy size={14} aria-hidden />
                      Copiar tabela
                    </button>
                  </div>
                )}
              </div>
              {pivotResult.error ? (
                <p className="text-sm text-amber-400">{pivotResult.error}</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-700">
                  <table className="w-full text-sm border-collapse min-w-[320px]">
                    <thead>
                      <tr className="bg-emerald-800 text-white">
                        <th className="text-left px-3 py-2 font-bold border-b border-emerald-900 whitespace-nowrap">
                          Rótulos de Linha
                        </th>
                        {pivotResult.dataHeaders.map((h, i) => (
                          <th
                            key={i}
                            className="text-right px-3 py-2 font-bold border-b border-emerald-900 whitespace-nowrap"
                          >
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {flatRows.map((node) => {
                        const hasKids = node.children.length > 0;
                        const expanded = expandedPaths.has(node.path);
                        return (
                          <tr
                            key={node.path}
                            className={cn(
                              'border-b border-zinc-700/80',
                              node.depth === 0 && hasKids ? 'bg-emerald-900/25' : 'bg-zinc-900/40'
                            )}
                          >
                            <td
                              className="px-2 py-2 text-left font-medium"
                              style={{ paddingLeft: 8 + node.depth * 14 }}
                            >
                              <span className="inline-flex items-center gap-1">
                                {hasKids ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(node.path)}
                                    className="p-0.5 rounded hover:bg-white/10 text-zinc-300"
                                    aria-expanded={expanded}
                                  >
                                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                ) : (
                                  <span className="w-[22px] inline-block" />
                                )}
                                {node.segmentLabel || '—'}
                              </span>
                            </td>
                            {node.aggregates.map((val, i) => {
                              const mi = pivotResult.dataHeaders[i]?.measureIndex ?? 0;
                              const meas = effectiveLayout.measures[mi];
                              const agg = meas?.agg ?? 'count';
                              return (
                                <td key={i} className="px-3 py-2 text-right tabular-nums text-zinc-200">
                                  {formatPivotMeasureValue(val, agg, meas?.showAs)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr className="bg-zinc-800 font-bold border-t-2 border-double border-emerald-700">
                        <td className="px-3 py-2">Total Geral</td>
                        {pivotResult.grandTotal.map((val, i) => {
                          const mi = pivotResult.dataHeaders[i]?.measureIndex ?? 0;
                          const meas = effectiveLayout.measures[mi];
                          const agg = meas?.agg ?? 'count';
                          return (
                            <td key={i} className="px-3 py-2 text-right tabular-nums">
                              {formatPivotMeasureValue(val, agg, meas?.showAs)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropZoneBox({
  title,
  icon: Icon,
  className,
  children,
  onDragOver,
  onDrop,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  className?: string;
  children: React.ReactNode;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 uppercase tracking-wide">
        <Icon size={14} className="text-zinc-500" />
        {title}
      </div>
      <div className={className} onDragOver={onDragOver} onDrop={onDrop}>
        {children}
        {React.Children.count(children) === 0 && (
          <span className="text-[11px] text-zinc-600 m-auto py-2">Solte campos aqui</span>
        )}
      </div>
    </div>
  );
}

function FieldChip({
  label,
  draggablePayload,
  onRemove,
  onClickFilter,
  showFilterHint,
  activeFilter,
}: {
  label: string;
  draggablePayload: { field: string };
  onRemove: () => void;
  onClickFilter?: () => void;
  showFilterHint?: boolean;
  activeFilter?: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_TYPE, JSON.stringify(draggablePayload));
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'flex items-center gap-1 bg-zinc-800 border rounded-lg px-2 py-1 text-xs',
        activeFilter ? 'border-amber-500/60' : 'border-zinc-600'
      )}
    >
      <GripVertical className="w-3 h-3 text-zinc-500 shrink-0" aria-hidden />
      <span className="truncate flex-1 max-w-[160px]" title={label}>
        {label}
      </span>
      {showFilterHint && onClickFilter && (
        <button
          type="button"
          onClick={onClickFilter}
          className="text-[10px] text-zinc-400 hover:text-white underline shrink-0"
        >
          Valores
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="text-zinc-500 hover:text-red-400 p-0.5 shrink-0"
        aria-label="Remover"
      >
        <X size={14} />
      </button>
    </div>
  );
}
