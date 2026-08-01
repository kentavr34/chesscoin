/**
 * Экран урока: доска, разбор сценария и постоянная нижняя навигация.
 *
 * Кенан 01.08.2026: «человек смотрит обучение, а потом тест нажимает. Когда
 * тест нажимает, доска уже не играет, ждёт, чтобы он сам сыграл. Та же самая
 * доска, только внизу две кнопки. Закончил тест — появляется следующая и
 * вернуться в меню».
 *
 * Он же, вечером того же дня, по дизайну:
 *  • маленькая кнопка «← Уроки» непропорциональна — вместо неё нижняя панель
 *    из четырёх квадратных кнопок: обучение, тест, следующий, меню. Панель
 *    постоянная и ничего не перекрывает;
 *  • пояснение висело слишком высоко, между ним и доской была пустота —
 *    текст опущен вниз, вплотную к доске;
 *  • стрелки «‹ ›» заменены привычным набором из разбора партий: в начало,
 *    шаг назад, воспроизведение, шаг вперёд, в конец. Ходы выписаны строкой,
 *    по ним можно кликать. В тесте эта же строка показывает ходы игрока.
 *
 * Отличие от страницы задачи: здесь не проверка мышления, а показ приёма.
 * Поэтому в обучении ходы листаются сколько угодно, а ошибка в тесте ничего
 * не стоит — попытки не тратятся.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { lessonsApi, tasksApi, type LessonItem } from '@/api';
import { useT, useText } from '@/i18n/useT';
import { fmtBalance } from '@/utils/format';
import { haptic } from '@/lib/haptic';
import { CoinIcon } from '@/components/ui/CoinIcon';
import {
  IcoToStart, IcoToEnd, IcoStepBack, IcoStepFwd, IcoPlay, IcoPause,
  IcoBook, IcoTarget, IcoList,
} from '@/components/icons/UiIcons';

type Mode = 'learn' | 'test';
type Phase = 'loading' | 'ready' | 'done' | 'notfound';

const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';
/** Пауза между ходами при воспроизведении. */
const PLAY_STEP_MS = 950;

