import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';
import type { Lang } from '@/i18n/translations';
import { profileApi, authApi, warsApi, gamesApi, nationsApi } from '@/api';
import { fmtBalance, fmtDate, leagueEmoji } from '@/utils/format';
import type { Transaction, GameHistoryItem } from '@/types';
import { JARVIS_LEVELS } from '@/components/ui/JarvisModal';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

// ── PgnReplayModal ────────────────────────────────────────────────────────────
const PgnReplayModal: React.FC<{ pgn: string; title?: string; onClose: () => void }> = ({ pgn, title, onClose }) => {
  const [moves, setMoves] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [fens, setFens] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      const history = chess.history();
      const fenList: string[] = ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'];
      const c2 = new Chess();
      for (const m of history) {
        c2.move(m);
        fenList.push(c2.fen());
      }
      setMoves(history);
      setFens(fenList);
      setStep(0);
    } catch {}
  }, [pgn]);

  // Auto-play: advance step every 1.5s
  useEffect(() => {
    if (!isPlaying) return;
    if (step >= fens.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep(s => s + 1), 1500);
    return () => clearTimeout(timer);
  }, [isPlaying, step, fens.length]);

  const currentFen = fens[step] ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#13161E', borderRadius: 24, padding: 20, width: '100%', maxWidth: 420, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F5C842' }}>♟ {title ?? 'Разбор партии'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#A8B0C8', fontSize: 16, cursor: 'pointer', padding: 0 }}>✕</button>
        </div>

        <Chessboard position={currentFen} arePiecesDraggable={false} boardWidth={Math.min(380, window.innerWidth - 72)} />

        {/* Move counter */}
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#A8B0C8' }}>
          Ход {step} / {fens.length - 1}
          {step > 0 && moves[step - 1] && <span style={{ color: '#F5C842', marginLeft: 6 }}>{moves[step - 1]}</span>}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {[
            { label: '⏮', action: () => { setIsPlaying(false); setStep(0); } },
            { label: '◀', action: () => { setIsPlaying(false); setStep(s => Math.max(0, s - 1)); } },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} style={{ flex: 1, padding: '10px 0', background: '#232840', border: 'none', borderRadius: 10, color: '#F0F2F8', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
          <button
            onClick={() => setIsPlaying(p => !p)}
            style={{ flex: 2, padding: '10px 0', background: isPlaying ? 'rgba(245,200,66,0.15)' : '#F5C842', border: isPlaying ? '1px solid rgba(245,200,66,0.4)' : 'none', borderRadius: 10, color: isPlaying ? '#F5C842' : '#0B0D11', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {isPlaying ? '⏸' : '▶ Авто'}
          </button>
          {[
            { label: '▶', action: () => { setIsPlaying(false); setStep(s => Math.min(fens.length - 1, s + 1)); } },
            { label: '⏭', action: () => { setIsPlaying(false); setStep(fens.length - 1); } },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} style={{ flex: 1, padding: '10px 0', background: '#232840', border: 'none', borderRadius: 10, color: '#F0F2F8', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Move list */}
        <div style={{ marginTop: 12, maxHeight: 100, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {moves.map((m, i) => (
            <button key={i} onClick={() => { setIsPlaying(false); setStep(i + 1); }} style={{
              padding: '3px 7px', fontSize: 11, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: step === i + 1 ? '#F5C842' : '#1C2030',
              color: step === i + 1 ? '#0B0D11' : '#A8B0C8',
            }}>
              {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}{m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── BadgeDetailModal ─────────────────────────────────────────────────────────
const BadgeDetailModal: React.FC<{
  badgeName: string;
  date?: string;
  onClose: () => void;
}> = ({ badgeName, date, onClose }) => {
  const t = useT();
  const lvlData = JARVIS_LEVELS.find(l => l.name === badgeName);
  const colors: Record<string, string> = {
    Beginner: '#A8B0C8', Player: '#00B4D8', Fighter: '#00D68F',
    Warrior: '#4CAF50', Expert: '#9B85FF', Master: '#F5C842',
    Professional: '#FF9F43', Epic: '#FF6B6B', Legendary: '#E040FB', Mystic: '#F5C842',
  };
  const color = colors[badgeName] ?? '#9B85FF';
  const formattedDate = date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 320, background: 'linear-gradient(160deg,#13161F,#0B0D11)', border: `1px solid ${color}40`, borderRadius: 24, padding: '32px 24px 24px', textAlign: 'center', boxShadow: `0 0 60px ${color}20` }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6B7494', marginBottom: 8 }}>{t.gameResult.jarvisCert}</div>
        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color, marginBottom: 8 }}>{badgeName}</div>
        <div style={{ fontSize: 13, color: '#A8B0C8', marginBottom: 20 }}>
          {t.profile.level} {lvlData?.level ?? '?'} · +{(lvlData?.reward ?? 0).toLocaleString()} ᚙ
        </div>
        {formattedDate && (
          <div style={{ fontSize: 14, color: '#A8B0C8', marginBottom: 8 }}>📅 {formattedDate}</div>
        )}
        <div style={{ fontSize: 12, color: '#00D68F', marginBottom: 24 }}>{t.gameResult.confirmedBy}</div>
        <button onClick={onClose} style={{ width: '100%', padding: 12, background: '#1C2030', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#F0F2F8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {t.gameResult.close}
        </button>
      </div>
    </div>
  );
};

type Tab = 'analytics' | 'saves' | 'ach' | 'settings';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const { lang, setLang, soundEnabled, setSoundEnabled } = useSettingsStore();
  const t = useT();
  const [tab, setTab] = useState<Tab>('analytics');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [gamesList, setGamesList] = useState<GameHistoryItem[]>([]);
  const [showTxModal, setShowTxModal] = useState(false);
  const [savedGames, setSavedGames] = useState<any[]>([]);
  const [savedGameIds, setSavedGameIds] = useState<Set<string>>(new Set());
  const [replayGame, setReplayGame] = useState<{ pgn: string; title?: string } | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<{ name: string; date?: string } | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nationFlag, setNationFlag] = useState<string | null>(null);
  const [confirmDeleteAvatar, setConfirmDeleteAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.nationId) {
      nationsApi.getMy().then((r) => {
        if (r.clan?.flag) setNationFlag(r.clan.flag);
      }).catch(() => {});
    }
  }, [user?.nationId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    try {
      await profileApi.uploadAvatar(file);
      const updated = await authApi.me();
      setUser(updated);
      showToast(t.profile.avatarUpdated);
    } catch (err: any) {
      showToast(err.message || t.profile.uploadError);
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarDelete = () => {
    setConfirmDeleteAvatar(true);
  };

  const doAvatarDelete = async () => {
    setConfirmDeleteAvatar(false);
    setAvatarLoading(true);
    try {
      await profileApi.deleteAvatar();
      const updated = await authApi.me();
      setUser(updated);
      showToast(t.profile.avatarDeleted);
    } catch (err: any) {
      showToast(err.message || t.common.error);
    } finally {
      setAvatarLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'analytics') {
      profileApi.getGames().then((r) => {
        setGamesList(r.games);
        // Загружаем список сохранённых ID для иконок
        gamesApi.savedList().then((list: any[]) => {
          setSavedGameIds(new Set(list.map((s: any) => s.session?.id ?? s.sessionId)));
        }).catch(() => {});
      }).catch(() => {});
    }
    if (tab === 'saves') {
      warsApi.savedGames().then((r) => setSavedGames(r.savedGames)).catch(() => {});
    }
  }, [tab]);

  useEffect(() => {
    if (showTxModal) {
      profileApi.getTransactions(50).then((r) => setTransactions(r.transactions)).catch(() => {});
    }
  }, [showTxModal]);

  if (!user) return null;

  const totalGames = user.totalGames ?? 0;
  const wins = user.wins ?? 0;
  const losses = user.losses ?? 0;
  const draws = user.draws ?? 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const lossRate = totalGames > 0 ? Math.round((losses / totalGames) * 100) : 0;
  const drawRate = totalGames > 0 ? 100 - winRate - lossRate : 0;

  // JARVIS ring chart variables
  const jLvl = (user as any).jarvisLevel ?? 1;
  const jName = JARVIS_LEVELS[Math.max(0, Math.min(9, jLvl - 1))].name;
  const _R = 30, _C = 2 * Math.PI * _R;
  const _jDash = ((jLvl - 1) / 9) * _C;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'analytics', label: 'Аналитика' },
    { id: 'saves',     label: t.profile.tabs.saves },
    { id: 'ach',       label: t.profile.tabs.achievements },
  ];

  const rightAction = (
    <button onClick={() => navigate('/settings')} style={tbaStyle}>⚙</button>
  );

  return (
    <PageLayout backTo="/" rightAction={rightAction}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: '#232840', border: '1px solid #F5C842', borderRadius: 12, padding: '10px 20px', fontSize: 13, color: '#F5C842', zIndex: 9999, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarUpload}
      />
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 18px 0' }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={avatarRingStyle} />
          <Avatar user={user} size="xl" gold />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarLoading}
            style={{ position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: '50%', background: '#F5C842', border: '2px solid #0B0D11', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
            title="Upload avatar"
          >
            {avatarLoading ? '…' : '📷'}
          </button>
          {user.avatarType === 'UPLOAD' && !avatarLoading && (
            <button
              onClick={handleAvatarDelete}
              style={{ position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: '#FF4D6A', border: '2px solid #0B0D11', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: '#fff' }}
              title="Delete avatar"
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 18, fontWeight: 700, color: '#F0F2F8', letterSpacing: '-.02em', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          {nationFlag && <span style={{ fontSize: 20 }}>{nationFlag}</span>}
          {user.firstName} {user.lastName ?? ''}
        </div>
        <div style={{ fontSize: 12, color: '#A8B0C8', marginTop: 3 }}>@{user.username ?? 'unknown'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
          <span style={tagGold}>{leagueEmoji[user.league]} #1</span>
          <span style={tagVi}>ELO {user.elo}</span>
          {(user as any).militaryRank && (
            <span style={{ ...tagGr, background: 'rgba(255,159,67,0.1)', color: '#FF9F43', borderColor: 'rgba(255,159,67,0.2)' }}>
              {(user as any).militaryRank.emoji} {(user as any).militaryRank.label}
            </span>
          )}
          <span style={tagRobot}>🤖 {JARVIS_LEVELS[Math.max(0, ((user as any).jarvisLevel ?? 1) - 1)].name}</span>
        </div>
      </div>

      {/* Balance */}
      <div style={balCard}>
        <div>
          <div style={microLbl}>{t.profile.balance}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 20, fontWeight: 800, color: '#F5C842' }}>
              {fmtBalance(user.balance)} <span style={{ fontSize: 12, opacity: .5 }}>ᚙ</span>
            </div>
            <button
              onClick={() => setShowTxModal(true)}
              title="История транзакций"
              style={{ background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.25)', borderRadius: 8, padding: '4px 8px', color: '#F5C842', fontSize: 14, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
            >
              💰
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => navigate('/shop')} style={secBtn}>{t.profile.shop}</button>
          <button onClick={() => navigate('/referrals')} style={ghostBtn}>{t.profile.referrals}</button>
        </div>
      </div>

      {/* League progress bar */}
      {(() => {
        const LEAGUE_THRESHOLDS: Record<string, { next: string | null; threshold: bigint; nextThreshold: bigint }> = {
          BRONZE:   { next: 'SILVER',   threshold: 0n,           nextThreshold: 100_000n },
          SILVER:   { next: 'GOLD',     threshold: 100_000n,     nextThreshold: 1_000_000n },
          GOLD:     { next: 'DIAMOND',  threshold: 1_000_000n,   nextThreshold: 5_000_000n },
          DIAMOND:  { next: 'CHAMPION', threshold: 5_000_000n,   nextThreshold: 10_000_000n },
          CHAMPION: { next: 'STAR',     threshold: 10_000_000n,  nextThreshold: 50_000_000n },
          STAR:     { next: null,       threshold: 50_000_000n,  nextThreshold: 50_000_000n },
        };
        const info = LEAGUE_THRESHOLDS[user.league];
        if (!info) return null;
        const bal = BigInt(user.balance ?? '0');
        const range = info.nextThreshold - info.threshold;
        const progress = info.next === null ? 100 : range > 0n ? Math.min(100, Number((bal - info.threshold) * 100n / range)) : 100;
        const remaining = info.next ? info.nextThreshold - bal : 0n;
        return (
          <div style={{ margin: '0 18px 10px', padding: '12px 16px', background: '#13161E', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F5C842' }}>{leagueEmoji[user.league]} Лига {user.league}</div>
              {info.next ? (
                <div style={{ fontSize: 10, color: '#A8B0C8' }}>до {leagueEmoji[info.next]} {info.next}: {fmtBalance(remaining.toString())} ᚙ</div>
              ) : (
                <div style={{ fontSize: 10, color: '#00D68F', fontWeight: 700 }}>★ Максимальная лига</div>
              )}
            </div>
            <div style={{ height: 5, background: '#1C2030', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#F5C842,#FFD966)', borderRadius: 3, transition: 'width .5s' }} />
            </div>
            <div style={{ fontSize: 9, color: '#6B7494', marginTop: 4 }}>{progress}% до следующей лиги</div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div style={ptabsStyle}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={ptab(tab === id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Analytics tab (merged info + games) */}
      {tab === 'analytics' && (() => {
        return (
          <>
            {/* Top stat rings */}
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 18px 6px' }}>
              {/* JARVIS ring */}
              <div style={{ textAlign: 'center' }}>
                <svg width="76" height="76" viewBox="0 0 76 76">
                  <circle cx="38" cy="38" r={_R} fill="none" stroke="#1C2030" strokeWidth="6" />
                  <circle cx="38" cy="38" r={_R} fill="none" stroke="#9B85FF" strokeWidth="6"
                    strokeDasharray={`${_jDash} ${_C}`} strokeLinecap="round"
                    transform="rotate(-90 38 38)" />
                  <text x="38" y="42" textAnchor="middle" fill="#F0F2F8" fontSize="15" fontWeight="800" fontFamily="'JetBrains Mono',monospace">{jLvl}</text>
                </svg>
                <div style={{ fontSize: 9, color: '#9B85FF', fontWeight: 700, marginTop: 3, letterSpacing: '.04em' }}>JARVIS</div>
                <div style={{ fontSize: 9, color: '#6B7494', marginTop: 1 }}>{jName}</div>
              </div>
              {/* Wins ring */}
              <CircStat value={wins}   pct={winRate}  color="#00D68F" label={t.profile.wins}   />
              {/* Losses ring */}
              <CircStat value={losses} pct={lossRate} color="#FF4D6A" label={t.profile.losses} />
              {/* Draws ring */}
              <CircStat value={draws}  pct={drawRate} color="#9B85FF" label={t.profile.draws}  />
            </div>

            {/* Small stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '6px 18px 0' }}>
              <StatCard val={totalGames}          lbl={t.profile.games}  />
              <StatCard val={user.elo}            lbl={t.profile.elo}    color="#9B85FF" />
              <StatCard val={user.winStreak ?? 0} lbl={t.profile.streak} color="#F5C842" />
            </div>

            {/* ELO chart */}
            <div style={{ margin: '10px 18px 0', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 12 }}>
              <div style={microLbl}>{t.profile.eloChart}</div>
              <svg viewBox="0 0 300 60" preserveAspectRatio="none" style={{ width: '100%', height: 60 }}>
                <defs>
                  <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9B85FF" stopOpacity=".3" />
                    <stop offset="100%" stopColor="#9B85FF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,45 L40,40 L80,35 L120,30 L160,22 L200,18 L240,12 L300,6" fill="none" stroke="#9B85FF" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M0,45 L40,40 L80,35 L120,30 L160,22 L200,18 L240,12 L300,6 L300,60 L0,60 Z" fill="url(#eg)" />
              </svg>
            </div>

            {/* Game history */}
            <div style={secStyle}>История партий</div>
            {gamesList.length === 0 && (
              <div style={{ textAlign: 'center', color: '#6B7494', padding: '24px 18px', fontSize: 13 }}>
                Нет сыгранных партий
              </div>
            )}
            {gamesList.map((g) => {
              const resultColor = g.result === 'WON' ? '#00D68F' : g.result === 'LOST' ? '#FF4D6A' : '#9B85FF';
              const resultLabel = g.result === 'WON' ? '✓ Победа' : g.result === 'LOST' ? '✗ Пораж.' : '= Ничья';
              const opponentName = g.hasBot ? `JARVIS Lv.${g.botLevel}` : (g.opponent?.firstName ?? '?');
              const myColor = g.isWhite ? '♔ Белые' : '♚ Чёрные';
              const oppColor = g.isWhite ? '♚ Чёрные' : '♔ Белые';
              const earned = g.winningAmount && BigInt(g.winningAmount) > 0n;
              return (
                <div
                  key={g.sessionId}
                  style={{ margin: '0 18px 8px', padding: '12px 14px', background: '#13161E', border: `1px solid ${resultColor}28`, borderRadius: 16, cursor: g.pgn ? 'pointer' : 'default' }}
                  onClick={() => g.pgn && setReplayGame({ pgn: g.pgn, title: `${user.firstName} vs ${opponentName}` })}
                >
                  {/* VS row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {/* My side */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
                      <Avatar user={user} size="s" />
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#F0F2F8', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.firstName}</div>
                      <div style={{ fontSize: 8, color: '#6B7494' }}>{myColor}</div>
                    </div>
                    {/* Middle */}
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 16 }}>⚔️</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: resultColor, marginTop: 2 }}>{resultLabel}</div>
                      {earned && (
                        <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: '#00D68F', marginTop: 1 }}>+{fmtBalance(g.winningAmount!)} ᚙ</div>
                      )}
                    </div>
                    {/* Opponent side */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1C2030', border: '1.5px solid rgba(155,133,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                        {g.hasBot ? '🤖' : '👤'}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#F0F2F8', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opponentName}</div>
                      <div style={{ fontSize: 8, color: '#6B7494' }}>{oppColor}</div>
                    </div>
                  </div>
                  {/* Footer row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 9, color: '#6B7494' }}>{g.type === 'BOT' ? '🤖 Бот' : g.type === 'BATTLE' ? '⚔ Батл' : '🤝 Дружеская'} · {g.finishedAt ? fmtDate(g.finishedAt) : ''}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {g.pgn && <span style={{ fontSize: 9, color: '#6B7494' }}>↗ разобрать</span>}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const isSaved = savedGameIds.has(g.sessionId);
                          if (isSaved) {
                            gamesApi.unsave(g.sessionId).then(() => setSavedGameIds(s => { const n = new Set(s); n.delete(g.sessionId); return n; }));
                          } else {
                            gamesApi.save(g.sessionId).then(() => setSavedGameIds(s => new Set([...s, g.sessionId])));
                          }
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                          fontSize: 14, color: savedGameIds.has(g.sessionId) ? '#F5C842' : '#6B7494',
                          lineHeight: 1,
                        }}
                        title={savedGameIds.has(g.sessionId) ? 'Убрать из сохранённых' : 'Сохранить партию'}
                      >
                        {savedGameIds.has(g.sessionId) ? '🔖' : '🔖'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

        </>
      );
      })()}

      {/* Saves tab */}
      {tab === 'saves' && (
        <>
          <div style={secStyle}>{t.profile.savedGames}</div>
          {savedGames.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6B7494', padding: 32, fontSize: 13 }}>
              {t.profile.noSaves}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
              {savedGames.map((sg: any) => {
                const s = sg.session;
                const sides = s?.sides ?? [];
                const p1 = sides[0]?.player;
                const p2 = sides[1]?.player;
                const winner = sides.find((sd: any) => sd.status === 'WON');
                return (
                  <div key={sg.id} style={{ background: '#13161E', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar user={p1} size="s" />
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F2F8' }}>{p1?.firstName ?? '?'}</div>
                      </div>
                      <div style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#A8B0C8' }}>vs</div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F2F8', textAlign: 'right' }}>{p2?.firstName ?? '?'}</div>
                        <Avatar user={p2} size="s" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s?.pgn ? 8 : 0 }}>
                      <div style={{ fontSize: 10, color: '#6B7494' }}>
                        {s?.type ?? ''} · {s?.finishedAt ? fmtDate(s.finishedAt) : ''}
                      </div>
                      {winner && (
                        <div style={{ fontSize: 11, color: '#00D68F', fontWeight: 600 }}>
                          🏆 {winner.player?.firstName ?? 'Unknown'}
                        </div>
                      )}
                      <button
                        onClick={() => warsApi.unsaveGame(s.id).then(() => setSavedGames(g => g.filter(x => x.id !== sg.id)))}
                        style={{ fontSize: 10, color: '#6B7494', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px' }}
                      >
                        ✕ убрать
                      </button>
                    </div>
                    {s?.pgn && (
                      <button
                        onClick={() => setReplayGame({ pgn: s.pgn, title: `${p1?.firstName ?? '?'} vs ${p2?.firstName ?? '?'}` })}
                        style={{ width: '100%', padding: '7px 0', background: 'rgba(245,200,66,0.08)', color: '#F5C842', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        ♟ Разобрать партию
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Achievements tab */}
      {tab === 'ach' && (
        <>
          <div style={secStyle}>{t.profile.jarvisCerts}</div>
          {((user as any).jarvisBadges?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', color: '#6B7494', padding: 32, fontSize: 13 }}>
              {t.profile.noJarvis}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 18px' }}>
              {[...((user as any).jarvisBadges ?? [])].reverse().map((badgeName: string, i: number) => {
                const lvlData = JARVIS_LEVELS.find(l => l.name === badgeName);
                const badgeDates = (user as any).jarvisBadgeDates as Record<string, string> | null;
                const dateStr = badgeDates?.[badgeName];
                const colors: Record<string, string> = {
                  Beginner: '#A8B0C8', Player: '#00B4D8', Fighter: '#00D68F',
                  Warrior: '#4CAF50', Expert: '#9B85FF', Master: '#F5C842',
                  Professional: '#FF9F43', Epic: '#FF6B6B', Legendary: '#E040FB', Mystic: '#F5C842',
                };
                const color = colors[badgeName] ?? '#9B85FF';
                return (
                  <div key={i} onClick={() => setSelectedBadge({ name: badgeName, date: dateStr })} style={{ background: 'linear-gradient(135deg,#1C2030,#13161F)', border: `1px solid ${color}40`, borderRadius: 14, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}18`, border: `2px solid ${color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18 }}>🤖</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#F0F2F8' }}>{badgeName}</div>
                    <div style={{ fontSize: 9, color, fontWeight: 700 }}>Lv.{lvlData?.level ?? '?'}</div>
                    {dateStr && (
                      <div style={{ fontSize: 9, color: '#6B7494' }}>
                        {new Date(dateStr).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <>
          <div style={secStyle}>{t.profile.settings.title}</div>
          <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Language */}
            <div style={settingCard}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F2F8' }}>{t.profile.settings.language}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['en', 'ru'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: lang === l ? '#F5C842' : '#1C2030',
                      color: lang === l ? '#0B0D11' : '#A8B0C8',
                      border: lang === l ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all .15s',
                    }}
                  >
                    {l === 'en' ? '🇬🇧 EN' : '🇷🇺 RU'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound */}
            <div style={settingCard}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F2F8' }}>{t.profile.settings.sound}</div>
                <div style={{ fontSize: 11, color: '#6B7494', marginTop: 3 }}>
                  {soundEnabled ? t.profile.settings.soundOn : t.profile.settings.soundOff}
                </div>
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                style={{
                  width: 52, height: 28,
                  borderRadius: 14,
                  background: soundEnabled ? '#F5C842' : '#2A2F48',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background .2s',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 3,
                  left: soundEnabled ? 26 : 3,
                  width: 22, height: 22,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left .2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

          </div>
        </>
      )}

      {/* Badge detail modal */}
      {selectedBadge && (
        <BadgeDetailModal
          badgeName={selectedBadge.name}
          date={selectedBadge.date}
          onClose={() => setSelectedBadge(null)}
        />
      )}

      {/* PGN Replay modal */}
      {replayGame && (
        <PgnReplayModal
          pgn={replayGame.pgn}
          title={replayGame.title}
          onClose={() => setReplayGame(null)}
        />
      )}

      {/* Transaction history modal */}
      {showTxModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 400, display: 'flex', flexDirection: 'column' }}
          onClick={(e) => e.target === e.currentTarget && setShowTxModal(false)}
        >
          <div style={{ background: '#0B0D11', flex: 1, marginTop: 56, borderRadius: '24px 24px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ padding: '18px 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 15, fontWeight: 700, color: '#F5C842' }}>💰 История транзакций</div>
              <button onClick={() => setShowTxModal(false)} style={{ background: 'none', border: 'none', color: '#A8B0C8', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0 24px' }}>
              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6B7494', padding: 40, fontSize: 13 }}>Нет транзакций</div>
              ) : transactions.map((tx) => {
                const isPos = BigInt(tx.amount) > 0n;
                const TX_LABELS: Record<string, string> = {
                  WELCOME_BONUS:    '🎁 Приветственный бонус',
                  BOT_WIN:          '🤖 Победа над ботом',
                  BOT_PIECE:        '♟ За взятую фигуру',
                  BOT_LOSS:         '🤖 Проигрыш боту',
                  BATTLE_WIN:       '⚔ Победа в батле',
                  BATTLE_BET:       '🎲 Ставка в батле',
                  BATTLE_COMMISSION:'💸 Комиссия стола (10%)',
                  FRIENDLY_WIN:     '🤝 Победа (дружеская)',
                  REFERRAL_BONUS:   '👥 Реферальный бонус',
                  TASK_REWARD:      '✅ Выполнение задания',
                  ATTEMPT_PURCHASE: '🔄 Покупка попытки',
                  ITEM_PURCHASE:    '🛍 Покупка предмета',
                  CLAN_CONTRIBUTION:'🏰 Взнос в клан',
                  WITHDRAWAL:       '💳 Вывод TON',
                  TON_DEPOSIT:      '💎 Пополнение TON',
                };
                return (
                  <div key={tx.id} style={{ margin: '4px 18px 0', padding: '12px 14px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: isPos ? 'rgba(0,214,143,0.1)' : 'rgba(255,77,106,0.1)', border: `1px solid ${isPos ? 'rgba(0,214,143,0.25)' : 'rgba(255,77,106,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                      {isPos ? '📈' : '📉'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#F0F2F8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {TX_LABELS[tx.type] ?? tx.type}
                      </div>
                      <div style={{ fontSize: 10, color: '#A8B0C8', marginTop: 2 }}>{fmtDate(tx.createdAt)}</div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: isPos ? '#00D68F' : '#FF4D6A', flexShrink: 0 }}>
                      {isPos ? '+' : ''}{fmtBalance(tx.amount)} ᚙ
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение удаления аватара */}
      {confirmDeleteAvatar && (
        <ConfirmModal
          icon="🗑️"
          title="Удалить аватар?"
          message="Аватар будет удалён безвозвратно."
          confirmLabel="Удалить"
          variant="danger"
          onConfirm={doAvatarDelete}
          onCancel={() => setConfirmDeleteAvatar(false)}
        />
      )}
    </PageLayout>
  );
};

const CircStat: React.FC<{ value: number; pct: number; color: string; label: string }> = ({ value, pct, color, label }) => {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#2A2F48" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 16, fontWeight: 800, color: '#F0F2F8' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</div>
      <div style={{ fontSize: 10, color: '#6B7494', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
};

const StatCard: React.FC<{ val: number; lbl: string; color?: string }> = ({ val, lbl, color }) => (
  <div style={{ background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 20, fontWeight: 800, color: color ?? '#F0F2F8' }}>{val}</div>
    <div style={{ fontSize: 10, color: '#6B7494', marginTop: 3, fontWeight: 500 }}>{lbl}</div>
  </div>
);

// Styles
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#7B8299', padding: '16px 18px 8px' };
const microLbl: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7B8299', marginBottom: 3 };
const balCard: React.CSSProperties = { margin: '12px 18px 0', padding: '14px 18px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const ptabsStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', margin: '12px 18px 0', overflowX: 'auto' as any };
const ptab = (active: boolean): React.CSSProperties => ({ flex: '0 0 auto', textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: active ? '#F5C842' : '#A8B0C8', cursor: 'pointer', border: 'none', borderBottom: `2px solid ${active ? '#F5C842' : 'transparent'}`, outline: 'none', background: 'none', fontFamily: 'inherit', transition: 'all .2s', whiteSpace: 'nowrap' } as any);
const stripStyle: React.CSSProperties = { margin: '4px 18px 0', padding: '13px 16px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 };
const tbaStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 11, background: '#1C2030', border: '1px solid rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: '#A8B0C8' };
const secBtn: React.CSSProperties = { padding: '8px 14px', background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn: React.CSSProperties = { ...secBtn, background: 'transparent', color: '#A8B0C8' };
const goldBtn: React.CSSProperties = { padding: '8px 14px', background: '#F5C842', color: '#0B0D11', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const tagGold: React.CSSProperties = { display: 'inline-flex', padding: '3px 8px', background: 'rgba(245,200,66,0.12)', color: '#F5C842', borderRadius: 6, fontSize: 10, fontWeight: 700 };
const tagVi: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const tagGr: React.CSSProperties = { ...tagGold, background: 'rgba(0,214,143,0.10)', color: '#00D68F' };
const tagRobot: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const avatarRingStyle: React.CSSProperties = { position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid #F5C842', opacity: .4, animation: 'ring-pulse 3s ease-in-out infinite' };
const settingCard: React.CSSProperties = { background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
