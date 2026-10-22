import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { EmptyWorkbookError, parseWorkbook } from './workbookParser';

function xlsxBuffer(rows: unknown[][], sheetName = 'Dados'): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('parseWorkbook', () => {
  it('lê folhas de um .xlsx e seleciona a primeira', () => {
    const data = parseWorkbook({
      fileName: 'base.xlsx',
      text: null,
      buffer: xlsxBuffer([
        ['codigo', 'valor'],
        ['1', 10],
        ['2', 20],
      ]),
    });

    expect(data.name).toBe('base.xlsx');
    expect(data.selectedSheet).toBe('Dados');
    expect(data.sheets['Dados']).toHaveLength(2);
    expect(data.sheets['Dados']![0]).toEqual({ codigo: '1', valor: 10 });
  });

  it('lê CSV removendo o BOM do nome da primeira coluna', () => {
    const data = parseWorkbook({
      fileName: 'tabela.csv',
      text: '\uFEFFNome;Idade\nAna;30\n',
      buffer: null,
    });

    expect(data.sheets['Sheet1']).toHaveLength(1);
    expect(Object.keys(data.sheets['Sheet1']![0]!)).toEqual(['Nome', 'Idade']);
    expect(data.sheets['Sheet1']![0]).toMatchObject({ Nome: 'Ana', Idade: 30 });
  });

  it('converte datas do Excel em DD/MM/AAAA', () => {
    const buffer = (() => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['data'], [new Date(2024, 2, 7)]]);
      XLSX.utils.book_append_sheet(wb, ws, 'Folha');
      return XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer;
    })();

    const data = parseWorkbook({ fileName: 'datas.xlsx', text: null, buffer });
    expect(data.sheets['Folha']![0]!['data']).toBe('07/03/2024');
  });

  it('rejeita conteúdo inválido ou sem linhas', () => {
    expect(() =>
      parseWorkbook({ fileName: 'quebrado.xlsx', text: null, buffer: new ArrayBuffer(8) })
    ).toThrow(EmptyWorkbookError);
    expect(() =>
      parseWorkbook({ fileName: 'vazio.csv', text: 'Nome;Idade\n', buffer: null })
    ).toThrow(EmptyWorkbookError);
  });
});
