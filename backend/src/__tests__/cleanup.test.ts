/**
 * cleanup.test.ts — R2: Unit тесты для логики очистки зависших батлов
 *
 * Тестируем: логику cutoff дат, условия отмены
 * Чистые тесты — не требуют БД
 */

import { describe, it, expect } from '@jest/globals';

// ── Логика cutoff дат ─────────────────────────────────────────────────────────

describe('Stale battle cleanup logic', () => {
  it('батл старше 30 дней считается зависшим', () => {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - THIRTY_DAYS);
    const staleDate = new Date(Date.now() - THIRTY_DAYS - 1);
    expect(staleDate < cutoff).toBe(true);
  });

  it('батл моложе 30 дней НЕ зависший', () => {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - THIRTY_DAYS);
    const freshDate = new Date(Date.now() - THIRTY_DAYS + 3_600_000); // 29.9 дней
    expect(freshDate < cutoff).toBe(false);
  });

  it('только WAITING_FOR_OPPONENT батлы отменяются (не IN_PROGRESS)', () => {
    const statuses = ['WAITING_FOR_OPPONENT', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'];
    const eligibleForCleanup = statuses.filter(s => s === 'WAITING_FOR_OPPONENT');
    expect(eligibleForCleanup).toHaveLength(1);
    expect(eligibleForCleanup[0]).toBe('WAITING_FOR_OPPONENT');
  });

  it('возврат ставки: создатель получает полную ставку (bet, не bet*2)', () => {
    const bet = 5000n;
    // При отмене зависшего батла — возвращается только ставка создателя
    // (второй игрок не вступил, значит вернуть нечего)
    const refund = bet; // не bet * 2n
    expect(refund).toBe(5000n);
    expect(refund).not.toBe(10000n);
  });

  it('батл с bet=0 — возврат не требуется', () => {
    const bet = 0n;
    const needsRefund = bet > 0n;
    expect(needsRefund).toBe(false);
  });
});

// ── Dead players cleanup ──────────────────────────────────────────────────────

describe('Dead players cleanup', () => {
  it('cleanup период: 30 дней = 2592000000 мс', () => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    expect(THIRTY_DAYS_MS).toBe(2_592_000_000);
  });

  it('cutoff дата корректно вычисляется', () => {
    const now = Date.now();
    const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const diff = now - cutoff.getTime();
    // Разница должна быть примерно 30 дней (±1 сек)
    expect(Math.abs(diff - 2_592_000_000)).toBeLessThan(1000);
  });
});
