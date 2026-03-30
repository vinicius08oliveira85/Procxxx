/**
 * Motor de tabela dinâmica: filtra linhas, agrupa por dimensões de linha/coluna e agrega medidas.
 */

export type PivotAgg = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface PivotMeasure {
  id: string;
  field: string;
  agg: PivotAgg;
}

/** Configuração commitada (layout) da tabela dinâmica. */
export interface PivotLayout {
  filterFields: string[];
  /** Por campo de filtro: valores permitidos. Conjunto vazio = todos. */
  filterSelections: Record<string, Set<string>>;
  columnFields: string[];
  rowFields: string[];
  measures: PivotMeasure[];
}

export interface PivotColumnHeader {
  label: string;
  measureIndex?: number;
  colKey?: string;
}

export interface PivotTreeNode {
  path: string;
  segmentLabel: string;
  rowField: string;
  depth: number;
  /** Valores na ordem dos cabeçalhos de dados (flatten). */
  aggregates: number[];
  children: PivotTreeNode[];
}

export interface PivotResult {
  rowDimensionLabels: string[];
  dataHeaders: PivotColumnHeader[];
  root: PivotTreeNode;
  grandTotal: number[];
  error?: string;
}

const EMPTY_LABEL = '(vazio)';

export function getPivotableFields(sampleRow: Record<string, unknown> | undefined): string[] {
  if (!sampleRow) return [];
  return Object.keys(sampleRow)
    .filter((k) => !k.startsWith('_'))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function cellKey(row: Record<string, unknown>, field: string): string {
  const v = row[field];
  if (v === null || v === undefined || v === '') return EMPTY_LABEL;
  return String(v);
}

function filterPivotRows(
  rows: Record<string, unknown>[],
  layout: PivotLayout
): Record<string, unknown>[] {
  let out = rows;
  for (const f of layout.filterFields) {
    const sel = layout.filterSelections[f];
    if (sel && sel.size > 0) {
      out = out.filter((r) => sel.has(cellKey(r, f)));
    }
  }
  return out;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const n = Number(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function aggregateRows(
  slice: Record<string, unknown>[],
  measure: PivotMeasure
): number {
  const { field, agg } = measure;
  switch (agg) {
    case 'count':
      return slice.length;
    case 'sum': {
      let s = 0;
      for (const r of slice) {
        const n = toNumber(r[field]);
        if (n !== null) s += n;
      }
      return s;
    }
    case 'avg': {
      let s = 0;
      let c = 0;
      for (const r of slice) {
        const n = toNumber(r[field]);
        if (n !== null) {
          s += n;
          c += 1;
        }
      }
      return c > 0 ? s / c : 0;
    }
    case 'min': {
      let m: number | null = null;
      for (const r of slice) {
        const n = toNumber(r[field]);
        if (n !== null && (m === null || n < m)) m = n;
      }
      return m ?? 0;
    }
    case 'max': {
      let m: number | null = null;
      for (const r of slice) {
        const n = toNumber(r[field]);
        if (n !== null && (m === null || n > m)) m = n;
      }
      return m ?? 0;
    }
    default:
      return 0;
  }
}

function buildDataHeaders(
  layout: PivotLayout,
  colKeys: string[]
): PivotColumnHeader[] {
  const { measures, columnFields } = layout;
  if (measures.length === 0) return [];

  if (columnFields.length === 0) {
    return measures.map((m, i) => ({
      label: measureTitle(m),
      measureIndex: i,
    }));
  }

  const headers: PivotColumnHeader[] = [];
  for (const ck of colKeys) {
    if (measures.length === 1) {
      headers.push({
        label: ck === EMPTY_LABEL ? '(vazio)' : ck,
        colKey: ck,
        measureIndex: 0,
      });
    } else {
      for (let mi = 0; mi < measures.length; mi++) {
        const m = measures[mi];
        headers.push({
          label: `${ck === EMPTY_LABEL ? '(vazio)' : ck} — ${shortMeasureTitle(m)}`,
          colKey: ck,
          measureIndex: mi,
        });
      }
    }
  }
  return headers;
}

export function measureTitle(m: PivotMeasure): string {
  const map: Record<PivotAgg, string> = {
    count: 'Contagem',
    sum: 'Soma',
    avg: 'Média',
    min: 'Mínimo',
    max: 'Máximo',
  };
  return `${map[m.agg]} de ${m.field}`;
}

/** Formata célula de medida para exibição / exportação (TSV, HTML). */
export function formatPivotMeasureValue(n: number, agg: PivotAgg): string {
  if (!Number.isFinite(n)) return '—';
  if (agg === 'count') return String(Math.round(n));
  if (agg === 'sum' || agg === 'min' || agg === 'max') {
    return Number.isInteger(n) && Math.abs(n) < 1e12
      ? String(n)
      : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function shortMeasureTitle(m: PivotMeasure): string {
  const map: Record<PivotAgg, string> = {
    count: 'Cont.',
    sum: 'Soma',
    avg: 'Méd.',
    min: 'Mín.',
    max: 'Máx.',
  };
  return `${map[m.agg]} ${m.field}`;
}

function computeValuesForSlice(
  slice: Record<string, unknown>[],
  layout: PivotLayout,
  colKeys: string[]
): number[] {
  const { measures, columnFields } = layout;
  if (measures.length === 0) return [];

  if (columnFields.length === 0) {
    return measures.map((m) => aggregateRows(slice, m));
  }

  const colField = columnFields[0];
  const out: number[] = [];
  for (const ck of colKeys) {
    const sub = slice.filter((r) => cellKey(r, colField) === ck);
    for (const m of measures) {
      out.push(aggregateRows(sub, m));
    }
  }
  return out;
}

function addVectors(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

function joinPath(prefix: string, key: string): string {
  return prefix ? `${prefix}|${key}` : key;
}

/**
 * Irmãos no nível `depth` para o conjunto de linhas `rows`.
 */
function buildSiblings(
  rows: Record<string, unknown>[],
  layout: PivotLayout,
  colKeys: string[],
  depth: number,
  pathPrefix: string
): PivotTreeNode[] {
  const { rowFields } = layout;
  const field = rowFields[depth];
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const k = cellKey(r, field);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );

  const isLeafLevel = depth === rowFields.length - 1;

  return sortedKeys.map((key) => {
    const subRows = groups.get(key)!;
    const path = joinPath(pathPrefix, key);
    if (isLeafLevel) {
      return {
        path,
        segmentLabel: key,
        rowField: field,
        depth,
        aggregates: computeValuesForSlice(subRows, layout, colKeys),
        children: [],
      };
    }
    const childSiblings = buildSiblings(subRows, layout, colKeys, depth + 1, path);
    const w = childSiblings[0]?.aggregates.length ?? computeValuesForSlice([], layout, colKeys).length;
    const sumAgg = childSiblings.reduce((acc, ch) => addVectors(acc, ch.aggregates), new Array(w).fill(0));
    return {
      path,
      segmentLabel: key,
      rowField: field,
      depth,
      aggregates: sumAgg,
      children: childSiblings,
    };
  });
}

export function computePivot(rows: Record<string, unknown>[], layout: PivotLayout): PivotResult {
  if (layout.measures.length === 0) {
    return {
      rowDimensionLabels: layout.rowFields,
      dataHeaders: [],
      root: {
        path: 'root',
        segmentLabel: '',
        rowField: '',
        depth: -1,
        aggregates: [],
        children: [],
      },
      grandTotal: [],
      error: 'Adicione ao menos um campo em Valores.',
    };
  }

  if (layout.rowFields.length === 0 && layout.columnFields.length === 0) {
    return {
      rowDimensionLabels: [],
      dataHeaders: [],
      root: {
        path: 'root',
        segmentLabel: '',
        rowField: '',
        depth: -1,
        aggregates: [],
        children: [],
      },
      grandTotal: [],
      error: 'Coloque campos em Linhas ou em Colunas.',
    };
  }

  const filtered = filterPivotRows(rows, layout);

  let colKeys: string[] = [];
  if (layout.columnFields.length > 0) {
    const cf = layout.columnFields[0];
    colKeys = [...new Set(filtered.map((r) => cellKey(r, cf)))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { numeric: true })
    );
  }

  const headers = buildDataHeaders(layout, colKeys);
  const grandTotal = computeValuesForSlice(filtered, layout, colKeys);

  let root: PivotTreeNode;

  if (layout.rowFields.length === 0) {
    const totalRow: PivotTreeNode = {
      path: 'total',
      segmentLabel: 'Total Geral',
      rowField: '',
      depth: 0,
      aggregates: grandTotal,
      children: [],
    };
    root = {
      path: 'root',
      segmentLabel: '',
      rowField: '',
      depth: -1,
      aggregates: grandTotal,
      children: [totalRow],
    };
  } else {
    const children = buildSiblings(filtered, layout, colKeys, 0, '');
    root = {
      path: 'root',
      segmentLabel: '',
      rowField: '',
      depth: -1,
      aggregates: grandTotal,
      children,
    };
  }

  return {
    rowDimensionLabels: layout.rowFields,
    dataHeaders: headers,
    root,
    grandTotal,
  };
}

/** Achatamento para renderização (respeita expand/collapse). */
export function flattenPivotRows(
  node: PivotTreeNode,
  expandedPaths: Set<string>,
  skipRoot = true
): PivotTreeNode[] {
  const out: PivotTreeNode[] = [];
  function walk(n: PivotTreeNode, isRoot: boolean) {
    if (isRoot && skipRoot) {
      for (const c of n.children) walk(c, false);
      return;
    }
    out.push(n);
    if (n.children.length > 0 && expandedPaths.has(n.path)) {
      for (const c of n.children) walk(c, false);
    }
  }
  walk(node, true);
  return out;
}
