import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';

const CARD_STYLE: React.CSSProperties = {
  background: 'linear-gradient(135deg,#141018,#0F0E18)',
  border: '.5px solid rgba(154,148,144,.22)',
  borderRadius: 16,
  margin: '0 .85rem',
  overflow: 'hidden',
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: '.58rem',
  fontWeight: 700,
  color: '#7A7875',
  textTransform: 'uppercase',
  letterSpacing: '.14em',
  padding: '.9rem .85rem .45rem',
};

const ROW_LABEL_STYLE: React.CSSProperties = {
  fontSize: '.9rem',
  fontWeight: 900,
  color: '#EAE2CC',
};

const ROW_HINT_STYLE: React.CSSProperties = {
  fontSize: '.78rem',
  color: '#9A9490',
  marginTop: 2,
};

// SVG иконки
const IconGlobe = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" stroke="#9A9490" strokeWidth="1.5"/>
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke="#9A9490" strokeWidth="1.5"/>
    <path d="M3 12h18" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconMoon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconVibrate = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="7" y="4" width="10" height="16" rx="2" stroke="#9A9490" strokeWidth="1.5"/>
    <path d="M4 8v8M20 8v8" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconVolume = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="#9A9490" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="8" r="4" stroke="#9A9490" strokeWidth="1.5"/>
    <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M12 2L4 6v6c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V6L12 2z" stroke="#9A9490" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M9 12l2 2 4-4" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" stroke="#9A9490" strokeWidth="1.5"/>
    <path d="M12 8v.5M12 11v5" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M9 18l6-6-6-6" stroke="#9A9490" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT();
  const s = t.profile.settings;
  const { lang, setLang, theme, setTheme } = useSettingsStore();
  const [vibration, setVibration] = useState(() => {
    const stored = localStorage.getItem('chesscoin-settings');
    if (stored) { try { return JSON.parse(stored).vibration !== false; } catch {} }
    return true;
  });

  const toggleVibration = () => {
    const next = !vibration;
    setVibration(next);
    const stored = localStorage.getItem('chesscoin-settings');
    const prev = stored ? JSON.parse(stored) : {};
    localStorage.setItem('chesscoin-settings', JSON.stringify({ ...prev, vibration: next }));
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const toggle = (on: boolean, onToggle: () => void) => (
    <div
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? 'rgba(212,168,67,.9)' : 'rgba(255,255,255,.10)',
        position: 'relative', cursor: 'pointer', transition: 'background .2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left .2s',
        boxShadow: on ? '0 0 6px rgba(212,168,67,.6)' : 'none',
      }} />
    </div>
  );

  const row = (icon: React.ReactNode, label: string, right: React.ReactNode, border = true) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '.78rem .85rem',
      borderBottom: border ? '.5px solid rgba(255,255,255,.07)' : 'none',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        {icon}
        <span style={ROW_LABEL_STYLE}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </div>
  );

  const sectionLabel = (title: string) => (
    <div style={SECTION_LABEL_STYLE}>{title}</div>
  );

  const disabledRow = (icon: React.ReactNode, label: string, hint: string, border = true) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '.78rem .85rem',
      borderBottom: border ? '.5px solid rgba(255,255,255,.07)' : 'none',
      opacity: 0.45, gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        {icon}
        <div>
          <div style={ROW_LABEL_STYLE}>{label}</div>
          <div style={ROW_HINT_STYLE}>{hint}</div>
        </div>
      </div>
      <span style={{
        fontSize: '.72rem', color: '#9A9490',
        background: 'rgba(255,255,255,.06)', borderRadius: 6, padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}>
        {s.soon}
      </span>
    </div>
  );

  return (
    <PageLayout title={s.title} onBack={() => navigate(-1)}>
      <div style={{ paddingBottom: 40, background: '#0D0D12', minHeight: '100%' }}>

        {sectionLabel(s.langInterface)}
        <div style={CARD_STYLE}>
          {row(
            <IconGlobe />,
            s.appLang,
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ru', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: '5px 14px', borderRadius: 8,
                  border: lang === l ? '.5px solid rgba(212,168,67,.4)' : '.5px solid rgba(255,255,255,.08)',
                  cursor: 'pointer',
                  background: lang === l ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.06)',
                  color: lang === l ? '#F0C85A' : '#9A9490',
                  fontWeight: 700, fontSize: '.78rem', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {row(
            <IconVibrate />,
            s.vibration,
            toggle(vibration, toggleVibration)
          )}
          {row(
            <IconMoon />,
            s.theme,
            <div style={{ display: 'flex', gap: 6 }}>
              {(['dark', 'light'] as const).map((th) => (
                <button key={th} onClick={() => toggleTheme()} disabled={theme === th} style={{
                  padding: '5px 14px', borderRadius: 8,
                  border: theme === th ? '.5px solid rgba(212,168,67,.4)' : '.5px solid rgba(255,255,255,.08)',
                  cursor: theme === th ? 'default' : 'pointer',
                  background: theme === th ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.06)',
                  color: theme === th ? '#F0C85A' : '#9A9490',
                  fontWeight: 700, fontSize: '.78rem', fontFamily: 'inherit',
                  opacity: 1,
                  transition: 'all .15s',
                }}>
                  {th === 'dark' ? s.themeDark : s.themeLight}
                </button>
              ))}
            </div>,
            false
          )}
        </div>

        {sectionLabel(s.account)}
        <div style={CARD_STYLE}>
          {disabledRow(<IconUser />, s.dob, s.dobHint)}
          {disabledRow(<IconUser />, s.email, s.emailHint)}
          {disabledRow(<IconUser />, s.phone, s.phoneHint)}
          {disabledRow(<IconShield />, s.biometric, s.biometricHint, false)}
        </div>

        {sectionLabel(s.security)}
        <div style={CARD_STYLE}>
          {disabledRow(<IconShield />, s.changePin, s.changePinHint)}
          {disabledRow(<IconShield />, s.twoFa, s.twoFaHint, false)}
        </div>

        {sectionLabel(s.about)}
        <div style={CARD_STYLE}>
          {row(
            <IconInfo />,
            s.version,
            <span style={{ fontSize: '.78rem', color: '#9A9490' }}>v7.2.0</span>
          )}
          {row(
            <IconInfo />,
            s.privacy,
            <IconChevron />,
            false
          )}
        </div>
      </div>
    </PageLayout>
  );
};
