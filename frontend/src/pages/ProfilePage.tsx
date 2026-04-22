import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { AvatarCropModal } from '@/components/ui/AvatarCropModal';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';
import type { Lang } from '@/i18n/translations';
import { profileApi, authApi, warsApi } from '@/api';
import { fmtBalance, fmtDate, leagueEmoji } from '@/utils/format';
import type { Transaction, UserPublic } from '@/types';
import { JARVIS_LEVELS } from '@/components/ui/JarvisModal';

// Local type for Tab
type Tab = 'info' | 'games' | 'saves' | 'ach';

// Game history item — flat format from GET /profile/games
interface GameHistoryItem {
  sessionId: string;
  type: string;
  result: string;
  isWhite: boolean;
  winningAmount?: string | null;
  bet?: string | null;
  botLevel?: number | null;
  pgn?: string | null;
  duration?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  opponent?: UserPublic | null;
  hasBot?: boolean;
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
  const [replayGame, setReplayGame] = useState<{
    pgn: string;
    title?: string;
    sessionId?: string;
    whitePlayer?: import('@/types').UserPublic | null;
    blackPlayer?: import('@/types').UserPublic | null;
  } | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<{ name: string; date?: string } | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewedProfile, setViewedProfile] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (isOwnProfile || !viewedUserId) return;
    profileApi.getUser(viewedUserId).then((data) => setViewedProfile(data as unknown as Record<string, unknown>)).catch(() => navigate('/'));
  }, [viewedUserId, isOwnProfile]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Открываем AvatarCropModal вместо прямой загрузки
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // После обрезки — загружаем WebP blob
  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    setAvatarLoading(true);
    try {
      const file = new File([blob], 'avatar.webp', { type: 'image/webp' });
      await profileApi.uploadAvatar(file);
      const updated = await authApi.me();
      setUser(updated);
      showToast(t.profile.avatarUpdated);
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : String(err)) || t.profile.uploadError);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!confirm(t.profile.deleteAvatar)) return;
    setAvatarLoading(true);
    try {
      await profileApi.deleteAvatar();
      const updated = await authApi.me();
      setUser(updated);
      showToast(t.profile.avatarDeleted);
    } catch (err: unknown) {
      showToast((err instanceof Error ? err.message : String(err)) || t.common.error);
    } finally {
      setAvatarLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'info') {
      if (isOwnProfile) {
        profileApi.getGames(10).then((r) => setRecentGames((r.games ?? []) as unknown as GameHistoryItem[])).catch(() => {});
      } else if (viewedUserId) {
        profileApi.getUserGames(viewedUserId, 10).then((r) => setRecentGames((r.games ?? []) as unknown as GameHistoryItem[])).catch(() => {});
      }
    }
    if (tab === 'games') {
      if (isOwnProfile) {
        profileApi.getGames().then((r) => setRecentGames((r.games ?? []) as unknown as GameHistoryItem[])).catch(() => {});
        profileApi.getTransactions().then((r) => setTransactions(r.transactions)).catch(() => {});
      } else if (viewedUserId) {
        profileApi.getUserGames(viewedUserId).then((r) => setRecentGames((r.games ?? []) as unknown as GameHistoryItem[])).catch(() => {});
      }
    }
    if (tab === 'saves') {
      warsApi.savedGames().then((r) => setSavedGames(r.savedGames as unknown as SavedGameItem[])).catch(() => {});
    }
  }, [tab, isOwnProfile, viewedUserId]);

  if (!user) return null;
  if (!isOwnProfile && !viewedProfile) return null;

  const displayUser = isOwnProfile ? user : viewedProfile;
  const displayStats = isOwnProfile
    ? { totalGames: user.totalGames ?? 0, wins: user.wins ?? 0, losses: user.losses ?? 0, draws: user.draws ?? 0 }
    : { totalGames: (viewedProfile?.stats as any)?.total ?? 0, wins: (viewedProfile?.stats as any)?.wins ?? 0, losses: (viewedProfile?.stats as any)?.losses ?? 0, draws: (viewedProfile?.stats as any)?.draws ?? 0 };

  const totalGames = displayStats.totalGames;
  const wins = displayStats.wins;
  const losses = displayStats.losses;
  const draws = displayStats.draws;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const lossRate = totalGames > 0 ? Math.round((losses / totalGames) * 100) : 0;
  const drawRate = 100 - winRate - lossRate;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'info',     label: t.profile.tabs.info },
    { id: 'games',    label: t.profile.tabs.games },
    { id: 'saves',    label: t.profile.tabs.saves },
    { id: 'ach',      label: t.profile.tabs.achievements },
  ];

  const rightAction = isOwnProfile ? (
    <button onClick={() => setShowSettings(true)} style={tbaStyle}>⚙</button>
  ) : (
    <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#5A8AB0', letterSpacing: '.08em', padding: '3px 8px', background: 'rgba(74,158,255,.08)', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 6 }}>
      ПРОСМОТР
    </div>
  );

  return (
    <>
    {isOwnProfile && profileInfo.show && <InfoPopup infoKey="profile" slides={[{ icon: '🏅', title: 'Your Profile', desc: 'Your stats, badges and game history. ELO shows your level — the higher, the stronger opponents.' }, { icon: '🎖️', title: 'Military Rank', desc: 'Rank grows with referrals. Higher rank — bigger percentage from friends\' wins.' }, { icon: '💰', title: 'Leagues & Rewards', desc: 'Earn coins to climb leagues: Bronze → Silver → Gold → Diamond → Champion.' }]} onClose={profileInfo.close} />}
    <PageLayout backTo="/" rightAction={rightAction} centered>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-input, #232840)', border: '1px solid #F5C842', borderRadius: 12, padding: '10px 20px', fontSize: 13, color: 'var(--accent, #F5C842)', zIndex: 9999, fontWeight: 600, whiteSpace: 'nowrap' }}>
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

          {/* Аватар — кликабельный на чужом профиле */}
          {isOwnProfile ? (
            <>
              <Avatar user={user} size="xl" gold />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                style={{ position: 'absolute', bottom: -8, right: -8, width: 44, height: 44, borderRadius: '50%', background: 'var(--accent, #F5C842)', border: '2px solid #0B0D11', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                title="Upload avatar"
              >
                {avatarLoading ? '…' : '📷'}
              </button>
              {user.avatarType === 'UPLOAD' && !avatarLoading && (
                <button
                  onClick={handleAvatarDelete}
                  style={{ position: 'absolute', top: -8, right: -8, width: 44, height: 44, borderRadius: '50%', background: 'var(--red, #FF4D6A)', border: '2px solid #0B0D11', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: '#fff', flexShrink: 0 }}
                  title="Delete avatar"
                >
                  ✕
                </button>
              )}
            </>
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
        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {/* 2.1 Флаг страны рядом с именем */}
          {user?.countryMember?.country?.flag && (
            <span style={{ fontSize: 20 }}>{user?.countryMember.country.flag}</span>
          )}
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#EAE2CC' }}>{user.firstName} {user.lastName ?? ''}</span>
        </div>
        <div style={{ marginTop: 3, textAlign: 'center', fontSize: '.72rem', color: '#5A5248' }}>@{user.username ?? 'unknown'}</div>
        {/* 2.3 Кнопка "Сразиться" на чужом профиле */}
        {!isOwnProfile && (
          <button onClick={() => navigate('/battles', { state: { challengeUserId: viewedUserId } })} style={{ marginTop: 10, padding: '10px 20px', background: 'linear-gradient(135deg,#2A1E08,#4A3810)', border: '.5px solid rgba(212,168,67,.42)', borderRadius: 12, color: '#F0C85A', fontSize: '.85rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}>
            ⚔️ {t.profile.challengeBtn ?? 'Challenge'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
          <span style={tagGold}>{leagueEmoji[user.league]} #1</span>
          <span style={{ display: 'inline-flex', padding: '3px 8px', background: 'rgba(74,158,255,.12)', color: '#82CFFF', borderRadius: 6, fontSize: 10, fontWeight: 700, border: '.5px solid rgba(74,158,255,.3)' }}>ELO {user.elo}</span>
          {user?.countryMember?.isCommander && (
            <span style={{ ...tagGr, background: 'linear-gradient(135deg, rgba(245,200,66,0.15), rgba(255,215,0,0.08))', color: '#FFD700', borderColor: 'rgba(255,215,0,0.35)', fontWeight: 800 }}>
              👑 {t.profile.commanderBadge}
            </span>
          )}
          {user?.militaryRank && (
            <span style={{ ...tagGr, background: 'rgba(255,159,67,0.1)', color: '#FF9F43', borderColor: 'rgba(255,159,67,0.2)' }}>
              {user?.militaryRank.emoji} {user?.militaryRank.label}
              {(user?.referralCount ?? 0) > 0 && (
                <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.8 }}>
                  — {(user.referralCount ?? 0).toLocaleString()} {t.profile.fighters ?? '👥'}
                </span>
              )}
            </span>
          )}
          <span style={tagRobot}>🤖 {JARVIS_LEVELS[Math.max(0, (user?.jarvisLevel ?? 1) - 1)].name}</span>
        </div>
      </div>

      {/* Balance — N7 */}
      <div style={{ margin: '12px 18px 0', padding: '14px 16px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase' as const, letterSpacing: '.14em', marginBottom: 4 }}>{t.profile.balance}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '1.4rem', fontWeight: 900, color: '#D4A843' }}>
                {fmtBalance(user.balance)}
              </span>
              <span style={{ fontSize: 13, color: '#D4A843', opacity: .6 }}>ᚙ</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div onClick={() => navigate('/transactions')} style={{ fontSize: '.65rem', color: '#4A9EFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              История <span>›</span>
            </div>
            <button onClick={() => navigate('/referrals')} title={t.profile.txHistory} style={{ width: 36, height: 36, padding: 0, background: 'rgba(74,158,255,.08)', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👜</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => navigate('/shop')} style={{ padding: '8px 10px', background: 'rgba(74,158,255,.08)', color: '#82CFFF', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.profile.shop}</button>
          <button onClick={() => navigate('/referrals')} style={{ padding: '8px 10px', background: 'rgba(74,158,255,.08)', color: '#82CFFF', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.profile.referrals} →</button>
        </div>
      </div>

      {/* Чемпион месяца */}
      {user?.isMonthlyChampion && (
        <div style={{ margin: '8px 18px 0', padding: '12px 14px', background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(74,158,255,0.06))', border: '.5px solid rgba(255,215,0,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24, animation: 'pulse 2s ease-in-out infinite' }}>👑</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#FFD700' }}>
              {t.profile.monthlyChampion ?? 'Monthly Champion'}
            </div>
            <div style={{ fontSize: '.65rem', color: '#7A7875', marginTop: 2 }}>
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
          <div style={{ margin: '0 18px 10px', padding: '12px 16px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 16 }}>
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
          <button key={id} onClick={() => setTab(id)} style={ptab(tab === id)} title={label}>
            {label}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === 'info' && (
        <>
          <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>{t.profile.stats}</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 18px' }}>
            <CircStat value={wins}   pct={winRate}  color="var(--green, #00D68F)" label={t.profile.wins}   />
            <CircStat value={losses} pct={lossRate} color="var(--red, #FF4D6A)" label={t.profile.losses} />
            <CircStat value={draws}  pct={drawRate} color="#9B85FF" label={t.profile.draws}  />
          </div>

          <div style={{ margin: '0 18px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 14, padding: 12 }}>
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
                if (g.result === 'WON') elo = Math.max(100, elo - 16);
                else if (g.result === 'LOST') elo = elo + 16;
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

          <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>{t.profile.refSection}</div>
          <div style={{ margin: '0 18px', padding: '12px 14px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '.75rem', fontWeight: 800, color: '#EAE2CC' }}>{t.profile.refLink}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.62rem', color: '#5A5248', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                t.me/chessgamecoin_bot?start=ref_{user.telegramId}
              </div>
            </div>
            <button onClick={() => {}} style={{ padding: '7px 14px', background: 'rgba(74,158,255,.15)', color: '#82CFFF', border: '.5px solid rgba(74,158,255,.35)', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{t.profile.invite}</button>
          </div>
        </>
      )}

      {/* Games tab — реальные партии + история транзакций */}
      {tab === 'games' && (() => {
        const typeIcon: Record<string, string> = {
          BOT: '🤖', BATTLE: '⚔️', WAR: '🌍', TOURNAMENT: '🏆',
        };
        const typeLabel: Record<string, string> = {
          BOT: 'vs JARVIS', BATTLE: t.profile.typeBattle, WAR: t.profile.typeWar, TOURNAMENT: t.profile.typeTournament,
        };
        return (
          <>
            {/* Последние партии */}
            <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>{t.profile.recentGames}</div>
            {recentGames.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: '24px 0', fontSize: 13 }}>
                {t.profile.noGamesPlayed}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
                {recentGames.slice(0, 15).map((g) => {
                  const myResult = g.result;
                  const oppPlayer = g.opponent;
                  const isWon  = myResult === 'WON';
                  const isDraw = myResult === 'DRAW';
                  const statusColor = isWon ? 'var(--green,#00D68F)' : isDraw ? '#9B85FF' : 'var(--red,#FF4D6A)';
                  const statusLabel = isWon ? t.profile.gameWon : isDraw ? t.profile.gameDraw : t.profile.gameLost;
                  const earned = g.winningAmount ? fmtBalance(String(g.winningAmount)) : null;
                  return (
                    <div key={g.sessionId} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: 'linear-gradient(135deg,#141018,#0F0E18)',
                      border: `.5px solid ${isWon ? 'rgba(0,214,143,0.18)' : isDraw ? 'rgba(74,158,255,0.18)' : 'rgba(255,77,106,0.16)'}`,
                      borderRadius: 14,
                    }}>
                      {/* Цвет результата */}
                      <div style={{ width: 4, height: 40, borderRadius: 2, background: statusColor, flexShrink: 0 }} />

                      {/* Аватар оппонента */}
                      {oppPlayer ? (
                        <Avatar user={oppPlayer} size="s" />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          {typeIcon[g.type ?? ''] ?? '♟'}
                        </div>
                      )}

                      {/* Инфо */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary,#F0F2F8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {oppPlayer ? `${oppPlayer.firstName}${(oppPlayer as any).lastName ? ' ' + (oppPlayer as any).lastName : ''}` : g.hasBot ? `J.A.R.V.I.S Lv.${g.botLevel ?? '?'}` : typeLabel[g.type ?? ''] ?? t.profile.gameLabel}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted,#4A5270)', marginTop: 2 }}>
                          {typeLabel[g.type ?? ''] ?? ''} · {g.finishedAt ? fmtDate(g.finishedAt) : ''}
                          {g.bet && BigInt(g.bet) > 0n ? ` · ${fmtBalance(g.bet)} ᚙ` : ''}
                        </div>
                      </div>

                      {/* Результат + кнопка replay */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: isWon ? '#fff' : isDraw ? '#fff' : '#fff', background: isWon ? 'rgba(0,214,143,.18)' : isDraw ? 'rgba(74,158,255,.18)' : 'rgba(255,77,106,.18)', border: `.5px solid ${isWon ? 'rgba(0,214,143,.35)' : isDraw ? 'rgba(74,158,255,.35)' : 'rgba(255,77,106,.35)'}`, borderRadius: 5, padding: '2px 7px' }}>{statusLabel}</span>
                        {earned && isWon && (
                          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: 'var(--accent,#F5C842)' }}>+{earned} ᚙ</span>
                        )}
                        {g.pgn && (
                          <button
                            onClick={() => setReplayGame({
                              pgn: g.pgn!,
                              title: oppPlayer ? `vs ${oppPlayer.firstName}` : t.profile.gameLabel,
                              sessionId: g.sessionId,
                              // Раскладка по цветам: клик по аватару → профиль игрока
                              whitePlayer: (g as any).isWhite ? (user as any) : oppPlayer,
                              blackPlayer: (g as any).isWhite ? oppPlayer : (user as any),
                            })}
                            style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(245,200,66,0.08)', color: 'var(--accent,#F5C842)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                          >♟ Replay</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* История транзакций — под играми */}
            <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem', marginTop: 8 }}>💸 {t.profile.txHistory}</div>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted,#4A5270)', padding: 24, fontSize: 13 }}>{t.profile.noTx}</div>
            ) : (
              transactions.map((tx) => {
                const isPos = BigInt(tx.amount) > 0n;
                const TX_ICON: Record<string, string> = {
                  // Игровые
                  BATTLE_WIN: '🏆', BOT_WIN: '🤖', FRIENDLY_WIN: '🤝', TOURNAMENT_WIN: '🥇',
                  TASK_REWARD: '🧩', REFERRAL_BONUS: '👥', REFERRAL_INCOME: '💸',
                  SUB_REFERRAL_INCOME: '💰', WELCOME_BONUS: '🎁',
                  BATTLE_BET: '🎯', BATTLE_COMMISSION: '💼', BATTLE_DONATION: '🎪',
                  COUNTRY_WAR_WIN: '🌍', CLAN_CONTRIBUTION: '🏰', TOURNAMENT_ENTRY: '🎟',
                  ITEM_PURCHASE: '🛍', ATTEMPT_PURCHASE: '🎮',
                  // TON
                  TON_DEPOSIT: '💎', WALLET_UNLOCK: '🔐', WITHDRAWAL: '📤',
                  // Биржа
                  EXCHANGE_SELL: '💱', EXCHANGE_BUY: '🛒',
                  EXCHANGE_FREEZE: '🔒', EXCHANGE_UNFREEZE: '🔓',
                  EXCHANGE_FEE: '💹',
                  // Airdrop
                  REFUND: '↩️',
                };
                return (
                  <div key={tx.id} style={{ margin: '4px 18px 0', padding: '10px 14px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{TX_ICON[tx.type] ?? (isPos ? '📈' : '📉')}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#EAE2CC' }}>
                        {
                          tx.type === 'BATTLE_WIN'         ? 'Battle win'         :
                          tx.type === 'BOT_WIN'            ? 'Bot win'            :
                          tx.type === 'TOURNAMENT_WIN'     ? 'Tournament win'     :
                          tx.type === 'COUNTRY_WAR_WIN'    ? 'War win'            :
                          tx.type === 'TASK_REWARD'        ? 'Task reward'        :
                          tx.type === 'REFERRAL_BONUS'     ? 'Referral bonus'     :
                          tx.type === 'REFERRAL_INCOME'    ? 'Referral income'    :
                          tx.type === 'WELCOME_BONUS'      ? 'Welcome bonus'      :
                          tx.type === 'BATTLE_BET'         ? 'Battle bet'         :
                          tx.type === 'TOURNAMENT_ENTRY'   ? 'Tournament entry'   :
                          tx.type === 'ITEM_PURCHASE'      ? 'Shop purchase'      :
                          tx.type === 'TON_DEPOSIT'        ? 'TON deposit'        :
                          tx.type === 'WALLET_UNLOCK'      ? 'Wallet unlock'      :
                          tx.type === 'WITHDRAWAL'         ? 'TON withdrawal'     :
                          tx.type === 'EXCHANGE_SELL'      ? 'Exchange sell'       :
                          tx.type === 'EXCHANGE_BUY'       ? 'Exchange buy'       :
                          tx.type === 'EXCHANGE_FREEZE'    ? 'Order freeze'       :
                          tx.type === 'EXCHANGE_UNFREEZE'  ? 'Order cancel'       :
                          tx.type === 'EXCHANGE_FEE'       ? 'Exchange fee'       :
                          tx.type === 'REFUND'             ? 'Refund'             :
                          tx.type
                        }
                      </div>
                      <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 2 }}>{fmtDate(tx.createdAt)}</div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: isPos ? '#00D68F' : '#FF4D6A' }}>
                      {isPos ? '+' : ''}{fmtBalance(tx.amount)} ᚙ
                    </span>
                  </div>
                );
              })
            )}
          </>
        );
      })()}

      {/* Saves tab */}
      {tab === 'saves' && (
        <>
          <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>{t.profile.savedGames}</div>
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
                  <div key={sg.id} style={{ padding: '12px 14px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar user={p1} size="s" />
                        <span style={{ fontSize: '.8rem', fontWeight: 800, color: '#EAE2CC' }}>{p1?.firstName ?? '?'}</span>
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem', color: '#5A5248' }}>vs</span>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '.8rem', fontWeight: 800, color: '#EAE2CC', textAlign: 'right' }}>{p2?.firstName ?? '?'}</span>
                        <Avatar user={p2} size="s" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s?.pgn ? 8 : 0 }}>
                      <span style={{ fontSize: '.65rem', color: '#5A5248' }}>
                        {s?.type ?? ''} · {s?.finishedAt ? fmtDate(s.finishedAt) : ''}
                      </span>
                      {winner && (
                        <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#00D68F' }}>
                          🏆 {winner.player?.firstName ?? 'Unknown'}
                        </span>
                      )}
                      <button style={{ fontSize: '.62rem', padding: '2px 7px', background: 'rgba(204,96,96,.1)', color: '#CC6060', border: '.5px solid rgba(204,96,96,.25)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                        onClick={() => s && warsApi.unsaveGame(s.id).then(() => setSavedGames(g => g.filter(x => x.id !== sg.id)))}
                      >
                        ✕ remove
                      </button>
                    </div>
                    {s?.pgn && (
                      <button style={{ width: '100%', marginTop: 8, padding: '8px', background: 'rgba(74,158,255,.08)', color: '#82CFFF', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        onClick={() => {
                          // p1/p2 — стороны сохранённой партии; ищем белого/чёрного по isWhite
                          const sides = (s as any).sides as Array<{ isWhite: boolean; player: any }> | undefined;
                          const white = sides?.find(x => x.isWhite)?.player ?? p1;
                          const black = sides?.find(x => !x.isWhite)?.player ?? p2;
                          setReplayGame({
                            pgn: s.pgn!,
                            title: `${p1?.firstName ?? '?'} vs ${p2?.firstName ?? '?'}`,
                            sessionId: s.id,
                            whitePlayer: white,
                            blackPlayer: black,
                          });
                        }}
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
              <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>🏆 Tournament wins</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
                {(user?.tournamentBadges as TournamentBadge[] | undefined)?.slice().reverse().map((badge, i: number) => {
                  const placeEmoji = badge.place === 1 ? '🥇' : badge.place === 2 ? '🥈' : '🥉';
                  const placeColor = badge.place === 1 ? '#FFD700' : badge.place === 2 ? '#C0C0C0' : '#CD7F32';
                  return (
                    <div key={i} style={{
                      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                      background: `linear-gradient(135deg,#141018,#0F0E18)`,
                      border: `.5px solid ${placeColor}40`,
                      borderRadius: 14,
                    }}>
                      <span style={{ fontSize: 28, flexShrink: 0 }}>{placeEmoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#EAE2CC' }}>
                          {badge.place} place · {badge.tournamentName ?? badge.name}
                        </div>
                        <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 2 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875', padding: '.9rem .85rem .45rem' }}>
                  <span>🎖 {t.profile.tabs.achievements}</span>
                  <span style={{ color: '#4A9EFF', fontWeight: 700 }}>
                    {earnedCount}/{ACHS.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '0 18px' }}>
                  {ACHS.map(a => {
                    const done = !!earned[a.id];
                    return (
                      <div key={a.id} title={a.desc} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '10px 4px', borderRadius: 12, textAlign: 'center',
                        background: done ? 'rgba(74,158,255,0.08)' : 'rgba(255,255,255,.03)',
                        border: `.5px solid ${done ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        opacity: done ? 1 : 0.45,
                      }}>
                        <span style={{ fontSize: 22 }}>{a.icon}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: done ? '#82CFFF' : '#5A5248', lineHeight: 1.2 }}>
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
          <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>{t.profile.jarvisCerts}</div>
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
                  <div key={i} onClick={() => setSelectedBadge({ name: badgeName, date: dateStr })} style={{ padding: '12px 10px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: `.5px solid ${color}50`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}18`, border: `2px solid ${color}60`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 22 }}>🤖</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.55rem', letterSpacing: '.1em', textTransform: 'uppercase', color, marginBottom: 3, fontWeight: 700 }}>{t.gameResult.jarvisCert}</div>
                      <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#EAE2CC' }}>{badgeName}</div>
                      <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 2 }}>{t.profile.level} {lvlData?.level ?? '?'} · +{((lvlData?.reward ?? 0) / 1000).toFixed(0)}K ᚙ</div>
                      {dateStr && (
                        <div style={{ fontSize: '.55rem', color: '#5A5248', marginTop: 4 }}>
                          📅 {new Date(dateStr).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, color: color }}>✓</div>
                      <div style={{ fontSize: '.55rem', color: '#5A5248', marginTop: 2 }}>{t.profile.passed}</div>
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
          <div style={{ width: '100%', maxWidth: 480, background: 'linear-gradient(180deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: '24px 24px 0 0', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#EAE2CC' }}>⚙ {t.profile.settings.title}</span>
              <button onClick={() => setShowSettings(false)} style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.09)', color: '#7A7875', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Язык */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', border: '.5px solid rgba(255,255,255,.07)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#EAE2CC' }}>{t.profile.settings.language}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['en', 'ru'] as Lang[]).map((l) => (
                    <button key={l} onClick={() => setLang(l)} style={{ padding: '5px 12px', background: lang === l ? 'rgba(74,158,255,.18)' : 'rgba(255,255,255,.04)', color: lang === l ? '#82CFFF' : '#5A5248', border: lang === l ? '.5px solid rgba(74,158,255,.3)' : '.5px solid rgba(255,255,255,.07)', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {l === 'en' ? '🇬🇧 EN' : '🇷🇺 RU'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Звук */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', border: '.5px solid rgba(255,255,255,.07)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#EAE2CC' }}>{t.profile.settings.sound}</div>
                  <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 3 }}>{soundEnabled ? t.profile.settings.soundOn : t.profile.settings.soundOff}</div>
                </div>
                <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ width: 52, height: 28, borderRadius: 14, background: soundEnabled ? '#4A9EFF' : 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: soundEnabled ? 26 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
              {/* Вибрация (хаптик) */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', border: '.5px solid rgba(255,255,255,.07)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#EAE2CC' }}>📳 Вибрация</div>
                  <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 3 }}>Haptic feedback при ходах</div>
                </div>
                <button
                  onClick={() => {
                    const cur = localStorage.getItem('chesscoin_haptic') !== 'off';
                    localStorage.setItem('chesscoin_haptic', cur ? 'off' : 'on');
                    window.dispatchEvent(new Event('chesscoin:haptic-change'));
                  }}
                  style={{ width: 52, height: 28, borderRadius: 14, background: localStorage.getItem('chesscoin_haptic') !== 'off' ? '#4A9EFF' : 'rgba(255,255,255,.08)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}
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
          whitePlayer={replayGame.whitePlayer}
          blackPlayer={replayGame.blackPlayer}
          onClose={() => setReplayGame(null)}
        />
      )}

      {/* AvatarCropModal — обрезка аватара */}
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}
    </PageLayout>
    </>
  );
};

const secStyle: React.CSSProperties = { fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875', padding: '.9rem .85rem .45rem' };
const microLbl: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted, #4A5270)', marginBottom: 3 };
const balCard: React.CSSProperties = { margin: '12px 18px 0', padding: '14px 18px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const ptabsStyle: React.CSSProperties = { display: 'flex', gap: 6, margin: '12px 18px 0', overflowX: 'auto' as React.CSSProperties['overflowX'], paddingBottom: 2 };
const ptab = (active: boolean): React.CSSProperties => ({ flex: '0 0 auto', textAlign: 'center', padding: '7px 14px', fontSize: 11, fontWeight: 700, color: active ? '#82CFFF' : '#5A5248', cursor: 'pointer', border: active ? '.5px solid rgba(74,158,255,.3)' : '.5px solid rgba(255,255,255,.06)', outline: 'none', background: active ? 'rgba(74,158,255,.12)' : 'rgba(255,255,255,.04)', borderRadius: 8, fontFamily: 'inherit', transition: 'all .2s', whiteSpace: 'nowrap' } as React.CSSProperties);
const stripStyle: React.CSSProperties = { margin: '4px 18px 0', padding: '13px 16px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 };
const tbaStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: '#7A7875' };
const secBtn: React.CSSProperties = { padding: '8px 14px', background: 'var(--bg-input, #232840)', color: 'var(--text-primary, #F0F2F8)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn: React.CSSProperties = { ...secBtn, background: 'transparent', color: 'var(--text-secondary, #8B92A8)' };
const goldBtn: React.CSSProperties = { padding: '8px 14px', background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const tagGold: React.CSSProperties = { display: 'inline-flex', padding: '3px 8px', background: 'rgba(245,200,66,0.12)', color: 'var(--accent, #F5C842)', borderRadius: 6, fontSize: 10, fontWeight: 700 };
const tagVi: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const tagGr: React.CSSProperties = { ...tagGold, background: 'rgba(0,214,143,0.10)', color: 'var(--green, #00D68F)' };
const tagRobot: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const avatarRingStyle: React.CSSProperties = { position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid #F5C842', opacity: .4, animation: 'ring-pulse 3s ease-in-out infinite' };
const settingCard: React.CSSProperties = { background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
