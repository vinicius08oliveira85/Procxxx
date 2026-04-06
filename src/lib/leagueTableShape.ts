/**
 * Formato JSON tipo "League Table" (primeira coluna → metric, restantes → headers + values[]).
 */

export type LeagueTableRow = {
  metric: string;
  values: string[];
};

export type LeagueTablePayload = {
  id: string;
  title: string;
  firstColumnHeader: string;
  headers: string[];
  rows: LeagueTableRow[];
};

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export type ToLeagueTableOptions = {
  title?: string;
  /** Coluna que vira `metric` (por defeito: `Rk` se existir, senão a primeira em columnOrder). */
  metricColumnKey?: string;
  id?: string;
};

/**
 * Coloca `Rk` em primeiro (padrão tabelas de classificação) para alinhar com League Table JSON.
 */
export function orderColumnsForLeagueTable(keys: string[]): { order: string[]; metricKey: string } {
  const optsMetric = keys.includes('Rk')
    ? 'Rk'
    : keys.includes('RK')
      ? 'RK'
      : keys[0];
  const metricKey = optsMetric;
  const order =
    metricKey && keys[0] !== metricKey && keys.includes(metricKey)
      ? [metricKey, ...keys.filter((k) => k !== metricKey)]
      : [...keys];
  return { order, metricKey: metricKey ?? keys[0] };
}

/**
 * Converte linhas planas (objeto por coluna) para o payload League Table.
 * @param columnOrder ordem das chaves (ex.: Object.keys(rows[0]) após parse).
 */
export function toLeagueTablePayload(
  flatRows: Record<string, unknown>[],
  columnOrder: string[],
  options?: ToLeagueTableOptions
): LeagueTablePayload | null {
  if (flatRows.length === 0 || columnOrder.length === 0) return null;

  let metricKey: string;
  if (options?.metricColumnKey && columnOrder.includes(options.metricColumnKey)) {
    metricKey = options.metricColumnKey;
  } else if (columnOrder.includes('Rk')) {
    metricKey = 'Rk';
  } else if (columnOrder.includes('RK')) {
    metricKey = 'RK';
  } else {
    metricKey = columnOrder[0];
  }

  const headers = columnOrder.filter((k) => k !== metricKey);

  const rows: LeagueTableRow[] = flatRows.map((r) => ({
    metric: cellToString(r[metricKey]),
    values: headers.map((h) => cellToString(r[h])),
  }));

  const id =
    options?.id ??
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `lt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);

  return {
    id,
    title: options?.title ?? 'League Table',
    firstColumnHeader: metricKey,
    headers,
    rows,
  };
}
