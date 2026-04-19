import React from 'react';
import { ToastContainer } from '@/components/ui/Toast';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useGameStore } from '@/store/useGameStore';
import { useWarChallengeStore } from '@/store/useWarChallengeStore';
import { getSocket } from '@/api/socket';
import { WarChallengePopup } from '@/components/ui/WarChallengePopup';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useT } from '@/i18n/useT';
import type { Lang } from '@/i18n/translations';
import { applyThemeToCss, getActiveTheme, THEMES } from '@/lib/theme';
import { CoinIcon as CoinIconSplash } from '@/components/ui/CoinIcon';

// Q3: lazy loading — каждая страница загружается отдельным чанком
import { lazy, Suspense } from 'react';
const HomePage        = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })));
const BattlesPage     = lazy(() => import('@/pages/BattlesPage').then(m => ({ default: m.BattlesPage })));
const BattleHistoryPage = lazy(() => import('@/pages/BattleHistoryPage').then(m => ({ default: m.BattleHistoryPage })));
const GamePage        = lazy(() => import('@/pages/GamePage').then(m => ({ default: m.GamePage })));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })));
const NationsPage     = lazy(() => import('@/pages/NationsPage').then(m => ({ default: m.NationsPage })));
const WarsPage        = lazy(() => import('@/pages/WarsPage').then(m => ({ default: m.WarsPage })));
const ProfilePage     = lazy(() => import('@/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const TasksPage       = lazy(() => import('@/pages/TasksPage').then(m => ({ default: m.TasksPage })));
const ShopPage        = lazy(() => import('@/pages/ShopPage').then(m => ({ default: m.ShopPage })));
const ReferralsPage   = lazy(() => import('@/pages/ReferralsPage').then(m => ({ default: m.ReferralsPage })));
const TournamentsPage = lazy(() => import('@/pages/TournamentsPage').then(m => ({ default: m.TournamentsPage })));
const LessonPage      = lazy(() => import('@/pages/LessonPage').then(m => ({ default: m.LessonPage })));
const AdminPage        = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })));
const SettingsPage     = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PuzzleDailyPage  = lazy(() => import('@/pages/PuzzleDailyPage').then(m => ({ default: m.PuzzleDailyPage })));
const PuzzleLessonPage = lazy(() => import('@/pages/PuzzleLessonPage').then(m => ({ default: m.PuzzleLessonPage })));
const TransactionHistoryPage = lazy(() => import('@/pages/TransactionHistoryPage').then(m => ({ default: m.TransactionHistoryPage })));

