import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';

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

  const row = (label: string, right: React.ReactNode, border = true) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px',
      borderBottom: border ? '1px solid #1C2030' : 'none',
    }}>
      <span style={{ fontSize: 14, color: '#E8EAF0', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </div>
  );

  const toggle = (on: boolean, onToggle: () => void) => (
    <div onClick={onToggle} style={{
      width: 44, height: 24, borderRadius: 12, background: on ? '#7B61FF' : '#2A2D3A',
      position: 'relative', cursor: 'pointer', transition: 'background .2s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left .2s',
      }} />
    </div>
  );

  const sectionTitle = (title: string) => (
    <div style={{ padding: '20px 16px 8px', fontSize: 11, color: '#6B7494', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
      {title}
    </div>
  );

  const disabledRow = (label: string, hint: string) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderBottom: '1px solid #1C2030', opacity: 0.45,
    }}>
      <div>
        <div style={{ fontSize: 14, color: '#E8EAF0', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#A8B0C8', marginTop: 2 }}>{hint}</div>
      </div>
      <span style={{ fontSize: 11, color: '#6B7494', background: '#1C2030', borderRadius: 6, padding: '2px 8px' }}>
        {s.soon}
      </span>
    </div>
  );

  return (
    <PageLayout title={s.title} onBack={() => navigate(-1)}>
      <div style={{ paddingBottom: 40 }}>
        {sectionTitle(s.langInterface)}
        <div style={{ background: '#13161E', borderRadius: 16, margin: '0 16px' }}>
          {row(s.appLang,
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ru', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: '4px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: lang === l ? '#7B61FF' : '#1C2030',
                  color: lang === l ? '#fff' : '#A8B0C8',
                  fontWeight: 600, fontSize: 13,
                }}>
                  {l === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
                </button>
              ))}
            </div>
          )}
          {row(s.vibration, toggle(vibration, toggleVibration))}
          {row(s.theme,
            <div style={{ display: 'flex', gap: 6 }}>
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} onClick={() => toggleTheme()} disabled={theme === t} style={{
                  padding: '4px 14px', borderRadius: 8, border: 'none', cursor: theme === t ? 'default' : 'pointer',
                  background: theme === t ? '#7B61FF' : '#1C2030',
                  color: theme === t ? '#fff' : '#A8B0C8',
                  fontWeight: 600, fontSize: 13,
                  opacity: theme === t ? 1 : 0.6,
                }}>
                  {t === 'dark' ? '🌙' : '☀️'} {t === 'dark' ? s.themeDark : s.themeLight}
                </button>
              ))}
            </div>
          , false)}
        </div>

        {sectionTitle(s.account)}
        <div style={{ background: '#13161E', borderRadius: 16, margin: '0 16px' }}>
          {disabledRow(s.dob, s.dobHint)}
          {disabledRow(s.email, s.emailHint)}
          {disabledRow(s.phone, s.phoneHint)}
          {disabledRow(s.biometric, s.biometricHint)}
        </div>

        {sectionTitle(s.security)}
        <div style={{ background: '#13161E', borderRadius: 16, margin: '0 16px' }}>
          {disabledRow(s.changePin, s.changePinHint)}
          {disabledRow(s.twoFa, s.twoFaHint)}
        </div>

        {sectionTitle(s.about)}
        <div style={{ background: '#13161E', borderRadius: 16, margin: '0 16px' }}>
          {row(s.version, <span style={{ fontSize: 13, color: '#A8B0C8' }}>v7.2.0</span>)}
          {row(s.privacy,
            <span style={{ fontSize: 18, color: '#6B7494' }}>›</span>, false
          )}
        </div>
      </div>
    </PageLayout>
  );
};
