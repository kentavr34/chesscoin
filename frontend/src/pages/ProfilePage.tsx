import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { PageLayout } from '@/components/layout/PageLayout';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [tab, setTab] = React.useState<'stats' | 'badges' | 'history' | 'settings'>('stats');

  if (!user) return <PageLayout>Loading...</PageLayout>;

  return (
    <PageLayout>
      <div style={{ padding: '20px 16px', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#F0F2F8',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            ← Назад
          </button>
        </div>

        <div style={{
          padding: '20px',
          background: 'var(--color-bg-card, #13161F)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 56 }}>👤</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F0F2F8' }}>{user.name}</div>
              <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 4 }}>
                Уровень {user.currentJarvisLevel || 1}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <StatBox label="Побед" value={user.wins || 0} />
          <StatBox label="Поражений" value={user.losses || 0} />
          <StatBox label="Рейтинг" value={user.rating || 1000} />
          <StatBox label="Баланс" value={`${(user.balance || 0).toLocaleString()} ᚙ`} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 8,
          marginBottom: 24,
        }}>
          {(['stats', 'badges', 'history', 'settings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px',
                background: tab === t ? '#F5C842' : 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: tab === t ? '#0B0D11' : '#F0F2F8',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              {t === 'stats' && 'Статистика'}
              {t === 'badges' && 'Значки'}
              {t === 'history' && 'История'}
              {t === 'settings' && 'Настройки'}
            </button>
          ))}
        </div>

        <div style={{
          padding: '20px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12,
          minHeight: 200,
        }}>
          <div style={{ textAlign: 'center', color: '#8B92A8' }}>
            {tab === 'stats' && 'Общая статистика игроков'}
            {tab === 'badges' && 'Полученные значки и достижения'}
            {tab === 'history' && 'История всех игр и батлов'}
            {tab === 'settings' && 'Настройки аккаунта'}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

const StatBox: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div style={{
    padding: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F2F8' }}>{value}</div>
  </div>
);
