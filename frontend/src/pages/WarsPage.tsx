import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';

export const WarsPage: React.FC = () => {
  const navigate = useNavigate();

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
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏰</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#F0F2F8', marginBottom: 12 }}>Войны</div>
          <div style={{ fontSize: 13, color: '#8B92A8', marginBottom: 20, lineHeight: 1.6 }}>
            Коалиции, боевые операции и территориальные конфликты между странами.
          </div>
          <button
            style={{
              padding: '14px 24px',
              background: '#FF4D6A',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Объявить войну
          </button>
        </div>
      </div>
    </PageLayout>
  );
};
