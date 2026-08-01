/**
 * Экран урока: доска, внизу две кнопки — «Обучение» и «Тест».
 *
 * Кенан 01.08.2026: «человек смотрит обучение, а потом тест нажимает. Когда
 * тест нажимает, доска уже не играет, ждёт, чтобы он сам сыграл. Та же самая
 * доска, только внизу две кнопки. Закончил тест — появляется следующая и
 * вернуться в меню».
 *
 * Отличие от страницы задачи: здесь не проверка мышления, а показ приёма.
 * Поэтому в обучении ходы листаются вперёд и назад сколько угодно, а ошибка
 * в тесте ничего не стоит — попытки не тратятся.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { lessonsApi, tasksApi, type LessonItem } from '@/api';
import { useT } from '@/i18n/useT';
import { fmtBalance } from '@/utils/format';
import { haptic } from '@/lib/haptic';
import { CoinIcon } from '@/components/ui/CoinIcon';

type Mode = 'learn' | 'test';
type Phase = 'loading' | 'ready' | 'done' | 'notfound';

/** Позиция после первых n ходов сценария. */
function positionAfter(fen: string, moves: string[], n: number): string {
  const chess = new Chess(fen);
  for (let i = 0; i < n && i < moves.length; i++) {
    const uci = moves[i];
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
    } catch { break; }
  }
  return chess.fen();
}

