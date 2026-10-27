import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { buildPivotTableTsv, copyPivotTableTsvAndHtml } from './pivotClipboard';
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

describe('copyPivotTableTsvAndHtml', () => {
  let mockAppendChild: ReturnType<typeof vi.spyOn>;
  let mockRemoveChild: ReturnType<typeof vi.spyOn>;
  let mockExecCommand: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock do navigator sem Clipboard API para forçar o fallback
    const mockNavigator = {} as Navigator;
    vi.stubGlobal('navigator', mockNavigator);

    // Mock do document para ambiente Node
    const mockDocument = {
      createElement: vi.fn(() => ({
        style: {},
        select: vi.fn(),
        value: '',
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: vi.fn(() => true),
    };
    vi.stubGlobal('document', mockDocument);
    mockAppendChild = vi.spyOn(mockDocument.body, 'appendChild');
    mockRemoveChild = vi.spyOn(mockDocument.body, 'removeChild');
    mockExecCommand = vi.spyOn(mockDocument, 'execCommand');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa fallback de textarea quando Clipboard API não está disponível', async () => {
    await copyPivotTableTsvAndHtml('a\tb\n1\t2', '<table></table>');

    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
    expect(mockExecCommand).toHaveBeenCalledWith('copy');
  });

  it('lança erro quando nem clipboard nem execCommand estão disponíveis', async () => {
    mockExecCommand.mockImplementation(() => {
      throw new Error('not supported');
    });

    await expect(copyPivotTableTsvAndHtml('a\tb', '<table></table>')).rejects.toThrow(
      'Clipboard não disponível neste ambiente.'
    );
  });
});
