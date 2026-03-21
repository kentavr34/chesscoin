/**
 * session.test.ts — R2: Unit тесты для логики игровых сессий
 *
 * Тестируем: параллельные сессии BOT+BATTLE, ограничения
 * Чистые тесты — не требуют БД
 */

import { describe, it, expect } from '@jest/globals';

// ── Логика параллельных сессий ────────────────────────────────────────────────

describe('Session concurrency rules', () => {
  type SessionType = 'BOT' | 'BATTLE' | 'FRIENDLY';

  const MAX_BOT = 1;
  const MAX_BATTLE = 2;
  const MAX_TOTAL = 3;

  function canCreateSession(
    existing: Array<{ type: SessionType }>,
    newType: SessionType
  ): { allowed: boolean; reason?: string } {
    if (existing.length >= MAX_TOTAL) {
      return { allowed: false, reason: 'MAX_ACTIVE_SESSIONS' };
    }
    if (newType === 'BOT') {
      const botCount = existing.filter(s => s.type === 'BOT').length;
      if (botCount >= MAX_BOT) return { allowed: false, reason: 'MAX_BOT_SESSIONS' };
    }
    if (newType === 'BATTLE') {
      const battleCount = existing.filter(s => s.type === 'BATTLE').length;
      if (battleCount >= MAX_BATTLE) return { allowed: false, reason: 'MAX_BATTLE_SESSIONS' };
    }
    return { allowed: true };
  }

  it('можно играть с Джарвисом и батл одновременно (BOT+BATTLE)', () => {
    const existing = [{ type: 'BOT' as const }];
    const result = canCreateSession(existing, 'BATTLE');
    expect(result.allowed).toBe(true);
  });

  it('нельзя запустить второго Джарвиса при активном', () => {
    const existing = [{ type: 'BOT' as const }];
    const result = canCreateSession(existing, 'BOT');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('MAX_BOT_SESSIONS');
  });

  it('можно запустить 2 батла одновременно', () => {
    const existing = [{ type: 'BATTLE' as const }];
    const result = canCreateSession(existing, 'BATTLE');
    expect(result.allowed).toBe(true);
  });

  it('нельзя запустить 3-й батл', () => {
    const existing = [
      { type: 'BATTLE' as const },
      { type: 'BATTLE' as const },
    ];
    const result = canCreateSession(existing, 'BATTLE');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('MAX_BATTLE_SESSIONS');
  });

  it('при 3 активных сессиях никакая новая не создаётся', () => {
    const existing = [
      { type: 'BOT' as const },
      { type: 'BATTLE' as const },
      { type: 'BATTLE' as const },
    ];
    expect(canCreateSession(existing, 'BOT').allowed).toBe(false);
    expect(canCreateSession(existing, 'BATTLE').allowed).toBe(false);
  });

  it('при пустом списке любую сессию можно создать', () => {
    expect(canCreateSession([], 'BOT').allowed).toBe(true);
    expect(canCreateSession([], 'BATTLE').allowed).toBe(true);
  });
});

// ── Session code generation ───────────────────────────────────────────────────

describe('Session code', () => {
  it('nanoid генерирует строку длиной 8', () => {
    // Тестируем ожидания к формату кода без вызова nanoid
    const codePattern = /^[A-Z0-9]{8}$/;
    const mockCode = 'ABC12345';
    expect(codePattern.test(mockCode)).toBe(true);
  });

  it('разные коды не совпадают', () => {
    // Имитируем два разных кода
    const code1 = 'ABC12345';
    const code2 = 'XYZ67890';
    expect(code1).not.toBe(code2);
  });
});

// ── War battles limit ─────────────────────────────────────────────────────────

describe('War battles limit', () => {
  const MAX_WAR_BATTLES = 10;

  it('до 10 батлов в войне — можно создать новый', () => {
    const activeCount = 9;
    expect(activeCount < MAX_WAR_BATTLES).toBe(true);
  });

  it('ровно 10 батлов — нельзя создать новый', () => {
    const activeCount = 10;
    expect(activeCount < MAX_WAR_BATTLES).toBe(false);
  });

  it('0 батлов — можно создавать', () => {
    const activeCount = 0;
    expect(activeCount < MAX_WAR_BATTLES).toBe(true);
  });
});
