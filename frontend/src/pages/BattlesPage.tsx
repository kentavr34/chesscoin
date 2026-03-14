import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { getSocket } from '@/api/socket';
import { fmtBalance, fmtTime } from '@/utils/format';
import type { BattleLobbyItem } from '@/types';

// Донат зрителя в батл
const donateToBattle = (sessionId: string, amount: string, cb: (ok: boolean) => void) => {
  const socket = getSocket();
  socket.emit('battle:donate', { sessionId, amount }, (res: any) => cb(res?.ok));
};

type Tab = 'active' | 'waiting';

export const BattlesPage: React.FC = () => {
  const navigate = useNavigate();
  const { battles, sessions, upsertSession } = useGameStore();
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('active');
  const [showCreate, setShowCreate] = useState(false);

  const activeSessions = sessions.filter((s) => s.status === 'IN_PROGRESS');
  const waitingSessions = battles; // из лобби сокета

  const handleJoin = (battle: BattleLobbyItem) => {
    const socket = getSocket();
    socket.emit('game:join', { code: battle.code }, (res) => {
      if (res.ok && res.session) {
        upsertSession(res.session);
        navigate('/game/' + res.session.id);
      } else {
        alert(res.error ?? 'Ошибка');
      }
    });
  };

  const rightAction = (
    <button onClick={() => setShowCreate(true)} style={tbaStyle}>＋</button>
  );

  return (
    <PageLayout title="Батлы" backTo="/" rightAction={rightAction}>
      {/* Сегментные вкладки */}
      <div style={segStyle}>
        <button style={segBtn(tab === 'active')} onClick={() => setTab('active')}>⚔ Активные</button>
        <button style={segBtn(tab === 'waiting')} onClick={() => setTab('waiting')}>⏳ Ожидают</button>
      </div>

      {tab === 'active' && (
        <>
          {activeSessions.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', fontSize: 13, padding: '32px 0' }}>
              Нет активных партий
            </div>
          )}
          {activeSessions.map((s, idx) => {
            const mySide = s.sides.find((sd) => sd.id === s.mySideId);
            const opSide = s.sides.find((sd) => sd.id !== s.mySideId);
            return (
              <div key={s.id} onClick={() => navigate('/game/' + s.id)} style={bcardStyle}>
                {idx === 0 && (
                  <div style={bhotStyle}>🔥 Топ ставка · Опубликовано в канале</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', padding: 14, gap: 8 }}>
                  <BPlayer user={mySide?.player} name={mySide?.player.firstName ?? 'Вы'} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#4A5270', letterSpacing: '.1em' }}>VS</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: '#F0F2F8' }}>
                      {fmtTime(mySide?.timeLeft ?? 300)}
                    </span>
                    <span style={{ fontSize: 10, color: '#4A5270', fontWeight: 600 }}>
                      {s.type === 'BOT' ? 'J.A.R.V.I.S' : 'БАТЛ'}
                    </span>
                  </div>
                  <BPlayer user={opSide?.player} name={opSide?.player.firstName ?? '?'} right />
                  {s.bet && (
                    <div style={{ textAlign: 'right', minWidth: 64 }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: '#F0F2F8' }}>
                        {fmtBalance(s.bet)}
                      </div>
                      <div style={{ fontSize: 10, color: '#8B92A8' }}>ᚙ</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: 11, color: '#8B92A8' }}>
                    {s.isMyTurn ? '▶ Ваш ход' : '⏳ Ход соперника'}
                  </span>
                  <button
                onClick={(e) => {
                  e.stopPropagation();
                  const amt = prompt('Сумма доната (ᚙ):');
                  if (amt && Number(amt) > 0) {
                    donateToBattle(s.id, amt, (ok) => {
                      if (ok) alert('Донат отправлен! Удачи в бою!');
                      else alert('Ошибка доната');
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
          <div style={secStyle}>Ожидают соперника</div>
          {waitingSessions.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', fontSize: 13, padding: '32px 0' }}>
              Нет ожидающих батлов
            </div>
          )}
          {waitingSessions.map((battle) => (
            <div key={battle.id} style={wcardStyle}>
              <Avatar user={battle.creator as any} size="m" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F2F8' }}>
                  {battle.creator?.firstName ?? 'Игрок'}
                </div>
                <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 3 }}>
                  {battle.duration / 60} мин · ELO {battle.creator?.elo ?? '?'}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={tagGold}>{fmtBalance(battle.bet)} ᚙ</span>
                  {(battle.spectatorCount ?? 0) > 0 && (
                    <span style={{ fontSize: 10, color: '#4A5270' }}>
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
const BPlayer: React.FC<{ user?: any; name: string; right?: boolean }> = ({ user, name, right }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 58 }}>
    <Avatar user={user} size="s" />
    <span style={{ fontSize: 11, fontWeight: 600, color: '#8B92A8', textAlign: 'center' }}>{name}</span>
    {user?.elo && <span style={{ fontSize: 10, color: '#4A5270' }}>ELO {user.elo}</span>}
  </div>
);

const CreateBattleModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const { upsertSession } = useGameStore();
  const [bet, setBet] = useState(10000);
  const [duration, setDuration] = useState(300);
  const [color, setColor] = useState<'white' | 'black' | 'random'>('random');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  const DURATIONS = [
    { label: '1 мин', value: 60 },
    { label: '3 мин', value: 180 },
    { label: '5 мин', value: 300 },
    { label: '10 мин', value: 600 },
    { label: '20 мин', value: 1200 },
    { label: '30 мин', value: 1800 },
  ];

  const { user } = useUserStore();

  const handleCreate = () => {
    setLoading(true);
    const socket = getSocket();
    const selectedColor = color === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : color;
    socket.emit('game:create:battle', {
      color: selectedColor,
      duration,
      bet: String(bet),
      isPrivate: !isPublic,
    }, (res) => {
      setLoading(false);
      if (res.ok && res.session) {
        upsertSession(res.session);
        onClose();
        // Для приватного батла — предлагаем поделиться
        if (!isPublic && res.session.code) {
          const myRef = (user as any)?.referralCode ?? user?.telegramId;
          const shareText = `⚔️ Вызываю тебя на шахматный батл!\n💰 Ставка: ${fmtBalance(String(bet))} ᚙ\n\nПрими вызов:`;
          const botUrl = `https://t.me/chessgamecoin_bot?start=battle_${res.session.code}_ref_${myRef}`;
          try {
            (window as any).Telegram?.WebApp?.openTelegramLink?.(
              `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(shareText)}`
            );
          } catch {}
        }
        navigate('/game/' + res.session.id);
      } else {
        alert(res.error ?? 'Ошибка создания батла');
      }
    });
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={overlayStyle}>
      <div style={modalStyle}>
        <div style={handleStyle} />
        <div style={modalTitle}>⚔ Создать батл</div>
        <div style={modalLbl}>Ставка</div>
        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 28, fontWeight: 800, color: '#F5C842', textAlign: 'center', margin: '8px 0 12px' }}>
          {fmtBalance(bet)} ᚙ
        </div>
        <input type="range" min={10000} max={5000000} step={10000} value={bet}
          onChange={(e) => setBet(Number(e.target.value))}
          style={{ width: '100%', marginBottom: 10, accentColor: '#F5C842' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {[10000, 50000, 100000, 500000].map((v) => (
            <button key={v} onClick={() => setBet(v)} style={chip(bet === v)}>{fmtBalance(v)}</button>
          ))}
        </div>
        <div style={modalLbl}>Контроль времени</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {DURATIONS.map((d) => (
            <button key={d.value} onClick={() => setDuration(d.value)} style={chip(duration === d.value)}>
              {d.label}
            </button>
          ))}
        </div>
        <div style={modalLbl}>Цвет</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['white', 'black', 'random'] as const).map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{ ...typeBtn, ...(color === c ? typeBtnActive : {}) }}>
              {c === 'white' ? '☀️ Белые' : c === 'black' ? '🌙 Чёрные' : '🎲 Случайно'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setIsPublic(true)} style={{ ...typeBtn, ...(isPublic ? typeBtnActive : {}) }}>🌍 Публичный</button>
          <button onClick={() => setIsPublic(false)} style={{ ...typeBtn, ...(!isPublic ? typeBtnActive : {}) }}>🔒 Приватный</button>
        </div>
        <button onClick={handleCreate} disabled={loading} style={{ ...buyBtn, opacity: loading ? .6 : 1 }}>
          {loading ? 'Создаём...' : 'Создать батл'}
        </button>
      </div>
    </div>
  );
};

// ── Styles ──
const segStyle: React.CSSProperties = {
  display: 'flex', margin: '4px 18px 10px',
  background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10, padding: 3,
};
const segBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: 8, border: 'none', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
  color: active ? '#F0F2F8' : '#8B92A8',
  background: active ? '#232840' : 'transparent',
  cursor: 'pointer', transition: 'all .2s',
});
const bcardStyle: React.CSSProperties = {
  margin: '0 18px 10px', background: '#1C2030',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
};
const bhotStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 14px',
  background: 'linear-gradient(90deg,rgba(245,200,66,0.1),transparent)',
  borderBottom: '1px solid rgba(245,200,66,0.1)',
  fontSize: 10, fontWeight: 700, color: '#F5C842', letterSpacing: '.06em', textTransform: 'uppercase',
};
const wcardStyle: React.CSSProperties = {
  margin: '0 18px 8px', background: '#1C2030',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, padding: 14,
  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
};
const fabStyle: React.CSSProperties = {
  position: 'fixed', bottom: 94, right: 18, width: 48, height: 48,
  borderRadius: '50%', background: '#F5C842', color: '#0B0D11',
  fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(245,200,66,0.4)', border: 'none', zIndex: 49,
};
const secStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: '#4A5270', padding: '16px 18px 8px',
};
const watchBtn: React.CSSProperties = {
  padding: '6px 12px', background: '#232840', color: '#F0F2F8',
  border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const acceptBtn: React.CSSProperties = {
  padding: '8px 14px', background: '#F5C842', color: '#0B0D11',
  border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const tagGold: React.CSSProperties = {
  display: 'inline-flex', padding: '3px 8px',
  background: 'rgba(245,200,66,0.12)', color: '#F5C842',
  borderRadius: 6, fontSize: 10, fontWeight: 700,
};
const tbaStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 11, background: '#1C2030',
  border: '1px solid rgba(255,255,255,0.13)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontSize: 16,
  cursor: 'pointer', color: '#8B92A8',
};
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'flex-end',
};
const modalStyle: React.CSSProperties = {
  width: '100%', background: '#161927', borderRadius: '24px 24px 0 0',
  padding: 20, borderTop: '1px solid rgba(255,255,255,0.13)',
  maxHeight: '85vh', overflowY: 'auto',
};
const handleStyle: React.CSSProperties = {
  width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px',
};
const modalTitle: React.CSSProperties = {
  fontFamily: 'Inter,sans-serif', fontSize: 17, fontWeight: 700, color: '#F0F2F8', marginBottom: 16,
};
const modalLbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#4A5270', letterSpacing: '.08em',
  textTransform: 'uppercase', marginBottom: 8,
};
const chip = (active: boolean): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', border: '1px solid',
  background: active ? 'rgba(245,200,66,0.12)' : '#232840',
  color: active ? '#F5C842' : '#8B92A8',
  borderColor: active ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)',
  fontFamily: 'inherit',
});
const typeBtn: React.CSSProperties = {
  flex: 1, padding: 11, borderRadius: 12, background: '#232840',
  color: '#8B92A8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.07)', transition: 'all .2s', textAlign: 'center',
  fontFamily: 'inherit',
};
const typeBtnActive: React.CSSProperties = {
  background: 'rgba(245,200,66,0.12)', color: '#F5C842',
  borderColor: 'rgba(245,200,66,0.3)',
};
const buyBtn: React.CSSProperties = {
  width: '100%', padding: '12px 18px', background: '#F5C842', color: '#0B0D11',
  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
