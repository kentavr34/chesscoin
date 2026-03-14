import React, { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { useUserStore } from '@/store/useUserStore';
import { tasksApi, authApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import type { Task } from '@/types';

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
  const { user, setUser } = useUserStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const totalReward = tasks.filter((t) => !t.isCompleted).reduce((s, t) => s + BigInt(t.reward), 0n);
  const completed = tasks.filter((t) => t.isCompleted).length;

  useEffect(() => {
    tasksApi.list().then((r) => setTasks(r.tasks)).finally(() => setLoading(false));
  }, []);

  const handleClaim = async (task: Task) => {
    if (task.isCompleted || claiming) return;
    setClaiming(task.id);
    try {
      await tasksApi.complete(task.id);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, isCompleted: true } : t));
      const updated = await authApi.me();
      setUser(updated);
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text: e.message ?? 'Ошибка', type: 'error' } }));
    } finally {
      setClaiming(null);
    }
  };

  const grouped = groupByCategory(tasks);

  return (
    <PageLayout title="Задания" backTo="/">
      {/* Прогресс */}
      <div style={progressStrip}>
        <span style={{ fontSize: 20 }}>📊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>
            {completed} из {tasks.length} выполнено · +{fmtBalance(String(totalReward))} ᚙ осталось
          </div>
          <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>Обновление через 08:38</div>
          <div style={{ height: 3, background: '#181B22', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%`, background: 'linear-gradient(90deg,#F5C842,#FFD966)', borderRadius: 2, transition: 'width .6s' }} />
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#4A5270', padding: 32 }}>Загрузка...</div>}

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
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>
                  {task.isCompleted ? 'Выполнено!' : task.description}
                </div>
                {task.maxProgress && !task.isCompleted && (
                  <div style={{ height: 3, background: '#181B22', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((task.progress ?? 0) / task.maxProgress) * 100}%`, background: '#9B85FF', borderRadius: 2 }} />
                  </div>
                )}
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#F5C842', whiteSpace: 'nowrap', marginRight: 8 }}>
                +{fmtBalance(task.reward)} ᚙ
              </span>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                background: task.isCompleted ? '#00D68F' : 'transparent',
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
  );
};

const progressStrip: React.CSSProperties = { margin: '4px 18px 0', padding: '13px 16px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 };
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#4A5270', padding: '16px 18px 8px' };
const taskCard: React.CSSProperties = { margin: '0 18px 8px', padding: '13px 14px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, transition: 'all .2s' };
