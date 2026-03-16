import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Square, PieceSymbol } from 'chess.js';
import { ChessBoard } from '@/components/game/ChessBoard';
import { CapturedPieces } from '@/components/game/CapturedPieces';
import { WaitingForOpponent } from '@/components/game/WaitingForOpponent';
import { GameResultModal } from '@/components/game/GameResultModal';
import { CoinPopupLayer, PIECE_COIN_VALUE } from '@/components/game/CoinPopup';
import { Avatar } from '@/components/ui/Avatar';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { getSocket } from '@/api/socket';
import { fmtTime, fmtBalance } from '@/utils/format';
import { JARVIS_LEVELS } from '@/components/ui/JarvisModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export const GamePage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSpectator = searchParams.get('spectate') === '1';
  const { sessions, upsertSession, removeSession, drawOfferedBy, setDrawOffered } = useGameStore();
  const { user } = useUserStore();

  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<{
    result: 'win' | 'lose' | 'draw';
    earned: string;
    commission: string;
    pieceCoins?: string;
  } | null>(null);
  const [myCaptured, setMyCaptured] = useState<string[]>([]);
  const [opCaptured, setOpCaptured] = useState<string[]>([]);
  const coinTriggerRef = useRef<((amount: number) => void) | null>(null);

  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];

  useEffect(() => {
    if (isSpectator) return; // spectator uses own session flow
    if (!session && sessions.length > 0) navigate('/game/' + sessions[0].id, { replace: true });
    if (!session && sessions.length === 0) navigate('/', { replace: true });
  }, [sessions, session, isSpectator]);

  // Показываем модал результата при завершении
  useEffect(() => {
    if (!session) return;
    if (!['FINISHED', 'DRAW', 'TIME_EXPIRED'].includes(session.status)) return;
    if (showResult) return;

    const mySide = session.sides.find((s) => s.id === session.mySideId);
    const isDraw = session.status === 'DRAW';
    const playerWon = !isDraw && session.winnerSideId === session.mySideId;
    const earned = mySide?.winningAmount ?? '0';
    const earnedBig = BigInt(earned || '0');
    let commission = '0';
    if (earnedBig > 0n && session.bet) {
      const betBig = BigInt(session.bet);
      const totalPot = betBig * 2n;
      commission = (totalPot * 10n / 100n).toString();
    }
    const pieceCoins = session.pieceCoins ?? '0';

    setResultData({
      result: isDraw ? 'draw' : playerWon ? 'win' : 'lose',
      earned,
      commission,
      pieceCoins: session.type === 'BOT' ? pieceCoins : undefined,
    });
    // 3-секундная задержка перед показом модала результата
    const timer = setTimeout(() => setShowResult(true), 3000);
    return () => clearTimeout(timer);
  }, [session?.status]);

  // Spectate mode: подписаться на партию как наблюдатель
  useEffect(() => {
    if (!isSpectator || !sessionId) return;
    getSocket().emit('spectate', { sessionId });
    return () => { getSocket().emit('unspectate', { sessionId }); };
  }, [isSpectator, sessionId]);

  const mySide = session?.sides.find((s) => s.id === session.mySideId);
  const opSide = session?.sides.find((s) => s.id !== session.mySideId);
  const isMyTurn  = !isSpectator && (session?.isMyTurn ?? false);
  const isWhite   = mySide?.isWhite ?? true;
  const isGameOver = ['FINISHED', 'DRAW', 'CANCELLED', 'TIME_EXPIRED'].includes(session?.status ?? '');
  const isBotGame  = session?.type === 'BOT';

  const handleMove = useCallback((from: Square, to: Square, promotion?: string) => {
    if (!session) return;
    setLastMove({ from, to });
    getSocket().emit('game:move', {
      sessionId: session.id, from, to, promotion: promotion ?? 'q',
    }, (res: any) => {
      if (res?.ok && res.session) upsertSession(res.session);
      else if (!res?.ok) console.error('[Move]', res?.error);
    });
  }, [session]);

  const handleCapture = useCallback((piece: PieceSymbol) => {
    const sym = piece.toLowerCase();
    setMyCaptured((prev) => [...prev, sym]);
    if (isBotGame) {
      const coins = PIECE_COIN_VALUE[sym] ?? 0;
      if (coins > 0) coinTriggerRef.current?.(coins);
    }
  }, [isBotGame]);

  const handleSurrender = () => {
    if (!session) return;
    getSocket().emit('game:surrender', { sessionId: session.id }, () => setConfirmSurrender(false));
  };

  const handleResultClose = () => {
    setShowResult(false);
    removeSession(session?.id ?? '');
    navigate('/');
  };

  const handleRematch = useCallback(() => {
    if (!session) return;
    const botLevel = session.botLevel ?? 1;
    const mySide = session.sides.find((s) => s.id === session.mySideId);
    const botSide = session.sides.find((s) => s.id !== session.mySideId);
    const color = mySide?.isWhite ? 'white' : 'black';
    // Use the bot side's remaining timeLeft as proxy for original duration (bot moves instantly)
    const timeSeconds = botSide?.timeLeft ?? mySide?.timeLeft ?? 300;
    setShowResult(false);
    removeSession(session.id);
    getSocket().emit('game:create:bot', { color, botLevel, timeSeconds }, (res: any) => {
      if (res?.ok && res.session) {
        upsertSession(res.session);
        navigate('/game/' + res.session.id, { replace: true });
      }
    });
  }, [session]);

  if (!session) return (
    <div style={rootStyle}>
      <div style={{ color: '#6B7494', textAlign: 'center', padding: 48 }}>Загрузка...</div>
    </div>
  );

  // Экран ожидания соперника
  if (session.status === 'WAITING_FOR_OPPONENT') {
    return <WaitingForOpponent session={session} />;
  }

  const opLabel = opSide?.isBot ? 'J.A.R.V.I.S' : (opSide?.player.firstName ?? '?');

  return (
    <div style={rootStyle}>

      {/* Spectator banner */}
      {isSpectator && (
        <div style={{ background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 10, margin: '6px 12px 0', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#F5C842', fontWeight: 600 }}>👁 Режим наблюдателя</span>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#A8B0C8', fontSize: 12, cursor: 'pointer', padding: 0 }}>← Назад</button>
        </div>
      )}

      {/* Оппонент */}
      <div style={{ padding: '8px 12px 4px', paddingTop: 'max(8px,env(safe-area-inset-top,8px))', flexShrink: 0 }}>
        <PlayerRow player={opSide?.player} timeLeft={opSide?.timeLeft ?? 0}
          isActive={!isMyTurn && !isGameOver} label={opLabel} />
        {session.bet && (
          <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
            <span style={tagStyle('#F5C842', 'rgba(245,200,66,0.12)')}>
              ⚔ СТАВКА {fmtBalance(session.bet)} ᚙ
            </span>
          </div>
        )}
        {opCaptured.length > 0 && (
          <div style={{ padding: '2px 4px' }}><CapturedPieces pieces={opCaptured} /></div>
        )}
      </div>

      {/* Доска */}
      <div style={{ padding: '0 10px', flexShrink: 0, position: 'relative' }}>
        <ChessBoard
          fen={session.fen}
          orientation={isWhite ? 'white' : 'black'}
          isMyTurn={isMyTurn}
          isGameOver={isGameOver}
          onMove={handleMove}
          onCapture={handleCapture}
          lastMove={lastMove}
        />
        <CoinPopupLayer triggerRef={coinTriggerRef} />
      </div>

      {/* Мои съеденные */}
      {myCaptured.length > 0 && (
        <div style={{ padding: '2px 14px' }}>
          <CapturedPieces pieces={myCaptured} showCoins={isBotGame} />
        </div>
      )}

      {/* Метка хода */}
      <div style={{ textAlign: 'center', padding: '4px 0 2px', flexShrink: 0 }}>
        {!isGameOver && (
          <span style={isMyTurn
            ? tagStyle('#00D68F', 'rgba(0,214,143,0.10)')
            : tagStyle('#A8B0C8', '#232840')}>
            {isMyTurn ? '▲ Ваш ход' : '⏳ Ход соперника'}
          </span>
        )}
      </div>

      {/* Я */}
      <div style={{ padding: '4px 12px', flexShrink: 0 }}>
        <PlayerRow player={mySide?.player ?? (user as any)}
          timeLeft={mySide?.timeLeft ?? 0}
          isActive={isMyTurn && !isGameOver} label="Вы" isMe />
      </div>

      {/* Кнопки */}
      {!isGameOver ? (
        <div style={{ display: 'flex', gap: 6, padding: '6px 12px', flexShrink: 0 }}>
          <button onClick={() => setConfirmExit(true)} style={actionBtn()}>← Назад</button>
          <button onClick={() => getSocket().emit('game:offer_draw', { sessionId: session.id })}
            style={actionBtn()}>½ Ничья</button>
          <button onClick={() => setConfirmSurrender(true)}
            style={actionBtn('#FF4D6A', 'rgba(255,77,106,0.08)')}>🏳 Сдаться</button>
        </div>
      ) : !showResult ? (
        <div style={{ padding: '6px 12px', flexShrink: 0 }}>
          <button onClick={handleResultClose} style={{ ...actionBtn(), width: '100%' }}>← В меню</button>
        </div>
      ) : null}

      {/* История ходов */}
      <div style={{
        margin: '4px 12px 8px', padding: '8px 12px',
        background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, flexShrink: 0,
      }}>
        <div style={labelStyle}>История ходов</div>
        <MoveHistory pgn={session.pgn} />
      </div>

      <div style={{ height: 82, flexShrink: 0 }} />

      {/* Оффер ничьи */}
      {drawOfferedBy && drawOfferedBy !== user?.id && (
        <Overlay>
          <ModalBox>
            <div style={modalTitle}>Предложение ничьей</div>
            <div style={modalSub}>Соперник предлагает ничью. Принять?</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => {
                getSocket().emit('game:accept_draw', { sessionId: session.id }, () => {});
                setDrawOffered(null);
              }} style={btnGold}>Принять</button>
              <button onClick={() => {
                setDrawOffered(null);
                getSocket().emit('game:decline_draw', { sessionId: session.id });
              }} style={btnSecondary}>Отклонить</button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {/* Подтверждение сдачи */}
      {confirmSurrender && (
        <Overlay>
          <ModalBox>
            <div style={modalTitle}>Сдаться?</div>
            <div style={modalSub}>
              {session.bet ? `Вы потеряете ${fmtBalance(session.bet)} ᚙ` : 'Засчитается поражение'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleSurrender} style={btnDanger}>Сдаться</button>
              <button onClick={() => setConfirmSurrender(false)} style={btnGold}>Отмена</button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {/* Модал результата */}
      {showResult && resultData && (
        <GameResultModal
          result={resultData.result}
          earned={resultData.earned}
          commission={resultData.commission}
          pieceCoins={resultData.pieceCoins}
          botLevelName={isBotGame && session?.botLevel ? JARVIS_LEVELS[Math.max(0, (session.botLevel ?? 1) - 1)].name : undefined}
          userTelegramId={(user as any)?.telegramId}
          onClose={handleResultClose}
          onRematch={isBotGame ? handleRematch : undefined}
        />
      )}

      {/* Подтверждение выхода */}
      {confirmExit && (
        <ConfirmModal
          icon="🚪"
          title="Выйти из партии?"
          message="Игра продолжится. Вы сможете вернуться позже."
          confirmLabel="← Выйти"
          cancelLabel="Остаться"
          variant="warning"
          onConfirm={() => { setConfirmExit(false); navigate('/'); }}
          onCancel={() => setConfirmExit(false)}
        />
      )}
    </div>
  );
};

// ── MoveHistory — ходы парами ────────────────────────────────────────────────
const parsePgnMoves = (pgn: string) => {
  const cleaned = pgn.replace(/\[.*?\]\s*/g, '').trim();
  if (!cleaned) return [];
  const moves: Array<{ num: number; white: string; black: string }> = [];
  const regex = /(\d+)\.\s+(\S+)(?:\s+(\S+))?/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    moves.push({ num: parseInt(match[1]), white: match[2], black: match[3] ?? '' });
  }
  return moves;
};

const MoveHistory: React.FC<{ pgn: string }> = ({ pgn }) => {
  const moves = parsePgnMoves(pgn);
  const last8 = moves.slice(-8);
  if (last8.length === 0) {
    return <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#6B7494', marginTop: 4 }}>— партия началась —</div>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', marginTop: 4 }}>
      {last8.map((m) => (
        <span key={m.num} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#C8CDE0', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#6B7494' }}>{m.num}.</span> {m.white}{m.black ? ` ${m.black}` : ''}
        </span>
      ))}
    </div>
  );
};

// ── PlayerRow — с тикающим таймером ─────────────────────────────────────────
const PlayerRow: React.FC<{
  player?: any; timeLeft: number; isActive: boolean; label?: string; isMe?: boolean;
}> = ({ player, timeLeft, isActive, label, isMe }) => {
  const [localTime, setLocalTime] = React.useState(timeLeft);
  const [pulseOn, setPulseOn] = React.useState(false);

  // Синхронизируем с сервером при изменении timeLeft
  React.useEffect(() => { setLocalTime(timeLeft); }, [timeLeft]);

  // Тикаем локально пока isActive
  React.useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setLocalTime((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  const danger = localTime < 10 && isActive;

  // Пульсация при критическом времени
  React.useEffect(() => {
    if (!danger) { setPulseOn(false); return; }
    const t = setInterval(() => setPulseOn(p => !p), 500);
    return () => clearInterval(t);
  }, [danger]);

  // Haptic каждые 3 секунды при критическом времени
  React.useEffect(() => {
    if (!danger || !isActive) return;
    if (localTime > 0 && localTime % 3 === 0) {
      try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); } catch {}
    }
  }, [localTime, danger, isActive]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', background: '#1C2030',
      border: `1px solid ${isActive ? '#F5C842' : 'rgba(255,255,255,0.07)'}`,
      boxShadow: isActive ? '0 0 0 1px rgba(245,200,66,0.1)' : undefined,
      borderRadius: 14, transition: 'border-color .2s',
    }}>
      <Avatar user={player} size="s" gold={isMe && isActive} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>
          {label ?? player?.firstName ?? '?'}
        </div>
        <div style={{ fontSize: 10, color: '#A8B0C8', marginTop: 2 }}>
          ELO {player?.elo ?? '—'}{isActive ? ' · Ход' : ''}
        </div>
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono',monospace", fontSize: 19, fontWeight: 700,
        color: danger ? '#FF4D6A' : isActive ? '#F5C842' : '#6B7494',
        transition: 'color .25s', minWidth: 42, textAlign: 'right',
        opacity: danger ? (pulseOn ? 1 : 0.4) : 1,
      }}>
        {fmtTime(localTime)}
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 100,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  }}>{children}</div>
);
const ModalBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: '#161927', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20, padding: 20, width: '100%',
  }}>{children}</div>
);

const rootStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column',
  background: '#0B0D11', overflow: 'hidden',
};
const tagStyle = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex', padding: '3px 9px', background: bg, color,
  borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
});
const actionBtn = (color = '#A8B0C8', bg = 'transparent'): React.CSSProperties => ({
  flex: 1, padding: '9px 10px', background: bg, color,
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
});
const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: '#6B7494',
};
const modalTitle: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: '#F0F2F8', marginBottom: 6 };
const modalSub: React.CSSProperties = { fontSize: 13, color: '#A8B0C8' };
const btnGold: React.CSSProperties = {
  flex: 1, padding: 11, background: '#F5C842', color: '#0B0D11',
  border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  ...btnGold, background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.1)',
};
const btnDanger: React.CSSProperties = {
  ...btnGold, background: 'rgba(255,77,106,0.12)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)',
};
