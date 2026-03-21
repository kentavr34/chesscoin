import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { useUserStore } from '@/store/useUserStore';
import { tasksApi, authApi, puzzlesApi } from '@/api';
import type { PuzzleItem } from '@/api';
import { fmtBalance } from '@/utils/format';
import type { Task } from '@/types';
import { useT } from '@/i18n/useT';

const CATEGORY_ICONS: Record<string, string> = {
  DAILY: '🌅',
  LEARN: '📚',
  SOCIAL: '📢',
};

const groupByCategory = (tasks: Task[]): Record<string, Task[]> => {
  return tasks.reduce((acc, t) => {
    const cat = t.type.split('_')[0] ?? 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, Task[]>);
};

const CAT_LABEL: Record<string, string> = {
  DAILY: '🌅 Ежедневные',
  LEARN: '📚 Обучение',
  SOCIAL: '📢 Социальные',
  OTHER: '📋 Прочее',
};

export const TasksPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const tasksInfo = useInfoPopup('tasks', [{ icon: '📋', title: 'Задания', desc: 'Выполняй задания и получай монеты ᚙ. Ежедневные задания обновляются каждый день.' }, { icon: '👥', title: 'Реферальные задания', desc: 'Приглашай друзей и выполняй реферальные задания — бонус растёт с каждым новым игроком.' }]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<PuzzleItem | null>(null);
  const [puzzleLoading, setPuzzleLoading] = useState(true);

  const totalReward = tasks.filter((t) => !t.isCompleted).reduce((s, t) => s + BigInt(t.reward ?? '0'), 0n);
  const completed = tasks.filter((t) => t.isCompleted).length;

  useEffect(() => {
    tasksApi.list().then((r) => setTasks(r.tasks)).finally(() => setLoading(false));
    puzzlesApi.daily()
      .then((r) => setDailyPuzzle(r.puzzle))
      .catch(() => {})
      .finally(() => setPuzzleLoading(false));
  }, []);

  const handleClaim = async (task: Task) => {
    if (task.isCompleted || claiming) return;
    setClaiming(task.id);
    try {
      await tasksApi.complete(task.id);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, isCompleted: true } : t));
      const updated = await authApi.me();
      setUser(updated);
    } catch (e: unknown) {
      window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text: (e instanceof Error ? e.message : String(e)) ?? 'Ошибка', type: 'error' } }));
    } finally {
      setClaiming(null);
    }
  };

  const grouped = groupByCategory(tasks);

  return (
    <>
    {tasksInfo.show && <InfoPopup infoKey="tasks" slides={[{ icon: '📋', title: 'Задания', desc: 'Выполняй задания и получай монеты ᚙ. Ежедневные задания обновляются каждый день.' }, { icon: '👥', title: 'Реферальные задания', desc: 'Приглашай друзей и выполняй реферальные задания — бонус растёт с каждым новым игроком.' }]} onClose={tasksInfo.close} />}
    <PageLayout title={t.tasks.title} centered>
      {/* Прогресс */}
      <div style={progressStrip}>
        <span style={{ fontSize: 20 }}>📊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>
            {completed} из {tasks.length} выполнено · +{fmtBalance(String(totalReward))} ᚙ осталось
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>Обновление через 08:38</div>
          <div style={{ height: 3, background: '#181B22', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%`, background: 'linear-gradient(90deg,#F5C842,#FFD966)', borderRadius: 2, transition: 'width .6s' }} />
          </div>
        </div>
      </div>

      {/* ── Задача дня ─────────────────────────────────────────────── */}
      <div style={{ margin: '12px 18px 0' }}>
        <div style={secStyle}>📅 Задача дня</div>
        {puzzleLoading ? (
          <div style={{ height: 80, background: 'var(--bg-card, #1C2030)', borderRadius: 14, margin: '0 0 4px' }} />
        ) : dailyPuzzle ? (
          <div
            onClick={() => navigate('/lesson/daily')}
            style={{
              padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
              background: dailyPuzzle.completed
                ? 'rgba(0,214,143,0.07)'
                : 'linear-gradient(135deg,rgba(245,200,66,0.08),rgba(123,97,255,0.06))',
              border: `1px solid ${dailyPuzzle.completed ? 'rgba(0,214,143,0.2)' : 'rgba(245,200,66,0.2)'}`,
              display: 'flex', alignItems: 'center', gap: 14,
              marginBottom: 4,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: dailyPuzzle.completed ? 'rgba(0,214,143,0.12)' : 'rgba(245,200,66,0.1)',
              border: `1px solid ${dailyPuzzle.completed ? 'rgba(0,214,143,0.3)' : 'rgba(245,200,66,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
              {dailyPuzzle.completed ? '✅' : '♟'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
                {dailyPuzzle.completed ? 'Задача дня решена!' : 'Реши задачу дня'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                Рейтинг {dailyPuzzle.rating} · {dailyPuzzle.themes.slice(0, 2).join(', ')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: dailyPuzzle.completed ? 'var(--green, #00D68F)' : 'var(--accent, #F5C842)' }}>
                {dailyPuzzle.completed ? `+${fmtBalance(dailyPuzzle.earnedReward ?? dailyPuzzle.reward)}` : `+${fmtBalance(dailyPuzzle.reward)}`} ᚙ
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginTop: 2 }}>
                {dailyPuzzle.completed ? 'получено' : '→ Решить'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted, #4A5270)' }}>
            Задача дня недоступна
          </div>
        )}

        {/* Кнопки практики */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8, marginBottom: 4 }}>
          {(['easy', 'medium', 'hard'] as const).map((diff) => {
            const icons = { easy: '🟢', medium: '🟡', hard: '🔴' };
            const labels = { easy: 'Лёгкая', medium: 'Средняя', hard: 'Сложная' };
            return (
              <div key={diff} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => navigate(`/lesson/random?difficulty=${diff}&mode=learn`)}
                  style={{
                    padding: '9px 6px', background: 'var(--bg-card, #1C2030)',
                    border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px 12px 4px 4px',
                    color: 'var(--text-secondary, #8B92A8)', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{icons[diff]}</span>
                  {labels[diff]}
                </button>
                <button
                  onClick={() => navigate(`/lesson/random?difficulty=${diff}&mode=test`)}
                  style={{
                    padding: '6px 4px', background: 'rgba(245,200,66,0.06)',
                    border: '1px solid rgba(245,200,66,0.2)', borderRadius: '4px 4px 12px 12px',
                    color: 'var(--accent, #F5C842)', fontSize: 9, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  title="Тест-режим: без подсказок, награда ×1.5"
                >
                  🎯 ×1.5
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 32 }}>{t.common.loading}</div>}

      {!loading && tasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 8 }}>
            Задания скоро появятся
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)', lineHeight: 1.6 }}>
            Выполняй задания и получай монеты ᚙ.<br />
            Следи за обновлениями в нашем канале!
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([cat, catTasks]) => (
        <React.Fragment key={cat}>
          <div style={secStyle}>{CAT_LABEL[cat] ?? cat}</div>
          {catTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleClaim(task)}
              style={{ ...taskCard, opacity: task.isCompleted ? .5 : 1, cursor: task.isCompleted ? 'default' : 'pointer' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, background: task.isCompleted ? 'rgba(0,214,143,0.10)' : 'rgba(123,97,255,0.12)' }}>
                {CATEGORY_ICONS[cat] ?? '📋'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                  {task.isCompleted ? t.tasks.completed : task.description}
                </div>
                {task.maxProgress && !task.isCompleted && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-muted, #4A5270)' }}>Прогресс</span>
                      <span style={{ fontSize: 9, color: '#9B85FF', fontWeight: 700 }}>
                        {task.progress ?? 0} / {task.maxProgress}
                      </span>
                    </div>
                    <div style={{ height: 4, background: '#181B22', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, ((task.progress ?? 0) / task.maxProgress) * 100)}%`, background: 'linear-gradient(90deg,#7B61FF,#9B85FF)', borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                  </div>
                )}
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: 'var(--accent, #F5C842)', whiteSpace: 'nowrap', marginRight: 8 }}>
                +{fmtBalance(task.reward ?? '0')} ᚙ
              </span>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                background: task.isCompleted ? 'var(--green, #00D68F)' : 'transparent',
                border: task.isCompleted ? '2px solid #00D68F' : '2px solid rgba(255,255,255,0.13)',
                color: '#fff',
              }}>
                {task.isCompleted ? '✓' : claiming === task.id ? '…' : ''}
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </PageLayout>
    </>
  );
};

const progressStrip: React.CSSProperties = { margin: '4px 18px 0', padding: '13px 16px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 };
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-muted, #4A5270)', padding: '16px 18px 8px' };
const taskCard: React.CSSProperties = { margin: '0 18px 8px', padding: '13px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, transition: 'all .2s' };
