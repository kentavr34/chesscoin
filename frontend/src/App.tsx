import React from 'react';
import { ToastContainer } from '@/components/ui/Toast';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';
import type { Lang } from '@/i18n/translations';

import { HomePage } from '@/pages/HomePage';
import { BattlesPage } from '@/pages/BattlesPage';
import { GamePage } from '@/pages/GamePage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { NationsPage } from '@/pages/NationsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TasksPage } from '@/pages/TasksPage';
import { ShopPage } from '@/pages/ShopPage';
import { ReferralsPage } from '@/pages/ReferralsPage';
import { TournamentsPage } from '@/pages/TournamentsPage';

const AppInner: React.FC = () => {
  useSocket(); // подключаем сокет после аутентификации
  return (
    <>
    <ToastContainer />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/battles" element={<BattlesPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="/game/:sessionId" element={<GamePage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/wars" element={<NationsPage />} />
      <Route path="/nations" element={<Navigate to="/wars" replace />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/referrals" element={<ReferralsPage />} />
      <Route path="/tournaments" element={<TournamentsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
          fontSize: 36,
          boxShadow: '0 0 40px rgba(123,97,255,0.25)',
          animation: 'pulse 2s ease-in-out infinite',
        }}>♟</div>
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

  // Auto-detect language from Telegram WebApp on first load
  React.useEffect(() => {
    try {
      const tgLang = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code as string | undefined;
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
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
};

export default App;
