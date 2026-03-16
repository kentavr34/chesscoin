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
    puzzlesApi.dailyPuzzle(id).then((data: DailyPuzzle) => {
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
          puzzlesApi.completeDaily(id).then((res: { reward: string; balance: string }) => {
            setRewarded(true);
            if (user) setUser({ ...user, balance: res.balance });
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
      setErrorMsg('Неверный ход! Попробуйте ещё раз.');
      setTimeout(() => setWrong(false), 800);
      return false;
    }
  };

  if (loading) {
    return (
      <PageLayout title="Задача дня" onBack={() => navigate(-1)}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #F5C842', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </PageLayout>
    );
  }

  if (!puzzle) {
    return (
      <PageLayout title="Задача дня" onBack={() => navigate(-1)}>
        <div style={{ textAlign: 'center', padding: 40, color: '#8B92A8' }}>Задача не найдена</div>
      </PageLayout>
    );
  }

  const playerColor = puzzle.fen.includes(' b ') ? 'black' : 'white';

  return (
    <PageLayout
      title={puzzle.title}
      onBack={() => navigate(-1)}
      rightAction={
        <button onClick={() => setShowInfo(v => !v)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, color: '#8B92A8', padding: '4px 8px',
        }}>ⓘ</button>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Info panel */}
      {showInfo && puzzle.description && (
        <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: '#1C2030', borderRadius: 12, fontSize: 13, color: '#8B92A8', lineHeight: 1.5, position: 'relative' }}>
          <button onClick={() => setShowInfo(false)} style={{
            position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#4A5270', fontSize: 16,
          }}>✕</button>
          {puzzle.description}
        </div>
      )}

      {/* Reward and difficulty */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ padding: '4px 14px', background: '#1C2030', borderRadius: 20, fontSize: 12, color: '#F5C842', fontWeight: 600 }}>
          Награда: {Number(puzzle.reward).toLocaleString()} ᚙ
        </div>
        <div style={{ padding: '4px 14px', background: '#1C2030', borderRadius: 20, fontSize: 12, color: '#8B92A8' }}>
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
            background: '#1C2030', color: '#8B92A8', fontWeight: 600, fontSize: 14,
          }}>
            🔄 Начать заново
          </button>
        </div>
      )}

      {complete && (
        <div style={{ margin: '16px', padding: '20px 16px', background: '#13161E', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F5C842', marginTop: 8 }}>
            {rewarded ? `+${Number(puzzle.reward).toLocaleString()} ᚙ получено!` : 'Задача уже была решена'}
          </div>
          <div style={{ fontSize: 13, color: '#8B92A8', marginTop: 4 }}>Приходи завтра за новой задачей!</div>
          <button onClick={() => navigate(-1)} style={{
            marginTop: 16, padding: '12px 32px', background: '#F5C842', color: '#0B0D11',
            border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14,
          }}>
            Готово
          </button>
        </div>
      )}
    </PageLayout>
  );
};
