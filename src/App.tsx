/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  ChevronRight,
  ChevronDown,
  ArrowUpAZ,
  ArrowDownZA,
  SortAsc,
  SortDesc,
  Pencil,
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

interface ExcelData {
  name: string;
  sheets: {
    [sheetName: string]: any[];
  };
  selectedSheet: string;
}

type Step = 'upload' | 'configure' | 'result';

/** Largura da coluna # na tabela de resultados (px). */
const RESULT_INDEX_COL_WIDTH_PX = 48;
const DEFAULT_RESULT_COL_WIDTH_PX = 140;
const MIN_RESULT_COL_WIDTH_PX = 64;
const MAX_RESULT_COL_WIDTH_PX = 600;

interface ColumnSetting {
  id: string;
  visible: boolean;
  pinned: boolean;
  /** Largura em px na grelha de resultados; omitido = default. */
  widthPx?: number;
}

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

interface LookupTask {
  id: string;
  name: string;
  fileA: ExcelData | null;
  fileB: ExcelData | null;
  keyA: string;
  keyB: string;
  selectedColsA: string[];
  selectedColsB: string[];
  fileC: ExcelData | null;
  keyA_C: string;
  keyC: string;
  selectedColsC: string[];
  lookupType: 'xlookup' | 'vlookup';
  exactMatch: boolean;
  trimSpaces: boolean;
  ignoreCase: boolean;
  removeSpecialChars: boolean;
  duplicateStrategy: 'first' | 'last' | 'concatenate';
  fuzzyThreshold: number;
  ifNotFound: string;
  ifNotFoundC: string;
  matchMode: 0 | -1 | 1 | 2;
  searchDirection: 1 | -1;
  includeStatusCols: boolean;
  resultData: any[] | null;
  resultFilter: 'all' | 'matched' | 'orphans' | 'divergent';
  divergentPairs: { colA: string; colLookup: string }[];
  showAdvanced: boolean;
  columnSettings: ColumnSetting[];
}

/** `Object.entries` perde o tipo dos valores; aqui preservamos `Set<string>`. */
function columnFilterEntries(filters: Record<string, Set<string>>): [string, Set<string>][] {
  return Object.entries(filters) as [string, Set<string>][];
}

