import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';
import type { Lang } from '@/i18n/translations';
import { profileApi, authApi, warsApi } from '@/api';
import { fmtBalance, fmtDate, leagueEmoji } from '@/utils/format';
import type { Transaction, UserPublic } from '@/types';
import { JARVIS_LEVELS } from '@/components/ui/JarvisModal';

// Local type for Tab
type Tab = 'info' | 'saves' | 'ach';

// Game history item returned by profileApi.getGames() — represents a player's side in a session
interface GameHistoryItem {
  id: string;
  status: string;
  winningAmount?: string | null;
  session: {
    id: string;
    type: string;
    pgn?: string | null;
    bet?: string | null;
    finishedAt?: string | null;
    sides: Array<{
      playerId: string;
      status?: string;
      player: UserPublic;
    }>;
  };
}

// Saved game item returned by warsApi.savedGames()
interface SavedGameItem {
  id: string;
  session: {
    id: string;
    type?: string;
    pgn?: string | null;
    finishedAt?: string | null;
    sides: Array<{
      playerId?: string;
      status?: string;
      player: UserPublic;
    }>;
  };
}

// Tournament badge with extended fields
interface TournamentBadge {
  id: string;
  name: string;
  type: string;
  date?: string;
  place?: number;
  tournamentName?: string;
  prize?: string;
}
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