/** Позиция после первых n ходов сценария. */
function positionAfter(fen: string, moves: string[], n: number): string {
  // Компонент считает позицию на каждой отрисовке, в том числе пока урок ещё
  // грузится и fen пустой. new Chess('') бросает исключение, и весь экран
  // падал в «Something went wrong» (поймано живой проверкой 01.08.2026).
  if (!fen) return EMPTY_FEN;
  let chess: Chess;
  try { chess = new Chess(fen); } catch { return EMPTY_FEN; }
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
  const [playing, setPlaying] = useState(false);
  // Тест: сколько ходов сценария игрок уже воспроизвёл.
  const [played, setPlayed] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [reward, setReward] = useState<string | null>(null);

  // Название и пояснение живут в таблице текстов под ключом с номером урока.
  const lessonTitle = useText(`lessons.item.${lessonId}.title`);
  const explain = useText(`lessons.item.${lessonId}.explain`);
  const navNext = useText('lessons.nav.next', 'Следующий');
  const navMenu = useText('lessons.nav.menu', 'Меню');

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
        setShown(0); setPlayed(0); setWrong(false); setMode('learn');
        setReward(null); setPlaying(false);
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

  // Ходы в шахматной записи — их и показываем строкой под доской.
  const sanList = useMemo(() => {
    if (!startFen) return [] as string[];
    let chess: Chess;
    try { chess = new Chess(startFen); } catch { return [] as string[]; }
    const out: string[] = [];
    for (const uci of moves) {
      try {
        const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
        if (!m) break;
        out.push(m.san);
      } catch { break; }
    }
    return out;
  }, [startFen, moves]);

  const boardSide: 'white' | 'black' = (() => {
    if (!startFen) return 'white';
    try { return new Chess(startFen).turn() === 'b' ? 'black' : 'white'; }
    catch { return 'white'; }
  })();

  const fen = mode === 'learn'
    ? positionAfter(startFen, moves, shown)
    : positionAfter(startFen, moves, played);

  // Воспроизведение сценария: шаг за шагом до конца, потом само останавливается.
  useEffect(() => {
    if (!playing || mode !== 'learn') return;
    if (shown >= moves.length) { setPlaying(false); return; }
    const id = setTimeout(() => setShown(n => Math.min(moves.length, n + 1)), PLAY_STEP_MS);
    return () => clearTimeout(id);
  }, [playing, shown, moves.length, mode]);

  // Ход можно сделать и кликом: две клетки подряд. На телефоне это основной
  // способ, перетаскивание вторично.
  const [selected, setSelected] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    if (phase === 'done' && m === 'test') return;
    setMode(m);
    setWrong(false);
    setSelected(null);
    setPlaying(false);
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

  const title = lessonTitle || `${t.lessons.lesson} ${lesson.id}`;
  const atEnd = shown >= moves.length;
  const cursor = mode === 'learn' ? shown : played;
  const canNext = nextId !== null && phase === 'done';

  return (
    <Shell>
      {/* Заголовок, пояснение и доска — один блок по центру экрана. Пустоты
          между текстом и доской нет, свободное место делится сверху и снизу. */}
      <div style={S.top}>
        <div style={S.title}>{t.lessons.lesson} {lesson.id} · {title}</div>
        <div style={S.explain}>{explain}</div>

      <div ref={boardBoxRef} style={S.boardBox}>
        <div style={{ width: boardWidth }}>
          <Chessboard
            position={fen}
            boardOrientation={boardSide}
            arePiecesDraggable={mode === 'test' && phase === 'ready'}
            onPieceDrop={(from, to) => { setSelected(null); return tryMove(from, to); }}
            onSquareClick={(square) => {
              if (mode !== 'test') return;
              if (!selected) { setSelected(square); return; }
              if (selected === square) { setSelected(null); return; }
              tryMove(selected, square);
              setSelected(null);
            }}
            customSquareStyles={selected ? { [selected]: { background: 'rgba(123,97,255,.4)' } } : {}}
            customBoardStyle={{ borderRadius: 10 }}
          />
        </div>
      </div>
      </div>

      {/* Запись партии: в обучении по ней можно перематывать, в тесте она
          просто показывает ходы, которые игрок уже сделал. */}
      <div style={S.sanRow}>
        {sanList.length === 0 ? <span style={S.sanEmpty}>—</span> : sanList.map((san, i) => {
          const visible = mode === 'learn' || i < played;
          const active = i === cursor - 1;
          return (
            <span
              key={i}
              onClick={() => { if (mode === 'learn') { setPlaying(false); setShown(i + 1); } }}
              style={{
                ...S.san,
                ...(active ? S.sanActive : {}),
                opacity: visible ? 1 : .25,
                cursor: mode === 'learn' ? 'pointer' : 'default',
              }}
            >
              {i % 2 === 0 && <span style={S.sanNum}>{i / 2 + 1}.</span>}
              {visible ? san : '···'}
            </span>
          );
        })}
      </div>

      <div style={S.hint}>
        {phase === 'done' ? (
          <span style={{ color: '#3DBA7A', fontWeight: 800 }}>
            {t.lessons.done}
            {reward && (
              <span style={S.rewardRow}>
                <CoinIcon size={13} /> +{fmtBalance(reward)}
              </span>
            )}
          </span>
        ) : wrong ? (
          <span style={{ color: '#FF5B5B' }}>{t.lessons.testWrong}</span>
        ) : mode === 'learn' ? t.lessons.watchHint : t.lessons.testHint}
      </div>

      {/* Перемотка — только в обучении. В тесте ходы делает сам игрок, там
          нужна одна кнопка «сначала». */}
      {mode === 'learn' ? (
        <div style={S.player}>
          <button onClick={() => { setPlaying(false); setShown(0); }} disabled={shown === 0}
                  style={{ ...S.pBtn, opacity: shown === 0 ? .3 : 1 }} aria-label="start">
            <IcoToStart size={16} color="#EAE2CC" />
          </button>
          <button onClick={() => { setPlaying(false); setShown(n => Math.max(0, n - 1)); }} disabled={shown === 0}
                  style={{ ...S.pBtn, opacity: shown === 0 ? .3 : 1 }} aria-label="prev">
            <IcoStepBack size={16} color="#EAE2CC" />
          </button>
          <button onClick={() => { if (atEnd) setShown(0); setPlaying(p => !p); }}
                  style={{ ...S.pBtn, ...S.pBtnMain }} aria-label="play">
            {playing ? <IcoPause size={17} color="#F0C85A" /> : <IcoPlay size={17} color="#F0C85A" />}
          </button>
          <button onClick={() => { setPlaying(false); setShown(n => Math.min(moves.length, n + 1)); }} disabled={atEnd}
                  style={{ ...S.pBtn, opacity: atEnd ? .3 : 1 }} aria-label="next">
            <IcoStepFwd size={16} color="#EAE2CC" />
          </button>
          <button onClick={() => { setPlaying(false); setShown(moves.length); }} disabled={atEnd}
                  style={{ ...S.pBtn, opacity: atEnd ? .3 : 1 }} aria-label="end">
            <IcoToEnd size={16} color="#EAE2CC" />
          </button>
        </div>
      ) : (
        <div style={S.player}>
          <button onClick={() => { setPlayed(0); setWrong(false); setSelected(null); }}
                  disabled={phase === 'done'}
                  style={{ ...S.pBtn, width: 'auto', padding: '0 18px', fontSize: 12, fontWeight: 700,
                           color: '#EAE2CC', opacity: phase === 'done' ? .3 : 1 }}>
            {t.lessons.restart}
          </button>
        </div>
      )}

      {/* Постоянная навигация: ничего не перекрывает, всегда на месте. */}
      <nav style={S.nav}>
        <NavBtn icon={<IcoBook size={17} color={mode === 'learn' ? '#82CFFF' : '#7A7875'} />}
                label={t.lessons.learnBtn} active={mode === 'learn'} accent="#82CFFF"
                onClick={() => switchMode('learn')} />
        <NavBtn icon={<IcoTarget size={17} color={mode === 'test' ? '#F0C85A' : '#7A7875'} />}
                label={t.lessons.testBtn} active={mode === 'test'} accent="#F0C85A"
                disabled={phase === 'done'}
                onClick={() => switchMode('test')} />
        <NavBtn icon={<IcoStepFwd size={17} color={canNext ? '#3DBA7A' : '#7A7875'} />}
                label={navNext} accent="#3DBA7A" disabled={!canNext}
                onClick={() => nextId && navigate(`/learn/${nextId}`)} />
        <NavBtn icon={<IcoList size={17} color="#7A7875" />}
                label={navMenu} onClick={() => navigate('/lessons')} />
      </nav>
    </Shell>
  );
};

