import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { puzzlesApi } from '@/api/index';
import { PageLayout } from '@/components/layout/PageLayout';
import { useUserStore } from '@/store/useUserStore';

interface DailyPuzzle {
  id: string;
  title: string;
  description?: string;
  fen: string;
  moves: string;
  difficulty: number;
  reward: string;
}

export const PuzzleDailyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState('');
  const [moves, setMoves] = useState<string[]>([]);
  const [moveIdx, setMoveIdx] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [complete, setComplete] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!id) return;
    puzzlesApi.dailyPuzzle().then((r) => {
      const data = r.puzzle as unknown as DailyPuzzle;
      setPuzzle(data);
      const mvs = data.moves.split(' ').filter(Boolean);
      setMoves(mvs);
      chess.load(data.fen);
      setFen(chess.fen());
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  const reset = () => {
    if (!puzzle) return;
    chess.load(puzzle.fen);
    setFen(chess.fen());
    setMoveIdx(0);
    setWrong(false);
    setComplete(false);
    setErrorMsg('');
  };

  const onDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (complete) return false;
    const expected = moves[moveIdx];
    if (!expected) return false;
    const expFrom = expected.slice(0, 2);
    const expTo = expected.slice(2, 4);
    const expPromo = expected.length > 4 ? expected[4] : undefined;

    const promo = piece?.toLowerCase().includes('q') ? 'q'
      : piece?.toLowerCase().includes('r') ? 'r'
      : piece?.toLowerCase().includes('b') ? 'b'
      : piece?.toLowerCase().includes('n') ? 'n' : undefined;

    if (sourceSquare === expFrom && targetSquare === expTo) {
      const result = chess.move({ from: sourceSquare, to: targetSquare, promotion: expPromo || promo });
      if (!result) return false;
      setFen(chess.fen());
      const nextIdx = moveIdx + 1;
      setMoveIdx(nextIdx);
      setWrong(false);
      setErrorMsg('');
      if (nextIdx >= moves.length) {
        setComplete(true);
        if (!rewarded && id) {
          puzzlesApi.completeDaily(id!, []).then((res) => {
            setRewarded(true);
            if (user && res.reward) setUser({ ...user, balance: String(BigInt(user.balance) + BigInt(res.reward)) });
          }).catch(() => {});
        }
      } else if (nextIdx % 2 === 1) {
        // Auto-play opponent
        setTimeout(() => {
          const compMove = moves[nextIdx];
          chess.move({ from: compMove.slice(0, 2), to: compMove.slice(2, 4), promotion: compMove.length > 4 ? compMove[4] : undefined });
          setFen(chess.fen());
          setMoveIdx(i => i + 1);
        }, 500);
      }
      return true;
    } else {
      setWrong(true);
      setErrorMsg('Wrong move! Try again.');
      setTimeout(() => setWrong(false), 800);
      return false;
    }
  };

  if (loading) {
    return (
      <PageLayout title="Daily Puzzle" onBack={() => navigate(-1)}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #F5C842', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </PageLayout>
    );
  }

  if (!puzzle) {
    return (
      <PageLayout title="Daily Puzzle" onBack={() => navigate(-1)}>
        <div style={{ textAlign: 'center', padding: 40, color: '#A8B0C8' }}>Puzzle not found</div>
      </PageLayout>
    );
  }

  // In Lichess puzzles, the first move is the opponent's. Player's color is the OPPOSITE of whose turn it is.
  const playerColor = puzzle.fen.includes(' b ') ? 'white' : 'black';

  return (
    <PageLayout
      title={puzzle.title}
      onBack={() => navigate(-1)}
      rightAction={
        <button onClick={() => setShowInfo(v => !v)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, color: '#A8B0C8', padding: '4px 8px',
        }}>ⓘ</button>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Info panel */}
      {showInfo && puzzle.description && (
        <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: '#1C2030', borderRadius: 12, fontSize: 13, color: '#A8B0C8', lineHeight: 1.5, position: 'relative' }}>
          <button onClick={() => setShowInfo(false)} style={{
            position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7494', fontSize: 16,
          }}>✕</button>
          {puzzle.description}
        </div>
      )}

      {/* Reward and difficulty */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ padding: '4px 14px', background: '#1C2030', borderRadius: 20, fontSize: 12, color: '#F5C842', fontWeight: 600 }}>
          Reward: {Number(puzzle.reward).toLocaleString()} ᚙ
        </div>
        <div style={{ padding: '4px 14px', background: '#1C2030', borderRadius: 20, fontSize: 12, color: '#A8B0C8' }}>
          {'★'.repeat(Math.min(5, Math.ceil(puzzle.difficulty / 20)))}{'☆'.repeat(5 - Math.min(5, Math.ceil(puzzle.difficulty / 20)))}
        </div>
      </div>

      {/* Board */}
      <div style={{ padding: '0 16px', position: 'relative' }}>
        {wrong && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16, border: '3px solid #FF4466',
            zIndex: 10, pointerEvents: 'none', margin: '0 16px',
          }} />
        )}
        <Chessboard
          position={fen}
          boardOrientation={playerColor}
          onPieceDrop={onDrop}
          arePiecesDraggable={!complete}
          customBoardStyle={{ borderRadius: 12, overflow: 'hidden' }}
        />
      </div>

      {errorMsg && (
        <div style={{ textAlign: 'center', color: '#FF4466', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
          {errorMsg}
        </div>
      )}

      {!complete && (
        <div style={{ padding: '16px' }}>
          <button onClick={reset} style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: '#1C2030', color: '#A8B0C8', fontWeight: 600, fontSize: 14,
          }}>
            🔄 Start over
          </button>
        </div>
      )}

      {complete && (
        <div style={{ margin: '16px', padding: '20px 16px', background: '#13161E', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F5C842', marginTop: 8 }}>
            {rewarded ? `+${Number(puzzle.reward).toLocaleString()} ᚙ earned!` : 'Puzzle already solved'}
          </div>
          <div style={{ fontSize: 13, color: '#A8B0C8', marginTop: 4 }}>Come back tomorrow for a new puzzle!</div>
          <button onClick={() => navigate(-1)} style={{
            marginTop: 16, padding: '12px 32px', background: '#F5C842', color: '#0B0D11',
            border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14,
          }}>
            Done
          </button>
        </div>
      )}
    </PageLayout>
  );
};
