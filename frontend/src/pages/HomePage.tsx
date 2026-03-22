import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { FloatingCoins } from '@/components/ui/FloatingCoins';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { fmtBalance, fmtCountdown, leagueEmoji } from '@/utils/format';
import { AttemptsModal } from '@/components/ui/AttemptsModal';
import { ActiveSessionsModal } from '@/components/ui/ActiveSessionsModal';
import { getSocket } from '@/api/socket';
import { JarvisModal, JARVIS_LEVELS } from '@/components/ui/JarvisModal';
import { GameSetupModal } from '@/components/ui/GameSetupModal';
import type { JarvisLevel } from '@/components/ui/JarvisModal';
import { tasksApi, warsApi, puzzlesApi } from '@/api';
import type { Task } from '@/types';
import { useT } from '@/i18n/useT';

// SVG иконки для карточек разделов
const IcoJarvis = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <rect x="6" y="10" width="32" height="24" rx="6" fill="#3A3F58"/>
    <rect x="6" y="10" width="32" height="24" rx="6" stroke="#5A6080" strokeWidth="1.5"/>
    <circle cx="15" cy="21" r="3.5" fill="var(--red, #FF4D6A)"/>
    <circle cx="29" cy="21" r="3.5" fill="var(--red, #FF4D6A)"/>
    <circle cx="15" cy="21" r="1.5" fill="#FF8099"/>
    <circle cx="29" cy="21" r="1.5" fill="#FF8099"/>
    <rect x="14" y="27" width="16" height="3" rx="1.5" fill="#5A6080"/>
    <rect x="17" y="27" width="1.5" height="3" fill="#3A3F58"/>
    <rect x="21" y="27" width="1.5" height="3" fill="#3A3F58"/>
    <rect x="25" y="27" width="1.5" height="3" fill="#3A3F58"/>
    <rect x="20.5" y="4" width="3" height="7" rx="1.5" fill="#5A6080"/>
    <circle cx="22" cy="4" r="2" fill="var(--accent, #F5C842)"/>
    <rect x="2" y="17" width="4" height="8" rx="2" fill="#3A3F58" stroke="#5A6080" strokeWidth="1"/>
    <rect x="38" y="17" width="4" height="8" rx="2" fill="#3A3F58" stroke="#5A6080" strokeWidth="1"/>
  </svg>
);

const IcoBattle = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <line x1="8" y1="36" x2="36" y2="8" stroke="var(--text-secondary, #8B92A8)" strokeWidth="3.5" strokeLinecap="round"/>
    <line x1="36" y1="36" x2="8" y2="8" stroke="var(--text-secondary, #8B92A8)" strokeWidth="3.5" strokeLinecap="round"/>
    <rect x="5" y="33" width="9" height="4" rx="2" transform="rotate(-45 5 33)" fill="#6A7090"/>
    <rect x="30" y="5" width="9" height="4" rx="2" transform="rotate(-45 30 5)" fill="#6A7090"/>
    <rect x="33" y="33" width="9" height="4" rx="2" transform="rotate(45 33 33)" fill="#6A7090"/>
    <rect x="5" y="5" width="9" height="4" rx="2" transform="rotate(45 5 5)" fill="#6A7090"/>
  </svg>
);

const IcoTournament = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <path d="M14 8h16v16a8 8 0 01-16 0V8z" fill="var(--accent, #F5C842)" opacity="0.9"/>
    <path d="M10 10H14v8a4 4 0 01-4-4v-4z" fill="var(--accent, #F5C842)" opacity="0.5"/>
    <path d="M34 10H30v8a4 4 0 004-4v-4z" fill="var(--accent, #F5C842)" opacity="0.5"/>
    <rect x="19" y="24" width="6" height="8" rx="2" fill="#C8A030"/>
    <rect x="12" y="32" width="20" height="4" rx="2" fill="#C8A030"/>
  </svg>
);

