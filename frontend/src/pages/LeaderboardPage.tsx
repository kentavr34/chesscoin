import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { leaderboardApi } from '@/api';
import { fmtBalance, leagueEmoji } from '@/utils/format';
import type { LeaderboardUser } from '@/types';

const LEAGUES = ['DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'];
const LEAGUE_LABELS: Record<string, string> = {
  DIAMOND: '💎 Алмаз', PLATINUM: '⭐ Платина', GOLD: '🥇 Золото', SILVER: '🥈 Серебро', BRONZE: '🥉 Бронза',
};
const POS_COLOR: Record<number, string> = { 1: '#F5C842', 2: '#C0C0C0', 3: '#CD7F32' };

export const LeaderboardPage: React.FC = () => {
  const { user } = useUserStore();
  const [league, setLeague] = useState<string>('DIAMOND');
  const [items, setItems] = useState<LeaderboardUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

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
    <PageLayout title="Рейтинг" backTo="/">
      {/* Лига пользователя */}
      {user && (
        <div style={{ margin: '6px 18px 0', padding: '14px 16px', background: 'linear-gradient(135deg,rgba(245,200,66,0.08),rgba(245,200,66,0.02))', border: '1px solid rgba(245,200,66,0.18)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{leagueEmoji[user.league]}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{LEAGUE_LABELS[user.league] ?? user.league}</div>
            <div style={{ fontSize: 11, color: '#A8B0C8', marginTop: 2 }}>{fmtBalance(user.balance)} ᚙ · ELO {user.elo}</div>
          </div>
        </div>
      )}

      {/* Поиск */}
      <div style={{ margin: '8px 18px', padding: '9px 12px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#6B7494' }}>🔍</span>
        <input
          placeholder="Поиск игрока (мин. 3 символа)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, color: '#F0F2F8' }}
        />
      </div>

      {/* Табы лиг */}
      <div style={{ display: 'flex', gap: 6, padding: '0 18px 8px', overflowX: 'auto' }}>
        {LEAGUES.map((l) => (
          <button key={l} onClick={() => setLeague(l)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            background: league === l ? 'rgba(245,200,66,0.12)' : '#1C2030',
            color: league === l ? '#F5C842' : '#A8B0C8',
            border: `1px solid ${league === l ? 'rgba(245,200,66,0.25)' : 'rgba(255,255,255,0.07)'}`,
            fontFamily: 'inherit',
          }}>
            {LEAGUE_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Закреплённая строка "Вы" */}
      {user && (
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(11,13,17,0.97)', backdropFilter: 'blur(10px)' }}>
          <LbRow rank={0} user={user as any} balance={user.balance} isMe />
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', color: '#6B7494', padding: 32 }}>Загрузка...</div>}
      {filtered.map((u, idx) => (
        <LbRow key={u.id} rank={idx + 1} user={u} balance={(u as any).balance ?? '0'} />
      ))}
    </PageLayout>
  );
};

const LbRow: React.FC<{ rank: number; user: any; balance: string; isMe?: boolean }> = ({ rank, user, balance, isMe }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: isMe ? 'rgba(245,200,66,0.08)' : undefined,
    cursor: 'pointer',
  }}>
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: POS_COLOR[rank] ?? '#6B7494', width: 24, textAlign: 'center', flexShrink: 0 }}>
      {isMe ? 'Вы' : rank}
    </span>
    <Avatar user={user} size="s" gold={isMe} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? '#F5C842' : '#F0F2F8' }}>{user.firstName}</div>
      <div style={{ fontSize: 10, color: '#A8B0C8', marginTop: 1 }}>{user.username ? `@${user.username} · ` : ''}ELO {user.elo}</div>
    </div>
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#F5C842' }}>
      {fmtBalance(balance)} ᚙ
    </span>
  </div>
);
