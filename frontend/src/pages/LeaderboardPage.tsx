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
  DIAMOND: 'Diamond', PLATINUM: 'Platinum', GOLD: 'Gold', SILVER: 'Silver', BRONZE: 'Bronze',
};
const POS_COLOR: Record<number, string> = { 1: '#D4A843', 2: '#C0C0C0', 3: '#CD7F32' };

const CARD_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg,#141018,#0F0E18)',
  border: '.5px solid rgba(212,168,67,.22)',
  borderRadius: 16,
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: '.58rem',
  fontWeight: 700,
  color: '#7A7875',
  textTransform: 'uppercase',
  letterSpacing: '.14em',
  padding: '.9rem .85rem .45rem',
};

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

  const periodLabels: Record<string, string> = {
    all: 'Всё время',
    week: 'Неделя',
    month: 'Месяц',
  };

  return (
    <PageLayout title={t.leaderboard.title} backTo="/" centered>
      <div style={{ paddingBottom: 40, background: '#0D0D12', minHeight: '100%' }}>

        {/* Вкладки периода */}
        <div style={{ display: 'flex', gap: 6, padding: '.9rem .85rem .45rem' }}>
          {(['all', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 10,
                border: period === p ? '.5px solid rgba(212,168,67,.4)' : '.5px solid rgba(255,255,255,.08)',
                background: period === p ? 'rgba(212,168,67,.25)' : 'rgba(255,255,255,.06)',
                color: period === p ? '#D4A843' : '#9A9490',
                fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Лига пользователя */}
        {user && (
          <div style={{ margin: '0 .85rem .6rem', ...CARD_STYLE, padding: '.85rem', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>{leagueEmoji[user.league]}</span>
            <div>
              <div style={{ fontSize: '.9rem', fontWeight: 900, color: '#D4A843' }}>
                {LEAGUE_LABELS[user.league] ?? user.league}
              </div>
              <div style={{ fontSize: '.78rem', color: '#9A9490', marginTop: 2 }}>
                {fmtBalance(user.balance)} ᚙ · ELO {user.elo}
              </div>
            </div>
          </div>
        )}

        {/* Поиск */}
        <div style={{
          margin: '0 .85rem .6rem',
          padding: '9px 12px',
          background: 'linear-gradient(135deg,#141018,#0F0E18)',
          border: '.5px solid rgba(255,255,255,.08)',
          borderRadius: 12,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" stroke="#7A7875" strokeWidth="1.5"/>
            <path d="M16.5 16.5l3.5 3.5" stroke="#7A7875" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            placeholder={t.common.elo + ' / ' + t.common.players}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'inherit', fontSize: '.85rem', color: '#EAE2CC',
            }}
          />
        </div>

        {/* Табы лиг */}
        <div style={{ display: 'flex', gap: 6, padding: '0 .85rem .6rem', overflowX: 'auto' }}>
          {LEAGUES.map((l) => (
            <button key={l} onClick={() => setLeague(l)} style={{
              padding: '6px 14px', borderRadius: 20,
              fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: league === l ? 'rgba(212,168,67,.20)' : 'rgba(255,255,255,.06)',
              color: league === l ? '#D4A843' : '#9A9490',
              border: `${league === l ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.08)'}`,
              fontFamily: 'inherit',
              transition: 'all .15s',
            }}>
              {LEAGUE_LABELS[l]}
            </button>
          ))}
        </div>

        {/* Список */}
        <div style={{ margin: '0 .85rem', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(212,168,67,.22)', borderRadius: 16, overflow: 'hidden' }}>

          {/* Закреплённая строка "Вы" */}
          {user && (
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(13,13,18,0.97)', backdropFilter: 'blur(10px)' }}>
              <LbRow rank={0} user={user as import("@/types").User} balance={user.balance} isMe />
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', color: '#9A9490', padding: '2rem', fontSize: '.85rem' }}>
              {t.common.loading}
            </div>
          )}

          {filtered.map((u, idx) => (
            <LbRow
              key={u.id}
              rank={idx + 1}
              user={u}
              balance={u.balance ?? '0'}
              onClick={() => setMiniProfileId(u.id)}
            />
          ))}
        </div>

      </div>

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
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '.75rem .85rem',
        borderBottom: '.5px solid rgba(255,255,255,.07)',
        background: isMe ? 'rgba(212,168,67,.07)' : 'transparent',
        cursor: isMe ? 'default' : 'pointer',
        transition: 'background .15s',
      }}
    >
      <span style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: '.8rem', fontWeight: 700,
        color: POS_COLOR[rank] ?? '#7A7875',
        width: 22, textAlign: 'center', flexShrink: 0,
      }}>
        {isMe ? t.common.me : rank}
      </span>
      <Avatar user={user} size="s" gold={isMe} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '.85rem', fontWeight: 700,
          color: isMe ? '#D4A843' : '#EAE2CC',
          display: 'flex', alignItems: 'center', gap: 5,
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {user.firstName}
          {user.isMonthlyChampion && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#D4A843" aria-label="Monthly Champion">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          )}
        </div>
        <div style={{ fontSize: '.72rem', color: '#9A9490', marginTop: 1 }}>
          {user.username ? `@${user.username} · ` : ''}ELO {user.elo}
        </div>
      </div>
      <span style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: '.78rem', fontWeight: 700, color: '#D4A843',
        flexShrink: 0,
      }}>
        {fmtBalance(balance)} ᚙ
      </span>
    </div>
  );
};
