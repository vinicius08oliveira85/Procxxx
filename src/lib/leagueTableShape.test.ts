import { describe, expect, it } from 'vitest';
import { orderColumnsForLeagueTable, toLeagueTablePayload } from './leagueTableShape';

describe('orderColumnsForLeagueTable', () => {
  it('coloca Rk primeiro', () => {
    const { order, metricKey } = orderColumnsForLeagueTable(['Squad', 'Rk', 'Home MP']);
    expect(metricKey).toBe('Rk');
    expect(order).toEqual(['Rk', 'Squad', 'Home MP']);
  });
});

describe('toLeagueTablePayload', () => {
  it('alinhado ao formato League Table (metric + values)', () => {
    const rows = [
      {
        Rk: '1',
        Squad: 'Arsenal',
        'Home MP': '11',
        'Away MP': '11',
      },
    ];
    const { order } = orderColumnsForLeagueTable(Object.keys(rows[0]));
    const p = toLeagueTablePayload(rows, order, { title: 'League Table', id: 'fixed-id' });
    expect(p).not.toBeNull();
    expect(p!.id).toBe('fixed-id');
    expect(p!.title).toBe('League Table');
    expect(p!.firstColumnHeader).toBe('Rk');
    expect(p!.headers).toEqual(['Squad', 'Home MP', 'Away MP']);
    expect(p!.rows).toEqual([
      { metric: '1', values: ['Arsenal', '11', '11'] },
    ]);
  });
});
