import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TABS = [
  { path: '/',           icon: '♔', label: 'Играть'  },
  { path: '/battles',   icon: '⚔',  label: 'Батлы'   },
  { path: '/nations',   icon: '🌍', label: 'Сборные' },
  { path: '/leaderboard', icon: '🏆', label: 'Рейтинг' },
  { path: '/profile',   icon: '👤', label: 'Профиль' },
];

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 82,
      background: 'rgba(11,13,17,0.97)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'flex-start',
      padding: '10px 4px 0', zIndex: 50,
    }}>
      {TABS.map((tab) => {
        const active = tab.path === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.path);
        return (
          <div
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, padding: '6px 4px',
              cursor: 'pointer', borderRadius: 10, position: 'relative',
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: 24, height: 2,
                background: '#F5C842',
                borderRadius: '0 0 2px 2px',
              }} />
            )}
            <span style={{
              fontSize: 20,
              color: active ? '#F5C842' : '#7A8299',
              transition: 'color .2s',
              height: 24, display: 'flex', alignItems: 'center',
            }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 600,
              color: active ? '#F5C842' : '#7A8299',
              letterSpacing: '.03em', textTransform: 'uppercase',
              transition: 'color .2s',
            }}>
              {tab.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
};
