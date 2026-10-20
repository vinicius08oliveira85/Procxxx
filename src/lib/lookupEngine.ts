/**
 * Motor de cruzamento (PROCV/XLOOKUP) — puro, sem DOM, executado no Web Worker.
 *
 * Fica fora de `App.tsx` para poder ser testado diretamente (o antigo worker era
 * uma string dentro do componente, sem cobertura de testes).
 */

export type LookupRow = Record<string, unknown>;

export type DuplicateStrategy = 'first' | 'last' | 'concatenate';
export type LookupMatchMode = 0 | -1 | 1 | 2;
export type SearchDirection = 1 | -1;

export type LookupOptions = {
  trimSpaces: boolean;
  ignoreCase: boolean;
  removeSpecialChars: boolean;
};

export type LookupPayload = {
  dataA: LookupRow[] | null;
  dataB: LookupRow[] | null;
  keyA: string;
  keyB: string;
  selectedColsA: string[];
  selectedColsB: string[];
  dataC?: LookupRow[] | null;
  keyA_C?: string;
  keyC?: string;
  selectedColsC?: string[];
  exactMatch: boolean;
  trimSpaces: boolean;
  ignoreCase: boolean;
  removeSpecialChars: boolean;
  duplicateStrategy: DuplicateStrategy;
  fuzzyThreshold: number;
  ifNotFound: string;
  ifNotFoundC: string;
  matchMode: LookupMatchMode;
  searchDirection: SearchDirection;
  includeStatusCols: boolean;
};

/** Mensagem enviada pelo worker de volta ao App. */
export type LookupWorkerMessage = LookupRow[] | { error: string };

/** Mesma normalização usada na busca e no filtro de duplicados. */
export function normalizeKeyValue(val: unknown, opts: LookupOptions): string {
  if (val === undefined || val === null) return '';
  let s = String(val);
  if (opts.trimSpaces) s = s.trim();
  if (opts.ignoreCase) s = s.toLowerCase();
  if (opts.removeSpecialChars) s = s.replace(/[^a-z0-9]/gi, '');
  return s;
}

/** Levenshtein com O(min(m,n)) de memória. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let s = a;
  let t = b;
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
    const temp = v0;
    v0 = v1;
    v1 = temp;
  }
  return v0[sLen];
}

export function similarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
}

function escapeRegexChar(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Converte um valor com curingas (`*` e `?`) em fonte de RegExp segura. */
export function wildcardToRegexSource(pattern: string): string {
  let out = '';
  for (const ch of pattern) {
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += escapeRegexChar(ch);
  }
  return out;
}

function createLookupMap(
  rows: LookupRow[],
  key: string,
  cols: string[],
  opts: LookupOptions,
  strategy: DuplicateStrategy
): Map<string, LookupRow> {
  const map = new Map<string, LookupRow>();
  for (const row of rows) {
    const k = normalizeKeyValue(row[key], opts);
    if (k === '') continue;
    const existing = map.get(k);
    if (!existing) {
      map.set(k, row);
      continue;
    }
    if (strategy === 'first') continue;
    if (strategy === 'last') {
      map.set(k, row);
      continue;
    }
    // concatenate — nunca escreve "undefined" quando a coluna falta numa das linhas
    const merged: LookupRow = { ...existing };
    for (const col of cols) {
      const v = row[col];
      if (v === undefined || v === null || v === '') continue;
      const prev = merged[col];
      merged[col] =
        prev === undefined || prev === null || prev === ''
          ? v
          : `${String(prev)}; ${String(v)}`;
    }
    map.set(k, merged);
  }
  return map;
}

function findNumericOrTextMatch(
  rows: LookupRow[],
  key: string,
  target: unknown,
  opts: LookupOptions,
  mode: -1 | 1
): LookupRow | null {
  const cleanTarget = normalizeKeyValue(target, opts);
  if (cleanTarget === '') return null;

  let best: LookupRow | null = null;
  let bestDiff = Infinity;

  for (const row of rows) {
    const rawB = row[key];
    const cleanB = normalizeKeyValue(rawB, opts);
    if (cleanB === cleanTarget) return row;

    const numA = parseFloat(String(target));
    const numB = parseFloat(String(rawB));
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      const diff = numA - numB;
      if (mode === -1 && diff > 0 && diff < bestDiff) {
        bestDiff = diff;
        best = row;
      } else if (mode === 1 && diff < 0 && Math.abs(diff) < bestDiff) {
        bestDiff = Math.abs(diff);
        best = row;
      }
    } else if (mode === -1 && cleanB < cleanTarget) {
      if (best === null || cleanB > normalizeKeyValue(best[key], opts)) best = row;
    } else if (mode === 1 && cleanB > cleanTarget) {
      if (best === null || cleanB < normalizeKeyValue(best[key], opts)) best = row;
    }
  }
  return best;
}

