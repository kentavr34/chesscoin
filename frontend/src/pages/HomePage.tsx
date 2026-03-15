import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { fmtBalance, fmtTime, fmtCountdown, leagueEmoji } from '@/utils/format';
import { AttemptsModal } from '@/components/ui/AttemptsModal';
import { getSocket } from '@/api/socket';
import { JarvisModal, JARVIS_LEVELS } from '@/components/ui/JarvisModal';
import { GameSetupModal } from '@/components/ui/GameSetupModal';
import type { JarvisLevel } from '@/components/ui/JarvisModal';
import { tasksApi, warsApi } from '@/api';

const ONBOARDING_STEPS = [
  { title: '👋 Добро пожаловать в ChessCoin!', desc: 'Играй в шахматы — зарабатывай монеты ᚙ. Победи J.A.R.V.I.S, участвуй в батлах и войнах стран!', icon: '♟' },
  { title: '🤖 J.A.R.V.I.S — твой первый противник', desc: '10 уровней сложности. Побеждай — получай монеты из эмиссии. Открывай новые уровни последовательно.', icon: '🤖' },
  { title: '⚔️ Батлы — PvP на ставку', desc: 'Ставь монеты против реального соперника. Победитель забирает 90% банка. ELO-рейтинг меняется только в батлах.', icon: '⚔️' },
  { title: '🌍 Войны стран', desc: 'Вступи в любую страну и сражайся за её сборную. Главнокомандующий — боец с наибольшим числом побед.', icon: '🌍' },
  { title: '💎 TON-интеграция', desc: 'Покупай и продавай монеты за TON-крипту. Подключи TON-кошелёк в разделе Магазин → TON.', icon: '💎' },
];

