/**
 * LessonPage — страница решения шахматной задачи
 * Маршрут: /lesson/:puzzleId?difficulty=easy|medium|hard
 * Также используется для Задачи дня: /lesson/daily
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { puzzlesApi, type PuzzleItem } from '@/api';
import { fmtBalance } from '@/utils/format';
import { haptic } from '@/lib/haptic';
import { useUserStore } from '@/store/useUserStore';
import { authApi } from '@/api';
import { useT } from '@/i18n/useT';
import { VictoryScreen } from '@/components/game/VictoryScreen';

// UCI ход → human-readable
function uciToSan(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2) as import("chess.js").Square; // R1
    const to   = uci.slice(2, 4) as import("chess.js").Square; // R1
    const promo = uci[4] as import("chess.js").Square; // R1
    const result = chess.move({ from, to, promotion: promo ?? 'q' });
    return result?.san ?? uci;
  } catch { return uci; }
}

type Phase = 'loading' | 'intro' | 'playing' | 'correct' | 'wrong' | 'solved';

export const LessonPage: React.FC = () => {
  const t = useT();
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useUserStore();

  // Режим: "learn" (подсказки) или "test" (без подсказок, награда ×1.5)
  const mode = (searchParams.get('mode') ?? 'learn') as 'learn' | 'test';
  const isTestMode = mode === 'test';

  const [puzzle, setPuzzle] = useState<PuzzleItem | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [chess, setChess] = useState<Chess>(new Chess());
  const [fen, setFen] = useState('');
  const [playerMoves, setPlayerMoves] = useState<string[]>([]);   // UCI ходы игрока
  const [solutionIdx, setSolutionIdx] = useState(0);              // текущий индекс в решении
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [wrongSquare, setWrongSquare] = useState<string | null>(null);
  const [reward, setReward] = useState<string>('0');
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [showFanfare, setShowFanfare] = useState(false);

  // Загрузка задачи
  useEffect(() => {
    loadPuzzle();
  }, [puzzleId]);

  const loadPuzzle = async () => {
    setPhase('loading');
    try {
      let data: { puzzle: PuzzleItem };
      if (puzzleId === 'daily') {
        data = await puzzlesApi.daily();
      } else if (puzzleId === 'random') {
        const diff = (searchParams.get('difficulty') ?? 'medium') as 'easy' | 'medium' | 'hard';
        data = await puzzlesApi.random(diff);
      } else {
        data = await puzzlesApi.get(puzzleId!);
      }
      setPuzzle(data.puzzle);
      initGame(data.puzzle);
    } catch (e) {
      console.error(e);
      setPhase('intro');
    }
  };

  const initGame = (p: PuzzleItem) => {
    const c = new Chess(p.fen);
    setChess(c);
    setFen(p.fen);
    setPlayerMoves([]);
    setSolutionIdx(0);
    setIsPlayerTurn(false);
    setHint(null);
    setPhase('intro');
  };

  // Начинаем — противник делает первый ход автоматически
  const startPuzzle = useCallback(() => {
    if (!puzzle) return;
    setPhase('playing');

    // Первый ход в solution — ход противника
    if (puzzle.moves.length > 0) {
      setTimeout(() => {
        applyOpponentMove(puzzle, new Chess(puzzle.fen), 0);
      }, 600);
    }
  }, [puzzle]);

  const applyOpponentMove = (p: PuzzleItem, c: Chess, idx: number) => {
    const uci = p.moves[idx];
    if (!uci) return;
    const from = uci.slice(0, 2) as import("chess.js").Square; // R1
    const to   = uci.slice(2, 4) as import("chess.js").Square; // R1
    const promo = uci[4] as import("chess.js").Square; // R1
    c.move({ from, to, promotion: promo ?? 'q' });
    setChess(new Chess(c.fen()));
    setFen(c.fen());
    setSolutionIdx(idx + 1);
    setIsPlayerTurn(true);
    haptic.impact('light');
  };

  // Обработка хода игрока
  const handleSquareClick = (square: string) => {
    if (!isPlayerTurn || phase !== 'playing') return;

    if (selectedSquare) {
      // Попытка сделать ход
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setOptionSquares({});
        return;
      }
      tryMove(selectedSquare, square);
      setSelectedSquare(null);
      setOptionSquares({});
    } else {
      // Выбор фигуры
      const piece = chess.get(square as import("chess.js").Square);
      if (!piece || piece.color !== chess.turn()) return;
      setSelectedSquare(square);
      showMoveOptions(square);
    }
  };

  const showMoveOptions = (square: string) => {
    const moves = chess.moves({ square: square as import("chess.js").Square, verbose: true });
    const sq: Record<string, React.CSSProperties> = {
      [square]: { background: 'rgba(123,97,255,0.4)' },
    };
    for (const m of moves) {
      const isCapture = !!chess.get(m.to as import("chess.js").Square);
      sq[m.to] = {
        background: isCapture
          ? 'radial-gradient(circle, rgba(255,77,106,0.5) 100%, transparent 100%)'
          : 'radial-gradient(circle, rgba(123,97,255,0.5) 25%, transparent 25%)',
      };
    }
    setOptionSquares(sq);
  };

  const tryMove = (from: string, to: string) => {
    if (!puzzle) return;

    const uci = from + to;
    const expectedUci = puzzle.moves[solutionIdx];
    if (!expectedUci) return;

    const expectedFrom = expectedUci.slice(0, 2);
    const expectedTo   = expectedUci.slice(2, 4);

    // Пробуем применить ход
    try {
      const tempChess = new Chess(chess.fen());
      const move = tempChess.move({ from: from as import("chess.js").Square, to: to as import("chess.js").Square, promotion: 'q' });
      if (!move) return;

      const actualUci = move.from + move.to + (move.promotion ?? '');

      if (from === expectedFrom && to === expectedTo) {
        // ✅ Правильный ход
        haptic.impact('medium');
        setChess(tempChess);
        setFen(tempChess.fen());
        const newMoves = [...playerMoves, actualUci];
        setPlayerMoves(newMoves);
        const nextIdx = solutionIdx + 1;
        setHint(null);
        setWrongSquare(null);

        // Проверяем — конец решения?
        if (nextIdx >= puzzle.moves.length) {
          // {t.lesson.solved}
          setIsPlayerTurn(false);
          setPhase('correct');
          submitSolution([...newMoves]);
        } else {
          // Противник отвечает
          setSolutionIdx(nextIdx);
          setIsPlayerTurn(false);
          setTimeout(() => {
            applyOpponentMove(puzzle, tempChess, nextIdx);
          }, 700);
        }
      } else {
        // ❌ Неверный ход
        haptic.impact('heavy');
        setWrongSquare(to);
        setPhase('wrong');
        setTimeout(() => {
          setWrongSquare(null);
          setPhase('playing');
        }, 1000);
        // В режиме тест — без подсказок
        if (!isTestMode) {
          const san = uciToSan(chess.fen(), expectedUci);
          setHint(`${t.lesson.wrong}${san}`);
        } else {
          setHint(null);
        }
      }
    } catch {
      haptic.impact('heavy');
    }
  };

  const handlePieceDrop = (from: string, to: string) => {
    tryMove(from, to);
    setSelectedSquare(null);
    setOptionSquares({});
    return true;
  };

  const submitSolution = async (moves: string[]) => {
    if (!puzzle) return;
    const playerOnlyMoves = puzzle.moves
      .map((_, i) => i)
      .filter(i => i % 2 === 1)
      .map(i => moves[Math.floor(i / 2)]);

    try {
      const r = await puzzlesApi.complete(puzzle.id, playerOnlyMoves, isTestMode);
      if (r.correct) {
        const displayReward = isTestMode && !r.alreadySolved
          ? String(Math.floor(Number(r.reward) * 1.5))
          : r.reward;
        setReward(displayReward);
        setPhase('solved');
        setShowFanfare(true);
        haptic.win?.() ?? haptic.impact('heavy');
        const updated = await authApi.me();
        setUser(updated);
      }
    } catch (e) {
      console.error(e);
      setPhase('solved');
    }
  };

  const diffLabel: Record<string, string> = { easy: '🟢 Лёгкая', medium: '🟡 Средняя', hard: '🔴 Сложная' };
  const getDiff = (rating: number) =>
    rating < 1200 ? 'easy' : rating < 1700 ? 'medium' : 'hard';

  if (phase === 'loading') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg, #0B0D11)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(123,97,255,0.3)', borderTopColor: '#7B61FF', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <div style={{ color: 'var(--text-muted, #4A5270)', fontSize: 13 }}>Загружаем задачу...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg, #0B0D11)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)', textAlign: 'center' }}>Задача не найдена</div>
        <button onClick={() => navigate('/tasks')} style={goldBtn}>← Назад</button>
      </div>
    );
  }

  const diff = getDiff(puzzle.rating);
  const boardSize = Math.min(window.innerWidth - 32, 380);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg, #0B0D11)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Топбар */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', paddingTop: 'max(14px, env(safe-area-inset-top,14px))', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={backBtn}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>
            {puzzle.isDaily ? `📅 ${t.lesson.daily}` : `🧩 ${t.lesson.title}`}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
            {diffLabel[diff]} · Рейтинг {puzzle.rating} · +{fmtBalance(puzzle.reward)} ᚙ
          </div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Тематики */}
      {puzzle.themes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 18px', flexWrap: 'wrap', flexShrink: 0 }}>
          {puzzle.themes.slice(0, 4).map(theme => (
            <span key={theme} style={{ padding: '3px 8px', background: 'rgba(123,97,255,0.12)', border: '1px solid rgba(123,97,255,0.2)', borderRadius: 8, fontSize: 10, color: '#9B85FF', fontWeight: 600 }}>
              {theme}
            </span>
          ))}
        </div>
      )}

      {/* Доска */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px', gap: 16 }}>
        <div style={{ position: 'relative' }}>
          <Chessboard
            id="lesson-board"
            position={fen}
            boardWidth={boardSize}
            onSquareClick={handleSquareClick}
            onPieceDrop={(from, to) => { handlePieceDrop(from, to); return true; }}
            arePiecesDraggable={isPlayerTurn && phase === 'playing'}
            customDarkSquareStyle={{ backgroundColor: '#B7C0D8' }}
            customLightSquareStyle={{ backgroundColor: '#E8EDF9' }}
            customSquareStyles={{
              ...optionSquares,
              ...(selectedSquare ? { [selectedSquare]: { background: 'rgba(123,97,255,0.45)' } } : {}),
              ...(wrongSquare ? { [wrongSquare]: { background: 'rgba(255,77,106,0.5)' } } : {}),
            }}
            customBoardStyle={{ borderRadius: 12 }}
          />
        </div>

        {/* Статус */}
        <div style={{ textAlign: 'center', minHeight: 52 }}>
          {phase === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)' }}>
                {chess.turn() === 'w' ? t.lesson.whiteToMove : t.lesson.blackToMove}
              </div>
              <button onClick={startPuzzle} style={goldBtn}>▶ Начать решение</button>
            </div>
          )}
          {phase === 'playing' && (
            <div style={{ fontSize: 13, color: isPlayerTurn ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)', fontWeight: isPlayerTurn ? 700 : 400 }}>
              {isPlayerTurn ? t.lesson.yourTurn : t.lesson.opponentThinking}
            </div>
          )}
          {phase === 'wrong' && (
            <div style={{ fontSize: 13, color: 'var(--red, #FF4D6A)', fontWeight: 700, animation: 'shake .3s' }}>
              ❌ Неверно! {hint}
            </div>
          )}
          {phase === 'correct' && (
            <div style={{ fontSize: 13, color: 'var(--green, #00D68F)', fontWeight: 700 }}>
              ✅ Правильно! Проверяем...
            </div>
          )}
          {phase === 'solved' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 32 }}>🏆</div>
              <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--accent, #F5C842)' }}>
                {t.lesson.solved}
              </div>
              {BigInt(reward || '0') > 0n && (
                <div style={{ fontSize: 15, color: 'var(--green, #00D68F)', fontWeight: 700 }}>
                  {t.lesson.reward(fmtBalance(reward))}
                </div>
              )}
              {puzzle.completed && BigInt(reward || '0') === 0n && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)' }}>Уже решал — повтор без награды</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => navigate('/tasks')} style={ghostBtn}>← К заданиям</button>
                <button
                  onClick={() => {
                    const diff = getDiff(puzzle.rating);
                    navigate(`/lesson/random?difficulty=${diff}`);
                  }}
                  style={goldBtn}
                >
                  Следующая ▶
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showFanfare && (
        <VictoryScreen 
          result="win" 
          earned={reward} 
          opponentName={t.lesson.title} 
          onDone={() => setShowFanfare(false)} 
        />
      )}

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          25%{transform:translateX(-6px)}
          75%{transform:translateX(6px)}
        }
      `}</style>
    </div>
  );
};

// Styles
const goldBtn: React.CSSProperties = {
  padding: '11px 22px', background: 'var(--accent, #F5C842)', borderRadius: 14,
  border: 'none', color: 'var(--bg, #0B0D11)', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};
const ghostBtn: React.CSSProperties = {
  padding: '11px 18px', background: 'transparent',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 14, color: 'var(--text-secondary, #8B92A8)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const backBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 11,
  background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.13)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary, #8B92A8)', fontFamily: 'inherit',
};
