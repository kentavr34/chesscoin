/**
 * LessonPage вЂ” СЃС‚СЂР°РЅРёС†Р° СЂРµС€РµРЅРёСЏ С€Р°С…РјР°С‚РЅРѕР№ Р·Р°РґР°С‡Рё
 * РњР°СЂС€СЂСѓС‚: /lesson/:puzzleId?difficulty=easy|medium|hard
 * РўР°РєР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ Р—Р°РґР°С‡Рё РґРЅСЏ: /lesson/daily
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

// UCI С…РѕРґ в†’ human-readable
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

  // Р РµР¶РёРј: "learn" (РїРѕРґСЃРєР°Р·РєРё) РёР»Рё "test" (Р±РµР· РїРѕРґСЃРєР°Р·РѕРє, РЅР°РіСЂР°РґР° Г—1.5)
  const mode = (searchParams.get('mode') ?? 'learn') as 'learn' | 'test';
  const isTestMode = mode === 'test';

  const [puzzle, setPuzzle] = useState<PuzzleItem | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [chess, setChess] = useState<Chess>(new Chess());
  const [fen, setFen] = useState('');
  const [playerMoves, setPlayerMoves] = useState<string[]>([]);   // UCI С…РѕРґС‹ РёРіСЂРѕРєР°
  const [solutionIdx, setSolutionIdx] = useState(0);              // С‚РµРєСѓС‰РёР№ РёРЅРґРµРєСЃ РІ СЂРµС€РµРЅРёРё
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [wrongSquare, setWrongSquare] = useState<string | null>(null);
  const [reward, setReward] = useState<string>('0');
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [showFanfare, setShowFanfare] = useState(false);

  // Р—Р°РіСЂСѓР·РєР° Р·Р°РґР°С‡Рё
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

  // РќР°С‡РёРЅР°РµРј вЂ” РїСЂРѕС‚РёРІРЅРёРє РґРµР»Р°РµС‚ РїРµСЂРІС‹Р№ С…РѕРґ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё
  const startPuzzle = useCallback(() => {
    if (!puzzle) return;
    setPhase('playing');

    // РџРµСЂРІС‹Р№ С…РѕРґ РІ solution вЂ” С…РѕРґ РїСЂРѕС‚РёРІРЅРёРєР°
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

  // РћР±СЂР°Р±РѕС‚РєР° С…РѕРґР° РёРіСЂРѕРєР°
  const handleSquareClick = (square: string) => {
    if (!isPlayerTurn || phase !== 'playing') return;

    if (selectedSquare) {
      // РџРѕРїС‹С‚РєР° СЃРґРµР»Р°С‚СЊ С…РѕРґ
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setOptionSquares({});
        return;
      }
      tryMove(selectedSquare, square);
      setSelectedSquare(null);
      setOptionSquares({});
    } else {
      // Р’С‹Р±РѕСЂ С„РёРіСѓСЂС‹
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

    // РџСЂРѕР±СѓРµРј РїСЂРёРјРµРЅРёС‚СЊ С…РѕРґ
    try {
      const tempChess = new Chess(chess.fen());
      const move = tempChess.move({ from: from as import("chess.js").Square, to: to as import("chess.js").Square, promotion: 'q' });
      if (!move) return;

      const actualUci = move.from + move.to + (move.promotion ?? '');

      if (from === expectedFrom && to === expectedTo) {
        // вњ… РџСЂР°РІРёР»СЊРЅС‹Р№ С…РѕРґ
        haptic.impact('medium');
        setChess(tempChess);
        setFen(tempChess.fen());
        const newMoves = [...playerMoves, actualUci];
        setPlayerMoves(newMoves);
        const nextIdx = solutionIdx + 1;
        setHint(null);
        setWrongSquare(null);

        // РџСЂРѕРІРµСЂСЏРµРј вЂ” РєРѕРЅРµС† СЂРµС€РµРЅРёСЏ?
        if (nextIdx >= puzzle.moves.length) {
          // {t.lesson.solved}
          setIsPlayerTurn(false);
          setPhase('correct');
          submitSolution([...newMoves]);
        } else {
          // РџСЂРѕС‚РёРІРЅРёРє РѕС‚РІРµС‡Р°РµС‚
          setSolutionIdx(nextIdx);
          setIsPlayerTurn(false);
          setTimeout(() => {
            applyOpponentMove(puzzle, tempChess, nextIdx);
          }, 700);
        }
      } else {
        // вќЊ РќРµРІРµСЂРЅС‹Р№ С…РѕРґ
        haptic.impact('heavy');
        setWrongSquare(to);
        setPhase('wrong');
        setTimeout(() => {
          setWrongSquare(null);
          setPhase('playing');
        }, 1000);
        // Р’ СЂРµР¶РёРјРµ С‚РµСЃС‚ вЂ” Р±РµР· РїРѕРґСЃРєР°Р·РѕРє
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

  const diffLabel: Record<string, string> = { easy: 'рџџў Р›С‘РіРєР°СЏ', medium: 'рџџЎ РЎСЂРµРґРЅСЏСЏ', hard: 'рџ”ґ РЎР»РѕР¶РЅР°СЏ' };
  const getDiff = (rating: number) =>
    rating < 1200 ? 'easy' : rating < 1700 ? 'medium' : 'hard';

  if (phase === 'loading') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0D0D12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(123,97,255,0.3)', borderTopColor: '#7B61FF', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <div style={{ color: '#5A5248', fontSize: 13 }}>Р—Р°РіСЂСѓР¶Р°РµРј Р·Р°РґР°С‡Сѓ...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0D0D12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 13, color: '#9A9490', textAlign: 'center' }}>Р—Р°РґР°С‡Р° РЅРµ РЅР°Р№РґРµРЅР°</div>
        <button onClick={() => navigate('/tasks')} style={goldBtn}>в†ђ РќР°Р·Р°Рґ</button>
      </div>
    );
  }

  const diff = getDiff(puzzle.rating);
  const boardSize = Math.min(window.innerWidth - 32, 380);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0D0D12', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* РўРѕРїР±Р°СЂ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', paddingTop: 'max(14px, env(safe-area-inset-top,14px))', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={backBtn}>в†ђ</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 13, fontWeight: 800, color: '#EAE2CC' }}>
            {puzzle.isDaily ? `рџ“… ${t.lesson.daily}` : `рџ§© ${t.lesson.title}`}
          </div>
          <div style={{ fontSize: 10, color: '#9A9490', marginTop: 2 }}>
            {diffLabel[diff]} В· Р РµР№С‚РёРЅРі {puzzle.rating} В· +{fmtBalance(puzzle.reward)} бљ™
          </div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* РўРµРјР°С‚РёРєРё */}
      {puzzle.themes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 18px', flexWrap: 'wrap', flexShrink: 0 }}>
          {puzzle.themes.slice(0, 4).map(theme => (
            <span key={theme} style={{ padding: '3px 8px', background: 'rgba(123,97,255,0.12)', border: '1px solid rgba(123,97,255,0.2)', borderRadius: 8, fontSize: 10, color: '#9B85FF', fontWeight: 600 }}>
              {theme}
            </span>
          ))}
        </div>
      )}

      {/* Р”РѕСЃРєР° */}
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

        {/* РЎС‚Р°С‚СѓСЃ */}
        <div style={{ textAlign: 'center', minHeight: 52 }}>
          {phase === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 13, color: '#9A9490' }}>
                {chess.turn() === 'w' ? t.lesson.whiteToMove : t.lesson.blackToMove}
              </div>
              <button onClick={startPuzzle} style={goldBtn}>в–¶ РќР°С‡Р°С‚СЊ СЂРµС€РµРЅРёРµ</button>
            </div>
          )}
          {phase === 'playing' && (
            <div style={{ fontSize: 13, color: isPlayerTurn ? '#F0C85A' : '#9A9490', fontWeight: isPlayerTurn ? 700 : 400 }}>
              {isPlayerTurn ? t.lesson.yourTurn : t.lesson.opponentThinking}
            </div>
          )}
          {phase === 'wrong' && (
            <div style={{ fontSize: 13, color: '#FF5B5B', fontWeight: 700, animation: 'shake .3s' }}>
              вќЊ РќРµРІРµСЂРЅРѕ! {hint}
            </div>
          )}
          {phase === 'correct' && (
            <div style={{ fontSize: 13, color: '#3DBA7A', fontWeight: 700 }}>
              вњ… РџСЂР°РІРёР»СЊРЅРѕ! РџСЂРѕРІРµСЂСЏРµРј...
            </div>
          )}
          {phase === 'solved' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 32 }}>рџЏ†</div>
              <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 18, fontWeight: 800, color: '#F0C85A' }}>
                {t.lesson.solved}
              </div>
              {BigInt(reward || '0') > 0n && (
                <div style={{ fontSize: 15, color: '#3DBA7A', fontWeight: 700 }}>
                  {t.lesson.reward(fmtBalance(reward))}
                </div>
              )}
              {puzzle.completed && BigInt(reward || '0') === 0n && (
                <div style={{ fontSize: 12, color: '#9A9490' }}>РЈР¶Рµ СЂРµС€Р°Р» вЂ” РїРѕРІС‚РѕСЂ Р±РµР· РЅР°РіСЂР°РґС‹</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => navigate('/tasks')} style={ghostBtn}>в†ђ Рљ Р·Р°РґР°РЅРёСЏРј</button>
                <button
                  onClick={() => {
                    const diff = getDiff(puzzle.rating);
                    navigate(`/lesson/random?difficulty=${diff}`);
                  }}
                  style={goldBtn}
                >
                  РЎР»РµРґСѓСЋС‰Р°СЏ в–¶
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
  padding: '11px 22px', background: '#F0C85A', borderRadius: 14,
  border: 'none', color: '#0D0D12', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};
const ghostBtn: React.CSSProperties = {
  padding: '11px 18px', background: 'transparent',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 14, color: '#9A9490', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const backBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 11,
  background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '1px solid rgba(255,255,255,0.13)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18, cursor: 'pointer', color: '#9A9490', fontFamily: 'inherit',
};
