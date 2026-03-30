import { describe, expect, it } from 'vitest';
import { buildPivotTableTsv } from './pivotClipboard';
import type { PivotColumnHeader, PivotTreeNode } from './pivotEngine';

describe('buildPivotTableTsv', () => {
  it('gera cabeçalho, linhas e total com tab', () => {
    const headers: PivotColumnHeader[] = [{ label: 'Contagem de X', measureIndex: 0 }];
    const flatRows: PivotTreeNode[] = [
      {
        path: 'a',
        segmentLabel: 'a',
        rowField: 'f',
        depth: 0,
        aggregates: [2],
        children: [],
      },
    ];
    const tsv = buildPivotTableTsv(headers, flatRows, [2], (v) => String(v));
    expect(tsv).toContain('Rótulos de Linha\tContagem de X');
    expect(tsv).toContain('a\t2');
    expect(tsv).toContain('Total Geral\t2');
  });

  it('escapa células com tab e aspas', () => {
    const headers: PivotColumnHeader[] = [{ label: 'M1', measureIndex: 0 }];
    const flatRows: PivotTreeNode[] = [
      {
        path: 'x',
        segmentLabel: 'linha	com tab',
        rowField: 'f',
        depth: 0,
        aggregates: [1],
        children: [],
      },
    ];
    const tsv = buildPivotTableTsv(headers, flatRows, [1], (v) => String(v));
    expect(tsv).toMatch(/"linha\tcom tab"/);
  });
});
