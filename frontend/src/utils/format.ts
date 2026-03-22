// Форматирует bigint-строку в читаемый вид
export const fmtBalance = (val: string | number | bigint): string => {
  const n = typeof val === 'bigint' ? val : BigInt(val);
  if (n >= 1_000_000n) return (Number(n) / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000n) return (Number(n) / 1_000).toFixed(1).replace('.0', '') + 'K';
  return n.toString();
};

// Секунды → "M:SS"
export const fmtTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Обратный отсчёт в формате H:MM:SS (для таймеров восстановления попыток)
export const fmtCountdown = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Дата в локальный формат
export const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Инициалы из имени
export const initials = (firstName: string, lastName?: string | null): string => {
  const a = firstName?.[0]?.toUpperCase() ?? '';
  const b = lastName?.[0]?.toUpperCase() ?? '';
  return a + b || '?';
};

// Цвет лиги
// Лиги совпадают с Prisma enum: BRONZE SILVER GOLD DIAMOND CHAMPION STAR
export const leagueColor: Record<string, string> = {
  BRONZE:   '#CD7F32',
  SILVER:   '#C0C0C0',
  GOLD:     '#F5C842',
  DIAMOND:  '#7B61FF',
  CHAMPION: '#F5C842',
  STAR:     '#FFD966',
};

export const leagueEmoji: Record<string, string> = {
  BRONZE:   '🥉',
  SILVER:   '🥈',
  GOLD:     '🥇',
  DIAMOND:  '💎',
  CHAMPION: '👑',
  STAR:     '🌟',
};

// Тип сессии → метка
export const sessionTypeLabel: Record<string, string> = {
  BOT: 'J.A.R.V.I.S',
  BATTLE: 'Battle',
  FRIENDLY: 'Friendly',
};
