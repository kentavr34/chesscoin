import { splitTournamentPot, splitWarPot, COMMISSION_PERCENT } from '@/services/prizes';

// Числа взяты из формулировки Кенана 31.07.2026 — если тест упал,
// значит распределение разошлось с тем, что он утвердил.
describe('Касса турнира: 60/30/10 минус 10% комиссии', () => {
  it('пример Кенана: касса 100 000 → 54 000 / 27 000 / 9 000, комиссия 10 000', () => {
    const { payouts, commission } = splitTournamentPot(100_000n, 3);
    expect(payouts).toEqual([54_000n, 27_000n, 9_000n]);
    expect(commission).toBe(10_000n);
  });

  it('один игрок забирает всю кассу минус комиссия', () => {
    const { payouts, commission } = splitTournamentPot(100_000n, 1);
    expect(payouts).toEqual([90_000n]);
    expect(commission).toBe(10_000n);
  });

  it('двое: доли перенормируются, третьего места нет', () => {
    const { payouts, commission } = splitTournamentPot(90_000n, 2);
    expect(payouts[0]).toBeGreaterThan(payouts[1]);
    expect(payouts.reduce((s, p) => s + p, 0n) + commission).toBe(90_000n);
  });

  it('больше трёх игроков — платят только троим', () => {
    const { payouts } = splitTournamentPot(100_000n, 10);
    expect(payouts).toHaveLength(3);
  });

  it('ни одна монета не пропадает ни при каком раскладе', () => {
    for (const pot of [1n, 7n, 999n, 1_000n, 33_333n, 158_000n, 1_000_001n]) {
      for (const places of [1, 2, 3, 5]) {
        const { payouts, commission } = splitTournamentPot(pot, places);
        const sum = payouts.reduce((s, p) => s + p, 0n) + commission;
        expect(sum).toBe(pot);
        expect(commission).toBeGreaterThanOrEqual(0n);
      }
    }
  });

  it('комиссия — ровно десятая часть кассы (с точностью до округления вниз)', () => {
    const pot = 158_000n;
    const { commission } = splitTournamentPot(pot, 3);
    expect(commission).toBeGreaterThanOrEqual((pot * COMMISSION_PERCENT) / 100n);
    expect(commission).toBeLessThan((pot * COMMISSION_PERCENT) / 100n + 10n);
  });

  it('некому платить — вся касса остаётся столу', () => {
    const { payouts, commission } = splitTournamentPot(50_000n, 0);
    expect(payouts).toEqual([]);
    expect(commission).toBe(50_000n);
  });
});

describe('Касса войны: кратно победам, комиссия на переходе к балансу', () => {
  it('пять побед против одной — впятеро больше', () => {
    const shares = splitWarPot(600_000n, [
      { userId: 'a', wins: 5 },
      { userId: 'b', wins: 1 },
    ]);
    expect(shares.find(s => s.userId === 'a')!.gross).toBe(500_000n);
    expect(shares.find(s => s.userId === 'b')!.gross).toBe(100_000n);
    // На баланс — минус 10% с доли, а не с кассы заранее.
    expect(shares.find(s => s.userId === 'a')!.amount).toBe(450_000n);
    expect(shares.find(s => s.userId === 'b')!.amount).toBe(90_000n);
  });

  it('касса делится ЦЕЛИКОМ — доли в сумме равны кассе до комиссии', () => {
    const shares = splitWarPot(600_000n, [
      { userId: 'a', wins: 5 },
      { userId: 'b', wins: 1 },
    ]);
    expect(shares.reduce((s, x) => s + x.gross, 0n)).toBe(600_000n);
  });

  it('внёс деньги, но не сыграл — не получает ничего', () => {
    const shares = splitWarPot(100_000n, [
      { userId: 'fighter', wins: 2 },
      { userId: 'sponsor', wins: 0 },
    ]);
    expect(shares).toHaveLength(1);
    expect(shares[0].userId).toBe('fighter');
    expect(shares[0].gross).toBe(100_000n);
    expect(shares[0].amount).toBe(90_000n);
  });

  it('выплаты плюс комиссия равны кассе при любом раскладе', () => {
    for (const pot of [1n, 97n, 100n, 33_333n, 500_000n]) {
      for (const wins of [[1], [1, 1, 1], [7, 2], [10, 3, 3, 1]]) {
        const shares = splitWarPot(pot, wins.map((w, i) => ({ userId: 'u' + i, wins: w })));
        const total = shares.reduce((s, x) => s + x.amount + x.commission, 0n);
        expect(total).toBe(pot);
      }
    }
  });

  it('никто не победил — делить не по чему', () => {
    expect(splitWarPot(100_000n, [{ userId: 'a', wins: 0 }])).toEqual([]);
  });
});