export const LessonLearnPage: React.FC = () => {
  const t = useT();
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId: string }>();

  const [lesson, setLesson] = useState<LessonItem | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [mode, setMode] = useState<Mode>('learn');

  // Обучение: сколько ходов сценария уже показано.
  const [shown, setShown] = useState(0);
  // Тест: сколько ходов сценария игрок уже воспроизвёл.
  const [played, setPlayed] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [reward, setReward] = useState<string | null>(null);

  const boardBoxRef = useRef<HTMLDivElement | null>(null);
  const [boardWidth, setBoardWidth] = useState(340);

  useEffect(() => {
    let alive = true;
    setPhase('loading');
    lessonsApi.get(Number(lessonId))
      .then(r => {
        if (!alive) return;
        setLesson(r.lesson);
        setNextId(r.nextId);
        setShown(0); setPlayed(0); setWrong(false); setMode('learn'); setReward(null);
        setPhase('ready');
      })
      .catch(() => alive && setPhase('notfound'));
    return () => { alive = false; };
  }, [lessonId]);

  // Ширина доски — от контейнера, а не от окна (правило проекта).
  useEffect(() => {
    const el = boardBoxRef.current;
    if (!el) return;
    const apply = () => setBoardWidth(Math.min(el.clientWidth - 24, 380));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  const moves = lesson?.moves ?? [];
  const startFen = lesson?.fen ?? '';
  const boardSide: 'white' | 'black' =
    startFen && new Chess(startFen).turn() === 'b' ? 'black' : 'white';

  const fen = mode === 'learn'
    ? positionAfter(startFen, moves, shown)
    : positionAfter(startFen, moves, played);

  const switchMode = (m: Mode) => {
    setMode(m);
    setWrong(false);
    if (m === 'test') setPlayed(0);
    else setShown(0);
  };

  // ── Тест: принимаем только ход из сценария ────────────────────────────────
  const tryMove = useCallback((from: string, to: string) => {
    if (mode !== 'test' || !lesson || phase !== 'ready') return false;
    const expected = moves[played];
    if (!expected) return false;

    if (from !== expected.slice(0, 2) || to !== expected.slice(2, 4)) {
      setWrong(true);
      haptic.impact('heavy');
      return false;
    }

    haptic.impact('medium');
    setWrong(false);
    const afterPlayer = played + 1;

    // Ответ соперника — часть сценария, не движок: показываем его сами.
    const hasReply = afterPlayer < moves.length;
    setPlayed(hasReply ? afterPlayer + 1 : afterPlayer);

    if (!hasReply) {
      setPhase('done');
      haptic.win?.() ?? haptic.impact('heavy');
      // Урок засчитывается там же, где и раньше: единый прогресс и награда.
      tasksApi.completeLesson(lesson.id)
        .then(r => setReward(r.reward ?? null))
        .catch(() => {}); // уже пройден — не ошибка, показывать нечего
    }
    return true;
  }, [mode, lesson, phase, moves, played]);

  if (phase === 'loading') {
    return <Shell><div style={S.center}>{t.lesson.loading}</div></Shell>;
  }
  if (phase === 'notfound' || !lesson) {
    return (
      <Shell>
        <div style={S.center}>{t.lesson.notFound}</div>
        <button onClick={() => navigate('/lessons')} style={S.ghost}>{t.lessons.toMenu}</button>
      </Shell>
    );
  }

  const title = (t.lessons as Record<string, any>)?.item?.[lesson.id]?.title ?? `${t.lessons.lesson} ${lesson.id}`;
  const explain = (t.lessons as Record<string, any>)?.item?.[lesson.id]?.explain ?? '';

  return (
    <Shell>
      <div style={{ padding: '10px 18px 0' }}>
        <button onClick={() => navigate('/lessons')} style={S.back}>← {t.lessons.title}</button>
        <div style={S.title}>{t.lessons.lesson} {lesson.id} · {title}</div>
        <div style={S.explain}>{explain}</div>
      </div>

      <div ref={boardBoxRef} style={S.boardBox}>
        <div style={{ width: boardWidth }}>
          <Chessboard
            position={fen}
            boardOrientation={boardSide}
            arePiecesDraggable={mode === 'test' && phase === 'ready'}
            onPieceDrop={(from, to) => tryMove(from, to)}
            customBoardStyle={{ borderRadius: 10 }}
          />
        </div>
      </div>

      {phase === 'done' ? (
        <div style={{ padding: '4px 18px 18px', textAlign: 'center' }}>
          <div style={S.doneTitle}>{t.lessons.done}</div>
          {reward && (
            <div style={S.rewardRow}>
              <CoinIcon size={14} /> +{fmtBalance(reward)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => navigate('/lessons')} style={{ ...S.ghost, flex: 1 }}>
              {t.lessons.toMenu}
            </button>
            {nextId && (
              <button onClick={() => navigate(`/learn/${nextId}`)} style={{ ...S.gold, flex: 1 }}>
                {t.lessons.nextLesson}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={S.hint}>
            {wrong ? <span style={{ color: '#FF5B5B' }}>{t.lessons.testWrong}</span>
              : mode === 'learn' ? t.lessons.watchHint : t.lessons.testHint}
          </div>

          {mode === 'learn' && (
            <div style={S.stepRow}>
              <button
                onClick={() => setShown(n => Math.max(0, n - 1))}
                disabled={shown === 0}
                style={{ ...S.step, opacity: shown === 0 ? .35 : 1 }}
              >‹</button>
              <div style={S.stepCount}>{shown} / {moves.length}</div>
              <button
                onClick={() => setShown(n => Math.min(moves.length, n + 1))}
                disabled={shown >= moves.length}
                style={{ ...S.step, opacity: shown >= moves.length ? .35 : 1 }}
              >›</button>
            </div>
          )}

          {mode === 'test' && played > 0 && (
            <div style={S.stepRow}>
              <button onClick={() => { setPlayed(0); setWrong(false); }} style={S.step}>
                {t.lessons.restart}
              </button>
            </div>
          )}

          <div style={S.tabs}>
            <button
              onClick={() => switchMode('learn')}
              style={{ ...S.tab, ...(mode === 'learn' ? S.tabActive : {}) }}
            >{t.lessons.learnBtn}</button>
            <button
              onClick={() => switchMode('test')}
              style={{ ...S.tab, ...(mode === 'test' ? S.tabActiveGold : {}) }}
            >{t.lessons.testBtn}</button>
          </div>
        </>
      )}
    </Shell>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    position: 'fixed', inset: 0, background: '#0B0D11',
    display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden',
  }}>{children}</div>
);

const S: Record<string, React.CSSProperties> = {
  center:   { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9490', fontSize: 13 },
  back:     { background: 'transparent', border: 'none', color: '#7A7875', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 8 },
  title:    { fontSize: 16, fontWeight: 800, color: '#EAE2CC', marginBottom: 6 },
  explain:  { fontSize: 12, color: '#9A9490', lineHeight: 1.6, marginBottom: 6 },
  boardBox: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' },
  hint:     { textAlign: 'center', fontSize: 12, color: '#9A9490', padding: '4px 18px 8px', minHeight: 32 },
  stepRow:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 10 },
  step:     { minWidth: 44, padding: '8px 14px', background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#EAE2CC', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  stepCount:{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#7A7875', minWidth: 54, textAlign: 'center' },
  tabs:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 18px calc(18px + env(safe-area-inset-bottom, 0px))' },
  tab:      { padding: '14px', borderRadius: 14, border: '.5px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: '#9A9490', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  tabActive:     { background: 'rgba(74,158,255,.15)', border: '.5px solid rgba(74,158,255,.35)', color: '#82CFFF' },
  tabActiveGold: { background: 'rgba(240,200,90,.15)', border: '.5px solid rgba(240,200,90,.35)', color: '#F0C85A' },
  doneTitle:{ fontSize: 18, fontWeight: 900, color: '#3DBA7A', marginBottom: 6 },
  rewardRow:{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: '#F0C85A' },
  ghost:    { padding: '13px', background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)', borderRadius: 14, color: '#9A9490', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  gold:     { padding: '13px', background: 'rgba(240,200,90,.15)', border: '.5px solid rgba(240,200,90,.35)', borderRadius: 14, color: '#F0C85A', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
};
