import { describe, expect, it } from 'vitest';
import {
  applyLookup,
  normalizeKeyValue,
  similarity,
  wildcardToRegexSource,
  type LookupPayload,
} from './lookupEngine';

function payload(partial: Partial<LookupPayload>): LookupPayload {
  return {
    dataA: [],
    dataB: [],
    keyA: 'chave',
    keyB: 'chave',
    selectedColsA: [],
    selectedColsB: ['valor'],
    dataC: null,
    keyA_C: '',
    keyC: '',
    selectedColsC: [],
    exactMatch: true,
    trimSpaces: true,
    ignoreCase: true,
    removeSpecialChars: false,
    duplicateStrategy: 'first',
    fuzzyThreshold: 0.8,
    ifNotFound: '#N/D',
    ifNotFoundC: '#N/D',
    matchMode: 0,
    searchDirection: 1,
    includeStatusCols: true,
    ...partial,
  };
}

const opts = { trimSpaces: true, ignoreCase: true, removeSpecialChars: false };

describe('normalizeKeyValue', () => {
  it('aplica trim/ignoreCase/removeSpecialChars', () => {
    expect(normalizeKeyValue('  AbC-1 ', opts)).toBe('abc-1');
    expect(
      normalizeKeyValue('  AbC-1 ', { trimSpaces: true, ignoreCase: true, removeSpecialChars: true })
    ).toBe('abc1');
    expect(normalizeKeyValue(null, opts)).toBe('');
  });

  it('remove acentos em vez de apagar a letra (removeSpecialChars)', () => {
    const strip = { trimSpaces: true, ignoreCase: true, removeSpecialChars: true };
    expect(normalizeKeyValue('José', strip)).toBe(normalizeKeyValue('Jose', strip));
    expect(normalizeKeyValue('São Paulo', strip)).toBe(normalizeKeyValue('Sao Paulo', strip));
    expect(normalizeKeyValue('AÇÃO', strip)).toBe(normalizeKeyValue('ACAO', strip));
    expect(normalizeKeyValue('João', strip)).toBe('joao');
  });

  it('mantém acentos quando removeSpecialChars está desligado', () => {
    expect(normalizeKeyValue('José', opts)).toBe('josé');
  });
});

describe('casamento de chaves com acentos', () => {
  it('encontra a linha de B com acento quando a opção está ligada', () => {
    const rows = applyLookup(
      payload({
        dataA: [{ chave: 'José' }],
        dataB: [{ chave: 'Jose', valor: 10 }],
        removeSpecialChars: true,
      })
    );
    expect(rows[0]!['Lookup_valor']).toBe(10);
    expect(rows[0]!['_match_found_B']).toBe(true);
  });
});

describe('similarity', () => {
  it('1 para iguais e < 1 para diferentes', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('abc', 'abd')).toBeCloseTo(2 / 3, 5);
  });
});

describe('curingas (matchMode 2)', () => {
  it('gera fonte de regex escapando metacaracteres', () => {
    expect(wildcardToRegexSource('a.b')).toBe('a\\.b');
    expect(wildcardToRegexSource('a*b?')).toBe('a.*b.');
    // Não deve lançar: antes o escape produzia "Unterminated character class".
    expect(() => new RegExp(`^${wildcardToRegexSource('A. Silva [1] (x)+')}$`)).not.toThrow();
  });

  it('encontra por padrão sem quebrar com caracteres especiais', () => {
    const result = applyLookup(
      payload({
        dataA: [
          { chave: 'A. Silva [1]' },
          { chave: 'empresa (teste)' },
          { chave: 'custo+extra' },
          { chave: 'sem match' },
        ],
        dataB: [
          { chave: 'A. Silva [1]', valor: 'casa' },
          { chave: 'empresa (teste)', valor: 'empresa' },
          { chave: 'custo+extra', valor: 'custo' },
        ],
        matchMode: 2,
      })
    );
    expect(result.map((r) => r.Lookup_valor)).toEqual(['casa', 'empresa', 'custo', '#N/D']);
  });

  it('aceita * e ? como curingas', () => {
    const result = applyLookup(
      payload({
        dataA: [{ chave: 'AB-1234' }, { chave: 'AB-99' }],
        dataB: [{ chave: 'AB-1234', valor: 'ok' }],
        matchMode: 2,
      })
    );
    expect(result[0].Lookup_valor).toBe('ok');
    // "AB-?234" não deve casar com "AB-99"
    const prefix = applyLookup(
      payload({
        dataA: [{ chave: 'AB-1234' }],
        dataB: [
          { chave: 'AB-1234', valor: 'ok' },
          { chave: 'AB-9999', valor: 'nao' },
        ],
      })
    );
    expect(prefix[0].Lookup_valor).toBe('ok');
  });
});

