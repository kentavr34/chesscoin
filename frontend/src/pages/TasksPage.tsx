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

export const TasksPage: React.FC = () => {
  const t = useT();
  const tp = t.tasksPage;
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const tasksInfo = useInfoPopup('tasks', [{ icon: '📋', title: tp.infoTitle, desc: tp.infoDesc }, { icon: '👥', title: tp.infoRefTitle, desc: tp.infoRefDesc }]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<PuzzleItem | null>(null);
  const [puzzleLoading, setPuzzleLoading] = useState(true);

  const CAT_LABEL: Record<string, string> = {
    DAILY: tp.catDaily,
    LEARN: tp.catLearn,
    SOCIAL: tp.catSocial,
    OTHER: tp.catOther,
  };

  const totalReward = tasks.filter((tk) => !tk.isCompleted).reduce((s, tk) => s + BigInt(tk.reward ?? '0'), 0n);
  const completed = tasks.filter((tk) => tk.isCompleted).length;

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
      setTasks((prev) => prev.map((tk) => tk.id === task.id ? { ...tk, isCompleted: true } : tk));
      const updated = await authApi.me();
      setUser(updated);
    } catch (e: unknown) {
      window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text: (e instanceof Error ? e.message : String(e)) ?? 'Error', type: 'error' } }));
    } finally {
      setClaiming(null);
    }
  };

  const grouped = groupByCategory(tasks);

  return (
    <>
    {tasksInfo.show && <InfoPopup infoKey="tasks" slides={[{ icon: '📋', title: tp.infoTitle, desc: tp.infoDesc }, { icon: '👥', title: tp.infoRefTitle, desc: tp.infoRefDesc }]} onClose={tasksInfo.close} />}
    <PageLayout title={t.tasks.title} centered>
      {/* Progress */}
      <div style={progressStrip}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(155,109,255,.12)', border: '.5px solid rgba(155,109,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="10" width="3" height="7" rx="1.5" fill="#9B6DFF" opacity=".7"/>
            <rect x="6" y="6" width="3" height="11" rx="1.5" fill="#9B6DFF" opacity=".85"/>
            <rect x="11" y="2" width="3" height="15" rx="1.5" fill="#9B6DFF"/>
            <rect x="14.5" y="4" width="2" height="2" rx="1" fill="#C4A8FF"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C8C0E0' }}>
            {completed} / {tasks.length} {tp.completed} · +{fmtBalance(String(totalReward))} ᚙ {tp.remaining}
          </div>
          <div style={{ fontSize: 11, color: '#9A9490', marginTop: 2 }}>{tp.refreshIn} 08:38</div>
          <div style={{ height: 3, background: 'rgba(155,109,255,.12)', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%`, background: 'linear-gradient(90deg,#7B61FF,#9B85FF)', borderRadius: 2, transition: 'width .6s' }} />
          </div>
        </div>
      </div>

      {/* Daily Puzzle */}
      <div style={{ margin: '12px 18px 0' }}>
        <div style={secStyle}>{tp.dailyPuzzle}</div>
        {puzzleLoading ? (
          <div style={{ height: 80, background: 'linear-gradient(135deg,#141018,#0F0E18)', borderRadius: 14, margin: '0 0 4px', border: '.5px solid rgba(155,109,255,.12)' }} />
        ) : dailyPuzzle ? (
          <div
            onClick={() => navigate('/lesson/daily')}
            style={{
              padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
              background: 'linear-gradient(135deg,#141018,#0F0E18)',
              border: dailyPuzzle.completed
                ? '.5px solid rgba(61,186,122,.2)'
                : '.5px solid rgba(155,109,255,.22)',
              display: 'flex', alignItems: 'center', gap: 14,
              marginBottom: 4,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: dailyPuzzle.completed ? 'rgba(61,186,122,.12)' : 'rgba(155,109,255,.12)',
              border: dailyPuzzle.completed ? '.5px solid rgba(61,186,122,.3)' : '.5px solid rgba(155,109,255,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>
              {dailyPuzzle.completed ? '✅' : '♟'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC' }}>
                {dailyPuzzle.completed ? tp.dailySolved : tp.dailySolve}
              </div>
              <div style={{ fontSize: 11, color: '#9A9490', marginTop: 2 }}>
                {t.lesson.rating} {dailyPuzzle.rating} · {dailyPuzzle.themes.slice(0, 2).join(', ')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: dailyPuzzle.completed ? '#3DBA7A' : '#F0C85A' }}>
                {dailyPuzzle.completed ? `+${fmtBalance(dailyPuzzle.earnedReward ?? dailyPuzzle.reward)}` : `+${fmtBalance(dailyPuzzle.reward)}`} ᚙ
              </div>
              <div style={{ fontSize: 10, color: '#5A5248', marginTop: 2 }}>
                {dailyPuzzle.completed ? tp.earned : tp.solve}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: '#5A5248' }}>
            {tp.unavailable}
          </div>
        )}

        {/* Practice buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8, marginBottom: 4 }}>
          {(['easy', 'medium', 'hard'] as const).map((diff) => {
            const diffColors = {
              easy: { dot: '#3DBA7A', border: 'rgba(61,186,122,.3)', activeBg: 'rgba(61,186,122,.08)', label: '#3DBA7A' },
              medium: { dot: '#F0C85A', border: 'rgba(240,200,90,.3)', activeBg: 'rgba(240,200,90,.08)', label: '#F0C85A' },
              hard: { dot: '#FF5B5B', border: 'rgba(255,91,91,.3)', activeBg: 'rgba(255,91,91,.08)', label: '#FF5B5B' },
            };
            const dc = diffColors[diff];
            const labels = { easy: tp.easy, medium: tp.medium, hard: tp.hard };
            return (
              <div key={diff} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => navigate(`/lesson/random?difficulty=${diff}&mode=learn`)}
                  style={{
                    padding: '9px 6px',
                    background: 'linear-gradient(135deg,#141018,#0F0E18)',
                    border: `.5px solid ${dc.border}`,
                    borderRadius: '12px 12px 4px 4px',
                    color: '#9A9490', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: dc.dot, boxShadow: `0 0 6px ${dc.dot}55` }} />
                  <span style={{ color: dc.label, fontSize: 10, fontWeight: 700 }}>{labels[diff]}</span>
                </button>
                <button
                  onClick={() => navigate(`/lesson/random?difficulty=${diff}&mode=test`)}
                  style={{
                    padding: '6px 4px',
                    background: dc.activeBg,
                    border: `.5px solid ${dc.border}`,
                    borderRadius: '4px 4px 12px 12px',
                    color: dc.label, fontSize: 9, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  title={tp.testMode}
                >
                  ×1.5
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#5A5248', padding: 32 }}>{t.common.loading}</div>}

      {!loading && tasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(155,109,255,.1)', border: '.5px solid rgba(155,109,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <rect x="4" y="3" width="18" height="20" rx="3" stroke="#9B6DFF" strokeWidth="1.2"/>
              <path d="M8 9h10M8 13h10M8 17h6" stroke="#9B6DFF" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#EAE2CC', marginBottom: 8 }}>
            {tp.comingSoon}
          </div>
          <div style={{ fontSize: 13, color: '#9A9490', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {tp.emptyDesc}
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
              style={{
                margin: '0 18px 8px',
                padding: '13px 14px',
                background: 'linear-gradient(135deg,#141018,#0F0E18)',
                border: task.isCompleted
                  ? '.5px solid rgba(61,186,122,.15)'
                  : '.5px solid rgba(155,109,255,.12)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all .2s',
                opacity: task.isCompleted ? 0.45 : 1,
                cursor: task.isCompleted ? 'default' : 'pointer',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
                background: task.isCompleted ? 'rgba(61,186,122,.1)' : 'rgba(155,109,255,.12)',
                border: task.isCompleted ? '.5px solid rgba(61,186,122,.2)' : '.5px solid rgba(155,109,255,.15)',
              }}>
                {CATEGORY_ICONS[cat] ?? '📋'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#EAE2CC' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: '#9A9490', marginTop: 2 }}>
                  {task.isCompleted ? t.tasks.completed : task.description}
                </div>
                {task.maxProgress && !task.isCompleted && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: '#5A5248' }}>{tp.progress}</span>
                      <span style={{ fontSize: 9, color: '#C4A8FF', fontWeight: 700 }}>
                        {task.progress ?? 0} / {task.maxProgress}
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(155,109,255,.1)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, ((task.progress ?? 0) / task.maxProgress) * 100)}%`, background: 'linear-gradient(90deg,#7B61FF,#9B85FF)', borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                  </div>
                )}
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#F0C85A', whiteSpace: 'nowrap', marginRight: 8 }}>
                +{fmtBalance(task.reward ?? '0')} ᚙ
              </span>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                background: task.isCompleted ? 'rgba(61,186,122,.2)' : 'transparent',
                border: task.isCompleted ? '.5px solid #3DBA7A' : '.5px solid rgba(155,109,255,.2)',
                color: task.isCompleted ? '#3DBA7A' : '#9B6DFF',
                fontWeight: 700,
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

const progressStrip: React.CSSProperties = {
  margin: '4px 18px 0',
  padding: '13px 16px',
  background: 'linear-gradient(135deg,#141018,#0F0E18)',
  border: '.5px solid rgba(155,109,255,.18)',
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const secStyle: React.CSSProperties = {
  fontSize: '.58rem',
  fontWeight: 700,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: '#7A7875',
  padding: '16px 18px 8px',
};
