import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout, InfoPopup, useInfoPopup } from '@/components/layout/PageLayout';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
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

  const info = useInfoPopup('battles', [...t.battles.info] as Parameters<typeof InfoPopup>[0]["slides"]);

  // Live — активные публичные IN_PROGRESS (показываются вверху публичного списка)
  const liveSessions = sessions.filter((s) => s.status === 'IN_PROGRESS');

  // Ожидающие — публичные, отсортированные по ставке (desc)
  const waitingSessions = [...battles].sort((a, b) => {
    const betA = BigInt(a.bet || '0');
    const betB = BigInt(b.bet || '0');
    return betB > betA ? 1 : betB < betA ? -1 : 0;
  });

  // Приватные — мои ожидающие вызовы
  const myPrivateSessions = sessions.filter((s) => s.status === 'WAITING_FOR_OPPONENT');

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
      onClick={() => navigate('/battle-history')}
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
            flex: 1, padding: '9px 12px',
            borderRadius: 12, fontSize: '.75rem', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
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
            flex: 1, padding: '9px 12px',
            borderRadius: 12, fontSize: '.75rem', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
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
        onClick={() => setShowCreate(true)}
        style={{
          position: 'fixed',
          bottom: 'max(80px, calc(70px + env(safe-area-inset-bottom, 14px)))',
          right: 18, width: 50, height: 50,
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

      {showCreate && <CreateBattleModal onClose={() => setShowCreate(false)} />}
    </PageLayout>
  );
};

// ── Sub components ──
const MIN_BET = 10000;

const CreateBattleModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const t = useT();
  const { upsertSession } = useGameStore();
  const { user } = useUserStore();

  // Максимальная ставка = баланс пользователя (но не меньше MIN_BET и не больше 5M)
  const userBalance = Number(BigInt(user?.balance ?? '0'));
  const maxBet = Math.max(MIN_BET, Math.min(userBalance, 5_000_000));
  const canCreate = userBalance >= MIN_BET;

  const [bet, setBet] = useState(Math.min(MIN_BET, maxBet));
  const [duration, setDuration] = useState(300);
  const [color, setColor] = useState<'white' | 'black' | 'random'>('random');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  const DURATIONS = [
    { label: t.battles.duration1m, value: 60, icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M11 2L4 11h5.5l-1 7 7-9.5H10z"/></svg> },
    { label: t.battles.duration3m, value: 180, icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 2c0 0 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.8-2.8 1.5-3.5C7.5 8.5 9 9.5 10 9.5s2.5-1.5 1.5-4C11 4.5 10 2 10 2z" fill="currentColor"/></svg> },
    { label: t.battles.duration5m, value: 300, icon: <span style={{ fontSize: 14, lineHeight: 1 }}>♟</span> },
    { label: t.battles.duration10m, value: 600, icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.8"/><circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/></svg> },
    { label: t.battles.duration20m, value: 1200, icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 2h10v7a5 5 0 0 1-10 0V2Z" stroke="currentColor" strokeWidth="1.5"/><path d="M2 3h3M15 3h3M2 3a2 2 0 0 0 0 4h3M18 3a2 2 0 0 1 0 4h-3M10 14v2M7 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { label: t.battles.duration30m, value: 1800, icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M2 14L4.5 7l3.5 3.5L10 6l2 4.5L15.5 7 18 14H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><line x1="2" y1="16" x2="18" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  ];

  const QUICK_BETS = [10000, 50000, 100000, 500000];

  const handleCreate = () => {
    if (!canCreate) {
      showToast(t.battles.insufficientBalance(fmtBalance(MIN_BET)), 'error');
      return;
    }
    setLoading(true);
    const socket = getSocket();
    const selectedColor = color === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : color;
    socket.emit('game:create:battle', {
      color: selectedColor,
      duration,
      bet: String(bet),
      isPrivate: !isPublic,
    }, (res: any) => {
      setLoading(false);
      if (res.ok && res.session) {
        upsertSession(res.session);
        if (!isPublic && res.session.code) {
          const myRef = user?.referralCode ?? user?.telegramId;
          const shareText = t.battles.challengeShare(fmtBalance(String(bet)));
          const botUrl = `https://t.me/chessgamecoin_bot?start=battle_${res.session.code}_ref_${myRef}`;
          try {
            navigator.clipboard?.writeText(botUrl).catch(() => {});
          } catch {}
          try {
            window.Telegram?.WebApp?.openTelegramLink?.(
              `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(shareText)}`
            );
          } catch {}
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

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'linear-gradient(180deg,#141018 0%,#0F0E18 100%)',
        border: '.5px solid rgba(212,168,67,.18)',
        borderBottom: 'none',
        borderRadius: '24px 24px 0 0',
        padding: '16px .85rem',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
        maxHeight: '88vh', overflowY: 'auto',
      }}>
        {/* Ручка + кнопка закрыть */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
          <div style={{
            width: 36, height: 4,
            background: 'rgba(212,168,67,.25)',
            borderRadius: 2, margin: '4px auto 0',
          }} />
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', width: 44, height: 44,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.06)',
              border: '.5px solid rgba(255,255,255,.1)',
              color: '#7A7875', fontSize: 16,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Ставка */}
        <div style={bmSectionLbl}>{t.battles.betLabel}</div>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: '1.85rem', fontWeight: 800,
          color: '#D4A843', textAlign: 'center',
          marginBottom: 12,
        }}>
          {fmtBalance(bet)} ᚙ
        </div>

        {canCreate ? (
          <>
            <input
              type="range" min={MIN_BET} max={maxBet} step={1000} value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 12, accentColor: '#D4A843' }}
            />
            {/* Быстрый выбор — 4 кнопки */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 20 }}>
              {QUICK_BETS.map((v) => {
                const capped = Math.min(v, maxBet);
                const active = bet === capped && bet === v;
                const unavailable = v > maxBet;
                return (
                  <button
                    key={v}
                    onClick={() => setBet(capped)}
                    style={{
                      padding: '8px 4px', borderRadius: 10,
                      fontSize: '.68rem', fontWeight: 700,
                      cursor: 'pointer',
                      background: active ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.04)',
                      color: unavailable ? '#3A3025' : active ? '#F0C85A' : '#7A7875',
                      border: active ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.08)',
                      fontFamily: 'inherit', textAlign: 'center' as const,
                    }}
                  >
                    {fmtBalance(v)}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{
            textAlign: 'center', color: '#FF4D6A',
            fontSize: '.8rem', padding: '8px 0 20px', marginBottom: 4,
          }}>
            {t.battles.needMin(fmtBalance(MIN_BET))}
          </div>
        )}

        {/* Публичный / Приватный — ПЕРВЫМ после ставки */}
        <div style={bmSectionLbl}>{t.battles.visibility ?? 'ВИДИМОСТЬ'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setIsPublic(true)}
            style={{
              padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
              background: isPublic ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.03)',
              border: isPublic ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.08)',
              color: isPublic ? '#F0C85A' : '#9A9490',
              fontSize: '.75rem', fontWeight: 700,
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
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
            {t.battles.public_}
          </button>
          <button
            onClick={() => setIsPublic(false)}
            style={{
              padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
              background: !isPublic ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.03)',
              border: !isPublic ? '.5px solid rgba(212,168,67,.35)' : '.5px solid rgba(255,255,255,.08)',
              color: !isPublic ? '#F0C85A' : '#9A9490',
              fontSize: '.75rem', fontWeight: 700,
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {t.battles.private_}
          </button>
        </div>

        {/* Цвет — 3 колонки */}
        <div style={bmSectionLbl}>{t.battles.colorChoice}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {(['random', 'white', 'black'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                padding: '18px 8px', borderRadius: 14,
                cursor: 'pointer', minHeight: 76,
                background: color === c ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.03)',
                border: color === c ? '.5px solid rgba(212,168,67,.5)' : '.5px solid rgba(255,255,255,.08)',
                color: color === c ? '#F0C85A' : '#7A7875',
                textAlign: 'center' as const,
                transition: 'all .15s', fontFamily: 'inherit',
                transform: color === c ? 'scale(1.04)' : 'scale(1)',
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
              }}
            >
              {c === 'random' ? (
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="2" width="16" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.6"/>
                  <circle cx="6.5" cy="6.5" r="1.2" fill="currentColor"/>
                  <circle cx="13.5" cy="6.5" r="1.2" fill="currentColor"/>
                  <circle cx="6.5" cy="13.5" r="1.2" fill="currentColor"/>
                  <circle cx="13.5" cy="13.5" r="1.2" fill="currentColor"/>
                  <circle cx="10" cy="10" r="1.2" fill="currentColor"/>
                </svg>
              ) : (
                <span style={{ fontSize: 22, lineHeight: 1 }}>{c === 'white' ? '♔' : '♚'}</span>
              )}
              <span style={{ fontSize: '.68rem', fontWeight: 700 }}>
                {c === 'random' ? t.battles.colorRandom : c === 'white' ? t.battles.colorWhite : t.battles.colorBlack}
              </span>
            </button>
          ))}
        </div>

        {/* Время — 3×2 сетка */}
        <div style={bmSectionLbl}>{t.battles.timeControl}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              style={{
                padding: '14px 8px', borderRadius: 12,
                cursor: 'pointer', minHeight: 68,
                background: duration === d.value ? 'rgba(123,97,255,.15)' : 'rgba(255,255,255,.03)',
                border: duration === d.value ? '.5px solid rgba(123,97,255,.4)' : '.5px solid rgba(255,255,255,.08)',
                color: duration === d.value ? '#9B85FF' : '#7A7875',
                fontSize: '.78rem', fontWeight: 700,
                transition: 'all .15s', fontFamily: 'inherit',
                textAlign: 'center' as const,
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.icon}</span>
              {d.label}
            </button>
          ))}
        </div>

        {/* Кнопка создания */}
        <button
          onClick={handleCreate}
          disabled={loading || !canCreate}
          style={{
            width: '100%', padding: '18px 14px',
            background: canCreate
              ? 'linear-gradient(135deg,#D4A843,#F0C85A)'
              : 'rgba(255,255,255,.06)',
            border: canCreate ? 'none' : '.5px solid rgba(255,255,255,.08)',
            borderRadius: 14,
            color: canCreate ? '#0D0D12' : '#3A3025',
            fontSize: '1rem', fontWeight: 800,
            cursor: canCreate && !loading ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1,
            boxShadow: canCreate ? '0 4px 20px rgba(212,168,67,.30)' : 'none',
            transition: 'all .15s',
          }}
        >
          {loading ? t.battles.creating : t.battles.createBtn}
        </button>
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
