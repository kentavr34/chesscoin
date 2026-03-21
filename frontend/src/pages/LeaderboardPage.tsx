import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { MiniProfileSheet } from '@/components/ui/MiniProfileSheet';
import { useUserStore } from '@/store/useUserStore';
import { leaderboardApi } from '@/api';
import { fmtBalance, leagueEmoji } from '@/utils/format';
import type { LeaderboardUser } from '@/types';
import { useT } from '@/i18n/useT';

const LEAGUES = ['DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'];
const LEAGUE_LABELS: Record<string, string> = {
  DIAMOND: '💎 Алмаз', PLATINUM: '⭐ Платина', GOLD: '🥇 Золото', SILVER: '🥈 Серебро', BRONZE: '🥉 Бронза',
};
const POS_COLOR: Record<number, string> = { 1: 'var(--accent, #F5C842)', 2: '#C0C0C0', 3: '#CD7F32' };

export const LeaderboardPage: React.FC = () => {
  const t = useT();
  const { user } = useUserStore();
  const [league, setLeague] = useState<string>('DIAMOND');
  const [period, setPeriod] = useState<'all' | 'week' | 'month'>('all');
  const [items, setItems] = useState<LeaderboardUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [miniProfileId, setMiniProfileId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    leaderboardApi.get({ league, limit: 50 })
      .then((r) => { setItems(r.users); setLoading(false); })
      .catch(() => setLoading(false));
  }, [league]);

  const filtered = query.length >= 3
    ? items.filter((u) => u.firstName.toLowerCase().includes(query.toLowerCase()) || u.username?.toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <PageLayout title={t.leaderboard.title} backTo="/" centered>

      {/* Вкладки периода */}
      <div style={{ display: 'flex', gap: 6, margin: '8px 18px 0' }}>
        {([['all', '🌐 Всё время'], ['week', '📅 Неделя'], ['month', '📆 Месяц']] as const).map(([p, label]) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none',
              background: period === p ? 'var(--accent, #F5C842)' : 'var(--bg-card, #1C2030)',
              color: period === p ? '#0B0D11' : 'var(--text-secondary, #8B92A8)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .15s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Лига пользователя */}
      {user && (
        <div style={{ margin: '6px 18px 0', padding: '14px 16px', background: 'linear-gradient(135deg,rgba(245,200,66,0.08),rgba(245,200,66,0.02))', border: '1px solid rgba(245,200,66,0.18)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{leagueEmoji[user.league]}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>{LEAGUE_LABELS[user.league] ?? user.league}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>{fmtBalance(user.balance)} ᚙ · ELO {user.elo}</div>
          </div>
        </div>
      )}

      {/* Поиск */}
      <div style={{ margin: '8px 18px', padding: '9px 12px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: 'var(--text-muted, #4A5270)' }}>🔍</span>
        <input
          placeholder={t.common.elo + ' / ' + t.common.players}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-primary, #F0F2F8)' }}
        />
      </div>

      {/* Табы лиг */}
      <div style={{ display: 'flex', gap: 6, padding: '0 18px 8px', overflowX: 'auto' }}>
        {LEAGUES.map((l) => (
          <button key={l} onClick={() => setLeague(l)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            background: league === l ? 'rgba(245,200,66,0.12)' : 'var(--bg-card, #1C2030)',
            color: league === l ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)',
            border: `1px solid ${league === l ? 'rgba(245,200,66,0.25)' : 'var(--border, rgba(255,255,255,0.07))'}`,
            fontFamily: 'inherit',
          }}>
            {LEAGUE_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Закреплённая строка "Вы" */}
      {user && (
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(11,13,17,0.97)', backdropFilter: 'blur(10px)' }}>
          <LbRow rank={0} user={user as import("@/types").User} balance={user.balance} isMe />
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 32 }}>{t.common.loading}</div>}
      {filtered.map((u, idx) => (
        <LbRow
          key={u.id}
          rank={idx + 1}
          user={u}
          balance={u.balance ?? '0'}
          onClick={() => setMiniProfileId(u.id)}
        />
      ))}

      {miniProfileId && (
        <MiniProfileSheet userId={miniProfileId} onClose={() => setMiniProfileId(null)} />
      )}
    </PageLayout>
  );
};

const LbRow: React.FC<{ rank: number; user: import("@/types").UserPublic; balance: string; isMe?: boolean; onClick?: () => void }> = ({ rank, user, balance, isMe, onClick }) => {
  const t = useT();
  return (
  <div
    onClick={!isMe ? onClick : undefined}
    style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: isMe ? 'rgba(245,200,66,0.08)' : undefined,
    cursor: 'pointer',
  }}>
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: POS_COLOR[rank] ?? 'var(--text-muted, #4A5270)', width: 24, textAlign: 'center', flexShrink: 0 }}>
      {isMe ? t.common.me ?? 'Вы' : rank}
    </span>
    <Avatar user={user} size="s" gold={isMe} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? 'var(--accent, #F5C842)' : 'var(--text-primary, #F0F2F8)', display: 'flex', alignItems: 'center', gap: 5 }}>
        {user.firstName}
        {user.isMonthlyChampion && <span style={{ fontSize: 14 }} title="Чемпион месяца">👑</span>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', marginTop: 1 }}>{user.username ? `@${user.username} · ` : ''}ELO {user.elo}</div>
    </div>
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>
      {fmtBalance(balance)} ᚙ
    </span>
  </div>
);
};
