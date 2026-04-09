/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  ArrowRight, 
  Table as TableIcon, 
  CheckCircle2, 
  Download, 
  AlertCircle,
  Info,
  X,
  Search,
  Database,
  Columns,
  Sparkles,
  Moon,
  Sun,
  Settings2,
  Activity,
  Filter,
  Layers,
  Zap,
  Settings,
  HelpCircle,
  Target,
  ArrowUpDown,
  FileSpreadsheet,
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpAZ,
  ArrowDownZA,
  SortAsc,
  SortDesc,
  Pencil,
  TableProperties,
  FileText,
  FileJson,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { computeAutoDetectLookup } from './lib/autoDetectLookupConfig';
import {
  type SortConfig,
  compareResultCellAsc,
  columnStringSamplesLookLikeDates,
} from './lib/resultTableSort';
import { ConfigureAiAssistant } from './components/ConfigureAiAssistant';
import { ConfigureTabPanels } from './components/ConfigureTabPanels';
import { ConfigureStepShell, ConfigureWizardStepper } from './components/ConfigureStepShell';
import { PivotTableModal } from './components/PivotTableModal';
import { PasteDataModal } from './components/PasteDataModal';
import { normalizeExcelRow } from './lib/excelRowNormalize';
import {
  buildResultExportRows,
  buildResultExportRowsForJson,
  downloadJsonFile,
  getResultExportVisibleColumnIds,
  resultExportBaseFileName,
} from './lib/exportResult';
import type { ExcelData, ColumnSetting, LookupTask } from './types/lookupTask';

type Step = 'upload' | 'configure' | 'result';

/** Largura da coluna # na tabela de resultados (px). */
const RESULT_INDEX_COL_WIDTH_PX = 48;
const DEFAULT_RESULT_COL_WIDTH_PX = 140;
const MIN_RESULT_COL_WIDTH_PX = 64;
const MAX_RESULT_COL_WIDTH_PX = 600;

function getResultColWidthPx(c: ColumnSetting): number {
  return c.widthPx ?? DEFAULT_RESULT_COL_WIDTH_PX;
}

type PairColumnSide = 'a' | 'lookup';

/** Destaque visual para colunas que formam um par de comparação (lado a lado na grade). */
function pairHighlightClasses(
  colId: string,
  meta: Record<string, { pairIndex: number; side: PairColumnSide }>
): string {
  const m = meta[colId];
  if (!m) return '';
  const isEven = m.pairIndex % 2 === 0;
  const borderColor = isEven ? 'border-orange-500/55' : 'border-amber-500/55';
  const bgTint = isEven ? 'bg-orange-500/[0.08]' : 'bg-amber-500/[0.08]';
  if (m.side === 'a') return cn(borderColor, bgTint, 'border-l-2');
  return cn(borderColor, bgTint, 'border-r-2');
}

/** `Object.entries` perde o tipo dos valores; aqui preservamos `Set<string>`. */
function columnFilterEntries(filters: Record<string, Set<string>>): [string, Set<string>][] {
  return Object.entries(filters) as [string, Set<string>][];
}

function columnFilterValueSets(filters: Record<string, Set<string>>): Set<string>[] {
  return Object.values(filters) as Set<string>[];
}

/** Mesma ideia do `clean` do worker: chave estável para detectar duplicados no resultado. */
function normalizeDuplicateKeyCell(
  val: unknown,
  opts: Pick<LookupTask, 'trimSpaces' | 'ignoreCase' | 'removeSpecialChars'>
): string {
  if (val === undefined || val === null) return '';
  let s = String(val);
  if (opts.trimSpaces) s = s.trim();
  if (opts.ignoreCase) s = s.toLowerCase();
  if (opts.removeSpecialChars) s = s.replace(/[^a-z0-9]/gi, '');
  return s;
}

// Web Worker Code extracted to a constant for better performance and maintainability
// Optimized Levenshtein algorithm to use O(min(m,n)) space instead of O(m*n)
const WORKER_CODE = `
  self.onmessage = function(e) {
    const { 
      dataA: rawDataA, dataB, keyA, keyB, selectedColsA, selectedColsB,
      dataC, keyA_C, keyC, selectedColsC,
      exactMatch, trimSpaces, ignoreCase, removeSpecialChars, duplicateStrategy, fuzzyThreshold,
      ifNotFound, ifNotFoundC, matchMode, searchDirection, includeStatusCols
    } = e.data;

    // Se o usuário selecionou colunas específicas de A, filtra cada linha
    const dataA = (selectedColsA && selectedColsA.length > 0)
      ? rawDataA.map(row => {
          const filtered = {};
          selectedColsA.forEach(col => { filtered[col] = row[col]; });
          return filtered;
        })
      : rawDataA;

    if (!dataA || !dataB) {
      self.postMessage({ error: "Dados ausentes" });
      return;
    }

    function clean(val) {
      if (val === undefined || val === null) return "";
      let s = String(val);
      if (trimSpaces) s = s.trim();
      if (ignoreCase) s = s.toLowerCase();
      if (removeSpecialChars) s = s.replace(/[^a-z0-9]/gi, '');
      return s;
    }

    // Optimized Levenshtein (Wagner-Fischer with two rows) to save memory
    function levenshtein(s, t) {
      if (s === t) return 0;
      if (s.length === 0) return t.length;
      if (t.length === 0) return s.length;

      // Swap to ensure we use the smaller array for memory efficiency
      if (s.length > t.length) [s, t] = [t, s];

      const sLen = s.length;
      const tLen = t.length;
      
      let v0 = new Uint16Array(sLen + 1);
      let v1 = new Uint16Array(sLen + 1);

      for (let i = 0; i <= sLen; i++) v0[i] = i;

      for (let i = 0; i < tLen; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < sLen; j++) {
          const cost = s[j] === t[i] ? 0 : 1;
          v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        // Swap arrays for next iteration
        let temp = v0; v0 = v1; v1 = temp;
      }
      return v0[sLen];
    }

    function similarity(a, b) {
      const longer = a.length > b.length ? a : b;
      const shorter = a.length > b.length ? b : a;
      if (longer.length === 0) return 1.0;
      return (longer.length - levenshtein(longer, shorter)) / parseFloat(longer.length);
    }

    function createLookupMap(data, key, selectedCols) {
      const lookupMap = new Map();
      data.forEach(row => {
        const keyValue = clean(row[key]);
        if (keyValue !== "") {
          if (duplicateStrategy === 'first' && lookupMap.has(keyValue)) return;
          
          if (duplicateStrategy === 'concatenate' && lookupMap.has(keyValue)) {
            const existing = lookupMap.get(keyValue);
            const merged = { ...existing };
            selectedCols.forEach(col => {
              if (row[col] !== undefined && row[col] !== null) {
                merged[col] = String(merged[col]) + "; " + String(row[col]);
              }
            });
            lookupMap.set(keyValue, merged);
          } else {
            lookupMap.set(keyValue, row);
          }
        }
      });
      return lookupMap;
    }

    function findMatch(valA, data, key) {
      const cleanA = clean(valA);
      if (cleanA === "") return null;
      const searchData = searchDirection === -1 ? [...data].reverse() : data;

      if (matchMode === 0) {
        return searchData.find(row => clean(row[key]) === cleanA);
      } else if (matchMode === -1 || matchMode === 1) {
        let bestMatch = null;
        let bestDiff = Infinity;
        for (const row of searchData) {
          const valB = row[key];
          const cleanB = clean(valB);
          if (cleanB === cleanA) return row;
          const numA = parseFloat(valA);
          const numB = parseFloat(valB);
          if (!isNaN(numA) && !isNaN(numB)) {
            const diff = numA - numB;
            if (matchMode === -1 && diff > 0 && diff < bestDiff) { bestDiff = diff; bestMatch = row; }
            else if (matchMode === 1 && diff < 0 && Math.abs(diff) < bestDiff) { bestDiff = Math.abs(diff); bestMatch = row; }
          } else {
            if (matchMode === -1 && cleanB < cleanA) { if (bestMatch === null || cleanB > clean(bestMatch[key])) { bestMatch = row; } }
            else if (matchMode === 1 && cleanB > cleanA) { if (bestMatch === null || cleanB < clean(bestMatch[key])) { bestMatch = row; } }
          }
        }
        return bestMatch;
      } else if (matchMode === 2) {
        const escaped = cleanA.replace(new RegExp("[.+^" + "$" + "{}()|\\\\[\\\\]\\\\\\\\\\\\]", "g"), "\\\\$&");
        const regexStr = "^" + escaped.replace(/[?]/g, ".").replace(/[*]/g, ".*") + "$";
        try { const regex = new RegExp(regexStr, ignoreCase ? "i" : ""); return searchData.find(row => regex.test(String(row[key]))); } catch (e) { return null; }
      }
      return null;
    }

    let result;

    if (exactMatch) {
      if (matchMode === 0) {
        const searchDataB = searchDirection === -1 ? [...dataB].reverse() : dataB;
        const lookupMapB = createLookupMap(searchDataB, keyB, selectedColsB);
        const searchDataC = dataC && searchDirection === -1 ? [...dataC].reverse() : dataC;
        const lookupMapC = dataC ? createLookupMap(searchDataC, keyC, selectedColsC) : null;
        result = dataA.map(rowA => {
          const keyValueA = clean(rowA[keyA]);
          const matchB = lookupMapB.get(keyValueA);
          const newRow = { ...rowA };
          selectedColsB.forEach(col => { newRow['Lookup_' + col] = matchB ? matchB[col] : ifNotFound; });
          newRow['_match_found_B'] = !!matchB;
          if (includeStatusCols) newRow['Status_B'] = matchB ? "VERDADEIRO" : "FALSO";
          let matchFoundC = false;
          if (lookupMapC) {
            const keyValueA_C = clean(rowA[keyA_C]);
            const matchC = lookupMapC.get(keyValueA_C);
            selectedColsC.forEach(col => { newRow['LookupC_' + col] = matchC ? matchC[col] : ifNotFoundC; });
            matchFoundC = !!matchC;
            newRow['_match_found_C'] = matchFoundC;
            if (includeStatusCols) newRow['Status_C'] = matchFoundC ? "VERDADEIRO" : "FALSO";
          }
          newRow['_match_found'] = !!matchB || matchFoundC;
          if (includeStatusCols && lookupMapC) newRow['Status_Ambas'] = (!!matchB && matchFoundC) ? "VERDADEIRO" : "FALSO";
          return newRow;
        });
      } else {
        result = dataA.map(rowA => {
          const matchB = findMatch(rowA[keyA], dataB, keyB);
          const newRow = { ...rowA };
          selectedColsB.forEach(col => { newRow['Lookup_' + col] = matchB ? matchB[col] : ifNotFound; });
          newRow['_match_found_B'] = !!matchB;
          if (includeStatusCols) newRow['Status_B'] = matchB ? "VERDADEIRO" : "FALSO";
          let matchFoundC = false;
          if (dataC) {
            const matchC = findMatch(rowA[keyA_C], dataC, keyC);
            selectedColsC.forEach(col => { newRow['LookupC_' + col] = matchC ? matchC[col] : ifNotFoundC; });
            matchFoundC = !!matchC;
            newRow['_match_found_C'] = matchFoundC;
            if (includeStatusCols) newRow['Status_C'] = matchFoundC ? "VERDADEIRO" : "FALSO";
          }
          newRow['_match_found'] = !!matchB || matchFoundC;
          if (includeStatusCols && dataC) newRow['Status_Ambas'] = (!!matchB && matchFoundC) ? "VERDADEIRO" : "FALSO";
          return newRow;
        });
      }
    } else {
      result = dataA.map(rowA => {
        const strA = clean(rowA[keyA]);
        const newRow = { ...rowA };
        if (strA === "") {
          selectedColsB.forEach(col => newRow['Lookup_' + col] = ifNotFound);
          newRow['_match_found_B'] = false;
        } else {
          let bestMatchB = null;
          let highestSimB = 0;
          for (const rowB of dataB) {
            const strB = clean(rowB[keyB]);
            if (strB === "") continue;
            const sim = similarity(strA, strB);
            if (sim > highestSimB && sim >= fuzzyThreshold) { highestSimB = sim; bestMatchB = rowB; }
            if (highestSimB === 1) break;
          }
          selectedColsB.forEach(col => { newRow['Lookup_' + col] = bestMatchB ? bestMatchB[col] : ifNotFound; });
          newRow['_match_found_B'] = !!bestMatchB;
          if (includeStatusCols) newRow['Status_B'] = bestMatchB ? "VERDADEIRO" : "FALSO";
        }
        let matchFoundC = false;
        if (dataC) {
          const strA_C = clean(rowA[keyA_C]);
          if (strA_C === "") {
            selectedColsC.forEach(col => newRow['LookupC_' + col] = ifNotFoundC);
            matchFoundC = false;
            newRow['_match_found_C'] = false;
            if (includeStatusCols) newRow['Status_C'] = "FALSO";
          } else {
            let bestMatchC = null;
            let highestSimC = 0;
            for (const rowC of dataC) {
              const strC = clean(rowC[keyC]);
              if (strC === "") continue;
              const sim = similarity(strA_C, strC);
              if (sim > highestSimC && sim >= fuzzyThreshold) { highestSimC = sim; bestMatchC = rowC; }
              if (highestSimC === 1) break;
            }
            selectedColsC.forEach(col => { newRow['LookupC_' + col] = bestMatchC ? bestMatchC[col] : ifNotFoundC; });
            matchFoundC = !!bestMatchC;
            newRow['_match_found_C'] = matchFoundC;
            if (includeStatusCols) newRow['Status_C'] = matchFoundC ? "VERDADEIRO" : "FALSO";
          }
        }
        newRow['_match_found'] = newRow['_match_found_B'] || matchFoundC;
        if (includeStatusCols && dataC) newRow['Status_Ambas'] = (newRow['_match_found_B'] && matchFoundC) ? "VERDADEIRO" : "FALSO";
        return newRow;
      });
    }
    self.postMessage(result);
  };
`;

