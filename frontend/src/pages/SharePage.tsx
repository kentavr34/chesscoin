/**
 * SharePage — PR-2
 *
 * Универсальный просмотр партии по shareToken. Одна страница на все три
 * стадии (определяется по session.status):
 *   • WAITING_FOR_OPPONENT — доска в стартовой позиции, аватары игроков,
 *     таймер дедлайна (24ч), кнопка «Поддержать» (донат за выбранную сторону).
 *   • IN_PROGRESS          — live-обновления через socket spectate:<sessionId>,
 *     текущий ход, таймеры сторон, донат за сторону, ShareSessionButton.
 *   • FINISHED / DRAW / TIME_EXPIRED — PGN-replay через PgnReplayModal-логику,
 *     итог, кнопка «Поделиться».
 *
 * Открывается через /share/:token (registered в App.tsx). Deep-link из бота:
 * ?startapp=share_<token> — бот сам редиректит Mini App на /share/<token>.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { ShareSessionButton } from '@/components/ui/ShareSessionButton';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { IcoSwords, IcoTrophy } from '@/components/icons/UiIcons';
import { fmtBalance } from '@/utils/format';
import { gamesApi } from '@/api';
import { getSocket } from '@/api/socket';
import { useUserStore } from '@/store/useUserStore';
import { PgnReplayModal } from '@/components/profile/PgnReplayModal';

const showToast = (text: string, type: 'info' | 'error' = 'info') => {
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));
};

interface ShareSession {
  id: string;
  shareToken: string;
  status: string;
  type: string;
  sourceType: string | null;
  sourceRefId: string | null;
  deadlineAt: string | null;
  acceptedByAll: boolean;
  fen: string;
  pgn: string;
  bet: string | null;
  duration: number | null;
  currentSideId: string | null;
  winnerSideId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  donationPool: string;
  sides: Array<{
    id: string;
    isWhite: boolean;
    isBot: boolean;
    status: string;
    timeLeft: number | null;
    winningAmount: string | null;
    player: {
      id: string;
      firstName: string;
      lastName?: string | null;
      username?: string | null;
      avatar?: string | null;
      avatarType?: string | null;
      avatarGradient?: string | null;
      elo: number;
      league?: string | null;
      country?: { code: string; nameRu: string; flag: string } | null;
    };
    topDonor: { userId: string; amount: string } | null;
  }>;
}

const SOURCE_EMBLEM: Record<string, { Icon: React.FC<any>; label: string; color: string }> = {
  WAR:        { Icon: IcoSwords, label: 'Война',  color: '#FF8855' },
  TOURNAMENT: { Icon: IcoTrophy, label: 'Турнир', color: '#F0C85A' },
};

export const SharePage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { user } = useUserStore();
  const [session, setSession] = useState<ShareSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [donateSideId, setDonateSideId] = useState<string | null>(null);
  const [donateAmount, setDonateAmount] = useState('100');
  const [donating, setDonating] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  // Загрузка партии
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    gamesApi.byShare(token)
      .then(r => { setSession(r.session); setError(null); })
      .catch(e => setError(e?.message ?? 'Не найдено'))
      .finally(() => setLoading(false));
  }, [token]);

  // Live-подписка для IN_PROGRESS
  useEffect(() => {
    if (!session || session.status !== 'IN_PROGRESS') return;
    const socket = getSocket();
    socket.emit('spectate', { sessionId: session.id });
    const onMove = (payload: any) => {
      if (payload?.sessionId !== session.id) return;
      setSession(prev => prev ? { ...prev, fen: payload.fen, pgn: payload.pgn, currentSideId: payload.currentSideId ?? prev.currentSideId } : prev);
    };
    const onDonated = (payload: any) => {
      setSession(prev => prev ? { ...prev, donationPool: payload.totalPool ?? prev.donationPool } : prev);
    };
    const onOver = () => {
      // Перезагрузить — обновится winnerSideId, finishedAt
      gamesApi.byShare(token!).then(r => setSession(r.session)).catch(() => {});
    };
    socket.on('game', onMove);
    socket.on('battle:donated', onDonated);
    socket.on('game:over', onOver);
    return () => {
      socket.emit('unspectate', { sessionId: session.id });
      socket.off('game', onMove);
      socket.off('battle:donated', onDonated);
      socket.off('game:over', onOver);
    };
  }, [session?.id, session?.status, token]);

  // Доска (текущий FEN)
  const boardState = useMemo(() => {
    if (!session) return null;
    try {
      const chess = new Chess();
      if (session.pgn) chess.loadPgn(session.pgn);
      else chess.load(session.fen);
      return chess.board();
    } catch {
      return null;
    }
  }, [session?.fen, session?.pgn]);

  const handleDonate = () => {
    if (!session || !donateSideId) {
      showToast('Выбери сторону, за которую болеешь', 'error');
      return;
    }
    const amount = BigInt(donateAmount || '0');
    if (amount <= 0n) {
      showToast('Введи сумму > 0', 'error');
      return;
    }
    if (!user) {
      showToast('Войди в Mini App для доната', 'error');
      return;
    }
    setDonating(true);
    const socket = getSocket();
    socket.emit('battle:donate', {
      sessionId: session.id,
      sideId: donateSideId,
      amount: amount.toString(),
    }, (res: any) => {
      setDonating(false);
      if (res?.ok) showToast('Донат отправлен!', 'info');
      else showToast(res?.error ?? 'Ошибка доната', 'error');
    });
  };

  if (loading) {
    return (
      <PageLayout title="Партия" backTo="/" centered>
        <div style={{ padding: 48, textAlign: 'center', color: '#7A7875' }}>Загрузка…</div>
      </PageLayout>
    );
  }
  if (error || !session) {
    return (
      <PageLayout title="Партия" backTo="/" centered>
        <div style={{ padding: 48, textAlign: 'center', color: '#FF8080' }}>
          Партия не найдена или ссылка устарела
        </div>
      </PageLayout>
    );
  }

  const isWaiting = session.status === 'WAITING_FOR_OPPONENT';
  const isLive = session.status === 'IN_PROGRESS';
  const isFinished = ['FINISHED', 'DRAW', 'TIME_EXPIRED'].includes(session.status);
  const emblem = session.sourceType ? SOURCE_EMBLEM[session.sourceType] : null;

  const whiteSide = session.sides.find(s => s.isWhite);
  const blackSide = session.sides.find(s => !s.isWhite);
  const winnerSide = session.sides.find(s => s.id === session.winnerSideId);

  // Дедлайн-таймер для WAITING
  let deadlineText: string | null = null;
  if (isWaiting && session.deadlineAt) {
    const dt = new Date(session.deadlineAt).getTime();
    const ms = dt - Date.now();
    if (ms > 0) {
      const h = Math.floor(ms / 3600_000);
      const m = Math.floor((ms % 3600_000) / 60_000);
      deadlineText = h > 0 ? `${h}ч ${m}м` : `${m}м`;
    } else deadlineText = 'дедлайн истёк';
  }

  return (
    <PageLayout title="Партия" backTo="/" centered rightAction={<ShareSessionButton shareToken={session.shareToken} compact />}>
      <div style={{ padding: '12px 14px 80px' }}>
        {/* Эмблема источника */}
        {emblem && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8,
            background: `${emblem.color}1A`,
            border: `.5px solid ${emblem.color}55`,
            color: emblem.color,
            fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            <emblem.Icon size={12} color={emblem.color} />
            {emblem.label}
          </div>
        )}

        {/* Бойцы (header) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 10, marginBottom: 16 }}>
          <PlayerCol side={blackSide} sideLabel="Чёрные" boardState={boardState} />
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '.55rem', fontWeight: 800, color: '#7A7875', letterSpacing: '.1em' }}>
              {isWaiting ? 'ОЖИДАНИЕ' : isLive ? 'LIVE' : 'ИТОГ'}
            </div>
            {deadlineText && (
              <div style={{ fontSize: '.7rem', color: '#FF8855', fontWeight: 700, marginTop: 3 }}>
                ⏱ {deadlineText}
              </div>
            )}
            {isFinished && winnerSide && (
              <div style={{ fontSize: '.7rem', color: '#3DBA7A', fontWeight: 700, marginTop: 3 }}>
                Победил {winnerSide.player.firstName}
              </div>
            )}
            {isFinished && !winnerSide && (
              <div style={{ fontSize: '.7rem', color: '#9A9490', fontWeight: 700, marginTop: 3 }}>
                Ничья
              </div>
            )}
            {session.bet && BigInt(session.bet) > 0n && (
              <div style={{ fontSize: '.65rem', color: '#F0C85A', fontWeight: 700, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CoinIcon size={11} /> {fmtBalance(session.bet)}
              </div>
            )}
          </div>
          <PlayerCol side={whiteSide} sideLabel="Белые" boardState={boardState} />
        </div>

        {/* Доска: упрощённая (8x8 сетка с фигурами Unicode) — для preview.
            Полноценная интерактивная — только в /game/:id для участников. */}
        <div style={{
          aspectRatio: '1 / 1', maxWidth: 360, margin: '0 auto 14px',
          background: '#1A1820', borderRadius: 8, overflow: 'hidden',
          border: '.5px solid rgba(255,255,255,.08)',
          display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
        }}>
          {boardState && boardState.flat().map((sq, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            const isLight = (r + c) % 2 === 0;
            const sym = sq ? pieceSymbol(sq) : '';
            return (
              <div key={i} style={{
                background: isLight ? '#DEB887' : '#8B4513',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', color: sq?.color === 'w' ? '#FFF' : '#000',
                textShadow: '0 1px 2px rgba(0,0,0,.3)',
              }}>{sym}</div>
            );
          })}
        </div>

        {/* Донат-пул */}
        {BigInt(session.donationPool || '0') > 0n && (
          <div style={{
            margin: '0 auto 12px', padding: '10px 14px',
            background: 'rgba(212,168,67,.08)', border: '.5px solid rgba(212,168,67,.3)',
            borderRadius: 12, textAlign: 'center', maxWidth: 360,
          }}>
            <div style={{ fontSize: '.55rem', color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>
              Призовая казна партии
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F0C85A', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <CoinIcon size={16} /> {fmtBalance(session.donationPool)}
            </div>
          </div>
        )}

        {/* Кнопки доната — для WAITING / LIVE, не для FINISHED */}
        {!isFinished && (
          <div style={{
            margin: '0 auto', maxWidth: 360,
            background: 'linear-gradient(135deg,#141018,#0F0E18)',
            border: '.5px solid rgba(154,148,144,.22)',
            borderRadius: 14, padding: '12px',
          }}>
            <div style={{ fontSize: '.6rem', color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 8 }}>
              Болеешь за кого?
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[whiteSide, blackSide].map((s) => s && (
                <button
                  key={s.id}
                  onClick={() => setDonateSideId(s.id)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10,
                    background: donateSideId === s.id ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.04)',
                    border: `.5px solid ${donateSideId === s.id ? 'rgba(212,168,67,.5)' : 'rgba(255,255,255,.08)'}`,
                    color: donateSideId === s.id ? '#F0C85A' : '#EAE2CC',
                    fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {s.isWhite ? 'Белые' : 'Чёрные'} · {s.player.firstName}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {['100', '500', '1000', '5000'].map(v => (
                <button
                  key={v}
                  onClick={() => setDonateAmount(v)}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8,
                    background: donateAmount === v ? 'rgba(155,109,255,.15)' : 'rgba(255,255,255,.04)',
                    border: `.5px solid ${donateAmount === v ? 'rgba(155,109,255,.4)' : 'rgba(255,255,255,.08)'}`,
                    color: donateAmount === v ? '#9B85FF' : '#9A9490',
                    fontSize: '.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{v}</button>
              ))}
            </div>
            <button
              onClick={handleDonate}
              disabled={donating || !donateSideId}
              style={{
                width: '100%', padding: '12px 0',
                borderRadius: 12,
                background: !donateSideId ? 'rgba(255,255,255,.04)' : 'linear-gradient(135deg,#D4A843,#F0C85A)',
                border: 'none',
                color: !donateSideId ? '#7A7875' : '#0D0D12',
                fontSize: '.78rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                opacity: donating ? 0.5 : 1,
              }}
            >
              {donating ? '...' : 'Поддержать донатом'}
            </button>
          </div>
        )}

        {/* Replay для FINISHED */}
        {isFinished && session.pgn && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              onClick={() => setShowReplay(true)}
              style={{
                padding: '10px 18px', borderRadius: 12,
                background: 'linear-gradient(135deg,#1F2E5A,#2A3F7A)',
                border: '.5px solid rgba(74,158,255,.4)',
                color: '#82CFFF', fontSize: '.78rem', fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Посмотреть партию</button>
          </div>
        )}

        {showReplay && session && (
          <PgnReplayModal
            pgn={session.pgn}
            title="Партия"
            sessionId={session.id}
            whitePlayer={whiteSide?.player as any}
            blackPlayer={blackSide?.player as any}
            onClose={() => setShowReplay(false)}
          />
        )}
      </div>
    </PageLayout>
  );
};

const PlayerCol: React.FC<{ side: ShareSession['sides'][0] | undefined; sideLabel: string; boardState: any }> = ({ side, sideLabel }) => {
  if (!side) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
      <Avatar user={side.player as any} size="l" />
      <div style={{ fontSize: '.55rem', color: '#7A7875', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>{sideLabel}</div>
      <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#EAE2CC', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 4 }}>
        {side.player.firstName}
        {side.player.country?.code && <CountryFlag code={side.player.country.code} size={12} />}
      </div>
      <div style={{ fontSize: '.62rem', color: '#7A7470' }}>ELO {side.player.elo}</div>
      {side.topDonor && (
        <div style={{ fontSize: '.55rem', color: '#F0C85A', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <CoinIcon size={9} /> топ {fmtBalance(side.topDonor.amount)}
        </div>
      )}
    </div>
  );
};

function pieceSymbol(sq: { type: string; color: 'w' | 'b' }): string {
  const map: Record<string, string> = {
    'wp': '♙', 'wn': '♘', 'wb': '♗', 'wr': '♖', 'wq': '♕', 'wk': '♔',
    'bp': '♟', 'bn': '♞', 'bb': '♝', 'br': '♜', 'bq': '♛', 'bk': '♚',
  };
  return map[`${sq.color}${sq.type}`] ?? '';
}

export default SharePage;
