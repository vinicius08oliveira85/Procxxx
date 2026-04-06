import { describe, expect, it } from 'vitest';
import {
  detectDelimiter,
  forwardFillCategoryRow,
  isSquadColumnHeader,
  isTwoLineHeaderLayout,
  mergeTwoHeaderRows,
  normalizeSquadPastedValue,
  parsePastedTable,
  splitEven,
  tryHomeAwayTwoGroupLayout,
  uniquifyHeaders,
} from './pasteTableParser';

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

describe('normalizeSquadPastedValue / isSquadColumnHeader', () => {
  it('remove prefixo Club Crest', () => {
    expect(normalizeSquadPastedValue('Club Crest Barcelona')).toBe('Barcelona');
    expect(normalizeSquadPastedValue('club crest Real Madrid')).toBe('Real Madrid');
  });
  it('identifica coluna Squad', () => {
    expect(isSquadColumnHeader('Squad')).toBe(true);
    expect(isSquadColumnHeader('Table / Squad')).toBe(true);
    expect(isSquadColumnHeader('Table Squad')).toBe(true);
    expect(isSquadColumnHeader('Squad (2)')).toBe(true);
    expect(isSquadColumnHeader('Top Team Scorer')).toBe(false);
  });
});

describe('splitEven', () => {
  it('reparte o resto', () => {
    expect(splitEven(17, 3)).toEqual([6, 6, 5]);
  });
});

describe('forwardFillCategoryRow', () => {
  it('preenche células vazias com a categoria à esquerda', () => {
    const cells = ['', '', 'G1', '', 'G2', '', ''];
    expect(forwardFillCategoryRow(cells)).toEqual(['', '', 'G1', 'G1', 'G2', 'G2', 'G2']);
  });
});

describe('isTwoLineHeaderLayout', () => {
  it('detecta linha de categorias mais curta', () => {
    expect(isTwoLineHeaderLayout(['a', 'b'], ['a', 'b', 'c'])).toBe(true);
  });
  it('detecta mesma largura com vazios', () => {
    expect(isTwoLineHeaderLayout(['', 'X'], ['a', 'b'])).toBe(true);
  });
  it('rejeita duas linhas cheias iguais', () => {
    expect(isTwoLineHeaderLayout(['A', 'B'], ['1', '2'])).toBe(false);
  });
});

describe('tryHomeAwayTwoGroupLayout', () => {
  it('20 colunas: 2 fixas + 9 Home + 9 Away', () => {
    const r = tryHomeAwayTwoGroupLayout(['Home', 'Away'], 20);
    expect(r).toEqual({ L: 2, spans: [9, 9] });
  });
  it('18 colunas: só blocos Home/Away', () => {
    expect(tryHomeAwayTwoGroupLayout(['Home', 'Away'], 18)).toEqual({ L: 0, spans: [9, 9] });
  });
});

describe('mergeTwoHeaderRows (FBref)', () => {
  const top = '\tPlaying Time\tPerformance\tPer 90 Minutes'.split('\t');
  const bottom =
    'Squad\t# Pl\tAge\tPoss\tMP\tStarts\tMin\t90s\tGls\tAst\tG+A\tG-PK\tPK\tPKatt\tCrdY\tCrdR\tGls\tAst\tG+A\tG-PK\tG+A-PK'.split(
      '\t'
    );

  it('gera chaves compostas com spans 4+8+5 quando Squad', () => {
    const h = mergeTwoHeaderRows(top, bottom);
    expect(h[0]).toBe('Squad');
    expect(h[4]).toBe('Playing Time MP');
    expect(h[7]).toBe('Playing Time 90s');
    expect(h[8]).toBe('Performance Gls');
    expect(h[15]).toBe('Performance CrdR');
    expect(h[16]).toBe('Per 90 Minutes Gls');
    expect(h[20]).toBe('Per 90 Minutes G+A-PK');
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

  it('cabeçalho Home/Away com Rk e Squad (FBref)', () => {
    const sample = [
      '\tHome\tAway',
      'Rk\tSquad\tMP\tW\tD\tL\tGF\tGA\tGD\tPts\tPts/MP\tMP\tW\tD\tL\tGF\tGA\tGD\tPts\tPts/MP',
      '1\tClub Crest Barcelona\t15\t15\t0\t0\t47\t8\t+39\t45\t3.00\t15\t10\t1\t4\t33\t21\t+12\t31\t2.07',
    ].join('\n');
    const r = parsePastedTable(sample, true);
    expect(r.status).toBe('ready');
    expect(r.rows![0].Squad).toBe('Barcelona');
    expect(r.rows![0]['Home MP']).toBe('15');
    expect(r.rows![0]['Home Pts']).toBe('45');
    expect(r.rows![0]['Away MP']).toBe('15');
    expect(r.rows![0]['Away Pts']).toBe('31');
    expect(r.rows![0].Rk).toBe('1');
  });

  it('remove Club Crest na coluna Squad (tabela de classificação)', () => {
    const sample = [
      'Rk\tSquad\tMP\tW',
      '1\tClub Crest Barcelona\t30\t25',
      '2\tClub Crest Real Madrid\t30\t22',
    ].join('\n');
    const r = parsePastedTable(sample, true);
    expect(r.status).toBe('ready');
    expect(r.rows![0].Squad).toBe('Barcelona');
    expect(r.rows![1].Squad).toBe('Real Madrid');
  });

  it('tabela duas linhas de cabeçalho (estilo FBref)', () => {
    const sample = [
      '\tPlaying Time\tPerformance\tPer 90 Minutes',
      'Squad\t# Pl\tAge\tPoss\tMP\tStarts\tMin\t90s\tGls\tAst\tG+A\tG-PK\tPK\tPKatt\tCrdY\tCrdR\tGls\tAst\tG+A\tG-PK\tG+A-PK',
      'Alavés\t28\t28.0\t50.3\t30\t330\t2,700\t30.0\t30\t18\t48\t24\t6\t6\t73\t5\t1.00\t0.60\t1.60\t0.80\t1.40',
    ].join('\n');
    const r = parsePastedTable(sample, true);
    expect(r.status).toBe('ready');
    expect(r.message).toContain('2 linhas');
    expect(r.rows).toHaveLength(1);
    expect(r.rows![0]['Squad']).toBe('Alavés');
    expect(r.rows![0]['Playing Time MP']).toBe('30');
    expect(r.rows![0]['Performance Gls']).toBe('30');
    expect(r.rows![0]['Per 90 Minutes Gls']).toBe('1.00');
  });
});
