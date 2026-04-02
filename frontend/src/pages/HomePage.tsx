import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { useT } from '@/i18n/useT';
import { getSocket } from '@/api/socket';
import { PageLayout } from '@/components/layout/PageLayout';
import { JarvisModal } from '@/components/ui/JarvisModal';
import { GameSetupModal } from '@/components/ui/GameSetupModal';
import { JARVIS_LEVELS, type JarvisLevel } from '@/components/ui/JarvisModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Heading } from '@/components/ui/Heading';
import { StatBox } from '@/components/ui/StatBox';

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
  const [showActiveSessions, setShowActiveSessions] = useState(false);

  const handleJarvisSelect = (level: JarvisLevel) => {
    setSelectedJarvisLevel(level);
    setShowJarvisModal(false);
    setShowGameSetup(true);
  };

  const { upsertSession } = useGameStore();

  const handleGameStart = (color: 'white' | 'black', timeMinutes: number) => {
    if (!selectedJarvisLevel) return;

    // Создаём session на бэкэнде
    const socket = getSocket();
    socket.emit('game:create:bot',
      { color, botLevel: selectedJarvisLevel.level, timeSeconds: timeMinutes * 60 },
      (res: Record<string, unknown>) => {
        if (res?.ok && res?.session) {
          const session = res.session as import('@/types').GameSession;
          upsertSession(session);
          navigate(`/game/${session.id}`);
        } else {
          console.error('Failed to create game session');
        }
      }
    );
  };

  if (!user) {
    return <PageLayout>Loading...</PageLayout>;
  }

  // Форматирование league в UI текст
  const getLeagueLabel = (league: string) => {
    const leagueMap: Record<string, string> = {
      'BRONZE': '🥉 Бронза',
      'SILVER': '🥈 Серебро',
      'GOLD': '🥇 Золото',
      'DIAMOND': '💎 Алмаз',
      'CHAMPION': '👑 Чемпион',
      'STAR': '⭐ Звезда',
    };
    return leagueMap[league] || league;
  };

  // Расчёт времени до следующей попытки
  const getNextAttemptTime = () => {
    if (!user.nextAttemptAt) return null;
    const nextTime = new Date(user.nextAttemptAt);
    const now = new Date();
    const diff = nextTime.getTime() - now.getTime();
    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
  };

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

      <div style={{ padding: 'var(--space-l) var(--space-m)', maxWidth: 500, margin: '0 auto' }}>
        {/* Профиль пользователя */}
        <Card padding="lg" style={{ marginBottom: 'var(--gap-xl)' }}>
          {/* Заголовок профиля */}
          <div style={{ display: 'flex', gap: 'var(--gap-md)', alignItems: 'center', marginBottom: 'var(--gap-md)' }}>
            <div style={{ fontSize: 44 }}>👤</div>
            <div style={{ flex: 1 }}>
              <Heading level="h3" style={{ margin: 0 }}>
                {user.firstName || 'Player'}
              </Heading>
              <Text size="sm" color="secondary" style={{ marginTop: 'var(--gap-xs)' }}>
                {user.wins || 0} побед · {user.losses || 0} поражений
              </Text>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/profile')}
            >
              Открыть
            </Button>
          </div>

          {/* ELO и Лига */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-sm)', marginBottom: 'var(--gap-md)' }}>
            <StatBox label="Рейтинг" value={user.elo || 0} color="red" />
            <StatBox label="Лига" value={getLeagueLabel(user.league || 'BRONZE')} color="gold" />
          </div>

          {/* Баланс */}
          <div style={{ marginBottom: 'var(--gap-md)' }}>
            <StatBox
              label="Баланс"
              value={`${(user.balance || 0).toLocaleString()} ᚙ`}
              color="purple"
            />
          </div>

          {/* Попытки и рефералы */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-sm)', marginBottom: 'var(--gap-md)' }}>
            <StatBox
              label="Попытки"
              value={`${user.attempts || 0}/${user.maxAttempts || 5}`}
              color="blue"
            >
              {getNextAttemptTime() && (
                <Text size="xs" color="secondary">
                  Через {getNextAttemptTime()}
                </Text>
              )}
            </StatBox>
            <StatBox label="Рефералы" value={user.referralCount || 0} color="green">
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => navigate('/referrals')}
                style={{ marginTop: 'var(--gap-xs)', padding: 0, color: 'inherit' }}
              >
                <Text size="xs" style={{ textDecoration: 'underline' }}>
                  Пригласить
                </Text>
              </Button>
            </StatBox>
          </div>

          {/* Активные сессии */}
          {user.activeSessions && user.activeSessions.length > 0 && (
            <>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowActiveSessions(!showActiveSessions)}
                style={{ marginBottom: showActiveSessions ? 'var(--gap-md)' : 0 }}
              >
                📊 {user.activeSessions.length} активных сессий
              </Button>

              {showActiveSessions && (
                <div style={{ marginTop: 'var(--gap-md)' }}>
                  {user.activeSessions.map((session) => (
                    <Card
                      key={session.id}
                      interactive
                      onClick={() => navigate(`/game/${session.id}`)}
                      style={{ marginBottom: 'var(--gap-sm)' }}
                    >
                      <Text size="sm">
                        {session.type === 'BOT' ? '🤖 Против Jarvis' : session.type === 'BATTLE' ? '⚔️ Батл' : '👥 Дружеская'}
                      </Text>
                      <Text size="xs" color="secondary">
                        {session.status === 'IN_PROGRESS' ? '▶️ В процессе' : session.status === 'WAITING_FOR_OPPONENT' ? '⏳ Ожидание' : session.status}
                      </Text>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
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
        padding: `var(--card-padding-lg) var(--button-padding-x-md)`,
        background: hovered ? bgHovered : bgColor,
        border: `2px solid ${hovered ? borderHovered : borderColor}`,
        borderRadius: 'var(--radius-l)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: `all var(--transition-fast) var(--ease-in-out)`,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-md)',
      }}
    >
      <div style={{ fontSize: 'var(--icon-size-xl)' }}>{icon}</div>
      <div style={{ textAlign: 'left', flex: 1 }}>
        <Heading level="h4" style={{ margin: 0 }}>{title}</Heading>
        <Text size="sm" color="secondary" style={{ marginTop: 'var(--gap-xs)' }}>{subtitle}</Text>
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)' }}>→</div>
    </button>
  );
};

function hexToRgb(hex: string): string {
  if (hex === 'transparent') return '255,255,255';
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255,255,255';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
