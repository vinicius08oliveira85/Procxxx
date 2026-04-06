import { describe, expect, it } from 'vitest';
import { detectDelimiter, parsePastedTable, uniquifyHeaders } from './pasteTableParser';

describe('detectDelimiter', () => {
  it('prioriza tab', () => {
    expect(detectDelimiter(['a\tb', 'c,d'])).toBe('\t');
  });
  it('usa ponto e vírgula se não houver tab', () => {
    expect(detectDelimiter(['a;b', 'c,d'])).toBe(';');
  });
  it('usa vírgula por defeito', () => {
    expect(detectDelimiter(['a,b', 'c,d'])).toBe(',');
  });
});

describe('uniquifyHeaders', () => {
  it('duplica com sufixo numérico', () => {
    expect(uniquifyHeaders(['Nome', 'Nome', 'Nome'])).toEqual(['Nome', 'Nome (2)', 'Nome (3)']);
  });
});

describe('parsePastedTable', () => {
  it('com cabeçalho e tab', () => {
    const r = parsePastedTable('A\tB\n1\t2', true);
    expect(r.status).toBe('ready');
    expect(r.rows).toEqual([{ A: '1', B: '2' }]);
  });

  it('sem cabeçalho gera Coluna N', () => {
    const r = parsePastedTable('1;2\n3;4', false);
    expect(r.status).toBe('ready');
    expect(r.rows).toEqual([
      { 'Coluna 1': '1', 'Coluna 2': '2' },
      { 'Coluna 1': '3', 'Coluna 2': '4' },
    ]);
  });

  it('só cabeçalho', () => {
    const r = parsePastedTable('A,B', true);
    expect(r.status).toBe('header_only');
    expect(r.rows).toBeNull();
  });

  it('vazio aguarda colagem', () => {
    const r = parsePastedTable('   ', true);
    expect(r.status).toBe('waiting');
  });
});
