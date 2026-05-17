import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtBalance } from '@/utils/format';

// Пороги лиг — единственный источник правды для прогресс-бара.
// Совпадают с Prisma enum League: BRONZE SILVER GOLD DIAMOND CHAMPION STAR.
const LEAGUE_THRESHOLDS: Record<string, { next: string | null; threshold: bigint; nextThreshold: bigint }> = {
  BRONZE:   { next: 'SILVER',   threshold: 0n,           nextThreshold: 100_000n },
  SILVER:   { next: 'GOLD',     threshold: 100_000n,     nextThreshold: 1_000_000n },
  GOLD:     { next: 'DIAMOND',  threshold: 1_000_000n,   nextThreshold: 5_000_000n },
  DIAMOND:  { next: 'CHAMPION', threshold: 5_000_000n,   nextThreshold: 10_000_000n },
  CHAMPION: { next: 'STAR',     threshold: 10_000_000n,  nextThreshold: 50_000_000n },
  STAR:     { next: null,       threshold: 50_000_000n,  nextThreshold: 50_000_000n },
};

// Локализованные имена лиг (Кенан 2026-05-17: «Лига: Бронзовый», а не BRONZE).
const LEAGUE_RU: Record<string, string> = {
  BRONZE: 'Бронзовый', SILVER: 'Серебряный', GOLD: 'Золотой',
  DIAMOND: 'Алмазный', CHAMPION: 'Чемпион', STAR: 'Звёздный',
};
// Родительный падеж — для «до Серебряного: 66K».
const LEAGUE_RU_GENITIVE: Record<string, string> = {
  BRONZE: 'Бронзового', SILVER: 'Серебряного', GOLD: 'Золотого',
  DIAMOND: 'Алмазного', CHAMPION: 'Чемпиона', STAR: 'Звёздного',
};

// Цвет «монеты» лиги: реальные металлы / камни. Не путать с leagueColor
// в utils/format.ts — там жёлтый для CHAMPION (legacy). Здесь — фиолетовый
// для Champion и бирюзовый для Diamond, как просил Кенан.
const LEAGUE_COIN: Record<string, { core: string; edge: string; bar: string; barTrack: string }> = {
  BRONZE:   { core: '#CD7F32', edge: '#7A4A1C', bar: 'linear-gradient(90deg,#CD7F32,#E69F4D)', barTrack: 'rgba(205,127,50,.10)' },
  SILVER:   { core: '#C8C8C8', edge: '#6E6E6E', bar: 'linear-gradient(90deg,#A8A8A8,#E0E0E0)', barTrack: 'rgba(200,200,200,.10)' },
  GOLD:     { core: '#F0C85A', edge: '#8A6020', bar: 'linear-gradient(90deg,#D4A843,#F0C85A)', barTrack: 'rgba(240,200,90,.10)' },
  DIAMOND:  { core: '#7DD3FC', edge: '#0B7AA8', bar: 'linear-gradient(90deg,#5BB8DB,#7DD3FC)', barTrack: 'rgba(125,211,252,.10)' },
  CHAMPION: { core: '#B794F4', edge: '#5E3DB3', bar: 'linear-gradient(90deg,#9F7DDB,#B794F4)', barTrack: 'rgba(183,148,244,.10)' },
  STAR:     { core: '#FFD966', edge: '#A8861E', bar: 'linear-gradient(90deg,#FFD966,#FFE9A0)', barTrack: 'rgba(255,217,102,.10)' },
};

// Маленькая «монета» в цвет лиги — плейсхолдер. Существующий <CoinIcon/>
// зашит на золотой градиент, перекрасить нельзя без рефакторинга, поэтому
// здесь свой компактный SVG: круг с радиальным градиентом и внутренним кольцом.
const LeagueCoin: React.FC<{ league: string; size?: number }> = ({ league, size = 14 }) => {
  const c = LEAGUE_COIN[league] ?? LEAGUE_COIN.BRONZE;
  const id = `lc-${league}`;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id={id} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".55" />
          <stop offset="45%" stopColor={c.core} />
          <stop offset="100%" stopColor={c.edge} />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="9" fill={`url(#${id})`} stroke={c.edge} strokeWidth=".8" />
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".5" />
    </svg>
  );
};

interface LeagueProgressBarProps {
  league: string;
  balance: string | null | undefined;
  /** CSS-margin для внешнего контейнера. Default — стиль ProfilePage. */
  margin?: string;
}

/**
 * Кликабельная панель прогресса лиги (Bronze → Silver → Gold → Diamond → Champion → Star).
 * Клик → /leaderboard. Используется на ProfilePage и HomePage.
 */
export const LeagueProgressBar: React.FC<LeagueProgressBarProps> = ({ league, balance, margin = '0 18px 10px' }) => {
  const navigate = useNavigate();

  const info = LEAGUE_THRESHOLDS[league];
  if (!info) return null;

  const coin = LEAGUE_COIN[league] ?? LEAGUE_COIN.BRONZE;
  const bal = BigInt(balance ?? '0');
  const range = info.nextThreshold - info.threshold;
  const progress = info.next === null
    ? 100
    : range > 0n ? Math.min(100, Number((bal - info.threshold) * 100n / range)) : 100;
  const remaining = info.next ? info.nextThreshold - bal : 0n;
  const titleName = LEAGUE_RU[league] ?? league;
  const nextName = info.next ? (LEAGUE_RU_GENITIVE[info.next] ?? info.next) : null;

  return (
    <div
      onClick={() => navigate('/leaderboard')}
      style={{
        margin,
        padding: '12px 16px',
        background: 'linear-gradient(135deg,#141018,#0F0E18)',
        border: '.5px solid rgba(74,158,255,.18)',
        borderRadius: 16,
        cursor: 'pointer',
      }}
      title="Перейти на страницу рейтингов"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: coin.core, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <LeagueCoin league={league} size={14} />
          Лига: {titleName}
        </div>
        {nextName ? (
          <div style={{ fontSize: 10, color: '#9A9490', whiteSpace: 'nowrap' }}>
            до {nextName}: {fmtBalance(remaining.toString())}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: '#3DBA7A', fontWeight: 700 }}>★ Максимальная лига</div>
        )}
      </div>
      <div style={{ height: 5, background: coin.barTrack, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: coin.bar, borderRadius: 3, transition: 'width .5s' }} />
      </div>
      <div style={{ fontSize: 9, color: '#5A5248', marginTop: 4 }}>{progress}% до следующей лиги</div>
    </div>
  );
};
