import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { useUserStore } from '@/store/useUserStore';
import { tasksApi, authApi, puzzlesApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import type { Task } from '@/types';

type Tab = 'lessons' | 'daily' | 'social' | 'other';

interface PuzzleItem {
  id: string;
  title: string;
  difficulty: number;
  reward: string;
  isCompleted: boolean;
}

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const [tab, setTab] = useState<Tab>('lessons');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lessons, setLessons] = useState<PuzzleItem[]>([]);
  const [dailies, setDailies] = useState<PuzzleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      tasksApi.list(),
      puzzlesApi.lessons().catch(() => [] as any[]),
      puzzlesApi.daily().catch(() => [] as any[]),
    ]).then(([tasksRes, lessonsRes, dailyRes]) => {
      setTasks(tasksRes.tasks ?? []);
      setLessons(Array.isArray(lessonsRes) ? lessonsRes : []);
      setDailies(Array.isArray(dailyRes) ? dailyRes : []);
    }).finally(() => setLoading(false));
  }, []);

  const handleClaim = async (task: Task) => {
    if (task.isCompleted || claiming) return;
    if (task.taskType === 'FOLLOW_LINK' || task.taskType === 'SUBSCRIBE_TELEGRAM') {
      const url = (task.metadata as any)?.url as string | undefined;
      if (url) {
        try { (window as any).Telegram?.WebApp?.openLink(url); }
        catch { window.open(url, '_blank'); }
      }
    }
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

  const socialTasks = tasks.filter(t => {
    const cat = (t.type ?? 'OTHER').split('_')[0];
    return cat === 'SOCIAL' || cat === 'DAILY';
  });
  const otherTasks = tasks.filter(t => {
    const cat = (t.type ?? 'OTHER').split('_')[0];
    return cat !== 'SOCIAL' && cat !== 'DAILY' && cat !== 'LEARN';
  });

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'lessons', label: 'Уроки', emoji: '📚' },
    { key: 'daily', label: 'Задачи', emoji: '🎯' },
    { key: 'social', label: 'Задания', emoji: '📢' },
    { key: 'other', label: 'Прочее', emoji: '📋' },
  ];

  const diffStars = (d: number) => {
    const stars = Math.min(5, Math.ceil(d / 20));
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  return (
    <PageLayout title="Задания" backTo="/">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, padding: '12px 16px 0', borderBottom: '1px solid #1C2030' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            paddingBottom: 10, paddingTop: 4,
            borderBottom: tab === t.key ? '2px solid #7B61FF' : '2px solid transparent',
            color: tab === t.key ? '#7B61FF' : '#4A5270',
            fontSize: 11, fontWeight: 600,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: 16 }}>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: '#4A5270', padding: 40 }}>Загрузка...</div>
      )}

      {/* Lessons tab */}
      {tab === 'lessons' && !loading && (
        <div style={{ paddingBottom: 40 }}>
          <div style={secLabel}>Шахматные уроки — учись и зарабатывай</div>
          {lessons.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 14 }}>
              Уроки скоро появятся
            </div>
          )}
          {lessons.map(lesson => (
            <div key={lesson.id} onClick={() => navigate(`/puzzle/lesson/${lesson.id}`)} style={{
              ...card, opacity: lesson.isCompleted ? 0.6 : 1,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: lesson.isCompleted ? 'rgba(0,214,143,0.1)' : 'rgba(123,97,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {lesson.isCompleted ? '✅' : '♟'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lesson.title}
                </div>
                <div style={{ fontSize: 11, color: '#F5C842', marginTop: 1 }}>
                  {diffStars(lesson.difficulty)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C842', fontFamily: "'JetBrains Mono',monospace" }}>
                  +{fmtBalance(lesson.reward)} ᚙ
                </div>
                <div style={{ fontSize: 11, color: '#4A5270', marginTop: 2 }}>›</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily puzzles tab */}
      {tab === 'daily' && !loading && (
        <div style={{ paddingBottom: 40 }}>
          <div style={secLabel}>Ежедневные задачи — новые каждый день</div>
          {dailies.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 14 }}>
              Сегодня нет задач
            </div>
          )}
          {dailies.map(puzzle => (
            <div key={puzzle.id} onClick={() => navigate(`/puzzle/daily/${puzzle.id}`)} style={{
              ...card, opacity: puzzle.isCompleted ? 0.6 : 1,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: puzzle.isCompleted ? 'rgba(0,214,143,0.1)' : 'rgba(245,200,66,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {puzzle.isCompleted ? '✅' : '🎯'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {puzzle.title}
                </div>
                <div style={{ fontSize: 11, color: '#F5C842', marginTop: 1 }}>
                  {diffStars(puzzle.difficulty)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C842', fontFamily: "'JetBrains Mono',monospace" }}>
                  +{fmtBalance(puzzle.reward)} ᚙ
                </div>
                <div style={{ fontSize: 11, color: '#4A5270', marginTop: 2 }}>›</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Social tasks tab */}
      {tab === 'social' && !loading && (
        <div style={{ paddingBottom: 40 }}>
          <div style={secLabel}>Подписки, рефералы, активность</div>
          {socialTasks.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 14 }}>Нет доступных заданий</div>
          )}
          {socialTasks.map(task => (
            <div key={task.id} onClick={() => handleClaim(task)} style={{ ...card, opacity: task.isCompleted ? 0.5 : 1, cursor: task.isCompleted ? 'default' : 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: task.isCompleted ? 'rgba(0,214,143,0.1)' : 'rgba(123,97,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                📢
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>{task.isCompleted ? 'Выполнено!' : task.description}</div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#F5C842', whiteSpace: 'nowrap', marginRight: 8 }}>
                +{fmtBalance(task.reward)} ᚙ
              </span>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: task.isCompleted ? '#00D68F' : 'transparent', border: task.isCompleted ? '2px solid #00D68F' : '2px solid rgba(255,255,255,0.13)', color: '#fff' }}>
                {task.isCompleted ? '✓' : claiming === task.id ? '…' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Other tasks tab */}
      {tab === 'other' && !loading && (
        <div style={{ paddingBottom: 40 }}>
          <div style={secLabel}>Остальные задания</div>
          {otherTasks.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 14 }}>Нет доступных заданий</div>
          )}
          {otherTasks.map(task => (
            <div key={task.id} onClick={() => handleClaim(task)} style={{ ...card, opacity: task.isCompleted ? 0.5 : 1, cursor: task.isCompleted ? 'default' : 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: task.isCompleted ? 'rgba(0,214,143,0.1)' : 'rgba(123,97,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                📋
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>{task.isCompleted ? 'Выполнено!' : task.description}</div>
                {task.maxProgress && !task.isCompleted && (
                  <div style={{ height: 3, background: '#181B22', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((task.progress ?? 0) / task.maxProgress) * 100}%`, background: '#9B85FF', borderRadius: 2 }} />
                  </div>
                )}
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#F5C842', whiteSpace: 'nowrap', marginRight: 8 }}>
                +{fmtBalance(task.reward)} ᚙ
              </span>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: task.isCompleted ? '#00D68F' : 'transparent', border: task.isCompleted ? '2px solid #00D68F' : '2px solid rgba(255,255,255,0.13)', color: '#fff' }}>
                {task.isCompleted ? '✓' : claiming === task.id ? '…' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

const secLabel: React.CSSProperties = {
  fontSize: 11, color: '#4A5270', fontWeight: 600, padding: '14px 18px 8px',
  letterSpacing: '.04em',
};
const card: React.CSSProperties = {
  margin: '0 16px 8px', padding: '13px 14px',
  background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12,
  cursor: 'pointer', transition: 'opacity .2s',
};
