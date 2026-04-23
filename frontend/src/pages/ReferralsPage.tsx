import React, { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { profileApi } from '@/api';
import { fmtBalance, fmtDate } from '@/utils/format';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n/useT';
import { haptic } from '@/lib/haptic';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

const RANK_THRESHOLDS_BASE = [
  { rank: 'EMPEROR',      emoji: '👑',     minReferrals: 1_000_000, bonus: 40_000,  pct: 15 },
  { rank: 'MARSHAL',      emoji: '🏅',     minReferrals: 500_000,   bonus: 35_000,  pct: 14 },
  { rank: 'COL_GENERAL',  emoji: '🌟🌟🌟', minReferrals: 300_000,   bonus: 30_000,  pct: 13 },
  { rank: 'LT_GENERAL',   emoji: '🌟🌟',  minReferrals: 200_000,   bonus: 25_000,  pct: 12 },
  { rank: 'MAJ_GENERAL',  emoji: '🌟',     minReferrals: 100_000,   bonus: 20_000,  pct: 11 },
  { rank: 'BRIGADIER',    emoji: '🎖️',    minReferrals: 80_000,    bonus: 15_000,  pct: 10 },
  { rank: 'COLONEL',      emoji: '⭐⭐⭐',  minReferrals: 60_000,    bonus: 14_000,  pct:  9 },
  { rank: 'LT_COLONEL',   emoji: '⭐⭐',   minReferrals: 40_000,    bonus: 13_000,  pct:  8 },
  { rank: 'MAJOR',        emoji: '⭐',     minReferrals: 20_000,    bonus: 12_000,  pct:  7 },
  { rank: 'CAPTAIN',      emoji: '🔵🔵🔵🔵',minReferrals: 10_000,   bonus: 10_000,  pct:  6 },
  { rank: 'SR_LIEUTENANT',emoji: '🔵🔵🔵', minReferrals: 5_000,    bonus:  9_000,  pct:  5 },
  { rank: 'LIEUTENANT',   emoji: '🔵🔵',   minReferrals: 3_000,    bonus:  8_000,  pct:  5 },
  { rank: 'JR_LIEUTENANT',emoji: '🔵',     minReferrals: 1_000,    bonus:  7_000,  pct:  5 },
  { rank: 'WARRANT',      emoji: '🔶',     minReferrals: 500,       bonus:  6_000,  pct:  4 },
  { rank: 'SERGEANT',     emoji: '🔷',     minReferrals: 100,       bonus:  5_000,  pct:  3 },
  { rank: 'CORPORAL',     emoji: '🔹',     minReferrals: 50,        bonus:  4_000,  pct:  2 },
  { rank: 'PRIVATE',      emoji: '🪖',     minReferrals: 10,        bonus:  3_000,  pct:  1 },
  { rank: 'RECRUIT',      emoji: '🙂',     minReferrals: 0,         bonus:      0,  pct:  0 },
];

// Функция для получения локализованных рангов
function getRankThresholds(t: ReturnType<typeof useT>) {
  return RANK_THRESHOLDS_BASE.map((base, idx) => ({
    ...base,
    label: t.referrals.ranks[idx].label,
  }));
}

interface Referral {
  id: string;
  firstName: string;
  username?: string | null;
  elo: number;
  referralActivated: boolean;
  createdAt: string;
}

interface ReferralData {
  total: number;
  active: number;
  totalIncome: string;
  refLink: string;
  referrals: Referral[];
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '.58rem',
  fontWeight: 700,
  color: '#7A7875',
  textTransform: 'uppercase',
  letterSpacing: '.14em',
};

const CARD_BASE: React.CSSProperties = {
  background: 'linear-gradient(135deg,#141018,#0F0E18)',
  borderRadius: 16,
};

export const ReferralsPage: React.FC = () => {
  const t = useT();
  const r = t.referrals;
  const { user } = useUserStore();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const rankThresholds = getRankThresholds(t);

  useEffect(() => {
    profileApi.getReferrals()
      .then((res) => setData(res as ReferralData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refLink = data?.refLink ??
    `https://t.me/chessgamecoin_bot?start=ref_${user?.telegramId ?? ''}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
      haptic.notification('success');
      toast.success(t.common.success);
    } catch {
      toast.info(refLink);
    }
  };

  const handleShare = () => {
    haptic.impact('light');
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(r.shareText)}`
      );
    } else {
      handleCopy();
    }
  };

  return (
    <PageLayout title={t.profile.refSection} backTo="/profile" centered>

      {/* Hero card */}
      <div style={{ ...CARD_BASE, margin: '8px 16px 0', border: '.5px solid rgba(61,186,122,.28)', padding: '20px 18px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>👥</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#E8E3DB', marginBottom: 6 }}>{r.title}</div>
        <div style={{ fontSize: '0.78rem', color: '#7A7875', lineHeight: 1.6 }}>{r.subtitle}</div>

        {/* Stats — 3 карточки в ряд */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
          {[
            { label: r.totalEarned, value: `${fmtBalance(data?.totalIncome ?? '0')} ᚙ`, color: '#3DBA7A' },
            { label: r.referralsCount, value: String(data?.active ?? 0), color: '#3DBA7A' },
            { label: 'Total', value: String(data?.total ?? 0), color: '#3DBA7A' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: 'rgba(61,186,122,.06)',
                border: '.5px solid rgba(61,186,122,.18)',
                borderRadius: 12,
                padding: '10px 8px',
              }}
            >
              <div style={{ ...LABEL_STYLE, marginBottom: 4, display: 'block', textAlign: 'center' }}>{stat.label}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.9rem', fontWeight: 800, color: stat.color, textAlign: 'center' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Реферальная ссылка */}
        <div style={{
          marginTop: 14,
          background: 'rgba(61,186,122,.05)',
          border: '.5px solid rgba(61,186,122,.28)',
          borderRadius: 12,
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem', color: '#7A7875', textAlign: 'left' }}>
            {refLink}
          </div>
          <button
            onClick={handleCopy}
            style={{
              padding: '7px 13px', borderRadius: 8, cursor: 'pointer', flexShrink: 0,
              border: '.5px solid rgba(61,186,122,.4)',
              background: 'rgba(61,186,122,.12)',
              color: '#3DBA7A', fontSize: '0.72rem', fontWeight: 700,
            }}
          >
            {r.copy}
          </button>
        </div>

        {/* Кнопка поделиться */}
        <button
          onClick={handleShare}
          style={{
            marginTop: 10, width: '100%', padding: '13px 0', borderRadius: 12,
            border: 'none', background: 'linear-gradient(135deg,#3DBA7A,#2A9E63)',
            color: '#fff', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          {r.shareOnTelegram}
        </button>
      </div>

      {/* Военный ранг */}
      {(() => {
        const referralCount = user?.referralCount ?? (data?.total ?? 0);
        const currentRankIdx = rankThresholds.findIndex(rk => referralCount >= rk.minReferrals);
        const currentRank = rankThresholds[Math.max(0, currentRankIdx)];
        const nextRank = currentRankIdx > 0 ? rankThresholds[currentRankIdx - 1] : null;
        const progress = nextRank
          ? Math.min(100, ((referralCount - currentRank.minReferrals) / (nextRank.minReferrals - currentRank.minReferrals)) * 100)
          : 100;

        return (
          <div style={{ ...CARD_BASE, margin: '12px 16px 0', border: '.5px solid rgba(61,186,122,.25)', padding: '16px 16px 14px' }}>
            <div style={{ ...LABEL_STYLE, marginBottom: 10, display: 'block' }}>
              {r.militaryRank}
            </div>

            {/* Текущий ранг */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%',
                background: 'rgba(61,186,122,.1)',
                border: '.5px solid rgba(61,186,122,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>
                {currentRank.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#3DBA7A' }}>{currentRank.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#7A7875', marginTop: 2 }}>
                  {referralCount} {r.referralsCount.toLowerCase()}
                </div>
                {currentRank.bonus > 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#3DBA7A', marginTop: 2 }}>
                    +{currentRank.bonus.toLocaleString()} ᚙ {r.perReferral} · {currentRank.pct}% {r.ofWinnings}
                  </div>
                )}
              </div>
              {nextRank && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.62rem', color: '#7A7875', marginBottom: 2 }}>{r.nextRank}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3DBA7A' }}>
                    {nextRank.emoji} {nextRank.label}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#4A5270' }}>
                    {nextRank.minReferrals.toLocaleString()} {r.ref}
                  </div>
                </div>
              )}
            </div>

            {/* Прогресс-бар */}
            {nextRank && (
              <>
                <div style={{ height: 6, background: 'rgba(255,255,255,.07)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#3DBA7A,#7EE8A2)', borderRadius: 999, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: '0.68rem', color: '#4A5270', textAlign: 'right' }}>
                  {nextRank.minReferrals - referralCount} {r.untilNextRank}
                </div>
              </>
            )}

            {/* Лесенка рангов */}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {rankThresholds.map(rk => {
                const unlocked = referralCount >= rk.minReferrals;
                const isCurrent = rk.rank === currentRank.rank;
                return (
                  <div
                    key={rk.rank}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      position: 'relative',
                      background: isCurrent
                        ? 'linear-gradient(135deg,rgba(61,186,122,.14),rgba(61,186,122,.05))'
                        : unlocked ? 'rgba(61,186,122,.04)' : 'rgba(255,255,255,.02)',
                      border: isCurrent
                        ? '1px solid rgba(61,186,122,.45)'
                        : unlocked ? '.5px solid rgba(61,186,122,.14)' : '.5px solid rgba(255,255,255,.04)',
                      borderRadius: 10,
                      padding: '7px 10px',
                      opacity: unlocked ? 1 : 0.62,
                      transition: 'all .15s',
                    }}
                  >
                    {isCurrent && (
                      <div style={{
                        position: 'absolute', top: 0, right: 10,
                        fontSize: '0.5rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
                        color: '#3DBA7A', background: 'rgba(61,186,122,.18)',
                        padding: '2px 6px', borderRadius: '0 0 6px 6px',
                      }}>{r.you}</div>
                    )}
                    <span style={{ fontSize: 18, minWidth: 50, textAlign: 'center', flexShrink: 0 }}>{rk.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.78rem', fontWeight: 800,
                        color: isCurrent ? '#3DBA7A' : unlocked ? '#E8E3DB' : '#B8B0A8',
                      }}>
                        {rk.label}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: unlocked ? '#7A7875' : '#6A6460', marginTop: 1 }}>
                        {rk.minReferrals.toLocaleString()} {r.ref}
                      </div>
                    </div>
                    {rk.bonus > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: isCurrent ? '#3DBA7A' : unlocked ? '#3DBA7A' : '#6A7A6A' }}>
                          +{rk.bonus.toLocaleString()} ᚙ
                        </div>
                        <div style={{ fontSize: '0.6rem', color: unlocked ? '#7A7875' : '#5A5A5A', fontWeight: 700 }}>{rk.pct}%</div>
                      </div>
                    )}
                    {isCurrent
                      ? <span style={{ fontSize: 14, flexShrink: 0 }}>📍</span>
                      : unlocked ? <span style={{ color: '#3DBA7A', fontSize: 13, flexShrink: 0 }}>✓</span>
                      : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Правила программы */}
      {(() => {
        const referralCount = user?.referralCount ?? (data?.total ?? 0);
        const currentRankIdx = rankThresholds.findIndex(rk => referralCount >= rk.minReferrals);
        const currentRank = rankThresholds[Math.max(0, currentRankIdx)];
        const FIRST_GAME_BONUS = 3_000;
        const firstGameBonus = user?.militaryRank?.activationBonus
          ? Math.max(FIRST_GAME_BONUS, Number(user.militaryRank.activationBonus))
          : FIRST_GAME_BONUS;
        const l1Percent = user?.militaryRank?.l1Percent ?? currentRank.pct;

        const rules = [
          {
            ico: '🎁',
            title: `+${firstGameBonus.toLocaleString()} ᚙ`,
            sub: r.ruleFirstGame,
          },
          {
            ico: '⚔️',
            title: l1Percent > 0 ? `${l1Percent}% ${r.ofWinnings}` : `50% ${r.ofWinnings}`,
            sub: r.ruleLevel1,
          },
          {
            ico: '🔗',
            title: r.ruleLevel2Title,
            sub: r.ruleLevel2,
          },
        ];

        return (
          <>
            <div style={{ ...LABEL_STYLE, padding: '18px 18px 10px', display: 'block' }}>
              {r.howItWorks}
            </div>
            <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rules.map((rule) => (
                <div
                  key={rule.ico}
                  style={{
                    ...CARD_BASE,
                    border: '.5px solid rgba(61,186,122,.18)',
                    padding: '13px 14px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'rgba(61,186,122,.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {rule.ico}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#3DBA7A', marginBottom: 3 }}>
                      {rule.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#7A7875', lineHeight: 1.5 }}>
                      {rule.sub}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: '0.7rem', color: '#4A5270', lineHeight: 1.6, padding: '4px 0' }}>
                {r.bonusNote}
              </div>
            </div>
          </>
        );
      })()}

      {/* Список рефералов */}
      {!loading && (data?.referrals?.length ?? 0) > 0 && (
        <>
          <div style={{ ...LABEL_STYLE, padding: '4px 18px 10px', display: 'block' }}>
            {r.referralsList} ({data!.total})
          </div>
          <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data!.referrals.map((ref) => (
              <div
                key={ref.id}
                style={{
                  ...CARD_BASE,
                  border: '.5px solid rgba(61,186,122,.14)',
                  padding: '11px 13px',
                  display: 'flex', alignItems: 'center', gap: 11,
                }}
              >
                {/* Аватар — инициалы в круге */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(61,186,122,.12)',
                  border: '.5px solid rgba(61,186,122,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 800, color: '#3DBA7A',
                  flexShrink: 0,
                }}>
                  {ref.firstName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E8E3DB' }}>
                    {ref.firstName}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#7A7875', marginTop: 2 }}>
                    ELO {ref.elo} · {fmtDate(ref.createdAt)}
                  </div>
                </div>
                <div>
                  {ref.referralActivated ? (
                    <span style={{
                      display: 'inline-block', padding: '3px 9px',
                      background: 'rgba(61,186,122,.1)', color: '#3DBA7A',
                      borderRadius: 6, fontSize: '0.6rem', fontWeight: 700,
                      border: '.5px solid rgba(61,186,122,.3)',
                    }}>
                      {r.active}
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-block', padding: '3px 9px',
                      background: 'rgba(255,255,255,.05)', color: '#4A5270',
                      borderRadius: 6, fontSize: '0.6rem', fontWeight: 700,
                      border: '.5px solid rgba(255,255,255,.06)',
                    }}>
                      {r.pending}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && (data?.total ?? 0) === 0 && (
        <EmptyState icon="👥" title={r.noReferrals.split('\n')[0]} desc={r.noReferrals.split('\n').slice(1).join('\n') || undefined} accent="#3DBA7A" />
      )}
    </PageLayout>
  );
};