const NavBtn: React.FC<{
  icon: React.ReactNode; label: string; active?: boolean;
  accent?: string; disabled?: boolean; onClick: () => void;
}> = ({ icon, label, active, accent = '#9A9490', disabled, onClick }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
      padding: '11px 4px', borderRadius: 14, cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'inherit', fontSize: 11, fontWeight: 800, lineHeight: 1.1,
      background: active ? `${accent}22` : 'rgba(255,255,255,.05)',
      border: `.5px solid ${active ? `${accent}59` : 'rgba(255,255,255,.1)'}`,
      color: active ? accent : '#7A7875',
      opacity: disabled ? .35 : 1,
    }}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    position: 'fixed', inset: 0, background: '#0B0D11',
    display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden',
  }}>{children}</div>
);

const S: Record<string, React.CSSProperties> = {
  center:   { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9490', fontSize: 13 },
  top:      { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 18px 0' },
  title:    { fontSize: 16, fontWeight: 800, color: '#EAE2CC', marginBottom: 6 },
  explain:  { fontSize: 12, color: '#9A9490', lineHeight: 1.6, marginBottom: 12 },
  boardBox: { flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 -6px' },
  sanRow:   { display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 6, padding: '10px 18px 0', minHeight: 30, alignItems: 'center' },
  san:      { display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, padding: '3px 7px', borderRadius: 7, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#9A9490', background: 'rgba(255,255,255,.04)' },
  sanActive:{ background: 'rgba(123,97,255,.22)', color: '#C4B5FF' },
  sanNum:   { color: '#5A5248', fontSize: 10 },
  sanEmpty: { fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#5A5248' },
  hint:     { textAlign: 'center', fontSize: 12, color: '#9A9490', padding: '6px 18px', minHeight: 30 },
  rewardRow:{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 10, fontSize: 13, fontWeight: 800, color: '#F0C85A' },
  player:   { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 18px 12px' },
  pBtn:     { width: 46, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.1)', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit' },
  pBtnMain: { background: 'rgba(240,200,90,.13)', border: '.5px solid rgba(240,200,90,.3)' },
  nav:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: '0 14px calc(14px + env(safe-area-inset-bottom, 0px))' },
  ghost:    { padding: '13px', background: 'rgba(255,255,255,.06)', border: '.5px solid rgba(255,255,255,.1)', borderRadius: 14, color: '#9A9490', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
