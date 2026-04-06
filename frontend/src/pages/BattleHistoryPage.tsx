import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { profileApi } from '@/api';
import { fmtBalance, fmtDate } from '@/utils/format';
import { PgnReplayModal } from '@/components/profile/PgnReplayModal';
import type { UserPublic } from '@/types';

// CoinIcon — золотой конь
const CoinIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="15" fill="url(#hcbg)" stroke="url(#hcbrd)" strokeWidth="1.2"/>
    <path d="M11 24c0-1 .5-2 1.5-2.5L14 21c-1-1-1.5-2.5-1-4 .3-1 1-2 2-2.5-.5-.8-.5-1.5 0-2 .8-.5 2-.3 2.5.5.5.8.3 2-.5 2.5.5.5 1 1.5.8 2.5l2 1c1 .5 1.7 1.5 1.7 2.5v.5H11z" fill="url(#hckn)"/>
    <path d="M16.5 12c.5-1 1.5-2 2-3 .3-.5 0-1-.3-1.2-.5-.3-1 0-1.2.5L16 10l-1-.5c-.3-1.5.5-3 2-3.5 1.5-.5 3 .2 3.5 1.5.3.8 0 1.8-.5 2.5l-1 1.5" fill="url(#hckn)" opacity=".9"/>
    <defs>
      <radialGradient id="hcbg" cx="38%" cy="30%" r="75%"><stop offset="0%" stopColor="#F0C85A"/><stop offset="55%" stopColor="#D4A843"/><stop offset="100%" stopColor="#8A6020"/></radialGradient>
      <linearGradient id="hcbrd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0C85A"/><stop offset="50%" stopColor="#A07830"/><stop offset="100%" stopColor="#F0C85A"/></linearGradient>
      <linearGradient id="hckn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#120E04"/><stop offset="100%" stopColor="#1E1608"/></linearGradient>
    </defs>
  </svg>
);

interface HistoryGame {
  sessionId: string;
  type: string;
  result: string;
  isWhite: boolean;
  winningAmount?: string | null;
  bet?: string | null;
  botLevel?: number | null;
  pgn?: string | null;
  finishedAt?: string | null;
  opponent?: UserPublic | null;
  hasBot?: boolean;
}

type FilterTab = 'all' | 'battle' | 'bot' | 'friendly';
type SortKey = 'date' | 'bet' | 'result';

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

const BotIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="10" height="8" rx="2" stroke="#7A7875" strokeWidth="1.2" fill="none"/>
    <rect x="6" y="7.5" width="1.5" height="1.5" rx=".5" fill="#7A7875"/>
    <rect x="8.5" y="7.5" width="1.5" height="1.5" rx=".5" fill="#7A7875"/>
    <line x1="5.5" y1="11" x2="10.5" y2="11" stroke="#7A7875" strokeWidth="1" strokeLinecap="round"/>
    <line x1="8" y1="3" x2="8" y2="5" stroke="#7A7875" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="8" cy="2.5" r=".8" fill="#7A7875"/>
  </svg>
);

const SwordsIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="3" y1="3" x2="13" y2="13" stroke="#7A7875" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="13" y1="3" x2="3" y2="13" stroke="#7A7875" strokeWidth="1.3" strokeLinecap="round"/>
    <line x1="3" y1="3" x2="1" y2="5" stroke="#7A7875" strokeWidth="1.1" strokeLinecap="round"/>
    <line x1="13" y1="3" x2="15" y2="5" stroke="#7A7875" strokeWidth="1.1" strokeLinecap="round"/>
    <circle cx="8" cy="8" r="1.2" fill="#7A7875"/>
  </svg>
);

const HandshakeIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 7.5C2 7.5 4 6 5.5 6H8L10 8" stroke="#7A7875" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M14 7.5C14 7.5 12 6 10.5 6H8L6 8" stroke="#7A7875" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M6 8L8 10L10 8" stroke="#7A7875" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'battle', label: 'Батлы' },
  { key: 'bot', label: 'Бот' },
  { key: 'friendly', label: 'Дружеские' },
];

