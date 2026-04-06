/**
 * Normaliza uma linha de planilha: datas como DD/MM/AAAA e números grandes como string.
 */
export function normalizeExcelRow(row: Record<string, unknown>): Record<string, unknown> {
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
}
