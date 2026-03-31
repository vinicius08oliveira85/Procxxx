/**
 * Modelo de dados da tarefa de lookup e ficheiros carregados.
 */

export interface ExcelData {
  name: string;
  sheets: {
    [sheetName: string]: any[];
  };
  selectedSheet: string;
}

export interface ColumnSetting {
  id: string;
  visible: boolean;
  pinned: boolean;
  /** Largura em px na grelha de resultados; omitido = default. */
  widthPx?: number;
}

export interface LookupTask {
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
