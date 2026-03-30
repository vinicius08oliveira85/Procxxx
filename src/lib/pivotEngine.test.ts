import { describe, expect, it } from 'vitest';
import { computePivot, type PivotLayout } from './pivotEngine';

const rows = [
  { status: 'a', tipo: 'x', v: 10 },
  { status: 'a', tipo: 'y', v: 20 },
  { status: 'b', tipo: 'x', v: 5 },
];

function layout(partial: Partial<PivotLayout>): PivotLayout {
  return {
    filterFields: [],
    filterSelections: {},
    columnFields: [],
    rowFields: [],
    measures: [],
    ...partial,
  };
}

describe('computePivot', () => {
  it('conta por uma dimensão nas linhas', () => {
    const r = computePivot(
      rows,
      layout({
        rowFields: ['status'],
        measures: [{ id: '1', field: 'status', agg: 'count' }],
      })
    );
    expect(r.error).toBeUndefined();
    expect(r.grandTotal[0]).toBe(3);
    expect(r.root.children).toHaveLength(2);
    const a = r.root.children.find((c) => c.segmentLabel === 'a');
    expect(a?.aggregates[0]).toBe(2);
  });

  it('respeita filtro por valor', () => {
    const r = computePivot(
      rows,
      layout({
        filterFields: ['status'],
        filterSelections: { status: new Set(['a']) },
        rowFields: ['tipo'],
        measures: [{ id: '1', field: 'tipo', agg: 'count' }],
      })
    );
    expect(r.grandTotal[0]).toBe(2);
  });
});
