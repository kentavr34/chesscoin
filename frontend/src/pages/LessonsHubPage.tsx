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
import { lessonsApi, tasksApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { IcoLock, IcoCheck2 } from '@/components/icons/UiIcons';
import { useT, useText } from '@/i18n/useT';

const MAX_LEVELS = 50;
// Награда живёт в самом уроке — за трудность блока, а не за номер
// (Кенан 01.08.2026). Формула осталась только для номеров вне линейки.
const fallbackReward = (level: number) => 1000 + 1000 * level;

/** Название урока и блока приходят ключами — берём их из словаря. */
const LessonTitle: React.FC<{ titleKey: string; fallback: string; color: string }> =
  ({ titleKey, fallback, color }) => (
    <span style={{ color }}>{useText(titleKey, fallback)}</span>
  );

const BlockHeading: React.FC<{ blockKey: string }> = ({ blockKey }) => {
  const label = useText(`lessons.block.${blockKey}`, '');
  if (!label) return null;
  return (
    <div style={{
      margin: '10px 2px 2px', fontSize: '.64rem', fontWeight: 800,
      letterSpacing: '.08em', textTransform: 'uppercase', color: '#7A6BA8',
    }}>
      {label}
    </div>
  );
};

export const LessonsHubPage: React.FC = () => {
  const navigate = useNavigate();
  // Линейка уроков со сценарием: нужны и число, и названия с блоками.
  const [lessons, setLessons] = useState<Array<{ id: number; block: string; titleKey: string; reward: string }>>([]);
  const lessonsCount = lessons.length;
  const t = useT();
  const [current, setCurrent] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lessonsApi.list().then(r => setLessons(r.lessons ?? [])).catch(() => {});
    tasksApi.lessonsProgress()
      .then(r => setCurrent(r.currentLevel))
      .catch(() => setCurrent(1))
      .finally(() => setLoading(false));
  }, []);

  // Линейка не должна упираться в число из кода: уроков со сценарием уже
  // больше полусотни, и обрезать список по MAX_LEVELS значило бы спрятать их.
  // Лесенка идёт СНИЗУ ВВЕРХ: пройденные уроки внизу, непройденные выше,
  // текущий — посередине экрана (Кенан 09.08.2026: «человек продвигается
  // снизу вверх»). Поэтому список разворачиваем: наверху самый дальний урок.
  const levels = Array.from({ length: Math.max(MAX_LEVELS, lessonsCount) }, (_, i) => i + 1).reverse();
  const rewardOf = (level: number) =>
    lessons.find(l => l.id === level)?.reward ?? String(fallbackReward(level));

  // Открываем страницу так, чтобы текущий уровень оказался по центру:
  // сверху видно, куда идти, снизу — что уже пройдено.
  const текущийРяд = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      текущийРяд.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 60);
    return () => clearTimeout(t);
  }, [loading, current]);

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
              {t.lessons?.reward ?? 'Награда'}: <CoinIcon size={11} /> {fmtBalance(rewardOf(current))}
            </div>
          </div>
        </div>

        {/* Лесенка */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {levels.map(level => {
            const isCompleted = level < current;
            const isCurrent = level === current;
            const isLocked = level > current;
            const lesson = lessons.find(l => l.id === level);
            // Список перевёрнут, поэтому «сосед сверху» — это урок с БОЛЬШИМ
            // номером. Заголовок блока ставим там, где блок начинается сверху.
            const aboveBlock = lessons.find(l => l.id === level + 1)?.block;
            const rows: React.ReactNode[] = [];
            if (lesson && lesson.block !== aboveBlock) {
              rows.push(<BlockHeading key={`b${level}`} blockKey={lesson.block} />);
            }
            rows.push(
              <div
                key={level}
                ref={isCurrent ? текущийРяд : undefined}
                onClick={() => {
                  // Урок с готовым сценарием открываем на своём экране: показ,
                  // затем тест. Для номеров, которых ещё нет в линейке,
                  // остаётся прежний путь со случайной задачей.
                  if (isCompleted) return;
                  // Заблокированный урок открывать нельзя: сервер засчитывает
                  // строго по порядку, и открытый «вперёд» урок игрок проходил
                  // впустую — экран показывал победу, запись не делалась
                  // (Кенан 09.08.2026). Замок в списке был, а клик работал.
                  if (isLocked) return;
                  if (level <= lessonsCount) navigate(`/learn/${level}`);
                  else if (isCurrent) {
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
                    {lesson
                      ? <LessonTitle titleKey={lesson.titleKey} color="inherit"
                          fallback={`${t.lessons?.lesson ?? 'Урок'} ${level}`} />
                      : `${t.lessons?.lesson ?? 'Урок'} ${level}`}
                  </div>
                  <div style={{ fontSize: '.62rem', color: isLocked ? '#3A3028' : '#7A7875', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isCompleted ? (t.lessons?.completed ?? 'Пройден') : (
                      <>+{fmtBalance(rewardOf(level))} <CoinIcon size={9} /></>
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
              </div>,
            );
            return <React.Fragment key={`row${level}`}>{rows}</React.Fragment>;
          })}
        </div>
      </div>
    </PageLayout>
  );
};
