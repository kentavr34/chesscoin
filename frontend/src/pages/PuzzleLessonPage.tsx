import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { puzzlesApi } from '@/api/index';
import { PageLayout } from '@/components/layout/PageLayout';
import { useUserStore } from '@/store/useUserStore';

interface PuzzleLesson {
  id: string;
  title: string;
  description?: string;
  fen: string;
  moves: string; // space-separated UCI moves: e2e4 e7e5 ...
  difficulty: number;
  reward: string;
}

type Mode = 'lesson' | 'test';

export const PuzzleLessonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const [lesson, setLesson] = useState<PuzzleLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('lesson');

  // Lesson mode state
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState('');
  const [moveIdx, setMoveIdx] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);

  // Test mode state
  const [testChess] = useState(() => new Chess());
  const [testFen, setTestFen] = useState('');
  const [testMoveIdx, setTestMoveIdx] = useState(0);
  const [testWrong, setTestWrong] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    puzzlesApi.lesson(id).then((r) => {
      const data = r.puzzle as unknown as PuzzleLesson;
      setLesson(data);
      const mvs = data.moves.split(' ').filter(Boolean);
      setMoves(mvs);
      chess.load(data.fen);
      setFen(chess.fen());
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  const resetLesson = useCallback(() => {
    if (!lesson) return;
    chess.load(lesson.fen);
    setFen(chess.fen());
    setMoveIdx(0);
  }, [lesson, chess]);

  const resetTest = useCallback(() => {
    if (!lesson) return;
    testChess.load(lesson.fen);
    setTestFen(testChess.fen());
    setTestMoveIdx(0);
    setTestWrong(false);
    setTestComplete(false);
    setErrorMsg('');
  }, [lesson, testChess]);

  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === 'lesson') resetLesson();
    else resetTest();
  };

  // Lesson: step forward
  const stepForward = () => {
    if (moveIdx >= moves.length) return;
    const mv = moves[moveIdx];
    const from = mv.slice(0, 2);
    const to = mv.slice(2, 4);
    const promo = mv.length > 4 ? mv[4] : undefined;
    chess.move({ from, to, promotion: promo });
    setFen(chess.fen());
    setMoveIdx(i => i + 1);
  };

  const stepBack = () => {
    if (moveIdx === 0) return;
    chess.undo();
    setFen(chess.fen());
    setMoveIdx(i => i - 1);
  };

  // Test: handle drop
  const onTestDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (testComplete) return false;
    const expected = moves[testMoveIdx];
    const expFrom = expected?.slice(0, 2);
    const expTo = expected?.slice(2, 4);
    const expPromo = expected?.length > 4 ? expected[4] : undefined;

    const promo = piece?.toLowerCase().includes('q') ? 'q'
      : piece?.toLowerCase().includes('r') ? 'r'
      : piece?.toLowerCase().includes('b') ? 'b'
      : piece?.toLowerCase().includes('n') ? 'n' : undefined;

    if (sourceSquare === expFrom && targetSquare === expTo) {
      const result = testChess.move({ from: sourceSquare, to: targetSquare, promotion: expPromo || promo });
      if (!result) return false;
      setTestFen(testChess.fen());
      const nextIdx = testMoveIdx + 1;
      setTestMoveIdx(nextIdx);
      setTestWrong(false);
      setErrorMsg('');
      if (nextIdx >= moves.length) {
        setTestComplete(true);
        // Award reward
        if (!rewarded && id) {
          puzzlesApi.completeLesson(id!, []).then((res) => {
            setRewarded(true);
            if (!res.alreadySolved && user && res.reward) {
              setUser({ ...user, balance: String(BigInt(user.balance) + BigInt(res.reward)) });
            }
          }).catch(() => {});
        }
      } else {
        // Auto-play computer responses (even index = player, odd = computer)
        if (nextIdx % 2 === 1) {
          setTimeout(() => {
            const compMove = moves[nextIdx];
            const cf = compMove.slice(0, 2);
            const ct = compMove.slice(2, 4);
            const cp = compMove.length > 4 ? compMove[4] : undefined;
            testChess.move({ from: cf, to: ct, promotion: cp });
            setTestFen(testChess.fen());
            setTestMoveIdx(i => i + 1);
          }, 400);
        }
      }
      return true;
    } else {
      setTestWrong(true);
      setErrorMsg('Wrong move! Try again.');
      setTimeout(() => setTestWrong(false), 800);
      return false;
    }
  };

  if (loading) {
    return (
      <PageLayout title="Lesson" onBack={() => navigate(-1)}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #7B61FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
        </div>
      </PageLayout>
    );
  }

  if (!lesson) {
    return (
      <PageLayout title="Lesson" onBack={() => navigate(-1)}>
        <div style={{ textAlign: 'center', padding: 40, color: '#A8B0C8' }}>Lesson not found</div>
      </PageLayout>
    );
  }

  const boardFen = mode === 'lesson' ? fen : testFen;
  const playerColor = lesson.fen.includes(' b ') ? 'black' : 'white';

  return (
    <PageLayout title={lesson.title} onBack={() => navigate(-1)}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
        {(['lesson', 'test'] as Mode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)} style={{
            flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: mode === m ? '#7B61FF' : '#1C2030',
            color: mode === m ? '#fff' : '#A8B0C8',
            fontWeight: 600, fontSize: 14,
          }}>
            {m === 'lesson' ? '📖 Learn' : '🎯 Test'}
          </button>
        ))}
      </div>

      {/* Description */}
      {lesson.description && (
        <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: '#13161E', borderRadius: 12, fontSize: 13, color: '#A8B0C8', lineHeight: 1.5 }}>
          {lesson.description}
        </div>
      )}

      {/* Reward badge */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ padding: '4px 14px', background: '#1C2030', borderRadius: 20, fontSize: 12, color: '#F5C842', fontWeight: 600 }}>
          Reward: {Number(lesson.reward).toLocaleString()} ᚙ
        </div>
      </div>

      {/* Board */}
      <div style={{ padding: '0 16px', position: 'relative' }}>
        {testWrong && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16, border: '3px solid #FF4466',
            zIndex: 10, pointerEvents: 'none', margin: '0 16px',
          }} />
        )}
        <Chessboard
          position={boardFen}
          boardOrientation={playerColor}
          onPieceDrop={mode === 'test' ? onTestDrop : () => false}
          arePiecesDraggable={mode === 'test' && !testComplete}
          customBoardStyle={{ borderRadius: 12, overflow: 'hidden' }}
        />
      </div>

      {/* Error message */}
      {errorMsg && (
        <div style={{ textAlign: 'center', color: '#FF4466', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
          {errorMsg}
        </div>
      )}

      {/* Test complete */}
      {testComplete && (
        <div style={{ margin: '16px', padding: '16px', background: '#13161E', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F5C842', marginTop: 8 }}>
            {rewarded ? `+${Number(lesson.reward).toLocaleString()} ᚙ earned!` : 'Lesson already completed'}
          </div>
          <div style={{ fontSize: 13, color: '#A8B0C8', marginTop: 4 }}>Great work!</div>
          <button onClick={() => navigate(-1)} style={{
            marginTop: 16, padding: '12px 32px', background: '#7B61FF', color: '#fff',
            border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}>
            Back to lessons
          </button>
        </div>
      )}

      {/* Lesson controls */}
      {mode === 'lesson' && !testComplete && (
        <div style={{ display: 'flex', gap: 8, padding: '16px', alignItems: 'center' }}>
          <button onClick={stepBack} disabled={moveIdx === 0} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: moveIdx === 0 ? 'not-allowed' : 'pointer',
            background: '#1C2030', color: moveIdx === 0 ? '#6B7494' : '#E8EAF0', fontWeight: 600, fontSize: 14,
          }}>
            ← Back
          </button>
          <div style={{ fontSize: 13, color: '#A8B0C8', minWidth: 60, textAlign: 'center' }}>
            {moveIdx}/{moves.length}
          </div>
          <button onClick={stepForward} disabled={moveIdx >= moves.length} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
            cursor: moveIdx >= moves.length ? 'not-allowed' : 'pointer',
            background: moveIdx >= moves.length ? '#1C2030' : '#7B61FF',
            color: moveIdx >= moves.length ? '#6B7494' : '#fff',
            fontWeight: 600, fontSize: 14,
          }}>
            Forward →
          </button>
        </div>
      )}

      {/* Test reset if not complete */}
      {mode === 'test' && !testComplete && (
        <div style={{ padding: '0 16px 16px' }}>
          <button onClick={resetTest} style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: '#1C2030', color: '#A8B0C8', fontWeight: 600, fontSize: 14,
          }}>
            🔄 Start over
          </button>
        </div>
      )}

      {/* Difficulty */}
      <div style={{ textAlign: 'center', paddingBottom: 24, fontSize: 12, color: '#6B7494' }}>
        Difficulty: {'★'.repeat(Math.min(5, Math.ceil(lesson.difficulty / 20)))}{'☆'.repeat(5 - Math.min(5, Math.ceil(lesson.difficulty / 20)))}
      </div>
    </PageLayout>
  );
};
