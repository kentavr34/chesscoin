import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useT } from '@/i18n/useT';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const t = useT();

  const TABS = [
    { path: '/',            icon: '♔', label: t.nav.play        },
    { path: '/battles',     icon: '⚔', label: t.nav.battles     },
    { path: '/wars',        icon: '🌍', label: t.nav.wars        },
    { path: '/tournaments', icon: '🏆', label: t.nav.tournaments },
    { path: '/profile',     icon: '👤', label: t.nav.profile     },
  ];

  return (
    <nav className="ui-card-glass" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      minHeight: '82px', // Responsive + safe-area
      paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))',
      borderRadius: '24px 24px 0 0', // Rounded top borders like native mobile
      border: '1px solid var(--border)',
      borderBottom: 'none',
      display: 'flex', alignItems: 'flex-start',
      padding: '12px 6px 0', zIndex: 'var(--z-nav)',
    }}>
      {TABS.map((tab) => {
        const active = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path);
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
                position: 'absolute', top: '-13px', left: '50%',
                transform: 'translateX(-50%)',
                width: 32, height: 3,
                background: 'var(--accent)',
                borderRadius: '0 0 4px 4px',
                boxShadow: 'var(--bottom-nav-active-shadow, 0 2px 8px rgba(245, 200, 66, 0.5))',
              }} />
            )}
            <span style={{
              fontSize: 20,
              color: active ? 'var(--accent, #F5C842)' : 'var(--text-muted, #7A8299)',
              transition: 'color .2s', height: 24,
              display: 'flex', alignItems: 'center',
            }}>
              {tab.icon}
            </span>
            <span className="font-mono" style={{
              fontSize: 10, fontWeight: 700,
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              letterSpacing: '.05em', marginTop: 4,
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