function findWildcardMatch(
  rows: LookupRow[],
  key: string,
  target: unknown,
  opts: LookupOptions
): LookupRow | null {
  const cleanTarget = normalizeKeyValue(target, opts);
  if (cleanTarget === '') return null;

  let regex: RegExp;
  try {
    regex = new RegExp(`^${wildcardToRegexSource(cleanTarget)}$`);
  } catch {
    return null;
  }
  return rows.find((row) => regex.test(normalizeKeyValue(row[key], opts))) ?? null;
}

function findFuzzyMatch(
  rows: LookupRow[],
  key: string,
  target: string,
  opts: LookupOptions,
  threshold: number
): LookupRow | null {
  let best: LookupRow | null = null;
  let highest = 0;
  for (const row of rows) {
    const candidate = normalizeKeyValue(row[key], opts);
    if (candidate === '') continue;
    const sim = similarity(target, candidate);
    if (sim > highest && sim >= threshold) {
      highest = sim;
      best = row;
    }
    if (highest === 1) break;
  }
  return best;
}

/**
 * Executa o cruzamento e devolve as linhas resultantes.
 * Lança `Error('Dados ausentes')` quando A ou B não foram fornecidos.
 */
export function applyLookup(payload: LookupPayload): LookupRow[] {
  const {
    dataA: rawDataA,
    dataB: rawDataB,
    keyA,
    keyB,
    selectedColsA,
    selectedColsB,
    dataC: rawDataC,
    keyA_C,
    keyC,
    selectedColsC,
    exactMatch,
    duplicateStrategy,
    fuzzyThreshold,
    ifNotFound,
    ifNotFoundC,
    matchMode,
    searchDirection,
    includeStatusCols,
  } = payload;

  const opts: LookupOptions = {
    trimSpaces: payload.trimSpaces,
    ignoreCase: payload.ignoreCase,
    removeSpecialChars: payload.removeSpecialChars,
  };
  const clean = (v: unknown) => normalizeKeyValue(v, opts);

  if (!rawDataA || !rawDataB) throw new Error('Dados ausentes');

  // A chave (e a chave usada na Tabela C) nunca pode ser descartada da Tabela A,
  // senão toda a busca falha silenciosamente.
  const keepColsA = new Set(selectedColsA ?? []);
  if (keepColsA.size > 0) {
    if (keyA) keepColsA.add(keyA);
    if (rawDataC && keyA_C) keepColsA.add(keyA_C);
  }
  const dataA: LookupRow[] =
    keepColsA.size > 0
      ? rawDataA.map((row) => {
          const filtered: LookupRow = {};
          keepColsA.forEach((col) => {
            filtered[col] = row[col];
          });
          return filtered;
        })
      : rawDataA;

  const colsB = selectedColsB ?? [];
  const colsC = selectedColsC ?? [];

  // `searchDirection === -1` inverte a ordem só uma vez (antes era uma cópia por linha de A).
  const rowsB = searchDirection === -1 ? [...rawDataB].reverse() : rawDataB;
  const rowsC = rawDataC
    ? searchDirection === -1
      ? [...rawDataC].reverse()
      : rawDataC
    : null;

  const assignNotFound = (row: LookupRow, cols: string[], prefix: string, fallback: string) => {
    cols.forEach((col) => {
      row[`${prefix}${col}`] = fallback;
    });
  };

  if (exactMatch) {
    if (matchMode === 0) {
      const lookupMapB = createLookupMap(rowsB, keyB, colsB, opts, duplicateStrategy);
      const lookupMapC = rowsC
        ? createLookupMap(rowsC, keyC ?? '', colsC, opts, duplicateStrategy)
        : null;

      return dataA.map((rowA) => {
        const newRow: LookupRow = { ...rowA };
        const matchB = lookupMapB.get(clean(rowA[keyA])) ?? null;
        colsB.forEach((col) => {
          newRow[`Lookup_${col}`] = matchB ? matchB[col] : ifNotFound;
        });
        newRow['_match_found_B'] = !!matchB;
        if (includeStatusCols) newRow['Status_B'] = matchB ? 'VERDADEIRO' : 'FALSO';

        let matchFoundC = false;
        if (lookupMapC) {
          const matchC = lookupMapC.get(clean(rowA[keyA_C ?? ''])) ?? null;
          colsC.forEach((col) => {
            newRow[`LookupC_${col}`] = matchC ? matchC[col] : ifNotFoundC;
          });
          matchFoundC = !!matchC;
          newRow['_match_found_C'] = matchFoundC;
          if (includeStatusCols) newRow['Status_C'] = matchFoundC ? 'VERDADEIRO' : 'FALSO';
        }

        newRow['_match_found'] = !!matchB || matchFoundC;
        if (includeStatusCols && lookupMapC) {
          newRow['Status_Ambas'] = !!matchB && matchFoundC ? 'VERDADEIRO' : 'FALSO';
        }
        return newRow;
      });
    }

    return dataA.map((rowA) => {
      const newRow: LookupRow = { ...rowA };
      const matchB =
        matchMode === 2
          ? findWildcardMatch(rowsB, keyB, rowA[keyA], opts)
          : findNumericOrTextMatch(rowsB, keyB, rowA[keyA], opts, matchMode);
      colsB.forEach((col) => {
        newRow[`Lookup_${col}`] = matchB ? matchB[col] : ifNotFound;
      });
      newRow['_match_found_B'] = !!matchB;
      if (includeStatusCols) newRow['Status_B'] = matchB ? 'VERDADEIRO' : 'FALSO';

      let matchFoundC = false;
      if (rowsC) {
        const matchC =
          matchMode === 2
            ? findWildcardMatch(rowsC, keyC ?? '', rowA[keyA_C ?? ''], opts)
            : findNumericOrTextMatch(rowsC, keyC ?? '', rowA[keyA_C ?? ''], opts, matchMode);
        colsC.forEach((col) => {
          newRow[`LookupC_${col}`] = matchC ? matchC[col] : ifNotFoundC;
        });
        matchFoundC = !!matchC;
        newRow['_match_found_C'] = matchFoundC;
        if (includeStatusCols) newRow['Status_C'] = matchFoundC ? 'VERDADEIRO' : 'FALSO';
      }

      newRow['_match_found'] = !!matchB || matchFoundC;
      if (includeStatusCols && rowsC) {
        newRow['Status_Ambas'] = !!matchB && matchFoundC ? 'VERDADEIRO' : 'FALSO';
      }
      return newRow;
    });
  }

  // Busca aproximada (tolerância a erros de digitação)
  return dataA.map((rowA) => {
    const newRow: LookupRow = { ...rowA };
    const strA = clean(rowA[keyA]);

    const matchB =
      strA === ''
        ? null
        : findFuzzyMatch(rowsB, keyB, strA, opts, fuzzyThreshold);

    if (matchB) {
      colsB.forEach((col) => {
        newRow[`Lookup_${col}`] = matchB[col];
      });
    } else {
      assignNotFound(newRow, colsB, 'Lookup_', ifNotFound);
    }
    newRow['_match_found_B'] = !!matchB;
    if (includeStatusCols) newRow['Status_B'] = matchB ? 'VERDADEIRO' : 'FALSO';

    let matchFoundC = false;
    if (rowsC) {
      const strA_C = clean(rowA[keyA_C ?? '']);
      const matchC =
        strA_C === ''
          ? null
          : findFuzzyMatch(rowsC, keyC ?? '', strA_C, opts, fuzzyThreshold);
      if (matchC) {
        colsC.forEach((col) => {
          newRow[`LookupC_${col}`] = matchC[col];
        });
      } else {
        assignNotFound(newRow, colsC, 'LookupC_', ifNotFoundC);
      }
      matchFoundC = !!matchC;
      newRow['_match_found_C'] = matchFoundC;
      if (includeStatusCols) newRow['Status_C'] = matchFoundC ? 'VERDADEIRO' : 'FALSO';
    }

    newRow['_match_found'] = !!matchB || matchFoundC;
    if (includeStatusCols && rowsC) {
      newRow['Status_Ambas'] = !!matchB && matchFoundC ? 'VERDADEIRO' : 'FALSO';
    }
    return newRow;
  });
}