import { PgnReplayModal } from '@/components/profile/PgnReplayModal'; // R3
import { BadgeDetailModal } from '@/components/profile/BadgeDetailModal'; // R3
import { CircStat, StatCard } from '@/components/profile/StatComponents'; // R3

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const { lang, setLang, soundEnabled, setSoundEnabled } = useSettingsStore();
  const t = useT();
  const location = useLocation();
  const params = useParams<{ userId?: string }>();
  // Поддерживаем оба способа: /profile/:userId и navigate('/profile', {state:{userId}})
  const viewedUserId: string | undefined = params.userId ?? (location.state as Record<string,unknown>)?.userId as string | undefined;
  const isOwnProfile = !viewedUserId || viewedUserId === user?.id;
  const profileInfo = useInfoPopup('profile', [{ icon: '🏅', title: 'Your Profile', desc: 'Your stats, badges and game history. ELO shows your level — the higher, the stronger opponents.' }, { icon: '🎖️', title: 'Military Rank', desc: 'Rank grows with referrals. Higher rank — bigger percentage from friends\' wins.' }, { icon: '💰', title: 'Leagues & Rewards', desc: 'Earn coins to climb leagues: Bronze → Silver → Gold → Diamond → Champion.' }]);

  const [tab, setTab] = useState<Tab>('info');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentGames, setRecentGames]   = useState<GameHistoryItem[]>([]);
  const [savedGames, setSavedGames]     = useState<SavedGameItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [replayGame, setReplayGame] = useState<{ pgn: string; title?: string; sessionId?: string } | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<{ name: string; date?: string } | null>(null);

  useEffect(() => {
    if (tab === 'info') {
      profileApi.getGames().then((r) => setRecentGames((r.games ?? []) as unknown as GameHistoryItem[])).catch(() => {});
      profileApi.getTransactions().then((r) => setTransactions(r.transactions)).catch(() => {});
    }
    if (tab === 'saves') {
      warsApi.savedGames().then((r) => setSavedGames(r.savedGames as unknown as SavedGameItem[])).catch(() => {});
    }
  }, [tab]);

  // Handle replay from BattleHistoryPage redirection
  useEffect(() => {
    const state = location.state as Record<string, unknown> | null;
    if (state?.replay && !replayGame) {
      setReplayGame(state.replay as { pgn: string; title?: string; sessionId?: string });
      // clear the state so it doesn't re-trigger on refresh
      navigate(location.pathname, { replace: true, state: { ...state, replay: undefined } });
    }
  }, [location.state, navigate, replayGame]);

  if (!user) return null;

  const totalGames = user.totalGames ?? 0;
  const wins = user.wins ?? 0;
  const losses = user.losses ?? 0;
  const draws = user.draws ?? 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const lossRate = totalGames > 0 ? Math.round((losses / totalGames) * 100) : 0;
  const drawRate = totalGames > 0 ? (100 - winRate - lossRate) : 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'info',     label: t.profile.tabs.info },
    { id: 'saves',    label: t.profile.tabs.saves },
    { id: 'ach',      label: t.profile.tabs.achievements },
  ];

  const rightAction = isOwnProfile ? (
    <button onClick={() => setShowSettings(true)} style={tbaStyle}>⚙</button>
  ) : undefined;

  return (
    <>
    {isOwnProfile && profileInfo.show && <InfoPopup infoKey="profile" slides={[{ icon: '🏅', title: 'Your Profile', desc: 'Your stats, badges and game history. ELO shows your level — the higher, the stronger opponents.' }, { icon: '🎖️', title: 'Military Rank', desc: 'Rank grows with referrals. Higher rank — bigger percentage from friends\' wins.' }, { icon: '💰', title: 'Leagues & Rewards', desc: 'Earn coins to climb leagues: Bronze → Silver → Gold → Diamond → Champion.' }]} onClose={profileInfo.close} />}
    <PageLayout backTo="/" rightAction={rightAction} centered>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 18px 0' }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={avatarRingStyle} />

          {/* Аватар — кликабельный на чужом профиле */}
          {isOwnProfile ? (
            <Avatar user={user} size="xl" gold />
          ) : (
            /* Чужой профиль — аватар кликабелен → переход в магазин на конкретный товар */
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => {
              const premiumAvatar = user?.equippedItems?.PREMIUM_AVATAR;
              const frame = user?.equippedItems?.AVATAR_FRAME;
              if (premiumAvatar) {
                navigate('/shop', { state: { tab: 'avatars', highlightItemId: premiumAvatar.id } });
              } else if (frame) {
                navigate('/shop', { state: { tab: 'frames', highlightItemId: frame.id } });
              } else {
                navigate('/shop');
              }
            }}>
              <Avatar user={user} size="xl" gold />
              {/* Иконка магазина — видна если есть премиум-аватар или рамка */}
              {(user?.equippedItems?.PREMIUM_AVATAR || user?.equippedItems?.AVATAR_FRAME) && (
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(123,97,255,0.9)',
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11,
                }} title={t.profile.buyInShop}>
                  🛍
                </div>
              )}
              {/* Подсказка с названием предмета */}
              {(user?.equippedItems?.PREMIUM_AVATAR || user?.equippedItems?.AVATAR_FRAME) && (
                <div style={{
                  position: 'absolute', top: '105%', left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.8)', borderRadius: 6, padding: '2px 8px',
                  fontSize: 9, color: '#F5C842', whiteSpace: 'nowrap',
                  border: '1px solid rgba(245,200,66,0.3)',
                }}>
                  {user?.equippedItems?.PREMIUM_AVATAR?.name ?? user?.equippedItems?.AVATAR_FRAME?.name}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', letterSpacing: '-.02em', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {/* 2.1 Флаг страны рядом с именем */}
          {user?.countryMember?.country?.flag && (
            <span style={{ fontSize: 20 }}>{user?.countryMember.country.flag}</span>
          )}
          {user.firstName} {user.lastName ?? ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)', marginTop: 3 }}>@{user.username ?? 'unknown'}</div>
        {/* 2.3 Кнопка "Сразиться" на чужом профиле */}
        {!isOwnProfile && (
          <button
            onClick={() => navigate('/battles', { state: { challengeUserId: viewedUserId } })}
            style={{ marginTop: 10, padding: '9px 20px', background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 12, color: 'var(--accent, #F5C842)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ⚔️ {t.profile.challengeBtn ?? 'Challenge'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
          <span style={tagGold}>{leagueEmoji[user.league]} #1</span>
          <span style={tagVi}>ELO {user.elo}</span>
          {user?.countryMember?.isCommander && (
            <span style={{ ...tagGr, background: 'linear-gradient(135deg, rgba(245,200,66,0.15), rgba(255,215,0,0.08))', color: '#FFD700', borderColor: 'rgba(255,215,0,0.35)', fontWeight: 800 }}>
              👑 {t.profile.commanderBadge}
            </span>
          )}
          {user?.militaryRank && (
            <span style={{ ...tagGr, background: 'rgba(255,159,67,0.1)', color: '#FF9F43', borderColor: 'rgba(255,159,67,0.2)' }}>
              {user?.militaryRank.emoji} {user?.militaryRank.label}
            </span>
          )}
          <span style={tagRobot}>🤖 {JARVIS_LEVELS[Math.max(0, (user?.jarvisLevel ?? 1) - 1)].name}</span>
        </div>
      </div>

      {/* Balance — N7 */}
      <div style={{ ...balCard, flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={microLbl}>{t.profile.balance}</div>
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--accent, #F5C842)' }}>
              {fmtBalance(user.balance)} <span style={{ fontSize: 13, opacity: .5 }}>ᚙ</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/referrals')}
            style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer', flexShrink: 0 }}
            title={t.profile.txHistory}
          >👜</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => navigate('/shop')} style={{ ...secBtn, width: '100%' }}>{t.profile.shop}</button>
          <button onClick={() => navigate('/referrals')} style={{ ...secBtn, width: '100%' }}>{t.profile.referrals} →</button>
        </div>
      </div>

      {/* Чемпион месяца */}
      {user?.isMonthlyChampion && (
        <div style={{
          margin: '8px 18px 0',
          padding: '10px 16px',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(245,200,66,0.06))',
          border: '1px solid rgba(255,215,0,0.35)',
          borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 24, animation: 'pulse 2s ease-in-out infinite' }}>👑</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FFD700', fontFamily: "'Unbounded',sans-serif" }}>
              {t.profile.monthlyChampion ?? 'Monthly Champion'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
              ELO rating {user?.monthlyChampionAt ? `· ${new Date(user?.monthlyChampionAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : ''}
            </div>
          </div>
        </div>
      )}

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
          <div style={{ margin: '0 18px 10px', padding: '12px 16px', background: 'var(--bg-card, #13161E)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>{leagueEmoji[user.league]} {t.profile.league(user.league)}</div>
              {info.next ? (
                <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>{t.profile.toLeague(`${leagueEmoji[info.next]} ${info.next}`, fmtBalance(remaining.toString()))}</div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--green, #00D68F)', fontWeight: 700 }}>{t.profile.maxLeague}</div>
              )}
            </div>
            <div style={{ height: 5, background: 'var(--bg-card, #1C2030)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#F5C842,#FFD966)', borderRadius: 3, transition: 'width .5s' }} />
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted, #4A5270)', marginTop: 4 }}>{t.profile.leagueProgress(progress)}</div>
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

      {/* Info tab */}
      {tab === 'info' && (
        <>
          <div style={secStyle}>{t.profile.stats}</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 18px' }}>
            <CircStat value={wins}   pct={winRate}  color="var(--green, #00D68F)" label={t.profile.wins}   />
            <CircStat value={losses} pct={lossRate} color="var(--red, #FF4D6A)" label={t.profile.losses} />
            <CircStat value={draws}  pct={drawRate} color="#9B85FF" label={t.profile.draws}  />
          </div>

          <div style={{ margin: '0 18px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={microLbl}>{t.profile.eloChart}</div>
              <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: '#9B85FF', fontWeight: 700 }}>
                {user.elo} ELO
              </div>
            </div>
            {(() => {
              // Строим ELO-динамику из последних партий (обратный порядок → хронологический)
              const eloHistory: number[] = [];
              let elo = user.elo;
              const games = [...recentGames].reverse().slice(-10);
              // Аппроксимируем: +16 победа, -16 поражение, 0 ничья (K=32/2)
              for (const g of games) {
                eloHistory.push(elo);
                if (g.status === 'WON') elo = Math.max(100, elo - 16);
                else if (g.status === 'LOST') elo = elo + 16;
              }
              eloHistory.push(user.elo); // текущее
              if (eloHistory.length < 2) {
                return (
                  <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted,#4A5270)' }}>{t.profile.playGamesForChart}</span>
                  </div>
                );
              }
              const minE = Math.min(...eloHistory) - 20;
              const maxE = Math.max(...eloHistory) + 20;
              const W = 300, H = 54;
              const toX = (i: number) => (i / (eloHistory.length - 1)) * W;
              const toY = (e: number) => H - ((e - minE) / (maxE - minE)) * H;
              const pts = eloHistory.map((e, i) => `${toX(i)},${toY(e)}`).join(' L');
              const fill = `${pts} L${W},${H} L0,${H} Z`;
              const curElo = eloHistory[eloHistory.length - 1];
              const prevElo = eloHistory[eloHistory.length - 2];
              const trend = curElo > prevElo ? '↑' : curElo < prevElo ? '↓' : '→';
              const trendColor = curElo > prevElo ? 'var(--green,#00D68F)' : curElo < prevElo ? 'var(--red,#FF4D6A)' : '#9B85FF';
              return (
                <>
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 50, display: 'block' }}>
                    <defs>
                      <linearGradient id="eg2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9B85FF" stopOpacity=".35" />
                        <stop offset="100%" stopColor="#9B85FF" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`M${pts}`} fill="none" stroke="#9B85FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={`M${fill}`} fill="url(#eg2)" />
                    {/* Текущая точка */}
                    <circle cx={toX(eloHistory.length - 1)} cy={toY(user.elo)} r="3.5" fill="#9B85FF" />
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted,#4A5270)' }}>{t.profile.points(games.length + 1)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: trendColor }}>{trend} {Math.abs(curElo - prevElo)} ELO</span>
                  </div>
                </>
              );
            })()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '8px 18px 0' }}>
            <StatCard val={totalGames}       lbl={t.profile.games}  />
            <StatCard val={user.elo}         lbl={t.profile.elo}    color="#9B85FF" />
            <StatCard val={user.winStreak ?? 0} lbl={t.profile.streak} color="var(--accent, #F5C842)" />
          </div>

          {/* Последние партии */}
          <div style={{ ...secStyle, marginTop: 12 }}>{t.profile.recentGames}</div>
          {recentGames.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: '24px 0', fontSize: 13 }}>
              {t.profile.noGamesPlayed}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
              {recentGames.slice(0, 15).map((g) => {
                const myStatus = g.status;
                const opponentInfo = g.session?.sides?.find((s) => s.playerId !== user?.id);
                const mySide = g.session?.sides?.find((s) => s.playerId === user?.id);
                const oppPlayer = opponentInfo?.player;
                const myPlayer = mySide?.player ?? user;
                const isWon  = myStatus === 'WON';
                const isDraw = myStatus === 'DRAW';
                const statusColor = isWon ? 'var(--green,#00D68F)' : isDraw ? '#9B85FF' : 'var(--red,#FF4D6A)';
                const statusLabel = isWon ? t.profile.gameWon : isDraw ? t.profile.gameDraw : t.profile.gameLost;
                const earned = g.winningAmount ? fmtBalance(String(g.winningAmount)) : null;

                const typeIcon: Record<string, string> = { BOT: '🤖', BATTLE: '⚔️', WAR: '🌍', TOURNAMENT: '🏆' };
                const typeLabel: Record<string, string> = { BOT: 'vs JARVIS', BATTLE: t.profile.typeBattle, WAR: t.profile.typeWar, TOURNAMENT: t.profile.typeTournament };

                return (
                  <div key={g.id} style={{
                    display: 'flex', alignItems: 'stretch', gap: 8,
                    padding: '8px 10px', background: 'var(--bg-card,#1C2030)',
                    border: `1px solid ${isWon ? 'rgba(0,214,143,0.12)' : isDraw ? 'rgba(155,133,255,0.12)' : 'rgba(255,77,106,0.10)'}`,
                    borderRadius: 14,
                    position: 'relative'
                  }}>
                    {/* Цвет результата */}
                    <div style={{ width: 4, background: statusColor, borderRadius: 2 }} />

                    {/* Аватар оппонента (left) */}
                    <div 
                      onClick={() => oppPlayer && oppPlayer.id && navigate(`/profile/${oppPlayer.id}`, { state: { userId: oppPlayer.id } })} 
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 48, cursor: oppPlayer ? 'pointer' : 'default', zIndex: 2 }}
                    >
                      {oppPlayer ? (
                        <Avatar user={oppPlayer} size="m" />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                          {typeIcon[g.session?.type ?? ''] ?? '🤖'}
                        </div>
                      )}
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary,#F0F2F8)', marginTop: 4, width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {oppPlayer ? oppPlayer.firstName : typeLabel[g.session?.type ?? '']}
                      </div>
                    </div>

                    {/* Центр — Информация о партии (кликабельно для реплея) */}
                    <div 
                      onClick={() => g.session?.pgn && setReplayGame({ pgn: g.session.pgn, title: oppPlayer ? `vs ${oppPlayer.firstName}` : t.profile.gameLabel, sessionId: g.session.id })} 
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: g.session?.pgn ? 'pointer' : 'default', zIndex: 1, padding: '0 4px', textAlign: 'center' }}
                    >
                      <div style={{ fontSize: 10, color: 'var(--text-muted,#4A5270)', marginBottom: 2 }}>
                         {g.session?.finishedAt ? fmtDate(g.session.finishedAt) : ''}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: statusColor }}>{statusLabel}</span>
                      {earned && isWon && (
                        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: 'var(--accent,#F5C842)', marginTop: 2 }}>+{earned} ᚙ</div>
                      )}
                      {g.session?.bet && BigInt(g.session.bet) > 0n && (
                        <div style={{ fontSize: 9, color: 'var(--accent,#F5C842)', background: 'rgba(245,200,66,0.1)', padding: '1px 6px', borderRadius: 6, marginTop: 4, fontWeight: 800 }}>BET {fmtBalance(g.session.bet)}</div>
                      )}
                      {g.session?.pgn && <div style={{ fontSize: 9, color: 'var(--accent,#F5C842)', marginTop: 4, opacity: 0.9 }}>▶ Tap to watch</div>}
                    </div>

                    {/* Наш аватар (right) */}
                    <div 
                      onClick={() => myPlayer && myPlayer.id !== viewedUserId && navigate(`/profile/${myPlayer.id}`, { state: { userId: myPlayer.id } })} 
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 48, cursor: 'pointer', zIndex: 2 }}
                    >
                      <Avatar user={myPlayer as unknown as UserPublic} size="m" />
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-primary,#F0F2F8)', marginTop: 4, width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {myPlayer.firstName}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* История транзакций — под играми */}
          <div style={{ ...secStyle, marginTop: 8 }}>💸 {t.profile.txHistory}</div>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted,#4A5270)', padding: 24, fontSize: 13 }}>{t.profile.noTx}</div>
          ) : (
            transactions.map((tx) => {
              const isPos = BigInt(tx.amount) > 0n;
              const TX_ICON: Record<string, string> = {
                BATTLE_WIN: '🏆', BOT_WIN: '🤖', FRIENDLY_WIN: '🤝', TOURNAMENT_WIN: '🥇',
                TASK_REWARD: '🧩', REFERRAL_BONUS: '👥', REFERRAL_INCOME: '💸',
                SUB_REFERRAL_INCOME: '💰', WELCOME_BONUS: '🎁',
                BATTLE_BET: '🎯', BATTLE_COMMISSION: '💼', BATTLE_DONATION: '🎪',
                COUNTRY_WAR_WIN: '🌍', CLAN_CONTRIBUTION: '🏰', TOURNAMENT_ENTRY: '🎟',
                ITEM_PURCHASE: '🛍', ATTEMPT_PURCHASE: '🎮',
                TON_DEPOSIT: '💎', WALLET_UNLOCK: '🔐', WITHDRAWAL: '📤',
                EXCHANGE_SELL: '💱', EXCHANGE_BUY: '🛒',
                EXCHANGE_FREEZE: '🔒', EXCHANGE_UNFREEZE: '🔓',
                EXCHANGE_FEE: '💹', REFUND: '↩️',
              };
              return (
                <div key={tx.id} style={stripStyle}>
                  <span style={{ fontSize: 20 }}>{TX_ICON[tx.type] ?? (isPos ? '📈' : '📉')}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary,#F0F2F8)' }}>
                      {tx.type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary,#8B92A8)', marginTop: 2 }}>{fmtDate(tx.createdAt)}</div>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: isPos ? 'var(--green,#00D68F)' : 'var(--red,#FF4D6A)' }}>
                    {isPos ? '+' : ''}{fmtBalance(tx.amount)} ᚙ
                  </span>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Saves tab */}
      {tab === 'saves' && (
        <>
          <div style={secStyle}>{t.profile.savedGames}</div>
          {savedGames.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 32, fontSize: 13 }}>
              {t.profile.noSaves}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
              {savedGames.map((sg) => {
                const s = sg.session;
                const sides = s?.sides ?? [];
                const p1 = sides[0]?.player;
                const p2 = sides[1]?.player;
                const winner = sides.find((sd) => sd.status === 'WON');
                return (
                  <div key={sg.id} style={{ background: 'var(--bg-card, #13161E)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar user={p1} size="s" />
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{p1?.firstName ?? '?'}</div>
                      </div>
                      <div style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-secondary, #8B92A8)' }}>vs</div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)', textAlign: 'right' }}>{p2?.firstName ?? '?'}</div>
                        <Avatar user={p2} size="s" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s?.pgn ? 8 : 0 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>
                        {s?.type ?? ''} · {s?.finishedAt ? fmtDate(s.finishedAt) : ''}
                      </div>
                      {winner && (
                        <div style={{ fontSize: 11, color: 'var(--green, #00D68F)', fontWeight: 600 }}>
                          🏆 {winner.player?.firstName ?? 'Unknown'}
                        </div>
                      )}
                      <button
                        onClick={() => s && warsApi.unsaveGame(s.id).then(() => setSavedGames(g => g.filter(x => x.id !== sg.id)))}
                        style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px' }}
                      >
                        ✕ remove
                      </button>
                    </div>
                    {s?.pgn && (
                      <button
                        onClick={() => setReplayGame({ pgn: s.pgn!, title: `${p1?.firstName ?? '?'} vs ${p2?.firstName ?? '?'}`, sessionId: s.id })}
                        style={{ width: '100%', padding: '7px 0', background: 'rgba(245,200,66,0.08)', color: 'var(--accent, #F5C842)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        ♟ Replay game
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
          {/* Турнирные бейджи */}
          {(user?.tournamentBadges?.length ?? 0) > 0 && (
            <>
              <div style={secStyle}>🏆 Tournament wins</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
                {(user?.tournamentBadges as TournamentBadge[] | undefined)?.slice().reverse().map((badge, i: number) => {
                  const placeEmoji = badge.place === 1 ? '🥇' : badge.place === 2 ? '🥈' : '🥉';
                  const placeColor = badge.place === 1 ? '#FFD700' : badge.place === 2 ? '#C0C0C0' : '#CD7F32';
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px',
                      background: `linear-gradient(135deg, ${placeColor}10, transparent)`,
                      border: `1px solid ${placeColor}30`,
                      borderRadius: 14,
                    }}>
                      <span style={{ fontSize: 28, flexShrink: 0 }}>{placeEmoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
                          {badge.place} place · {badge.tournamentName ?? badge.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                          {badge.type} · {badge.date ? new Date(badge.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: placeColor }}>
                        +{badge.prize ? (Number(BigInt(badge.prize)) / 1000).toFixed(0) + 'K' : '—'} ᚙ
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Игровые достижения */}
          {(() => {
            const ACHS = [
              { id: 'first_blood',   icon: '⚔️', name: 'First Blood',    desc: 'First game' },
              { id: 'winner_10',     icon: '🏆', name: t.profile.achievementWinner10,  desc: t.profile.achievementWinner10Desc },
              { id: 'winner_100',    icon: '👑', name: t.profile.achievementWinner100, desc: t.profile.achievementWinner100Desc },
              { id: 'jarvis_hunter', icon: '🤖', name: 'J.A.R.V.I.S Hunter', desc: 'Max level' },
              { id: 'recruiter',     icon: '👥', name: t.profile.achievementRecruiter,  desc: t.profile.achievementRecruiterDesc },
              { id: 'millionaire',   icon: '💰', name: t.profile.achievementMillionaire, desc: t.profile.achievementMillionaireDesc },
              { id: 'patriot',       icon: '🌍', name: t.profile.achievementPatriot,    desc: t.profile.achievementPatriotDesc },
              { id: 'puzzler',       icon: '🧩', name: t.profile.achievementPuzzler,    desc: t.profile.achievementPuzzlerDesc },
              { id: 'streak_7',      icon: '🔥', name: t.profile.achievementStreak7,    desc: t.profile.achievementStreak7Desc },
              { id: 'streak_30',     icon: '💎', name: t.profile.achievementStreak30,   desc: t.profile.achievementStreak30Desc },
            ];
            const earned: Record<string, string> = {};
            (user?.achievements ?? []).forEach((a: { id: string; date: string }) => { earned[a.id] = a.date; });
            const earnedCount = Object.keys(earned).length;
            return (
              <>
                <div style={{ ...secStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🎖 {t.profile.tabs.achievements}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', textTransform: 'none', fontWeight: 600 }}>
                    {earnedCount}/{ACHS.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '0 18px' }}>
                  {ACHS.map(a => {
                    const done = !!earned[a.id];
                    return (
                      <div key={a.id} title={a.desc} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '10px 4px', borderRadius: 12, textAlign: 'center',
                        background: done ? 'rgba(245,200,66,0.07)' : 'var(--bg-card, #1C2030)',
                        border: `1px solid ${done ? 'rgba(245,200,66,0.25)' : 'rgba(255,255,255,0.05)'}`,
                        opacity: done ? 1 : 0.45,
                      }}>
                        <span style={{ fontSize: 22 }}>{a.icon}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: done ? 'var(--accent, #F5C842)' : 'var(--text-muted, #4A5270)', lineHeight: 1.2 }}>
                          {a.name}
                        </span>
                        {done && earned[a.id] && (
                          <span style={{ fontSize: 7, color: 'var(--text-muted, #4A5270)' }}>
                            {new Date(earned[a.id]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* JARVIS бейджи */}
          <div style={secStyle}>{t.profile.jarvisCerts}</div>
          {(user?.jarvisBadges?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 32, fontSize: 13 }}>
              {t.profile.noJarvis}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 18px' }}>
              {[...(user?.jarvisBadges ?? [])].reverse().map((badgeName: string, i: number) => {
                const lvlData = JARVIS_LEVELS.find(l => l.name === badgeName);
                const badgeDates = user?.jarvisBadgeDates as Record<string, string> | null;
                const dateStr = badgeDates?.[badgeName];
                const colors: Record<string, string> = {
                  Beginner: 'var(--text-secondary, #8B92A8)', Player: '#00B4D8', Fighter: 'var(--green, #00D68F)',
                  Warrior: '#4CAF50', Expert: '#9B85FF', Master: 'var(--accent, #F5C842)',
                  Professional: '#FF9F43', Epic: '#FF6B6B', Legendary: '#E040FB', Mystic: 'var(--accent, #F5C842)',
                };
                const color = colors[badgeName] ?? '#9B85FF';
                return (
                  <div key={i} onClick={() => setSelectedBadge({ name: badgeName, date: dateStr })} style={{ background: 'linear-gradient(135deg,#1C2030,#13161F)', border: `1px solid ${color}40`, borderRadius: 18, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}18`, border: `2px solid ${color}60`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 22 }}>🤖</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color, marginBottom: 3 }}>{t.gameResult.jarvisCert}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>{badgeName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>{t.profile.level} {lvlData?.level ?? '?'} · +{((lvlData?.reward ?? 0) / 1000).toFixed(0)}K ᚙ</div>
                      {dateStr && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginTop: 4 }}>
                          📅 {new Date(dateStr).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18 }}>✓</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted, #4A5270)', marginTop: 2 }}>{t.profile.passed}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* SettingsModal — открывается по ⚙ в топбаре */}
      {showSettings && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card, #13161F)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px 24px 0 0', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
            <div style={{ width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 15, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>⚙ {t.profile.settings.title}</div>
              <button onClick={() => setShowSettings(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border, rgba(255,255,255,0.07))', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary, #8B92A8)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Язык */}
              <div style={settingCard}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{t.profile.settings.language}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['en', 'ru'] as Lang[]).map((l) => (
                    <button key={l} onClick={() => setLang(l)} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: lang === l ? 'var(--accent, #F5C842)' : 'var(--bg-card, #1C2030)', color: lang === l ? 'var(--bg, #0B0D11)' : 'var(--text-secondary, #8B92A8)', border: lang === l ? 'none' : '1px solid rgba(255,255,255,0.1)', transition: 'all .15s' }}>
                      {l === 'en' ? '🇬🇧 EN' : '🇷🇺 RU'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Звук */}
              <div style={settingCard}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{t.profile.settings.sound}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #4A5270)', marginTop: 3 }}>{soundEnabled ? t.profile.settings.soundOn : t.profile.settings.soundOff}</div>
                </div>
                <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ width: 52, height: 28, borderRadius: 14, background: soundEnabled ? 'var(--accent, #F5C842)' : '#2A2F48', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: soundEnabled ? 26 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
              {/* Вибрация (хаптик) */}
              <div style={settingCard}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>📳 Вибрация</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #4A5270)', marginTop: 3 }}>Haptic feedback при ходах</div>
                </div>
                <button
                  onClick={() => {
                    const cur = localStorage.getItem('chesscoin_haptic') !== 'off';
                    localStorage.setItem('chesscoin_haptic', cur ? 'off' : 'on');
                    window.dispatchEvent(new Event('chesscoin:haptic-change'));
                  }}
                  style={{ width: 52, height: 28, borderRadius: 14, background: localStorage.getItem('chesscoin_haptic') !== 'off' ? 'var(--accent, #F5C842)' : '#2A2F48', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: 3, left: localStorage.getItem('chesscoin_haptic') !== 'off' ? 26 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
            </div>
          </div>
        </div>
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
          sessionId={replayGame.sessionId}
          onClose={() => setReplayGame(null)}
        />
      )}

      {/* (AvatarCropModal logic was removed) */}
    </PageLayout>
    </>
  );
};

const secStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: 'var(--space-l) var(--space-l) var(--space-s)' };
const microLbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 };
const balCard: React.CSSProperties = { margin: 'var(--space-m) var(--space-l) 0', padding: 'var(--space-l)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const ptabsStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid var(--border)', margin: 'var(--space-m) var(--space-l) 0', overflowX: 'auto' as React.CSSProperties['overflowX'] };
const ptab = (active: boolean): React.CSSProperties => ({ flex: '0 0 auto', textAlign: 'center', padding: '10px 14px', fontSize: 13, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', border: 'none', borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, outline: 'none', background: 'none', fontFamily: 'inherit', transition: 'all .2s', whiteSpace: 'nowrap' } as React.CSSProperties);
const stripStyle: React.CSSProperties = { margin: '4px var(--space-l) 0', padding: '14px var(--space-l)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-l)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const tbaStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 'var(--radius-m)', background: 'var(--bg-input)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: 'var(--text-secondary)' };
const secBtn: React.CSSProperties = { padding: '10px 16px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-m)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' };
const ghostBtn: React.CSSProperties = { ...secBtn, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' };
const goldBtn: React.CSSProperties = { padding: '10px 16px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius-m)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(245,200,66,0.2)' };
const tagGold: React.CSSProperties = { display: 'inline-flex', padding: '4px 10px', background: 'rgba(245,200,66,0.1)', color: 'var(--accent)', borderRadius: 'var(--radius-s)', fontSize: 11, fontWeight: 700, border: '1px solid rgba(245,200,66,0.3)' };
const tagVi: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.1)', color: 'var(--accent2)', border: '1px solid rgba(123,97,255,0.3)' };
const tagGr: React.CSSProperties = { ...tagGold, background: 'rgba(0,214,143,0.1)', color: 'var(--green)', border: '1px solid rgba(0,214,143,0.3)' };
const tagRobot: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.1)', color: 'var(--accent2)', border: '1px solid rgba(123,97,255,0.3)' };
const avatarRingStyle: React.CSSProperties = { position: 'absolute', inset: -6, borderRadius: '50%', border: '2px solid var(--accent)', opacity: 0.3, animation: 'ring-pulse 3s ease-in-out infinite' };
const settingCard: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-l)', padding: 'var(--space-l)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
