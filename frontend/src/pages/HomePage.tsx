import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/i18n/useT';
import { PageLayout } from '@/components/layout/PageLayout';
import { JarvisModal } from '@/components/ui/JarvisModal';
import { GameSetupModal } from '@/components/ui/GameSetupModal';
import { JARVIS_LEVELS, type JarvisLevel } from '@/components/ui/JarvisModal';

/**
 * HomePage.tsx — Главная страница с кнопками навигации
 * - Игра против Jarvis
 * - Батлы (PvP дуэли)
 * - Войны (коалиции)
 * - Магазин (скины, фигуры)
 * - Настройки
 */

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const t = useT();

  const [showJarvisModal, setShowJarvisModal] = useState(false);
  const [showGameSetup, setShowGameSetup] = useState(false);
  const [selectedJarvisLevel, setSelectedJarvisLevel] = useState<JarvisLevel | null>(null);

  const handleJarvisSelect = (level: JarvisLevel) => {
    setSelectedJarvisLevel(level);
    setShowJarvisModal(false);
    setShowGameSetup(true);
  };

  const handleGameStart = (color: 'white' | 'black', timeMinutes: number) => {
    if (!selectedJarvisLevel) return;
    navigate(`/game/jarvis/${selectedJarvisLevel.level}`, {
      state: { color, timeMinutes, difficulty: selectedJarvisLevel },
    });
  };

  if (!user) {
    return <PageLayout>Loading...</PageLayout>;
  }

  return (
    <PageLayout>
      {showJarvisModal && (
        <JarvisModal
          currentJarvisLevel={user.currentJarvisLevel || 1}
          onSelect={handleJarvisSelect}
          onClose={() => setShowJarvisModal(false)}
        />
      )}
      {showGameSetup && selectedJarvisLevel && (
        <GameSetupModal
          selectedLevel={selectedJarvisLevel}
          onStart={handleGameStart}
          onClose={() => {
            setShowGameSetup(false);
            setSelectedJarvisLevel(null);
          }}
        />
      )}

      <div style={{ padding: '20px 16px', maxWidth: 500, margin: '0 auto' }}>
        <div style={{
          padding: '16px',
          background: 'var(--color-bg-card, #13161F)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 44 }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F2F8' }}>{user.name || 'Player'}</div>
              <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 2 }}>
                {user.wins || 0} побед · {user.losses || 0} поражений
              </div>
            </div>
            <button
              onClick={() => navigate('/profile')}
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
              Открыть
            </button>
          </div>

          <div style={{
            padding: '10px 12px',
            background: 'rgba(245,200,66,0.08)',
            border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: 10,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 4 }}>Баланс</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F5C842', fontFamily: "'JetBrains Mono',monospace" }}>
              {(user.balance || 0).toLocaleString()} ᚙ
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NavButton
            icon="🤖"
            title="Игра против Jarvis"
            subtitle="Выбери сложность и начни"
            onClick={() => setShowJarvisModal(true)}
            color="#F5C842"
          />
          <NavButton
            icon="⚔️"
            title="Батлы"
            subtitle="PvP дуэли с игроками"
            onClick={() => navigate('/battles')}
            color="#9B85FF"
          />
          <NavButton
            icon="🏰"
            title="Войны"
            subtitle="Коалиции и боевые операции"
            onClick={() => navigate('/wars')}
            color="#FF4D6A"
          />
          <NavButton
            icon="🛍️"
            title="Магазин"
            subtitle="Скины, фигуры, доски"
            onClick={() => navigate('/shop')}
            color="#00D68F"
          />
          <NavButton
            icon="⚙️"
            title="Настройки"
            subtitle="Язык, тема, аккаунт"
            onClick={() => navigate('/settings')}
            color="transparent"
          />
        </div>
      </div>
    </PageLayout>
  );
};

interface NavButtonProps {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  color: string;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, title, subtitle, onClick, color }) => {
  const [hovered, setHovered] = useState(false);
  const bgColor = color === 'transparent' ? 'rgba(255,255,255,0.05)' : `rgba(${hexToRgb(color)}, 0.1)`;
  const borderColor = color === 'transparent' ? 'rgba(255,255,255,0.1)' : `rgba(${hexToRgb(color)}, 0.3)`;
  const bgHovered = color === 'transparent' ? 'rgba(255,255,255,0.08)' : `rgba(${hexToRgb(color)}, 0.15)`;
  const borderHovered = color === 'transparent' ? 'rgba(255,255,255,0.15)' : `rgba(${hexToRgb(color)}, 0.6)`;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '20px 16px',
        background: hovered ? bgHovered : bgColor,
        border: `2px solid ${hovered ? borderHovered : borderColor}`,
        borderRadius: 16,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ textAlign: 'left', flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F2F8' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ fontSize: 20 }}>→</div>
    </button>
  );
};

function hexToRgb(hex: string): string {
  if (hex === 'transparent') return '255,255,255';
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255,255,255';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
