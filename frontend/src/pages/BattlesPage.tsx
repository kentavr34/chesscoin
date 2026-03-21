import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout, InfoPopup, useInfoPopup } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
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

type Tab = 'active' | 'waiting';

export const BattlesPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { battles, sessions, upsertSession } = useGameStore();
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('active');
  const [showCreate, setShowCreate] = useState(false);

  // Инфо-попап при первом входе
  const info = useInfoPopup('battles', [...t.battles.info] as Parameters<typeof InfoPopup>[0]["slides"]);

  const activeSessions = sessions.filter((s) => s.status === 'IN_PROGRESS');
  const waitingSessions = battles; // из лобби сокета

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

  const rightAction = (
    <div style={{ display: 'flex', gap: 8 }}>
      {/* Кнопка (?) — инфо о батлах */}
      <button
        onClick={info.open}
        style={{ ...tbaStyle, color: 'var(--text-secondary, #8B92A8)', fontSize: 14, fontWeight: 700 }}
      >?</button>
      {/* Кнопка создания батла */}
      <button onClick={() => setShowCreate(true)} style={tbaStyle}>＋</button>
    </div>
  );

  return (
    <PageLayout title={t.battles.title} centered rightAction={rightAction}>
      {/* InfoPopup при первом входе */}
      {info.show && (
        <InfoPopup infoKey="battles" slides={[...t.battles.info] as Parameters<typeof InfoPopup>[0]["slides"]} onClose={info.close} />
      )}

      {/* Сегментные вкладки */}
      <div style={segStyle}>
        <button style={segBtn(tab === 'active')} onClick={() => setTab('active')}>{t.battles.tabActive}</button>
        <button style={segBtn(tab === 'waiting')} onClick={() => setTab('waiting')}>{t.battles.tabWaiting}</button>
      </div>

      {tab === 'active' && (
        <>
          {activeSessions.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', fontSize: 13, padding: '32px 0' }}>
              {t.battles.noActive}
            </div>
          )}
          {activeSessions.map((s, idx) => {
            const mySide = s.sides.find((sd) => sd.id === s.mySideId);
            const opSide = s.sides.find((sd) => sd.id !== s.mySideId);
            return (
              <div key={s.id} onClick={() => navigate('/game/' + s.id)} style={bcardStyle}>
                {idx === 0 && (
                  <div style={bhotStyle}>{t.battles.topStake}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', padding: 14, gap: 8 }}>
                  <BPlayer user={mySide?.player} name={mySide?.player.firstName ?? 'Вы'} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted, #4A5270)', letterSpacing: '.1em' }}>VS</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
                      {fmtTime(mySide?.timeLeft ?? 300)}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', fontWeight: 600 }}>
                      {s.type === 'BOT' ? t.battles.bot : t.battles.battle}
                    </span>
                  </div>
                  <BPlayer user={opSide?.player} name={opSide?.player.firstName ?? '?'} right />
                  {s.bet && (
                    <div style={{ textAlign: 'right', minWidth: 64 }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
                        {fmtBalance(s.bet)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>ᚙ</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)' }}>
                    {s.isMyTurn ? t.battles.myTurn : t.battles.opponentTurn}
                  </span>
                  <button
                onClick={(e) => {
                  e.stopPropagation();
                  const amt = prompt(t.battles.donatePrompt);
                  if (amt && Number(amt) > 0) {
                    donateToBattle(s.id, amt, (ok) => {
                      if (ok) showToast(t.battles.donateSent, 'info');
                      else showToast(t.battles.donateError, 'error');
                    });
                  }
                }}
                style={{ ...watchBtn, color: '#9B85FF', borderColor: 'rgba(123,97,255,0.3)', background: 'rgba(123,97,255,0.08)' }}
              >💸 Донат</button>
              <button style={watchBtn}>→</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === 'waiting' && (
        <>
          <div style={secStyle}>{/* waiting section */}</div>
          {waitingSessions.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', fontSize: 13, padding: '32px 0' }}>
              Нет ожидающих батлов
            </div>
          )}
          {waitingSessions.map((battle) => (
            <div key={battle.id} style={wcardStyle}>
              <Avatar user={battle.creator as import("@/types").UserPublic} size="m" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
                  {battle.creator?.firstName ?? t.battles.creator}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 3 }}>
                  {battle.duration / 60} мин · ELO {battle.creator?.elo ?? '?'}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={tagGold}>{fmtBalance(battle.bet)} ᚙ</span>
                  {(battle.spectatorCount ?? 0) > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>
                      👁 {battle.spectatorCount}
                    </span>
                  )}
                </div>
              </div>
              {battle.creator && user && battle.creator.elo !== user.elo && (
                <button onClick={() => handleJoin(battle)} style={acceptBtn}>
                  Принять
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {/* FAB */}
      <button onClick={() => setShowCreate(true)} style={fabStyle}>＋</button>

      {showCreate && <CreateBattleModal onClose={() => setShowCreate(false)} />}
    </PageLayout>
  );
};

// ── Sub components ──
const BPlayer: React.FC<{ user?: import("@/types").UserPublic; name: string; right?: boolean }> = ({ user, name, right }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 58 }}>
    <Avatar user={user} size="s" />
    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #8B92A8)', textAlign: 'center' }}>{name}</span>
    {user?.elo && <span style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>ELO {user.elo}</span>}
  </div>
);

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
    { label: '1 мин', value: 60, icon: '⚡' },
    { label: '3 мин', value: 180, icon: '🔥' },
    { label: '5 мин', value: 300, icon: '♟' },
    { label: '10 мин', value: 600, icon: '🎯' },
    { label: '20 мин', value: 1200, icon: '🏆' },
    { label: '30 мин', value: 1800, icon: '👑' },
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
    }, (res: Record<string,unknown>) => {
      setLoading(false);
      if (res.ok && res.session) {
        upsertSession(res.session);
        if (!isPublic && res.session.code) {
          const myRef = user?.referralCode ?? user?.telegramId;
          const shareText = `⚔️ Вызываю тебя на шахматный батл!\n💰 Ставка: ${fmtBalance(String(bet))} ᚙ\n\nПрими вызов:`;
          const botUrl = `https://t.me/chessgamecoin_bot?start=battle_${res.session.code}_ref_${myRef}`;
          try {
            window.Telegram?.WebApp?.openTelegramLink?.(
              `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(shareText)}`
            );
          } catch {}
          showToast('⚔️ Приватный батл создан! Отправь ссылку другу', 'info');
        } else {
          showToast('⚔️ Батл создан! Ожидаем соперника...', 'info');
        }
        onClose();
      } else {
        showToast(getErrText(res.error ?? ''), 'error');
      }
    });
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={bmOverlayStyle}>
      <div style={bmSheetStyle}>
        {/* Ручка + кнопка закрыть — без заголовка "Создать батл" */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={bmHandleStyle} />
          <button onClick={onClose} style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: '50%', background: 'var(--border, rgba(255,255,255,0.07))', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary, #8B92A8)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Ставка */}
        <div style={bmSectionLbl}>Ставка</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 800, color: 'var(--accent, #F5C842)', textAlign: 'center', marginBottom: 12 }}>
          {fmtBalance(bet)} ᚙ
        </div>

        {canCreate ? (
          <>
            <input
              type="range" min={MIN_BET} max={maxBet} step={1000} value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 12, accentColor: 'var(--accent, #F5C842)' }}
            />
            {/* Быстрый выбор — 4 кнопки в один ряд */}
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
                      padding: '8px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: '1px solid',
                      background: active ? 'rgba(245,200,66,0.12)' : 'var(--bg-card, #1C2030)',
                      color: unavailable ? '#3A3F58' : active ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)',
                      borderColor: active ? 'rgba(245,200,66,0.3)' : 'var(--border, rgba(255,255,255,0.07))',
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
          <div style={{ textAlign: 'center', color: 'var(--red, #FF4D6A)', fontSize: 13, padding: '8px 0 20px', marginBottom: 4 }}>
            Нужно минимум {fmtBalance(MIN_BET)} ᚙ для батла
          </div>
        )}

        {/* Цвет — 3 колонки как в GameSetupModal */}
        <div style={bmSectionLbl}>Выбор цвета</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {(['random', 'white', 'black'] as const).map((c) => (
            <button key={c} onClick={() => setColor(c)} style={bmColorBtn(color === c)}>
              <span style={{ fontSize: 22, display: 'block', marginBottom: 5 }}>
                {c === 'random' ? '🎲' : c === 'white' ? '♔' : '♚'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                {c === 'random' ? t.battles.colorRandom : c === 'white' ? t.battles.colorWhite : t.battles.colorBlack}
              </span>
            </button>
          ))}
        </div>

        {/* Время — 3×2 сетка как в GameSetupModal */}
        <div style={bmSectionLbl}>Контроль времени</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {DURATIONS.map((d) => (
            <button key={d.value} onClick={() => setDuration(d.value)} style={bmTimeBtn(duration === d.value)}>
              <span style={{ fontSize: 16, display: 'block', marginBottom: 2 }}>{d.icon}</span>
              {d.label}
            </button>
          ))}
        </div>

        {/* Публичный / Приватный */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setIsPublic(true)} style={bmTypeBtn(isPublic)}>{t.battles.public_}</button>
          <button onClick={() => setIsPublic(false)} style={bmTypeBtn(!isPublic)}>{t.battles.private_}</button>
        </div>

        {/* Кнопка создания */}
        <button
          onClick={handleCreate}
          disabled={loading || !canCreate}
          style={{
            width: '100%', padding: '18px 14px',
            background: canCreate ? 'var(--accent, #F5C842)' : '#2A2F48',
            border: 'none', borderRadius: 14,
            color: canCreate ? 'var(--bg, #0B0D11)' : 'var(--text-muted, #4A5270)',
            fontSize: 16, fontWeight: 800,
            cursor: canCreate && !loading ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1,
            boxShadow: canCreate ? '0 4px 20px rgba(245,200,66,0.25)' : 'none',
          }}
        >
          {loading ? t.battles.creating : t.battles.createBtn}
        </button>
      </div>
    </div>
  );
};

// ── Styles ──
const segStyle: React.CSSProperties = {
  display: 'flex', margin: '4px 18px 10px',
  background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10, padding: 3,
};
const segBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: 8, border: 'none', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
  color: active ? 'var(--text-primary, #F0F2F8)' : 'var(--text-secondary, #8B92A8)',
  background: active ? 'var(--bg-input, #232840)' : 'transparent',
  cursor: 'pointer', transition: 'all .2s',
});
const bcardStyle: React.CSSProperties = {
  margin: '0 18px 10px', background: 'var(--bg-card, #1C2030)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
};
const bhotStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 14px',
  background: 'linear-gradient(90deg,rgba(245,200,66,0.1),transparent)',
  borderBottom: '1px solid rgba(245,200,66,0.1)',
  fontSize: 10, fontWeight: 700, color: 'var(--accent, #F5C842)', letterSpacing: '.06em', textTransform: 'uppercase',
};
const wcardStyle: React.CSSProperties = {
  margin: '0 18px 8px', background: 'var(--bg-card, #1C2030)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, padding: 14,
  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
};
const fabStyle: React.CSSProperties = {
  position: 'fixed', bottom: 94, right: 18, width: 48, height: 48,
  borderRadius: '50%', background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)',
  fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(245,200,66,0.4)', border: 'none', zIndex: 49,
};
const secStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: 'var(--text-muted, #4A5270)', padding: '16px 18px 8px',
};
const watchBtn: React.CSSProperties = {
  padding: '6px 12px', background: 'var(--bg-input, #232840)', color: 'var(--text-primary, #F0F2F8)',
  border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const acceptBtn: React.CSSProperties = {
  padding: '8px 14px', background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)',
  border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const tagGold: React.CSSProperties = {
  display: 'inline-flex', padding: '3px 8px',
  background: 'rgba(245,200,66,0.12)', color: 'var(--accent, #F5C842)',
  borderRadius: 6, fontSize: 10, fontWeight: 700,
};
const tbaStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 11, background: 'var(--bg-card, #1C2030)',
  border: '1px solid rgba(255,255,255,0.13)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontSize: 16,
  cursor: 'pointer', color: 'var(--text-secondary, #8B92A8)',
};
// ── Стили модала создания батла (соответствует GameSetupModal) ──
const bmOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.70)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const bmSheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 480,
  background: 'var(--bg-card, #13161F)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderBottom: 'none',
  borderRadius: '24px 24px 0 0',
  padding: '16px 18px',
  paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
  maxHeight: '88vh', overflowY: 'auto',
};
const bmHandleStyle: React.CSSProperties = {
  width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '4px auto 0',
};
const bmSectionLbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: 'var(--text-muted, #4A5270)', marginBottom: 10,
};
const bmColorBtn = (active: boolean): React.CSSProperties => ({
  padding: '18px 8px', borderRadius: 14, cursor: 'pointer', minHeight: 76,
  background: active ? 'rgba(245,200,66,0.1)' : 'var(--bg-card, #1C2030)',
  border: `2px solid ${active ? 'var(--accent, #F5C842)' : 'var(--border, rgba(255,255,255,0.07))'}`,
  color: active ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)',
  textAlign: 'center', transition: 'all .15s', fontFamily: 'inherit',
  transform: active ? 'scale(1.04)' : 'scale(1)',
});
const bmTimeBtn = (active: boolean): React.CSSProperties => ({
  padding: '14px 8px', borderRadius: 12, cursor: 'pointer', minHeight: 68,
  background: active ? 'rgba(123,97,255,0.15)' : 'var(--bg-card, #1C2030)',
  border: `1px solid ${active ? 'rgba(123,97,255,0.4)' : 'var(--border, rgba(255,255,255,0.07))'}`,
  color: active ? '#9B85FF' : 'var(--text-secondary, #8B92A8)',
  fontSize: 13, fontWeight: 700, transition: 'all .15s', fontFamily: 'inherit',
  textAlign: 'center' as const,
});
const bmTypeBtn = (active: boolean): React.CSSProperties => ({
  padding: 12, borderRadius: 12, cursor: 'pointer',
  background: active ? 'rgba(245,200,66,0.1)' : 'var(--bg-card, #1C2030)',
  border: `1px solid ${active ? 'rgba(245,200,66,0.3)' : 'var(--border, rgba(255,255,255,0.07))'}`,
  color: active ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', textAlign: 'center' as const,
});
