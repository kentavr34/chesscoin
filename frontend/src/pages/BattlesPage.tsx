import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout, InfoPopup, useInfoPopup } from '@/components/layout/PageLayout';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { AttemptsModal } from '@/components/ui/AttemptsModal';
import { getSocket } from '@/api/socket';
import { fmtBalance, fmtTime } from '@/utils/format';
import { translations } from '@/i18n/translations';
import type { BattleLobbyItem } from '@/types';
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
  const { battles, sessions, upsertSession } = useGameStore();
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('public');
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAttempts, setShowAttempts] = useState(false);

  const attempts = user?.attempts ?? 3;
  const hasAttempts = attempts > 0;

  const info = useInfoPopup('battles', [...t.battles.info] as Parameters<typeof InfoPopup>[0]["slides"]);

  // Live — активные батлы IN_PROGRESS (без ботов)
  const liveSessions = sessions.filter((s) => s.status === 'IN_PROGRESS' && s.type !== 'BOT');

  // Ожидающие — публичные, отсортированные по ставке (desc)
  const waitingSessions = [...battles].sort((a, b) => {
    const betA = BigInt(a.bet || '0');
    const betB = BigInt(b.bet || '0');
    return betB > betA ? 1 : betB < betA ? -1 : 0;
  });

  // Приватные — только приватные WAITING_FOR_OPPONENT (без ботов и без публичных)
  const myPrivateSessions = sessions.filter((s) => s.status === 'WAITING_FOR_OPPONENT' && s.isPrivate && s.type !== 'BOT');

  const handleJoin = (battle: BattleLobbyItem) => {
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

  return (
    <PageLayout title={t.battles.title} centered leftAction={leftAction} rightAction={rightAction}>
      {/* InfoPopup при первом входе */}
      {info.show && (
        <InfoPopup infoKey="battles" slides={[...t.battles.info] as Parameters<typeof InfoPopup>[0]["slides"]} onClose={info.close} />
      )}

      {/* Вкладки Public / Private */}
      <div style={{ display: 'flex', gap: 8, margin: '4px .85rem 12px', padding: 0 }}>
        <button
          onClick={() => setTab('public')}
          style={{
            flex: 1, padding: '10px 12px',
            borderRadius: 12, fontSize: '.84rem', fontWeight: 700,
            fontFamily: 'Inter, sans-serif', cursor: 'pointer',
            transition: 'all .15s',
            background: tab === 'public' ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.04)',
            border: tab === 'public' ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.08)',
            color: tab === 'public' ? '#F0C85A' : '#9A9490',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
            <line x1="3" y1="3" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="3" y1="6" x2="3" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="3" y1="3" x2="6" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="14" y1="17" x2="17" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="17" y1="14" x2="17" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="17" y1="6" x2="6" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {t.battles.public_ ?? 'Public'}
        </button>
        <button
          onClick={() => setTab('private')}
          style={{
            flex: 1, padding: '10px 12px',
            borderRadius: 12, fontSize: '.84rem', fontWeight: 700,
            fontFamily: 'Inter, sans-serif', cursor: 'pointer',
            transition: 'all .15s',
            background: tab === 'private' ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.04)',
            border: tab === 'private' ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.08)',
            color: tab === 'private' ? '#F0C85A' : '#9A9490',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {t.battles.private_ ?? 'Private'}
          {myPrivateSessions.length > 0 && (
            <span style={{
              background: '#D4A843', color: '#0D0D12',
              fontSize: '.55rem', fontWeight: 800,
              padding: '1px 5px', borderRadius: 8,
              minWidth: 16, textAlign: 'center' as const,
            }}>
              {myPrivateSessions.length}
            </span>
          )}
        </button>
      </div>

      {/* ════════ PUBLIC ════════ */}
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
                const mySide = s.sides.find((sd) => sd.id === s.mySideId);
                const opSide = s.sides.find((sd) => sd.id !== s.mySideId);
                const sourceType = (s as any).sourceType;
                const sourceIcon = sourceType === 'TOURNAMENT'
                  ? <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M5 2h10v7a5 5 0 0 1-10 0V2Z" stroke="#D4A843" strokeWidth="1.5"/><path d="M2 3h3M15 3h3M2 3a2 2 0 0 0 0 4h3M18 3a2 2 0 0 1 0 4h-3M10 14v2M7 16h6" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  : sourceType === 'WAR'
                  ? <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><line x1="3" y1="3" x2="14" y2="14" stroke="#3DBA7A" strokeWidth="2" strokeLinecap="round"/><line x1="3" y1="6" x2="3" y2="3" stroke="#3DBA7A" strokeWidth="2.5" strokeLinecap="round"/><line x1="3" y1="3" x2="6" y2="3" stroke="#3DBA7A" strokeWidth="2.5" strokeLinecap="round"/><line x1="14" y1="17" x2="17" y2="17" stroke="#3DBA7A" strokeWidth="2.5" strokeLinecap="round"/><line x1="17" y1="14" x2="17" y2="17" stroke="#3DBA7A" strokeWidth="2.5" strokeLinecap="round"/><line x1="17" y1="6" x2="6" y2="17" stroke="#3DBA7A" strokeWidth="2" strokeLinecap="round"/></svg>
                  : <span style={{ fontSize: 12 }}>♟</span>;
                const whitePlayer = s.sides.find((sd) => sd.isWhite);
                const blackPlayer = s.sides.find((sd) => !sd.isWhite);
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate('/game/' + s.id)}
                    style={{
                      margin: '0 .85rem 8px',
                      background: 'linear-gradient(135deg,#141018,#0F0E18)',
                      border: '.5px solid rgba(61,186,122,.30)',
                      borderRadius: 16, padding: '14px 14px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                      boxShadow: '0 2px 16px rgba(61,186,122,.08)',
                    }}
                  >
                    {/* Белый игрок */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: 'rgba(255,255,255,.08)',
                        border: '.5px solid rgba(255,255,255,.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                      }}>♔</div>
                      <span style={{
                        fontSize: '.62rem', fontWeight: 600, color: '#C8C4BE',
                        maxWidth: 52, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                        textAlign: 'center' as const,
                      }}>
                        {whitePlayer?.player?.firstName ?? '?'}
                      </span>
                    </div>

                    {/* Центр */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: '#3DBA7A', animation: 'pulse 1.5s infinite',
                          display: 'inline-block',
                        }} />
                        <span style={{ fontSize: '.58rem', fontWeight: 800, color: '#3DBA7A', letterSpacing: '.14em', textTransform: 'uppercase' as const }}>LIVE</span>
                        <span style={{ display: 'flex', alignItems: 'center' }}>{sourceIcon}</span>
                      </div>
                      <span style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: '1rem', fontWeight: 700, color: '#F0F0E8',
                      }}>
                        {fmtTime(mySide?.timeLeft ?? opSide?.timeLeft ?? 300)}
                      </span>
                      {s.bet && (
                        <span style={{
                          fontSize: '.65rem', fontWeight: 700,
                          color: '#D4A843',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="9" stroke="#D4A843" strokeWidth="1.5"/>
                            <text x="10" y="14" textAnchor="middle" fill="#D4A843" fontSize="10" fontWeight="800">ᚙ</text>
                          </svg>
                          {fmtBalance(s.bet)}
                        </span>
                      )}
                    </div>

                    {/* Чёрный игрок */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: 'rgba(0,0,0,.4)',
                        border: '.5px solid rgba(255,255,255,.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                      }}>♚</div>
                      <span style={{
                        fontSize: '.62rem', fontWeight: 600, color: '#C8C4BE',
                        maxWidth: 52, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                        textAlign: 'center' as const,
                      }}>
                        {blackPlayer?.player?.firstName ?? '?'}
                      </span>
                    </div>
                  </div>
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
              {waitingSessions.map((battle, idx) => (
                <div
                  key={battle.id}
                  style={{
                    margin: '0 .85rem 8px',
                    background: 'linear-gradient(135deg,#141018,#0F0E18)',
                    border: idx === 0
                      ? '.5px solid rgba(212,168,67,.38)'
                      : '.5px solid rgba(212,168,67,.22)',
                    borderRadius: 16, padding: '14px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  {/* Аватар-плейсхолдер */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg,rgba(212,168,67,.18),rgba(212,168,67,.06))',
                    border: '.5px solid rgba(212,168,67,.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                    color: '#D4A843',
                  }}>
                    {battle.creator?.firstName?.slice(0,1)?.toUpperCase() ?? '?'}
                  </div>

                  {/* Инфо */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: '.8rem', fontWeight: 700, color: '#E8E4DC',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                      }}>
                        {battle.creator?.firstName ?? '?'}
                      </span>
                      {idx === 0 && (
                        <span style={{
                          fontSize: '.55rem', padding: '1px 6px',
                          background: 'rgba(212,168,67,.15)',
                          color: '#D4A843',
                          border: '.5px solid rgba(212,168,67,.3)',
                          borderRadius: 5, fontWeight: 800,
                          textTransform: 'uppercase' as const, letterSpacing: '.08em',
                        }}>TOP</span>
                      )}
                    </div>
                    <div style={{ fontSize: '.68rem', color: '#7A7875', marginBottom: 5 }}>
                      {Math.round((battle.duration ?? 300) / 60)} мин · ELO {battle.creator?.elo ?? '?'}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px',
                      background: 'rgba(212,168,67,.1)',
                      border: '.5px solid rgba(212,168,67,.22)',
                      borderRadius: 7,
                      fontSize: '.68rem', fontWeight: 700, color: '#D4A843',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" stroke="#D4A843" strokeWidth="1.5"/>
                        <text x="10" y="14" textAnchor="middle" fill="#D4A843" fontSize="10" fontWeight="800">ᚙ</text>
                      </svg>
                      {fmtBalance(battle.bet)}
                    </div>
                  </div>

                  {/* Кнопка войти */}
                  <button
                    onClick={() => handleJoin(battle)}
                    style={{
                      padding: '9px 16px',
                      background: 'linear-gradient(135deg,#D4A843,#F0C85A)',
                      border: 'none', borderRadius: 11,
                      color: '#0D0D12', fontSize: '.72rem', fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 2px 12px rgba(212,168,67,.35)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {t.battles.accept ?? 'Войти'}
                  </button>
                </div>
              ))}
            </>
          )}

          {liveSessions.length === 0 && waitingSessions.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '56px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <svg width="44" height="44" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.4 }}>
                <line x1="3" y1="3" x2="14" y2="14" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"/>
                <line x1="3" y1="6" x2="3" y2="3" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="3" y1="3" x2="6" y2="3" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="14" y1="17" x2="17" y2="17" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="17" y1="14" x2="17" y2="17" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="17" y1="6" x2="6" y2="17" stroke="#D4A843" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: '.85rem', color: '#7A7875', fontWeight: 600 }}>
                {t.battles.noActive ?? 'Нет активных батлов'}
              </div>
              <div style={{ fontSize: '.72rem', color: '#3E3A35' }}>
                {t.battles.createFirst ?? 'Создай первый батл!'}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════ PRIVATE ════════ */}
      {tab === 'private' && (
        <>
          {myPrivateSessions.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '56px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <svg width="44" height="44" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.4 }}>
                <rect x="3" y="9" width="14" height="9" rx="2" stroke="#D4A843" strokeWidth="1.8"/>
                <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="#D4A843" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: '.85rem', color: '#7A7875', fontWeight: 600 }}>
                {t.battles.noPrivate ?? 'Нет приватных батлов'}
              </div>
              <div style={{ fontSize: '.72rem', color: '#3E3A35' }}>
                {t.battles.createPrivate ?? 'Создай и поделись ссылкой!'}
              </div>
            </div>
          )}
          {myPrivateSessions.map((s) => {
            const sourceType = (s as any).sourceType;
            const sourceIcon = sourceType === 'TOURNAMENT'
              ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 2h10v7a5 5 0 0 1-10 0V2Z" stroke="#D4A843" strokeWidth="1.5"/><path d="M2 3h3M15 3h3M2 3a2 2 0 0 0 0 4h3M18 3a2 2 0 0 1 0 4h-3M10 14v2M7 16h6" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round"/></svg>
              : sourceType === 'WAR'
              ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><line x1="3" y1="3" x2="14" y2="14" stroke="#FF4D6A" strokeWidth="2" strokeLinecap="round"/><line x1="3" y1="6" x2="3" y2="3" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round"/><line x1="3" y1="3" x2="6" y2="3" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round"/><line x1="14" y1="17" x2="17" y2="17" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round"/><line x1="17" y1="14" x2="17" y2="17" stroke="#FF4D6A" strokeWidth="2.5" strokeLinecap="round"/><line x1="17" y1="6" x2="6" y2="17" stroke="#FF4D6A" strokeWidth="2" strokeLinecap="round"/></svg>
              : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="9" width="14" height="9" rx="2" stroke="#9B85FF" strokeWidth="1.8"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="#9B85FF" strokeWidth="1.8" strokeLinecap="round"/></svg>;
            const sourceName = sourceType === 'TOURNAMENT'
              ? (t.battles.fromTournament ?? 'Tournament')
              : sourceType === 'WAR'
              ? (t.battles.fromWar ?? 'Country War')
              : (t.battles.privateChallenge ?? 'Private Challenge');
            const iconBg = sourceType === 'TOURNAMENT'
              ? 'rgba(212,168,67,.1)'
              : sourceType === 'WAR'
              ? 'rgba(255,77,106,.1)'
              : 'rgba(155,133,255,.1)';
            const iconBorder = sourceType === 'TOURNAMENT'
              ? 'rgba(212,168,67,.22)'
              : sourceType === 'WAR'
              ? 'rgba(255,77,106,.22)'
              : 'rgba(155,133,255,.22)';
            return (
              <div
                key={s.id}
                style={{
                  margin: '0 .85rem 8px',
                  background: 'linear-gradient(135deg,#141018,#0F0E18)',
                  border: '.5px solid rgba(212,168,67,.22)',
                  borderRadius: 16, padding: '14px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 13,
                  background: iconBg,
                  border: `.5px solid ${iconBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {sourceIcon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#E8E4DC', marginBottom: 3 }}>
                    {sourceName}
                  </div>
                  <div style={{ fontSize: '.68rem', color: '#7A7875' }}>
                    {s.bet && BigInt(s.bet) > 0n
                      ? `${fmtBalance(s.bet)} ᚙ · `
                      : ''}
                    {t.battles.waitingForOpponent ?? 'Ждём соперника...'}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/game/' + s.id)}
                  style={{
                    padding: '9px 16px',
                    background: 'linear-gradient(135deg,#D4A843,#F0C85A)',
                    border: 'none', borderRadius: 11,
                    color: '#0D0D12', fontSize: '.72rem', fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 2px 12px rgba(212,168,67,.35)',
                    flexShrink: 0,
                  }}
                >
                  {t.battles.accept ?? '→'}
                </button>
              </div>
            );
          })}
        </>
      )}

      {/* FAB — создать батл */}
      <button
        onClick={() => hasAttempts ? setShowCreate(true) : setShowAttempts(true)}
        style={{
          position: 'fixed',
          bottom: 'max(98px, calc(88px + env(safe-area-inset-bottom, 14px)))',
          right: 24, width: 50, height: 50,
          borderRadius: '50%',
          background: hasAttempts
            ? 'linear-gradient(135deg,#D4A843,#F0C85A)'
            : 'linear-gradient(135deg,#3A0808,#5A1010)',
          color: hasAttempts ? '#0D0D12' : '#FF8080',
          fontSize: hasAttempts ? 24 : 20, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', border: 'none', zIndex: 49,
          boxShadow: hasAttempts
            ? '0 4px 24px rgba(212,168,67,.45)'
            : '0 4px 24px rgba(220,50,47,.3)',
          fontFamily: 'inherit',
        }}
      >{hasAttempts ? '＋' : '⭐'}</button>

      {showCreate && <CreateBattleModal onClose={() => setShowCreate(false)} onBuyAttempts={() => { setShowCreate(false); setShowAttempts(true); }} />}
      {showAttempts && user && <AttemptsModal user={user} onClose={() => setShowAttempts(false)} />}
    </PageLayout>
  );
};

// ── Sub components ──
const MIN_BET = 10000;

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

  const TIME_OPTIONS = [1, 3, 5, 10, 20, 30];
  const QUICK_BETS = [10000, 50000, 100000, 500000];

  const durationMins = duration / 60;

  const handleCreate = () => {
    if (!canCreate) { showToast(t.battles.insufficientBalance(fmtBalance(MIN_BET)), 'error'); return; }
    setLoading(true);
    const socket = getSocket();
    const selectedColor = color === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : color;
    socket.emit('game:create:battle', { color: selectedColor, duration, bet: String(bet), isPrivate: !isPublic }, (res: any) => {
      setLoading(false);
      if (res.ok && res.session) {
        upsertSession(res.session);
        if (!isPublic && res.session.code) {
          const myRef = user?.referralCode ?? user?.telegramId;
          const shareText = t.battles.challengeShare(fmtBalance(String(bet)));
          const botUrl = `https://t.me/chessgamecoin_bot?start=battle_${res.session.code}_ref_${myRef}`;
          try { navigator.clipboard?.writeText(botUrl).catch(() => {}); } catch {}
          try { window.Telegram?.WebApp?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(shareText)}`); } catch {}
          showToast(t.battles.privateBattleCreated, 'info');
        } else {
          showToast(t.battles.battleCreated, 'info');
        }
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
          {canCreate ? (
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
          ) : (
            <div style={{ textAlign: 'center', color: '#FF4D6A', fontFamily: 'Inter, sans-serif', fontSize: '.78rem', marginTop: 8 }}>
              {t.battles.needMin(fmtBalance(MIN_BET))}
            </div>
          )}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
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
                    borderRadius: 12, padding: '12px 6px',
                    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: active ? `0 0 12px ${opt.activeBorder}40` : 'none',
                  }}
                >
                  <span style={{ color: opt.color, opacity: active ? 1 : 0.35, transition: 'opacity .15s' }}><opt.Icon /></span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '.76rem', fontWeight: 800, color: active ? opt.color : 'rgba(255,255,255,.45)', letterSpacing: '.02em' }}>{opt.label}</span>
                  {active && <div style={{ width: 16, height: 2, borderRadius: 1, background: opt.activeBorder }} />}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {TIME_OPTIONS.map(mins => {
              const secs = mins * 60;
              const active = duration === secs;
              return (
                <button
                  key={mins}
                  className="cbm-time"
                  onClick={() => setDuration(secs)}
                  style={{
                    background: active ? 'rgba(212,168,67,.16)' : 'rgba(255,255,255,.04)',
                    border: `.5px solid ${active ? 'rgba(212,168,67,.6)' : 'rgba(255,255,255,.09)'}`,
                    borderRadius: 10, padding: '11px 6px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s', transform: 'scale(1)',
                    boxShadow: active ? '0 0 10px rgba(212,168,67,.22)' : 'none',
                  }}
                >
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.3rem', fontWeight: 900, color: active ? '#F0C85A' : 'rgba(255,255,255,.4)', lineHeight: 1 }}>
                    {mins}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '.68rem', fontWeight: 700, color: active ? 'rgba(240,200,90,.65)' : 'rgba(255,255,255,.2)', letterSpacing: '.06em', marginTop: 3 }}>
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
            <>
              <button
                onClick={onBuyAttempts}
                style={{
                  width: '100%', padding: '13px',
                  background: 'linear-gradient(135deg,#3A0808,#5A1010)',
                  border: '.5px solid rgba(220,50,47,.4)',
                  borderRadius: 14,
                  fontFamily: 'Inter, sans-serif', fontSize: '.9rem', fontWeight: 900, letterSpacing: '.04em',
                  color: '#FF8080', cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(220,50,47,.15)',
                  transition: 'all .15s',
                }}
              >⭐ НЕТ ПОПЫТОК — КУПИТЬ</button>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '11px',
                  background: 'rgba(255,255,255,.04)',
                  border: '.5px solid rgba(255,255,255,.07)',
                  borderRadius: 14,
                  fontFamily: 'Inter, sans-serif', fontSize: '.82rem', fontWeight: 700,
                  color: '#5A5850', cursor: 'pointer',
                }}
              >Подождать</button>
            </>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading || !canCreate}
              style={{
                width: '100%', padding: '13px',
                background: canCreate ? 'linear-gradient(135deg,#3A2A08,#5A4010)' : 'rgba(255,255,255,.04)',
                border: `.5px solid ${canCreate ? 'rgba(212,168,67,.5)' : 'rgba(255,255,255,.07)'}`,
                borderRadius: 14,
                fontFamily: 'Inter, sans-serif', fontSize: '.9rem', fontWeight: 900, letterSpacing: '.04em',
                color: canCreate ? '#F0C85A' : '#3A4052',
                cursor: canCreate && !loading ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.7 : 1,
                boxShadow: canCreate ? '0 4px 20px rgba(212,168,67,.18)' : 'none',
                transition: 'all .15s',
              }}
            >
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
