/**
 * Ordenação e detecção de datas para a grade de resultados (estilo planilha).
 */

export interface SortConfig {
  colId: string;
  direction: 'asc' | 'desc';
}

/** DD/MM/YYYY ou DD/MM/YYYY HH:mm (ou HH:mm:ss). */
const RESULT_DATE_CELL_RE =
  /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

function isEmptyResultCell(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

export function parseResultDateString(raw: string): number | null {
  const s = raw.trim();
  const m = s.match(RESULT_DATE_CELL_RE);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = parseInt(m[3], 10);
  const hh = m[4] !== undefined ? parseInt(m[4], 10) : 0;
  const min = m[5] !== undefined ? parseInt(m[5], 10) : 0;
  const ss = m[6] !== undefined ? parseInt(m[6], 10) : 0;
  const d = new Date(year, month, day, hh, min, ss);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d.getTime();
}

/**
 * Ordenação crescente estilo planilha: vazios por último; booleanos; datas DD/MM/YYYY;
 * números; texto com locale pt-BR.
 */
export function compareResultCellAsc(valA: unknown, valB: unknown): number {
  const eA = isEmptyResultCell(valA);
  const eB = isEmptyResultCell(valB);
  if (eA && eB) return 0;
  if (eA) return 1;
  if (eB) return -1;

  if (typeof valA === 'boolean' && typeof valB === 'boolean') {
    if (valA === valB) return 0;
    return valA ? 1 : -1;
  }
  if (typeof valA === 'boolean' || typeof valB === 'boolean') {
    const sa = typeof valA === 'boolean' ? (valA ? 'SIM' : 'NÃO') : String(valA);
    const sb = typeof valB === 'boolean' ? (valB ? 'SIM' : 'NÃO') : String(valB);
    return sa.localeCompare(sb, 'pt-BR', { numeric: true });
  }

  if (typeof valA === 'string' && typeof valB === 'string') {
    const tA = parseResultDateString(valA);
    const tB = parseResultDateString(valB);
    if (tA !== null && tB !== null) {
      if (tA !== tB) return tA < tB ? -1 : 1;
      return 0;
    }
  }

  const nA = typeof valA === 'number' ? valA : NaN;
  const nB = typeof valB === 'number' ? valB : NaN;
  if (Number.isFinite(nA) && Number.isFinite(nB)) {
    if (nA !== nB) return nA < nB ? -1 : 1;
    return 0;
  }

  const strA = typeof valA === 'string' ? valA.trim() : String(valA);
  const strB = typeof valB === 'string' ? valB.trim() : String(valB);
  const tA2 = parseResultDateString(strA);
  const tB2 = parseResultDateString(strB);
  if (tA2 !== null && tB2 !== null) {
    if (tA2 !== tB2) return tA2 < tB2 ? -1 : 1;
    return 0;
  }

  const numFromA =
    typeof valA === 'number'
      ? valA
      : typeof valA === 'string'
        ? Number(strA)
        : NaN;
  const numFromB =
    typeof valB === 'number'
      ? valB
      : typeof valB === 'string'
        ? Number(strB)
        : NaN;
  if (
    Number.isFinite(numFromA) &&
    Number.isFinite(numFromB) &&
    tA2 === null &&
    tB2 === null
  ) {
    if (numFromA !== numFromB) return numFromA < numFromB ? -1 : 1;
    return 0;
  }

  return strA.localeCompare(strB, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function columnStringSamplesLookLikeDates(samples: string[], maxCheck = 50): boolean {
  let n = 0;
  let hits = 0;
  for (const v of samples) {
    if (v.length === 0) continue;
    n++;
    if (parseResultDateString(v) !== null) hits++;
    if (n >= maxCheck) break;
  }
  if (n === 0) return false;
  return hits / n >= 0.5;
}
