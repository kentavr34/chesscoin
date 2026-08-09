import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useT } from '@/i18n/useT';

// SVG иконки для нижней навигации
const NavIcoPlay = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    {/* Шахматная доска 2×2 */}
    <rect x="3" y="3" width="8" height="8" rx="1.5" fill={active ? '#D4A843' : '#5A6070'} opacity={active ? .95 : .75}/>
    <rect x="13" y="3" width="8" height="8" rx="1.5" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4" fill="none"/>
    <rect x="3" y="13" width="8" height="8" rx="1.5" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4" fill="none"/>
    <rect x="13" y="13" width="8" height="8" rx="1.5" fill={active ? '#D4A843' : '#5A6070'} opacity={active ? .95 : .75}/>
  </svg>
);

const NavIcoBattle = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M4 4l4 1.5-1.5 4" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 4l11 11" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="17" cy="17" r="2.5" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.3"/>
    <path d="M20 4l-4 1.5 1.5 4" stroke={active ? '#F0C85A' : '#5A6070'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 4L9 15" stroke={active ? '#F0C85A' : '#5A6070'} strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="7" cy="17" r="2.5" stroke={active ? '#F0C85A' : '#5A6070'} strokeWidth="1.3"/>
  </svg>
);

const NavIcoWars = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8.5" stroke={active ? '#3DBA7A' : '#5A6070'} strokeWidth="1.4"/>
    <ellipse cx="12" cy="12" rx="3.5" ry="8.5" stroke={active ? '#3DBA7A' : '#5A6070'} strokeWidth="1.2"/>
    <path d="M3.5 12h17M12 3.5c-2.5 2.5-2.5 5.5 0 8.5s2.5 6 0 8.5" stroke={active ? '#3DBA7A' : '#5A6070'} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const NavIcoTournament = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M8 3h8v7a4 4 0 01-8 0V3z" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M8 6H5a1.5 1.5 0 000 3h3M16 6h3a1.5 1.5 0 010 3h-3" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M12 14v4M9 20h6" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M10 7l1.5 1.5L14 6" stroke={active ? '#F0C85A' : '#5A6070'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const NavIcoProfile = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3.5" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4"/>
    <path d="M5 19c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

/** Обучение — пешка: с неё начинают учиться. */
const NavIcoLearn = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="6" r="2.6" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.5"/>
    <path d="M9.4 10.2h5.2l-1 2.4h-3.2l-1-2.4z" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M10.4 12.6c0 2.2-.7 3.9-1.6 5.2h6.4c-.9-1.3-1.6-3-1.6-5.2" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.3" strokeLinejoin="round"/>
    <rect x="6.6" y="17.8" width="10.8" height="2.4" rx="1.2" stroke={active ? '#F0C85A' : '#5A6070'} strokeWidth="1.4"/>
  </svg>
);

/** Задания — список с отметками. */
const NavIcoTasks = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4"/>
    <path d="M7.5 8.5l1.6 1.6 3-3.2" stroke={active ? '#F0C85A' : '#5A6070'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 14.5l1.6 1.6 3-3.2" stroke={active ? '#F0C85A' : '#5A6070'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.5 9h2.5M14.5 15h2.5" stroke={active ? '#D4A843' : '#5A6070'} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const t = useT();

  // Шесть кнопок (Кенан 09.08.2026). Обучение и задания РАЗВЕДЕНЫ: раньше
  // уроки жили внутри страницы заданий, и попасть в них можно было только
  // через неё — 300 уроков начали двое из ста одного.
  //
  // Профиль ушёл из ряда на аватар главной: семь кнопок на телефоне
  // становятся неразличимыми, а свой профиль до сих пор открывался ТОЛЬКО
  // отсюда, поэтому просто убрать его было нельзя.
  const TABS = [
    { path: '/',            Icon: NavIcoPlay,       label: t.nav.play        },
    { path: '/battles',     Icon: NavIcoBattle,     label: t.nav.battles     },
    { path: '/tournaments', Icon: NavIcoTournament, label: t.nav.tournaments },
    { path: '/wars',        Icon: NavIcoWars,       label: t.nav.wars        },
    { path: '/lessons',     Icon: NavIcoLearn,      label: t.nav.learn       },
    { path: '/tasks',       Icon: NavIcoTasks,      label: t.nav.tasks       },
  ];

  return (
    <nav className="ui-card-glass" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      minHeight: '82px', // Responsive + safe-area
      paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
      borderRadius: '24px 24px 0 0', // Rounded top borders like native mobile
      border: '1px solid var(--border)',
      borderBottom: 'none',
      display: 'flex', flexDirection: 'column',
      padding: '12px 4px 0', zIndex: 'var(--z-nav)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
      {TABS.map((tab) => {
        const active = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path);
        return (
          <div
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, padding: '6px 1px',
              cursor: 'pointer', borderRadius: 10, position: 'relative',
              transition: 'opacity .15s',
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
            <span style={{ height: 28, display: 'flex', alignItems: 'center', transition: 'filter .2s', filter: active ? 'drop-shadow(0 0 5px rgba(212,168,67,.5))' : 'none' }}>
              <tab.Icon active={active} />
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              letterSpacing: '.05em', marginTop: 4,
              transition: 'color .2s',
              fontFamily: 'Inter, sans-serif',
            }}>
              {tab.label}
            </span>
          </div>
        );
      })}
      </div>
    </nav>
  );
};
