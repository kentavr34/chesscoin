import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { profileApi } from '@/api';
import { api } from '@/api/client';
import { PgnReplayModal } from '@/components/profile/PgnReplayModal';
import { BattleHistoryCard, type BattleHistoryItem } from '@/components/battle/BattleHistoryCard';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';
import type { UserPublic } from '@/types';

type HistoryGame = BattleHistoryItem;

// PR-3 hotfix Кенан 2026-05-18: два режима — «Свои» (моя история через
// /profile/games) и «Публичные» (общая лента всех завершённых публичных
// партий через /games/public-history; работает как чужие шахматные партии).
type ScopeTab = 'mine' | 'public';

// Внутри «Свои» — фильтры по источнику партии (как было в PR-2).
type FilterTab = 'all' | 'battle' | 'war' | 'tournament';
type SortKey = 'date' | 'bet' | 'result';

interface PublicGame {
  sessionId: string;
  fen: string; pgn: string;
  bet: string | null;
  duration: number | null;
  startedAt: string | null; finishedAt: string | null;
  sourceType: string | null;
  shareToken: string | null;
  winner: UserPublic | null;
  loser:  UserPublic | null;
  isDraw: boolean;
  payout: string | null;
}

const PAGE_SIZE = 20;

const ScrollIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="6" width="24" height="28" rx="4" stroke="#3A3632" strokeWidth="1.5" fill="none"/>
    <rect x="6" y="8" width="6" height="24" rx="3" stroke="#3A3632" strokeWidth="1.5" fill="none"/>
    <line x1="15" y1="13" x2="27" y2="13" stroke="#3A3632" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="15" y1="18" x2="27" y2="18" stroke="#3A3632" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="15" y1="23" x2="23" y2="23" stroke="#3A3632" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'battle', label: 'Батлы' },
  { key: 'war', label: 'Войны' },
  { key: 'tournament', label: 'Турниры' },
];

const SCOPE_TABS: { key: ScopeTab; label: string }[] = [
  { key: 'mine',   label: 'Свои' },
  { key: 'public', label: 'Публичные' },
];

