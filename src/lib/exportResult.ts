import type { ColumnSetting, LookupTask } from '../types/lookupTask';

const LOOKUP_PREFIX = 'Lookup_';
const LOOKUPC_PREFIX = 'LookupC_';

function isLookupExportColumn(id: string): boolean {
  return id.startsWith(LOOKUP_PREFIX) || id.startsWith(LOOKUPC_PREFIX);
}

/** Remove prefixo de coluna de lookup para chaves no JSON (só o sufixo após `Lookup_` / `LookupC_`). */
function stripLookupColumnPrefixForJson(colId: string): string | null {
  if (colId.startsWith(LOOKUPC_PREFIX)) return colId.slice(LOOKUPC_PREFIX.length);
  if (colId.startsWith(LOOKUP_PREFIX)) return colId.slice(LOOKUP_PREFIX.length);
  return null;
}

/** Ids das colunas exportáveis (visíveis e sem prefixo `_`). */
export function getResultExportVisibleColumnIds(columnSettings: ColumnSetting[]): string[] {
  return columnSettings.filter((c) => c.visible && !c.id.startsWith('_')).map((c) => c.id);
}

/**
 * Linhas do resultado filtrado, apenas colunas visíveis (exclui ids que começam com `_`).
 * Mesma lógica usada para exportar Excel e JSON.
 */
export function buildResultExportRows(
  columnSettings: ColumnSetting[],
  filteredRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const visibleCols = getResultExportVisibleColumnIds(columnSettings);

  return filteredRows.map((row) => {
    const clean: Record<string, unknown> = {};
    visibleCols.forEach((col) => {
      clean[col] = row[col];
    });
    return clean;
  });
}

/**
 * Igual a `buildResultExportRows`, mas remove `Lookup_` e `LookupC_` das chaves no JSON.
 * Colunas “normais” são escritas primeiro; se o nome já existir, mantém-se o id completo (evita sobrescrever).
 */
export function buildResultExportRowsForJson(
  columnSettings: ColumnSetting[],
  filteredRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const visibleCols = getResultExportVisibleColumnIds(columnSettings);
  const normalCols = visibleCols.filter((c) => !isLookupExportColumn(c));
  const lookupCols = visibleCols.filter(isLookupExportColumn);

  return filteredRows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const col of normalCols) {
      clean[col] = row[col];
    }
    for (const col of lookupCols) {
      const stripped = stripLookupColumnPrefixForJson(col);
      const key =
        stripped !== null && !Object.prototype.hasOwnProperty.call(clean, stripped) ? stripped : col;
      clean[key] = row[col];
    }
    return clean;
  });
}

/** Nome base do ficheiro (sem extensão), alinhado ao Excel. */
export function resultExportBaseFileName(task: Pick<LookupTask, 'name' | 'resultFilter'>): string {
  if (task.resultFilter === 'all') return `resultado_${task.name}`;
  return `resultado_${task.name}_${task.resultFilter}`;
}

export function downloadJsonFile(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
