/**
 * Ordenação e detecção de datas para a grade de resultados (estilo planilha).
 */

export interface SortConfig {
  colId: string;
  direction: 'asc' | 'desc';
}

/** DD/MM/AAAA (ou AA) e AAAA-MM-DD, com hora opcional (HH:mm[:ss]). */
const DMY_DATE_CELL_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const ISO_DATE_CELL_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/** Anos de 2 dígitos: 00–68 → 2000s, 69–99 → 1900s (pivô convencional). */
function expandTwoDigitYear(year: number): number {
  if (year >= 100) return year;
  return year <= 68 ? 2000 + year : 1900 + year;
}

function buildTimestamp(
  year: number,
  month: number,
  day: number,
  hours?: string,
  minutes?: string,
  seconds?: string
): number | null {
  const hh = hours !== undefined ? parseInt(hours, 10) : 0;
  const mm = minutes !== undefined ? parseInt(minutes, 10) : 0;
  const ss = seconds !== undefined ? parseInt(seconds, 10) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  const date = new Date(year, month - 1, day, hh, mm, ss);
  // Rejeita datas que o `Date` "corrige" (31/02 → 02/03).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

function isEmptyResultCell(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

export function parseResultDateString(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(ISO_DATE_CELL_RE);
  if (iso) {
    return buildTimestamp(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10),
      parseInt(iso[3], 10),
      iso[4],
      iso[5],
      iso[6]
    );
  }

  const dmy = s.match(DMY_DATE_CELL_RE);
  if (dmy) {
    return buildTimestamp(
      expandTwoDigitYear(parseInt(dmy[3], 10)),
      parseInt(dmy[2], 10),
      parseInt(dmy[1], 10),
      dmy[4],
      dmy[5],
      dmy[6]
    );
  }

  return null;
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
