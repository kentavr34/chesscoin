import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { useT } from '@/i18n/useT';
import { getSocket } from '@/api/socket';
import { PageLayout } from '@/components/layout/PageLayout';
import { JarvisModal } from '@/components/ui/JarvisModal';
import { GameSetupModal } from '@/components/ui/GameSetupModal';
import { JARVIS_LEVELS, type JarvisLevel } from '@/components/ui/JarvisModal';

const JARVIS_NAMES = ['Beginner', 'Rookie', 'Player', 'Challenger', 'Fighter', 'Warrior', 'Expert', 'Master', 'Legend', 'God'];

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const t = useT();
  const { upsertSession } = useGameStore();

  const [showJarvisModal, setShowJarvisModal] = useState(false);
  const [showGameSetup, setShowGameSetup] = useState(false);
  const [selectedJarvisLevel, setSelectedJarvisLevel] = useState<JarvisLevel | null>(null);
  const [timeLeft, setTimeLeft] = useState('');

  // Таймер до следующей попытки
  useEffect(() => {
    if (!user?.nextRestoreSeconds && !user?.nextAttemptAt) return;

    const updateTimer = () => {
      let seconds = 0;
      if (user.nextRestoreSeconds) {
        seconds = user.nextRestoreSeconds;
      } else if (user.nextAttemptAt) {
        seconds = Math.max(0, Math.floor((new Date(user.nextAttemptAt).getTime() - Date.now()) / 1000));
      }
      if (seconds <= 0) { setTimeLeft(''); return; }
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) setTimeLeft(`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      else setTimeLeft(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [user?.nextRestoreSeconds, user?.nextAttemptAt]);

  const handleJarvisSelect = (level: JarvisLevel) => {
    setSelectedJarvisLevel(level);
    setShowJarvisModal(false);
    setShowGameSetup(true);
  };

  const handleGameStart = (color: 'white' | 'black', timeMinutes: number) => {
    if (!selectedJarvisLevel) return;
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

  if (!user) return <PageLayout><div style={{ padding: 24, color: '#fff' }}>Загрузка...</div></PageLayout>;

  const jarvisLevel = user.jarvisLevel || 1;
  const jarvisName = JARVIS_NAMES[Math.min(jarvisLevel - 1, JARVIS_NAMES.length - 1)];
  const rankEmoji = user.militaryRank?.emoji || '😊';
  const rankLabel = user.militaryRank?.label || 'Recruit';
  const balance = parseInt(user.balance || '0');
  const formattedBalance = balance >= 1000 ? `${(balance / 1000).toFixed(balance % 1000 === 0 ? 0 : 1)}K` : String(balance);
  const loginStreak = user.loginStreak || 0;
  const attempts = user.attempts || 0;
  const maxAttempts = user.maxAttempts || 3;

  // Начало недели (Пн)
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Пн, 6=Вс
  const streakDays = Array.from({ length: 7 }, (_, i) => i < loginStreak && i <= dayOfWeek);

  const hasCountry = !!user.countryMember?.country;

  return (
    <PageLayout>
      {showJarvisModal && (
        <JarvisModal
          currentJarvisLevel={jarvisLevel}
          onSelect={handleJarvisSelect}
          onClose={() => setShowJarvisModal(false)}
        />
      )}
      {showGameSetup && selectedJarvisLevel && (
        <GameSetupModal
          selectedLevel={selectedJarvisLevel}
          onStart={handleGameStart}
          onClose={() => { setShowGameSetup(false); setSelectedJarvisLevel(null); }}
        />
      )}

      <div style={{ padding: '12px 16px 100px', background: 'var(--bg, #0B0D11)' }}>

        {/* ══ ПРОФИЛЬ ══════════════════════════════════ */}
        <div style={{
          background: 'var(--bg-card, #13161E)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: 20,
          padding: '16px',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {/* Аватар */}
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              background: user.avatarGradient || 'linear-gradient(135deg, #407BFF, #9B85FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.1)',
            }}>
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user.firstName?.[0] || 'P')}
            </div>

            {/* Инфо */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{user.firstName}</span>
                <span style={{
                  fontSize: 11,
                  color: 'var(--color-text-secondary, #8B92A8)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20,
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {rankEmoji} {rankLabel}
                </span>
              </div>

              {user.username && (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #8B92A8)', marginBottom: 8 }}>
                  @{user.username}
                </div>
              )}

              {/* Чипы: ранг + ELO */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {user.rank && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: '#F5C842',
                    background: 'rgba(245,200,66,0.12)',
                    border: '1px solid rgba(245,200,66,0.3)',
                    borderRadius: 20,
                    padding: '3px 8px',
                  }}>🥇 #{user.rank}</span>
                )}
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: '#407BFF',
                  background: 'rgba(64,123,255,0.12)',
                  border: '1px solid rgba(64,123,255,0.3)',
                  borderRadius: 20,
                  padding: '3px 8px',
                }}>ELO {user.elo}</span>
              </div>

              {/* Jarvis + Battles */}
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #8B92A8)' }}>
                  JARVIS <span style={{ color: '#fff', fontWeight: 600 }}>{jarvisName}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #8B92A8)' }}>
                  БАТЛЫ <span style={{ color: '#fff', fontWeight: 600 }}>{user.wins || 0} W</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ БАЛАНС ════════════════════════════════════ */}
        <div style={{
          background: 'var(--bg-card, #13161E)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary, #8B92A8)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
            Баланс
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#F5C842', letterSpacing: '-0.5px' }}>{formattedBalance}</span>
            <span style={{ fontSize: 20 }}>🪙</span>
            <button
              onClick={() => navigate('/shop')}
              style={{
                marginLeft: 'auto',
                background: 'rgba(245,200,66,0.1)',
                border: '1px solid rgba(245,200,66,0.3)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                color: '#F5C842',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Магазин
            </button>
          </div>
        </div>

        {/* ══ STREAK ════════════════════════════════════ */}
        {loginStreak > 0 && (
          <div style={{
            background: 'var(--bg-card, #13161E)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                🔥 {loginStreak} дн. подряд
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #8B92A8)' }}>
                до +500 💎 {Math.max(0, 7 - loginStreak)} дн.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {DAYS.map((day, i) => (
                <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: 4,
                    borderRadius: 2,
                    background: streakDays[i] ? '#F5C842' : 'rgba(255,255,255,0.1)',
                    marginBottom: 4,
                  }} />
                  <span style={{ fontSize: 9, color: streakDays[i] ? '#F5C842' : 'rgba(255,255,255,0.3)' }}>{day}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ ПОПЫТКИ ═══════════════════════════════════ */}
        <div style={{
          background: 'var(--bg-card, #13161E)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-secondary, #8B92A8)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
              Попытки
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: maxAttempts }, (_, i) => (
                <span key={i} style={{ fontSize: 22, opacity: i < attempts ? 1 : 0.2 }}>⭐</span>
              ))}
            </div>
          </div>
          {timeLeft && (
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--color-text-secondary, #8B92A8)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              🕐 {timeLeft}
            </div>
          )}
        </div>

        {/* ══ JARVIS CTA ════════════════════════════════ */}
        <button
          onClick={() => setShowJarvisModal(true)}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #1E2A5E 0%, #2D1B69 100%)',
            border: '1px solid rgba(100,120,255,0.3)',
            borderRadius: 16,
            padding: '16px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 12,
            boxShadow: '0 4px 24px rgba(64,123,255,0.2)',
          }}
        >
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'rgba(100,120,255,0.2)',
            border: '1px solid rgba(100,120,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            flexShrink: 0,
          }}>🤖</div>

          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
              J.A.R.V.I.S
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              Level {jarvisLevel} · {jarvisName}
            </div>
          </div>

          <div style={{
            background: '#fff',
            color: '#0B0D11',
            fontSize: 12,
            fontWeight: 800,
            borderRadius: 10,
            padding: '8px 14px',
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}>
            PLAY →
          </div>
        </button>

        {/* ══ ВОЙНЫ СТРАН ═══════════════════════════════ */}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary, #8B92A8)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
          Войны стран
        </div>
        <button
          onClick={() => navigate('/wars')}
          style={{
            width: '100%',
            background: 'var(--bg-card, #13161E)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderRadius: 16,
            padding: '14px 16px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 28 }}>
            {hasCountry ? (user.countryMember?.country?.flag || '🌍') : '🌍'}
          </span>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
              {hasCountry ? user.countryMember?.country?.nameRu : 'Вступить в страну'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #8B92A8)' }}>
              {hasCountry ? `${user.countryMember?.role || 'Солдат'}` : 'Сражайся за свою команду'}
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--color-text-secondary, #8B92A8)' }}>→</span>
        </button>
      </div>
    </PageLayout>
  );
};