export default function App() {
  const [tasks, setTasks] = useState<LookupTask[]>([
    {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Operação 1',
      fileA: null,
      fileB: null,
      keyA: '',
      keyB: '',
      selectedColsA: [],
      selectedColsB: [],
      fileC: null,
      keyA_C: '',
      keyC: '',
      selectedColsC: [],
      lookupType: 'xlookup',
      exactMatch: true,
      trimSpaces: true,
      ignoreCase: true,
      removeSpecialChars: false,
      duplicateStrategy: 'first',
      fuzzyThreshold: 0.8,
      ifNotFound: '#N/D',
      ifNotFoundC: '#N/D',
      matchMode: 0,
      searchDirection: 1,
      includeStatusCols: true,
      resultData: null,
      resultFilter: 'all',
      duplicateKeyFilterEnabled: false,
      duplicateKeyColumnId: '',
      divergentPairs: [],
      showAdvanced: false,
      columnSettings: [],
    }
  ]);
  const [activeTaskId, setActiveTaskId] = useState<string>(tasks[0].id);
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [configTab, setConfigTab] = useState<'keys' | 'columns' | 'advanced'>('keys');
  const [columnFilters, setColumnFilters] = useState<{ [col: string]: Set<string> }>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  /** Botão "Filtrar…" da coluna aberta — âncora para o menu em portal (evita corte por overflow). */
  const columnFilterAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [showDivergentConfig, setShowDivergentConfig] = useState(false);
  const [visibleRows, setVisibleRows] = useState(50);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  /** Durante arraste de redimensionar coluna (só repintura; commit no pointerup). */
  const [columnResizePreview, setColumnResizePreview] = useState<{ colId: string; widthPx: number } | null>(null);
  const [showPivotModal, setShowPivotModal] = useState(false);
  const [pasteTarget, setPasteTarget] = useState<'A' | 'B' | 'C' | null>(null);
  const columnResizeSessionRef = useRef<{
    colId: string;
    startX: number;
    startWidth: number;
    currentWidth: number;
    pointerId: number;
    handle: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const activeTask = useMemo(() => tasks.find(t => t.id === activeTaskId)!, [tasks, activeTaskId]);

  /**
   * Atualiza o estado da tarefa ativa com os novos valores fornecidos.
   * @param updates Objeto contendo as propriedades a serem atualizadas na tarefa ativa.
   */
  const updateActiveTask = useCallback((updates: Partial<LookupTask>) => {
    setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, ...updates } : t));
  }, [activeTaskId]);

  const onColumnResizePointerMove = useCallback((e: PointerEvent) => {
    const s = columnResizeSessionRef.current;
    if (!s) return;
    const nw = Math.round(
      Math.min(
        MAX_RESULT_COL_WIDTH_PX,
        Math.max(MIN_RESULT_COL_WIDTH_PX, s.startWidth + (e.clientX - s.startX))
      )
    );
    s.currentWidth = nw;
    setColumnResizePreview({ colId: s.colId, widthPx: nw });
  }, []);

  const endColumnResize = useCallback(() => {
    const s = columnResizeSessionRef.current;
    if (!s) return;
    window.removeEventListener('pointermove', onColumnResizePointerMove);
    window.removeEventListener('pointerup', endColumnResize);
    window.removeEventListener('pointercancel', endColumnResize);
    columnResizeSessionRef.current = null;
    const finalW = s.currentWidth;
    setColumnResizePreview(null);
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== activeTaskId) return t;
        return {
          ...t,
          columnSettings: t.columnSettings.map(c =>
            c.id === s.colId ? { ...c, widthPx: finalW } : c
          ),
        };
      })
    );
    if (s.handle) {
      try {
        s.handle.releasePointerCapture(s.pointerId);
      } catch {
        /* ignore */
      }
    }
  }, [activeTaskId, onColumnResizePointerMove]);

  const beginColumnResize = useCallback(
    (e: React.PointerEvent, col: ColumnSetting) => {
      e.preventDefault();
      e.stopPropagation();
      const startW = getResultColWidthPx(col);
      const handle = e.currentTarget as HTMLElement;
      columnResizeSessionRef.current = {
        colId: col.id,
        startX: e.clientX,
        startWidth: startW,
        currentWidth: startW,
        pointerId: e.pointerId,
        handle,
      };
      setColumnResizePreview({ colId: col.id, widthPx: startW });
      handle.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onColumnResizePointerMove);
      window.addEventListener('pointerup', endColumnResize);
      window.addEventListener('pointercancel', endColumnResize);
    },
    [endColumnResize, onColumnResizePointerMove]
  );

  const getResultColDisplayWidthPx = useCallback(
    (col: ColumnSetting) =>
      columnResizePreview?.colId === col.id ? columnResizePreview.widthPx : getResultColWidthPx(col),
    [columnResizePreview]
  );

  /**
   * Adiciona uma nova operação (task) à lista de tarefas.
   */
  const addTask = () => {
    const newTask: LookupTask = {
      id: Math.random().toString(36).substring(2, 11),
      name: `Operação ${tasks.length + 1}`,
      fileA: null,
      fileB: null,
      keyA: '',
      keyB: '',
      selectedColsA: [],
      selectedColsB: [],
      fileC: null,
      keyA_C: '',
      keyC: '',
      selectedColsC: [],
      lookupType: 'xlookup',
      exactMatch: true,
      trimSpaces: true,
      ignoreCase: true,
      removeSpecialChars: false,
      duplicateStrategy: 'first',
      fuzzyThreshold: 0.8,
      ifNotFound: '#N/D',
      ifNotFoundC: '#N/D',
      matchMode: 0,
      searchDirection: 1,
      includeStatusCols: true,
      resultData: null,
      resultFilter: 'all',
      duplicateKeyFilterEnabled: false,
      duplicateKeyColumnId: '',
      divergentPairs: [],
      showAdvanced: false,
      columnSettings: [],
    };
    setTasks(prev => [...prev, newTask]);
    setActiveTaskId(newTask.id);
    setStep('upload');
    setColumnFilters({});
  };

  /**
   * Remove uma operação da lista de tarefas.
   * @param id ID da tarefa a ser removida.
   */
  const removeTask = (id: string) => {
    if (tasks.length === 1) return;
    const newTasks = tasks.filter(t => t.id !== id);
    setTasks(newTasks);
    if (activeTaskId === id) {
      setActiveTaskId(newTasks[0].id);
    }
  };

  /**
   * Processa o upload de arquivos Excel e extrai os dados das planilhas.
   * @param e Evento de mudança do input de arquivo.
   * @param type Identificador da tabela ('A', 'B' ou 'C').
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'A' | 'B' | 'C') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isText = ext === 'csv' || ext === 'tsv';

    const parseAndUpdate = (result: string | ArrayBuffer | null) => {
      try {
        // cellDates: true converte seriais de data do Excel em objetos Date do JS,
        // garantindo formatação correta independente do locale do arquivo.
        const wb = isText
          ? XLSX.read(result as string, { type: 'string' })
          : XLSX.read(result as ArrayBuffer, { type: 'array', cellDates: true });

        if (!wb.SheetNames.length) {
          setError("O arquivo não contém planilhas ou está vazio.");
          return;
        }

        const sheets: { [key: string]: any[] } = {};
        wb.SheetNames.forEach(name => {
          const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
            wb.Sheets[name],
            { defval: '' }
          );
          sheets[name] = raw.map(normalizeExcelRow);
        });

        const data: ExcelData = {
          name: file.name,
          sheets,
          selectedSheet: wb.SheetNames[0]
        };

        if (type === 'A') updateActiveTask({ fileA: data });
        else if (type === 'B') updateActiveTask({ fileB: data });
        else updateActiveTask({ fileC: data });
      } catch (err) {
        setError(`Não foi possível ler o arquivo "${file.name}" (${ext.toUpperCase()}). Verifique se o formato é suportado e se o arquivo não está corrompido.`);
      } finally {
        setLoading(false);
      }
    };

    const reader = new FileReader();
    reader.onload = (evt) => parseAndUpdate(evt.target?.result ?? null);
    reader.onerror = () => {
      setError("Erro ao ler o arquivo. Verifique se ele não está corrompido ou bloqueado.");
      setLoading(false);
    };

    if (isText) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handlePasteData = useCallback((type: 'A' | 'B' | 'C') => {
    setPasteTarget(type);
  }, []);

  const handlePasteDataAccept = useCallback(
    (data: ExcelData) => {
      if (pasteTarget === 'A') updateActiveTask({ fileA: data });
      else if (pasteTarget === 'B') updateActiveTask({ fileB: data });
      else if (pasteTarget === 'C') updateActiveTask({ fileC: data });
    },
    [pasteTarget, updateActiveTask]
  );

  const pasteTargetLabel =
    pasteTarget === 'A'
      ? 'Tabela principal (A)'
      : pasteTarget === 'B'
        ? 'Tabela de busca (B)'
        : pasteTarget === 'C'
          ? 'Tabela extra (C)'
          : undefined;

  /**
   * Cabeçalhos extraídos da Tabela A (planilha selecionada).
   */
  const headersA = useMemo(() => {
    if (!activeTask.fileA) return [];
    const data = activeTask.fileA.sheets[activeTask.fileA.selectedSheet];
    return data.length > 0 ? Object.keys(data[0]) : [];
  }, [activeTask.fileA]);

  /**
   * Cabeçalhos extraídos da Tabela B (planilha selecionada).
   */
  const headersB = useMemo(() => {
    if (!activeTask.fileB) return [];
    const data = activeTask.fileB.sheets[activeTask.fileB.selectedSheet];
    return data.length > 0 ? Object.keys(data[0]) : [];
  }, [activeTask.fileB]);

  /**
   * Cabeçalhos extraídos da Tabela C (planilha selecionada).
   */
  const headersC = useMemo(() => {
    if (!activeTask.fileC || !activeTask.fileC.selectedSheet) return [];
    const data = activeTask.fileC.sheets[activeTask.fileC.selectedSheet];
    if (!data) return [];
    return data.length > 0 ? Object.keys(data[0]) : [];
  }, [activeTask.fileC]);

  // Real-time validation
  /**
   * Validação em tempo real das configurações da tarefa ativa.
   * Verifica se as chaves foram selecionadas e se as restrições do PROCV são respeitadas.
   */
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!activeTask.keyA) errors.push("Selecione a coluna chave da Tabela A.");
    if (!activeTask.keyB) errors.push("Selecione a coluna chave da Tabela B.");
    if (activeTask.selectedColsB.length === 0) errors.push("Selecione ao menos uma coluna de retorno da Tabela B.");

    if (activeTask.fileC) {
      if (!activeTask.keyA_C) errors.push("Selecione a coluna chave da Tabela A para busca na Tabela C.");
      if (!activeTask.keyC) errors.push("Selecione a coluna chave da Tabela C.");
      if (activeTask.selectedColsC.length === 0) errors.push("Selecione ao menos uma coluna de retorno da Tabela C.");
    }

    if (activeTask.lookupType === 'vlookup' && activeTask.keyB) {
      const keyIndex = headersB.indexOf(activeTask.keyB);
      const invalidCols = activeTask.selectedColsB.filter(col => headersB.indexOf(col) < keyIndex);
      if (invalidCols.length > 0) {
        errors.push(`PROCV (Tabela B): As colunas [${invalidCols.join(', ')}] estão à esquerda da chave.`);
      }
    }

    if (activeTask.fileC && activeTask.lookupType === 'vlookup' && activeTask.keyC) {
      const keyIndex = headersC.indexOf(activeTask.keyC);
      const invalidCols = activeTask.selectedColsC.filter(col => headersC.indexOf(col) < keyIndex);
      if (invalidCols.length > 0) {
        errors.push(`PROCV (Tabela C): As colunas [${invalidCols.join(', ')}] estão à esquerda da chave.`);
      }
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings 
    };
  }, [activeTask.keyA, activeTask.keyB, activeTask.selectedColsB, activeTask.keyA_C, activeTask.keyC, activeTask.selectedColsC, activeTask.fileC, activeTask.lookupType, headersB, headersC]);

  /** Métricas rápidas na etapa Configurar (amostra limitada para taxa de match). */
  const configureKeyMetrics = useMemo(() => {
    const empty = {
      totalRows: 0,
      dupInB: 0,
      matchApprox: null as number | null,
      valueFormat: '—' as string,
    };
    if (!activeTask.fileA || !activeTask.fileB) return empty;
    const sheetA = activeTask.fileA.sheets[activeTask.fileA.selectedSheet] ?? [];
    const sheetB = activeTask.fileB.sheets[activeTask.fileB.selectedSheet] ?? [];
    const totalRows = sheetA.length;

    const norm = (v: unknown) => {
      let s = String(v ?? '');
      if (activeTask.trimSpaces) s = s.trim();
      if (activeTask.ignoreCase) s = s.toLowerCase();
      if (activeTask.removeSpecialChars) s = s.replace(/[^a-z0-9]/gi, '');
      return s;
    };

    let dupInB = 0;
    if (activeTask.keyB) {
      const counts = new Map<string, number>();
      const maxScan = Math.min(sheetB.length, 200_000);
      for (let i = 0; i < maxScan; i++) {
        const k = norm(sheetB[i][activeTask.keyB]);
        if (!k) continue;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      for (const n of counts.values()) {
        if (n > 1) dupInB += n - 1;
      }
    }

    let matchApprox: number | null = null;
    if (activeTask.keyA && activeTask.keyB && sheetA.length && sheetB.length) {
      const bSet = new Set<string>();
      const maxB = Math.min(sheetB.length, 200_000);
      for (let i = 0; i < maxB; i++) {
        const k = norm(sheetB[i][activeTask.keyB]);
        if (k) bSet.add(k);
      }
      const cap = Math.min(3000, sheetA.length);
      let hits = 0;
      let nonEmpty = 0;
      for (let i = 0; i < cap; i++) {
        const k = norm(sheetA[i][activeTask.keyA]);
        if (!k) continue;
        nonEmpty++;
        if (bSet.has(k)) hits++;
      }
      matchApprox = nonEmpty > 0 ? Math.round((hits / nonEmpty) * 100) : 0;
    }

    let valueFormat = '—';
    if (activeTask.keyA && sheetA.length) {
      const samples: unknown[] = [];
      for (let i = 0; i < Math.min(80, sheetA.length); i++) {
        const v = sheetA[i][activeTask.keyA];
        if (v !== '' && v != null) samples.push(v);
        if (samples.length >= 10) break;
      }
      if (samples.length) {
        const allNum = samples.every(
          (v) =>
            typeof v === 'number' ||
            (typeof v === 'string' && String(v).trim() !== '' && !Number.isNaN(Number(String(v).trim())))
        );
        valueFormat = allNum ? 'Número' : 'Texto';
      }
    }

    return { totalRows, dupInB, matchApprox, valueFormat };
  }, [
    activeTask.fileA,
    activeTask.fileB,
    activeTask.keyA,
    activeTask.keyB,
    activeTask.trimSpaces,
    activeTask.ignoreCase,
    activeTask.removeSpecialChars,
  ]);

  /**
   * Filtra os dados de resultado com base no filtro global e nos filtros por coluna.
   */
  const filteredResultData = useMemo(() => {
    if (!activeTask.resultData) return [];

    let data = activeTask.resultData;

    if (activeTask.resultFilter === 'matched') {
      data = data.filter(r => r._match_found_B || (activeTask.fileC ? r._match_found_C : false));
    } else if (activeTask.resultFilter === 'orphans') {
      data = data.filter(r => !r._match_found_B && (activeTask.fileC ? !r._match_found_C : true));
    } else if (activeTask.resultFilter === 'divergent') {
      const normDivergent = (val: unknown): string =>
        String(val ?? '')
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[-_]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const pairs = activeTask.divergentPairs;
      if (pairs.length > 0) {
        // Usa os pares configurados manualmente pelo usuário
        data = data.filter(r =>
          pairs.some(p => normDivergent(r[p.colA]) !== normDivergent(r[p.colLookup]))
        );
      } else {
        // Fallback: auto-detecta por prefixo Lookup_ / LookupC_
        data = data.filter(r => {
          if (!r._match_found_B && !(activeTask.fileC ? r._match_found_C : false)) return false;
          return Object.keys(r).some(key => {
            const originalKey = key.startsWith('Lookup_') ? key.slice('Lookup_'.length)
              : key.startsWith('LookupC_') ? key.slice('LookupC_'.length)
              : null;
            if (!originalKey || !(originalKey in r)) return false;
            return normDivergent(r[originalKey]) !== normDivergent(r[key]);
          });
        });
      }
    }

    const dupEnabled = activeTask.duplicateKeyFilterEnabled;
    const dupCol = activeTask.duplicateKeyColumnId;
    if (dupEnabled && dupCol) {
      const normOpts = {
        trimSpaces: activeTask.trimSpaces,
        ignoreCase: activeTask.ignoreCase,
        removeSpecialChars: activeTask.removeSpecialChars,
      };
      const counts = new Map<string, number>();
      for (const row of data) {
        let k = normalizeDuplicateKeyCell(row[dupCol], normOpts);
        if (!k) k = '__EMPTY__';
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      data = data.filter(row => {
        let k = normalizeDuplicateKeyCell(row[dupCol], normOpts);
        if (!k) k = '__EMPTY__';
        return (counts.get(k) || 0) > 1;
      });
    }

    const activeColFilters = columnFilterEntries(columnFilters);
    if (activeColFilters.length > 0) {
      data = data.filter(row =>
        activeColFilters.every(([col, allowedSet]) =>
          allowedSet.has(String(row[col] ?? ''))
        )
      );
    }

    if (sortConfig) {
      const { colId, direction } = sortConfig;
      return [...data].sort((a, b) => {
        const va = a[colId];
        const vb = b[colId];
        return direction === 'asc'
          ? compareResultCellAsc(va, vb)
          : compareResultCellAsc(vb, va);
      });
    }

    return data;
  }, [
    activeTask.resultData,
    activeTask.resultFilter,
    activeTask.fileC,
    activeTask.divergentPairs,
    activeTask.duplicateKeyFilterEnabled,
    activeTask.duplicateKeyColumnId,
    activeTask.trimSpaces,
    activeTask.ignoreCase,
    activeTask.removeSpecialChars,
    columnFilters,
    sortConfig,
  ]);

  useEffect(() => {
    setSelectedRowIndex(null);
  }, [activeTask.resultData, activeTaskId]);

  useEffect(() => {
    if (selectedRowIndex !== null && selectedRowIndex >= filteredResultData.length) {
      setSelectedRowIndex(null);
    }
  }, [filteredResultData.length, selectedRowIndex]);

  /**
   * Calcula estatísticas básicas sobre o resultado do cruzamento.
   */
  const stats = useMemo(() => {
    if (!activeTask.resultData) return null;
    const total = activeTask.resultData.length;
    const matched = activeTask.resultData.filter(r => r._match_found_B || (activeTask.fileC ? r._match_found_C : false)).length;
    const orphans = total - matched;
    const rate = total > 0 ? (matched / total) * 100 : 0;
    return { total, matched, orphans, rate };
  }, [activeTask.resultData, activeTask.fileC]);

  /**
   * Define a ordem e visibilidade das colunas para exibição na tabela de resultados.
   */
  const displayColumns = useMemo(() => {
    if (!activeTask.columnSettings || activeTask.columnSettings.length === 0) return [];
    const visible = activeTask.columnSettings.filter(c => c.visible);
    const pinned = visible.filter(c => c.pinned);
    const unpinned = visible.filter(c => !c.pinned);
    return [...pinned, ...unpinned];
  }, [activeTask.columnSettings]);

  /**
   * Reordena colunas para manter cada par (A ↔ lookup) adjacente e expõe metadados para destaque na grade.
   */
  const { tableDisplayColumns, pairColumnMeta } = useMemo(() => {
    const empty: Record<string, { pairIndex: number; side: PairColumnSide }> = {};
    const configured = activeTask.divergentPairs.filter(p => p.colA && p.colLookup);
    if (configured.length === 0) {
      return { tableDisplayColumns: displayColumns, pairColumnMeta: empty };
    }
    const idSet = new Set(displayColumns.map(c => c.id));
    const validPairs = configured.filter(p => idSet.has(p.colA) && idSet.has(p.colLookup));
    if (validPairs.length === 0) {
      return { tableDisplayColumns: displayColumns, pairColumnMeta: empty };
    }

    const lookupSkip = new Set(validPairs.map(p => p.colLookup));
    const colAToPair = new Map<string, { colA: string; colLookup: string }>();
    validPairs.forEach(p => {
      colAToPair.set(p.colA, { colA: p.colA, colLookup: p.colLookup });
    });

    const pairMeta: Record<string, { pairIndex: number; side: PairColumnSide }> = {};
    validPairs.forEach((p, i) => {
      pairMeta[p.colA] = { pairIndex: i, side: 'a' };
      pairMeta[p.colLookup] = { pairIndex: i, side: 'lookup' };
    });

    const byId = new Map<string, ColumnSetting>(
      displayColumns.map((c): [string, ColumnSetting] => [c.id, c])
    );
    const out: ColumnSetting[] = [];
    for (const col of displayColumns) {
      if (lookupSkip.has(col.id)) continue;
      const paired = colAToPair.get(col.id);
      if (paired) {
        const ca = byId.get(paired.colA);
        const cl = byId.get(paired.colLookup);
        if (ca) out.push(ca);
        if (cl) out.push(cl);
      } else {
        out.push(col);
      }
    }

    return { tableDisplayColumns: out, pairColumnMeta: pairMeta };
  }, [displayColumns, activeTask.divergentPairs]);

  /**
   * Troca a ordem de duas colunas adjacentes na grade de resultados, persistindo em `columnSettings`.
   * Usa os índices em `tableDisplayColumns` para o vizinho e resolve os índices reais em `columnSettings`.
   */
  const moveTableDisplayColumn = useCallback(
    (colId: string, direction: 'left' | 'right') => {
      const cols = tableDisplayColumns;
      const displayIdx = cols.findIndex(c => c.id === colId);
      if (displayIdx < 0) return;
      const neighborIdx = direction === 'left' ? displayIdx - 1 : displayIdx + 1;
      if (neighborIdx < 0 || neighborIdx >= cols.length) return;

      const idA = cols[displayIdx]!.id;
      const idB = cols[neighborIdx]!.id;
      const settings = [...activeTask.columnSettings];
      const iA = settings.findIndex(c => c.id === idA);
      const iB = settings.findIndex(c => c.id === idB);
      if (iA < 0 || iB < 0) return;

      [settings[iA], settings[iB]] = [settings[iB]!, settings[iA]!];
      updateActiveTask({ columnSettings: settings });
    },
    [tableDisplayColumns, activeTask.columnSettings, updateActiveTask]
  );

  /**
   * Executa a lógica de cruzamento de dados utilizando um Web Worker para não travar a UI.
   */
  const performLookup = () => {
    if (!activeTask.fileA || !activeTask.fileB || !activeTask.keyA || !activeTask.keyB || activeTask.selectedColsB.length === 0) {
      setError("Por favor, preencha todas as configurações.");
      return;
    }

    // Validação da Tabela C (opcional)
    if (activeTask.fileC && (!activeTask.keyA_C || !activeTask.keyC || activeTask.selectedColsC.length === 0)) {
      setError("Por favor, preencha as configurações da Tabela C.");
      return;
    }

    // VLOOKUP Constraint Check
    if (activeTask.lookupType === 'vlookup') {
      const keyIndex = headersB.indexOf(activeTask.keyB);
      const invalidCols = activeTask.selectedColsB.filter(col => headersB.indexOf(col) < keyIndex);
      if (invalidCols.length > 0) {
        setError(`No modo PROCV, as colunas de retorno devem estar à direita da coluna chave (${activeTask.keyB}).`);
        return;
      }
    }

    const dataA = activeTask.fileA.sheets[activeTask.fileA.selectedSheet];
    const dataB = activeTask.fileB.sheets[activeTask.fileB.selectedSheet];

    if (!dataA || !dataB) {
      setError("Erro ao acessar os dados das planilhas. Verifique se as planilhas selecionadas contêm dados.");
      return;
    }

    setLoading(true);

    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl);

    /**
     * Callback acionado quando o Worker termina o processamento com sucesso.
     */
    worker.onmessage = (e) => {
      if (e.data.error) {
        setError(e.data.error);
        setLoading(false);
        worker.terminate();
        return;
      }
      const resultData = e.data;
      const firstRow = resultData[0] || {};
      const columnSettings = Object.keys(firstRow).map(key => ({
        id: key,
        visible: !key.startsWith('_'), // Hide internal columns starting with _
        pinned: false
      }));
      const keyA = activeTask.keyA;
      const defaultDupCol =
        keyA && Object.prototype.hasOwnProperty.call(firstRow, keyA)
          ? keyA
          : Object.keys(firstRow).find(k => !k.startsWith('_')) ?? '';
      updateActiveTask({
        resultData,
        columnSettings,
        duplicateKeyFilterEnabled: false,
        duplicateKeyColumnId: defaultDupCol,
      });
      setStep('result');
      setLoading(false);
      worker.terminate();
    };

    /**
     * Callback acionado em caso de erro dentro do Worker.
     */
    worker.onerror = (err) => {
      console.error("Worker error:", err);
      setError("Erro durante o processamento em segundo plano.");
      setLoading(false);
      worker.terminate();
    };

    worker.postMessage({
      dataA,
      dataB,
      keyA: activeTask.keyA,
      keyB: activeTask.keyB,
      selectedColsA: activeTask.selectedColsA,
      selectedColsB: activeTask.selectedColsB,
      dataC: activeTask.fileC ? activeTask.fileC.sheets[activeTask.fileC.selectedSheet] : null,
      keyA_C: activeTask.keyA_C,
      keyC: activeTask.keyC,
      selectedColsC: activeTask.selectedColsC,
      exactMatch: activeTask.exactMatch,
      trimSpaces: activeTask.trimSpaces,
      ignoreCase: activeTask.ignoreCase,
      removeSpecialChars: activeTask.removeSpecialChars,
      duplicateStrategy: activeTask.duplicateStrategy,
      fuzzyThreshold: activeTask.fuzzyThreshold,
      ifNotFound: activeTask.ifNotFound,
      ifNotFoundC: activeTask.ifNotFoundC,
      matchMode: activeTask.matchMode,
      searchDirection: activeTask.searchDirection,
      includeStatusCols: activeTask.includeStatusCols
    });
  };

  /**
   * Tenta detectar automaticamente as colunas de chave e de retorno baseando-se em nomes comuns.
   */
  const autoDetectConfig = () => {
    if (!headersA.length || !headersB.length) return;
    const { keyA, keyB, selectedColsB } = computeAutoDetectLookup(headersA, headersB);
    const updates: Partial<LookupTask> = {};
    if (keyA && keyB) {
      updates.keyA = keyA;
      updates.keyB = keyB;
    }
    if (selectedColsB.length > 0) {
      updates.selectedColsB = selectedColsB;
    }
    if (Object.keys(updates).length > 0) {
      updateActiveTask(updates);
    }
  };

  /**
   * Gera um arquivo Excel com os resultados do cruzamento e inicia o download.
   */
  const downloadResult = () => {
    if (!filteredResultData || filteredResultData.length === 0) return;

    const exportData = buildResultExportRows(
      activeTask.columnSettings,
      filteredResultData as Record<string, unknown>[]
    );
    const visibleCols = getResultExportVisibleColumnIds(activeTask.columnSettings);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const widthById = new Map<string, number>(
      activeTask.columnSettings.map((c): [string, number] => [c.id, getResultColWidthPx(c)])
    );
    const sheet = ws as import('xlsx').WorkSheet;
    sheet['!cols'] = visibleCols.map((colId) => {
      const px = widthById.get(colId) ?? DEFAULT_RESULT_COL_WIDTH_PX;
      return { wch: Math.max(8, Math.min(60, Math.round(px / 7))) };
    });
    const wb = XLSX.utils.book_new();
    const fileName = `${resultExportBaseFileName(activeTask)}.xlsx`;
    XLSX.utils.book_append_sheet(wb, ws, 'Resultado');
    XLSX.writeFile(wb, fileName);
  };

  const downloadResultJson = () => {
    if (!filteredResultData || filteredResultData.length === 0) return;
    const exportData = buildResultExportRowsForJson(
      activeTask.columnSettings,
      filteredResultData as Record<string, unknown>[]
    );
    downloadJsonFile(exportData, `${resultExportBaseFileName(activeTask)}.json`);
  };

  /**
   * Move uma coluna para cima ou para baixo na ordem de exibição.
   * @param index Índice atual da coluna.
   * @param direction Direção do movimento ('up' ou 'down').
   */
  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newSettings = [...activeTask.columnSettings];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSettings.length) return;
    [newSettings[index], newSettings[targetIndex]] = [newSettings[targetIndex], newSettings[index]];
    updateActiveTask({ columnSettings: newSettings });
  };

  /**
   * Alterna a visibilidade de uma coluna.
   * @param id ID da coluna.
   */
  const toggleColumnVisibility = (id: string) => {
    const newSettings = activeTask.columnSettings.map(c => 
      c.id === id ? { ...c, visible: !c.visible } : c
    );
    updateActiveTask({ columnSettings: newSettings });
  };

  /**
   * Alterna o estado de fixação (pin) de uma coluna.
   * @param id ID da coluna.
   */
  const toggleColumnPin = (id: string) => {
    const newSettings = activeTask.columnSettings.map(c => 
      c.id === id ? { ...c, pinned: !c.pinned } : c
    );
    updateActiveTask({ columnSettings: newSettings });
  };

  /**
   * Reinicia todo o estado da aplicação para o padrão inicial.
   */
  const reset = () => {
    const freshTask: LookupTask = {
      id: Math.random().toString(36).substring(2, 11),
      name: 'Operação 1',
      fileA: null,
      fileB: null,
      keyA: '',
      keyB: '',
      selectedColsA: [],
      selectedColsB: [],
      fileC: null,
      keyA_C: '',
      keyC: '',
      selectedColsC: [],
      lookupType: 'xlookup',
      exactMatch: true,
      trimSpaces: true,
      ignoreCase: true,
      removeSpecialChars: false,
      duplicateStrategy: 'first',
      fuzzyThreshold: 0.8,
      ifNotFound: '#N/D',
      ifNotFoundC: '#N/D',
      matchMode: 0,
      searchDirection: 1,
      includeStatusCols: true,
      resultData: null,
      resultFilter: 'all',
      duplicateKeyFilterEnabled: false,
      duplicateKeyColumnId: '',
      divergentPairs: [],
      showAdvanced: false,
      columnSettings: [],
    };
    setTasks([freshTask]);
    setActiveTaskId(freshTask.id);
    setStep('upload');
    setConfigTab('keys');
    setColumnFilters({});
  };

  return (
    <div
      className={cn(
        'min-h-dvh relative transition-colors duration-700 selection:bg-blue-500/30',
        step === 'upload' || step === 'configure'
          ? 'bg-[#131313] text-[#e5e2e1]'
          : isDarkMode
            ? 'bg-[#0a0a0a] text-zinc-100'
            : 'bg-[#f3f3f3] text-zinc-900'
      )}
    >
      {step === 'upload' && (
        <>
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <div
              className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(37,99,235,0.15)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(87,27,193,0.15)_0px,transparent_50%)]"
              aria-hidden
            />
            <div
              className="fixed top-1/4 -right-64 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px]"
              aria-hidden
            />
            <div
              className="fixed bottom-1/4 -left-64 w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[100px]"
              aria-hidden
            />
          </div>
          <nav className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-white/5 bg-[#1c1b1b]/80 px-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:px-8">
            <span className="font-jakarta text-lg font-bold tracking-tight text-white">
              Assistente de Cruzamento
            </span>
            <div className="hidden items-center gap-8 md:flex">
              <LandingStepStrip currentStep={step} />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="rounded-full p-2 text-[#c3c6d7] transition-all hover:bg-white/10 hover:text-white active:scale-95"
                aria-label={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
                title={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-full p-2 text-[#c3c6d7] transition-all hover:bg-white/10 hover:text-white active:scale-95"
                aria-label="Reiniciar"
                title="Reiniciar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-b from-white/5 to-transparent" />
          </nav>
          <div className="md:hidden fixed top-16 left-0 right-0 z-40 flex justify-center border-b border-white/5 bg-[#1c1b1b]/90 px-2 py-2 backdrop-blur-xl">
            <LandingStepStrip currentStep={step} compact />
          </div>
          <main className="relative z-10 mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-4 pb-10 pt-28 md:pt-20">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-6"
            >
              <header className="flex flex-col items-center gap-2 text-center">
                <h1 className="font-jakarta text-4xl font-extrabold tracking-tighter text-white md:text-5xl">
                  Inicie seu{' '}
                  <span className="bg-gradient-to-r from-[#b4c5ff] to-[#d0bcff] bg-clip-text text-transparent">
                    Cruzamento
                  </span>
                </h1>
                <p className="max-w-lg text-base font-light leading-relaxed text-[#c3c6d7]">
                  Importe suas planilhas para o mapeamento de dados com precisão atmosférica.
                </p>
              </header>
              <UploadHowItWorksDetails />
              <section className="mx-auto w-full max-w-xl upload-mica upload-ghost-border flex flex-col gap-4 rounded-2xl p-6 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                <UploadCard
                  variant="landing"
                  landingAccent="blue"
                  title="1. Tabela Principal (Base)"
                  description="Tabela que receberá os novos dados cruzados."
                  file={activeTask.fileA}
                  onUpload={(e) => handleFileUpload(e, 'A')}
                  onRemove={() => updateActiveTask({ fileA: null })}
                  onSheetChange={(sheetName) =>
                    updateActiveTask({
                      fileA: activeTask.fileA ? { ...activeTask.fileA, selectedSheet: sheetName } : null,
                    })
                  }
                  onRename={(newName) =>
                    updateActiveTask({
                      fileA: activeTask.fileA ? { ...activeTask.fileA, name: newName } : null,
                    })
                  }
                  onPaste={() => handlePasteData('A')}
                />
                <UploadCard
                  variant="landing"
                  landingAccent="violet"
                  title="2. Tabela de Busca (Fonte)"
                  description="Fonte de onde os dados serão extraídos."
                  file={activeTask.fileB}
                  onUpload={(e) => handleFileUpload(e, 'B')}
                  onRemove={() => updateActiveTask({ fileB: null })}
                  onSheetChange={(sheetName) =>
                    updateActiveTask({
                      fileB: activeTask.fileB ? { ...activeTask.fileB, selectedSheet: sheetName } : null,
                    })
                  }
                  onRename={(newName) =>
                    updateActiveTask({
                      fileB: activeTask.fileB ? { ...activeTask.fileB, name: newName } : null,
                    })
                  }
                  onPaste={() => handlePasteData('B')}
                />
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveTask({
                        fileC: activeTask.fileC ? null : { name: '', sheets: {}, selectedSheet: '' },
                      })
                    }
                    className={cn(
                      'flex min-h-[44px] items-center gap-2 rounded-full border border-dashed px-4 py-2 text-[11px] font-medium uppercase tracking-wide transition-all',
                      activeTask.fileC
                        ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
                        : 'border-[#434655]/40 text-[#c3c6d7] hover:border-white/20 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    {activeTask.fileC ? <X size={14} /> : <Plus size={14} />}
                    {activeTask.fileC ? 'Remover Tabela C' : 'Adicionar Tabela C (Opcional)'}
                  </button>
                </div>
                {activeTask.fileC && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full"
                  >
                    <UploadCard
                      variant="landing"
                      landingAccent="violet"
                      title="3. Tabela de Busca Extra"
                      description="Use esta opção se precisar buscar dados em mais um arquivo."
                      file={activeTask.fileC}
                      onUpload={(e) => handleFileUpload(e, 'C')}
                      onRemove={() => updateActiveTask({ fileC: null })}
                      onSheetChange={(sheetName) =>
                        updateActiveTask({
                          fileC: activeTask.fileC
                            ? { ...activeTask.fileC, selectedSheet: sheetName }
                            : null,
                        })
                      }
                      onRename={(newName) =>
                        updateActiveTask({
                          fileC: activeTask.fileC ? { ...activeTask.fileC, name: newName } : null,
                        })
                      }
                      onPaste={() => handlePasteData('C')}
                    />
                  </motion.div>
                )}
              </section>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[#c3c6d7]">
                {[activeTask.fileA, activeTask.fileB].map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        'h-2.5 w-2.5 rounded-full transition-all',
                        f ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-white/15'
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs font-bold sm:text-sm',
                        f ? 'text-blue-300' : 'text-[#8d90a0]'
                      )}
                    >
                      {i === 0 ? 'Tabela A' : 'Tabela B'}
                    </span>
                  </div>
                ))}
                <span className="text-xs font-medium text-[#8d90a0] sm:text-sm">
                  — {[activeTask.fileA, activeTask.fileB].filter(Boolean).length} de 2 arquivos prontos
                </span>
              </div>
              <footer className="mt-1 flex flex-col items-center gap-4">
                <button
                  type="button"
                  disabled={!activeTask.fileA || !activeTask.fileB}
                  onClick={() => setStep('configure')}
                  className="group relative flex min-h-[48px] items-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-[#2563eb] to-[#571bc1] px-10 py-4 font-jakarta text-base font-extrabold text-white shadow-[0_15px_30px_rgba(37,99,235,0.25)] transition-all hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100"
                >
                  <div className="pointer-events-none absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="relative">Continuar para Configuração</span>
                  <ArrowRight size={20} className="relative shrink-0" />
                </button>
                <p className="font-jakarta text-[10px] uppercase tracking-[0.12em] text-[#8d90a0]">
                  Formatos: .xlsx, .xls, .csv, .tsv, .ods (até 50MB)
                </p>
                <p className="max-w-md px-2 text-center text-xs text-[#8d90a0]">
                  {!activeTask.fileA || !activeTask.fileB
                    ? 'Carregue as duas primeiras planilhas para continuar.'
                    : 'Próximo passo: escolher como ligar as colunas.'}
                </p>
              </footer>
            </motion.div>
          </main>
        </>
      )}

      {step === 'configure' && (
        <ConfigureStepShell
          onBack={() => setStep('upload')}
          onNext={() => setConfigTab(configTab === 'keys' ? 'columns' : 'advanced')}
          showNext={configTab !== 'advanced'}
          onExecute={performLookup}
          executeDisabled={!validation.isValid || loading}
          executeLoading={loading}
          isDarkMode={isDarkMode}
          onToggleDark={() => setIsDarkMode(!isDarkMode)}
          onReset={reset}
          onGoUpload={() => setStep('upload')}
          onNavTables={() => setConfigTab('columns')}
          onNavMapping={() => setConfigTab('keys')}
        >
          <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-40 pt-24 sm:px-8">
            <div className="mx-auto flex w-full max-w-2xl justify-center">
              <ConfigureWizardStepper />
            </div>
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              <div className="flex flex-col gap-8 lg:col-span-8">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div
                    className="rounded-2xl border border-[#434655]/15 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl"
                    style={{ background: 'rgba(28, 27, 27, 0.6)' }}
                  >
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div
                        className="flex w-fit gap-1 rounded-full border border-[#434655]/10 bg-[#0e0e0e] p-1"
                        style={{ scrollbarWidth: 'none' }}
                      >
                        {(
                          [
                            { id: 'keys' as const, label: 'Conexão' },
                            { id: 'columns' as const, label: 'Colunas a Trazer' },
                            { id: 'advanced' as const, label: 'Opções Extras' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setConfigTab(tab.id)}
                            className={cn(
                              'rounded-full px-5 py-2 text-sm font-medium transition-all',
                              configTab === tab.id
                                ? 'bg-[#2a2a2a] text-[#b4c5ff]'
                                : 'text-[#8d90a0] hover:text-[#e5e2e1]'
                            )}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={autoDetectConfig}
                        className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#434655]/25 px-4 py-2 text-xs font-bold text-[#b4c5ff] transition-all hover:bg-white/5"
                      >
                        <Sparkles size={16} className="shrink-0" aria-hidden />
                        Configuração automática
                      </button>
                    </div>

                    <ConfigureTabPanels
                      configTab={configTab}
                      activeTask={activeTask}
                      onTaskPatch={updateActiveTask}
                      headersA={headersA}
                      headersB={headersB}
                      headersC={headersC}
                      metrics={configureKeyMetrics}
                    />
                  </div>

                  {!validation.isValid && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-4 rounded-xl border border-[#ffb4ab]/20 p-6 backdrop-blur-xl"
                      style={{ background: 'rgba(147, 0, 10, 0.1)' }}
                    >
                      <div className="shrink-0 rounded-full bg-[#93000a] p-2">
                        <AlertCircle className="h-5 w-5 text-[#ffdad6]" />
                      </div>
                      <div>
                        <h4 className="font-jakarta text-base font-bold text-[#ffb4ab]">
                          Atenção: configuração pendente
                        </h4>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[#c3c6d7]">
                          {validation.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </div>

              <div className="flex flex-col gap-8 lg:col-span-4">
                <ConfigureAiAssistant
                  variant="bento"
                  fileA={activeTask.fileA}
                  fileB={activeTask.fileB}
                  fileC={activeTask.fileC}
                  headersA={headersA}
                  headersB={headersB}
                  headersC={headersC}
                  onApply={(patch) => updateActiveTask(patch)}
                />
                <div
                  className="rounded-xl border border-[#434655]/15 p-6 backdrop-blur-xl"
                  style={{ background: 'rgba(28, 27, 27, 0.6)' }}
                >
                  <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-[#8d90a0]">
                    Amostra de dados
                  </h4>
                  <div className="relative aspect-video overflow-hidden rounded-lg border border-[#434655]/10 bg-[#1c1b1b]">
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{
                        background:
                          'radial-gradient(circle at 30% 40%, rgba(37,99,235,0.35), transparent 50%), radial-gradient(circle at 70% 60%, rgba(87,27,193,0.3), transparent 45%)',
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1c1b1b] to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="mb-1 text-[10px] text-[#b4c5ff]">
                        {activeTask.fileA?.name ?? 'Tabela principal'}
                      </p>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-[#2563eb] transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.round((validation.isValid ? 1 : 0.4) * 100 + (activeTask.keyA && activeTask.keyB ? 25 : 0) + (activeTask.selectedColsB.length ? 25 : 0)))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </ConfigureStepShell>
      )}

      {step === 'result' && (
      <>
      {/* Windows 12 Bloom Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] rounded-full bg-blue-600/20 blur-[120px] animate-bloom" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-purple-600/20 blur-[120px] animate-bloom [animation-delay:4s]" />
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/15 blur-[100px] animate-bloom [animation-delay:8s]" />
        <div className="absolute bottom-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/15 blur-[100px] animate-bloom [animation-delay:12s]" />
        
        {/* Dynamic Mesh Gradients */}
        <div className="absolute inset-0 opacity-30 dark:opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-[100px] animate-pulse-glow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400 rounded-full blur-[100px] animate-pulse-glow [animation-delay:2s]" />
        </div>

        <div className="absolute inset-0 bg-white/10 dark:bg-black/20 backdrop-blur-[1px]" />
      </div>

      {/* Main Window Container */}
      <div className="relative z-10 min-h-dvh flex flex-col p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 pb-safe">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="windows-window flex flex-col w-full max-w-[1920px] mx-auto flex-1 min-h-0"
        >
          {/* App Header (Inside Window) */}
          <header className="bg-white/5 dark:bg-zinc-900/5 border-b border-white/10 dark:border-white/5">
            {/* Linha principal: logo + stepindicator (md+) + botões */}
            <div className="py-3 sm:py-4 flex items-center justify-between px-4 sm:px-6 md:px-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                  <Layers size={16} className="text-white" />
                </div>
                <div>
                  <h1 className="text-base sm:text-xl md:text-2xl font-black tracking-tighter bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent whitespace-nowrap">
                    Assistente de Cruzamento (Lookup)
                  </h1>
                </div>
              </div>

              {/* StepIndicator visível apenas em sm+ no header */}
              <div className="hidden sm:block">
                <StepIndicator currentStep={step} />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-90"
                    aria-label={isDarkMode ? "Ativar tema claro" : "Ativar tema escuro"}
                    title={isDarkMode ? "Ativar tema claro" : "Ativar tema escuro"}
                  >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                  <button 
                    onClick={reset}
                    className="p-2.5 rounded-xl hover:bg-red-500/10 transition-all text-zinc-500 dark:text-zinc-400 hover:text-red-500 active:scale-90"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* StepIndicator em linha separada apenas em mobile */}
            <div className="sm:hidden px-4 pb-3">
              <StepIndicator currentStep={step} />
            </div>
          </header>

          {/* Main Content Area — flex-1 para o passo Resultado preencher altura útil */}
          <div className="flex flex-1 flex-col min-h-0 p-3 sm:p-4 md:p-5 lg:px-6 xl:px-8 pb-safe">
            <div className="flex flex-1 flex-col min-h-0">
              <AnimatePresence mode="wait">
                {activeTask.resultData && stats && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex min-h-0 w-full max-w-none flex-1 flex-col gap-3 sm:gap-4"
                  >
              {/* Dashboard Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                {[
                  { label: "Total Processado", value: stats.total, icon: Database, color: "text-blue-400", bg: "bg-blue-500/10" },
                  { label: "Correspondências", value: stats.matched, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { label: "Não Encontrados", value: stats.orphans, icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10" },
                  { label: "Taxa de Sucesso", value: `${stats.rate.toFixed(1)}%`, icon: Activity, color: "text-violet-400", bg: "bg-violet-500/10" },
                ].map((stat, i) => (
                  <div key={i} className="fluent-card p-3 sm:p-4 flex flex-row sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5">
                    <div className={cn("p-2 rounded-xl shrink-0", stat.bg)}>
                      <stat.icon className={stat.color} size={18} />
                    </div>
                    <div className="flex flex-col sm:items-center w-full">
                      <span className="text-lg sm:text-xl font-black leading-tight">{stat.value}</span>
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider leading-tight">{stat.label}</span>
                      {i === 3 && (
                        <div className="w-full h-1 rounded-full bg-violet-500/20 mt-2">
                          <div
                            className="h-1 rounded-full bg-violet-500 transition-all duration-700"
                            style={{ width: `${Math.min(stats.rate, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="fluent-card overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-3 sm:p-4 border-b dark:border-white/5 border-black/10 space-y-2 shrink-0">
                  {/* Linha principal: filtros + ações */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    {/* Título + tabs de filtro com scroll horizontal em mobile */}
                    <div className="flex flex-col gap-2 min-w-0">
                      <div className="flex items-center justify-between sm:justify-start gap-2">
                        <h2 className="text-lg sm:text-xl font-black tracking-tight shrink-0">Resultados</h2>
                        {/* Botões de ação — visíveis somente em mobile aqui */}
                        <div className="flex items-center gap-1.5 sm:hidden shrink-0">
                          {(columnFilterValueSets(columnFilters).some(s => s.size > 0) ||
                            activeTask.duplicateKeyFilterEnabled) && (
                            <button
                              onClick={() => {
                                setColumnFilters({});
                                updateActiveTask({ duplicateKeyFilterEnabled: false });
                              }}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-all active:scale-95"
                              aria-label="Limpar filtros de colunas"
                              title="Limpar filtros"
                            >
                              <X size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => setStep('configure')}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 border dark:border-white/10 border-black/10 transition-all active:scale-95"
                            aria-label="Editar configurações"
                            title="Editar configurações"
                          >
                            <Settings2 size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPivotModal(true)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/25 transition-all active:scale-95"
                            aria-label="Tabela dinâmica"
                            title="Tabela dinâmica"
                          >
                            <TableProperties size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={downloadResult}
                            className="fluent-button-primary min-h-[44px] px-3 py-2 text-xs flex items-center gap-1.5"
                            aria-label="Baixar resultado em Excel"
                            title="Baixar Excel"
                          >
                            <Download size={16} />
                            <span className="font-bold">Excel</span>
                          </button>
                          <button
                            type="button"
                            onClick={downloadResultJson}
                            className="min-h-[44px] px-3 py-2 text-xs font-bold flex items-center gap-1.5 rounded-xl border dark:border-white/10 border-black/10 text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95"
                            aria-label="Baixar resultado em JSON"
                            title="Baixar JSON"
                          >
                            <FileJson size={16} />
                            <span>JSON</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5" style={{ scrollbarWidth: 'none' }}>
                        <div className="flex p-1 dark:bg-white/5 bg-black/5 rounded-xl gap-1 border dark:border-white/5 border-black/10 shrink-0">
                          {([
                            { id: 'all' as const, label: 'Todos', icon: Layers },
                            { id: 'matched' as const, label: 'Encontrados', icon: CheckCircle2 },
                            { id: 'orphans' as const, label: 'Órfãos', icon: AlertCircle },
                            { id: 'divergent' as const, label: 'Divergentes', icon: ArrowUpDown },
                          ] satisfies { id: LookupTask['resultFilter']; label: string; icon: LucideIcon }[]).map(f => (
                            <button
                              key={f.id}
                              onClick={() => updateActiveTask({ resultFilter: f.id })}
                              className={cn(
                                "flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                                activeTask.resultFilter === f.id && f.id === 'divergent'
                                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                                  : activeTask.resultFilter === f.id
                                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                  : "text-zinc-500 dark:hover:text-zinc-200 hover:text-zinc-800"
                              )}
                            >
                              <f.icon size={14} className="shrink-0" />{' '}
                              <span className="text-[11px] sm:text-xs">{f.label}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowDivergentConfig(v => !v)}
                          className={cn(
                            "flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all border whitespace-nowrap shrink-0",
                            showDivergentConfig
                              ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                              : activeTask.divergentPairs.length > 0
                              ? "text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                              : "text-zinc-500 dark:border-white/10 border-black/10 dark:hover:bg-white/5 hover:bg-black/5 dark:hover:text-zinc-200 hover:text-zinc-800"
                          )}
                          title="Configurar pares de divergência"
                        >
                          <Settings2 size={13} />
                          {activeTask.divergentPairs.length > 0 ? `${activeTask.divergentPairs.length} par(es)` : 'Pares'}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = !activeTask.duplicateKeyFilterEnabled;
                            if (next) {
                              const eligible = activeTask.columnSettings.filter(c => !c.id.startsWith('_'));
                              const ids = new Set(eligible.map(c => c.id));
                              let col = activeTask.duplicateKeyColumnId;
                              if (!col || !ids.has(col)) {
                                col = ids.has(activeTask.keyA) ? activeTask.keyA : eligible[0]?.id ?? '';
                              }
                              updateActiveTask({
                                duplicateKeyFilterEnabled: true,
                                duplicateKeyColumnId: col,
                              });
                            } else {
                              updateActiveTask({ duplicateKeyFilterEnabled: false });
                            }
                          }}
                          className={cn(
                            'flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg text-xs font-bold transition-all border whitespace-nowrap shrink-0',
                            activeTask.duplicateKeyFilterEnabled
                              ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25 border-violet-500/40'
                              : 'text-zinc-500 dark:border-white/10 border-black/10 dark:hover:bg-white/5 hover:bg-black/5 dark:hover:text-zinc-200 hover:text-zinc-800'
                          )}
                          title="Mostrar só linhas em que o valor da coluna escolhida se repete (ex.: mesmo CPF em guias diferentes)"
                        >
                          <Users size={14} className="shrink-0" />
                          <span className="text-[11px] sm:text-xs">Duplicados</span>
                        </button>
                        <select
                          aria-label="Coluna para detectar duplicados"
                          disabled={!activeTask.duplicateKeyFilterEnabled}
                          value={activeTask.duplicateKeyColumnId}
                          onChange={(e) => updateActiveTask({ duplicateKeyColumnId: e.target.value })}
                          className={cn(
                            'min-h-[40px] max-w-[min(100%,240px)] rounded-lg border px-2 py-1.5 text-xs font-bold outline-none focus:border-violet-500',
                            activeTask.duplicateKeyFilterEnabled
                              ? 'border-violet-500/40 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                              : 'border-black/10 dark:border-white/10 opacity-50 cursor-not-allowed bg-black/5 dark:bg-white/5'
                          )}
                        >
                          {activeTask.columnSettings
                            .filter(c => !c.id.startsWith('_'))
                            .map(c => (
                              <option key={c.id} value={c.id}>
                                {c.id}
                              </option>
                            ))}
                        </select>
                        {activeTask.duplicateKeyFilterEnabled && (
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 max-w-sm leading-snug">
                            Mesma normalização da busca (espaços, maiúsculas, especiais). Para igualar CPF com e sem
                            pontuação, ative &quot;Remover caracteres especiais&quot; em Ajustes finos.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Direita: botões de ação — ocultos em mobile (exibidos acima) */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {(columnFilterValueSets(columnFilters).some(s => s.size > 0) ||
                        activeTask.duplicateKeyFilterEnabled) && (
                        <button
                          onClick={() => {
                            setColumnFilters({});
                            updateActiveTask({ duplicateKeyFilterEnabled: false });
                          }}
                          className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-all active:scale-95"
                        >
                          <X size={13} /> Limpar Filtros
                        </button>
                      )}
                      <button
                        onClick={() => setStep('configure')}
                        className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-500 dark:hover:text-zinc-100 hover:text-zinc-900 dark:hover:bg-white/5 hover:bg-black/5 border dark:border-white/10 border-black/10 transition-all active:scale-95"
                      >
                        <Settings2 size={14} /> Editar Config.
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPivotModal(true)}
                        className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/25 transition-all active:scale-95"
                      >
                        <TableProperties size={14} /> Tabela dinâmica
                      </button>
                      <button
                        type="button"
                        onClick={downloadResult}
                        className="fluent-button-primary min-h-[44px] px-4 py-2 text-xs flex items-center gap-1.5"
                      >
                        <Download size={14} /> Baixar Excel
                      </button>
                      <button
                        type="button"
                        onClick={downloadResultJson}
                        className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 border dark:border-white/10 border-black/10 hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95"
                        aria-label="Baixar resultado em JSON"
                        title="Baixar JSON"
                      >
                        <FileJson size={14} /> Baixar JSON
                      </button>
                    </div>
                  </div>

                  {/* Painel de configuração de pares — linha separada */}
                  {showDivergentConfig && (
                    <div className="pt-2 border-t dark:border-white/5 border-black/10 space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Pares de colunas para comparação de divergências
                      </p>
                      {activeTask.divergentPairs.map((pair, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={pair.colA}
                            onChange={e => {
                              const updated = [...activeTask.divergentPairs];
                              updated[idx] = { ...updated[idx], colA: e.target.value };
                              updateActiveTask({ divergentPairs: updated });
                            }}
                            className="fluent-select flex-1 py-1.5 text-xs"
                          >
                            <option value="">Coluna original (A)...</option>
                            {activeTask.resultData && activeTask.resultData[0] &&
                              Object.keys(activeTask.resultData[0])
                                .filter(k => !k.startsWith('_') && !k.startsWith('Lookup') && !k.startsWith('Status_'))
                                .map(k => <option key={k} value={k}>{k}</option>)
                            }
                          </select>
                          <span className="text-zinc-500 text-xs font-bold shrink-0">↔</span>
                          <select
                            value={pair.colLookup}
                            onChange={e => {
                              const updated = [...activeTask.divergentPairs];
                              updated[idx] = { ...updated[idx], colLookup: e.target.value };
                              updateActiveTask({ divergentPairs: updated });
                            }}
                            className="fluent-select flex-1 py-1.5 text-xs"
                          >
                            <option value="">Coluna lookup...</option>
                            {activeTask.resultData && activeTask.resultData[0] &&
                              Object.keys(activeTask.resultData[0])
                                .filter(k => k.startsWith('Lookup_') || k.startsWith('LookupC_'))
                                .map(k => <option key={k} value={k}>{k}</option>)
                            }
                          </select>
                          <button
                            onClick={() => updateActiveTask({ divergentPairs: activeTask.divergentPairs.filter((_, i) => i !== idx) })}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                            aria-label="Remover par"
                            title="Remover par"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => updateActiveTask({ divergentPairs: [...activeTask.divergentPairs, { colA: '', colLookup: '' }] })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-400 hover:bg-orange-500/10 border border-orange-500/20 transition-all"
                      >
                        <Plus size={13} /> Adicionar par
                      </button>
                    </div>
                  )}
                </div>

                {/* Dica de scroll horizontal — visível apenas em mobile */}
                <div className="sm:hidden flex items-center justify-center gap-2 py-2 px-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium text-center shrink-0">
                  <ChevronRight size={14} className="rotate-180 opacity-60 shrink-0" aria-hidden />
                  <span>Deslize para os lados para ver mais colunas</span>
                  <ChevronRight size={14} className="opacity-60 shrink-0" aria-hidden />
                </div>

                <div
                  className={cn(
                    'flex-1 min-h-0 overflow-auto rounded-[32px] border dark:border-white/10 border-black/10 dark:bg-black/40 bg-white/60 shadow-inner backdrop-blur-xl custom-scrollbar',
                    columnResizePreview && 'select-none'
                  )}
                >
                  <table className="w-full min-w-[600px] table-fixed text-left border-collapse">
                    <colgroup>
                      <col style={{ width: RESULT_INDEX_COL_WIDTH_PX, minWidth: RESULT_INDEX_COL_WIDTH_PX }} />
                      {tableDisplayColumns.map(col => {
                        const w = getResultColDisplayWidthPx(col);
                        return <col key={col.id} style={{ width: w, minWidth: w }} />;
                      })}
                    </colgroup>
                    <thead className="sticky top-0 z-20">
                      <tr className="dark:bg-zinc-900/90 bg-zinc-50/95 backdrop-blur-2xl">
                        <th
                          className="px-3 py-4 text-xs font-black uppercase tracking-wider text-zinc-400 text-center sticky left-0 z-30 dark:bg-zinc-900/95 bg-zinc-50/95 backdrop-blur-xl shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]"
                          style={{ width: RESULT_INDEX_COL_WIDTH_PX, minWidth: RESULT_INDEX_COL_WIDTH_PX }}
                        >
                          #
                        </th>
                        {tableDisplayColumns.map((col, colIdx) => (
                          <th
                            key={col.id}
                            style={{
                              width: getResultColDisplayWidthPx(col),
                              minWidth: getResultColDisplayWidthPx(col),
                            }}
                            className={cn(
                            "group/header px-4 sm:px-6 py-4 text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]",
                            col.id.startsWith('Lookup_') ? "text-blue-500 bg-blue-400/5" : 
                            col.id.startsWith('LookupC_') ? "text-purple-500 bg-purple-400/5" :
                            col.id.startsWith('Status_') ? "text-emerald-500 bg-emerald-400/5" :
                            "dark:text-zinc-500 text-zinc-600",
                            pairHighlightClasses(col.id, pairColumnMeta)
                          )}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="flex shrink-0 items-center gap-0.5 opacity-40 transition-opacity group-hover/header:opacity-100">
                                <button
                                  type="button"
                                  disabled={colIdx === 0}
                                  aria-label={`Mover coluna ${col.id} para a esquerda`}
                                  title="Mover coluna para a esquerda"
                                  className={cn(
                                    'p-0.5 rounded-md border dark:border-white/10 border-black/10',
                                    'dark:bg-white/[0.06] bg-black/[0.04] dark:hover:bg-white/10 hover:bg-black/10',
                                    'text-zinc-500 dark:text-zinc-400 disabled:opacity-20 disabled:pointer-events-none'
                                  )}
                                  onClick={e => {
                                    e.stopPropagation();
                                    moveTableDisplayColumn(col.id, 'left');
                                  }}
                                >
                                  <ChevronLeft size={12} strokeWidth={2.5} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  disabled={colIdx >= tableDisplayColumns.length - 1}
                                  aria-label={`Mover coluna ${col.id} para a direita`}
                                  title="Mover coluna para a direita"
                                  className={cn(
                                    'p-0.5 rounded-md border dark:border-white/10 border-black/10',
                                    'dark:bg-white/[0.06] bg-black/[0.04] dark:hover:bg-white/10 hover:bg-black/10',
                                    'text-zinc-500 dark:text-zinc-400 disabled:opacity-20 disabled:pointer-events-none'
                                  )}
                                  onClick={e => {
                                    e.stopPropagation();
                                    moveTableDisplayColumn(col.id, 'right');
                                  }}
                                >
                                  <ChevronRight size={12} strokeWidth={2.5} aria-hidden />
                                </button>
                              </div>
                              <span className="truncate max-w-[min(9rem,42vw)] sm:max-w-[min(11rem,28vw)] lg:max-w-[min(14rem,20vw)] xl:max-w-xs" title={col.id}>
                                {col.id.startsWith('Lookup_') ? col.id.replace('Lookup_', '') : 
                                 col.id.startsWith('LookupC_') ? col.id.replace('LookupC_', '') : 
                                 col.id.startsWith('Status_') ? (col.id === 'Status_B' ? 'Enc. em B' : col.id === 'Status_C' ? 'Enc. em C' : 'Enc. em Ambos') :
                                 col.id}
                              </span>
                              {sortConfig?.colId === col.id && (
                                sortConfig.direction === 'asc' ? <SortAsc size={12} className="text-blue-500" /> : <SortDesc size={12} className="text-blue-500" />
                              )}
                              {col.id.startsWith('Lookup_') && <span className="px-1.5 py-0.5 rounded text-[10px] leading-tight bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold">FONTE B</span>}
                              {col.id.startsWith('LookupC_') && <span className="px-1.5 py-0.5 rounded text-[10px] leading-tight bg-purple-500/10 text-purple-500 border border-purple-500/20 font-bold">FONTE C</span>}
                              {col.id.startsWith('Status_') && <span className="px-1.5 py-0.5 rounded text-[10px] leading-tight bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">STATUS</span>}
                              {!col.id.startsWith('Lookup') && !col.id.startsWith('Status_') && <span className="px-1.5 py-0.5 rounded text-[10px] leading-tight bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 font-bold">BASE</span>}
                            </div>
                          </th>
                        ))}
                      </tr>
                      <tr className="dark:bg-zinc-900/80 bg-zinc-50/80 border-b dark:border-white/10 border-black/10">
                        <th
                          className="sticky left-0 z-30 dark:bg-zinc-900/90 bg-zinc-50/90 backdrop-blur-xl shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]"
                          style={{ width: RESULT_INDEX_COL_WIDTH_PX, minWidth: RESULT_INDEX_COL_WIDTH_PX }}
                        />
                        {tableDisplayColumns.map(col => (
                          <th
                            key={col.id}
                            style={{
                              width: getResultColDisplayWidthPx(col),
                              minWidth: getResultColDisplayWidthPx(col),
                            }}
                            className={cn(
                            "px-2 sm:px-3 py-2 relative",
                            col.id.startsWith('Lookup_') ? "bg-blue-400/5" :
                            col.id.startsWith('LookupC_') ? "bg-purple-400/5" :
                            col.id.startsWith('Status_') ? "bg-emerald-400/5" : "",
                            pairHighlightClasses(col.id, pairColumnMeta)
                          )}>
                            <button
                              type="button"
                              ref={openFilterCol === col.id ? columnFilterAnchorRef : undefined}
                              onClick={() => setOpenFilterCol(openFilterCol === col.id ? null : col.id)}
                              className={cn(
                                "w-full min-h-[36px] flex items-center justify-between gap-1 px-2 py-2 pr-3 rounded-lg text-xs font-bold transition-all",
                                columnFilters[col.id]?.size > 0
                                  ? "bg-blue-500/15 border border-blue-500/40 text-blue-400"
                                  : "dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 text-zinc-500 dark:hover:border-white/20 hover:border-black/20 dark:hover:text-zinc-300 hover:text-zinc-700"
                              )}
                            >
                              <span className="truncate">
                                {columnFilters[col.id]?.size > 0
                                  ? `${columnFilters[col.id].size} selecionado${columnFilters[col.id].size > 1 ? 's' : ''}`
                                  : 'Filtrar...'}
                              </span>
                              <Filter size={12} className="shrink-0" aria-hidden />
                            </button>
                            <button
                              type="button"
                              tabIndex={-1}
                              aria-label={`Redimensionar coluna ${col.id}`}
                              title="Arrastar para ajustar largura"
                              className="absolute right-0 top-0 bottom-0 w-2 sm:w-2.5 cursor-col-resize z-20 touch-none border-0 p-0 m-0 bg-transparent hover:bg-blue-500/25 active:bg-blue-500/40"
                              onPointerDown={e => beginColumnResize(e, col)}
                            />

                            {openFilterCol === col.id && (
                              <ColumnFilterDropdown
                                colId={col.id}
                                anchorRef={columnFilterAnchorRef}
                                allData={activeTask.resultData ?? []}
                                selectedSet={columnFilters[col.id] ?? null}
                                sortConfig={sortConfig}
                                onSort={(direction) => setSortConfig({ colId: col.id, direction })}
                                onClearSort={() => {
                                  if (sortConfig?.colId === col.id) setSortConfig(null);
                                }}
                                onApply={(set) => {
                                  setColumnFilters(prev => {
                                    const next = { ...prev };
                                    if (set === null) {
                                      delete next[col.id];
                                    } else {
                                      next[col.id] = set;
                                    }
                                    return next;
                                  });
                                }}
                                onClose={() => setOpenFilterCol(null)}
                              />
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-white/5 divide-black/5">
                      {filteredResultData.slice(0, visibleRows).map((row, i) => {
                        const isRowSelected = selectedRowIndex === i;
                        return (
                        <tr
                          key={i}
                          onClick={() => setSelectedRowIndex(i)}
                          className={cn(
                            'transition-all group cursor-pointer dark:hover:bg-white/5 hover:bg-black/5',
                            i % 2 === 0 && !isRowSelected ? 'dark:bg-white/[0.02] bg-black/[0.02]' : '',
                            isRowSelected && 'bg-blue-500/20 border-l-2 border-blue-500'
                          )}
                        >
                          <td
                            className={cn(
                              'px-3 py-3 text-xs font-bold text-zinc-400 text-center sticky left-0 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] border-r dark:border-white/5 border-black/5',
                              isRowSelected
                                ? 'bg-blue-500/20 dark:bg-blue-500/20 group-hover:bg-blue-500/25 dark:group-hover:bg-blue-500/25'
                                : 'dark:bg-[#0f0f10] bg-[#fcfcfc] group-hover:bg-inherit'
                            )}
                            style={{ width: RESULT_INDEX_COL_WIDTH_PX, minWidth: RESULT_INDEX_COL_WIDTH_PX }}
                          >
                            {i + 1}
                          </td>
                          {tableDisplayColumns.map(col => {
                            const val = row[col.id];
                            const cw = getResultColDisplayWidthPx(col);
                            return (
                              <td
                                key={col.id}
                                style={{ width: cw, minWidth: cw }}
                                className={cn(
                                'px-4 sm:px-6 py-3 text-xs font-medium whitespace-nowrap transition-colors overflow-hidden text-ellipsis',
                                col.id.startsWith('Lookup_') ? "bg-blue-400/5 dark:text-blue-300 text-blue-600 dark:group-hover:text-blue-200 group-hover:text-blue-700" : 
                                col.id.startsWith('LookupC_') ? "bg-purple-400/5 dark:text-purple-300 text-purple-600 dark:group-hover:text-purple-200 group-hover:text-purple-700" : 
                                col.id.startsWith('Status_') ? "bg-emerald-400/5 font-black " + (val === 'VERDADEIRO' ? 'text-emerald-400' : 'text-red-400') : "dark:text-zinc-400 text-zinc-600 dark:group-hover:text-zinc-100 group-hover:text-zinc-900",
                                pairHighlightClasses(col.id, pairColumnMeta),
                                isRowSelected && 'dark:!bg-blue-500/20 !bg-blue-500/20'
                              )}>
                                {val === null || val === undefined 
                                  ? <span className="text-red-400/50 italic font-bold">#N/D</span> 
                                  : typeof val === 'boolean' 
                                    ? (val ? 'SIM' : 'NÃO')
                                    : String(val)
                                }
                              </td>
                            );
                          })}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredResultData.length === 0 && (
                    <div className="p-20 text-center flex flex-col items-center gap-4">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <Filter className="text-slate-400" size={40} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-700 dark:text-slate-300 font-bold">Nenhum resultado encontrado para este filtro.</p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">Tente remover ou ajustar os filtros ativos para ver mais dados.</p>
                      </div>
                    </div>
                  )}
                  {filteredResultData.length > visibleRows && (
                    <div className="p-4 flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/30 border-t dark:border-white/5 border-black/5">
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                        Exibindo {visibleRows} de {filteredResultData.length} linhas
                      </p>
                      <button 
                        onClick={() => setVisibleRows(prev => prev + 100)}
                        className="px-6 py-2 rounded-xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-blue-500 hover:border-blue-500/30 transition-all active:scale-95"
                      >
                        Carregar mais resultados
                      </button>
                    </div>
                  )}
                </div>
              </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
      </>
      )}

      {error && (
        <div className="fixed right-4 sm:right-8 max-w-md z-[200] bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-2xl flex items-start gap-3 animate-bounce bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:bottom-[max(2rem,env(safe-area-inset-bottom,0px))]">
          <AlertCircle className="text-red-500 shrink-0" />
          <div>
            <h4 className="font-bold text-red-800">Ops!</h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)} 
            className="text-red-400 hover:text-red-600"
            aria-label="Fechar mensagem de erro"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading && (step === 'configure' || step === 'upload') && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#131313]/85 backdrop-blur-sm">
          <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="animate-pulse text-xl font-bold text-white">
            {step === 'upload' ? 'Lendo arquivo...' : 'Cruzando dados...'}
          </p>
        </div>
      )}

      <PasteDataModal
        open={pasteTarget !== null}
        onClose={() => setPasteTarget(null)}
        tableLabel={pasteTargetLabel}
        onAccept={handlePasteDataAccept}
      />

      <PivotTableModal
        open={showPivotModal}
        onClose={() => setShowPivotModal(false)}
        rows={filteredResultData as Record<string, unknown>[]}
      />
    </div>
  );
}

function LandingStepStrip({ currentStep, compact }: { currentStep: Step; compact?: boolean }) {
  const items: { id: Step; label: string }[] = [
    { id: 'upload', label: '1 Upload' },
    { id: 'configure', label: '2 Configurar' },
    { id: 'result', label: '3 Resultado' },
  ];
  const activeIndex = items.findIndex((x) => x.id === currentStep);
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-4 sm:gap-6', compact && 'gap-3')}>
      {items.map((s, i) => {
        const active = s.id === currentStep;
        const done = i < activeIndex;
        return (
          <span
            key={s.id}
            className={cn(
              'border-b-2 pb-1 text-[10px] font-bold uppercase tracking-[0.06em] transition-colors sm:text-[11px] sm:tracking-[0.05em]',
              active
                ? 'border-blue-500 text-blue-400'
                : done
                  ? 'border-transparent text-emerald-400/90'
                  : 'border-transparent text-zinc-500 hover:text-zinc-200'
            )}
          >
            {s.label}
          </span>
        );
      })}
    </div>
  );
}

function UploadHowItWorksDetails() {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <details className="group upload-ghost-border overflow-hidden rounded-2xl bg-[#1c1b1b] transition-all [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 transition-colors hover:bg-white/5">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 shrink-0 text-[#b4c5ff]" aria-hidden />
            <span className="font-jakarta text-sm font-semibold text-white">Como funciona em 3 passos</span>
          </div>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-[#c3c6d7] transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="grid grid-cols-1 gap-4 border-t border-white/5 px-5 pb-4 pt-4 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[9px] font-bold text-white">
              01
            </div>
            <div>
              <p className="text-[13px] font-medium text-white">Importe</p>
              <p className="text-[11px] text-[#c3c6d7]">Suba a base e a consulta.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#571bc1] text-[9px] font-bold text-white">
              02
            </div>
            <div>
              <p className="text-[13px] font-medium text-white">Mapeie</p>
              <p className="text-[11px] text-[#c3c6d7]">Selecione as chaves e colunas.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#353534] text-[9px] font-bold text-white">
              03
            </div>
            <div>
              <p className="text-[13px] font-medium text-white">Resultado</p>
              <p className="text-[11px] text-[#c3c6d7]">Baixe a planilha consolidada.</p>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

const UPLOAD_ACCEPT = '.xlsx,.xls,.xlsb,.xlsm,.ods,.csv,.tsv';

/**
 * Componente de cartão para upload de arquivos Excel.
 * Exibe o status do arquivo, permite trocar de planilha e remover o arquivo.
 */
function UploadCard({
  title,
  description,
  file,
  onUpload,
  onRemove,
  onPaste,
  onSheetChange,
  onRename,
  variant = 'default',
  landingAccent = 'blue',
}: {
  title: string;
  description: string;
  file: ExcelData | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaste?: () => void;
  onRemove: () => void;
  onSheetChange: (sheetName: string) => void;
  onRename?: (newName: string) => void;
  variant?: 'default' | 'landing';
  landingAccent?: 'blue' | 'violet';
}) {
  const isLanding = variant === 'landing';
  const hasFile = file && file.name;
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState('');

  const startEditing = () => {
    if (file) {
      setTempName(file.name);
      setIsEditing(true);
    }
  };

  const saveName = () => {
    if (tempName.trim() && onRename) {
      onRename(tempName.trim());
    }
    setIsEditing(false);
  };

  const landingIconWrap = cn(
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
    landingAccent === 'violet' ? 'bg-violet-500/10 text-[#d0bcff]' : 'bg-blue-500/10 text-[#b4c5ff]'
  );

  const landingImportBtn = cn(
    'flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-5 py-2 text-xs font-bold text-white transition-all active:scale-95',
    landingAccent === 'violet'
      ? 'bg-[#571bc1] hover:shadow-[0_0_15px_rgba(87,27,193,0.4)]'
      : 'bg-[#2563eb] hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]'
  );

  const csvHint =
    file && /\.csv$/i.test(file.name) ? (
      <div
        className={cn(
          'mt-2 flex items-start gap-2 rounded-lg border px-2 py-2 text-xs font-medium leading-relaxed',
          isLanding
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        )}
      >
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
        <span>CSV detectado. Se houver caracteres incorretos, o arquivo pode usar encoding Windows-1252.</span>
      </div>
    ) : null;

  if (isLanding) {
    return (
      <div
        className={cn(
          'upload-ghost-border relative overflow-hidden rounded-xl bg-[#2a2a2a] p-5 transition-all hover:bg-white/[0.03]',
          hasFile ? 'ring-2 ring-blue-400/35' : ''
        )}
      >
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className={landingIconWrap}>
            {hasFile && file ? (
              <TableIcon className="h-6 w-6" aria-hidden />
            ) : landingAccent === 'violet' ? (
              <Search className="h-6 w-6" aria-hidden />
            ) : (
              <FileText className="h-6 w-6" aria-hidden />
            )}
          </div>

          {hasFile && file ? (
            <>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                {isEditing ? (
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    autoFocus
                    className="mb-0.5 w-full border-b border-blue-400 bg-transparent pb-0.5 text-sm font-bold text-white outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    className="group/name mb-0.5 flex w-full items-center justify-center gap-2 sm:justify-start"
                    onClick={startEditing}
                    title="Clique para renomear"
                  >
                    <span className="block truncate text-sm font-bold text-white">{file.name}</span>
                    <Pencil
                      size={14}
                      className="shrink-0 text-zinc-500 opacity-60 group-hover/name:opacity-100"
                      aria-hidden
                    />
                  </button>
                )}
                <span className="text-xs font-medium text-[#c3c6d7]">
                  {file.sheets[file.selectedSheet].length} registros
                </span>
              </div>
              {Object.keys(file.sheets).length > 1 && (
                <select
                  value={file.selectedSheet}
                  onChange={(e) => onSheetChange(e.target.value)}
                  className="min-h-[44px] max-w-[150px] rounded-full border border-white/15 bg-zinc-900/90 px-3 py-2 text-xs font-bold text-white"
                >
                  {Object.keys(file.sheets).map((name) => (
                    <option key={name} value={name} className="bg-zinc-900">
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={onRemove}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-zinc-400 transition-all hover:bg-red-500/15 hover:text-red-400"
                aria-label="Remover arquivo"
                title="Remover arquivo"
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h3 className="font-jakarta text-base font-bold text-white">{title}</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-[#c3c6d7]">{description}</p>
              </div>
              <div className="flex flex-col gap-2">
                <label className="shrink-0 cursor-pointer">
                  <input type="file" accept={UPLOAD_ACCEPT} onChange={onUpload} className="hidden" />
                  <span className={landingImportBtn}>Importar Arquivo</span>
                </label>
                {onPaste ? (
                  <button
                    type="button"
                    onClick={onPaste}
                    className="text-[10px] font-bold uppercase tracking-widest text-[#b4c5ff] transition-colors hover:text-white"
                  >
                    Ou Colar Texto Bruto
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
        {csvHint}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fluent-card group relative overflow-hidden p-4 transition-all',
        hasFile ? 'ring-2 ring-blue-500/50' : 'hover:ring-2 hover:ring-blue-500/30'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
            hasFile ? 'bg-blue-600 text-white' : 'bg-black/5 text-zinc-500 group-hover:text-blue-500 dark:bg-white/5'
          )}
        >
          {file ? <TableIcon size={20} /> : <FileUp size={20} />}
        </div>

        {hasFile && file ? (
          <>
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="mb-0.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    autoFocus
                    className="w-full border-b border-blue-500 bg-transparent pb-0.5 text-xs font-bold text-zinc-900 outline-none dark:text-white sm:text-sm"
                  />
                </div>
              ) : (
                <div
                  className="group/name mb-0.5 flex cursor-pointer items-center gap-2"
                  onClick={startEditing}
                  onKeyDown={(e) => e.key === 'Enter' && startEditing()}
                  role="button"
                  tabIndex={0}
                  title="Clique para renomear"
                >
                  <span className="block truncate text-xs font-bold text-zinc-900 dark:text-white sm:text-sm">
                    {file.name}
                  </span>
                  <Pencil
                    size={14}
                    className="shrink-0 text-zinc-400 opacity-40 transition-opacity sm:opacity-0 sm:group-hover/name:opacity-100"
                    aria-hidden
                  />
                </div>
              )}
              <span className="text-xs font-medium text-zinc-500">
                {file.sheets[file.selectedSheet].length} registros
              </span>
            </div>
            {Object.keys(file.sheets).length > 1 && (
              <select
                value={file.selectedSheet}
                onChange={(e) => onSheetChange(e.target.value)}
                className="fluent-select max-w-[110px] min-h-[44px] px-2 py-2 text-sm font-bold sm:max-w-[140px]"
              >
                {Object.keys(file.sheets).map((name) => (
                  <option key={name} value={name} className="bg-white dark:bg-zinc-900">
                    {name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={onRemove}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-red-500/20 hover:text-red-500"
              aria-label="Remover arquivo"
              title="Remover arquivo"
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="min-h-0 min-w-0 flex-1">
              <span className="block text-sm font-bold leading-tight text-zinc-900 dark:text-white">{title}</span>
              <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-zinc-500 dark:text-zinc-400 sm:line-clamp-none">
                {description}
              </p>
            </div>
            <label className="shrink-0 cursor-pointer">
              <input type="file" accept={UPLOAD_ACCEPT} onChange={onUpload} className="hidden" />
              <div className="fluent-button-primary flex min-h-[44px] cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-bold">
                <FileSpreadsheet size={18} className="shrink-0" aria-hidden />
                <span>Importar</span>
              </div>
            </label>
          </>
        )}
      </div>
      {csvHint}
    </div>
  );
}

function ColumnFilterDropdown({
  colId,
  anchorRef,
  allData,
  selectedSet,
  sortConfig,
  onSort,
  onClearSort,
  onApply,
  onClose,
}: {
  colId: string;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  allData: any[];
  selectedSet: Set<string> | null;
  sortConfig: SortConfig | null;
  onSort: (dir: 'asc' | 'desc') => void;
  onClearSort: () => void;
  onApply: (set: Set<string> | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = React.useState('');
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = React.useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    transform?: string;
  } | null>(null);

  const uniqueValues = React.useMemo((): string[] => {
    const vals = new Set(allData.map(row => String(row[colId] ?? '')));
    return [...vals].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [allData, colId]);

  const isDateLikeColumn = React.useMemo(
    () => columnStringSamplesLookLikeDates(uniqueValues),
    [uniqueValues]
  );

  const displayed = uniqueValues.filter(v =>
    v.toLowerCase().includes(search.toLowerCase())
  );

  const isAllSelected = selectedSet === null;

  const isChecked = (val: string) => isAllSelected || selectedSet!.has(val);

  const toggle = (val: string) => {
    const base: Set<string> = isAllSelected ? new Set(uniqueValues) : new Set(selectedSet!);
    if (base.has(val)) base.delete(val);
    else base.add(val);
    onApply(base.size === uniqueValues.length ? null : base);
  };

  const updatePlacement = React.useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const gap = 4;
    const minW = 224;
    const width = Math.min(Math.max(rect.width, minW), vw - margin * 2);
    let left = rect.left;
    if (left + width > vw - margin) left = Math.max(margin, vw - width - margin);
    if (left < margin) left = margin;

    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;
    const avail = Math.max(0, openUpward ? spaceAbove : spaceBelow);
    const maxH = Math.min(avail, vh - margin * 2);

    if (openUpward) {
      setPlacement({
        top: rect.top - gap,
        left,
        width,
        maxHeight: maxH,
        transform: 'translateY(-100%)',
      });
    } else {
      setPlacement({
        top: rect.bottom + gap,
        left,
        width,
        maxHeight: maxH,
      });
    }
  }, [anchorRef]);

  useLayoutEffect(() => {
    updatePlacement();
  }, [updatePlacement, displayed.length, search, colId]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  React.useEffect(() => {
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [updatePlacement]);

  if (typeof document === 'undefined' || !placement) {
    return null;
  }

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Filtro da coluna ${colId}`}
      className="fixed z-[300] flex flex-col dark:bg-zinc-900/98 bg-white/98 backdrop-blur-xl border dark:border-white/10 border-black/10 rounded-2xl shadow-2xl overflow-hidden"
      style={{
        top: placement.top,
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
        transform: placement.transform,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="shrink-0 p-1 border-b dark:border-white/5 border-black/10">
        <button
          type="button"
          onClick={() => { onSort('asc'); onClose(); }}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl transition-all hover:bg-blue-500/10",
            sortConfig?.colId === colId && sortConfig.direction === 'asc' ? "text-blue-500 bg-blue-500/10" : "dark:text-zinc-300 text-zinc-700"
          )}
        >
          <ArrowUpAZ size={14} className="shrink-0" aria-hidden />
          {isDateLikeColumn ? 'Mais antigo para o mais novo' : 'Classificar de A a Z'}
        </button>
        <button
          type="button"
          onClick={() => { onSort('desc'); onClose(); }}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl transition-all hover:bg-blue-500/10",
            sortConfig?.colId === colId && sortConfig.direction === 'desc' ? "text-blue-500 bg-blue-500/10" : "dark:text-zinc-300 text-zinc-700"
          )}
        >
          <ArrowDownZA size={14} className="shrink-0" aria-hidden />
          {isDateLikeColumn ? 'Mais novo para o mais antigo' : 'Classificar de Z a A'}
        </button>
        {sortConfig?.colId === colId && (
          <button
            type="button"
            onClick={() => { onClearSort(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[10px] font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <X size={12} className="shrink-0" />
            Limpar Classificação
          </button>
        )}
      </div>

      <div className="shrink-0 p-2 border-b dark:border-white/5 border-black/10">
        <input
          autoFocus
          type="text"
          placeholder="Buscar valor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-lg px-3 py-1.5 text-xs outline-none dark:text-zinc-300 text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500/50"
        />
      </div>

      <div className="shrink-0 flex flex-wrap gap-2 px-3 py-2 border-b dark:border-white/5 border-black/10">
        <button
          type="button"
          onClick={() => onApply(null)}
          className="text-xs font-bold text-blue-400 hover:text-blue-500 transition-colors px-2 py-2 rounded-lg min-h-[40px]"
        >
          Selecionar Tudo
        </button>
        <button
          type="button"
          onClick={() => onApply(new Set())}
          className="text-xs font-bold text-zinc-500 dark:hover:text-zinc-300 hover:text-zinc-700 transition-colors px-2 py-2 rounded-lg min-h-[40px]"
        >
          Desmarcar Tudo
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar py-1">
        {displayed.length === 0 ? (
          <p className="text-center text-zinc-500 text-xs py-4">Nenhum valor encontrado</p>
        ) : (
          displayed.map(val => (
            <label
              key={val}
              className="flex items-center gap-2.5 px-3 py-2 min-h-[40px] dark:hover:bg-white/5 hover:bg-black/5 cursor-pointer group"
            >
              <div
                className={cn(
                  "w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0",
                  isChecked(val)
                    ? "bg-blue-600 border-blue-500"
                    : "dark:border-white/20 border-black/20 dark:bg-white/5 bg-black/5 group-hover:border-blue-500/40"
                )}
                onClick={() => toggle(val)}
              >
                {isChecked(val) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className="text-xs dark:text-zinc-300 text-zinc-700 truncate flex-1"
                onClick={() => toggle(val)}
              >
                {val === '' ? <span className="italic text-zinc-500">(vazio)</span> : val}
              </span>
            </label>
          ))
        )}
      </div>

      <div className="shrink-0 p-2 border-t dark:border-white/5 border-black/10">
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

/**
 * Indicador visual de progresso dos passos da aplicação.
 */
function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { id: Step; label: string; labelShort: string; icon: LucideIcon }[] = [
    { id: 'upload', label: 'Upload', labelShort: 'Upload', icon: Upload },
    { id: 'configure', label: 'Configurar', labelShort: 'Config', icon: Settings },
    { id: 'result', label: 'Resultado', labelShort: 'Resultado', icon: CheckCircle2 }
  ];

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 mica rounded-2xl sm:rounded-[24px] border border-white/10 shadow-xl">
        {steps.map((s, i) => {
          const isActive = s.id === currentStep;
          const isCompleted = steps.findIndex(st => st.id === currentStep) > i;
          
          return (
            <React.Fragment key={s.id}>
              <div className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-[18px] transition-all duration-500",
                isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-105" : 
                isCompleted ? "text-emerald-500 hover:bg-emerald-500/10" : "text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5"
              )}>
                <div className={cn(
                  "w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-xs font-black transition-all duration-500",
                  isActive ? "bg-white/20" : isCompleted ? "bg-emerald-500/20" : "dark:bg-white/5 bg-black/5"
                )}>
                  {isCompleted ? <CheckCircle2 size={16} /> : i + 1}
                </div>
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] max-w-[4.5rem] sm:max-w-none truncate sm:whitespace-normal">
                  <span className="sm:hidden">{s.labelShort}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight size={14} className="mx-0.5 opacity-20 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