const OnboardingTour: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'linear-gradient(135deg,#181B2E,#12162A)', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 28, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{s.icon}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#F5C842', fontFamily: "'Unbounded',sans-serif", marginBottom: 12, lineHeight: 1.3 }}>{s.title}</div>
        <div style={{ fontSize: 13, color: '#C8CDDF', lineHeight: 1.7, marginBottom: 24 }}>{s.desc}</div>
        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 7, height: 7, borderRadius: 4, background: i === step ? '#F5C842' : '#2A2F48', transition: 'all .25s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '12px 0', background: '#1C2030', color: '#8B92A8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Назад
            </button>
          )}
          <button onClick={() => isLast ? onDone() : setStep(s => s + 1)} style={{ flex: 1, padding: '12px 0', background: 'linear-gradient(90deg,#7B61FF,#9B85FF)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {isLast ? '🚀 Начать играть!' : 'Далее →'}
          </button>
        </div>
        <button onClick={onDone} style={{ marginTop: 10, background: 'none', border: 'none', color: '#4A5270', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
          Пропустить
        </button>
      </div>
    </div>
  );
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { sessions } = useGameStore();
  const [showAttempts, setShowAttempts] = useState(false);
  const [attemptTimer, setAttemptTimer] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('chesscoin_onboarding_done'));

  const handleOnboardingDone = () => {
    localStorage.setItem('chesscoin_onboarding_done', '1');
    setShowOnboarding(false);
  };

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

  // Live данные: задания и война моей страны
  const [taskStats, setTaskStats] = useState<{ done: number; total: number; remaining: number } | null>(null);
  const [myWar, setMyWar] = useState<any>(null);
  const [myCountry, setMyCountry] = useState<any>(null);

  const loadLiveData = useCallback(async () => {
    // Задания
    try {
      const r = await tasksApi.list();
      const tasks = r.tasks ?? [];
      const done = tasks.filter((t: any) => t.completed).length;
      const remaining = tasks.filter((t: any) => !t.completed).reduce((sum: number, t: any) => sum + Number(t.reward ?? 0), 0);
      setTaskStats({ done, total: tasks.length, remaining });
    } catch {}
    // Моя страна и активная война
    try {
      const r = await warsApi.myCountry();
      setMyCountry(r.country);
      setMyWar(r.activeWar ?? null);
    } catch {}
  }, []);

  useEffect(() => { loadLiveData(); }, [loadLiveData]);

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

  // Inject coin animation CSS once
  useEffect(() => {
    const id = 'chesscoin-anim';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        @keyframes coinPop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes coinGlow {
          0%, 100% { text-shadow: 0 0 0px #F5C842; }
          50%       { text-shadow: 0 0 18px rgba(245,200,66,0.8); }
        }
        .coin-balance { animation: coinPop .45s cubic-bezier(.22,.68,0,1.2) both, coinGlow 2s ease-in-out 0.5s 2; }
      `;
      document.head.appendChild(style);
    }
  }, []);

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
            <div className="coin-balance" style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 28, fontWeight: 800, color: '#F5C842', letterSpacing: '-.04em', lineHeight: 1 }}>
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

        {/* Streak */}
        {((user as any).loginStreak ?? 0) >= 2 && (
          <div style={{ marginTop: 10, marginBottom: -2, position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#FF9F43', background: 'rgba(255,159,67,0.12)', padding: '3px 10px', borderRadius: 8, letterSpacing: '.04em' }}>
              🔥 {(user as any).loginStreak} дней подряд
            </span>
          </div>
        )}

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
          {/* Таймер восстановления попыток — всегда виден */}
          <div style={{ textAlign: 'right' }}>
            {user.attempts >= user.maxAttempts ? (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#4A5270' }}>
                ⏱ 00:00
              </div>
            ) : (
              <div
                onClick={() => setShowAttempts(true)}
                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#F5C842', cursor: 'pointer' }}
              >
                ⏱ {attemptTimer > 0 ? fmtCountdown(attemptTimer) : '...'}
                <div style={{ fontSize: 9, color: '#8B92A8', marginTop: 1 }}>до +1 ★</div>
              </div>
            )}
          </div>
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

      {/* Война моей страны */}
      <div style={secStyle}>Война стран</div>
      {myCountry ? (
        <div onClick={() => navigate('/wars')} style={{ ...stripStyle, borderColor: myWar ? 'rgba(245,200,66,0.2)' : 'rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 22 }}>{myCountry.flag}</span>
          <div style={{ flex: 1 }}>
            {myWar ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>
                  {myWar.attackerCountry?.flag} {myWar.attackerCountry?.nameRu} vs {myWar.defenderCountry?.flag} {myWar.defenderCountry?.nameRu}
                </div>
                <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>
                  Идёт война · нажми чтобы участвовать
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{myCountry.nameRu}</div>
                <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>
                  {myCountry.memberCount} бойцов · побед: {myCountry.wins}
                </div>
              </>
            )}
          </div>
          {myWar ? (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: '#F5C842' }}>
              {myWar.attackerWins}:{myWar.defenderWins}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: '#4A5270' }}>→</span>
          )}
        </div>
      ) : (
        <div onClick={() => navigate('/wars')} style={{ ...stripStyle }}>
          <span style={{ fontSize: 20 }}>🌍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>Вступи в страну</div>
            <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>Сражайся за свою сборную</div>
          </div>
          <span style={{ fontSize: 13, color: '#4A5270' }}>→</span>
        </div>
      )}

      {/* Разделы */}
      <div style={secStyle}>Разделы</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 18px' }}>
        {[
          { ico: '🤖', title: 'J.A.R.V.I.S', sub: JARVIS_LEVELS[Math.max(0, jarvisLevel - 1)].name, tag: `+${(JARVIS_LEVELS[Math.max(0, jarvisLevel - 1)].reward / 1000).toFixed(0)}K ᚙ`, tc: '#9B85FF', path: null, action: startBotGame },
          { ico: '⚔️', title: 'Батлы', sub: 'На ставку', tag: '5 LIVE', tc: '#FF4D6A', path: '/battles', action: null },
          { ico: '🏆', title: 'Турниры', sub: 'Чемпион месяца', tag: '2 открытых', tc: '#F5C842', path: '/tournaments', action: null },
          { ico: '🌍', title: 'Войны', sub: myCountry ? myCountry.nameRu : 'Выбери страну', tag: myWar ? `${myWar.attackerWins}:${myWar.defenderWins}` : myCountry ? `${myCountry.wins}П` : '→', tc: '#00D68F', path: '/wars', action: null },
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
          {taskStats ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>
                {taskStats.done} из {taskStats.total} выполнено
                {taskStats.remaining > 0 && ` · +${fmtBalance(taskStats.remaining)} ᚙ осталось`}
              </div>
              <div style={{ fontSize: 11, color: taskStats.done === taskStats.total ? '#00D68F' : '#8B92A8', marginTop: 2 }}>
                {taskStats.done === taskStats.total ? '✅ Все задания выполнены!' : 'Нажми, чтобы выполнить'}
              </div>
              <div style={{ height: 3, background: '#181B22', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0}%`, background: 'linear-gradient(90deg,#F5C842,#FFD966)', borderRadius: 2, transition: 'width .4s' }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#8B92A8' }}>Загрузка заданий...</div>
          )}
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
      {/* Onboarding tour — shown only on first visit */}
      {showOnboarding && <OnboardingTour onDone={handleOnboardingDone} />}
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
