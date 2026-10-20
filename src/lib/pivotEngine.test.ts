import { describe, expect, it } from 'vitest';
import {
  computePivot,
  formatPivotMeasureValue,
  parsePivotNumber,
  type PivotAgg,
  type PivotLayout,
} from './pivotEngine';

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

  it.each<[PivotAgg, number]>([
    ['sum', 35],
    ['avg', 35 / 3],
    ['min', 5],
    ['max', 20],
    ['count', 3],
  ])('agregação %s no total geral', (agg, expected) => {
    const r = computePivot(rows, layout({ rowFields: ['status'], measures: [{ id: '1', field: 'v', agg }] }));
    expect(r.grandTotal[0]).toBeCloseTo(expected, 5);
  });

  it.each<[PivotAgg, number]>([
    ['sum', 30],
    ['avg', 15],
    ['min', 10],
    ['max', 20],
    ['count', 2],
  ])('subtotal de %s recalcula o grupo em vez de somar os filhos', (agg, expected) => {
    const r = computePivot(
      rows,
      layout({ rowFields: ['status', 'tipo'], measures: [{ id: '1', field: 'v', agg }] })
    );
    const a = r.root.children.find((c) => c.segmentLabel === 'a');
    expect(a?.aggregates[0]).toBeCloseTo(expected, 5);
    expect(a?.children.map((c) => c.segmentLabel)).toEqual(['x', 'y']);
  });

  it('subtotais dos filhos continuam corretos', () => {
    const r = computePivot(
      rows,
      layout({ rowFields: ['status', 'tipo'], measures: [{ id: '1', field: 'v', agg: 'sum' }] })
    );
    const a = r.root.children.find((c) => c.segmentLabel === 'a');
    expect(a?.children.map((c) => c.aggregates[0])).toEqual([10, 20]);
  });

  it('percentOfTotal divide pelo total geral da medida e formata com %', () => {
    const r = computePivot(
      rows,
      layout({
        rowFields: ['status'],
        measures: [{ id: '1', field: 'status', agg: 'count', showAs: 'percentOfTotal' }],
      })
    );
    expect(r.error).toBeUndefined();
    expect(r.grandTotal[0]).toBeCloseTo(100, 5);
    const a = r.root.children.find((c) => c.segmentLabel === 'a');
    expect(a?.aggregates[0]).toBeCloseTo((2 / 3) * 100, 5);
    expect(formatPivotMeasureValue(a!.aggregates[0], 'count', 'percentOfTotal')).toMatch(/%/);
  });
});

describe('parsePivotNumber', () => {
  it('lê formatos pt-BR e en-US', () => {
    expect(parsePivotNumber('1.234,56')).toBeCloseTo(1234.56, 5);
    expect(parsePivotNumber('1,234.56')).toBeCloseTo(1234.56, 5);
    expect(parsePivotNumber('12,5')).toBeCloseTo(12.5, 5);
    expect(parsePivotNumber('1,234,567')).toBe(1234567);
    expect(parsePivotNumber('1.234.567')).toBe(1234567);
    expect(parsePivotNumber('R$ 1.200,50')).toBeCloseTo(1200.5, 5);
    expect(parsePivotNumber('(120,50)')).toBeCloseTo(-120.5, 5);
    expect(parsePivotNumber(42)).toBe(42);
    expect(parsePivotNumber('texto')).toBeNull();
    expect(parsePivotNumber('')).toBeNull();
  });

  it('soma valores colados em formato pt-BR na tabela dinâmica', () => {
    const rowsPt = [
      { g: 'a', v: '1.234,56' },
      { g: 'a', v: '1.234,56' },
    ];
    const r = computePivot(
      rowsPt,
      layout({ rowFields: ['g'], measures: [{ id: '1', field: 'v', agg: 'sum' }] })
    );
    expect(r.grandTotal[0]).toBeCloseTo(2469.12, 5);
  });
});
