import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT();
  const { lang, setLang } = useSettingsStore();
  const [vibration, setVibration] = useState(() => {
    const s = localStorage.getItem('chesscoin-settings');
    if (s) { try { return JSON.parse(s).vibration !== false; } catch {} }
    return true;
  });

  const toggleVibration = () => {
    const next = !vibration;
    setVibration(next);
    const s = localStorage.getItem('chesscoin-settings');
    const prev = s ? JSON.parse(s) : {};
    localStorage.setItem('chesscoin-settings', JSON.stringify({ ...prev, vibration: next }));
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
    <div style={{ padding: '20px 16px 8px', fontSize: 11, color: '#4A5270', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
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
        <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>{hint}</div>
      </div>
      <span style={{ fontSize: 11, color: '#4A5270', background: '#1C2030', borderRadius: 6, padding: '2px 8px' }}>
        Скоро
      </span>
    </div>
  );

  return (
    <PageLayout title="Настройки" onBack={() => navigate(-1)}>
      <div style={{ paddingBottom: 40 }}>
        {sectionTitle('Язык и интерфейс')}
        <div style={{ background: '#13161E', borderRadius: 16, margin: '0 16px' }}>
          {row('Язык приложения',
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ru', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: '4px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: lang === l ? '#7B61FF' : '#1C2030',
                  color: lang === l ? '#fff' : '#8B92A8',
                  fontWeight: 600, fontSize: 13,
                }}>
                  {l === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
                </button>
              ))}
            </div>
          )}
          {row('Вибрация', toggle(vibration, toggleVibration), false)}
        </div>

        {sectionTitle('Аккаунт')}
        <div style={{ background: '#13161E', borderRadius: 16, margin: '0 16px' }}>
          {disabledRow('Дата рождения', 'Для персонализации контента')}
          {disabledRow('Email', 'Привязать почту для восстановления')}
          {disabledRow('Телефон', 'Дополнительная защита')}
          {disabledRow('Face ID / Touch ID', 'Биометрический вход', )}
        </div>

        {sectionTitle('Безопасность')}
        <div style={{ background: '#13161E', borderRadius: 16, margin: '0 16px' }}>
          {disabledRow('Сменить пароль', 'Установить PIN-код')}
          {disabledRow('Двухфакторная аутентификация', '2FA через Telegram')}
        </div>

        {sectionTitle('О приложении')}
        <div style={{ background: '#13161E', borderRadius: 16, margin: '0 16px' }}>
          {row('Версия', <span style={{ fontSize: 13, color: '#8B92A8' }}>v6.0.1</span>)}
          {row('Политика конфиденциальности',
            <span style={{ fontSize: 18, color: '#4A5270' }}>›</span>, false
          )}
        </div>
      </div>
    </PageLayout>
  );
};