function columnFilterValueSets(filters: Record<string, Set<string>>): Set<string>[] {
  return Object.values(filters) as Set<string>[];
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
      divergentPairs: [],
      showAdvanced: false,
      columnSettings: [],
    }
  ]);
  const [activeTaskId, setActiveTaskId] = useState<string>(tasks[0].id);
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTermA, setSearchTermA] = useState<string>('');
  const [searchTermB, setSearchTermB] = useState<string>('');
  const [searchTermC, setSearchTermC] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [configTab, setConfigTab] = useState<'keys' | 'columns' | 'advanced'>('keys');
  const [columnFilters, setColumnFilters] = useState<{ [col: string]: Set<string> }>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [showDivergentConfig, setShowDivergentConfig] = useState(false);
  const [visibleRows, setVisibleRows] = useState(50);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  /** Durante arraste de redimensionar coluna (só repintura; commit no pointerup). */
  const [columnResizePreview, setColumnResizePreview] = useState<{ colId: string; widthPx: number } | null>(null);
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

    // Converte objetos Date para string DD/MM/AAAA (HH:MM) e números grandes
    // (CPF, códigos) para string sem notação científica.
    const normalizeRow = (row: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v instanceof Date) {
          const pad = (n: number) => String(n).padStart(2, '0');
          const dateStr = `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}`;
          const hasTime = v.getHours() !== 0 || v.getMinutes() !== 0;
          result[k] = hasTime ? `${dateStr} ${pad(v.getHours())}:${pad(v.getMinutes())}` : dateStr;
        } else if (typeof v === 'number' && !isNaN(v) && Math.abs(v) >= 1e9) {
          result[k] = Number.isInteger(v) ? String(v) : v.toFixed(0);
        } else {
          result[k] = v;
        }
      }
      return result;
    };

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
          sheets[name] = raw.map(normalizeRow);
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
  }, [activeTask.resultData, activeTask.resultFilter, activeTask.fileC, activeTask.divergentPairs, columnFilters, sortConfig]);

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
      updateActiveTask({ resultData, columnSettings });
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

    const visibleCols = activeTask.columnSettings
      .filter(c => c.visible && !c.id.startsWith('_'))
      .map(c => c.id);

    const exportData = filteredResultData.map(row => {
      const clean: Record<string, unknown> = {};
      visibleCols.forEach(col => { clean[col] = row[col]; });
      return clean;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const widthById = new Map<string, number>(
      activeTask.columnSettings.map((c): [string, number] => [c.id, getResultColWidthPx(c)])
    );
    const sheet = ws as import('xlsx').WorkSheet;
    sheet['!cols'] = visibleCols.map(colId => {
      const px = widthById.get(colId) ?? DEFAULT_RESULT_COL_WIDTH_PX;
      return { wch: Math.max(8, Math.min(60, Math.round(px / 7))) };
    });
    const wb = XLSX.utils.book_new();
    const fileName = activeTask.resultFilter === 'all'
      ? `resultado_${activeTask.name}.xlsx`
      : `resultado_${activeTask.name}_${activeTask.resultFilter}.xlsx`;
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, fileName);
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
    <div className={cn(
      "min-h-screen relative transition-colors duration-700 selection:bg-blue-500/30",
      isDarkMode ? "bg-[#0a0a0a] text-zinc-100" : "bg-[#f3f3f3] text-zinc-900"
    )}>
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
              {step === 'upload' && (
                <motion.div 
                  key="upload"
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.02, y: -10 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-none space-y-4"
                >
              <UploadHowItWorksCollapsible />
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                <UploadCard 
                  title="1. Tabela Principal (Base)" 
                  description="Carregue aqui a planilha que você quer preencher ou completar."
                  file={activeTask.fileA}
                  onUpload={(e) => handleFileUpload(e, 'A')}
                  onRemove={() => updateActiveTask({ fileA: null })}
                  onSheetChange={(sheetName) => updateActiveTask({ fileA: activeTask.fileA ? { ...activeTask.fileA, selectedSheet: sheetName } : null })}
                  onRename={(newName) => updateActiveTask({ fileA: activeTask.fileA ? { ...activeTask.fileA, name: newName } : null })}
                />
                <UploadCard 
                  title="2. Tabela de Busca (Fonte)" 
                  description="Carregue aqui a planilha que contém as informações que você procura."
                  file={activeTask.fileB}
                  onUpload={(e) => handleFileUpload(e, 'B')}
                  onRemove={() => updateActiveTask({ fileB: null })}
                  onSheetChange={(sheetName) => updateActiveTask({ fileB: activeTask.fileB ? { ...activeTask.fileB, selectedSheet: sheetName } : null })}
                  onRename={(newName) => updateActiveTask({ fileB: activeTask.fileB ? { ...activeTask.fileB, name: newName } : null })}
                />
              </div>

              {/* Indicador de progresso de upload */}
              <div className="flex items-center justify-center gap-3 mt-2">
                {[activeTask.fileA, activeTask.fileB].map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full transition-all duration-500",
                      f ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "dark:bg-white/10 bg-black/10"
                    )} />
                    <span className={cn(
                      "text-xs sm:text-sm font-bold transition-colors duration-300",
                      f ? "text-blue-400" : "text-zinc-500"
                    )}>
                      {i === 0 ? "Tabela A" : "Tabela B"}
                    </span>
                  </div>
                ))}
                <span className="text-xs sm:text-sm text-zinc-500 font-medium">
                  — {[activeTask.fileA, activeTask.fileB].filter(Boolean).length} de 2 arquivos prontos
                </span>
              </div>

              <div className="mt-2 flex flex-col items-center gap-3">
                  <button 
                    onClick={() => updateActiveTask({ fileC: activeTask.fileC ? null : { name: '', sheets: {}, selectedSheet: '' } })}
                    className={cn(
                      "flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-3 rounded-xl text-sm font-black transition-all active:scale-95",
                      activeTask.fileC 
                        ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" 
                        : "dark:bg-white/5 bg-black/5 text-zinc-500 dark:hover:text-zinc-100 hover:text-zinc-900 border dark:border-white/5 border-black/10 dark:hover:border-white/10 hover:border-black/20"
                    )}
                  >
                    {activeTask.fileC ? <X size={14} /> : <Plus size={14} />}
                    {activeTask.fileC ? "Remover Tabela C" : "Adicionar Tabela C (Opcional)"}
                  </button>

                {activeTask.fileC && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto"
                  >
                    <UploadCard 
                      title="3. Tabela de Busca Extra" 
                      description="Use esta opção se precisar buscar dados em mais um arquivo."
                      file={activeTask.fileC}
                      onUpload={(e) => handleFileUpload(e, 'C')}
                      onRemove={() => updateActiveTask({ fileC: null })}
                      onSheetChange={(sheetName) => updateActiveTask({ fileC: activeTask.fileC ? { ...activeTask.fileC, selectedSheet: sheetName } : null })}
                      onRename={(newName) => updateActiveTask({ fileC: activeTask.fileC ? { ...activeTask.fileC, name: newName } : null })}
                    />
                  </motion.div>
                )}

                <div className="flex flex-col items-center gap-2 w-full">
                <button
                  disabled={!activeTask.fileA || !activeTask.fileB}
                  onClick={() => setStep('configure')}
                  className="fluent-button-primary w-full sm:w-auto mt-2 min-h-[44px] px-8 sm:px-12 py-4 text-base sm:text-lg group shadow-[0_12px_32px_rgba(37,99,235,0.3)]"
                >
                  Continuar para Configuração
                  <ArrowRight size={20} className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center max-w-md px-2">
                  {!activeTask.fileA || !activeTask.fileB
                    ? 'Carregue as duas primeiras planilhas para continuar.'
                    : 'Próximo passo: escolher como ligar as colunas.'}
                </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'configure' && (
            <motion.div 
              key="configure"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full max-w-none space-y-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-1 sm:gap-2 p-1 sm:p-1.5 mica rounded-xl sm:rounded-2xl border border-white/20 dark:border-white/10 w-full lg:w-fit overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                  {([
                    { id: 'keys' as const, label: '1. Conexão', icon: Target },
                    { id: 'columns' as const, label: '2. Colunas a Trazer', icon: Columns },
                    { id: 'advanced' as const, label: '3. Opções Extras', icon: Settings2 },
                  ] satisfies { id: 'keys' | 'columns' | 'advanced'; label: string; icon: LucideIcon }[]).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setConfigTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 min-h-[44px] px-3 py-2.5 rounded-lg transition-all duration-300 font-medium text-sm whitespace-nowrap flex-1 sm:flex-none justify-center",
                        configTab === tab.id 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white dark:hover:bg-white/5 hover:bg-black/5"
                      )}
                    >
                      <tab.icon className="w-4 h-4 shrink-0" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 w-full lg:max-w-2xl xl:max-w-3xl lg:items-end shrink-0">
                  <button
                    type="button"
                    onClick={autoDetectConfig}
                    className="flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto px-4 py-2.5 dark:bg-white/5 dark:hover:bg-white/10 bg-black/5 hover:bg-black/10 text-blue-500 dark:text-blue-400 rounded-xl font-bold text-sm transition-all border dark:border-white/10 border-black/10 active:scale-[0.98]"
                  >
                    <Sparkles size={18} className="shrink-0 text-blue-500" aria-hidden />
                    Tentar Configuração Automática
                  </button>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed lg:text-right">
                    <span className="font-semibold text-zinc-600 dark:text-zinc-300">Sugestão inteligente: </span>
                    o sistema tenta adivinhar quais colunas ligam as duas tabelas (ex.: CPF com CPF) e quais colunas
                    provavelmente quer copiar. Pode ajustar depois nas abas abaixo.
                  </p>
                </div>
              </div>

              <ConfigureAiAssistant
                fileA={activeTask.fileA}
                fileB={activeTask.fileB}
                fileC={activeTask.fileC}
                headersA={headersA}
                headersB={headersB}
                headersC={headersC}
                onApply={(patch) => updateActiveTask(patch)}
              />

              <div>
                <AnimatePresence mode="wait">
                  {configTab === 'keys' && (
                    <motion.div
                      key="keys"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-3"
                    >
                      <div className="fluent-card p-4 group">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                            <Target className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Conexão Tabela Principal ↔ Busca</h3>
                            <p className="text-xs text-zinc-500">Selecione a coluna que existe em ambas as tabelas (ex: Código, CPF, E-mail)</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Coluna na Tabela Principal</label>
                            <select 
                              value={activeTask.keyA}
                              onChange={(e) => updateActiveTask({ keyA: e.target.value })}
                              className="fluent-select w-full py-2 text-sm"
                            >
                              <option value="">Selecione a coluna...</option>
                              {headersA.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Coluna correspondente na Tabela de Busca</label>
                            <select 
                              value={activeTask.keyB}
                              onChange={(e) => updateActiveTask({ keyB: e.target.value })}
                              className="fluent-select w-full py-2 text-sm"
                            >
                              <option value="">Selecione a coluna...</option>
                              {headersB.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {activeTask.fileC && (
                        <div className="fluent-card p-4 group">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                              <Target className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Conexão Tabela Principal ↔ Busca Extra</h3>
                              <p className="text-xs text-zinc-500">Selecione a coluna que existe em ambas as tabelas</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Coluna na Tabela Principal</label>
                              <select 
                                value={activeTask.keyA_C}
                                onChange={(e) => updateActiveTask({ keyA_C: e.target.value })}
                                className="fluent-select w-full py-2 text-sm"
                              >
                                <option value="">Selecione a coluna...</option>
                                {headersA.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Coluna na Tabela Extra</label>
                              <select 
                                value={activeTask.keyC}
                                onChange={(e) => updateActiveTask({ keyC: e.target.value })}
                                className="fluent-select w-full py-2 text-sm"
                              >
                                <option value="">Selecione a coluna...</option>
                                {headersC.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {configTab === 'columns' && (
                    <motion.div
                      key="columns"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-3"
                    >
                      {/* Configuração Tabela A - Colunas da base */}
                      <div className="fluent-card p-3 sm:p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h2 className="text-sm font-black flex items-center gap-1.5">
                              <Columns size={14} className="text-zinc-400" /> Colunas Originais (Tabela Principal)
                            </h2>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-zinc-500/20 text-zinc-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                              {activeTask.selectedColsA.length === 0 ? 'Todas' : `${activeTask.selectedColsA.length} selecionadas`}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
                            <input
                              type="text"
                              placeholder="Filtrar nomes de colunas..."
                              className="w-full pl-9 pr-3 py-2 rounded-xl dark:border-white/10 border-black/10 border dark:bg-black/20 bg-white/60 focus:border-blue-500 outline-none text-xs dark:text-zinc-300 text-zinc-700 font-medium"
                              onChange={(e) => setSearchTermA(e.target.value.toLowerCase())}
                            />
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateActiveTask({ selectedColsA: headersA })}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                            >
                              Selecionar Tudo
                            </button>
                            <button
                              onClick={() => updateActiveTask({ selectedColsA: [] })}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                            >
                              Todas (padrão)
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[min(13.75rem,42dvh)] sm:max-h-[min(17rem,48dvh)] lg:max-h-[min(22rem,55dvh)] overflow-y-auto pr-1 custom-scrollbar">
                          {headersA
                            .filter(h => h.toLowerCase().includes(searchTermA))
                            .map(h => (
                            <button
                              key={h}
                              onClick={() => {
                                updateActiveTask({
                                  selectedColsA: activeTask.selectedColsA.includes(h)
                                    ? activeTask.selectedColsA.filter(c => c !== h)
                                    : [...activeTask.selectedColsA, h]
                                });
                              }}
                              className={cn(
                                "p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center justify-between group relative overflow-hidden",
                                activeTask.selectedColsA.includes(h)
                                  ? "border-zinc-500/50 bg-zinc-500/10 text-zinc-300 shadow-sm"
                                  : "dark:border-white/5 dark:bg-black/20 dark:hover:border-white/20 dark:hover:bg-white/5 border-black/10 bg-white/60 hover:border-black/20 hover:bg-black/5"
                              )}
                            >
                              <span className="truncate z-10">{h}</span>
                              {activeTask.selectedColsA.includes(h) ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="z-10">
                                  <CheckCircle2 size={16} className="text-zinc-400" />
                                </motion.div>
                              ) : (
                                <div className="w-4 h-4 rounded-full border dark:border-white/10 border-black/10 group-hover:border-zinc-400" />
                              )}
                            </button>
                          ))}
                        </div>

                        {activeTask.selectedColsA.length === 0 && (
                          <p className="text-[10px] text-zinc-500 italic">Se não selecionar nada, todas as colunas originais serão mantidas.</p>
                        )}
                      </div>

                      {/* Configuração Tabela B */}
                      <div className="fluent-card p-3 sm:p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h2 className="text-sm font-black flex items-center gap-1.5">
                              <Columns size={14} className="text-blue-600" /> Colunas para Importar (Tabela de Busca)
                              <div className="group relative">
                                <Info size={13} className="text-zinc-500 cursor-help" />
                                <div className="absolute bottom-full left-0 mb-2 w-64 p-3 dark:bg-zinc-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10 font-normal">
                                  <p className="font-bold mb-1">O que trazer?</p>
                                  <p className="opacity-80">Marque as colunas que contêm as informações que você quer copiar para a sua tabela principal.</p>
                                </div>
                              </div>
                            </h2>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                              {activeTask.selectedColsB.length} selecionadas
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
                            <input 
                              type="text"
                              placeholder="Filtrar nomes de colunas..."
                              className="w-full pl-9 pr-3 py-2 rounded-xl border dark:border-white/10 border-black/10 dark:bg-black/20 bg-white/60 focus:border-blue-500 outline-none text-xs dark:text-zinc-300 text-zinc-700 font-medium"
                              onChange={(e) => setSearchTermB(e.target.value.toLowerCase())}
                            />
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => updateActiveTask({ selectedColsB: headersB })}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-blue-400 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                            > 
                              Selecionar Tudo
                            </button>
                            <button 
                              onClick={() => updateActiveTask({ selectedColsB: [] })}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                            >
                              Limpar
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[min(13.75rem,42dvh)] sm:max-h-[min(17rem,48dvh)] lg:max-h-[min(22rem,55dvh)] overflow-y-auto pr-1 custom-scrollbar">
                          {headersB
                            .filter(h => h.toLowerCase().includes(searchTermB))
                            .map(h => (
                            <button
                              key={h}
                              onClick={() => {
                                updateActiveTask({
                                  selectedColsB: activeTask.selectedColsB.includes(h) 
                                    ? activeTask.selectedColsB.filter(c => c !== h) 
                                    : [...activeTask.selectedColsB, h]
                                });
                              }}
                              className={cn(
                                "p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center justify-between group relative overflow-hidden",
                                activeTask.selectedColsB.includes(h)
                                  ? activeTask.lookupType === 'vlookup' && headersB.indexOf(h) < headersB.indexOf(activeTask.keyB)
                                    ? "border-red-500/50 bg-red-500/10 text-red-400 shadow-sm"
                                    : "border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-sm"
                                  : "dark:border-white/5 dark:bg-black/20 dark:hover:border-white/20 dark:hover:bg-white/5 border-black/10 bg-white/60 hover:border-black/20 hover:bg-black/5"
                              )}
                            >
                              <span className="truncate z-10">{h}</span>
                              {activeTask.selectedColsB.includes(h) ? (
                                <motion.div 
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="z-10"
                                >
                                  {activeTask.lookupType === 'vlookup' && headersB.indexOf(h) < headersB.indexOf(activeTask.keyB) 
                                    ? <AlertCircle size={16} className="text-red-400" />
                                    : <CheckCircle2 size={16} className="text-blue-400" />
                                  }
                                </motion.div>
                              ) : (
                                <div className="w-4 h-4 rounded-full border dark:border-white/10 border-black/10 group-hover:border-blue-400" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Configuração Tabela C (Opcional) */}
                      {activeTask.fileC && (
                        <div className="fluent-card p-3 sm:p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h2 className="text-sm font-black flex items-center gap-1.5">
                                <Columns size={14} className="text-purple-400" /> Colunas para Importar (Tabela Extra)
                                <div className="group relative">
                                  <Info size={13} className="text-zinc-500 cursor-help" />
                                  <div className="absolute bottom-full left-0 mb-2 w-64 p-3 dark:bg-zinc-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10 font-normal">
                                    <p className="font-bold mb-1">O que trazer?</p>
                                    <p className="opacity-80">Marque as colunas que você quer copiar desta tabela extra.</p>
                                  </div>
                                </div>
                              </h2>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-purple-600/20 text-purple-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                {activeTask.selectedColsC.length} selecionadas
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
                              <input 
                                type="text"
                                placeholder="Filtrar colunas da Tabela C..."
                                className="w-full pl-9 pr-3 py-2 rounded-xl border dark:border-white/10 border-black/10 dark:bg-black/20 bg-white/60 focus:border-blue-500 outline-none text-xs dark:text-zinc-300 text-zinc-700 font-medium"
                                onChange={(e) => setSearchTermC(e.target.value.toLowerCase())}
                              />
                            </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => updateActiveTask({ selectedColsC: headersC })}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-purple-400 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                              >
                                Selecionar Tudo
                              </button>
                              <button 
                                onClick={() => updateActiveTask({ selectedColsC: [] })}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                              >
                                Limpar
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[min(13.75rem,42dvh)] sm:max-h-[min(17rem,48dvh)] lg:max-h-[min(22rem,55dvh)] overflow-y-auto pr-1 custom-scrollbar">
                            {headersC
                              .filter(h => h.toLowerCase().includes(searchTermC))
                              .map(h => (
                              <button
                                key={h}
                                onClick={() => {
                                  updateActiveTask({
                                    selectedColsC: activeTask.selectedColsC.includes(h) 
                                      ? activeTask.selectedColsC.filter(c => c !== h) 
                                      : [...activeTask.selectedColsC, h]
                                  });
                                }}
                                className={cn(
                                  "p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center justify-between group relative overflow-hidden",
                                  activeTask.selectedColsC.includes(h)
                                    ? activeTask.lookupType === 'vlookup' && headersC.indexOf(h) < headersC.indexOf(activeTask.keyC)
                                      ? "border-red-500/50 bg-red-500/10 text-red-400 shadow-sm"
                                      : "border-purple-500/50 bg-purple-500/10 text-purple-400 shadow-sm"
                                    : "dark:border-white/5 dark:bg-black/20 dark:hover:border-white/20 dark:hover:bg-white/5 border-black/10 bg-white/60 hover:border-black/20 hover:bg-black/5"
                                )}
                              >
                                <span className="truncate z-10">{h}</span>
                                {activeTask.selectedColsC.includes(h) ? (
                                  <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="z-10"
                                  >
                                    {activeTask.lookupType === 'vlookup' && headersC.indexOf(h) < headersC.indexOf(activeTask.keyC) 
                                      ? <AlertCircle size={16} className="text-red-400" />
                                      : <CheckCircle2 size={16} className="text-purple-400" />
                                    }
                                  </motion.div>
                                ) : (
                                  <div className="w-4 h-4 rounded-full border dark:border-white/10 border-black/10 group-hover:border-purple-400" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {configTab === 'advanced' && (
                    <motion.div
                      key="advanced"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="fluent-card p-3 sm:p-4 space-y-3"
                    >
                      <div>
                        <h2 className="text-sm font-black flex items-center gap-2">
                          <Settings2 size={14} className="text-blue-600" /> Ajustes Finos
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-2 p-3 dark:bg-white/5 bg-black/5 rounded-2xl border dark:border-white/5 border-black/10">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                              <Zap size={12} className="text-blue-400" /> Padronização
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-zinc-500 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-zinc-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                                <p className="font-bold mb-1">Evitar erros comuns</p>
                                <p className="opacity-80">Ajuda a encontrar correspondências mesmo que o texto não esteja idêntico (ex: "JOSÉ" e "jose").</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {([
                              { id: 'trimSpaces', label: 'Remover espaços extras', field: 'trimSpaces' as const, help: 'Remove espaços no início e fim do texto.' },
                              { id: 'ignoreCase', label: 'Ignorar Maiúsculas/Minúsculas', field: 'ignoreCase' as const, help: 'Trata "TEXTO" e "texto" como iguais.' },
                              { id: 'removeSpecialChars', label: 'Remover Caracteres Especiais', field: 'removeSpecialChars' as const, help: 'Remove acentos e símbolos (ex: "ç" vira "c").' },
                            ] as const).map((opt) => (
                              <div key={opt.id} className="flex items-center justify-between group/item">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className="relative flex items-center">
                                    <input 
                                      type="checkbox" 
                                      checked={activeTask[opt.field]} 
                                      onChange={e => updateActiveTask({ [opt.field]: e.target.checked })} 
                                      className="peer sr-only" 
                                    />
                                    <div className="w-8 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-colors" />
                                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-3" />
                                  </div>
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">{opt.label}</span>
                                </label>
                                <div className="group relative">
                                  <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 dark:bg-slate-800 bg-white dark:text-white text-zinc-800 text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-lg border dark:border-white/10 border-black/10">
                                    {opt.help}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                              <Layers size={12} className="text-blue-500" /> Se houver repetidos
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                                <p className="font-bold mb-1">Duplicatas na busca</p>
                                <p className="opacity-80">Se o código procurado aparecer mais de uma vez na tabela de busca, qual deles devemos usar?</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <select 
                              value={activeTask.duplicateStrategy}
                              onChange={(e) => updateActiveTask({ duplicateStrategy: e.target.value as LookupTask['duplicateStrategy'] })}
                              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                            >
                              <option value="first">Usar o primeiro encontrado</option>
                              <option value="last">Usar o último encontrado</option>
                              <option value="concatenate">Juntar todos (Separar por ;)</option>
                            </select>
                            <p className="text-[10px] text-slate-400 italic leading-relaxed">
                              {activeTask.duplicateStrategy === 'first' && "Retorna apenas a primeira ocorrência encontrada."}
                              {activeTask.duplicateStrategy === 'last' && "Retorna apenas a última ocorrência encontrada."}
                              {activeTask.duplicateStrategy === 'concatenate' && "Junta todos os valores encontrados separados por ponto e vírgula."}
                            </p>
                          </div>
                        </div>

                        {/* Modo de Correspondência (XLOOKUP style) */}
                        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                              <Target size={12} className="text-blue-500" /> Modo de Busca
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                                <p className="font-bold mb-1">Como comparar?</p>
                                <p className="opacity-80">Define se o valor precisa ser idêntico ou se pode buscar valores próximos (útil para faixas de números).</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <select 
                              value={activeTask.matchMode}
                              onChange={(e) => updateActiveTask({ matchMode: Number(e.target.value) as LookupTask['matchMode'] })}
                              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                              disabled={!activeTask.exactMatch}
                            >
                              <option value="0">Correspondência Exata (Padrão)</option>
                              <option value="-1">Aproximada (Menor valor próximo)</option>
                              <option value="1">Aproximada (Maior valor próximo)</option>
                              <option value="2">Usar Curingas (* e ?)</option>
                            </select>
                            <p className="text-[10px] text-slate-400 italic leading-relaxed">
                              {!activeTask.exactMatch ? "Desativado em modo Fuzzy." : 
                                activeTask.matchMode === 0 ? "Busca apenas o valor idêntico." :
                                activeTask.matchMode === -1 ? "Se não encontrar, pega o valor imediatamente inferior." :
                                activeTask.matchMode === 1 ? "Se não encontrar, pega o valor imediatamente superior." :
                                "Permite usar '*' para vários caracteres e '?' para um único."
                              }
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                              <Activity size={12} className="text-blue-500" /> Corretor de Digitação ({Math.round(activeTask.fuzzyThreshold * 100)}%)
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                                <p className="font-bold mb-1">Tolerância a erros</p>
                                <p className="opacity-80">Útil quando os nomes podem estar digitados errado. Quanto menor a porcentagem, mais diferenças ele aceita.</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <input 
                              type="range" 
                              min="0.1" 
                              max="1.0" 
                              step="0.05" 
                              value={activeTask.fuzzyThreshold}
                              onChange={e => updateActiveTask({ fuzzyThreshold: parseFloat(e.target.value) })}
                              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 font-black">
                              <span>MAIS FLEXÍVEL</span>
                              <span>MAIS RÍGIDO</span>
                            </div>
                          </div>
                        </div>

                        {/* Colunas de Status */}
                        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 sm:col-span-2 md:col-span-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                              <CheckCircle2 size={12} className="text-blue-500" /> Colunas de Verificação
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                                <p className="font-bold mb-1">Achou ou não?</p>
                                <p className="opacity-80">Cria colunas no final dizendo "VERDADEIRO" se encontrou o valor ou "FALSO" se não encontrou.</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateActiveTask({ includeStatusCols: !activeTask.includeStatusCols })}
                              className={cn(
                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0",
                                activeTask.includeStatusCols ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                              )}
                            >
                              <span
                                className={cn(
                                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                                  activeTask.includeStatusCols ? "translate-x-[18px]" : "translate-x-0.5"
                                )}
                              />
                            </button>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              Criar colunas que dizem se achou ou não (VERDADEIRO/FALSO)
                            </span>
                          </div>
                        </div>

                        {/* Valor se não encontrado */}
                        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 sm:col-span-2 md:col-span-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                              <HelpCircle size={12} className="text-blue-500" /> O que escrever se não encontrar?
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                                <p className="font-bold mb-1">Texto padrão</p>
                                <p className="opacity-80">Quando não houver correspondência, este texto será preenchido na célula (ex: #N/D, Não Encontrado, 0).</p>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Para Tabela B</label>
                              <input 
                                type="text"
                                value={activeTask.ifNotFound}
                                onChange={(e) => updateActiveTask({ ifNotFound: e.target.value })}
                                placeholder="#N/D"
                                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                              />
                            </div>
                            {activeTask.fileC && (
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Para Tabela C</label>
                                <input 
                                  type="text"
                                  value={activeTask.ifNotFoundC}
                                  onChange={(e) => updateActiveTask({ ifNotFoundC: e.target.value })}
                                  placeholder="#N/D"
                                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Direção da Busca (XLOOKUP style) */}
                        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 sm:col-span-2 md:col-span-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                              <ArrowUpDown size={12} className="text-blue-500" /> Ordem da Busca
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                                <p className="font-bold mb-1">De cima ou de baixo?</p>
                                <p className="opacity-80">Define se começa a procurar do início da tabela (padrão) ou do fim.</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <select 
                              value={activeTask.searchDirection}
                              onChange={(e) => updateActiveTask({ searchDirection: Number(e.target.value) as LookupTask['searchDirection'] })}
                              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                            >
                              <option value="1">Do Primeiro ao Último (Padrão)</option>
                              <option value="-1">Do Último ao Primeiro</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Validation Summary */}
              {!validation.isValid && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-3 flex items-start gap-3"
                >
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg shrink-0">
                    <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">Atenção necessária:</p>
                    <ul className="text-xs text-amber-800 dark:text-amber-300/80 list-disc list-inside space-y-1 font-medium">
                      {validation.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-2">
                <button 
                  onClick={() => setStep('upload')}
                  className="min-h-[44px] px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 text-sm"
                >
                  Voltar
                </button>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {configTab !== 'advanced' && (
                    <button
                      onClick={() => setConfigTab(configTab === 'keys' ? 'columns' : 'advanced')}
                      className="min-h-[44px] px-4 py-2 rounded-lg font-bold text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all border border-blue-100 dark:border-blue-900/40"
                    >
                      Próximo
                    </button>
                  )}
                  <button
                    disabled={!validation.isValid || loading}
                    onClick={performLookup}
                    className={cn(
                      "min-h-[44px] px-5 py-2.5 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95",
                      !validation.isValid
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                    )}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        Executar Cruzamento <Zap size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'result' && activeTask.resultData && stats && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-none flex flex-col flex-1 min-h-0 gap-3 sm:gap-4"
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
                          {columnFilterValueSets(columnFilters).some(s => s.size > 0) && (
                            <button
                              onClick={() => setColumnFilters({})}
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
                            onClick={downloadResult}
                            className="fluent-button-primary min-h-[44px] px-3 py-2 text-xs flex items-center gap-1.5"
                            aria-label="Baixar resultado"
                            title="Baixar resultado"
                          >
                            <Download size={16} />
                            <span className="font-bold">Baixar</span>
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
                    </div>

                    {/* Direita: botões de ação — ocultos em mobile (exibidos acima) */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {columnFilterValueSets(columnFilters).some(s => s.size > 0) && (
                        <button
                          onClick={() => setColumnFilters({})}
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
                        onClick={downloadResult}
                        className="fluent-button-primary min-h-[44px] px-4 py-2 text-xs"
                      >
                        <Download size={14} /> Baixar Excel
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
                        {tableDisplayColumns.map(col => (
                          <th
                            key={col.id}
                            style={{
                              width: getResultColDisplayWidthPx(col),
                              minWidth: getResultColDisplayWidthPx(col),
                            }}
                            className={cn(
                            "px-4 sm:px-6 py-4 text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]",
                            col.id.startsWith('Lookup_') ? "text-blue-500 bg-blue-400/5" : 
                            col.id.startsWith('LookupC_') ? "text-purple-500 bg-purple-400/5" :
                            col.id.startsWith('Status_') ? "text-emerald-500 bg-emerald-400/5" :
                            "dark:text-zinc-500 text-zinc-600",
                            pairHighlightClasses(col.id, pairColumnMeta)
                          )}>
                            <div className="flex items-center gap-2">
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
                      {filteredResultData.slice(0, visibleRows).map((row, i) => (
                        <tr key={i} className={cn(
                          "transition-all group dark:hover:bg-white/5 hover:bg-black/5",
                          i % 2 === 0 ? "dark:bg-white/[0.02] bg-black/[0.02]" : ""
                        )}>
                          <td
                            className="px-3 py-3 text-xs font-bold text-zinc-400 text-center sticky left-0 z-10 dark:bg-[#0f0f10] bg-[#fcfcfc] group-hover:bg-inherit shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] border-r dark:border-white/5 border-black/5"
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
                                "px-4 sm:px-6 py-3 text-xs font-medium whitespace-nowrap transition-colors overflow-hidden text-ellipsis",
                                col.id.startsWith('Lookup_') ? "bg-blue-400/5 dark:text-blue-300 text-blue-600 dark:group-hover:text-blue-200 group-hover:text-blue-700" : 
                                col.id.startsWith('LookupC_') ? "bg-purple-400/5 dark:text-purple-300 text-purple-600 dark:group-hover:text-purple-200 group-hover:text-purple-700" : 
                                col.id.startsWith('Status_') ? "bg-emerald-400/5 font-black " + (val === 'VERDADEIRO' ? 'text-emerald-400' : 'text-red-400') : "dark:text-zinc-400 text-zinc-600 dark:group-hover:text-zinc-100 group-hover:text-zinc-900",
                                pairHighlightClasses(col.id, pairColumnMeta)
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
                      ))}
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

      {loading && step === 'configure' && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-bold text-blue-900 animate-pulse">Cruzando dados...</p>
        </div>
      )}
    </div>
  );
}

function UploadHowItWorksCollapsible() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fluent-card p-3 sm:p-4 border border-blue-500/20 bg-blue-500/[0.04] dark:bg-blue-500/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left min-h-[44px] rounded-xl -m-1 px-1 py-1"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-bold text-sm text-zinc-900 dark:text-white">
          <HelpCircle className="w-5 h-5 text-blue-500 shrink-0" aria-hidden />
          Como funciona em 3 passos
        </span>
        <ChevronDown
          className={cn('w-5 h-5 text-zinc-500 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <ol className="mt-3 pl-1 space-y-2 text-sm text-zinc-600 dark:text-zinc-400 list-decimal list-inside leading-relaxed">
          <li>
            Carregue a <strong className="text-zinc-800 dark:text-zinc-200">tabela principal</strong> e a{' '}
            <strong className="text-zinc-800 dark:text-zinc-200">tabela de busca</strong> (Excel ou CSV).
          </li>
          <li>
            Indique qual <strong className="text-zinc-800 dark:text-zinc-200">coluna liga</strong> as duas tabelas (por
            exemplo, o mesmo CPF ou código).
          </li>
          <li>
            Escolha quais colunas trazer e <strong className="text-zinc-800 dark:text-zinc-200">execute o cruzamento</strong>;
            depois pode baixar o resultado.
          </li>
        </ol>
      )}
    </div>
  );
}

/**
 * Componente de cartão para upload de arquivos Excel.
 * Exibe o status do arquivo, permite trocar de planilha e remover o arquivo.
 */
function UploadCard({ title, description, file, onUpload, onRemove, onSheetChange, onRename }: { 
  title: string; 
  description: string; 
  file: ExcelData | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onSheetChange: (sheetName: string) => void;
  onRename?: (newName: string) => void;
}) {
  const hasFile = file && file.name;
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState("");

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

  return (
    <div className={cn(
      "fluent-card p-4 transition-all group relative overflow-hidden",
      hasFile ? "ring-2 ring-blue-500/50" : "hover:ring-2 hover:ring-blue-500/30"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
          hasFile ? "bg-blue-600 text-white" : "dark:bg-white/5 bg-black/5 text-zinc-500 group-hover:text-blue-500"
        )}>
          {file ? <TableIcon size={20} /> : <FileUp size={20} />}
        </div>

        {hasFile && file ? (
          <>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2 mb-0.5">
                  <input 
                    type="text" 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    autoFocus
                    className="w-full bg-transparent border-b border-blue-500 outline-none text-xs sm:text-sm font-bold text-zinc-900 dark:text-white pb-0.5"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 group/name cursor-pointer mb-0.5" onClick={startEditing} title="Clique para renomear">
                  <span className="font-bold text-xs sm:text-sm truncate block text-zinc-900 dark:text-white">{file.name}</span>
                  <Pencil size={14} className="text-zinc-400 opacity-40 sm:opacity-0 sm:group-hover/name:opacity-100 transition-opacity shrink-0" aria-hidden />
                </div>
              )}
              <span className="text-xs text-zinc-500 font-medium">
                {file.sheets[file.selectedSheet].length} registros
              </span>
            </div>
            {Object.keys(file.sheets).length > 1 && (
              <select
                value={file.selectedSheet}
                onChange={(e) => onSheetChange(e.target.value)}
                className="fluent-select min-h-[44px] py-2 px-2 text-sm font-bold max-w-[110px] sm:max-w-[140px]"
              >
                {Object.keys(file.sheets).map(name => (
                  <option key={name} value={name} className="bg-white dark:bg-zinc-900">{name}</option>
                ))}
              </select>
            )}
            <button 
              onClick={onRemove} 
              className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-red-500/20 text-zinc-400 hover:text-red-500 transition-all rounded-lg shrink-0"
              aria-label="Remover arquivo"
              title="Remover arquivo"
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0 min-h-0">
              <span className="font-bold text-sm text-zinc-900 dark:text-white leading-tight block">{title}</span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-snug line-clamp-2 sm:line-clamp-none mt-0.5">
                {description}
              </p>
            </div>
            <label className="shrink-0 cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.xlsb,.xlsm,.ods,.csv,.tsv" onChange={onUpload} className="hidden" />
              <div className="fluent-button-primary min-h-[44px] px-4 py-2.5 cursor-pointer text-sm font-bold flex items-center gap-2 whitespace-nowrap">
                <FileSpreadsheet size={18} className="shrink-0" aria-hidden />
                <span>Importar</span>
              </div>
            </label>
          </>
        )}
      </div>

      {file && /\.csv$/i.test(file.name) && (
        <div className="flex items-start gap-2 px-2 py-2 mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium leading-relaxed">
          <Info size={14} className="shrink-0 mt-0.5" aria-hidden />
          <span>CSV detectado. Se houver caracteres incorretos, o arquivo pode usar encoding Windows-1252.</span>
        </div>
      )}
    </div>
  );
}

function ColumnFilterDropdown({
  colId,
  allData,
  selectedSet,
  sortConfig,
  onSort,
  onClearSort,
  onApply,
  onClose,
}: {
  colId: string;
  allData: any[];
  selectedSet: Set<string> | null;
  sortConfig: SortConfig | null;
  onSort: (dir: 'asc' | 'desc') => void;
  onClearSort: () => void;
  onApply: (set: Set<string> | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

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

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 w-56 dark:bg-zinc-900/95 bg-white/95 backdrop-blur-xl border dark:border-white/10 border-black/10 rounded-2xl shadow-2xl overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className="p-1 border-b dark:border-white/5 border-black/10">
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

      <div className="p-2 border-b dark:border-white/5 border-black/10">
        <input
          autoFocus
          type="text"
          placeholder="Buscar valor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 rounded-lg px-3 py-1.5 text-xs outline-none dark:text-zinc-300 text-zinc-700 placeholder:text-zinc-400 focus:border-blue-500/50"
        />
      </div>

      <div className="flex flex-wrap gap-2 px-3 py-2 border-b dark:border-white/5 border-black/10">
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

      <div className="max-h-52 overflow-y-auto custom-scrollbar py-1">
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

      <div className="p-2 border-t dark:border-white/5 border-black/10">
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
