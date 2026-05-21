import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { IcoCrown, IcoRobot, IcoUsers, IcoShop, IcoMedal, IcoArrowUp, IcoArrowDown, IcoBriefcase, IcoMoneyFly, IcoTon, IcoUnlock, IcoLock, IcoGift, IcoExchange, IcoCart, IcoPuzzle, IcoHandshake, IcoGamepad, IcoUpload, IcoGlobe, IcoSettings, IcoBookmark } from '@/components/icons/UiIcons';
import { IcoSwords, IcoTrophy, IcoFlag } from '@/components/icons/TournamentIcons';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';
import type { Lang } from '@/i18n/translations';
import { profileApi, warsApi } from '@/api';
import { fmtBalance, fmtDate, leagueEmoji } from '@/utils/format';
import type { Transaction, UserPublic } from '@/types';
import { JARVIS_LEVELS } from '@/components/ui/JarvisModal';
import { LeagueProgressBar } from '@/components/ui/LeagueProgressBar';
import { getRankLabel } from '@/hooks/useReferralRanks';

// Local type for Tab — 'games' включает сохранённые партии (слиты в 2026-05-16)
type Tab = 'info' | 'games' | 'ach';

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
  const { user } = useUserStore();
  const { lang, setLang, soundEnabled, setSoundEnabled } = useSettingsStore();
  const t = useT();
  const location = useLocation();
  const params = useParams<{ userId?: string }>();
  // Поддерживаем оба способа: /profile/:userId и navigate('/profile', {state:{userId}})
  // PR-3 hotfix 2026-05-18: phantom-id '/profile/undefined' (строка) — это путь
  // куда улетал клик если родитель не успел подтянуть m.userId. Фильтруем.
  const rawViewedId: string | undefined = params.userId ?? (location.state as Record<string,unknown>)?.userId as string | undefined;
  const viewedUserId: string | undefined = (rawViewedId && rawViewedId !== 'undefined' && rawViewedId !== 'null') ? rawViewedId : undefined;
  const isOwnProfile = !viewedUserId || viewedUserId === user?.id;
  const profileInfo = useInfoPopup('profile', [{ icon: '', title: 'Your Profile', desc: 'Your stats, badges and game history. ELO shows your level — the higher, the stronger opponents.' }, { icon: '', title: 'Military Rank', desc: 'Rank grows with referrals. Higher rank — bigger percentage from friends\' wins.' }, { icon: '', title: 'Leagues & Rewards', desc: 'Earn coins to climb leagues: Bronze → Silver → Gold → Diamond → Champion.' }]);

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
  const [toast, setToast] = useState<string | null>(null);
  const [viewedProfile, setViewedProfile] = useState<import('@/types').User | null>(null);
  const [viewedProfileError, setViewedProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (isOwnProfile || !viewedUserId) return;
    setViewedProfileError(null);
    setViewedProfile(null);
    profileApi.getUser(viewedUserId)
      .then((data) => setViewedProfile(data as unknown as import('@/types').User))
      .catch((e) => {
        // PR-3 hotfix 2026-05-18: НЕ делаем navigate('/') — это валило
        // юзера на главную, что выглядело как «клик открыл свой профиль»
        // (HomePage с собственным аватаром визуально похожа на профиль).
        // Показываем явную ошибку с кнопкой «назад».
        const msg = (e instanceof Error ? e.message : String(e)) || 'Профиль недоступен';
        setViewedProfileError(msg);
      });
  }, [viewedUserId, isOwnProfile]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 2026-05-17: upload/crop удалены — только Telegram-импорт или магазин.

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
        // Сохранённые — только на собственном профиле
        warsApi.savedGames().then((r) => setSavedGames(r.savedGames as unknown as SavedGameItem[])).catch(() => {});
      } else if (viewedUserId) {
        profileApi.getUserGames(viewedUserId).then((r) => setRecentGames((r.games ?? []) as unknown as GameHistoryItem[])).catch(() => {});
      }
    }
  }, [tab, isOwnProfile, viewedUserId]);

  // Фильтры для вкладки «Игры» (имя героя / тип / дата)
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BOT' | 'BATTLE' | 'WAR' | 'TOURNAMENT'>('ALL');
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  if (!user) return null;
  // PR-3 hotfix 2026-05-18: вместо тихого return null → если есть ошибка
  // загрузки чужого профиля — показываем явную страницу с кнопкой «Назад».
  // Раньше при сетевой ошибке делался navigate('/'), что выглядело
  // как «клик открыл свой профиль» (HomePage похожа на профиль визуально).
  if (!isOwnProfile && !viewedProfile) {
    if (viewedProfileError) {
      return (
        <PageLayout title="Профиль" backTo="/" centered>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: '.95rem', color: '#FF8080', fontWeight: 700, marginBottom: 12 }}>
              Профиль недоступен
            </div>
            <div style={{ fontSize: '.78rem', color: '#7A7875', marginBottom: 24 }}>
              {viewedProfileError}
            </div>
            <button onClick={() => navigate(-1)} style={{
              padding: '10px 20px', borderRadius: 12,
              background: 'rgba(74,158,255,.08)', border: '.5px solid rgba(74,158,255,.3)',
              color: '#82CFFF', fontSize: '.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>← Назад</button>
          </div>
        </PageLayout>
      );
    }
    return null; // ещё загружается
  }

  // ЕДИНЫЙ источник user-specific данных:
  //  own profile  → store (`user`),
  //  foreign      → данные с `/profile/:userId` (`viewedProfile`).
  // ВСЁ что касается отображаемого юзера — читать ТОЛЬКО через `profile`.
  // Никаких `user.X` для имени/баланса/лиги/ELO/звания/флага/бейджей.
  const profile = (isOwnProfile ? user : viewedProfile) as import('@/types').User;
  // displayUser оставлен для обратной совместимости — = profile.
  const displayUser = profile;

  const totalGames = profile.totalGames ?? ((profile as any)?.stats?.total ?? 0);
  const wins   = profile.wins   ?? ((profile as any)?.stats?.wins   ?? 0);
  const losses = profile.losses ?? ((profile as any)?.stats?.losses ?? 0);
  const draws  = profile.draws  ?? ((profile as any)?.stats?.draws  ?? 0);
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const lossRate = totalGames > 0 ? Math.round((losses / totalGames) * 100) : 0;
  const drawRate = 100 - winRate - lossRate;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'info',     label: t.profile.tabs.info },
    { id: 'games',    label: t.profile.tabs.games },
    { id: 'ach',      label: t.profile.tabs.achievements },
  ];

  const rightAction = isOwnProfile ? (
    <button onClick={() => setShowSettings(true)} style={tbaStyle}><IcoSettings size={16} /></button>
  ) : (
    <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#5A8AB0', letterSpacing: '.08em', padding: '3px 8px', background: 'rgba(74,158,255,.08)', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 6 }}>
      ПРОСМОТР
    </div>
  );

  return (
    <>
    {isOwnProfile && profileInfo.show && <InfoPopup infoKey="profile" slides={[{ icon: '', title: 'Your Profile', desc: 'Your stats, badges and game history. ELO shows your level — the higher, the stronger opponents.' }, { icon: '', title: 'Military Rank', desc: 'Rank grows with referrals. Higher rank — bigger percentage from friends\' wins.' }, { icon: '', title: 'Leagues & Rewards', desc: 'Earn coins to climb leagues: Bronze → Silver → Gold → Diamond → Champion.' }]} onClose={profileInfo.close} />}
    <PageLayout backTo="/" rightAction={rightAction} centered>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,.05)', border: '1px solid #F0C85A', borderRadius: 12, padding: '10px 20px', fontSize: 13, color: '#F0C85A', zIndex: 9999, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 18px 0' }}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={avatarRingStyle} />
          {/* Флаг страны переехал из бейджа на аватаре в строку с именем
             (Кенан 2026-05-17: «флаг везде после имени»). */}

          {/* Аватар — без upload/crop (Кенан 2026-05-17: только Telegram-импорт или магазин). */}
          {isOwnProfile ? (
            (() => {
              const premiumAvatar = profile?.equippedItems?.PREMIUM_AVATAR;
              const frame = profile?.equippedItems?.AVATAR_FRAME;
              const clickable = !!(premiumAvatar || frame);
              const handle = clickable ? () => {
                if (premiumAvatar) navigate('/shop', { state: { tab: 'avatars', highlightItemId: premiumAvatar.id } });
                else if (frame) navigate('/shop', { state: { tab: 'frames', highlightItemId: frame.id } });
              } : undefined;
              return (
                <div style={{ position: 'relative', cursor: clickable ? 'pointer' : 'default' }} onClick={handle}>
                  <Avatar user={profile} size="xl" gold />
                  {clickable && (
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'rgba(123,97,255,0.9)', border: '1.5px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t.profile.buyInShop}>
                      <IcoShop size={11} />
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            /* Чужой профиль: аватар показывает ВЫБРАННОГО юзера (не себя)
               и кликабелен ТОЛЬКО при наличии premium-предметов
               (Кенан 2026-05-18: «если стоит аватар по умолчанию импорт с
               телеграм — то просто не кликабелен»). */
            (() => {
              const premiumAvatar = profile?.equippedItems?.PREMIUM_AVATAR;
              const frame = profile?.equippedItems?.AVATAR_FRAME;
              const clickable = !!(premiumAvatar || frame);
              const handle = clickable ? () => {
                if (premiumAvatar) navigate('/shop', { state: { tab: 'avatars', highlightItemId: premiumAvatar.id } });
                else if (frame) navigate('/shop', { state: { tab: 'frames', highlightItemId: frame.id } });
              } : undefined;
              return (
                <div style={{ position: 'relative', cursor: clickable ? 'pointer' : 'default' }} onClick={handle}>
                  <Avatar user={profile as UserPublic} size="xl" gold />
                  {clickable && (
                    <div style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(123,97,255,0.9)',
                      border: '1.5px solid rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} title={t.profile.buyInShop}>
                      <IcoShop size={11} />
                    </div>
                  )}
                  {clickable && (
                    <div style={{
                      position: 'absolute', top: '105%', left: '50%', transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.8)', borderRadius: 6, padding: '2px 8px',
                      fontSize: 9, color: '#F0C85A', whiteSpace: 'nowrap',
                      border: '1px solid rgba(245,200,66,0.3)',
                    }}>
                      {premiumAvatar?.name ?? frame?.name}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#EAE2CC' }}>{(displayUser as any)?.firstName ?? ''} {(displayUser as any)?.lastName ?? ''}</span>
          {(displayUser as any)?.countryMember?.country?.code && (
            <CountryFlag code={(displayUser as any).countryMember.country.code} size={22} />
          )}
        </div>
        <div style={{ marginTop: 3, textAlign: 'center', fontSize: '.72rem', color: '#5A5248' }}>@{(displayUser as any)?.username ?? 'unknown'}</div>
        {/* 2.3 Кнопка "Сразиться" на чужом профиле */}
        {!isOwnProfile && (
          <button onClick={() => navigate('/battles', { state: { challengeUserId: viewedUserId } })} style={{ marginTop: 10, padding: '10px 20px', background: 'linear-gradient(135deg,#2A1E08,#4A3810)', border: '.5px solid rgba(212,168,67,.42)', borderRadius: 12, color: '#F0C85A', fontSize: '.85rem', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IcoSwords size={16} /> {t.profile.challengeBtn ?? 'Challenge'}
          </button>
        )}
        {/* Достижения — 2 строки.
            PR-3 hotfix Кенан 2026-05-18: все теги читают из displayUser (= user
            на своём профиле, = viewedProfile на чужом). Раньше теги читались
            из `user` (свой) — на чужом профиле показывалась чужая аватарка,
            но СВОИ лига/ELO/звание. Теперь данные корректные. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={tagGold}>{leagueEmoji[(displayUser as any)?.league ?? 'BRONZE']} #1</span>
            <span style={{ display: 'inline-flex', padding: '3px 8px', background: 'rgba(74,158,255,.12)', color: '#82CFFF', borderRadius: 6, fontSize: 10, fontWeight: 700, border: '.5px solid rgba(74,158,255,.3)' }}>ELO {(displayUser as any)?.elo ?? '—'}</span>
            {((displayUser as any)?.countryMember?.isCommander || (displayUser as any)?.isCommander) && (
              <span style={{ ...tagGr, background: 'linear-gradient(135deg, rgba(245,200,66,0.15), rgba(255,215,0,0.08))', color: '#FFD700', borderColor: 'rgba(255,215,0,0.35)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IcoCrown size={11} /> {t.profile.commanderBadge}
              </span>
            )}
            {/* Динамические титулы — Чемпион недели/месяца/года из currentTitles. */}
            {((displayUser as any)?.currentTitles ?? []).map((tt: { type: string; label: string; date: string }) => (
              <span key={tt.type} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: 'linear-gradient(135deg, rgba(245,200,66,0.20), rgba(255,215,0,0.10))',
                color: '#FFD700', borderColor: 'rgba(255,215,0,0.45)',
                border: '.5px solid rgba(255,215,0,0.45)',
                fontSize: 10, fontWeight: 800, letterSpacing: '.02em',
              }}>
                <IcoTrophy size={11} /> {tt.label}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(displayUser as any)?.militaryRank && (
              <span style={{ ...tagGr, background: 'rgba(255,159,67,0.1)', color: '#FF9F43', borderColor: 'rgba(255,159,67,0.2)' }}>
                {t.profile.teamFormat?.(
                  getRankLabel(t, (displayUser as any).militaryRank.rank),
                  (displayUser as any).referralCount ?? 0
                ) ?? `${getRankLabel(t, (displayUser as any).militaryRank.rank)} — Team: ${(displayUser as any).referralCount ?? 0} person`}
              </span>
            )}
            <span style={{ ...tagRobot, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IcoRobot size={11} /> {t.jarvis.levels[Math.max(0, ((displayUser as any)?.jarvisLevel ?? 1) - 1)]?.name ?? `Lv ${(displayUser as any)?.jarvisLevel ?? 1}`}</span>
          </div>
        </div>
      </div>

      {/* League progress bar — над балансом. Баланс — публичный (рейтинг
         по балансу уже виден в Leaderboard), показываем прогресс везде. */}
      <div style={{ marginTop: 12 }}>
        <LeagueProgressBar league={profile.league} balance={profile.balance} />
      </div>

      {/* Balance — карточка видна везде; на чужом профиле — только сумма,
         без личных кнопок «История транзакций / Магазин / Рефералы». */}
      <div style={{ margin: '12px 18px 0', padding: '14px 16px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase' as const, letterSpacing: '.14em', marginBottom: 4 }}>{t.profile.balance}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: "'Unbounded',sans-serif", fontSize: '1.4rem', fontWeight: 900, color: '#D4A843' }}>
                {fmtBalance(profile.balance)}
              </span>
              <span style={{ fontSize: 13, color: '#D4A843', opacity: .6 }}></span>
            </div>
          </div>
          {/* История транзакций — финансовая приватность: только на своём */}
          {isOwnProfile && (
            <div
              onClick={() => navigate('/transactions')}
              style={{ fontSize: 12, fontWeight: 700, color: '#82CFFF', cursor: 'pointer', padding: '6px 10px', background: 'rgba(74,158,255,.08)', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, whiteSpace: 'nowrap' }}
            >
              {t.profile.txHistory ?? 'История'} ›
            </div>
          )}
        </div>
        {/* Магазин / Рефералы — личные действия, только на своём */}
        {isOwnProfile && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => navigate('/shop')} style={{ padding: '8px 10px', background: 'rgba(74,158,255,.08)', color: '#82CFFF', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.profile.shop}</button>
            <button onClick={() => navigate('/referrals')} style={{ padding: '8px 10px', background: 'rgba(74,158,255,.08)', color: '#82CFFF', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{t.profile.referrals}</button>
          </div>
        )}
      </div>

      {/* Чемпион месяца */}
      {profile?.isMonthlyChampion && (
        <div style={{ margin: '8px 18px 0', padding: '12px 14px', background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(74,158,255,0.06))', border: '.5px solid rgba(255,215,0,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#FFD700', animation: 'pulse 2s ease-in-out infinite', display: 'inline-flex' }}><IcoCrown size={24} color="#FFD700" /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#FFD700' }}>
              {t.profile.monthlyChampion ?? 'Monthly Champion'}
            </div>
            <div style={{ fontSize: '.65rem', color: '#7A7875', marginTop: 2 }}>
              ELO rating {profile?.monthlyChampionAt ? `· ${new Date(profile.monthlyChampionAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}` : ''}
            </div>
          </div>
        </div>
      )}

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
            <CircStat value={wins}   pct={winRate}  color="#3DBA7A" label={t.profile.wins}   />
            <CircStat value={losses} pct={lossRate} color="#FF5B5B" label={t.profile.losses} />
            <CircStat value={draws}  pct={drawRate} color="#9B85FF" label={t.profile.draws}  />
          </div>

          <div style={{ margin: '0 18px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={microLbl}>{t.profile.eloChart}</div>
              <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: '#9B85FF', fontWeight: 700 }}>
                {profile.elo} ELO
              </div>
            </div>
            {(() => {
              // Строим ELO-динамику из последних партий (обратный порядок → хронологический)
              const eloHistory: number[] = [];
              let elo = profile.elo;
              const games = [...recentGames].reverse().slice(-10);
              // Аппроксимируем: +16 победа, -16 поражение, 0 ничья (K=32/2)
              for (const g of games) {
                eloHistory.push(elo);
                if (g.result === 'WON') elo = Math.max(100, elo - 16);
                else if (g.result === 'LOST') elo = elo + 16;
              }
              eloHistory.push(profile.elo); // текущее
              if (eloHistory.length < 2) {
                return (
                  <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, color: '#5A5248' }}>{t.profile.playGamesForChart}</span>
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
              const trendColor = curElo > prevElo ? '#3DBA7A' : curElo < prevElo ? '#FF5B5B' : '#9B85FF';
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
                    <circle cx={toX(eloHistory.length - 1)} cy={toY(profile.elo)} r="3.5" fill="#9B85FF" />
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: '#5A5248' }}>{t.profile.points(games.length + 1)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: trendColor }}>{trend} {Math.abs(curElo - prevElo)} ELO</span>
                  </div>
                </>
              );
            })()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '8px 18px 0' }}>
            <StatCard val={totalGames}            lbl={t.profile.games}  />
            <StatCard val={profile.elo}           lbl={t.profile.elo}    color="#9B85FF" />
            <StatCard val={profile.winStreak ?? 0} lbl={t.profile.streak} color="#F0C85A" />
          </div>

          {/* Реферальная ссылка с telegramId — приватно, только на своём профиле. */}
          {isOwnProfile && (
            <>
              <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>{t.profile.refSection}</div>
              <div style={{ margin: '0 18px', padding: '12px 14px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 800, color: '#EAE2CC' }}>{t.profile.refLink}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.62rem', color: '#5A5248', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    t.me/chessgamecoin_bot?start=ref_{profile.telegramId}
                  </div>
                </div>
                <button onClick={() => {}} style={{ padding: '7px 14px', background: 'rgba(74,158,255,.15)', color: '#82CFFF', border: '.5px solid rgba(74,158,255,.35)', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{t.profile.invite}</button>
              </div>
            </>
          )}
        </>
      )}

      {/* Games tab — реальные партии + История транзакций */}
      {tab === 'games' && (() => {
        const typeIconNode = (type: string) => {
          switch (type) {
            case 'BOT': return <IcoRobot size={16} />;
            case 'BATTLE': return <IcoSwords size={16} />;
            case 'WAR': return <IcoGlobe size={16} />;
            case 'TOURNAMENT': return <IcoTrophy size={16} />;
            default: return null;
          }
        };
        const typeLabel: Record<string, string> = {
          BOT: 'vs JARVIS', BATTLE: t.profile.typeBattle, WAR: t.profile.typeWar, TOURNAMENT: t.profile.typeTournament,
        };
        // Применяем фильтры
        const nameQuery = filterName.trim().toLowerCase();
        const now = Date.now();
        const dateCut: Record<typeof filterDate, number> = {
          ALL: 0,
          TODAY: now - 24 * 60 * 60 * 1000,
          WEEK: now - 7 * 24 * 60 * 60 * 1000,
          MONTH: now - 30 * 24 * 60 * 60 * 1000,
        };
        const cutMs = dateCut[filterDate];
        const matches = (type: string | undefined, oppName: string | undefined, dateStr: string | null | undefined) => {
          if (filterType !== 'ALL' && type !== filterType) return false;
          if (nameQuery && !(oppName ?? '').toLowerCase().includes(nameQuery)) return false;
          if (cutMs > 0) {
            const t = dateStr ? Date.parse(dateStr) : 0;
            if (!t || t < cutMs) return false;
          }
          return true;
        };

        const filteredGames = recentGames
          .filter((g) => matches(g.type, g.opponent ? `${g.opponent.firstName} ${(g.opponent as any).lastName ?? ''}` : (g.hasBot ? `JARVIS Lv.${g.botLevel ?? '?'}` : ''), g.finishedAt))
          .sort((a, b) => (Date.parse(b.finishedAt ?? '') || 0) - (Date.parse(a.finishedAt ?? '') || 0));

        const filteredSaves = savedGames.filter((sg) => {
          const s = sg.session;
          const sides = s?.sides ?? [];
          const names = sides.map((sd) => sd.player?.firstName ?? '').join(' ');
          return matches(s?.type, names, s?.finishedAt);
        });

        return (
          <>
            {/* Фильтры */}
            <div style={{ display: 'flex', gap: 6, padding: '12px 14px 4px', flexWrap: 'wrap' }}>
              <input
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Имя героя…"
                style={{ flex: '1 1 140px', minWidth: 0, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, color: '#EAE2CC', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                style={{ padding: '8px 8px', background: 'rgba(255,255,255,0.04)', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, color: '#EAE2CC', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              >
                <option value="ALL">Все типы</option>
                <option value="BOT">vs JARVIS</option>
                <option value="BATTLE">Баттл</option>
                <option value="WAR">Война</option>
                <option value="TOURNAMENT">Турнир</option>
              </select>
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value as any)}
                style={{ padding: '8px 8px', background: 'rgba(255,255,255,0.04)', border: '.5px solid rgba(74,158,255,.2)', borderRadius: 10, color: '#EAE2CC', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              >
                <option value="ALL">Все даты</option>
                <option value="TODAY">Сегодня</option>
                <option value="WEEK">Неделя</option>
                <option value="MONTH">Месяц</option>
              </select>
            </div>

            {/* Сохранённые партии — сверху, только на своём профиле */}
            {isOwnProfile && filteredSaves.length > 0 && (
              <>
                <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#F0C85A', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IcoBookmark size={11} /> {t.profile.savedGames}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px' }}>
                  {filteredSaves.map((sg) => {
                    const s = sg.session;
                    const sides = s?.sides ?? [];
                    const p1 = sides[0]?.player;
                    const p2 = sides[1]?.player;
                    const winner = sides.find((sd) => sd.status === 'WON');
                    return (
                      <div key={sg.id} style={{ padding: '10px 12px', background: 'linear-gradient(135deg,#1A1410,#0F0E18)', border: '.5px solid rgba(240,200,90,.25)', borderRadius: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar user={p1} size="s" />
                            <span style={{ fontSize: '.78rem', fontWeight: 800, color: '#EAE2CC' }}>{p1?.firstName ?? '?'}</span>
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.65rem', color: '#5A5248' }}>vs</span>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '.78rem', fontWeight: 800, color: '#EAE2CC', textAlign: 'right' }}>{p2?.firstName ?? '?'}</span>
                            <Avatar user={p2} size="s" />
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '.62rem', color: '#5A5248' }}>
                            {s?.type ?? ''} · {s?.finishedAt ? fmtDate(s.finishedAt) : ''}
                          </span>
                          {winner && (
                            <span style={{ fontSize: '.62rem', fontWeight: 700, color: '#3DBA7A', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <IcoTrophy size={11} /> {winner.player?.firstName ?? '?'}
                            </span>
                          )}
                          <div style={{ display: 'flex', gap: 4 }}>
                            {s?.pgn && (
                              <button
                                onClick={() => {
                                  const ss = (s as any).sides as Array<{ isWhite: boolean; player: any }> | undefined;
                                  const white = ss?.find(x => x.isWhite)?.player ?? p1;
                                  const black = ss?.find(x => !x.isWhite)?.player ?? p2;
                                  setReplayGame({
                                    pgn: s.pgn!,
                                    title: `${p1?.firstName ?? '?'} vs ${p2?.firstName ?? '?'}`,
                                    sessionId: s.id,
                                    whitePlayer: white,
                                    blackPlayer: black,
                                  });
                                }}
                                style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(245,200,66,0.1)', color: '#F0C85A', border: '.5px solid rgba(245,200,66,.3)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                              >▷</button>
                            )}
                            <button
                              onClick={() => s && warsApi.unsaveGame(s.id).then(() => setSavedGames(g => g.filter(x => x.id !== sg.id)))}
                              style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(204,96,96,.1)', color: '#CC6060', border: '.5px solid rgba(204,96,96,.3)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                            >×</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Последние партии */}
            <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>{t.profile.recentGames}</div>
            {filteredGames.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#5A5248', padding: '24px 0', fontSize: 13 }}>
                {t.profile.noGamesPlayed}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
                {filteredGames.slice(0, 50).map((g) => {
                  const myResult = g.result;
                  const oppPlayer = g.opponent;
                  const isWon  = myResult === 'WON';
                  const isDraw = myResult === 'DRAW';
                  const statusColor = isWon ? '#3DBA7A' : isDraw ? '#9B85FF' : '#FF5B5B';
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
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9490' }}>
                          {typeIconNode(g.type ?? '') ?? <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>·</span>}
                        </div>
                      )}

                      {/* нфо */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {oppPlayer ? `${oppPlayer.firstName}${(oppPlayer as any).lastName ? ' ' + (oppPlayer as any).lastName : ''}` : g.hasBot ? `J.A.R.V.I.S Lv.${g.botLevel ?? '?'}` : typeLabel[g.type ?? ''] ?? t.profile.gameLabel}
                        </div>
                        <div style={{ fontSize: 10, color: '#5A5248', marginTop: 2 }}>
                          {typeLabel[g.type ?? ''] ?? ''} · {g.finishedAt ? fmtDate(g.finishedAt) : ''}
                          {g.bet && BigInt(g.bet) > 0n ? ` · ${fmtBalance(g.bet)}` : ''}
                        </div>
                      </div>

                      {/* Результат + кнопка replay */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: isWon ? '#fff' : isDraw ? '#fff' : '#fff', background: isWon ? 'rgba(0,214,143,.18)' : isDraw ? 'rgba(74,158,255,.18)' : 'rgba(255,77,106,.18)', border: `.5px solid ${isWon ? 'rgba(0,214,143,.35)' : isDraw ? 'rgba(74,158,255,.35)' : 'rgba(255,77,106,.35)'}`, borderRadius: 5, padding: '2px 7px' }}>{statusLabel}</span>
                        {earned && isWon && (
                          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: '#F0C85A' }}>+{earned}</span>
                        )}
                        {g.pgn && (
                          <button
                            onClick={() => setReplayGame({
                              pgn: g.pgn!,
                              title: oppPlayer ? `vs ${oppPlayer.firstName}` : t.profile.gameLabel,
                              sessionId: g.sessionId,
                              // Раскладка по цветам: клик по аватару → профиль игрока.
                              // `profile` — это юзер, чьи партии мы листаем (own или foreign).
                              whitePlayer: (g as any).isWhite ? (profile as any) : oppPlayer,
                              blackPlayer: (g as any).isWhite ? oppPlayer : (profile as any),
                            })}
                            style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(245,200,66,0.08)', color: '#F0C85A', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                          >▷ Replay</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* История транзакций — финансовая приватность: ТОЛЬКО на своём профиле */}
            {isOwnProfile && (
            <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><IcoMoneyFly size={11} /> {t.profile.txHistory}</div>
            )}
            {isOwnProfile && (transactions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#5A5248', padding: 24, fontSize: 13 }}>{t.profile.noTx}</div>
            ) : (
              transactions.map((tx) => {
                // PR-3 hotfix: guard BigInt(undefined) crash (tx.amount может быть
                // строкой с '+'/'-' или вовсе пустой для legacy-транзакций).
                let isPos = false;
                try { isPos = BigInt(String(tx.amount ?? '0').replace(/[+\-]/g, '')) > 0n && !String(tx.amount ?? '').startsWith('-'); } catch {}
                const txIcon = (() => {
                  const s = 18;
                  switch (tx.type) {
                    case 'BATTLE_WIN':         return <IcoTrophy size={s} />;
                    case 'BOT_WIN':            return <IcoRobot size={s} />;
                    case 'FRIENDLY_WIN':       return <IcoHandshake size={s} />;
                    case 'TOURNAMENT_WIN':     return <IcoMedal size={s} />;
                    case 'TASK_REWARD':        return <IcoPuzzle size={s} />;
                    case 'REFERRAL_BONUS':
                    case 'SUB_REFERRAL_INCOME':
                    case 'REFERRAL_INCOME':    return <IcoUsers size={s} />;
                    case 'WELCOME_BONUS':      return <IcoGift size={s} />;
                    case 'BATTLE_BET':         return <IcoSwords size={s} />;
                    case 'BATTLE_COMMISSION':  return <IcoBriefcase size={s} />;
                    case 'BATTLE_DONATION':    return <CoinIcon size={s} />;
                    case 'COUNTRY_WAR_WIN':    return <IcoGlobe size={s} />;
                    case 'CLAN_CONTRIBUTION':  return <CoinIcon size={s} />;
                    case 'TOURNAMENT_ENTRY':   return <IcoTrophy size={s} />;
                    case 'ITEM_PURCHASE':      return <IcoShop size={s} />;
                    case 'ATTEMPT_PURCHASE':   return <IcoGamepad size={s} />;
                    case 'TON_DEPOSIT':        return <IcoTon size={s} />;
                    case 'WALLET_UNLOCK':      return <IcoUnlock size={s} />;
                    case 'WITHDRAWAL':         return <IcoUpload size={s} />;
                    case 'EXCHANGE_SELL':      return <IcoExchange size={s} />;
                    case 'EXCHANGE_BUY':       return <IcoCart size={s} />;
                    case 'EXCHANGE_FREEZE':    return <IcoLock size={s} />;
                    case 'EXCHANGE_UNFREEZE':  return <IcoUnlock size={s} />;
                    case 'EXCHANGE_FEE':       return <IcoBriefcase size={s} />;
                    case 'REFUND':             return <IcoMoneyFly size={s} />;
                    default:                   return isPos ? <IcoArrowUp size={s} /> : <IcoArrowDown size={s} />;
                  }
                })();
                return (
                  <div key={tx.id} style={{ margin: '4px 18px 0', padding: '10px 14px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: isPos ? '#3DBA7A' : '#FF8080', display: 'inline-flex', flexShrink: 0 }}>{txIcon}</span>
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
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: isPos ? '#3DBA7A' : '#FF5B5B' }}>
                      {isPos ? '+' : ''}{fmtBalance(tx.amount)}
                    </span>
                  </div>
                );
              })
            ))}
          </>
        );
      })()}

      {/* Saves tab — слита с games (2026-05-16) */}
      {false && (
        <>
          <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem' }}>{t.profile.savedGames}</div>
          {savedGames.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#5A5248', padding: 32, fontSize: 13 }}>
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
                        <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#3DBA7A', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IcoTrophy size={11} /> {winner.player?.firstName ?? 'Unknown'}
                        </span>
                      )}
                      <button style={{ fontSize: '.62rem', padding: '2px 7px', background: 'rgba(204,96,96,.1)', color: '#CC6060', border: '.5px solid rgba(204,96,96,.25)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                        onClick={() => s && warsApi.unsaveGame(s.id).then(() => setSavedGames(g => g.filter(x => x.id !== sg.id)))}
                      >
                        × remove
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
                        ▷ Replay game
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
          {(profile?.tournamentBadges?.length ?? 0) > 0 && (
            <>
              <div style={{ fontSize: '.58rem', fontWeight: 700, color: '#7A7875', textTransform: 'uppercase', letterSpacing: '.14em', padding: '.9rem .85rem .45rem', display: 'flex', alignItems: 'center', gap: 6 }}><IcoTrophy size={11} /> Tournament wins</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px' }}>
                {(profile?.tournamentBadges as TournamentBadge[] | undefined)?.slice().reverse().map((badge, i: number) => {
                  const placeLabel = badge.place === 1 ? '1' : badge.place === 2 ? '2' : '3';
                  const placeColor = badge.place === 1 ? '#FFD700' : badge.place === 2 ? '#C0C0C0' : '#CD7F32';
                  return (
                    <div key={i} style={{
                      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                      background: `linear-gradient(135deg,#141018,#0F0E18)`,
                      border: `.5px solid ${placeColor}40`,
                      borderRadius: 14,
                    }}>
                      <span style={{ flexShrink: 0, display: 'inline-flex', width: 32, height: 32, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', background: badge.place === 1 ? 'rgba(245,200,66,.18)' : badge.place === 2 ? 'rgba(200,200,200,.18)' : 'rgba(205,127,50,.18)', color: badge.place === 1 ? '#F0C85A' : badge.place === 2 ? '#D0D0D0' : '#CD7F32', fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, fontSize: 14 }}>{placeLabel}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#EAE2CC' }}>
                          {badge.place} place · {badge.tournamentName ?? badge.name}
                        </div>
                        <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 2 }}>
                          {badge.type} · {badge.date ? new Date(badge.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: placeColor }}>
                        +{badge.prize ? (Number(BigInt(badge.prize)) / 1000).toFixed(0) + 'K' : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Игровые достижения */}
          {(() => {
            const ACHS: { id: string; Icon: React.FC<{ size?: number; color?: string }>; name: string; desc: string }[] = [
              { id: 'first_blood',   Icon: IcoSwords,    name: 'First Blood',    desc: 'First game' },
              { id: 'winner_10',     Icon: IcoTrophy,    name: t.profile.achievementWinner10,  desc: t.profile.achievementWinner10Desc },
              { id: 'winner_100',    Icon: IcoCrown,     name: t.profile.achievementWinner100, desc: t.profile.achievementWinner100Desc },
              { id: 'jarvis_hunter', Icon: IcoRobot,     name: 'J.A.R.V.I.S Hunter', desc: 'Max level' },
              { id: 'recruiter',     Icon: IcoUsers,     name: t.profile.achievementRecruiter,  desc: t.profile.achievementRecruiterDesc },
              { id: 'millionaire',   Icon: CoinIcon,     name: t.profile.achievementMillionaire, desc: t.profile.achievementMillionaireDesc },
              { id: 'patriot',       Icon: IcoGlobe,     name: t.profile.achievementPatriot,    desc: t.profile.achievementPatriotDesc },
              { id: 'puzzler',       Icon: IcoPuzzle,    name: t.profile.achievementPuzzler,    desc: t.profile.achievementPuzzlerDesc },
              { id: 'streak_7',      Icon: IcoMedal,     name: t.profile.achievementStreak7,    desc: t.profile.achievementStreak7Desc },
              { id: 'streak_30',     Icon: IcoTon,       name: t.profile.achievementStreak30,   desc: t.profile.achievementStreak30Desc },
              // PR-3 (Кенан 2026-05-18): новые типы.
              { id: 'tournament_winner_week',  Icon: IcoTrophy, name: 'Чемпион Недели',  desc: 'Победа в недельном турнире' },
              { id: 'tournament_winner_month', Icon: IcoTrophy, name: 'Чемпион Месяца',  desc: 'Победа в месячном турнире' },
              { id: 'tournament_winner_year',  Icon: IcoTrophy, name: 'Чемпион Года',    desc: 'Победа в годовом/мировом турнире' },
              { id: 'commander',               Icon: IcoCrown,  name: 'Главнокомандующий', desc: 'Стать командиром страны' },
              { id: 'war_victor',              Icon: IcoSwords, name: 'Победитель Войны',  desc: 'Страна победила в войне' },
              { id: 'war_ace',                 Icon: IcoSwords, name: 'Ас Войны',          desc: '10+ побед в одной войне' },
              { id: 'referral_bronze',         Icon: IcoUsers,  name: 'Бронзовый вербовщик', desc: '5 рефералов' },
              { id: 'referral_silver',         Icon: IcoUsers,  name: 'Серебряный вербовщик', desc: '25 рефералов' },
              { id: 'referral_gold',           Icon: IcoUsers,  name: 'Золотой вербовщик',   desc: '100 рефералов' },
            ];
            const earned: Record<string, string> = {};
            (profile?.achievements ?? []).forEach((a: { id: string; date: string }) => { earned[a.id] = a.date; });
            const earnedCount = Object.keys(earned).length;
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875', padding: '.9rem .85rem .45rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IcoMedal size={11} /> {t.profile.tabs.achievements}</span>
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
                        <span style={{ color: done ? '#82CFFF' : '#5A5248', display: 'inline-flex' }}><a.Icon size={22} /></span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: done ? '#82CFFF' : '#5A5248', lineHeight: 1.2 }}>
                          {a.name}
                        </span>
                        {done && earned[a.id] && (
                          <span style={{ fontSize: 7, color: '#5A5248' }}>
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
          {(profile?.jarvisBadges?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', color: '#5A5248', padding: 32, fontSize: 13 }}>
              {t.profile.noJarvis}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 18px' }}>
              {[...(profile?.jarvisBadges ?? [])].reverse().map((badgeName: string, i: number) => {
                const lvlData = JARVIS_LEVELS.find(l => l.name === badgeName);
                const badgeDates = profile?.jarvisBadgeDates as Record<string, string> | null;
                const dateStr = badgeDates?.[badgeName];
                const colors: Record<string, string> = {
                  Beginner: '#9A9490', Player: '#3DBA7A', Fighter: '#3DBA7A',
                  Warrior: '#4CAF50', Expert: '#9B85FF', Master: '#F0C85A',
                  Professional: '#FF9F43', Epic: '#FF5B5B', Legendary: '#E040FB', Mystic: '#F0C85A',
                };
                const color = colors[badgeName] ?? '#9B85FF';
                return (
                  <div key={i} onClick={() => setSelectedBadge({ name: badgeName, date: dateStr })} style={{ padding: '12px 10px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: `.5px solid ${color}50`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}18`, border: `2px solid ${color}60`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color }}><IcoRobot size={22} color={color} /></span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.55rem', letterSpacing: '.1em', textTransform: 'uppercase', color, marginBottom: 3, fontWeight: 700 }}>{t.gameResult.jarvisCert}</div>
                      <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#EAE2CC' }}>{badgeName}</div>
                      <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t.profile.level} {lvlData?.level ?? '?'} · +{((lvlData?.reward ?? 0) / 1000).toFixed(0)}K <CoinIcon size={10} /></div>
                      {dateStr && (
                        <div style={{ fontSize: '.55rem', color: '#5A5248', marginTop: 4 }}>
                          {new Date(dateStr).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, color: color }}>вњ“</div>
                      <div style={{ fontSize: '.55rem', color: '#5A5248', marginTop: 2 }}>{t.profile.passed}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* SettingsModal — открывается по шестерёнке в топбаре */}
      {showSettings && (
        <div
          onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: 'linear-gradient(180deg,#141018,#0F0E18)', border: '.5px solid rgba(74,158,255,.18)', borderRadius: '24px 24px 0 0', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#EAE2CC', display: 'inline-flex', alignItems: 'center', gap: 8 }}><IcoSettings size={16} /> {t.profile.settings.title}</span>
              <button onClick={() => setShowSettings(false)} style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.09)', color: '#7A7875', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>вњ•</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Язык */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', border: '.5px solid rgba(255,255,255,.07)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#EAE2CC' }}>{t.profile.settings.language}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['en', 'ru'] as Lang[]).map((l) => (
                    <button key={l} onClick={() => setLang(l)} style={{ padding: '5px 12px', background: lang === l ? 'rgba(74,158,255,.18)' : 'rgba(255,255,255,.04)', color: lang === l ? '#82CFFF' : '#5A5248', border: lang === l ? '.5px solid rgba(74,158,255,.3)' : '.5px solid rgba(255,255,255,.07)', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CountryFlag code={l === 'en' ? 'GB' : 'RU'} size={14} />
                      {l === 'en' ? 'EN' : 'RU'}
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
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#EAE2CC' }}>Вибрация</div>
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

    </PageLayout>
    </>
  );
};

const secStyle: React.CSSProperties = { fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875', padding: '.9rem .85rem .45rem' };
const microLbl: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5A5248', marginBottom: 3 };
const balCard: React.CSSProperties = { margin: '12px 18px 0', padding: '14px 18px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
// Вкладки: одинаковая ширина, от края до края (Кенан 2026-05-17).
const ptabsStyle: React.CSSProperties = { display: 'flex', gap: 6, margin: '12px 0 0', padding: '0 18px', paddingBottom: 2 };
const ptab = (active: boolean): React.CSSProperties => ({ flex: '1 1 0', textAlign: 'center', padding: '8px 6px', fontSize: 11, fontWeight: 700, color: active ? '#82CFFF' : '#5A5248', cursor: 'pointer', border: active ? '.5px solid rgba(74,158,255,.3)' : '.5px solid rgba(255,255,255,.06)', outline: 'none', background: active ? 'rgba(74,158,255,.12)' : 'rgba(255,255,255,.04)', borderRadius: 8, fontFamily: 'inherit', transition: 'all .2s', whiteSpace: 'nowrap' } as React.CSSProperties);
const stripStyle: React.CSSProperties = { margin: '4px 18px 0', padding: '13px 16px', background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 };
const tbaStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '.5px solid rgba(255,255,255,.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: '#7A7875' };
const secBtn: React.CSSProperties = { padding: '8px 14px', background: 'rgba(255,255,255,.05)', color: '#EAE2CC', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn: React.CSSProperties = { ...secBtn, background: 'transparent', color: '#9A9490' };
const goldBtn: React.CSSProperties = { padding: '8px 14px', background: '#F0C85A', color: '#0D0D12', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const tagGold: React.CSSProperties = { display: 'inline-flex', padding: '3px 8px', background: 'rgba(245,200,66,0.12)', color: '#F0C85A', borderRadius: 6, fontSize: 10, fontWeight: 700 };
const tagVi: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const tagGr: React.CSSProperties = { ...tagGold, background: 'rgba(0,214,143,0.10)', color: '#3DBA7A' };
const tagRobot: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const avatarRingStyle: React.CSSProperties = { position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid #F0C85A', opacity: .4, animation: 'ring-pulse 3s ease-in-out infinite' };
const settingCard: React.CSSProperties = { background: 'linear-gradient(135deg,#141018,#0F0E18)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