export const BattleHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [scope, setScope] = useState<ScopeTab>('mine');
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [publicGames, setPublicGames] = useState<PublicGame[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [showSort, setShowSort] = useState(false);
  const [replayData, setReplayData] = useState<{
    pgn: string;
    title: string;
    sessionId: string;
    shareToken?: string | null;
    whitePlayer?: UserPublic | null;
    blackPlayer?: UserPublic | null;
  } | null>(null);
  const me = useUserStore((s) => s.user);

  const loadGames = useCallback(async (off: number, filter: FilterTab) => {
    setLoading(true);
    try {
      const source = filter === 'battle' ? 'BATTLE'
        : filter === 'war' ? 'WAR'
        : filter === 'tournament' ? 'TOURNAMENT'
        : undefined;
      const r = (await profileApi.getGames(PAGE_SIZE, off, source)) as any;
      setGames(r.games as HistoryGame[]);
      setTotal(r.total ?? 0);
      setOffset(off);
    } catch {
      // audit-fix 2026-06-12: при ошибке API раньше молча висел старый список
      setGames([]);
      setTotal(0);
      window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text: 'Не удалось загрузить историю', type: 'error' } }));
    } finally {
      setLoading(false);
    }
  }, []);

  // PR-3 hotfix: загрузка общего фида публичных партий (без auth-юзера-фильтра).
  const loadPublic = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const r = await api.get<{ total: number; games: PublicGame[] }>(`/games/public-history?limit=${PAGE_SIZE}&offset=${off}`);
      setPublicGames(r.games ?? []);
      setTotal(r.total ?? 0);
      setOffset(off);
    } catch {
      setPublicGames([]);
      setTotal(0);
      window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text: 'Не удалось загрузить ленту', type: 'error' } }));
    } finally {
      setLoading(false);
    }
  }, []);

  // При смене scope или filter — соответствующая загрузка.
  useEffect(() => {
    if (scope === 'mine') loadGames(0, activeFilter);
    else loadPublic(0);
  }, [scope, activeFilter, loadGames, loadPublic]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const filteredGames = games
    // Бот-игры вычищены из истории батлов: это тренировка, не стат-процесс
    .filter((g) => !g.hasBot)
    // PR-2: фильтр по источнику применяется на сервере (см. loadGames), здесь
    // только клиентский поиск/сортировка по имени.
    .filter((g) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const name = (g.opponent?.firstName ?? '').toLowerCase();
      return name.includes(q);
    })
    .sort((a, b) => {
      if (sortKey === 'date') {
        return (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '');
      }
      if (sortKey === 'bet') {
        return Number(BigInt(b.bet ?? '0') - BigInt(a.bet ?? '0'));
      }
      if (sortKey === 'result') {
        const ord = { win: 0, draw: 1, loss: 2 };
        return (ord[a.result as keyof typeof ord] ?? 3) - (ord[b.result as keyof typeof ord] ?? 3);
      }
      return 0;
    });

  const sortLabels: Record<SortKey, string> = { date: 'По дате', bet: 'По ставке', result: 'По результату' };

  return (
    <PageLayout title="История" centered backTo="/battles">
      {/* PR-3 hotfix: переключатель Свои / Публичные на самом верху. */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 14px 0', background: 'transparent' }}>
        {SCOPE_TABS.map((s) => {
          const active = scope === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 11,
                background: active ? 'linear-gradient(135deg,#2A1E08,#4A3810)' : 'rgba(255,255,255,.04)',
                border: active ? '.5px solid rgba(212,168,67,.45)' : '.5px solid rgba(255,255,255,.08)',
                color: active ? '#F0C85A' : '#7A7875',
                fontSize: 12, fontWeight: 800, letterSpacing: '.06em',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                textTransform: 'uppercase' as const,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Строка поиска */}
      <div style={{ padding: '10px 14px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,.04)',
          border: '.5px solid rgba(255,255,255,.09)',
          borderRadius: 12, padding: '9px 12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="#7A7875" strokeWidth="1.6"/>
            <line x1="13" y1="13" x2="17.5" y2="17.5" stroke="#7A7875" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по игроку..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: '.82rem',
              color: '#E8E4DC',
              caretColor: '#D4A843',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: 'none', border: 'none', color: '#5A5248',
              cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1,
            }}>✕</button>
          )}
        </div>
        {/* Сортировка */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSort(v => !v)}
            style={{
              width: 38, height: 38, borderRadius: 11,
              background: showSort ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.04)',
              border: showSort ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.09)',
              color: showSort ? '#F0C85A' : '#7A7875',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="8" y1="15" x2="12" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
          {showSort && (
            <div style={{
              position: 'absolute', top: 44, right: 0, zIndex: 50,
              background: 'linear-gradient(160deg,#12151E,#0E111A)',
              border: '.5px solid rgba(255,255,255,.1)',
              borderRadius: 14, overflow: 'hidden', minWidth: 160,
              boxShadow: '0 8px 32px rgba(0,0,0,.6)',
            }}>
              {(['date', 'bet', 'result'] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => { setSortKey(key); setShowSort(false); }}
                  style={{
                    width: '100%', padding: '11px 14px',
                    background: sortKey === key ? 'rgba(212,168,67,.1)' : 'none',
                    border: 'none', borderBottom: '.5px solid rgba(255,255,255,.05)',
                    color: sortKey === key ? '#F0C85A' : '#9A9490',
                    fontSize: '.78rem', fontWeight: 700,
                    fontFamily: 'Inter, sans-serif', textAlign: 'left' as const,
                    cursor: 'pointer',
                  }}
                >
                  {sortLabels[key]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Табы-фильтры (только для 'mine' — публичные показывают всё подряд) */}
      {scope === 'mine' && <div style={{
        display: 'flex', gap: 6, padding: '10px 14px 8px',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              style={{
                padding: '6px 14px',
                background: isActive
                  ? 'linear-gradient(135deg,#2A1E08,#4A3810)'
                  : 'linear-gradient(135deg,#141018,#0F0E18)',
                border: isActive
                  ? '.5px solid rgba(212,168,67,.42)'
                  : '.5px solid rgba(154,148,144,.22)',
                borderRadius: 10,
                color: isActive ? '#F0C85A' : '#7A7875',
                fontSize: '.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                letterSpacing: '.02em',
                transition: 'all .15s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>}

      {/* Спиннер загрузки */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{
            width: 26, height: 26,
            border: '2.5px solid rgba(212,168,67,.18)',
            borderTopColor: '#D4A843',
            borderRadius: '50%',
            animation: 'spin 0.75s linear infinite',
          }} />
        </div>
      )}

      {/* Пустое состояние (mine) */}
      {!loading && scope === 'mine' && filteredGames.length === 0 && (
        <div style={{ textAlign: 'center', padding: '52px 20px' }}>
          <div style={{ marginBottom: 14, opacity: 0.5, display: 'inline-block' }}>
            <ScrollIcon />
          </div>
          <div style={{ fontSize: '.82rem', color: '#7A7875', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
            Своих партий ещё нет
          </div>
          <div style={{ fontSize: '.7rem', color: '#5A5248', marginTop: 6 }}>
            Загляни во вкладку «Публичные» — там идёт лента партий всех игроков
          </div>
        </div>
      )}
      {!loading && scope === 'public' && publicGames.length === 0 && (
        <div style={{ textAlign: 'center', padding: '52px 20px' }}>
          <div style={{ marginBottom: 14, opacity: 0.5, display: 'inline-block' }}>
            <ScrollIcon />
          </div>
          <div style={{ fontSize: '.82rem', color: '#7A7875', fontWeight: 600 }}>
            Публичных завершённых партий пока нет
          </div>
        </div>
      )}

      {/* Список «Свои» */}
      {!loading && scope === 'mine' && filteredGames.length > 0 && (
        <>
          <div style={{ padding: '0 16px 6px', fontSize: '.62rem', color: '#7A7875', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
            {filteredGames.length} на стр. · стр. {currentPage} из {totalPages}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '0 0 6px' }}>
            {filteredGames.map((g) => (
              <BattleHistoryCard
                key={g.sessionId}
                game={g}
                me={(me as UserPublic | null) ?? null}
                onView={(game) => {
                  if (!game.pgn) return;
                  setReplayData({
                    pgn: game.pgn,
                    title: game.opponent?.firstName ? `vs ${game.opponent.firstName}` : 'Партия',
                    sessionId: game.sessionId,
                    shareToken: (game as any).shareToken ?? null,
                    whitePlayer: game.isWhite ? (me as UserPublic | null) : (game.opponent ?? null),
                    blackPlayer: game.isWhite ? (game.opponent ?? null) : (me as UserPublic | null),
                  });
                }}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '18px 0 28px' }}>
              <button disabled={offset === 0} onClick={() => loadGames(Math.max(0, offset - PAGE_SIZE), activeFilter)} style={{ ...pgBtn, opacity: offset === 0 ? 0.3 : 1 }}>← Назад</button>
              <span style={{ fontSize: '.68rem', color: '#7A7875', fontWeight: 600, minWidth: 50, textAlign: 'center' }}>{currentPage} / {totalPages}</span>
              <button disabled={offset + PAGE_SIZE >= total} onClick={() => loadGames(offset + PAGE_SIZE, activeFilter)} style={{ ...pgBtn, opacity: offset + PAGE_SIZE >= total ? 0.3 : 1 }}>Вперёд →</button>
            </div>
          )}
        </>
      )}

      {/* Список «Публичные» — общая лента всех завершённых публичных партий */}
      {!loading && scope === 'public' && publicGames.length > 0 && (
        <>
          <div style={{ padding: '0 16px 6px', fontSize: '.62rem', color: '#7A7875', fontWeight: 500 }}>
            {publicGames.length} на стр. · стр. {currentPage} из {totalPages}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 6px' }}>
            {publicGames.map((g) => {
              const goReplay = () => {
                if (g.shareToken) navigate(`/share/${g.shareToken}`);
              };
              return (
                <div
                  key={g.sessionId}
                  onClick={goReplay}
                  style={{
                    background: 'linear-gradient(135deg,#141018,#0F0E18)',
                    border: '.5px solid rgba(212,168,67,.18)',
                    borderRadius: 14, padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: g.shareToken ? 'pointer' : 'default',
                  }}
                >
                  <Avatar user={g.winner ?? undefined as any} size="s" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#EAE2CC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {g.isDraw ? 'Ничья' : `${g.winner?.firstName ?? '?'} победил${g.winner?.firstName?.endsWith('а') ? 'а' : ''} ${g.loser?.firstName ?? '?'}`}
                    </div>
                    <div style={{ fontSize: '.68rem', color: '#7A7875', marginTop: 2, display: 'flex', gap: 8 }}>
                      {g.bet && BigInt(g.bet) > 0n && <span style={{ color: '#F0C85A' }}>{fmtBalance(g.bet)}</span>}
                      {g.payout && BigInt(g.payout) > 0n && <span style={{ color: '#3DBA7A' }}>+{fmtBalance(g.payout)}</span>}
                      {g.finishedAt && <span>{new Date(g.finishedAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                  <Avatar user={g.loser ?? undefined as any} size="s" />
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '18px 0 28px' }}>
              <button disabled={offset === 0} onClick={() => loadPublic(Math.max(0, offset - PAGE_SIZE))} style={{ ...pgBtn, opacity: offset === 0 ? 0.3 : 1 }}>← Назад</button>
              <span style={{ fontSize: '.68rem', color: '#7A7875', fontWeight: 600, minWidth: 50, textAlign: 'center' }}>{currentPage} / {totalPages}</span>
              <button disabled={offset + PAGE_SIZE >= total} onClick={() => loadPublic(offset + PAGE_SIZE)} style={{ ...pgBtn, opacity: offset + PAGE_SIZE >= total ? 0.3 : 1 }}>Вперёд →</button>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* PGN-реплей прямо здесь, не уходим со страницы */}
      {replayData && (
        <PgnReplayModal
          pgn={replayData.pgn}
          title={replayData.title}
          sessionId={replayData.sessionId}
          shareToken={replayData.shareToken}
          whitePlayer={replayData.whitePlayer}
          blackPlayer={replayData.blackPlayer}
          onClose={() => setReplayData(null)}
        />
      )}
    </PageLayout>
  );
};

const pgBtn: React.CSSProperties = {
  padding: '7px 16px',
  background: 'linear-gradient(135deg,#2A1E08,#4A3810)',
  border: '.5px solid rgba(212,168,67,.42)',
  borderRadius: 12,
  color: '#F0C85A',
  fontSize: '.72rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  letterSpacing: '.02em',
};
