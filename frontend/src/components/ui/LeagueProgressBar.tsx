import React from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtBalance, leagueEmoji } from '@/utils/format';
import { useT } from '@/i18n/useT';

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
  const t = useT();

  const info = LEAGUE_THRESHOLDS[league];
  if (!info) return null;

  const bal = BigInt(balance ?? '0');
  const range = info.nextThreshold - info.threshold;
  const progress = info.next === null
    ? 100
    : range > 0n ? Math.min(100, Number((bal - info.threshold) * 100n / range)) : 100;
  const remaining = info.next ? info.nextThreshold - bal : 0n;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#F0C85A' }}>
          {leagueEmoji[league]} {t.profile.league(league)}
        </div>
        {info.next ? (
          <div style={{ fontSize: 10, color: '#9A9490' }}>
            {t.profile.toLeague(`${leagueEmoji[info.next]} ${info.next}`, fmtBalance(remaining.toString()))}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: '#3DBA7A', fontWeight: 700 }}>{t.profile.maxLeague}</div>
        )}
      </div>
      <div style={{ height: 5, background: 'linear-gradient(135deg,#141018,#0F0E18)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#F0C85A,#FFD966)', borderRadius: 3, transition: 'width .5s' }} />
      </div>
      <div style={{ fontSize: 9, color: '#5A5248', marginTop: 4 }}>{t.profile.leagueProgress(progress)}</div>
    </div>
  );
};