export const BattleHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [showSort, setShowSort] = useState(false);
  const [replayData, setReplayData] = useState<{ pgn: string; title: string; sessionId: string } | null>(null);

  const loadGames = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const r = (await profileApi.getGames(PAGE_SIZE, off)) as any;
      setGames(r.games as HistoryGame[]);
      setTotal(r.total ?? 0);
      setOffset(off);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGames(0); }, [loadGames]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const filteredGames = games
    .filter((g) => {
      if (activeFilter === 'bot') return !!g.hasBot;
      if (activeFilter === 'friendly') return g.type === 'FRIENDLY';
      if (activeFilter === 'battle') return !g.hasBot && g.type !== 'FRIENDLY';
      return true;
    })
    .filter((g) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const name = (g.opponent?.firstName ?? '').toLowerCase();
      const botName = g.hasBot ? `jarvis lv.${g.botLevel}` : '';
      return name.includes(q) || botName.includes(q);
    })
    .sort((a, b) => {
      if (sortKey === 'date') {
        return (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '');
      }
      if (sortKey === 'bet') {
        return Number(BigInt(b.bet ?? '0') - BigInt(a.bet ?? '0'));
      }
      if (sortKey === 'result') {
        const ord = { WON: 0, DRAW: 1, LOST: 2 };
        return (ord[a.result as keyof typeof ord] ?? 3) - (ord[b.result as keyof typeof ord] ?? 3);
      }
      return 0;
    });

  const sortLabels: Record<SortKey, string> = { date: 'По дате', bet: 'По ставке', result: 'По результату' };

  return (
    <PageLayout title="История" centered backTo="/battles">
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

      {/* Табы-фильтры */}
      <div style={{
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
      </div>

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

      {/* Пустое состояние */}
      {!loading && filteredGames.length === 0 && (
        <div style={{ textAlign: 'center', padding: '52px 20px' }}>
          <div style={{ marginBottom: 14, opacity: 0.5, display: 'inline-block' }}>
            <ScrollIcon />
          </div>
          <div style={{
            fontSize: '.82rem',
            color: '#7A7875',
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
          }}>
            Партий ещё нет
          </div>
        </div>
      )}

      {/* Список партий */}
      {!loading && filteredGames.length > 0 && (
        <>
          {/* Счётчик */}
          <div style={{
            padding: '0 16px 6px',
            fontSize: '.62rem',
            color: '#7A7875',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
          }}>
            {total} партий · стр. {currentPage} из {totalPages}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
            {filteredGames.map((g) => {
              const isWon = g.result === 'WON';
              const isDraw = g.result === 'DRAW';

              const statusColor = isWon ? '#3DBA7A' : isDraw ? '#82CFFF' : '#CC6060';
              const statusLabel = isWon ? 'Победа' : isDraw ? 'Ничья' : 'Поражение';

              const cardBorder = isWon
                ? '.5px solid rgba(61,186,122,.22)'
                : isDraw
                ? '.5px solid rgba(130,207,255,.18)'
                : '.5px solid rgba(204,96,96,.18)';

              const typeIconEl = g.hasBot
                ? <BotIcon size={16} />
                : g.type === 'FRIENDLY'
                ? <HandshakeIcon size={16} />
                : <SwordsIcon size={16} />;

              return (
                <div
                  key={g.sessionId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: 'linear-gradient(135deg,#141018,#0F0E18)',
                    border: cardBorder,
                    borderRadius: 14,
                    cursor: g.pgn ? 'pointer' : 'default',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onClick={() => g.pgn && setReplayData({
                    pgn: g.pgn,
                    title: g.opponent?.firstName ? `vs ${g.opponent.firstName}` : (g.hasBot ? `vs J.A.R.V.I.S Lv.${g.botLevel}` : 'Партия'),
                    sessionId: g.sessionId,
                  })}
                >
                  {/* Цветная полоска статуса */}
                  <div style={{
                    width: 3, height: 42,
                    borderRadius: 2,
                    background: statusColor,
                    flexShrink: 0,
                    opacity: 0.85,
                  }} />

                  {/* Аватар + знак цвета фигур под ним */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                    {g.opponent ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigate('/profile/' + g.opponent!.id); }}
                        style={{ padding: 0, border: 'none', background: 'none', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', width: 46, height: 46 }}
                      >
                        <Avatar user={g.opponent} size="m" />
                      </button>
                    ) : (
                      <div style={{
                        width: 46, height: 46, borderRadius: '50%',
                        background: 'rgba(154,148,144,.08)',
                        border: '.5px solid rgba(154,148,144,.18)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {typeIconEl}
                      </div>
                    )}
                    {/* Знак цвета фигур — 10px от аватара, +30% от базового 13px */}
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 17, lineHeight: 1,
                      color: g.isWhite ? '#F0F2F8' : '#8B92A8',
                      opacity: 0.8,
                      marginTop: 10,
                    }}>
                      {g.isWhite ? '♔' : '♚'}
                    </span>
                  </div>

                  {/* Имя + дата */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      onClick={g.opponent ? (e) => { e.stopPropagation(); e.preventDefault(); navigate('/profile/' + g.opponent!.id); } : undefined}
                      style={{
                        fontSize: '.8rem',
                        fontWeight: 700,
                        color: '#EAE2CC',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: g.opponent ? 'pointer' : 'default',
                      }}
                    >
                      {g.opponent?.firstName ?? (g.hasBot ? `J.A.R.V.I.S Lv.${g.botLevel ?? '?'}` : 'Неизвестно')}
                    </div>
                    <div style={{
                      fontSize: '.65rem',
                      color: '#7A7875',
                      marginTop: 3,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {g.finishedAt ? fmtDate(g.finishedAt) : ''}
                      {g.bet && BigInt(g.bet) > 0n
                        ? <span style={{ color: '#3A3632', display: 'inline-flex', alignItems: 'center', gap: 2 }}>· {fmtBalance(g.bet)} <CoinIcon size={10} /></span>
                        : null}
                    </div>
                  </div>

                  {/* Результат + выигрыш + просмотр */}
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 3,
                  }}>
                    <span style={{
                      fontSize: '.68rem',
                      fontWeight: 800,
                      color: statusColor,
                      letterSpacing: '.01em',
                    }}>
                      {statusLabel}
                    </span>
                    {g.winningAmount && isWon && (
                      <span style={{
                        fontSize: '.62rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#D4A843',
                        fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        +{fmtBalance(g.winningAmount)} <CoinIcon size={10} />
                      </span>
                    )}
                    {g.pgn && (
                      <span style={{
                        fontSize: '.58rem',
                        color: '#7A7875',
                        fontWeight: 600,
                        letterSpacing: '.02em',
                      }}>
                        ▶ Просмотр
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center',
              alignItems: 'center', gap: 10,
              padding: '18px 0 28px',
            }}>
              <button
                disabled={offset === 0}
                onClick={() => loadGames(Math.max(0, offset - PAGE_SIZE))}
                style={{ ...pgBtn, opacity: offset === 0 ? 0.3 : 1 }}
              >
                ← Назад
              </button>
              <span style={{
                fontSize: '.68rem',
                color: '#7A7875',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                minWidth: 50,
                textAlign: 'center',
              }}>
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => loadGames(offset + PAGE_SIZE)}
                style={{ ...pgBtn, opacity: offset + PAGE_SIZE >= total ? 0.3 : 1 }}
              >
                Вперёд →
              </button>
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
