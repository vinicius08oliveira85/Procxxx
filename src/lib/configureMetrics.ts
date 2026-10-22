/**
 * Métricas rápidas mostradas na etapa Configurar (linhas, duplicados na fonte,
 * taxa de casamento aproximada e formato da chave).
 *
 * Extraído de `App.tsx` para ser testável e para poder ser recalculado fora do
 * caminho de render (o ecrã não bloqueia enquanto varre a tabela B).
 */
import { normalizeKeyValue, type LookupOptions } from './lookupEngine';
import type { LookupRow } from '../types/lookupTask';

export type ConfigureKeyMetrics = {
  totalRows: number;
  dupInB: number;
  matchApprox: number | null;
  valueFormat: string;
};

export const EMPTY_CONFIGURE_METRICS: ConfigureKeyMetrics = {
  totalRows: 0,
  dupInB: 0,
  matchApprox: null,
  valueFormat: '—',
};

export type ConfigureMetricsInput = {
  sheetA: LookupRow[];
  sheetB: LookupRow[];
  keyA: string;
  keyB: string;
  normalization: LookupOptions;
};

/** Teto de linhas varridas na tabela B (custo previsível em planilhas grandes). */
export const CONFIGURE_METRICS_MAX_SCAN_B = 200_000;
/** Amostra de A usada para estimar a taxa de casamento. */
export const CONFIGURE_METRICS_MAX_SAMPLE_A = 3_000;

export function computeConfigureKeyMetrics(input: ConfigureMetricsInput): ConfigureKeyMetrics {
  const { sheetA, sheetB, keyA, keyB, normalization } = input;
  const norm = (v: unknown) => normalizeKeyValue(v, normalization);

  const totalRows = sheetA.length;

  // Uma única passagem por B: contagem de duplicados + conjunto para o match.
  let dupInB = 0;
  const bKeys = new Set<string>();
  if (keyB) {
    const counts = new Map<string, number>();
    const maxScan = Math.min(sheetB.length, CONFIGURE_METRICS_MAX_SCAN_B);
    for (let i = 0; i < maxScan; i++) {
      const k = norm(sheetB[i]?.[keyB]);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
      bKeys.add(k);
    }
    for (const n of counts.values()) {
      if (n > 1) dupInB += n - 1;
    }
  }

  let matchApprox: number | null = null;
  if (keyA && keyB && sheetA.length > 0 && bKeys.size > 0) {
    const cap = Math.min(CONFIGURE_METRICS_MAX_SAMPLE_A, sheetA.length);
    let hits = 0;
    let nonEmpty = 0;
    for (let i = 0; i < cap; i++) {
      const k = norm(sheetA[i]?.[keyA]);
      if (!k) continue;
      nonEmpty++;
      if (bKeys.has(k)) hits++;
    }
    matchApprox = nonEmpty > 0 ? Math.round((hits / nonEmpty) * 100) : 0;
  }

  let valueFormat = '—';
  if (keyA && sheetA.length > 0) {
    const samples: unknown[] = [];
    for (let i = 0; i < Math.min(80, sheetA.length); i++) {
      const v = sheetA[i]?.[keyA];
      if (v !== '' && v != null) samples.push(v);
      if (samples.length >= 10) break;
    }
    if (samples.length > 0) {
      const allNum = samples.every(
        (v) =>
          typeof v === 'number' ||
          (typeof v === 'string' && String(v).trim() !== '' && !Number.isNaN(Number(String(v).trim())))
      );
      valueFormat = allNum ? 'Número' : 'Texto';
    }
  }

  return { totalRows, dupInB, matchApprox, valueFormat };
}
