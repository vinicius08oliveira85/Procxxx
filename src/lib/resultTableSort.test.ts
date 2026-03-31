import { describe, expect, it } from 'vitest';
import {
  columnStringSamplesLookLikeDates,
  compareResultCellAsc,
  parseResultDateString,
} from './resultTableSort';

describe('parseResultDateString', () => {
  it('aceita DD/MM/YYYY e retorna timestamp', () => {
    const t = parseResultDateString('15/03/2024');
    expect(t).not.toBeNull();
    expect(new Date(t!).getDate()).toBe(15);
    expect(new Date(t!).getMonth()).toBe(2);
    expect(new Date(t!).getFullYear()).toBe(2024);
  });

  it('aceita DD/MM/YYYY HH:mm', () => {
    const morning = parseResultDateString('01/01/2024 09:00');
    const afternoon = parseResultDateString('01/01/2024 14:30');
    expect(morning).not.toBeNull();
    expect(afternoon).not.toBeNull();
    expect(afternoon! > morning!).toBe(true);
  });

  it('aceita DD/MM/YYYY HH:mm:ss', () => {
    const t = parseResultDateString('27/12/2025 08:15:45');
    expect(t).not.toBeNull();
    const d = new Date(t!);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(15);
    expect(d.getSeconds()).toBe(45);
  });

  it('retorna null para data inválida ou formato incorreto', () => {
    expect(parseResultDateString('31/02/2024')).toBeNull();
    expect(parseResultDateString('2024-03-15')).toBeNull();
    expect(parseResultDateString('')).toBeNull();
    expect(parseResultDateString('texto')).toBeNull();
  });
});

describe('compareResultCellAsc', () => {
  it('vazios: iguais retornam 0; vazio fica depois de valor preenchido', () => {
    expect(compareResultCellAsc('', '')).toBe(0);
    expect(compareResultCellAsc(null, null)).toBe(0);
    expect(compareResultCellAsc(undefined, undefined)).toBe(0);
    expect(compareResultCellAsc('', 'x')).toBeGreaterThan(0);
    expect(compareResultCellAsc('x', '')).toBeLessThan(0);
  });

  it('booleanos: false antes de true', () => {
    expect(compareResultCellAsc(false, true)).toBeLessThan(0);
    expect(compareResultCellAsc(true, false)).toBeGreaterThan(0);
    expect(compareResultCellAsc(true, true)).toBe(0);
  });

  it('booleano misturado usa SIM/NÃO para comparar com string', () => {
    expect(compareResultCellAsc(true, 'NÃO')).not.toBe(0);
    expect(compareResultCellAsc(false, 'NÃO')).toBe(0);
  });

  it('ordena datas DD/MM/YYYY com hora', () => {
    expect(
      compareResultCellAsc('01/01/2024 10:00', '01/01/2024 09:00')
    ).toBeGreaterThan(0);
    expect(
      compareResultCellAsc('02/01/2024', '15/12/2023')
    ).toBeGreaterThan(0);
  });

  it('ordena números e strings numéricas sem confundir com data', () => {
    expect(compareResultCellAsc(1, 10)).toBeLessThan(0);
    expect(compareResultCellAsc(10, 2)).toBeGreaterThan(0);
    expect(compareResultCellAsc('2', '10')).toBeLessThan(0);
    expect(compareResultCellAsc(5, '10')).toBeLessThan(0);
  });

  it('texto usa locale pt-BR', () => {
    expect(compareResultCellAsc('alfa', 'beta')).toBeLessThan(0);
    expect(compareResultCellAsc('beta', 'alfa')).toBeGreaterThan(0);
  });
});

describe('columnStringSamplesLookLikeDates', () => {
  it('retorna false sem amostras não vazias', () => {
    expect(columnStringSamplesLookLikeDates([])).toBe(false);
    expect(columnStringSamplesLookLikeDates(['', ''])).toBe(false);
  });

  it('retorna true quando maioria parece data', () => {
    expect(
      columnStringSamplesLookLikeDates([
        '01/01/2024',
        '02/01/2024',
        '03/01/2024',
        'ruído',
      ])
    ).toBe(true);
  });

  it('retorna false quando maioria não é data', () => {
    expect(
      columnStringSamplesLookLikeDates(['a', 'b', 'c', '01/01/2024'])
    ).toBe(false);
  });
});
