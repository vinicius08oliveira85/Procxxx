import { describe, expect, it } from 'vitest';
import {
  computeConfigureKeyMetrics,
  EMPTY_CONFIGURE_METRICS,
  type ConfigureMetricsInput,
} from './configureMetrics';

const normalization = { trimSpaces: true, ignoreCase: true, removeSpecialChars: false };

function input(partial: Partial<ConfigureMetricsInput>): ConfigureMetricsInput {
  return {
    sheetA: [],
    sheetB: [],
    keyA: 'codigo',
    keyB: 'codigo',
    normalization,
    ...partial,
  };
}

describe('computeConfigureKeyMetrics', () => {
  it('devolve métricas vazias sem linhas', () => {
    expect(computeConfigureKeyMetrics(input({}))).toEqual({ ...EMPTY_CONFIGURE_METRICS, totalRows: 0 });
  });

  it('conta duplicados da tabela B e estima a taxa de casamento', () => {
    const metrics = computeConfigureKeyMetrics(
      input({
        sheetA: [{ codigo: '1' }, { codigo: '2' }, { codigo: '3' }, { codigo: '' }],
        sheetB: [{ codigo: '1' }, { codigo: '1' }, { codigo: '3' }],
      })
    );
    expect(metrics.totalRows).toBe(4);
    // '1' aparece 2x em B -> 1 duplicado
    expect(metrics.dupInB).toBe(1);
    // A ignora a chave vazia: 2 de 3 casam -> 67%
    expect(metrics.matchApprox).toBe(67);
    expect(metrics.valueFormat).toBe('Número');
  });

  it('aplica a normalização escolhida (acentos e caixa)', () => {
    const metrics = computeConfigureKeyMetrics(
      input({
        sheetA: [{ codigo: 'José' }],
        sheetB: [{ codigo: 'JOSE' }],
        normalization: { trimSpaces: true, ignoreCase: true, removeSpecialChars: true },
      })
    );
    expect(metrics.matchApprox).toBe(100);
  });

  it('não calcula match quando falta uma das chaves', () => {
    const metrics = computeConfigureKeyMetrics(
      input({ sheetA: [{ codigo: '1' }], sheetB: [{ codigo: '1' }], keyB: '' })
    );
    expect(metrics.matchApprox).toBeNull();
    expect(metrics.dupInB).toBe(0);
    // O formato é só da chave da tabela A: '1' é numérico.
    expect(metrics.valueFormat).toBe('Número');
  });
});