const AppInner: React.FC = () => {
  useSocket();
  const navigate = useNavigate();
  const { warChallenge, setWarChallenge } = useWarChallengeStore();
  const { upsertSession } = useGameStore();
  const { user } = useUserStore();
  const { theme } = useSettingsStore();

  React.useEffect(() => {
    if (user?.equippedItems?.FONT) {
      const fontName = user.equippedItems.FONT.name;
      const fontMapping: Record<string, string> = {
        'Inter': "'Inter', sans-serif",
        'Roboto': "'Roboto', sans-serif",
        'Montserrat': "'Montserrat', sans-serif",
        'Playfair Display': "'Playfair Display', serif",
        'Comic Sans MS': "'Comic Sans MS', 'Comic Sans', cursive",
        'JetBrains Mono': "'JetBrains Mono', monospace",
      };
      const cssFont = fontMapping[fontName] || "'Inter', sans-serif";
      document.documentElement.style.setProperty('--font-main', cssFont);
    } else {
      document.documentElement.style.setProperty('--font-main', "'Inter', sans-serif");
    }
  }, [user?.equippedItems?.FONT?.name]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleAccept = () => {
    if (!warChallenge) return;
    const socket = getSocket();
    socket.emit('game:join', { code: warChallenge.sessionCode }, (res: Record<string,unknown>) => {
      if (res?.ok && res?.session) {
        const session = res.session as import('@/types').GameSession;
        upsertSession(session);
        navigate('/game/' + session.id);
      } else {
        navigate('/battles');
      }
    });
    setWarChallenge(null);
  };

  const handleDecline = () => setWarChallenge(null);

  return (
    <>
    <ToastContainer />
    {warChallenge && (
      <WarChallengePopup
        data={warChallenge}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    )}
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#0B0D11', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#F5C842', fontFamily: 'Unbounded,sans-serif', fontSize: 14 }}>♟ Loading...</div></div>}>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/battles" element={<BattlesPage />} />
      <Route path="/battles/history" element={<BattleHistoryPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="/game/:sessionId" element={<GamePage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/wars" element={<WarsPage />} />
      <Route path="/nations" element={<Navigate to="/wars" replace />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/profile/:userId" element={<ProfilePage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/referrals" element={<ReferralsPage />} />
      <Route path="/tournaments" element={<TournamentsPage />} />
      <Route path="/lesson/:puzzleId" element={<LessonPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/puzzle/daily" element={<PuzzleDailyPage />} />
      <Route path="/puzzle/:id" element={<PuzzleLessonPage />} />
      <Route path="/transactions" element={<TransactionHistoryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
};


// ── Splash экран загрузки ─────────────────────────────────────────────────────
const SplashScreen: React.FC = () => {
  const [phase, setPhase] = React.useState(0);
  const t = useT();
  const PHASES = [t.splash.connecting, t.splash.authorizing, t.splash.loading];

  React.useEffect(() => {
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 700);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0B0D11',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 24,
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: .7; } 50% { opacity: 1; } }
      `}</style>

      {/* Логотип */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg,#2A1F6A,#1A1540)',
          border: '2px solid rgba(245,200,66,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(123,97,255,0.25)',
          animation: 'pulse 2s ease-in-out infinite',
        }}><CoinIconSplash size={44} /></div>
        <div style={{
          fontFamily: "'Unbounded',sans-serif",
          fontSize: 22, fontWeight: 800, color: '#F5C842',
          letterSpacing: '-.02em',
          textShadow: '0 0 20px rgba(245,200,66,0.4)',
        }}>ChessCoin</div>
      </div>

      {/* Спиннер */}
      <div style={{
        width: 36, height: 36,
        border: '3px solid rgba(123,97,255,0.2)',
        borderTopColor: '#7B61FF',
        borderRadius: '50%',
        animation: 'spin 0.75s linear infinite',
      }} />

      {/* Фаза загрузки */}
      <div key={phase} style={{
        fontSize: 12, color: '#4A5270', fontWeight: 500,
        animation: 'fadeIn .3s ease',
        letterSpacing: '.03em',
      }}>
        {PHASES[phase]}
      </div>
    </div>
  );
};

const AuthErrorScreen: React.FC = () => {
  const t = useT();
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0B0D11',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12, padding: 24,
    }}>
      <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color: '#F5C842' }}>ChessCoin</div>
      <div style={{ fontSize: 13, color: '#8B92A8', textAlign: 'center' }}>
        {t.auth.openViaBot}
      </div>
      <a href="https://t.me/chessgamecoin_bot" style={{ marginTop: 8, padding: '12px 24px', background: '#F5C842', color: '#0B0D11', borderRadius: 14, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
        {t.auth.openBot}
      </a>
    </div>
  );
};

const App: React.FC = () => {
  useAuth(); // запускаем Telegram auth
  const setLang = useSettingsStore((s) => s.setLang);

  // Initialize theme on mount
  React.useEffect(() => {
    const key = getActiveTheme();
    applyThemeToCss(THEMES[key]);
  }, []);

  // Auto-detect language from Telegram WebApp on first load
  React.useEffect(() => {
    try {
      const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code as string | undefined;
      if (tgLang) {
        const lang: Lang = tgLang.startsWith('ru') ? 'ru' : 'en';
        // Only set if user hasn't manually chosen (check localStorage)
        const saved = localStorage.getItem('chesscoin-settings');
        if (!saved) setLang(lang);
      }
    } catch {}
  }, []);

  const { isLoading, isAuthenticated } = useUserStore();

    if (isLoading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <AuthErrorScreen />;
  }

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
