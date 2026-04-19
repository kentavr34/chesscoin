import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout, InfoPopup, useInfoPopup } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { AttemptsModal } from '@/components/ui/AttemptsModal';
import { getSocket } from '@/api/socket';
import { profileApi } from '@/api';
import { fmtBalance, fmtTime } from '@/utils/format';
import { translations } from '@/i18n/translations';
import type { BattleLobbyItem, GameSession } from '@/types';
import { useT } from '@/i18n/useT';

const showToast = (text: string, type: 'error' | 'info' = 'error') => {
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));
};

const getErrText = (code: string): string => {
  const lang = useSettingsStore.getState().lang;
  const errT = (translations[lang]?.errors ?? {}) as Record<string, string>;
  return errT[code] ?? code;
};

// Донат зрителя в батл
const donateToBattle = (sessionId: string, amount: string, cb: (ok: boolean) => void) => {
  const socket = getSocket();
  socket.emit('battle:donate', { sessionId, amount }, (res: Record<string,unknown>) => cb(res?.ok as boolean));
};

type Tab = 'challenge' | 'live' | 'history';

export const BattlesPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { battles, sessions, liveBattles, upsertSession } = useGameStore();
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('challenge');
  const [histGames, setHistGames] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histLoaded, setHistLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAttempts, setShowAttempts] = useState(false);

  const attempts = user?.attempts ?? 3;
  const hasAttempts = attempts > 0;

  const info = useInfoPopup('battles', [...t.battles.info] as Parameters<typeof InfoPopup>[0]["slides"]);

  // Live — публичные IN_PROGRESS батлы из лобби (видны всем, не только участникам)
  // Дополняем личными сессиями на случай, если сервер ещё не прислал событие
  const myLiveSessions = sessions.filter((s) => s.status === 'IN_PROGRESS' && s.type !== 'BOT');
  const liveSessions = [
    ...liveBattles,
    ...myLiveSessions.filter((s) => !liveBattles.some((lb) => lb.id === s.id)),
  ];

  // Ожидающие — публичные, отсортированные по ставке (desc)
  const waitingSessions = [...battles].sort((a, b) => {
    const betA = BigInt(a.bet || '0');
    const betB = BigInt(b.bet || '0');
    return betB > betA ? 1 : betB < betA ? -1 : 0;
  });

  // Приватные — только приватные WAITING_FOR_OPPONENT (без ботов и без публичных)
  const myPrivateSessions = sessions.filter((s) => s.status === 'WAITING_FOR_OPPONENT' && s.isPrivate && s.type !== 'BOT');

  const handleCancel = (sessionId: string) => {
    const socket = getSocket();
    socket.emit('game:cancel', { sessionId }, (res: any) => {
      if (res?.ok) {
        showToast('Батл отменён, попытка возвращена', 'info');
      } else {
        showToast(getErrText(res?.error ?? ''), 'error');
      }
    });
  };

  const handleJoin = (battle: BattleLobbyItem) => {
    // Нет попыток → открыть покупку попыток
    if (!hasAttempts) {
      setShowAttempts(true);
      return;
    }
    // Недостаточно баланса → в магазин
    const userBalance = BigInt(user?.balance ?? '0');
    const betAmount = BigInt(battle.bet || '0');
    if (userBalance < betAmount) {
      showToast('Недостаточно монет — пополни баланс', 'info');
      navigate('/shop');
      return;
    }
    const socket = getSocket();
    socket.emit('game:join', { code: battle.code }, (res) => {
      if (res.ok && res.session) {
        upsertSession(res.session);
        navigate('/game/' + res.session.id);
      } else {
        showToast(getErrText(res.error ?? ''), 'error');
      }
    });
  };

  const goldCircleBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(212,168,67,.12)',
    border: '.5px solid rgba(212,168,67,.25)',
    color: '#F0C85A',
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700,
  };

  const leftAction = (
    <button
      onClick={() => navigate('/battles/history')}
      title="История батлов"
      style={goldCircleBtn}
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M10 5.5v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );

  const rightAction = (
    <button
      onClick={info.open}
      style={goldCircleBtn}
    >?</button>
  );

  // Загружаем историю при переключении на вкладку
  useEffect(() => {
    if (tab === 'history' && !histLoaded) {
      setHistLoading(true);
      profileApi.getGames(15, 0).then((r: any) => {
        setHistGames(r.games ?? []);
        setHistLoaded(true);
      }).catch(() => {}).finally(() => setHistLoading(false));
    }
  }, [tab, histLoaded]);

  return (
    <PageLayout title={t.battles.title} centered leftAction={leftAction} rightAction={rightAction}>
      {/* InfoPopup при первом входе */}
      {info.show && (
        <InfoPopup infoKey="battles" slides={[...t.battles.info] as Parameters<typeof InfoPopup>[0]["slides"]} onClose={info.close} />
      )}

      {/* ── 3 вкладки: ВЫЗОВ / СРАЖЕНИЕ / ИСТОРИЯ ── */}
      <div style={{ display: 'flex', gap: 6, margin: '4px .85rem 12px', padding: 0 }}>
        {([
          {
            key: 'challenge' as Tab,
            label: 'ВЫЗОВ',
            count: waitingSessions.length + myPrivateSessions.length,
            icon: (
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                <path d="M9 2v3M7.5 3.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <rect x="7" y="5" width="6" height="2.5" rx=".8" fill="currentColor" opacity=".8"/>
                <path d="M6 7.5h8l-1.5 9H7.5L6 7.5z" fill="currentColor" opacity=".6"/>
                <path d="M4 16.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            ),
            color: '#F0C85A',
            glow: 'rgba(212,168,67,.15)',
            border: 'rgba(212,168,67,.35)',
          },
          {
            key: 'live' as Tab,
            label: 'СРАЖЕНИЕ',
            count: liveSessions.length,
            icon: (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: tab === 'live' ? 'pulse 1.5s infinite' : 'none' }} />
            ),
            color: '#3DBA7A',
            glow: 'rgba(61,186,122,.15)',
            border: 'rgba(61,186,122,.35)',
          },
          {
            key: 'history' as Tab,
            label: 'ИСТОРИЯ',
            count: 0,
            icon: (
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                <line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="13" y1="2" x2="13" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="6" y1="13.5" x2="11" y2="13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ),
            color: '#9A9490',
            glow: 'rgba(154,148,144,.1)',
            border: 'rgba(154,148,144,.25)',
          },
        ] as const).map(({ key, label, count, icon, color, glow, border }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '9px 6px',
                borderRadius: 12, fontSize: '.75rem', fontWeight: 800,
                fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                transition: 'all .15s',
                background: active ? glow : 'rgba(255,255,255,.04)',
                border: `.5px solid ${active ? border : 'rgba(255,255,255,.08)'}`,
                color: active ? color : '#6A6662',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                letterSpacing: '.05em',
              }}
            >
              {icon}
              {label}
              {count > 0 && (
                <span style={{
                  background: active ? color : 'rgba(255,255,255,.12)',
                  color: active ? '#0D0D12' : '#9A9490',
                  fontSize: '.55rem', fontWeight: 800,
                  padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center' as const,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ════════ ВЫЗОВ (challenge) ════════ */}
      {tab === 'challenge' && (
        <>
          {/* LIVE — активные партии */}
          {liveSessions.length > 0 && (
            <>
              <div style={sectionLabel}>
                <span style={{
                  display: 'inline-block', width: 7, height: 7,
                  borderRadius: '50%', background: '#3DBA7A',
                  marginRight: 6, animation: 'pulse 1.5s infinite',
                  verticalAlign: 'middle',
                }} />
                LIVE
              </div>
              {liveSessions.map((s) => {
                const amParticipant = s.sides.some((sd) => sd.playerId === user?.id);
                return (
                  <BattleLiveCard
                    key={s.id}
                    session={s}
                    onNavigate={(id) => navigate('/game/' + id + (amParticipant ? '' : '?spectate=1'))}
                    onProfile={(id) => navigate('/profile/' + id)}
                    isSpectator={!amParticipant}
                  />
                );
              })}
            </>
          )}

          {/* Ожидающие — по ставке (desc) */}
          {waitingSessions.length > 0 && (
            <>
              <div style={sectionLabel}>
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" style={{ marginRight: 5, flexShrink: 0 }}>
                  <line x1="3" y1="3" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3" y1="6" x2="3" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="3" y1="3" x2="6" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="14" y1="17" x2="17" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="17" y1="14" x2="17" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="17" y1="6" x2="6" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {t.battles.tabWaiting ?? 'CHALLENGES'}
              </div>
              {waitingSessions.map((battle, idx) => {
                const isMyBattle = battle.creator?.id === user?.id;
                return (
                  <BattleChallengeCard
                    key={battle.id}
                    battle={battle}
                    isTop={idx === 0}
                    onJoin={() => handleJoin(battle)}
                    onCancel={isMyBattle ? () => handleCancel(battle.id) : undefined}
                    onProfile={(id) => navigate('/profile/' + id)}
                    acceptLabel={t.battles.accept ?? 'Войти'}
                  />
                );
              })}
            </>
          )}

          {/* Приватные вызовы */}
          {myPrivateSessions.length > 0 && (
            <>
              <div style={sectionLabel}>
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" style={{ marginRight: 5 }}>
                  <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                МОИ ПРИВАТНЫЕ
                <span style={{ marginLeft: 6, background: 'rgba(212,168,67,.2)', color: '#F0C85A', fontSize: '.6rem', fontWeight: 800, padding: '1px 6px', borderRadius: 8 }}>
                  {myPrivateSessions.length}
                </span>
              </div>
              {myPrivateSessions.map((s) => {
                const shareText = `Вызов на шахматный батл! Ставка: ${fmtBalance(s.bet ?? '0')} монет`;
                const shareUrl  = `https://t.me/share/url?url=https://t.me/ChessCoinBot/app?startapp=battle_${s.id}&text=${encodeURIComponent(shareText)}`;
                return (
                  <div key={s.id} style={{ background: 'rgba(212,168,67,.06)', border: '1px solid rgba(212,168,67,.22)', borderRadius: 14, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#F0C85A' }}>Код: {s.code}</div>
                      <div style={{ fontSize: '.72rem', color: '#8B92A8' }}>Ставка: {fmtBalance(s.bet ?? '0')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => window.open(shareUrl, '_blank')} style={{ flex: 1, padding: '7px', borderRadius: 10, border: '1px solid rgba(212,168,67,.3)', background: 'rgba(212,168,67,.08)', color: '#F0C85A', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Поделиться</button>
                      <button onClick={() => handleCancel(s.id)} style={{ flex: 1, padding: '7px', borderRadius: 10, border: '1px solid rgba(255,77,106,.3)', background: 'rgba(255,77,106,.08)', color: '#FF4D6A', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Отменить</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {waitingSessions.length === 0 && myPrivateSessions.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '56px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <svg width="44" height="44" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.4 }}>
                <path d="M9 2v3M7.5 3.5h3" stroke="#D4A843" strokeWidth="1.4" strokeLinecap="round"/>
                <rect x="7" y="5" width="6" height="2.5" rx=".8" fill="#D4A843" opacity=".8"/>
                <path d="M6 7.5h8l-1.5 9H7.5L6 7.5z" fill="#D4A843" opacity=".6"/>
                <path d="M4 16.5h12" stroke="#D4A843" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: '.85rem', color: '#7A7875', fontWeight: 600 }}>Нет активных вызовов</div>
              <div style={{ fontSize: '.72rem', color: '#3E3A35' }}>Создай батл и бросай вызов!</div>
            </div>
          )}
        </>
      )}

      {/* ════════ СРАЖЕНИЕ (live) ════════ */}
      {tab === 'live' && (
        <>
          {liveSessions.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '56px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: '2.4rem', opacity: 0.5 }}>♟</span>
              <div style={{ fontSize: '.85rem', color: '#7A7875', fontWeight: 600 }}>Нет активных партий</div>
              <div style={{ fontSize: '.72rem', color: '#3E3A35' }}>Все сражаются в другое время</div>
            </div>
          )}
          {liveSessions.map((s) => {
            const amParticipant = s.sides.some((sd) => sd.playerId === user?.id);
            return (
              <BattleLiveCard
                key={s.id}
                session={s}
                onNavigate={(id) => navigate('/game/' + id + (amParticipant ? '' : '?spectate=1'))}
                onProfile={(id) => navigate('/profile/' + id)}
                isSpectator={!amParticipant}
              />
            );
          })}
        </>
      )}

      {/* ════════ ИСТОРИЯ (history) ════════ */}
      {tab === 'history' && (
        <>
          {histLoading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7A7875', fontSize: '.85rem' }}>
              Загрузка...
            </div>
          )}
          {!histLoading && histGames.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '56px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <svg width="44" height="44" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.3 }}>
                <rect x="8" y="6" width="24" height="28" rx="4" stroke="#D4A843" strokeWidth="1.5" fill="none"/>
                <line x1="15" y1="13" x2="27" y2="13" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="15" y1="18" x2="27" y2="18" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: '.85rem', color: '#7A7875', fontWeight: 600 }}>История пуста</div>
              <div style={{ fontSize: '.72rem', color: '#3E3A35' }}>Сыграй первый батл!</div>
            </div>
          )}
          {histGames.map((g: any) => {
            const isWon  = g.result === 'WON';
            const isDraw = g.result === 'DRAW';
            const resultColor = isWon ? '#3DBA7A' : isDraw ? '#D4A843' : '#E05555';
            const resultLabel = isWon ? 'Победа' : isDraw ? 'Ничья' : 'Поражение';
            return (
              <div key={g.sessionId} style={{
                margin: '0 .85rem 6px',
                background: 'linear-gradient(135deg,#141018,#0F0E18)',
                border: `.5px solid ${isWon ? 'rgba(61,186,122,.25)' : isDraw ? 'rgba(212,168,67,.2)' : 'rgba(224,85,85,.2)'}`,
                borderRadius: 14, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Avatar user={g.opponent ?? { firstName: 'Jarvis' }} size="m" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#D4C8B0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {g.hasBot ? `Jarvis Lv.${g.botLevel ?? '?'}` : (g.opponent?.firstName ?? '?')}
                  </div>
                  <div style={{ fontSize: '.65rem', color: '#6A6662', marginTop: 2 }}>
                    {g.finishedAt ? new Date(g.finishedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : ''}
                    {g.bet ? <span style={{ marginLeft: 6, color: '#D4A843' }}>&#x2B21; {fmtBalance(g.bet)}</span> : null}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: '.72rem', fontWeight: 800, color: resultColor }}>{resultLabel}</span>
                  {g.pgn && (
                    <button
                      onClick={() => navigate('/battles/history')}
                      style={{
                        fontSize: '.6rem', fontWeight: 700, color: '#9A9490',
                        background: 'rgba(255,255,255,.06)', border: 'none',
                        borderRadius: 6, padding: '2px 7px', cursor: 'pointer',
                      }}
                    >PGN</button>
                  )}
                </div>
              </div>
            );
          })}
          {histGames.length > 0 && (
            <button
              onClick={() => navigate('/battles/history')}
              style={{
                width: 'calc(100% - 1.7rem)', margin: '8px .85rem 0',
                padding: '12px', borderRadius: 12,
                background: 'rgba(255,255,255,.04)', border: '.5px solid rgba(255,255,255,.1)',
                color: '#9A9490', fontSize: '.8rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                <line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="13" y1="2" x2="13" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Смотреть всю историю
            </button>
          )}
        </>
      )}

      {/* FAB — создать батл */}
      <button
        onClick={() => setShowCreate(true)}
        style={{
          position: 'fixed',
          bottom: 'max(98px, calc(88px + env(safe-area-inset-bottom, 14px)))',
          right: 24, width: 50, height: 50,
          borderRadius: '50%',
          background: 'linear-gradient(135deg,#D4A843,#F0C85A)',
          color: '#0D0D12',
          fontSize: 24, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', border: 'none', zIndex: 49,
          boxShadow: '0 4px 24px rgba(212,168,67,.45)',
          fontFamily: 'inherit',
        }}
      >＋</button>

      {showCreate && <CreateBattleModal onClose={() => setShowCreate(false)} onBuyAttempts={() => setShowAttempts(true)} />}
      {showAttempts && user && <AttemptsModal user={user} onClose={() => setShowAttempts(false)} />}
    </PageLayout>
  );
};

// ── Sub components ──
const MIN_BET = 10000;

// Иконка цвета фигур (белый / чёрный король)
const ColorIcon: React.FC<{ isWhite: boolean }> = ({ isWhite }) => (
  <div style={{
    width: 42, height: 42, borderRadius: 10,
    background: isWhite ? 'rgba(240,200,90,.12)' : 'rgba(74,158,255,.1)',
    border: `.5px solid ${isWhite ? 'rgba(240,200,90,.35)' : 'rgba(74,158,255,.25)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width="23" height="23" viewBox="0 0 18 18" fill="none">
      <path d="M9 2v3M7.5 3.5h3" stroke={isWhite ? '#F0C85A' : '#82CFFF'} strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="7" y="5" width="4" height="2" rx=".5" fill={isWhite ? '#F0C85A' : '#82CFFF'} opacity=".8"/>
      <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill={isWhite ? '#F0C85A' : '#82CFFF'} opacity={isWhite ? '.7' : '.9'}/>
      <path d="M4 15h10" stroke={isWhite ? '#F0C85A' : '#82CFFF'} strokeWidth="1.3" strokeLinecap="round"/>
      {!isWhite && <rect x="5" y="6.5" width="8" height="9" rx="1" fill="#82CFFF" opacity=".15"/>}
    </svg>
  </div>
);

// Шаблон «Вызов» (Stage 1) — карточка батла в ожидании соперника
const BattleChallengeCard: React.FC<{
  battle: BattleLobbyItem;
  isTop: boolean;
  onJoin: () => void;
  onCancel?: () => void;
  onProfile: (id: string) => void;
  acceptLabel: string;
}> = ({ battle, isTop, onJoin, onCancel, onProfile, acceptLabel }) => {
  const durationSecs = battle.duration ?? 300;
  const timerDisplay = `${String(Math.floor(durationSecs / 60)).padStart(2,'0')}:00`;
  const creatorId = battle.creator?.id;
  const creatorAsUser = battle.creator ? {
    id: creatorId,
    firstName: battle.creator.firstName,
    avatar: battle.creator.avatar,
    avatarGradient: battle.creator.avatarGradient,
  } : null;
  const creatorIsWhite = battle.creator?.isWhite ?? true;
  const opponentIsWhite = !creatorIsWhite;

  return (
    <div style={{
      margin: '0 .85rem 8px',
      background: 'linear-gradient(135deg,#141018,#0F0E18)',
      border: isTop ? '.5px solid rgba(212,168,67,.38)' : '.5px solid rgba(212,168,67,.22)',
      borderRadius: 16, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>

      {/* Слева: крупный аватар + имя + ELO (без иконки цвета) */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 5, flexShrink: 0 }}>
        <button
          type="button"
          style={{
            padding: 0, border: 'none', background: 'none',
            borderRadius: '50%', overflow: 'hidden',
            width: 60, height: 60, flexShrink: 0,
            cursor: creatorId ? 'pointer' : 'default',
          }}
          onClick={creatorId ? (e) => { e.stopPropagation(); e.preventDefault(); onProfile(creatorId); } : undefined}
        >
          <Avatar user={creatorAsUser as any} size="l" />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
          <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#D4C8B0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 68 }}>
            {battle.creator?.firstName ?? '?'}
          </span>
          <span style={{ fontSize: '.64rem', fontWeight: 600 }}>
            <span style={{ color: '#7A7470' }}>ELO </span>
            <span style={{ color: '#F0C85A' }}>{battle.creator?.elo ?? '?'}</span>
          </span>
        </div>
      </div>

      {/* Центр: [ЦветИконка] ЖДЁМ + таймер + ставка [ЦветИконка] */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        {/* Иконка цвета создателя */}
        <SmallColorIcon isWhite={creatorIsWhite} />

        {/* Таймер и статус */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4A843', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: '.52rem', fontWeight: 900, color: '#D4A843', letterSpacing: '.14em' }}>ЖДЁМ</span>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '1.1rem', fontWeight: 800, color: '#F0F0E8', letterSpacing: '.02em' }}>
            {timerDisplay}
          </span>
          {battle.bet && (
            <span style={{ fontSize: '.82rem', fontWeight: 800, color: '#D4A843', display: 'flex', alignItems: 'center', gap: 3 }}>
              <CoinIcon size={13} />
              {fmtBalance(battle.bet)}
            </span>
          )}
        </div>

        {/* Иконка цвета соперника */}
        <SmallColorIcon isWhite={opponentIsWhite} />
      </div>

      {/* Справа: только кнопка, без аватара */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {onCancel ? (
          <button
            onClick={onCancel}
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg,#3A0808,#5A1010)',
              border: '.5px solid rgba(220,50,47,.4)', borderRadius: 11,
              color: '#FF8080', fontSize: '.72rem', fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 12px rgba(220,50,47,.15)',
              whiteSpace: 'nowrap' as const,
            }}
          >Отменить</button>
        ) : (
          <button
            onClick={onJoin}
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg,#D4A843,#F0C85A)',
              border: 'none', borderRadius: 11,
              color: '#0D0D12', fontSize: '.72rem', fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 12px rgba(212,168,67,.35)',
              whiteSpace: 'nowrap' as const,
            }}
          >{acceptLabel}</button>
        )}
      </div>
    </div>
  );
};

// CoinIcon — единый компонент из @/components/ui/CoinIcon
import { CoinIcon } from '@/components/ui/CoinIcon';

const IcoDice = () => (
  <svg width="30" height="30" viewBox="0 0 18 18" fill="none">
    <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="5.5" cy="5.5" r="1.2" fill="currentColor"/>
    <circle cx="12.5" cy="5.5" r="1.2" fill="currentColor"/>
    <circle cx="9" cy="9" r="1.2" fill="currentColor"/>
    <circle cx="5.5" cy="12.5" r="1.2" fill="currentColor"/>
    <circle cx="12.5" cy="12.5" r="1.2" fill="currentColor"/>
  </svg>
);

const IcoKingW = () => (
  <svg width="30" height="30" viewBox="0 0 18 18" fill="none">
    <path d="M9 2v3M7.5 3.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="7" y="5" width="4" height="2" rx=".5" fill="currentColor" opacity=".8"/>
    <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill="currentColor" opacity=".7"/>
    <path d="M4 15h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IcoKingB = () => (
  <svg width="30" height="30" viewBox="0 0 18 18" fill="none">
    <path d="M9 2v3M7.5 3.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="7" y="5" width="4" height="2" rx=".5" fill="currentColor" opacity=".9"/>
    <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill="currentColor" opacity=".9"/>
    <path d="M4 15h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <rect x="5" y="6.5" width="8" height="9" rx="1" fill="currentColor" opacity=".15"/>
  </svg>
);

// Маленькая иконка цвета (для LiveCard — компактнее)
const SmallColorIcon: React.FC<{ isWhite: boolean }> = ({ isWhite }) => (
  <div style={{
    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
    background: isWhite ? 'rgba(240,200,90,.12)' : 'rgba(74,158,255,.1)',
    border: `.5px solid ${isWhite ? 'rgba(240,200,90,.35)' : 'rgba(74,158,255,.25)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width="19" height="19" viewBox="0 0 18 18" fill="none">
      <path d="M9 2v3M7.5 3.5h3" stroke={isWhite ? '#F0C85A' : '#82CFFF'} strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="7" y="5" width="4" height="2" rx=".5" fill={isWhite ? '#F0C85A' : '#82CFFF'} opacity=".8"/>
      <path d="M5.5 7h7l-1 8H6.5L5.5 7z" fill={isWhite ? '#F0C85A' : '#82CFFF'} opacity={isWhite ? '.7' : '.9'}/>
      <path d="M4 15h10" stroke={isWhite ? '#F0C85A' : '#82CFFF'} strokeWidth="1.3" strokeLinecap="round"/>
      {!isWhite && <rect x="5" y="6.5" width="8" height="9" rx="1" fill="#82CFFF" opacity=".15"/>}
    </svg>
  </div>
);

// ── Шаблон «Сражение» (Stage 2 / LIVE) — карточка идущей партии ──────────
const BattleLiveCard: React.FC<{
  session: GameSession;
  onNavigate: (id: string) => void;
  onProfile: (id: string) => void;
  isSpectator?: boolean;
}> = ({ session, onNavigate, onProfile, isSpectator }) => {
  const whitePlayer = session.sides.find((sd) => sd.isWhite);
  const blackPlayer = session.sides.find((sd) => !sd.isWhite);
  const activeSide  = session.sides.find((sd) => sd.id === session.currentSideId);

  const [timeLeft, setTimeLeft] = useState<number>(activeSide?.timeLeft ?? 0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const initial = activeSide?.timeLeft ?? 0;
    setTimeLeft(initial);
    if (timerRef.current) clearInterval(timerRef.current);
    if (initial > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session.currentSideId, activeSide?.timeLeft]);

  const sourceType = (session as any).sourceType;

  // ── Колонка игрока: Аватар / Имя + ELO (без иконки цвета — она в центре) ──
  const PlayerCol: React.FC<{ side: typeof whitePlayer; isRight?: boolean }> = ({ side, isRight }) => {
    if (!side) return <div style={{ flexShrink: 0, width: 72 }} />;
    // player.id — берём напрямую из объекта игрока (playerId может приходить некорректно)
    const pid = side.player?.id || side.playerId;
    const playerAsUser = {
      id: pid,
      firstName: side.player?.firstName ?? '?',
      avatar: side.player?.avatar,
      avatarGradient: side.player?.avatarGradient,
      elo: side.player?.elo ?? 0,
    };
    return (
      <div style={{
        display: 'flex', flexDirection: 'column' as const,
        alignItems: 'center',
        gap: 5, flexShrink: 0,
      }}>
        {/* Аватар — клик → профиль, e.stopPropagation чтобы не уйти на страницу батла */}
        <button
          type="button"
          style={{
            padding: 0, border: 'none', background: 'none',
            borderRadius: '50%', overflow: 'hidden',
            width: 56, height: 56, flexShrink: 0, cursor: pid ? 'pointer' : 'default',
          }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); pid && onProfile(pid); }}
        >
          <Avatar user={playerAsUser as any} size="l" />
        </button>
        {/* Имя + ELO */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, alignItems: 'center' }}>
          <span style={{
            fontSize: '.76rem', fontWeight: 700, color: '#D4C8B0',
            overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const, maxWidth: 72,
            textAlign: 'center' as const,
          }}>
            {side.player?.firstName ?? '?'}
          </span>
          <span style={{ fontSize: '.62rem', fontWeight: 600 }}>
            <span style={{ color: '#7A7470' }}>ELO </span>
            <span style={{ color: '#F0C85A' }}>{side.player?.elo ?? '?'}</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={() => onNavigate(session.id)}
      style={{
        margin: '0 .85rem 8px',
        background: 'linear-gradient(135deg,#0E1210,#0F1218)',
        border: '.5px solid rgba(61,186,122,.32)',
        borderRadius: 16, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
        boxShadow: '0 2px 16px rgba(61,186,122,.08)',
      }}
    >
      {/* Белый игрок */}
      <PlayerCol side={whitePlayer} />

      {/* Центр: [ЦветИконка белых] LIVE+таймер+ставка+СМОТРЕТЬ [ЦветИконка чёрных] */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <SmallColorIcon isWhite={true} />

        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3DBA7A', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: '.52rem', fontWeight: 900, color: '#3DBA7A', letterSpacing: '.16em' }}>
              LIVE{sourceType === 'TOURNAMENT' ? ' 🏆' : sourceType === 'WAR' ? ' ⚔️' : ''}
            </span>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '1.1rem', fontWeight: 800, color: '#F0F0E8', letterSpacing: '.02em' }}>
            {fmtTime(timeLeft)}
          </span>
          {session.bet && (
            <span style={{ fontSize: '.82rem', fontWeight: 800, color: '#D4A843', display: 'flex', alignItems: 'center', gap: 3 }}>
              <CoinIcon size={13} />
              {fmtBalance(session.bet)}
            </span>
          )}
          {isSpectator && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(session.id); }}
              style={{
                marginTop: 1, padding: '4px 10px',
                background: 'rgba(61,186,122,.12)',
                border: '.5px solid rgba(61,186,122,.3)',
                borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '.58rem', fontWeight: 800,
                color: '#3DBA7A', letterSpacing: '.06em',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
              </svg>
              СМОТРЕТЬ
            </button>
          )}
        </div>

        <SmallColorIcon isWhite={false} />
      </div>

      {/* Чёрный игрок */}
      <PlayerCol side={blackPlayer} isRight />
    </div>
  );
};

const CreateBattleModal: React.FC<{ onClose: () => void; onBuyAttempts: () => void }> = ({ onClose, onBuyAttempts }) => {
  const t = useT();
  const { upsertSession } = useGameStore();
  const { user } = useUserStore();
  const navigate = useNavigate();

  const userAttempts = user?.attempts ?? 3;
  const hasAttempts = userAttempts > 0;
  const userBalance = Number(BigInt(user?.balance ?? '0'));
  const maxBet = Math.max(MIN_BET, Math.min(userBalance, 5_000_000));
  const canCreate = userBalance >= MIN_BET;

  const [bet, setBet] = useState(Math.min(MIN_BET, maxBet));
  const [duration, setDuration] = useState(300);
  const [color, setColor] = useState<'white' | 'black' | 'random'>('random');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  const TIME_OPTIONS = [1, 3, 5, 15, 30, 60];
  const QUICK_BETS = [10000, 50000, 100000, 500000];

  const durationMins = duration / 60;

  const handleCreate = () => {
    if (!canCreate) return;
    setLoading(true);
    const socket = getSocket();
    const selectedColor = color === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : color;
    socket.emit('game:create:battle', { color: selectedColor, duration, bet: String(bet), isPrivate: !isPublic }, (res: any) => {
      setLoading(false);
      if (res.ok && res.session) {
        upsertSession(res.session);
        showToast(isPublic ? t.battles.battleCreated : t.battles.privateBattleCreated, 'info');
        onClose();
      } else {
        showToast(getErrText(res.error ?? ''), 'error');
      }
    });
  };

  const COLOR_OPTS = [
    { key: 'random' as const, label: t.battles.colorRandom, Icon: IcoDice,   bg: 'rgba(212,168,67,.1)',   border: 'rgba(212,168,67,.3)', color: '#F0C85A',  activeBg: 'rgba(212,168,67,.18)', activeBorder: '#D4A843' },
    { key: 'white'  as const, label: t.battles.colorWhite,  Icon: IcoKingW,  bg: 'rgba(240,240,240,.06)', border: 'rgba(240,240,240,.15)', color: '#E8E0D0', activeBg: 'rgba(240,240,240,.14)', activeBorder: '#D0C8B8' },
    { key: 'black'  as const, label: t.battles.colorBlack,  Icon: IcoKingB,  bg: 'rgba(74,158,255,.07)',  border: 'rgba(74,158,255,.18)', color: '#82CFFF',  activeBg: 'rgba(74,158,255,.15)', activeBorder: '#4A9EFF' },
  ];

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(4,3,8,.82)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 'calc(82px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 16,
      }}
    >
      <style>{`.cbm-col:active{opacity:.7;transform:scale(.93)!important}.cbm-time:active{transform:scale(.91)!important}`}</style>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(170deg,#100C18,#0A080E)',
        border: '.5px solid rgba(212,168,67,.2)',
        borderRadius: '24px 24px 0 0',
        padding: '0 0 8px',
        boxShadow: '0 -16px 48px rgba(0,0,0,.6), 0 -1px 0 rgba(212,168,67,.1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(212,168,67,.2)' }} />
        </div>

        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <line x1="3" y1="3" x2="14" y2="14" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="6" x2="3" y2="3" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="3" y1="3" x2="6" y2="3" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="14" y1="17" x2="17" y2="17" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="17" y1="14" x2="17" y2="17" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="17" y1="6" x2="6" y2="17" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '.95rem', fontWeight: 900, color: '#F0E8CC', letterSpacing: '.01em' }}>
              {t.battles.title}
            </span>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.09)',
            color: '#6A7090', fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* ── Ставка (компактно: метка + сумма на одной строке) ── */}
        <div style={{ margin: '0 14px 10px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#6A5A30', textTransform: 'uppercase' as const, letterSpacing: '.12em', marginBottom: 6 }}>
            {t.battles.betLabel}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg,rgba(212,168,67,.08),rgba(212,168,67,.04))',
            border: '.5px solid rgba(212,168,67,.25)', borderRadius: 14, padding: '10px 14px',
          }}>
            <CoinIcon size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.55rem', fontWeight: 900, color: '#F0C85A', lineHeight: 1 }}>
                {fmtBalance(bet)}
              </div>
              {canCreate && (
                <input
                  type="range" min={MIN_BET} max={maxBet} step={1000} value={bet}
                  onChange={(e) => setBet(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 6, accentColor: '#D4A843', height: 3 }}
                />
              )}
            </div>
          </div>
          {canCreate && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginTop: 7 }}>
              {QUICK_BETS.map((v) => {
                const capped = Math.min(v, maxBet);
                const active = bet === v && v <= maxBet;
                const unavail = v > maxBet;
                return (
                  <button key={v} onClick={() => setBet(capped)} style={{
                    padding: '6px 4px', borderRadius: 9,
                    fontFamily: 'Inter, sans-serif', fontSize: '.68rem', fontWeight: 700,
                    cursor: unavail ? 'default' : 'pointer',
                    background: active ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.04)',
                    color: unavail ? '#2E2820' : active ? '#F0C85A' : '#7A7875',
                    border: active ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.07)',
                  }}>{fmtBalance(v)}</button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Публичный / Приватный ── */}
        <div style={{ margin: '0 14px 10px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#6A5A30', textTransform: 'uppercase' as const, letterSpacing: '.12em', marginBottom: 6 }}>
            {(t.battles as { visibility?: string }).visibility ?? 'Видимость'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {[
              { pub: true, label: t.battles.public_,
                Icon: () => <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><line x1="3" y1="3" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="3" y1="6" x2="3" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="3" y1="3" x2="6" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="14" y1="17" x2="17" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="17" y1="14" x2="17" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="17" y1="6" x2="6" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
              { pub: false, label: t.battles.private_,
                Icon: () => <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
            ].map(({ pub, label, Icon }) => {
              const active = isPublic === pub;
              return (
                <button key={String(pub)} onClick={() => setIsPublic(pub)} style={{
                  padding: '10px 12px', borderRadius: 11,
                  background: active ? 'rgba(212,168,67,.14)' : 'rgba(255,255,255,.03)',
                  border: `.5px solid ${active ? 'rgba(212,168,67,.38)' : 'rgba(255,255,255,.07)'}`,
                  color: active ? '#F0C85A' : '#9A9490',
                  fontFamily: 'Inter, sans-serif', fontSize: '.78rem', fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'all .15s',
                }}>
                  <Icon />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Цвет фигур — эталон JarvisPlayModal ── */}
        <div style={{ margin: '0 14px 14px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#6A5A30', textTransform: 'uppercase' as const, letterSpacing: '.12em', marginBottom: 8 }}>
            {t.battles.colorChoice}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {COLOR_OPTS.map(opt => {
              const active = color === opt.key;
              return (
                <button
                  key={opt.key}
                  className="cbm-col"
                  onClick={() => setColor(opt.key)}
                  style={{
                    background: active ? opt.activeBg : opt.bg,
                    border: `.5px solid ${active ? opt.activeBorder : opt.border}`,
                    borderRadius: 12, padding: '14px 8px',
                    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: active ? `0 0 12px ${opt.activeBorder}40` : 'none',
                  }}
                >
                  <span style={{ color: opt.color, opacity: active ? 1 : 0.35, filter: active ? 'none' : 'grayscale(0.7)', transition: 'opacity .15s, filter .15s' }}><opt.Icon /></span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.96rem', fontWeight: 800, color: active ? opt.color : 'rgba(255,255,255,.5)', letterSpacing: '.03em' }}>{opt.label}</span>
                  {active && <div style={{ width: 18, height: 2, borderRadius: 1, background: opt.activeBorder }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Время партии — эталон JarvisPlayModal ── */}
        <div style={{ margin: '0 14px 18px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#6A5A30', textTransform: 'uppercase' as const, letterSpacing: '.12em', marginBottom: 8 }}>
            {t.battles.timeControl}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
            {TIME_OPTIONS.map(mins => {
              const secs = mins * 60;
              const active = duration === secs;
              return (
                <button
                  key={mins}
                  className="cbm-time"
                  onClick={() => setDuration(secs)}
                  style={{
                    background: active ? 'rgba(212,168,67,.16)' : 'rgba(255,255,255,.05)',
                    border: `.5px solid ${active ? 'rgba(212,168,67,.6)' : 'rgba(255,255,255,.1)'}`,
                    borderRadius: 10, padding: '14px 6px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: active ? '0 0 10px rgba(212,168,67,.25)' : 'none',
                  }}
                >
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.44rem', fontWeight: 900, color: active ? '#F0C85A' : 'rgba(255,255,255,.45)', letterSpacing: '-.01em', lineHeight: 1 }}>
                    {mins < 60 ? mins : '60'}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '.76rem', fontWeight: 700, color: active ? 'rgba(240,200,90,.65)' : 'rgba(255,255,255,.22)', letterSpacing: '.06em', marginTop: 4 }}>
                    МИН
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Кнопка создания ── */}
        <div style={{ margin: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!hasAttempts ? (
            <button
              onClick={onBuyAttempts}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg,#3A0808,#5A1010)',
                border: '.5px solid rgba(220,50,47,.4)',
                borderRadius: 14,
                fontFamily: 'Inter, sans-serif', fontSize: '.9rem', fontWeight: 900, letterSpacing: '.06em',
                color: '#FF8080', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(220,50,47,.15)',
              }}
            >⭐ НЕТ ПОПЫТОК</button>
          ) : !canCreate ? (
            <button
              onClick={() => { onClose(); navigate('/shop'); }}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg,#3A2A08,#5A4010)',
                border: '.5px solid rgba(212,168,67,.5)',
                borderRadius: 14,
                fontFamily: 'Inter, sans-serif', fontSize: '.9rem', fontWeight: 900, letterSpacing: '.04em',
                color: '#F0C85A', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(212,168,67,.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <CoinIcon size={20} />
              Пополнить баланс
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg,#3A2A08,#5A4010)',
                border: '.5px solid rgba(212,168,67,.5)',
                borderRadius: 14,
                fontFamily: 'Inter, sans-serif', fontSize: '.9rem', fontWeight: 900, letterSpacing: '.06em',
                color: '#F0C85A',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 20px rgba(212,168,67,.18)',
                transition: 'all .15s', position: 'relative', overflow: 'hidden',
              }}
            >
              {!loading && (
                <div style={{
                  position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
                  background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)',
                  animation: 'cbm-shine 2.5s ease-in-out infinite',
                }} />
              )}
              <style>{`@keyframes cbm-shine{0%{left:-100%}100%{left:200%}}`}</style>
              {loading ? t.battles.creating : t.battles.createBtn.toUpperCase()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Общие стили ──
const sectionLabel: React.CSSProperties = {
  fontSize: '.58rem',
  fontWeight: 700,
  color: '#7A7875',
  textTransform: 'uppercase',
  letterSpacing: '.14em',
  padding: '14px .85rem 8px',
  display: 'flex',
  alignItems: 'center',
};

const bmSectionLbl: React.CSSProperties = {
  fontSize: '.58rem',
  fontWeight: 700,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: '#7A7875',
  marginBottom: 10,
};
