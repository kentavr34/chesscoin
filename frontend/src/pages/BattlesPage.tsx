import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageLayout, InfoPopup, useInfoPopup } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { AttemptsModal } from '@/components/ui/AttemptsModal';
import { getSocket } from '@/api/socket';
import { fmtBalance, fmtTime } from '@/utils/format';
import { translations } from '@/i18n/translations';
import { IcoStripedQueen, IcoKingWhite as IcoKingW, IcoKingBlack as IcoKingB } from '@/components/icons/ChessIcons';
import { PgnReplayModal } from '@/components/profile/PgnReplayModal';
import type { BattleLobbyItem, GameSession, UserPublic } from '@/types';
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

type Tab = 'public' | 'private';

export const BattlesPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { battles, sessions, liveBattles, upsertSession } = useGameStore();
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('public');
  // Историю партий показывает отдельная /battles/history (кнопка часов в шапке).
  const [showCreate, setShowCreate] = useState(false);

  // Вход с чужого профиля по кнопке «Сразиться» → открыть создание приватного батла
  // (полноценный direct-challenge endpoint появится в PR-1; пока flow: создать
  // приватный батл → скопировать ссылку → отправить сопернику).
  useEffect(() => {
    const challengeUserId = (location.state as Record<string, unknown> | null)?.challengeUserId as string | undefined;
    if (challengeUserId) {
      setShowCreate(true);
      showToast('Создай приватный батл — отправь ссылку игроку через «Поделиться»', 'info');
      // Чистим state, чтобы при обновлении страницы модал не открывался снова
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showQuick, setShowQuick] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAttempts, setShowAttempts] = useState(false);
  const [replayData, setReplayData] = useState<{
    pgn: string; title: string; sessionId: string;
    whitePlayer?: UserPublic | null; blackPlayer?: UserPublic | null;
  } | null>(null);

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

  // История партий — отдельная страница /battles/history (кнопка часов в шапке)

  return (
    <PageLayout title={t.battles.title} centered leftAction={leftAction} rightAction={rightAction}>
      {/* InfoPopup при первом входе */}
      {info.show && (
        <InfoPopup infoKey="battles" slides={[...t.battles.info] as Parameters<typeof InfoPopup>[0]["slides"]} onClose={info.close} />
      )}

      {/* ── 2 вкладки: ПУБЛИЧНЫЕ / ПРИВАТНЫЕ ── */}
      <div style={{ display: 'flex', gap: 6, margin: '4px .85rem 12px', padding: 0 }}>
        {([
          {
            key: 'public' as Tab,
            label: 'ПУБЛИЧНЫЕ',
            count: waitingSessions.length + liveSessions.length,
            color: '#F0C85A',
            glow: 'rgba(212,168,67,.15)',
            border: 'rgba(212,168,67,.35)',
          },
          {
            key: 'private' as Tab,
            label: 'ПРИВАТНЫЕ',
            count: myPrivateSessions.length,
            color: '#9B85FF',
            glow: 'rgba(155,109,255,.15)',
            border: 'rgba(155,109,255,.35)',
          },
        ] as const).map(({ key, label, count, color, glow, border }) => {
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

      {/* ════════ ПУБЛИЧНЫЕ (live + waiting) ════════ */}
      {tab === 'public' && (
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
                const isCreator = battle.creator?.id === user?.id;
                const isOpponent = battle.opponent?.id === user?.id;
                const isMyMatch = isCreator || isOpponent;
                // Создатель обычного публичного батла → может отменить
                // Турнирный/военный матч (sourceType≠null) — отменить нельзя
                const canCancel = isCreator && !battle.sourceType;
                return (
                  <BattleChallengeCard
                    key={battle.id}
                    battle={battle}
                    isTop={idx === 0}
                    onJoin={() => handleJoin(battle)}
                    onCancel={canCancel ? () => handleCancel(battle.id) : undefined}
                    onAccept={() => {
                      // Турнирные/военные → game:accept_private
                      const socket = getSocket();
                      socket.emit('game:accept_private', { sessionId: battle.id }, (res: any) => {
                        if (res?.ok) {
                          if (res.session) upsertSession(res.session);
                          navigate('/game/' + battle.id);
                        } else {
                          showToast(getErrText(res?.error ?? ''), 'error');
                        }
                      });
                    }}
                    onSpectate={() => navigate('/game/' + battle.id + '?spectate=1')}
                    isMyMatch={isMyMatch && !!battle.sourceType}
                    onProfile={(id) => navigate('/profile/' + id)}
                    acceptLabel={t.battles.accept ?? 'Войти'}
                  />
                );
              })}
            </>
          )}

          {waitingSessions.length === 0 && liveSessions.length === 0 && (
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
              <div style={{ fontSize: '.85rem', color: '#7A7875', fontWeight: 600 }}>Нет публичных вызовов</div>
              <div style={{ fontSize: '.72rem', color: '#3E3A35' }}>Создай батл и бросай вызов!</div>
            </div>
          )}
        </>
      )}

      {/* ════════ ПРИВАТНЫЕ (мои приватные ожидающие) ════════ */}
      {tab === 'private' && (
        <>
          {myPrivateSessions.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '56px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <svg width="44" height="44" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.4 }}>
                <rect x="3" y="9" width="14" height="9" rx="2" stroke="#9B85FF" strokeWidth="1.8"/>
                <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="#9B85FF" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: '.85rem', color: '#7A7875', fontWeight: 600 }}>Нет приватных вызовов</div>
              <div style={{ fontSize: '.72rem', color: '#3E3A35' }}>Создай приватный батл и отправь другу</div>
            </div>
          ) : (
            myPrivateSessions.map((s) => {
              const shareText = `Вызов на шахматный батл! Ставка: ${fmtBalance(s.bet ?? '0')} монет`;
              const shareUrl  = `https://t.me/share/url?url=https://t.me/ChessCoinBot/app?startapp=battle_${s.id}&text=${encodeURIComponent(shareText)}`;
              return (
                <PrivateBattleCard key={s.id} session={s} onShare={() => window.open(shareUrl, '_blank')} onCancel={() => handleCancel(s.id)} onProfile={(id) => navigate('/profile/' + id)} />
              );
            })
          )}
        </>
      )}

      {/* История партий — кнопка часов в шапке ведёт на /battles/history */}

      {/* FAB быстрой игры удалён по требованию Кенана 2026-05-15 */}

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
      {showQuick && <QuickMatchModal onClose={() => setShowQuick(false)} onBuyAttempts={() => setShowAttempts(true)} />}
      {showAttempts && user && <AttemptsModal user={user} onClose={() => setShowAttempts(false)} />}
      {replayData && (
        <PgnReplayModal
          pgn={replayData.pgn}
          title={replayData.title}
          sessionId={replayData.sessionId}
          whitePlayer={replayData.whitePlayer}
          blackPlayer={replayData.blackPlayer}
          onClose={() => setReplayData(null)}
        />
      )}
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
// Иконки источника: SVG (никаких эмодзи)
const IcoBadgeTrophy: React.FC<{ color: string }> = ({ color }) => (
  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
    <path d="M5 3h8v3.5a4 4 0 0 1-8 0V3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M5 5H3.5C3 5 2.5 5.5 2.5 6.2c0 1.6 1.2 3 3 3.3M13 5h1.5c.5 0 1 .5 1 1.2 0 1.6-1.2 3-3 3.3" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M9 11.5V14M6 14.5h6M6.5 16h5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcoBadgeSwords: React.FC<{ color: string }> = ({ color }) => (
  <svg width="11" height="11" viewBox="0 0 18 18" fill="none">
    <path d="M2.5 2.5l8 8M14 4.5L11 7.5M3.5 14.5l3-3M14.5 14.5l-8-8M3 4.5L6 7.5M14.5 2.5l-8 8" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="3.5" cy="3.5" r=".8" fill={color}/>
    <circle cx="14.5" cy="3.5" r=".8" fill={color}/>
  </svg>
);

const SOURCE_BADGE: Record<string, { Icon: React.FC<{ color: string }>; label: string; color: string; bg: string; border: string }> = {
  TOURNAMENT: { Icon: IcoBadgeTrophy, label: 'Турнир', color: '#F0C85A', bg: 'rgba(240,200,90,.1)', border: 'rgba(240,200,90,.3)' },
  WAR:        { Icon: IcoBadgeSwords, label: 'Война',  color: '#FF8855', bg: 'rgba(255,136,85,.1)', border: 'rgba(255,136,85,.3)' },
};

const BattleChallengeCard: React.FC<{
  battle: BattleLobbyItem;
  isTop: boolean;
  onJoin: () => void;
  onCancel?: () => void;
  onAccept?: () => void;       // приём своего турнирного/военного вызова
  onSpectate?: () => void;     // зрительский режим для чужого вызова
  isMyMatch?: boolean;         // я — один из двух участников этого вызова
  onProfile: (id: string) => void;
  acceptLabel: string;
}> = ({ battle, isTop, onJoin, onCancel, onAccept, onSpectate, isMyMatch, onProfile, acceptLabel }) => {
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
  const opp = battle.opponent;
  const oppId = opp?.id;
  const oppAsUser = opp ? {
    id: opp.id,
    firstName: opp.firstName,
    avatar: opp.avatar,
    avatarGradient: opp.avatarGradient,
  } : null;

  const srcKey = battle.sourceType ?? '';
  const src = SOURCE_BADGE[srcKey];

  // Определяем главный CTA:
  // - Я создатель → Отменить
  // - Я участник чужого турнирного/военного вызова → Принять
  // - Это турнир/война и я не участник → Зрителем
  // - Иначе обычный публичный → Войти (acceptLabel)
  let ctaButton: React.ReactNode;
  if (onCancel) {
    ctaButton = (
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
    );
  } else if (isMyMatch && onAccept) {
    ctaButton = (
      <button
        onClick={onAccept}
        style={{
          padding: '10px 14px',
          background: 'linear-gradient(135deg,#1F4A2A,#2F7A45)',
          border: '.5px solid rgba(61,186,122,.5)', borderRadius: 11,
          color: '#3DBA7A', fontSize: '.72rem', fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 2px 12px rgba(61,186,122,.25)',
          whiteSpace: 'nowrap' as const,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <IcoBadgeSwords color="#3DBA7A" />
        Принять
      </button>
    );
  } else if (src && onSpectate) {
    ctaButton = (
      <button
        onClick={onSpectate}
        style={{
          padding: '10px 14px',
          background: 'rgba(155,109,255,.1)',
          border: '.5px solid rgba(155,109,255,.3)', borderRadius: 11,
          color: '#9B85FF', fontSize: '.72rem', fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap' as const,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/>
        </svg>
        Смотреть
      </button>
    );
  } else {
    ctaButton = (
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
    );
  }

  // Цвет рамки зависит от типа: турнир — золото, война — оранжевый, обычный — золото
  const borderColor = src
    ? (isTop ? src.border : src.border.replace('.3', '.22'))
    : (isTop ? 'rgba(212,168,67,.38)' : 'rgba(212,168,67,.22)');

  return (
    <div style={{
      margin: '0 .85rem 8px',
      background: 'linear-gradient(135deg,#141018,#0F0E18)',
      border: `.5px solid ${borderColor}`,
      borderRadius: 16, padding: '12px 14px',
      position: 'relative',
    }}>
      {/* Бейдж источника */}
      {src && (
        <div style={{
          position: 'absolute', top: -7, left: 14,
          fontSize: '.55rem', fontWeight: 900, letterSpacing: '.08em',
          background: '#0F0E18', color: src.color,
          border: `.5px solid ${src.border}`,
          padding: '2px 7px', borderRadius: 6,
          textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <src.Icon color={src.color} />
          {src.label}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Слева: крупный аватар + имя + ELO (центрированы под аватаром) */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button
            type="button"
            style={{
              padding: 0, border: 'none', background: 'none',
              borderRadius: '50%', overflow: 'hidden',
              width: 56, height: 56, flexShrink: 0,
              cursor: creatorId ? 'pointer' : 'default',
            }}
            onClick={creatorId ? (e) => { e.stopPropagation(); e.preventDefault(); onProfile(creatorId); } : undefined}
          >
            <Avatar user={creatorAsUser as any} size="l" />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, alignItems: 'center' }}>
            <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#D4C8B0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 64, textAlign: 'center' }}>
              {battle.creator?.firstName ?? '?'}
            </span>
            <span style={{ fontSize: '.62rem', fontWeight: 600, textAlign: 'center' }}>
              <span style={{ color: '#7A7470' }}>ELO </span>
              <span style={{ color: '#F0C85A' }}>{battle.creator?.elo ?? '?'}</span>
            </span>
          </div>
        </div>

        {/* Центр: [ЦветИконка] ЖДЁМ + таймер + ставка [ЦветИконка] */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <SmallColorIcon isWhite={creatorIsWhite} />
          <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4A843', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '.52rem', fontWeight: 900, color: '#D4A843', letterSpacing: '.14em' }}>ЖДЁМ</span>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '1.05rem', fontWeight: 800, color: '#F0F0E8', letterSpacing: '.02em' }}>
              {timerDisplay}
            </span>
            {battle.bet && battle.bet !== '0' && (
              <span style={{ fontSize: '.78rem', fontWeight: 800, color: '#D4A843', display: 'flex', alignItems: 'center', gap: 3 }}>
                <CoinIcon size={12} />
                {fmtBalance(battle.bet)}
              </span>
            )}
          </div>
          <SmallColorIcon isWhite={opponentIsWhite} />
        </div>

        {/* Справа: opponent (если турнир/война) ИЛИ кнопка */}
        {opp ? (
          <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <button
              type="button"
              style={{
                padding: 0, border: 'none', background: 'none',
                borderRadius: '50%', overflow: 'hidden',
                width: 56, height: 56, flexShrink: 0,
                cursor: oppId ? 'pointer' : 'default',
              }}
              onClick={oppId ? (e) => { e.stopPropagation(); e.preventDefault(); onProfile(oppId); } : undefined}
            >
              <Avatar user={oppAsUser as any} size="l" />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, alignItems: 'center' }}>
              <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#D4C8B0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 64, textAlign: 'center' }}>
                {opp.firstName}
              </span>
              <span style={{ fontSize: '.62rem', fontWeight: 600, textAlign: 'center' }}>
                <span style={{ color: '#7A7470' }}>ELO </span>
                <span style={{ color: '#F0C85A' }}>{opp.elo}</span>
              </span>
            </div>
          </div>
        ) : (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ctaButton}
          </div>
        )}
      </div>

      {/* Если есть opponent (турнир/война) → CTA снизу шире */}
      {opp && (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
          {ctaButton}
        </div>
      )}
    </div>
  );
};

// CoinIcon — золотой конь (из GamePage)
const CoinIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="15" fill="url(#cbg)" stroke="url(#cbrd)" strokeWidth="1.2"/>
    <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(180,130,20,.4)" strokeWidth=".6"/>
    <path d="M11 24c0-1 .5-2 1.5-2.5L14 21c-1-1-1.5-2.5-1-4 .3-1 1-2 2-2.5-.5-.8-.5-1.5 0-2 .8-.5 2-.3 2.5.5.5.8.3 2-.5 2.5.5.5 1 1.5.8 2.5l2 1c1 .5 1.7 1.5 1.7 2.5v.5H11z" fill="url(#ckn)"/>
    <path d="M16.5 12c.5-1 1.5-2 2-3 .3-.5 0-1-.3-1.2-.5-.3-1 0-1.2.5L16 10l-1-.5c-.3-1.5.5-3 2-3.5 1.5-.5 3 .2 3.5 1.5.3.8 0 1.8-.5 2.5l-1 1.5" fill="url(#ckn)" opacity=".9"/>
    <defs>
      <radialGradient id="cbg" cx="38%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#F0C85A"/><stop offset="55%" stopColor="#D4A843"/><stop offset="100%" stopColor="#8A6020"/>
      </radialGradient>
      <linearGradient id="cbrd" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F0C85A"/><stop offset="50%" stopColor="#A07830"/><stop offset="100%" stopColor="#F0C85A"/>
      </linearGradient>
      <linearGradient id="ckn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#120E04"/><stop offset="100%" stopColor="#1E1608"/>
      </linearGradient>
    </defs>
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
            <span style={{ fontSize: '.52rem', fontWeight: 900, color: '#3DBA7A', letterSpacing: '.16em' }}>LIVE</span>
            {sourceType === 'TOURNAMENT' && <IcoBadgeTrophy color="#F0C85A" />}
            {sourceType === 'WAR' && <IcoBadgeSwords color="#FF8855" />}
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

// ── Быстрая игра: автоформирование публичных батлов ──────────────────────────
// Пользователь выбирает время + ставку, сервер сам находит соперника либо
// создаёт публичный батл в общий лист. Фидбэк Кенана 2026-04-22.
const QuickMatchModal: React.FC<{ onClose: () => void; onBuyAttempts: () => void }> = ({ onClose, onBuyAttempts }) => {
  const { upsertSession } = useGameStore();
  const { user } = useUserStore();
  const navigate = useNavigate();

  const userAttempts = user?.attempts ?? 3;
  const hasAttempts = userAttempts > 0;
  const userBalance = Number(BigInt(user?.balance ?? '0'));

  const TIME_OPTIONS = [1, 3, 5, 15, 30, 60];
  const QUICK_BETS = [10000, 50000, 100000, 500000];

  const [duration, setDuration] = useState(300); // секунды
  const [bet, setBet] = useState(10000);
  const [loading, setLoading] = useState(false);

  const canStart = userBalance >= bet && hasAttempts;

  const handleQuick = () => {
    if (!hasAttempts) { onBuyAttempts(); return; }
    if (userBalance < bet) {
      showToast('Недостаточно монет — пополни баланс', 'info');
      navigate('/shop');
      return;
    }
    setLoading(true);
    const socket = getSocket();
    socket.emit('matchmaking:quick', { duration, bet: String(bet) }, (res: any) => {
      setLoading(false);
      if (res?.ok && res.session) {
        upsertSession(res.session);
        if (res.matched) {
          // Соперник найден → сразу в игру
          showToast('Соперник найден! Удачи', 'info');
          navigate('/game/' + res.session.id);
        } else {
          // Соперник не найден → батл опубликован, ждём оппонента
          showToast('Батл опубликован — ждём соперника', 'info');
        }
        onClose();
      } else {
        showToast(getErrText(res?.error ?? ''), 'error');
      }
    });
  };

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
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(170deg,#0A1120,#06101A)',
        border: '.5px solid rgba(74,158,255,.25)',
        borderRadius: '24px 24px 0 0',
        padding: '0 0 calc(16px + env(safe-area-inset-bottom, 0px))',
        boxShadow: '0 -16px 48px rgba(0,0,0,.6), 0 -1px 0 rgba(74,158,255,.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(74,158,255,.25)' }} />
        </div>

        <div style={{ padding: '6px 20px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.02rem', fontWeight: 900, color: '#E8F2FF', letterSpacing: '.01em' }}>
            Быстрая игра
          </span>
        </div>
        <div style={{ padding: '0 20px 14px', fontSize: '.78rem', color: 'rgba(200,220,255,.65)', lineHeight: 1.4 }}>
          Автоподбор соперника с такими же параметрами. Если никого нет — батл опубликуется в общем списке.
        </div>

        {/* Время */}
        <div style={{ padding: '0 20px 10px' }}>
          <div style={{ fontSize: '.72rem', color: 'rgba(200,220,255,.55)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Время</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {TIME_OPTIONS.map((m) => {
              const secs = m * 60;
              const active = duration === secs;
              return (
                <button
                  key={m}
                  onClick={() => setDuration(secs)}
                  style={{
                    padding: '10px 0', borderRadius: 10,
                    background: active ? 'rgba(74,158,255,.18)' : 'rgba(255,255,255,.03)',
                    border: active ? '.5px solid #4A9EFF' : '.5px solid rgba(255,255,255,.08)',
                    color: active ? '#82CFFF' : '#C8D8EC',
                    fontSize: '.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{m}м</button>
              );
            })}
          </div>
        </div>

        {/* Ставка */}
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ fontSize: '.72rem', color: 'rgba(200,220,255,.55)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Ставка</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {QUICK_BETS.map((v) => {
              const active = bet === v;
              const affordable = userBalance >= v;
              return (
                <button
                  key={v}
                  disabled={!affordable}
                  onClick={() => setBet(v)}
                  style={{
                    padding: '12px 0', borderRadius: 10,
                    background: active ? 'rgba(240,200,90,.18)' : 'rgba(255,255,255,.03)',
                    border: active ? '.5px solid #F0C85A' : '.5px solid rgba(255,255,255,.08)',
                    color: !affordable ? 'rgba(200,220,255,.25)' : active ? '#F0C85A' : '#E8E0D0',
                    fontSize: '.82rem', fontWeight: 700, cursor: affordable ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', opacity: affordable ? 1 : .45,
                  }}
                >{fmtBalance(BigInt(v))}</button>
              );
            })}
          </div>
        </div>

        {/* Кнопка поиска */}
        <div style={{ padding: '0 20px 6px' }}>
          <button
            onClick={handleQuick}
            disabled={!canStart || loading}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14,
              background: canStart && !loading
                ? 'linear-gradient(135deg,#4A9EFF,#82CFFF)'
                : 'rgba(120,140,170,.18)',
              color: canStart && !loading ? '#06121F' : 'rgba(200,220,255,.4)',
              border: 'none', cursor: canStart && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: '.95rem', fontWeight: 800,
              letterSpacing: '.02em',
              boxShadow: canStart && !loading ? '0 4px 20px rgba(74,158,255,.35)' : 'none',
            }}
          >
            {loading ? 'Поиск…' : !hasAttempts ? 'Купить попытки' : userBalance < bet ? 'Недостаточно монет' : '⚡ Найти соперника'}
          </button>
        </div>
      </div>
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
    { key: 'random' as const, label: t.battles.colorRandom, Icon: IcoStripedQueen, bg: 'rgba(212,168,67,.1)', border: 'rgba(212,168,67,.3)', color: '#F0C85A',  activeBg: 'rgba(212,168,67,.18)', activeBorder: '#D4A843' },
    { key: 'white'  as const, label: t.battles.colorWhite,  Icon: IcoKingW,  bg: 'rgba(240,240,240,.08)', border: 'rgba(240,240,240,.18)', color: '#E8E0D0', activeBg: 'rgba(240,240,240,.16)', activeBorder: '#D0C8B8' },
    { key: 'black'  as const, label: t.battles.colorBlack,  Icon: IcoKingB,  bg: 'rgba(74,158,255,.08)',  border: 'rgba(74,158,255,.2)',  color: '#82CFFF',  activeBg: 'rgba(74,158,255,.16)', activeBorder: '#4A9EFF' },
  ];

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(4,3,8,.82)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
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
          {/* Кенан 2026-05-15: убрать quick-bets — мешают */}
        </div>

        {/* ── Публичный / Приватный ── */}
        <div style={{ margin: '0 14px 10px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#6A5A30', textTransform: 'uppercase' as const, letterSpacing: '.12em', marginBottom: 6 }}>
            {t.battles.visibility ?? 'Видимость'}
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

        {/* ── Цвет фигур — по шаблону JarvisPlayModal ── */}
        <div style={{ margin: '0 14px 10px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#6A5A30', textTransform: 'uppercase' as const, letterSpacing: '.12em', marginBottom: 6 }}>
            {t.battles.colorChoice}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {COLOR_OPTS.map(opt => {
              const active = color === opt.key;
              // Белая фигура всегда яркая (по требованию Кенана 2026-05-16).
              const iconOpacity = opt.key === 'white' ? (active ? 1 : 0.85) : (active ? 1 : 0.35);
              const iconFilter  = opt.key === 'white' ? 'none' : (active ? 'none' : 'grayscale(0.7)');
              return (
                <button
                  key={opt.key}
                  className="cbm-col"
                  onClick={() => setColor(opt.key)}
                  style={{
                    background: active ? opt.activeBg : opt.bg,
                    border: `.5px solid ${active ? opt.activeBorder : opt.border}`,
                    borderRadius: 12, padding: '10px 6px',
                    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: active ? `0 0 12px ${opt.activeBorder}40` : 'none',
                  }}
                >
                  <span style={{ color: opt.color, opacity: iconOpacity, filter: iconFilter, transition: 'opacity .15s, filter .15s' }}><opt.Icon /></span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: active ? opt.color : 'rgba(255,255,255,.5)', letterSpacing: '.03em' }}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Время партии — по шаблону JarvisPlayModal ── */}
        <div style={{ margin: '0 14px 12px' }}>
          <div style={{ fontSize: '.52rem', fontWeight: 700, color: '#6A5A30', textTransform: 'uppercase' as const, letterSpacing: '.12em', marginBottom: 6 }}>
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
                  <div style={{ fontSize: '1.32rem', fontWeight: 900, color: active ? '#F0C85A' : 'rgba(255,255,255,.45)', letterSpacing: '-.01em', lineHeight: 1 }}>
                    {mins}
                  </div>
                  <div style={{ fontSize: '.68rem', fontWeight: 700, color: active ? 'rgba(240,200,90,.65)' : 'rgba(255,255,255,.22)', letterSpacing: '.06em', marginTop: 4 }}>
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

// ──────────────────────────────────────────────────────────────────────────
// PR-1: PrivateBattleCard — карточка приватной партии в табе «ПРИВАТНЫЕ».
// Показывает source-эмблему (Турнир / Война / Личный вызов от X), таймер
// дедлайна 24ч (для WAR/TOURNAMENT) или 30 дней (для PRIVATE/PUBLIC) и
// кнопки «Принять» (если другая сторона уже приняла) / «Поделиться» / «Отменить».
// ──────────────────────────────────────────────────────────────────────────
const PrivateBattleCard: React.FC<{
  session: GameSession;
  onShare: () => void;
  onCancel: () => void;
  onProfile: (id: string) => void;
}> = ({ session, onShare, onCancel, onProfile }) => {
  const { user } = useUserStore();
  const mySide = session.sides.find(s => s.playerId === user?.id);
  const oppSide = session.sides.find(s => s.playerId !== user?.id);
  const opp = oppSide?.player;

  const srcKey = (session as any).sourceType as string | undefined;
  const src = srcKey ? SOURCE_BADGE[srcKey] : undefined;
  // PRIVATE для creator — без эмблемы; для receiver — «вызов от X»
  const amCreator = mySide && session.sides[0]?.id === mySide.id;
  const showPrivateLabel = srcKey === 'PRIVATE' && !amCreator && opp?.firstName;

  // Таймер дедлайна
  const deadlineMs = (session as any).deadlineAt ? new Date((session as any).deadlineAt).getTime() : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadlineMs) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [deadlineMs]);
  const secsLeft = deadlineMs ? Math.max(0, Math.floor((deadlineMs - now) / 1000)) : 0;
  const hoursLeft = Math.floor(secsLeft / 3600);
  const minsLeft = Math.floor((secsLeft % 3600) / 60);
  const timerText = deadlineMs
    ? hoursLeft >= 24 ? `${Math.floor(hoursLeft / 24)}д ${hoursLeft % 24}ч`
    : hoursLeft > 0 ? `${hoursLeft}ч ${minsLeft}м`
    : `${minsLeft}м`
    : null;

  // Принял ли уже соперник
  const oppAccepted = oppSide?.status === 'IN_PROGRESS';

  const borderColor = src?.border ?? 'rgba(155,109,255,.25)';
  const labelColor = src?.color ?? '#9B85FF';

  return (
    <div style={{
      margin: '0 .85rem 8px',
      background: 'linear-gradient(135deg,#141018,#0F0E18)',
      border: `.5px solid ${borderColor}`,
      borderRadius: 16, padding: '12px 14px',
      position: 'relative',
    }}>
      {/* Бейдж источника */}
      {src && (
        <div style={{
          position: 'absolute', top: -7, left: 14,
          fontSize: '.55rem', fontWeight: 900, letterSpacing: '.08em',
          background: '#0F0E18', color: src.color,
          border: `.5px solid ${src.border}`,
          padding: '2px 7px', borderRadius: 6,
          textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <src.Icon color={src.color} />
          {src.label}
        </div>
      )}
      {showPrivateLabel && (
        <div style={{
          position: 'absolute', top: -7, left: 14,
          fontSize: '.55rem', fontWeight: 900, letterSpacing: '.08em',
          background: '#0F0E18', color: '#9B85FF',
          border: '.5px solid rgba(155,109,255,.3)',
          padding: '2px 7px', borderRadius: 6,
          textTransform: 'uppercase',
        }}>
          Вызов от {opp?.firstName}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Аватар соперника (или своя сторона если приватный без оппонента) */}
        <button
          type="button"
          style={{
            padding: 0, border: 'none', background: 'none',
            borderRadius: '50%', overflow: 'hidden',
            width: 48, height: 48, flexShrink: 0,
            cursor: opp?.id ? 'pointer' : 'default',
          }}
          onClick={opp?.id ? () => onProfile(opp.id!) : undefined}
        >
          <Avatar user={opp ?? mySide?.player as any} size="l" />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#EAE2CC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {opp?.firstName ?? mySide?.player?.firstName ?? '?'}
          </div>
          <div style={{ fontSize: '.65rem', color: '#7A7875', marginTop: 2, display: 'flex', gap: 8 }}>
            {timerText && (
              <span style={{ color: secsLeft < 3600 ? '#FF8855' : labelColor, fontWeight: 700 }}>
                ⏱ {timerText}
              </span>
            )}
            {oppAccepted && (
              <span style={{ color: '#3DBA7A', fontWeight: 700 }}>СОПЕРНИК ПРИНЯЛ</span>
            )}
          </div>
        </div>

        {/* Действия */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {srcKey === 'PRIVATE' && (
            <button onClick={onShare} style={privateCardBtnStyle('#82CFFF', 'rgba(74,158,255,.1)', 'rgba(74,158,255,.3)')}>
              Поделиться
            </button>
          )}
          <button onClick={onCancel} style={privateCardBtnStyle('#FF8080', 'rgba(220,50,47,.08)', 'rgba(220,50,47,.3)')}>
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
};

const privateCardBtnStyle = (color: string, bg: string, border: string): React.CSSProperties => ({
  padding: '8px 10px', background: bg,
  border: `.5px solid ${border}`, borderRadius: 10,
  color, fontSize: '.65rem', fontWeight: 800,
  cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap' as const,
});
