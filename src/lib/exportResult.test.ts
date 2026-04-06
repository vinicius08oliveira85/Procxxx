import { describe, expect, it } from 'vitest';
import {
  buildResultExportRows,
  getResultExportVisibleColumnIds,
  resultExportBaseFileName,
} from './exportResult';
import type { ColumnSetting, LookupTask } from '../types/lookupTask';

const cols = (defs: Array<{ id: string; visible: boolean }>): ColumnSetting[] =>
  defs.map((d) => ({ id: d.id, visible: d.visible, pinned: false }));

describe('getResultExportVisibleColumnIds', () => {
  it('exclui invisíveis e ids com prefixo _', () => {
    expect(
      getResultExportVisibleColumnIds(
        cols([
          { id: 'A', visible: true },
          { id: 'B', visible: false },
          { id: '_hidden', visible: true },
        ])
      )
    ).toEqual(['A']);
  });
});

describe('buildResultExportRows', () => {
  it('mantém só colunas visíveis na ordem de columnSettings', () => {
    const settings = cols([
      { id: 'x', visible: true },
      { id: 'y', visible: true },
      { id: 'z', visible: false },
    ]);
    const rows: Record<string, unknown>[] = [{ x: 1, y: 2, z: 3, extra: 4 }];
    expect(buildResultExportRows(settings, rows)).toEqual([{ x: 1, y: 2 }]);
  });
});

describe('resultExportBaseFileName', () => {
  it('sem sufixo quando filtro é all', () => {
    const t = { name: 'T1', resultFilter: 'all' as LookupTask['resultFilter'] };
    expect(resultExportBaseFileName(t)).toBe('resultado_T1');
  });
  it('inclui filtro quando não é all', () => {
    const t = { name: 'T1', resultFilter: 'matched' as LookupTask['resultFilter'] };
    expect(resultExportBaseFileName(t)).toBe('resultado_T1_matched');
  });
});
