import { describe, expect, it } from 'vitest';
import { buildSampleRowsForAi } from './aiSuggest';

describe('buildSampleRowsForAi', () => {
  it('limita número de linhas e tamanho de cada valor', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ nome: `Linha ${i}`, obs: 'x'.repeat(500) }));
    const sample = buildSampleRowsForAi(rows, 3, 10);
    expect(sample).toHaveLength(3);
    expect(sample[0]!['obs']).toBe(`${'x'.repeat(10)}…`);
  });

  it('mascara CPF e e-mail antes do envio', () => {
    const [row] = buildSampleRowsForAi([{ cpf: '123.456.789-00', email: 'maria@empresa.com' }]);
    expect(row!['cpf']).toBe('12*.***.***-00');
    expect(row!['email']).toBe('ma***@empresa.com');
  });

  it('devolve array vazio sem linhas', () => {
    expect(buildSampleRowsForAi(undefined)).toEqual([]);
    expect(buildSampleRowsForAi([])).toEqual([]);
  });
});