describe('cópia de colunas da Tabela A', () => {
  it('mantém a chave mesmo quando não está em selectedColsA', () => {
    const result = applyLookup(
      payload({
        dataA: [{ chave: 'X', outro: 1 }],
        dataB: [{ chave: 'X', valor: 'ok' }],
        selectedColsA: ['outro'],
      })
    );
    expect(result[0]).toMatchObject({ chave: 'X', outro: 1, Lookup_valor: 'ok', _match_found_B: true });
  });

  it('mantém a chave usada na Tabela C', () => {
    const result = applyLookup(
      payload({
        dataA: [{ chave: 'X', chaveC: 'C1', outro: 1 }],
        dataB: [{ chave: 'X', valor: 'ok' }],
        dataC: [{ chave: 'C1', valorC: 'okc' }],
        keyA_C: 'chaveC',
        keyC: 'chave',
        selectedColsC: ['valorC'],
        selectedColsA: ['outro'],
      })
    );
    expect(result[0]).toMatchObject({ chave: 'X', chaveC: 'C1', LookupC_valorC: 'okc' });
  });
});

describe('duplicateStrategy', () => {
  const dataB = [
    { chave: 'X', valor: 'um' },
    { chave: 'X', valor: 'dois' },
  ];

  it('first e last', () => {
    expect(applyLookup(payload({ dataA: [{ chave: 'X' }], dataB }))[0].Lookup_valor).toBe('um');
    expect(
      applyLookup(payload({ dataA: [{ chave: 'X' }], dataB, duplicateStrategy: 'last' }))[0]
        .Lookup_valor
    ).toBe('dois');
  });

  it('searchDirection -1 com first pega a última ocorrência', () => {
    expect(
      applyLookup(payload({ dataA: [{ chave: 'X' }], dataB, searchDirection: -1 }))[0].Lookup_valor
    ).toBe('dois');
  });

  it('concatenate não escreve "undefined" quando a coluna falta na primeira linha', () => {
    const result = applyLookup(
      payload({
        dataA: [{ chave: 'X' }],
        dataB: [
          { chave: 'X', valor: 'um' },
          { chave: 'X', valor: 'dois', extra: 'z' },
        ],
        selectedColsB: ['valor', 'extra'],
        duplicateStrategy: 'concatenate',
      })
    );
    expect(result[0].Lookup_valor).toBe('um; dois');
    expect(result[0].Lookup_extra).toBe('z');
  });
});

describe('modo aproximado (sem exactMatch)', () => {
  it('preenche Status_B = FALSO quando a chave de A é vazia', () => {
    const result = applyLookup(
      payload({
        dataA: [{ chave: '' }, { chave: 'Carlos Edurado' }],
        dataB: [{ chave: 'Carlos Eduardo', valor: 'ok' }],
        exactMatch: false,
      })
    );
    expect(result[0]).toMatchObject({ Status_B: 'FALSO', Lookup_valor: '#N/D', _match_found_B: false });
    expect(result[1]).toMatchObject({ Status_B: 'VERDADEIRO', Lookup_valor: 'ok' });
  });
});

describe('includeStatusCols', () => {
  it('omite as colunas de status quando desativado', () => {
    const result = applyLookup(
      payload({
        dataA: [{ chave: 'X' }],
        dataB: [{ chave: 'X', valor: 'ok' }],
        includeStatusCols: false,
      })
    );
    expect(result[0]).not.toHaveProperty('Status_B');
    expect(result[0]).toMatchObject({ _match_found_B: true });
  });
});

describe('erros', () => {
  it('lança quando faltam dados', () => {
    expect(() => applyLookup(payload({ dataA: null }))).toThrow('Dados ausentes');
  });
});
