/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

interface ExcelData {
  name: string;
  sheets: {
    [sheetName: string]: any[];
  };
  selectedSheet: string;
}

type Step = 'upload' | 'configure' | 'result';

interface ColumnSetting {
  id: string;
  visible: boolean;
  pinned: boolean;
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
    if (!activeTask.fileC) return [];
    const data = activeTask.fileC.sheets[activeTask.fileC.selectedSheet];
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

    const activeColFilters = Object.entries(columnFilters).filter(([, set]) => set.size > 0);
    if (activeColFilters.length > 0) {
      data = data.filter(row =>
        activeColFilters.every(([col, allowedSet]) =>
          allowedSet.has(String(row[col] ?? ''))
        )
      );
    }

    return data;
  }, [activeTask.resultData, activeTask.resultFilter, activeTask.fileC, columnFilters]);

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

    // Web Worker Code as a String
    const workerCode = `
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

        /**
         * Limpa e normaliza um valor para comparação com base nas configurações de limpeza.
         * @param val Valor original a ser limpo.
         * @returns Valor limpo e normalizado.
         */
        function clean(val) {
          if (val === undefined || val === null) return "";
          let s = String(val);
          if (trimSpaces) s = s.trim();
          if (ignoreCase) s = s.toLowerCase();
          if (removeSpecialChars) s = s.replace(/[^a-z0-9]/gi, '');
          return s;
        }

        /**
         * Calcula a distância de Levenshtein entre duas strings para medir a diferença entre elas.
         * @param a Primeira string.
         * @param b Segunda string.
         * @returns Número de edições necessárias para transformar a em b.
         */
        function levenshtein(a, b) {
          if (a.length === 0) return b.length;
          if (b.length === 0) return a.length;
          const matrix = [];
          for (let i = 0; i <= b.length; i++) matrix[i] = [i];
          for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
          for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
              if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
              }
            }
          }
          return matrix[b.length][a.length];
        }

        /**
         * Calcula a similaridade entre duas strings (de 0 a 1) baseada na distância de Levenshtein.
         * @param a Primeira string.
         * @param b Segunda string.
         * @returns Índice de similaridade (1.0 é idêntico).
         */
        function similarity(a, b) {
          const longer = a.length > b.length ? a : b;
          const shorter = a.length > b.length ? b : a;
          if (longer.length === 0) return 1.0;
          return (longer.length - levenshtein(longer, shorter)) / parseFloat(longer.length);
        }

        /**
         * Cria um mapa de consulta para busca rápida.
         */
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

        /**
         * Realiza busca com base no matchMode (0, -1, 1, 2).
         */
        function findMatch(valA, data, key) {
          const cleanA = clean(valA);
          if (cleanA === "") return null;

          // Se a direção for -1, invertemos a busca
          const searchData = searchDirection === -1 ? [...data].reverse() : data;

          if (matchMode === 0) {
            // Exact match
            return searchData.find(row => clean(row[key]) === cleanA);
          } else if (matchMode === -1 || matchMode === 1) {
            // Next smaller or larger
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
                if (matchMode === -1 && diff > 0 && diff < bestDiff) {
                  bestDiff = diff;
                  bestMatch = row;
                } else if (matchMode === 1 && diff < 0 && Math.abs(diff) < bestDiff) {
                  bestDiff = Math.abs(diff);
                  bestMatch = row;
                }
              } else {
                if (matchMode === -1 && cleanB < cleanA) {
                  if (bestMatch === null || cleanB > clean(bestMatch[key])) {
                    bestMatch = row;
                  }
                } else if (matchMode === 1 && cleanB > cleanA) {
                  if (bestMatch === null || cleanB < clean(bestMatch[key])) {
                    bestMatch = row;
                  }
                }
              }
            }
            return bestMatch;
          } else if (matchMode === 2) {
            // Wildcard match: escape regex special chars, then restore ? and * as wildcards
            const escaped = cleanA.replace(new RegExp("[.+^" + "$" + "{}()|\\[\\]\\\\\\\\]", "g"), "\\\\$&");
            const regexStr = "^" + escaped.replace(/[?]/g, ".").replace(/[*]/g, ".*") + "$";
            try {
              const regex = new RegExp(regexStr, ignoreCase ? "i" : "");
              return searchData.find(row => regex.test(String(row[key])));
            } catch (e) {
              return null;
            }
          }
          return null;
        }

        let result;

        if (exactMatch) {
          // Se for exactMatch mas matchMode != 0, usamos a lógica de findMatch
          // Caso contrário, usamos o lookupMap para performance
          if (matchMode === 0) {
            const searchDataB = searchDirection === -1 ? [...dataB].reverse() : dataB;
            const lookupMapB = createLookupMap(searchDataB, keyB, selectedColsB);
            
            const searchDataC = dataC && searchDirection === -1 ? [...dataC].reverse() : dataC;
            const lookupMapC = dataC ? createLookupMap(searchDataC, keyC, selectedColsC) : null;

            result = dataA.map(rowA => {
              const keyValueA = clean(rowA[keyA]);
              const matchB = lookupMapB.get(keyValueA);
              
              const newRow = { ...rowA };
              selectedColsB.forEach(col => {
                newRow['Lookup_' + col] = matchB ? matchB[col] : ifNotFound;
              });
              newRow['_match_found_B'] = !!matchB;
              if (includeStatusCols) {
                newRow['Status_B'] = matchB ? "VERDADEIRO" : "FALSO";
              }

              let matchFoundC = false;
              if (lookupMapC) {
                const keyValueA_C = clean(rowA[keyA_C]);
                const matchC = lookupMapC.get(keyValueA_C);
                selectedColsC.forEach(col => {
                  newRow['LookupC_' + col] = matchC ? matchC[col] : ifNotFoundC;
                });
                matchFoundC = !!matchC;
                newRow['_match_found_C'] = matchFoundC;
                if (includeStatusCols) {
                  newRow['Status_C'] = matchFoundC ? "VERDADEIRO" : "FALSO";
                }
              }

              newRow['_match_found'] = !!matchB || matchFoundC;
              if (includeStatusCols && lookupMapC) {
                newRow['Status_Ambas'] = (!!matchB && matchFoundC) ? "VERDADEIRO" : "FALSO";
              }

              return newRow;
            });
          } else {
            result = dataA.map(rowA => {
              const matchB = findMatch(rowA[keyA], dataB, keyB);
              const newRow = { ...rowA };
              selectedColsB.forEach(col => {
                newRow['Lookup_' + col] = matchB ? matchB[col] : ifNotFound;
              });
              newRow['_match_found_B'] = !!matchB;
              if (includeStatusCols) {
                newRow['Status_B'] = matchB ? "VERDADEIRO" : "FALSO";
              }

              let matchFoundC = false;
              if (dataC) {
                const matchC = findMatch(rowA[keyA_C], dataC, keyC);
                selectedColsC.forEach(col => {
                  newRow['LookupC_' + col] = matchC ? matchC[col] : ifNotFoundC;
                });
                matchFoundC = !!matchC;
                newRow['_match_found_C'] = matchFoundC;
                if (includeStatusCols) {
                  newRow['Status_C'] = matchFoundC ? "VERDADEIRO" : "FALSO";
                }
              }

              newRow['_match_found'] = !!matchB || matchFoundC;
              if (includeStatusCols && dataC) {
                newRow['Status_Ambas'] = (!!matchB && matchFoundC) ? "VERDADEIRO" : "FALSO";
              }
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
                if (sim > highestSimB && sim >= fuzzyThreshold) {
                  highestSimB = sim;
                  bestMatchB = rowB;
                }
                if (highestSimB === 1) break;
              }

              selectedColsB.forEach(col => {
                newRow['Lookup_' + col] = bestMatchB ? bestMatchB[col] : ifNotFound;
              });
              newRow['_match_found_B'] = !!bestMatchB;
              if (includeStatusCols) {
                newRow['Status_B'] = bestMatchB ? "VERDADEIRO" : "FALSO";
              }
            }

            let matchFoundC = false;
            if (dataC) {
              const strA_C = clean(rowA[keyA_C]);
              if (strA_C === "") {
                selectedColsC.forEach(col => newRow['LookupC_' + col] = ifNotFoundC);
                matchFoundC = false;
                newRow['_match_found_C'] = false;
                if (includeStatusCols) {
                  newRow['Status_C'] = "FALSO";
                }
              } else {
                let bestMatchC = null;
                let highestSimC = 0;

                for (const rowC of dataC) {
                  const strC = clean(rowC[keyC]);
                  if (strC === "") continue;

                  const sim = similarity(strA_C, strC);
                  if (sim > highestSimC && sim >= fuzzyThreshold) {
                    highestSimC = sim;
                    bestMatchC = rowC;
                  }
                  if (highestSimC === 1) break;
                }

                selectedColsC.forEach(col => {
                  newRow['LookupC_' + col] = bestMatchC ? bestMatchC[col] : ifNotFoundC;
                });
                matchFoundC = !!bestMatchC;
                newRow['_match_found_C'] = matchFoundC;
                if (includeStatusCols) {
                  newRow['Status_C'] = matchFoundC ? "VERDADEIRO" : "FALSO";
                }
              }
            }

            newRow['_match_found'] = newRow['_match_found_B'] || matchFoundC;
            if (includeStatusCols && dataC) {
              newRow['Status_Ambas'] = (newRow['_match_found_B'] && matchFoundC) ? "VERDADEIRO" : "FALSO";
            }

            return newRow;
          });
        }

        self.postMessage(result);
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
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

    // 1. Detect Key Columns (Exact or fuzzy match)
    const commonKeys = ["id", "cpf", "cnpj", "email", "e-mail", "codigo", "código", "sku", "nome", "name"];
    let bestKeyA = "";
    let bestKeyB = "";

    // Try exact matches first
    for (const hA of headersA) {
      const normalizedA = hA.toLowerCase().trim();
      if (headersB.some(hB => hB.toLowerCase().trim() === normalizedA)) {
        bestKeyA = hA;
        bestKeyB = headersB.find(hB => hB.toLowerCase().trim() === normalizedA) || "";
        break;
      }
    }

    // If no exact match, try common keys
    if (!bestKeyA) {
      for (const key of commonKeys) {
        const foundA = headersA.find(h => h.toLowerCase().includes(key));
        const foundB = headersB.find(h => h.toLowerCase().includes(key));
        if (foundA && foundB) {
          bestKeyA = foundA;
          bestKeyB = foundB;
          break;
        }
      }
    }

    if (bestKeyA && bestKeyB) {
      updateActiveTask({ keyA: bestKeyA, keyB: bestKeyB });
    }

    // 2. Detect Return Columns (Columns in B that are NOT the key and NOT in A)
    const suggestedCols = headersB.filter(hB => 
      hB !== bestKeyB && 
      !headersA.some(hA => hA.toLowerCase().trim() === hB.toLowerCase().trim())
    );

    if (suggestedCols.length > 0) {
      updateActiveTask({ selectedColsB: suggestedCols });
    } else if (headersB.length > 1) {
      // If no "new" columns, just suggest the first non-key column
      const firstOther = headersB.find(h => h !== bestKeyB);
      if (firstOther) updateActiveTask({ selectedColsB: [firstOther] });
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
      <div className="relative z-10 min-h-screen flex flex-col p-2 sm:p-4 md:p-6 lg:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="windows-window flex flex-col max-w-7xl mx-auto w-full"
        >
          {/* App Header (Inside Window) */}
          <header className="py-3 sm:py-4 flex items-center justify-between px-4 sm:px-6 md:px-8 bg-white/5 dark:bg-zinc-900/5 border-b border-white/10 dark:border-white/5">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tighter bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
                  Lookup Master
                </h1>
              </div>
            </div>

            <StepIndicator currentStep={step} />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-black/5 dark:border-white/5">
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-90"
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
          </header>

          {/* Main Content Area */}
          <div className="p-3 sm:p-4 md:p-6 pb-8">
            <AnimatePresence mode="wait">
              {step === 'upload' && (
                <motion.div 
                  key="upload"
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.02, y: -10 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="max-w-5xl mx-auto"
                >
              <div className="grid md:grid-cols-2 gap-3 md:gap-4">
                <UploadCard 
                  title="Tabela Principal (A)" 
                  description="O arquivo base que receberá os novos dados."
                  file={activeTask.fileA}
                  onUpload={(e) => handleFileUpload(e, 'A')}
                  onRemove={() => updateActiveTask({ fileA: null })}
                  onSheetChange={(sheetName) => updateActiveTask({ fileA: activeTask.fileA ? { ...activeTask.fileA, selectedSheet: sheetName } : null })}
                />
                <UploadCard 
                  title="Tabela de Busca (B)" 
                  description="O arquivo onde buscaremos as informações."
                  file={activeTask.fileB}
                  onUpload={(e) => handleFileUpload(e, 'B')}
                  onRemove={() => updateActiveTask({ fileB: null })}
                  onSheetChange={(sheetName) => updateActiveTask({ fileB: activeTask.fileB ? { ...activeTask.fileB, selectedSheet: sheetName } : null })}
                />
              </div>

              <div className="mt-4 flex flex-col items-center gap-3">
                  <button 
                    onClick={() => updateActiveTask({ fileC: activeTask.fileC ? null : { name: '', sheets: {}, selectedSheet: '' } })}
                    className={cn(
                      "px-6 py-2 rounded-xl text-sm font-black transition-all active:scale-95",
                      activeTask.fileC 
                        ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" 
                        : "bg-white/5 text-zinc-400 hover:text-zinc-100 border border-white/5 hover:border-white/10"
                    )}
                  >
                    {activeTask.fileC ? "Remover Tabela C" : "Adicionar Tabela C (Opcional)"}
                  </button>

                {activeTask.fileC && activeTask.fileC.name && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="w-full max-w-md"
                  >
                    <UploadCard 
                      title="Tabela de Busca (C)" 
                      description="Uma segunda fonte de dados opcional para cruzamento múltiplo."
                      file={activeTask.fileC}
                      onUpload={(e) => handleFileUpload(e, 'C')}
                      onRemove={() => updateActiveTask({ fileC: null })}
                      onSheetChange={(sheetName) => updateActiveTask({ fileC: activeTask.fileC ? { ...activeTask.fileC, selectedSheet: sheetName } : null })}
                    />
                  </motion.div>
                )}

                <button
                  disabled={!activeTask.fileA || !activeTask.fileB}
                  onClick={() => setStep('configure')}
                  className="fluent-button-primary w-full sm:w-auto mt-2 px-8 sm:px-12 py-4 text-base sm:text-lg group shadow-[0_12px_32px_rgba(37,99,235,0.3)]"
                >
                  Continuar para Configuração
                  <ArrowRight size={20} className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'configure' && (
            <motion.div 
              key="configure"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-5xl mx-auto space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-1 sm:gap-2 p-1 sm:p-1.5 mica rounded-xl sm:rounded-2xl border border-white/20 dark:border-white/10 w-full sm:w-fit overflow-x-auto">
                  {[
                    { id: 'keys', label: 'Chaves', icon: Target },
                    { id: 'columns', label: 'Colunas', icon: Columns },
                    { id: 'advanced', label: 'Avançado', icon: Settings2 }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setConfigTab(tab.id as any)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-300 font-medium text-xs whitespace-nowrap flex-1 sm:flex-none justify-center",
                        configTab === tab.id 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-white/5"
                      )}
                    >
                      <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="group relative shrink-0">
                  <button
                    onClick={autoDetectConfig}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-blue-400 rounded-lg font-bold text-xs transition-all border border-white/10 active:scale-95"
                  >
                    <Sparkles size={14} className="group-hover/btn:rotate-12 transition-transform text-blue-500" /> 
                    Auto-Detectar
                  </button>
                  <div className="absolute bottom-full right-0 mb-3 w-72 p-4 bg-zinc-900/95 backdrop-blur-xl text-white text-xs rounded-2xl opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 pointer-events-none z-50 shadow-2xl border border-white/10 font-medium">
                    <p className="font-black mb-2 text-blue-400 uppercase tracking-widest text-[10px]">Sugestão Inteligente</p>
                    <p className="opacity-80 leading-relaxed">O sistema analisará os cabeçalhos das tabelas para sugerir automaticamente as melhores chaves de busca e colunas de retorno.</p>
                  </div>
                </div>
              </div>

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
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Tabela A → B</h3>
                            <p className="text-[11px] text-zinc-500">Defina como as tabelas se conectam</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Chave na Tabela A</label>
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
                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Chave na Tabela B</label>
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
                              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Tabela A → C</h3>
                              <p className="text-[11px] text-zinc-500">Conexão com a tabela secundária</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Chave na Tabela A</label>
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
                              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Chave na Tabela C</label>
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
                              <Columns size={14} className="text-zinc-400" /> Colunas da Tabela A (Base)
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
                              placeholder="Filtrar colunas da Tabela A..."
                              className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-black/20 focus:border-blue-500 outline-none text-xs text-zinc-300 font-medium"
                              onChange={(e) => setSearchTermA(e.target.value.toLowerCase())}
                            />
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateActiveTask({ selectedColsA: headersA })}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-400 hover:bg-white/5 transition-all border border-white/5"
                            >
                              Selecionar Tudo
                            </button>
                            <button
                              onClick={() => updateActiveTask({ selectedColsA: [] })}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 hover:bg-white/5 transition-all border border-white/5"
                            >
                              Todas (padrão)
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
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
                                  : "border-white/5 bg-black/20 text-zinc-500 hover:border-white/20 hover:bg-white/5"
                              )}
                            >
                              <span className="truncate z-10">{h}</span>
                              {activeTask.selectedColsA.includes(h) ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="z-10">
                                  <CheckCircle2 size={16} className="text-zinc-400" />
                                </motion.div>
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-white/10 group-hover:border-zinc-400" />
                              )}
                            </button>
                          ))}
                        </div>

                        {activeTask.selectedColsA.length === 0 && (
                          <p className="text-[10px] text-zinc-500 italic">Nenhuma coluna selecionada = todas as colunas de A serão incluídas no resultado.</p>
                        )}
                      </div>

                      {/* Configuração Tabela B */}
                      <div className="fluent-card p-3 sm:p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h2 className="text-sm font-black flex items-center gap-1.5">
                              <Columns size={14} className="text-blue-600" /> Retorno da Tabela B
                              <div className="group relative">
                                <Info size={13} className="text-zinc-500 cursor-help" />
                                <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-zinc-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl font-normal">
                                  <p className="font-bold mb-1">O que trazer de volta?</p>
                                  <p className="opacity-80">Selecione as colunas da Tabela B que você deseja anexar à sua Tabela A quando houver uma correspondência.</p>
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
                              placeholder="Filtrar colunas da Tabela B..."
                              className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-black/20 focus:border-blue-500 outline-none text-xs text-zinc-300 font-medium"
                              onChange={(e) => setSearchTermB(e.target.value.toLowerCase())}
                            />
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => updateActiveTask({ selectedColsB: headersB })}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-blue-400 hover:bg-white/5 transition-all border border-white/5"
                            >
                              Selecionar Tudo
                            </button>
                            <button 
                              onClick={() => updateActiveTask({ selectedColsB: [] })}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 hover:bg-white/5 transition-all border border-white/5"
                            >
                              Limpar
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
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
                                  : "border-white/5 bg-black/20 text-zinc-500 hover:border-white/20 hover:bg-white/5"
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
                                <div className="w-4 h-4 rounded-full border border-white/10 group-hover:border-blue-400" />
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
                                <Columns size={14} className="text-purple-400" /> Retorno da Tabela C
                                <div className="group relative">
                                  <Info size={13} className="text-zinc-500 cursor-help" />
                                  <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-zinc-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl font-normal">
                                    <p className="font-bold mb-1">O que trazer da Tabela C?</p>
                                    <p className="opacity-80">Selecione as colunas da Tabela C que você deseja anexar à sua Tabela A.</p>
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
                                className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-black/20 focus:border-blue-500 outline-none text-xs text-zinc-300 font-medium"
                                onChange={(e) => setSearchTermC(e.target.value.toLowerCase())}
                              />
                            </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => updateActiveTask({ selectedColsC: headersC })}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-purple-400 hover:bg-white/5 transition-all border border-white/5"
                              >
                                Selecionar Tudo
                              </button>
                              <button 
                                onClick={() => updateActiveTask({ selectedColsC: [] })}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 hover:bg-white/5 transition-all border border-white/5"
                              >
                                Limpar
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
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
                                    : "border-white/5 bg-black/20 text-zinc-500 hover:border-white/20 hover:bg-white/5"
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
                                  <div className="w-4 h-4 rounded-full border border-white/10 group-hover:border-purple-400" />
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
                          <Settings2 size={14} className="text-blue-600" /> Opções Avançadas
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-2 p-3 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                              <Zap size={12} className="text-blue-400" /> Limpeza de Dados
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-zinc-500 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-zinc-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="font-bold mb-1">Tratamento de Dados</p>
                                <p className="opacity-80">Essas opções ajudam a normalizar os valores antes da comparação, evitando erros por espaços extras ou diferenças entre maiúsculas e minúsculas.</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {[
                              { id: 'trimSpaces', label: 'Remover espaços extras', field: 'trimSpaces', help: 'Remove espaços no início e fim do texto.' },
                              { id: 'ignoreCase', label: 'Ignorar Maiúsculas/Minúsculas', field: 'ignoreCase', help: 'Trata "TEXTO" e "texto" como iguais.' },
                              { id: 'removeSpecialChars', label: 'Remover Caracteres Especiais', field: 'removeSpecialChars', help: 'Remove acentos e símbolos (ex: "ç" vira "c").' }
                            ].map((opt) => (
                              <div key={opt.id} className="flex items-center justify-between group/item">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className="relative flex items-center">
                                    <input 
                                      type="checkbox" 
                                      checked={(activeTask as any)[opt.field]} 
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
                                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
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
                              <Layers size={12} className="text-blue-500" /> Estratégia de Duplicatas
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="font-bold mb-1">Lidando com Repetições</p>
                                <p className="opacity-80">Define o que fazer quando a chave de busca aparece mais de uma vez na Tabela B. Você pode escolher o primeiro, o último ou combinar todos os resultados encontrados.</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <select 
                              value={activeTask.duplicateStrategy}
                              onChange={(e: any) => updateActiveTask({ duplicateStrategy: e.target.value })}
                              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                            >
                              <option value="first">Pegar Primeiro Encontro</option>
                              <option value="last">Pegar Último Encontro</option>
                              <option value="concatenate">Concatenar Valores (;) </option>
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
                              <Target size={12} className="text-blue-500" /> Modo de Correspondência
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="font-bold mb-1">Tipo de Busca (PROCX)</p>
                                <p className="opacity-80">Define como o sistema deve se comportar se não encontrar o valor exato. Pode buscar o próximo menor, maior ou usar curingas.</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <select 
                              value={activeTask.matchMode}
                              onChange={(e: any) => updateActiveTask({ matchMode: parseInt(e.target.value) })}
                              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                              disabled={!activeTask.exactMatch}
                            >
                              <option value="0">0 - Correspondência Exata</option>
                              <option value="-1">-1 - Exata ou Próximo Menor</option>
                              <option value="1">1 - Exata ou Próximo Maior</option>
                              <option value="2">2 - Correspondência de Curinga (*, ?)</option>
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
                              <Activity size={12} className="text-blue-500" /> Precisão Fuzzy ({Math.round(activeTask.fuzzyThreshold * 100)}%)
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="font-bold mb-1">Sensibilidade da Busca</p>
                                <p className="opacity-80">Define o quão parecidos os textos devem ser. 100% exige igualdade total. 80% permite pequenas variações ou erros de digitação.</p>
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
                              <CheckCircle2 size={12} className="text-blue-500" /> Colunas de Status de Existência
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="font-bold mb-1">Indicadores de Match</p>
                                <p className="opacity-80">Adiciona colunas extras indicando "VERDADEIRO" ou "FALSO" para a existência do registro em cada tabela.</p>
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
                              Incluir colunas de status (Status_B, Status_C, Status_Ambas)
                            </span>
                          </div>
                        </div>

                        {/* Valor se não encontrado */}
                        <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 sm:col-span-2 md:col-span-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                              <HelpCircle size={12} className="text-blue-500" /> Valor se não encontrado (if_not_found)
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="font-bold mb-1">Tratamento de Erros</p>
                                <p className="opacity-80">Define o que será exibido nas colunas de retorno quando a busca não encontrar um correspondente. Similar ao parâmetro [if_not_found] do PROCX.</p>
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
                              <ArrowUpDown size={12} className="text-blue-500" /> Direção da Busca
                            </h3>
                            <div className="group relative">
                              <Info size={11} className="text-slate-400 cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="font-bold mb-1">Ordem de Pesquisa (PROCX)</p>
                                <p className="opacity-80">Define se o sistema deve começar a procurar do início para o fim ou do fim para o início da tabela.</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <select 
                              value={activeTask.searchDirection}
                              onChange={(e: any) => updateActiveTask({ searchDirection: parseInt(e.target.value) })}
                              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                            >
                              <option value="1">1 - Do Primeiro ao Último</option>
                              <option value="-1">-1 - Do Último ao Primeiro</option>
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

              <div className="flex justify-between items-center pt-2">
                <button 
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 text-xs"
                >
                  Voltar
                </button>
                <div className="flex items-center gap-2">
                  {configTab !== 'advanced' && (
                    <button
                      onClick={() => setConfigTab(configTab === 'keys' ? 'columns' : 'advanced')}
                      className="px-4 py-2 rounded-lg font-bold text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all border border-blue-100 dark:border-blue-900/40"
                    >
                      Próximo
                    </button>
                  )}
                  <button
                    disabled={!validation.isValid || loading}
                    onClick={performLookup}
                    className={cn(
                      "px-5 py-2 rounded-lg font-black text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95",
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
              className="max-w-6xl mx-auto space-y-4"
            >
              {/* Dashboard Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                    <div className="flex flex-col sm:items-center">
                      <span className="text-lg sm:text-xl font-black leading-tight">{stat.value}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider leading-tight">{stat.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="fluent-card overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-white/5 space-y-2">
                  {/* Linha principal: filtros + ações */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Esquerda: título + tabs de filtro + botão pares */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black tracking-tight">Resultados</h2>
                      <div className="flex p-1 bg-white/5 rounded-xl gap-1 border border-white/5">
                        {[
                          { id: 'all', label: 'Todos', icon: Layers },
                          { id: 'matched', label: 'Encontrados', icon: CheckCircle2 },
                          { id: 'orphans', label: 'Órfãos', icon: AlertCircle },
                          { id: 'divergent', label: 'Divergentes', icon: ArrowUpDown },
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => updateActiveTask({ resultFilter: f.id as any })}
                            className={cn(
                              "flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-all",
                              activeTask.resultFilter === f.id && f.id === 'divergent'
                                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                                : activeTask.resultFilter === f.id
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "text-zinc-500 hover:text-zinc-200"
                            )}
                          >
                            <f.icon size={14} /> {f.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setShowDivergentConfig(v => !v)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                          showDivergentConfig
                            ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                            : activeTask.divergentPairs.length > 0
                            ? "text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                            : "text-zinc-500 border-white/10 hover:bg-white/5 hover:text-zinc-200"
                        )}
                        title="Configurar pares de divergência"
                      >
                        <Settings2 size={13} />
                        {activeTask.divergentPairs.length > 0 ? `${activeTask.divergentPairs.length} par(es)` : 'Pares'}
                      </button>
                    </div>

                    {/* Direita: botões de ação — sempre visíveis */}
                    <div className="flex items-center gap-2 shrink-0">
                      {Object.values(columnFilters).some(s => s.size > 0) && (
                        <button
                          onClick={() => setColumnFilters({})}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-all active:scale-95"
                        >
                          <X size={13} /> Limpar Filtros
                        </button>
                      )}
                      <button
                        onClick={() => setStep('configure')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-white/10 transition-all active:scale-95"
                      >
                        <Settings2 size={14} /> Editar Config.
                      </button>
                      <button
                        onClick={downloadResult}
                        className="fluent-button-primary px-4 py-2 text-xs"
                      >
                        <Download size={14} /> Baixar Excel
                      </button>
                    </div>
                  </div>

                  {/* Painel de configuração de pares — linha separada */}
                  {showDivergentConfig && (
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
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

                <div className="flex-1 overflow-auto rounded-[32px] border border-white/10 bg-black/40 shadow-inner backdrop-blur-xl custom-scrollbar">
                  <table className="w-full min-w-[600px] text-left border-collapse">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-zinc-900/90 backdrop-blur-2xl">
                        {displayColumns.map(col => (
                          <th key={col.id} className={cn(
                            "px-4 sm:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]",
                            col.id.startsWith('Lookup_') ? "text-blue-400 bg-blue-400/5" : 
                            col.id.startsWith('LookupC_') ? "text-purple-400 bg-purple-400/5" :
                            col.id.startsWith('Status_') ? "text-emerald-400 bg-emerald-400/5" :
                            "text-zinc-500"
                          )}>
                            {col.id}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-zinc-900/80 border-b border-white/10">
                        {displayColumns.map(col => (
                          <th key={col.id} className={cn(
                            "px-2 sm:px-3 py-2 relative",
                            col.id.startsWith('Lookup_') ? "bg-blue-400/5" :
                            col.id.startsWith('LookupC_') ? "bg-purple-400/5" :
                            col.id.startsWith('Status_') ? "bg-emerald-400/5" : ""
                          )}>
                            <button
                              onClick={() => setOpenFilterCol(openFilterCol === col.id ? null : col.id)}
                              className={cn(
                                "w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                columnFilters[col.id]?.size > 0
                                  ? "bg-blue-500/15 border border-blue-500/40 text-blue-400"
                                  : "bg-white/5 border border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                              )}
                            >
                              <span className="truncate">
                                {columnFilters[col.id]?.size > 0
                                  ? `${columnFilters[col.id].size} selecionado${columnFilters[col.id].size > 1 ? 's' : ''}`
                                  : 'Filtrar...'}
                              </span>
                              <Filter size={10} className="shrink-0" />
                            </button>

                            {openFilterCol === col.id && (
                              <ColumnFilterDropdown
                                colId={col.id}
                                allData={activeTask.resultData ?? []}
                                selectedSet={columnFilters[col.id] ?? null}
                                onApply={(set) => {
                                  setColumnFilters(prev => {
                                    const next = { ...prev };
                                    if (set === null || set.size === 0) {
                                      delete next[col.id];
                                    } else {
                                      next[col.id] = set;
                                    }
                                    return next;
                                  });
                                  setOpenFilterCol(null);
                                }}
                                onClose={() => setOpenFilterCol(null)}
                              />
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredResultData.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-all group">
                          {displayColumns.map(col => {
                            const val = row[col.id];
                            return (
                              <td key={col.id} className={cn(
                                "px-4 sm:px-6 py-3 text-xs font-medium whitespace-nowrap transition-colors",
                                col.id.startsWith('Lookup_') ? "bg-blue-400/5 text-blue-300 group-hover:text-blue-200" : 
                                col.id.startsWith('LookupC_') ? "bg-purple-400/5 text-purple-300 group-hover:text-purple-200" : 
                                col.id.startsWith('Status_') ? "bg-emerald-400/5 font-black " + (val === 'VERDADEIRO' ? 'text-emerald-400' : 'text-red-400') : "text-zinc-400 group-hover:text-zinc-100"
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
                      <p className="text-slate-500 font-bold">Nenhum resultado encontrado para este filtro.</p>
                    </div>
                  )}
                  {filteredResultData.length > 50 && (
                    <div className="p-6 text-center text-slate-400 text-xs font-bold bg-slate-50 dark:bg-slate-800/50 uppercase tracking-widest">
                      Exibindo as primeiras 50 de {filteredResultData.length} linhas
                      {Object.values(columnFilters).some(s => s.size > 0) ? ' (filtros ativos)' : ''}. Baixe o arquivo para ver tudo.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

        </motion.div>
      </div>

      {error && (
        <div className="fixed bottom-8 right-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-2xl flex items-start gap-3 max-w-md animate-bounce z-[200]">
          <AlertCircle className="text-red-500 shrink-0" />
          <div>
            <h4 className="font-bold text-red-800">Ops!</h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
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

  /**
   * Componente de cartão para upload de arquivos Excel.
   * Exibe o status do arquivo, permite trocar de planilha e remover o arquivo.
   */
function UploadCard({ title, description, file, onUpload, onRemove, onSheetChange }: { 
  title: string; 
  description: string; 
  file: ExcelData | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onSheetChange: (sheetName: string) => void;
}) {
  return (
    <div className={cn(
      "fluent-card p-3 transition-all group relative overflow-hidden",
      file ? "ring-2 ring-blue-500/50" : "hover:ring-2 hover:ring-blue-500/30"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
          file ? "bg-blue-600 text-white" : "bg-white/5 text-zinc-500 group-hover:text-blue-500"
        )}>
          {file ? <TableIcon size={18} /> : <FileUp size={18} />}
        </div>

        {file ? (
          <>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm truncate block text-zinc-900 dark:text-white">{file.name}</span>
              <span className="text-[10px] text-zinc-500 font-medium">
                {file.sheets[file.selectedSheet].length} registros
              </span>
            </div>
            {Object.keys(file.sheets).length > 1 && (
              <select
                value={file.selectedSheet}
                onChange={(e) => onSheetChange(e.target.value)}
                className="fluent-select py-1.5 px-2 text-xs font-bold max-w-[130px]"
              >
                {Object.keys(file.sheets).map(name => (
                  <option key={name} value={name} className="bg-white dark:bg-zinc-900">{name}</option>
                ))}
              </select>
            )}
            <button onClick={onRemove} className="p-1.5 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 transition-all rounded-lg shrink-0">
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm text-zinc-900 dark:text-white">{title}</span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-tight truncate">{description}</p>
            </div>
            <label className="shrink-0">
              <input type="file" accept=".xlsx,.xls,.xlsb,.xlsm,.ods,.csv,.tsv" onChange={onUpload} className="hidden" />
              <div className="fluent-button-primary py-1.5 px-3 cursor-pointer text-xs font-black uppercase tracking-wider whitespace-nowrap">
                Importar
              </div>
            </label>
          </>
        )}
      </div>

      {file && /\.csv$/i.test(file.name) && (
        <div className="flex items-start gap-2 px-2 py-1.5 mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium leading-relaxed">
          <Info size={11} className="shrink-0 mt-0.5" />
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
  onApply,
  onClose,
}: {
  colId: string;
  allData: any[];
  selectedSet: Set<string> | null;
  onApply: (set: Set<string> | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  const uniqueValues = React.useMemo(() => {
    const vals = new Set(allData.map(row => String(row[colId] ?? '')));
    return [...vals].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [allData, colId]);

  const displayed = uniqueValues.filter(v =>
    v.toLowerCase().includes(search.toLowerCase())
  );

  const isAllSelected = selectedSet === null;

  const isChecked = (val: string) => isAllSelected || selectedSet!.has(val);

  const toggle = (val: string) => {
    const base = isAllSelected ? new Set(uniqueValues) : new Set(selectedSet!);
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
      className="absolute z-50 top-full left-0 mt-1 w-56 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className="p-2 border-b border-white/5">
        <input
          autoFocus
          type="text"
          placeholder="Buscar valor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none text-zinc-300 placeholder:text-zinc-600 focus:border-blue-500/50"
        />
      </div>

      <div className="flex gap-3 px-3 py-2 border-b border-white/5">
        <button
          onClick={() => onApply(null)}
          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
        >
          Selecionar Tudo
        </button>
        <button
          onClick={() => onApply(new Set())}
          className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Limpar
        </button>
      </div>

      <div className="max-h-52 overflow-y-auto custom-scrollbar py-1">
        {displayed.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-4">Nenhum valor encontrado</p>
        ) : (
          displayed.map(val => (
            <label
              key={val}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/5 cursor-pointer group"
            >
              <div
                className={cn(
                  "w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0",
                  isChecked(val)
                    ? "bg-blue-600 border-blue-500"
                    : "border-white/20 bg-white/5 group-hover:border-blue-500/40"
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
                className="text-xs text-zinc-300 truncate flex-1"
                onClick={() => toggle(val)}
              >
                {val === '' ? <span className="italic text-zinc-600">(vazio)</span> : val}
              </span>
            </label>
          ))
        )}
      </div>

      <div className="p-2 border-t border-white/5">
        <button
          onClick={onClose}
          className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-colors"
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
  const steps: { id: Step; label: string; icon: any }[] = [
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'configure', label: 'Configurar', icon: Settings },
    { id: 'result', label: 'Resultado', icon: CheckCircle2 }
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
                "flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-[18px] transition-all duration-500",
                isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-105" : 
                isCompleted ? "text-emerald-500 hover:bg-emerald-500/10" : "text-zinc-500 hover:bg-white/5"
              )}>
                <div className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] font-black transition-all duration-500",
                  isActive ? "bg-white/20" : isCompleted ? "bg-emerald-500/20" : "bg-white/5"
                )}>
                  {isCompleted ? <CheckCircle2 size={12} /> : i + 1}
                </div>
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-[0.2em]">
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight size={10} className="mx-0.5 opacity-20" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
