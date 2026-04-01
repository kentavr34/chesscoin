import React, { useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/i18n/useT';
import { PageLayout } from '@/components/layout/PageLayout';
import { JarvisModal } from '@/components/ui/JarvisModal';
import { GameSetupModal } from '@/components/ui/GameSetupModal';
import { type JarvisLevel } from '@/components/ui/JarvisModal';

/**
 * HomePage.tsx — Раздел "Play" (Игра)
 * Показывает статистику игрока и основное действие — играть против Jarvis
 * Остальная навигация в BottomNav (Battles, Wars, Tournaments, Profile)
 */

export const HomePage: React.FC = () => {
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
    // Игра против Jarvis
    console.log('Start game:', { level: selectedJarvisLevel.level, color, timeMinutes });
  };

  if (!user) {
    return <PageLayout>Loading...</PageLayout>;
  }

  return (
    <PageLayout>
      {showJarvisModal && (
        <JarvisModal
          currentJarvisLevel={user.jarvisLevel || 1}
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

      {/* ЕДИНАЯ ДИЗАЙН-СИСТЕМА: максимально простая и чистая */}
      <div style={{ padding: '16px', maxWidth: 500, margin: '0 auto', paddingBottom: 120 }}>

        {/* Профиль + Баланс — карточка */}
        <div style={{
          padding: '16px',
          background: 'var(--color-bg-card, #13161F)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}>
          {/* Левая часть: имя + статистика */}
          <div>
            <div style={{ fontSize: 12, color: '#8B92A8', marginBottom: 4 }}>Игрок</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F2F8', marginBottom: 8 }}>
              {user.firstName || 'Player'}
            </div>
            <div style={{ fontSize: 11, color: '#4A5270', lineHeight: 1.6 }}>
              <div>W: {user.wins || 0}</div>
              <div>L: {user.losses || 0}</div>
            </div>
          </div>

          {/* Правая часть: баланс */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 4 }}>Баланс</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F5C842', fontFamily: "'JetBrains Mono',monospace" }}>
              {(user.balance || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>ᚙ</div>
          </div>
        </div>

        {/* ОСНОВНАЯ КНОПКА: Играть против Jarvis */}
        <button
          onClick={() => setShowJarvisModal(true)}
          style={{
            width: '100%',
            padding: '20px',
            background: '#F5C842',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 800,
            color: '#0B0D11',
            transition: 'all 0.2s',
            boxShadow: '0 4px 20px rgba(245,200,66,0.2)',
            marginBottom: 24,
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'scale(1.02)';
            (e.target as HTMLElement).style.boxShadow = '0 6px 24px rgba(245,200,66,0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'scale(1)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 20px rgba(245,200,66,0.2)';
          }}
        >
          🤖 Играть против Jarvis
        </button>

        {/* Информационный блок */}
        <div style={{
          padding: 12,
          background: 'rgba(123,97,255,0.08)',
          border: '1px solid rgba(123,97,255,0.15)',
          borderRadius: 10,
          fontSize: 12,
          color: '#8B92A8',
          lineHeight: 1.6,
        }}>
          🏆 Выигрывай уровни по порядку. За каждый побед получишь значок на профиль.
        </div>
      </div>
    </PageLayout>
  );
};
