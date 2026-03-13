import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { fmtBalance, fmtTime, leagueEmoji } from '@/utils/format';
import { AttemptsModal } from '@/components/ui/AttemptsModal';
import { getSocket } from '@/api/socket';
import { JarvisModal, JARVIS_LEVELS } from '@/components/ui/JarvisModal';
import { GameSetupModal } from '@/components/ui/GameSetupModal';
import type { JarvisLevel } from '@/components/ui/JarvisModal';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { sessions } = useGameStore();
  const [showAttempts, setShowAttempts] = useState(false);
  const [attemptTimer, setAttemptTimer] = useState(0);

  const activeSessions = sessions.filter(
    (s) => s.status === 'IN_PROGRESS' || s.status === 'WAITING_FOR_OPPONENT'
  );
  const myTurnSessions = activeSessions.filter((s) => s.isMyTurn);

  useEffect(() => {
    if (!user || user.attempts >= user.maxAttempts) return;
    const secs = (user as any).nextRestoreSeconds ?? 0;
    if (!secs) return;
    let remaining = secs;
    setAttemptTimer(remaining);
    const t = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      setAttemptTimer(remaining);
    }, 1000);
    return () => clearInterval(t);
  }, [(user as any)?.nextRestoreSeconds, user?.attempts]);

  const [startingBot, setStartingBot] = useState(false);
  const [showJarvis, setShowJarvis] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<JarvisLevel | null>(null);

  // Текущий JARVIS уровень игрока (из user или дефолт 1)
  const jarvisLevel = (user as any)?.jarvisLevel ?? 1;

  const startBotGame = () => {
    if (!user || user.attempts <= 0) { setShowAttempts(true); return; }
    setShowJarvis(true);
  };

  const handleLevelSelect = (level: JarvisLevel) => {
    setSelectedLevel(level);
    setShowJarvis(false);
  };

  const handleGameStart = (color: 'white' | 'black', timeMinutes: number) => {
    if (!selectedLevel || startingBot) return;
    setStartingBot(true);
    setSelectedLevel(null);
    getSocket().emit('game:create:bot', {
      color,
      botLevel: selectedLevel.level,
      timeSeconds: timeMinutes * 60,
    } as any, (res: any) => {
      setStartingBot(false);
      if (res?.ok && res?.session) {
        navigate('/game/' + res.session.id);
      }
    });
    setTimeout(() => setStartingBot(false), 5000);
  };

  const rightAction = (
    <button onClick={() => navigate('/shop')} style={tbaStyle}>🛍</button>
  );

  return (
    <PageLayout logo rightAction={rightAction}>
      {/* Hero */}
      <div style={heroStyle}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 130, height: 130, background: 'radial-gradient(circle,rgba(123,97,255,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -8, right: 14, fontSize: 72, opacity: 0.05, color: '#9B85FF', pointerEvents: 'none', lineHeight: 1 }}>♟</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, position: 'relative', zIndex: 1 }}>
          <Avatar user={user} size="l" gold />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F2F8', letterSpacing: '-.02em' }}>{user.firstName}</div>
            <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>@{user.username ?? 'unknown'}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={tag('gold')}>{leagueEmoji[user.league]} #{1}</span>
              <span style={tag('vi')}>ELO {user.elo}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={lblStyle}>Баланс</div>
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 28, fontWeight: 800, color: '#F5C842', letterSpacing: '-.04em', lineHeight: 1 }}>
              {fmtBalance(user.balance)} <span style={{ fontSize: 14, opacity: .5 }}>ᚙ</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#4A5270', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>JARVIS</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#9B85FF' }}>
              {JARVIS_LEVELS[Math.max(0, jarvisLevel - 1)].name}
            </div>
            <div style={{ fontSize: 9, color: '#4A5270', marginTop: 2 }}>
              Lv.{jarvisLevel} / 10
            </div>
          </div>
        </div>

        {/* Попытки */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, position: 'relative', zIndex: 1 }}>
          <div>
            <div style={lblStyle}>Попытки</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: user.maxAttempts }).map((_, i) => (
                  <span key={i} style={{
                    fontSize: 18,
                    color: i < user.attempts ? '#F5C842' : '#2A2F48',
                    filter: i < user.attempts ? 'drop-shadow(0 0 5px rgba(245,200,66,0.7))' : undefined,
                  }}>★</span>
                ))}
              </div>
              {user.attempts < user.maxAttempts && (
                <button onClick={() => setShowAttempts(true)} style={attPlusStyle}>+</button>
              )}
            </div>
          </div>
          {user.attempts < user.maxAttempts && attemptTimer > 0 && (
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8B92A8' }}>
              ⏱ {fmtTime(attemptTimer)} до +1
            </div>
          )}
        </div>
      </div>

      {/* Активные сессии */}
      {activeSessions.length > 0 && (
        <>
          <div style={secStyle}>Активные сессии</div>
          <div onClick={() => navigate('/game')} style={{ ...stripStyle, borderColor: 'rgba(0,214,143,0.2)', background: 'linear-gradient(135deg,rgba(0,214,143,0.06),transparent)' }}>
            <span style={{ fontSize: 20 }}>⚔️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#00D68F' }}>
                {activeSessions.length} активн{activeSessions.length === 1 ? 'ая игра' : 'ые игры'}
              </div>
              <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>
                {myTurnSessions.length > 0 ? `${myTurnSessions.length} ожидают вашего хода` : 'Ход соперника'}
              </div>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#00D68F' }}>→</span>
          </div>
        </>
      )}

      {/* Клановая война */}
      <div style={secStyle}>Клановая война</div>
      <div onClick={() => navigate('/nations')} style={{ ...stripStyle, borderColor: 'rgba(245,200,66,0.15)' }}>
        <span style={{ fontSize: 20 }}>🇷🇺</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>Война с Бразилией · Раунд 3/5</div>
          <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>Казна: 128.5K ᚙ на кону</div>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#F5C842' }}>3:1</span>
      </div>

      {/* Разделы */}
      <div style={secStyle}>Разделы</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 18px' }}>
        {[
          { ico: '🤖', title: 'J.A.R.V.I.S', sub: JARVIS_LEVELS[Math.max(0, jarvisLevel - 1)].name, tag: `+${(JARVIS_LEVELS[Math.max(0, jarvisLevel - 1)].reward / 1000).toFixed(0)}K ᚙ`, tc: '#9B85FF', path: null, action: startBotGame },
          { ico: '⚔️', title: 'Батлы', sub: 'На ставку', tag: '5 LIVE', tc: '#FF4D6A', path: '/battles', action: null },
          { ico: '🏆', title: 'Турниры', sub: 'Чемпион месяца', tag: '2 открытых', tc: '#F5C842', path: '/battles', action: null },
          { ico: '🌍', title: 'Клановые войны', sub: 'Россия ведёт', tag: '3:1', tc: '#00D68F', path: '/nations', action: null },
        ].map((item) => (
          <div key={item.title} onClick={() => item.action ? item.action() : navigate(item.path!)} style={{...gameCardStyle, opacity: item.action && startingBot ? 0.6 : 1}}>
            <span style={{ fontSize: 32, marginBottom: 10, display: 'block' }}>{item.ico}</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F2F8', marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 8 }}>{item.sub}</div>
            <span style={{ ...tag('neutral'), color: item.tc }}>{item.tag}</span>
          </div>
        ))}
      </div>

      {/* Задания */}
      <div style={secStyle}>Задания</div>
      <div onClick={() => navigate('/tasks')} style={{ ...stripStyle, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>1 из 3 выполнено · +6,000 ᚙ осталось</div>
          <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>Обновление через 08:38</div>
          <div style={{ height: 3, background: '#181B22', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '33%', background: 'linear-gradient(90deg,#F5C842,#FFD966)', borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {showAttempts && <AttemptsModal user={user} onClose={() => setShowAttempts(false)} />}
      {showJarvis && (
        <JarvisModal
          currentJarvisLevel={jarvisLevel}
          onSelect={handleLevelSelect}
          onClose={() => setShowJarvis(false)}
        />
      )}
      {selectedLevel && (
        <GameSetupModal
          selectedLevel={selectedLevel}
          onStart={handleGameStart}
          onBack={() => { setSelectedLevel(null); setShowJarvis(true); }}
        />
      )}
    </PageLayout>
  );
};

// ── Styles ──
const heroStyle: React.CSSProperties = {
  margin: '6px 18px 0', padding: 18,
  background: 'linear-gradient(135deg,#181B2E 0%,#12162A 100%)',
  border: '1px solid rgba(123,97,255,0.18)',
  borderRadius: 22, position: 'relative', overflow: 'hidden',
};
const stripStyle: React.CSSProperties = {
  margin: '4px 18px 0', padding: '13px 16px',
  background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12,
  cursor: 'pointer', transition: 'border-color .18s',
};
const gameCardStyle: React.CSSProperties = {
  background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, padding: '18px 16px',
  cursor: 'pointer', textAlign: 'center', transition: 'all .22s',
};
const secStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: '#4A5270',
  padding: '16px 18px 8px',
};
const lblStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: '#4A5270', marginBottom: 3,
};
const attPlusStyle: React.CSSProperties = {
  width: 24, height: 24, borderRadius: '50%', background: '#F5C842',
  color: '#0B0D11', fontSize: 16, fontWeight: 800, border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0,
};
const tbaStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 11, background: '#1C2030',
  border: '1px solid rgba(255,255,255,0.13)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontSize: 16,
  cursor: 'pointer', color: '#8B92A8',
};

const tag = (type: 'gold' | 'vi' | 'gr' | 'rd' | 'neutral'): React.CSSProperties => {
  const map = {
    gold: { background: 'rgba(245,200,66,0.12)', color: '#F5C842', borderColor: 'rgba(245,200,66,0.2)' },
    vi:   { background: 'rgba(123,97,255,0.12)', color: '#9B85FF', borderColor: 'rgba(123,97,255,0.2)' },
    gr:   { background: 'rgba(0,214,143,0.10)',  color: '#00D68F', borderColor: 'rgba(0,214,143,0.2)' },
    rd:   { background: 'rgba(255,77,106,0.10)', color: '#FF4D6A', borderColor: 'rgba(255,77,106,0.2)' },
    neutral: { background: '#232840', color: '#8B92A8', borderColor: 'rgba(255,255,255,0.07)' },
  };
  return {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '3px 8px', borderRadius: 6, fontSize: 10,
    fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
    border: '1px solid transparent', ...map[type],
  };
};
