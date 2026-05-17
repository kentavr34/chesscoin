/**
 * LessonsHubPage — лесенка уровней Lesson (B.6 MASTER_PLAN).
 *
 * Backend держит прогресс в `lesson_progress` (POST /lessons/:level/complete
 * валидирует `level === current` — закрывает overshoot). Здесь — UI:
 * пройденные / текущий / заблокированные с замком.
 *
 * Клик на текущий → переход к решению задачи. Заблокированный — disabled.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { tasksApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { IcoLock, IcoCheck2 } from '@/components/icons/UiIcons';
import { useT } from '@/i18n/useT';

const MAX_LEVELS = 50;
// Backend формула наград: 1000 + 1000 * level
const lessonReward = (level: number) => 1000 + 1000 * level;

export const LessonsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT();
  const [current, setCurrent] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksApi.lessonsProgress()
      .then(r => setCurrent(r.currentLevel))
      .catch(() => setCurrent(1))
      .finally(() => setLoading(false));
  }, []);

  const levels = Array.from({ length: MAX_LEVELS }, (_, i) => i + 1);

  return (
    <PageLayout title={t.lessons?.title ?? 'Уроки'} centered>
      <div style={{ padding: '0 16px 24px' }}>
        {/* Заголовок-статус */}
        <div style={{
          margin: '6px 0 14px',
          background: 'linear-gradient(135deg,#141018,#0F0E18)',
          border: '.5px solid rgba(155,109,255,.22)',
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'rgba(155,109,255,.12)', border: '.5px solid rgba(155,109,255,.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 900, color: '#9B85FF',
          }}>
            {loading ? '…' : current}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '.86rem', fontWeight: 800, color: '#EAE2CC' }}>
              {t.lessons?.currentLevel ?? 'Текущий уровень'} {current}
            </div>
            <div style={{ fontSize: '.66rem', color: '#9A9490', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {t.lessons?.reward ?? 'Награда'}: <CoinIcon size={11} /> {fmtBalance(String(lessonReward(current)))}
            </div>
          </div>
        </div>

        {/* Лесенка */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {levels.map(level => {
            const isCompleted = level < current;
            const isCurrent = level === current;
            const isLocked = level > current;
            return (
              <div
                key={level}
                onClick={() => {
                  if (isCurrent) {
                    const difficulty = level < 10 ? 'easy' : level < 25 ? 'medium' : 'hard';
                    navigate(`/lesson/random?difficulty=${difficulty}&lesson=${level}`);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px',
                  borderRadius: 12,
                  background: isCurrent
                    ? 'linear-gradient(135deg,rgba(155,109,255,.16),rgba(155,109,255,.06))'
                    : isCompleted ? 'rgba(61,186,122,.05)' : 'rgba(255,255,255,.02)',
                  border: isCurrent
                    ? '1px solid rgba(155,109,255,.5)'
                    : isCompleted ? '.5px solid rgba(61,186,122,.18)' : '.5px solid rgba(255,255,255,.04)',
                  opacity: isLocked ? 0.5 : 1,
                  cursor: isCurrent ? 'pointer' : 'default',
                  transition: 'all .15s',
                }}
              >
                {/* Номер */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: isCompleted ? 'rgba(61,186,122,.18)' : isCurrent ? 'rgba(155,109,255,.18)' : 'rgba(255,255,255,.04)',
                  border: `.5px solid ${isCompleted ? 'rgba(61,186,122,.32)' : isCurrent ? 'rgba(155,109,255,.4)' : 'rgba(255,255,255,.06)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800,
                  color: isCompleted ? '#3DBA7A' : isCurrent ? '#9B85FF' : '#5A5248',
                }}>
                  {isCompleted ? <IcoCheck2 size={14} color="#3DBA7A" /> : isLocked ? <IcoLock size={14} color="#5A5248" /> : level}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '.82rem', fontWeight: 700,
                    color: isCompleted ? '#9A9490' : isCurrent ? '#EAE2CC' : '#5A5248',
                  }}>
                    {t.lessons?.lesson ?? 'Урок'} {level}
                  </div>
                  <div style={{ fontSize: '.62rem', color: isLocked ? '#3A3028' : '#7A7875', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isCompleted ? (t.lessons?.completed ?? 'Пройден') : (
                      <>+{fmtBalance(String(lessonReward(level)))} <CoinIcon size={9} /></>
                    )}
                  </div>
                </div>

                {isCurrent && (
                  <div style={{
                    padding: '6px 12px', borderRadius: 8,
                    background: 'rgba(155,109,255,.18)', color: '#9B85FF',
                    border: '.5px solid rgba(155,109,255,.4)',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    {t.lessons?.play ?? 'Решить'} →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
};