const IcoWars = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <circle cx="22" cy="22" r="16" stroke="var(--text-secondary, #8B92A8)" strokeWidth="1.5" fill="none"/>
    <path d="M22 6 Q28 14 28 22 Q28 30 22 38 Q16 30 16 22 Q16 14 22 6z" fill="#5A6080"/>
    <path d="M6 22 Q14 16 22 16 Q30 16 38 22 Q30 28 22 28 Q14 28 6 22z" fill="#4A5070"/>
    <circle cx="22" cy="22" r="3" fill="var(--accent, #F5C842)"/>
  </svg>
);

const OnboardingTour: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const t = useT();
  const [step, setStep] = useState(0);
  const STEPS = t.home.onboarding;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'linear-gradient(135deg,#181B2E,#12162A)', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 28, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{s.icon}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent, #F5C842)', fontFamily: "'Unbounded',sans-serif", marginBottom: 12, lineHeight: 1.3 }}>{s.title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary, #C8CDDF)', lineHeight: 1.7, marginBottom: 24 }}>{s.desc}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {STEPS.map((_: unknown, i: number) => (
            <div key={i} style={{ width: i === step ? 18 : 7, height: 7, borderRadius: 4, background: i === step ? 'var(--accent, #F5C842)' : '#2A2F48', transition: 'all .25s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '12px 0', background: 'var(--bg-card, #1C2030)', color: 'var(--text-secondary, #8B92A8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← {t.common.back}</button>}
          <button onClick={() => isLast ? onDone() : setStep(s => s + 1)} style={{ flex: 1, padding: '12px 0', background: 'linear-gradient(90deg,#7B61FF,#9B85FF)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {isLast ? t.home.letsGo : t.home.next}
          </button>
        </div>
        <button onClick={onDone} style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--text-muted, #4A5270)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{t.home.skip}</button>
      </div>
    </div>
  );
};

export const HomePage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { sessions } = useGameStore();
  const [showAttempts, setShowAttempts] = useState(false);
  const [attemptTimer, setAttemptTimer] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('chesscoin_onboarding_done'));
  const [welcomeStep, setWelcomeStep] = useState<0|1|2>(0);
  const [startingBot, setStartingBot] = useState(false);
  // J1: showJarvis убран — GameSetupModal открывается напрямую
  const [showSessions, setShowSessions] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<JarvisLevel | null>(null);
  const [taskStats, setTaskStats] = useState<{ done: number; total: number; remaining: number } | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<any>(null);
  const [puzzleLoading, setPuzzleLoading] = useState(true);
  const [floatingAmount, setFloatingAmount] = useState<string | null>(null);
  const [myWar, setMyWar] = useState<any>(null);
  const [myCountry, setMyCountry] = useState<any>(null);

  const activeSessions = sessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'WAITING_FOR_OPPONENT');
  const myTurnSessions = activeSessions.filter(s => s.isMyTurn);

  const handleOnboardingDone = () => {
    localStorage.setItem('chesscoin_onboarding_done', '1');
    setShowOnboarding(false);
    setWelcomeStep(1);
    setTimeout(() => setWelcomeStep(2), 3500);
    setTimeout(() => setWelcomeStep(0), 7000);
  };

  useEffect(() => {
    if (!user || user.attempts >= user.maxAttempts) return;
    const secs = user?.nextRestoreSeconds ?? 0;
    if (!secs) return;
    let remaining = secs;
    setAttemptTimer(remaining);
    const iv = setInterval(() => { remaining = Math.max(0, remaining - 1); setAttemptTimer(remaining); }, 1000);
    return () => clearInterval(iv);
  }, [user?.nextRestoreSeconds, user?.attempts]);

  // Слушаем socket: balance:updated → показываем FloatingCoins
  useEffect(() => {
    const sock = getSocket();
    const handler = (data: { delta?: string; earned?: string }) => {
      const amt = data.delta ?? data.earned;
      if (amt && BigInt(amt) > 0n) {
        setFloatingAmount(amt);
      }
    };
    (sock as any).on('balance:updated', handler);
    return () => { (sock as any).off('balance:updated', handler); };
  }, []);

  const loadLiveData = useCallback(async () => {
    try {
      const r = await tasksApi.list();
      const tasks = r.tasks ?? [];
      const done = tasks.filter((t: Task) => t.completed).length;
      const remaining = tasks.filter((t: Task) => !t.completed).reduce((sum: number, t: Task) => sum + Number(t.reward ?? 0), 0);
      setTaskStats({ done, total: tasks.length, remaining });
    } catch {}
    try {
      const r = await warsApi.myCountry();
      setMyCountry(r.country);
      setMyWar(r.activeWar ?? null);
    } catch {}
    // Задача дня
    try {
      const r = await puzzlesApi.daily();
      setDailyPuzzle(r.puzzle);
    } catch {} finally {
      setPuzzleLoading(false);
    }
  }, []);

  useEffect(() => { loadLiveData(); }, [loadLiveData]);

  const jarvisLevel = user?.jarvisLevel ?? 1;
  const jarvisCfg = JARVIS_LEVELS[Math.max(0, Math.min(19, jarvisLevel - 1))];
  const militaryRank = user?.militaryRank?.name ?? 'Recruit';
  const militaryEmoji = user?.militaryRank?.emoji ?? '😊';
  const battles = user?.wins ?? 0;
  const rank = user?.rank ?? 1;

  // J1: сразу открываем GameSetupModal с текущим уровнем — JarvisModal убран из основного флоу
  const startBotGame = () => {
    if (!user || user.attempts <= 0) { setShowAttempts(true); return; }
    setSelectedLevel(jarvisCfg);  // устанавливаем текущий уровень сразу
  };

  const handleGameStart = (color: 'white' | 'black', timeMinutes: number) => {
    if (!selectedLevel || startingBot) return;
    setStartingBot(true);
    setSelectedLevel(null);
    getSocket().emit('game:create:bot', { color, botLevel: selectedLevel.level, timeSeconds: timeMinutes * 60 }, (res: { ok?: boolean; session?: { id: string }; error?: string }) => {
      setStartingBot(false);
      if (res?.ok && res?.session) {
        navigate('/game/' + res.session.id);
      } else if (res?.error) {
        // N2: показываем понятную ошибку вместо молчаливого выброса
        const errText = res.error.includes('Джарвис') || res.error.includes('бот')
          ? res.error
          : res.error.includes('лимит') || res.error.includes('максимум')
          ? res.error
          : 'Failed to start game. Try again later.';
        import('@/components/ui/Toast').then(({ toast }) => toast.error(errText));
      }
    });
    setTimeout(() => setStartingBot(false), 5000);
  };

  if (!user) return null;

  return (
    <PageLayout>
      {/* Hero */}
      <div style={heroStyle}>
        <div style={{ position: 'absolute', bottom: -12, right: 10, fontSize: 80, opacity: 0.04, color: '#9B85FF', pointerEvents: 'none', lineHeight: 1 }}>♟</div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, position: 'relative', zIndex: 1 }}>
          <Avatar user={user} size="l" gold />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.firstName}
              {myCountry && <span style={{ fontSize: 20 }}>{myCountry.flag}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 1 }}>@{user.username ?? 'unknown'}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={tagStyle('gold')}>{leagueEmoji[user.league] ?? '🥉'} #{rank}</span>
              <span style={tagStyle('vi')}>ELO {user.elo}</span>
            </div>
          </div>
          {/* JARVIS + Звание блок */}
          <div style={jarvisBlockStyle}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: '#6A7090', textTransform: 'uppercase' as const, marginBottom: 1 }}>JARVIS</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#9B85FF' }}>{jarvisCfg.name}</div>
            <div style={{ fontSize: 10, color: '#5A6080', marginBottom: 7 }}>Lv.{jarvisLevel} / 20</div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', color: '#6A7090', textTransform: 'uppercase' as const, marginBottom: 2 }}>RANK</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>{militaryEmoji} {militaryRank}</div>
            <div style={{ fontSize: 10, color: '#5A6080', marginTop: 2 }}>Battles: {battles}</div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border, rgba(255,255,255,0.07))', margin: '0 0 12px', position: 'relative', zIndex: 1 }} />

        {/* Баланс */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 10 }}>
          <div style={lblStyle}>BALANCE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--accent, #F5C842)', letterSpacing: '-.04em', lineHeight: 1 }}>
              {fmtBalance(user.balance)} <span style={{ fontSize: 13, opacity: 0.5 }}>ᚙ</span>
            </span>
            <button onClick={() => navigate('/shop')} style={shopInlineBtn}>🛍</button>
          </div>
        </div>

        {/* Стрик — визуальный виджет 7 дней */}
        {(user?.loginStreak ?? 0) >= 1 && (() => {
          const streak = user?.loginStreak ?? 0;
          const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const today = new Date().getDay(); // 0=вс
          const todayIdx = today === 0 ? 6 : today - 1;
          const nextBonus = streak < 3 ? 3 : streak < 7 ? 7 : 30;
          const bonusAmt = nextBonus === 3 ? '500' : nextBonus === 7 ? '2 000' : '10 000';
          return (
            <div style={{ marginBottom: 10, position: 'relative', zIndex: 1 }}>
              <div style={{ background: 'rgba(255,159,67,0.08)', border: '1px solid rgba(255,159,67,0.2)', borderRadius: 14, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FF9F43' }}>🔥 {streak} day(s) in a row</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>to +{bonusAmt} ᚙ: {nextBonus - (streak % nextBonus || nextBonus)} d.</span>
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
                  {days.map((day, i) => {
                    const filled = i <= todayIdx && streak > (todayIdx - i);
                    const isToday = i === todayIdx;
                    return (
                      <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{
                          width: '100%', height: 6, borderRadius: 3,
                          background: filled ? '#FF9F43' : 'rgba(255,255,255,0.08)',
                          boxShadow: isToday ? '0 0 6px rgba(255,159,67,0.6)' : 'none',
                          animation: isToday ? 'pulse 2s ease-in-out infinite' : 'none',
                        }} />
                        <span style={{ fontSize: 8, color: filled ? '#FF9F43' : 'var(--text-muted, #4A5270)', fontWeight: isToday ? 800 : 400 }}>{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Попытки */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={lblStyle}>ATTEMPTS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              {Array.from({ length: user.maxAttempts }).map((_, i) => (
                <span key={i} style={{ fontSize: 20, color: i < user.attempts ? 'var(--accent, #F5C842)' : '#2A2F48', filter: i < user.attempts ? 'drop-shadow(0 0 6px rgba(245,200,66,0.7))' : undefined }}>★</span>
              ))}
              {user.attempts < user.maxAttempts && (
                <button onClick={() => setShowAttempts(true)} style={attPlusStyle}>+</button>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {user.attempts < user.maxAttempts ? (
              <div onClick={() => setShowAttempts(true)} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 2, lineHeight: 1.4 }}>Next in:</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: 'var(--accent, #F5C842)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>⏱</span>{attemptTimer > 0 ? fmtCountdown(attemptTimer) : '...'}
                </div>
              </div>
            ) : (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-muted, #4A5270)' }}>⏱ 00:00</div>
            )}
          </div>
        </div>
      </div>

      {/* Активные игры */}
      {activeSessions.length > 0 && (
        <>
          <div style={secStyle}>{t.home.activeGames}</div>
          <div onClick={() => activeSessions.length === 1 ? navigate('/game/' + activeSessions[0].id) : setShowSessions(true)} style={{ ...stripStyle, borderColor: 'rgba(0,214,143,0.2)', background: 'linear-gradient(135deg,rgba(0,214,143,0.06),transparent)' }}>
            <span style={{ fontSize: 20 }}>⚔️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green, #00D68F)' }}>{activeSessions.length} {activeSessions.length === 1 ? t.home.activeSingle : t.home.activeMultiple}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>{myTurnSessions.length > 0 ? t.home.myTurn(myTurnSessions.length) : t.home.opponentTurn}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green, #00D68F)' }}>→</span>
          </div>
        </>
      )}

      {/* Война стран */}
      <div style={secStyle}>COUNTRY WARS</div>
      {myCountry ? (
        <div onClick={() => navigate('/wars')} style={{ ...stripStyle, borderColor: myWar ? 'rgba(245,200,66,0.18)' : 'var(--border, rgba(255,255,255,0.07))' }}>
          <span style={{ fontSize: 26 }}>{myCountry.flag}</span>
          <div style={{ flex: 1 }}>
            {myWar ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{myWar.attackerCountry?.flag} vs {myWar.defenderCountry?.flag}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>War in progress</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{myCountry.nameRu}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>{myCountry.memberCount ?? 1} Fighters · W: {myCountry.wins ?? 0}</div>
              </>
            )}
          </div>
          {myWar
            ? <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: 'var(--accent, #F5C842)' }}>{myWar.attackerWins}:{myWar.defenderWins}</span>
            : <span style={{ fontSize: 16, color: '#5A6080' }}>→</span>
          }
        </div>
      ) : (
        <div onClick={() => navigate('/wars')} style={stripStyle}>
          <span style={{ fontSize: 22 }}>🌍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>Join a country</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>Fight for your team</div>
          </div>
          <span style={{ fontSize: 16, color: '#5A6080' }}>→</span>
        </div>
      )}

      {/* Разделы */}
      <div style={secStyle}>SECTIONS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px' }}>
        <div onClick={startBotGame} style={{ ...gameCardStyle, opacity: startingBot ? 0.6 : 1 }}>
          <div style={cardIcoWrapper}><IcoJarvis /></div>
          <div style={cardTitle}>J.A.R.V.I.S</div>
          <div style={cardSub}>{jarvisCfg.name}</div>
          <span style={cardTag('#9B85FF', 'rgba(123,97,255,0.15)')}>MAX</span>
        </div>
        <div onClick={() => navigate('/battles')} style={gameCardStyle}>
          <div style={cardIcoWrapper}><IcoBattle /></div>
          <div style={cardTitle}>Battles</div>
          <div style={cardSub}>{t.home.battlesCard.sub}</div>
          <span style={cardTag('var(--red, #FF4D6A)', 'rgba(255,77,106,0.13)')}>PVP</span>
        </div>
        <div onClick={() => navigate('/tournaments')} style={gameCardStyle}>
          <div style={cardIcoWrapper}><IcoTournament /></div>
          <div style={cardTitle}>Tournaments</div>
          <div style={cardSub}>{t.home.tournamentsCard.sub}</div>
          <span style={cardTag('var(--accent, #F5C842)', 'rgba(245,200,66,0.13)')}>SOON</span>
        </div>
        <div onClick={() => navigate('/wars')} style={gameCardStyle}>
          <div style={cardIcoWrapper}><IcoWars /></div>
          <div style={cardTitle}>Wars</div>
          <div style={cardSub}>{t.home.warsCard.sub(myCountry?.nameRu ?? null)}</div>
          <span style={cardTag('var(--green, #00D68F)', 'rgba(0,214,143,0.12)')}>
            {myWar ? `${myWar.attackerWins}:${myWar.defenderWins}` : myCountry ? `${myCountry.wins ?? 0}W` : '→'}
          </span>
        </div>
      </div>

      {/* Задания */}
      <div style={secStyle}>{t.home.tasks}</div>
      <div onClick={() => navigate('/tasks')} style={{ ...stripStyle, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div style={{ flex: 1 }}>
          {taskStats ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>
                {taskStats.done} of {taskStats.total} completed{taskStats.remaining > 0 && ` · +${fmtBalance(taskStats.remaining)} ᚙ`}
              </div>
              <div style={{ fontSize: 11, color: taskStats.done === taskStats.total ? 'var(--green, #00D68F)' : 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                {taskStats.done === taskStats.total ? t.home.tasksAllDone : t.home.tasksClick}
              </div>
              <div style={{ height: 3, background: '#181B22', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0}%`, background: 'linear-gradient(90deg,#F5C842,#FFD966)', borderRadius: 2, transition: 'width .4s' }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)' }}>Loading...</div>
          )}
        </div>
      </div>

      {/* Модалы */}
      {showAttempts && <AttemptsModal user={user} onClose={() => setShowAttempts(false)} />}
      {/* N1: Модал выбора активной сессии */}
      {showSessions && (
        <ActiveSessionsModal
          sessions={activeSessions}
          onClose={() => setShowSessions(false)}
        />
      )}
      {/* J1: JarvisModal убран — GameSetupModal открывается сразу с текущим уровнем */}
      {selectedLevel && <GameSetupModal selectedLevel={selectedLevel} onStart={handleGameStart} onClose={() => setSelectedLevel(null)} />}
      {showOnboarding && <OnboardingTour onDone={handleOnboardingDone} />}
      {welcomeStep === 1 && (
        <div style={toastStyle('var(--accent, #F5C842)')}>
          <div style={{ fontSize: 36 }}>🎁</div>
          <div><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent, #F5C842)', marginBottom: 3 }}>Welcome bonus!</div><div style={{ fontSize: 12, color: 'var(--text-primary, #C8CDDF)' }}>You received <b style={{ color: 'var(--accent, #F5C842)' }}>5,000 ᚙ</b></div></div>
        </div>
      )}
      {welcomeStep === 2 && (
        <div style={toastStyle('#7B61FF')}>
          <div style={{ fontSize: 36 }}>⚡</div>
          <div><div style={{ fontSize: 14, fontWeight: 800, color: '#7B61FF', marginBottom: 3 }}>3 attempts per day</div><div style={{ fontSize: 12, color: 'var(--text-primary, #C8CDDF)' }}>+1 attempt every 8 hours</div></div>
        </div>
      )}

      {/* FloatingCoins — анимация +X ᚙ */}
      {floatingAmount && (
        <FloatingCoins amount={floatingAmount} onDone={() => setFloatingAmount(null)} />
      )}
    </PageLayout>
  );
};

// Styles
const heroStyle: React.CSSProperties = { margin: '6px 16px 0', padding: '16px', background: 'linear-gradient(135deg,#181B2E,#12162A)', border: '1px solid rgba(123,97,255,0.18)', borderRadius: 22, position: 'relative', overflow: 'hidden' };
const jarvisBlockStyle: React.CSSProperties = { background: 'rgba(30,34,52,0.95)', border: '1px solid rgba(123,97,255,0.22)', borderRadius: 14, padding: '10px 12px', minWidth: 96, flexShrink: 0 };
const shopInlineBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 10, background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.13)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, cursor: 'pointer' };
const attPlusStyle: React.CSSProperties = { width: 24, height: 24, borderRadius: '50%', background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)', fontSize: 16, fontWeight: 800, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
const stripStyle: React.CSSProperties = { margin: '4px 16px 0', padding: '13px 16px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' };
const gameCardStyle: React.CSSProperties = { background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '20px 16px 18px', cursor: 'pointer', textAlign: 'center' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' };
const cardIcoWrapper: React.CSSProperties = { width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 };
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 4 };
const cardSub: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary, #8B92A8)', marginBottom: 10 };
const cardTag = (color: string, bg: string): React.CSSProperties => ({ display: 'inline-block', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color, background: bg, border: `1px solid ${color}44` });
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase' as const, color: 'var(--text-muted, #4A5270)', padding: '16px 16px 8px' };
const lblStyle: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--text-muted, #4A5270)', marginBottom: 3 };
const toastStyle = (accent: string): React.CSSProperties => ({ position: 'fixed', bottom: 100, left: 16, right: 16, zIndex: 400, background: 'linear-gradient(135deg,#1C2030,#232840)', border: `1px solid ${accent}66`, borderRadius: 20, padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 14 });
const tagStyle = (type: 'gold' | 'vi'): React.CSSProperties => {
  const m = { gold: { background: 'rgba(245,200,66,0.12)', color: 'var(--accent, #F5C842)', borderColor: 'rgba(245,200,66,0.2)' }, vi: { background: 'rgba(123,97,255,0.12)', color: '#9B85FF', borderColor: 'rgba(123,97,255,0.2)' } };
  return { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' as const, border: '1px solid transparent', ...m[type] };
};
