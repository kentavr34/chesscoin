import React, { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { profileApi } from '@/api';
import { fmtBalance, fmtDate } from '@/utils/format';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Heading } from '@/components/ui/Heading';
import { Card } from '@/components/ui/Card';

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
      toast.success(t.common.success);
    } catch {
      toast.info(refLink);
    }
  };

  const handleShare = () => {
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
      {/* Header */}
      <Card style={{ margin: '8px 18px', background: 'linear-gradient(135deg, #1A1D2E, #13162A)', border: '1px solid rgba(123,97,255,0.2)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
        <Heading level={2}>{r.title}</Heading>
        <Text variant="caption" color="--color-text-secondary" style={{ marginTop: 6, lineHeight: 1.6, display: 'block' }}>
          {r.subtitle}
        </Text>

        <Card padding="md" style={{ width: '100%', marginTop: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between' }}>
            <div>
              <Text variant="caption" color="--color-text-muted" weight="bold" style={{ letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                {r.totalEarned}
              </Text>
              <Text variant="body" weight="bold" color="--color-accent-gold" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18 }}>
                {fmtBalance(data?.totalIncome ?? '0')} ᚙ
              </Text>
            </div>
            <div style={{ width: 1, background: 'var(--border, rgba(255,255,255,0.08))', alignSelf: 'stretch' }} />
            <div style={{ textAlign: 'right' }}>
              <Text variant="caption" color="--color-text-muted" weight="bold" style={{ letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                {r.referralsCount}
              </Text>
              <Text variant="body" weight="bold" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18 }}>
                {data?.active ?? 0} <span style={{ fontSize: 12, opacity: .5 }}>/ {data?.total ?? 0}</span>
              </Text>
            </div>
          </div>
        </Card>

        {/* Link */}
        <Card padding="md" style={{ width: '100%', marginTop: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text variant="caption" color="--color-text-muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {refLink}
          </Text>
          <Button variant="secondary" size="sm" onClick={handleCopy} style={{ background: 'rgba(245,200,66,0.12)', color: 'var(--accent, #F5C842)', border: '1px solid rgba(245,200,66,0.25)', flexShrink: 0 }}>
            {r.copy}
          </Button>
        </Card>

        <Button variant="tertiary" size="md" fullWidth onClick={handleShare} style={{ marginTop: 10, background: '#7B61FF', color: '#fff', border: 'none' }}>
          {r.shareOnTelegram}
        </Button>
      </Card>

      {/* Military Rank Progress */}
      {(() => {
        const referralCount = user?.referralCount ?? (data?.total ?? 0);
        const currentRankIdx = rankThresholds.findIndex(rk => referralCount >= rk.minReferrals);
        const currentRank = rankThresholds[Math.max(0, currentRankIdx)];
        const nextRank = currentRankIdx > 0 ? rankThresholds[currentRankIdx - 1] : null;
        const progress = nextRank
          ? Math.min(100, ((referralCount - currentRank.minReferrals) / (nextRank.minReferrals - currentRank.minReferrals)) * 100)
          : 100;

        return (
          <Card style={{ margin: '12px 18px 0', background: 'var(--bg-card, #13161E)', border: '1px solid rgba(123,97,255,0.25)' }}>
            <Text variant="caption" color="--color-text-muted" weight="bold" style={{ letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>
              {r.militaryRank}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 28 }}>{currentRank.emoji}</div>
              <div>
                <Heading level={3} color="--color-accent-gold" style={{ fontSize: 15 }}>
                  {currentRank.label}
                </Heading>
                <Text variant="caption" color="--color-text-secondary" style={{ marginTop: 2 }}>
                  {referralCount} {r.referralsCount.toLowerCase()}
                </Text>
                {currentRank.bonus > 0 && (
                  <Text variant="caption" style={{ color: '#7B61FF', marginTop: 2, display: 'block' }}>
                    +{currentRank.bonus.toLocaleString()} ᚙ {r.perReferral} · {currentRank.pct}% {r.ofWinnings}
                  </Text>
                )}
              </div>
              {nextRank && (
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <Text variant="caption" color="--color-text-muted" style={{ marginBottom: 2, display: 'block' }}>
                    {r.nextRank}
                  </Text>
                  <Text variant="body" weight="bold" style={{ color: '#7B61FF' }}>
                    {nextRank.emoji} {nextRank.label}
                  </Text>
                  <Text variant="caption" color="--color-text-muted">
                    {nextRank.minReferrals.toLocaleString()} {r.ref}
                  </Text>
                </div>
              )}
            </div>
            {nextRank && (
              <>
                <div style={{ height: 6, background: 'var(--border, rgba(255,255,255,0.07))', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#7B61FF,#F5C842)', borderRadius: 999, transition: 'width .5s' }} />
                </div>
                <Text variant="caption" color="--color-text-muted" style={{ marginTop: 6, textAlign: 'right', display: 'block' }}>
                  {nextRank.minReferrals - referralCount} {r.untilNextRank}
                </Text>
              </>
            )}
            {/* Rank ladder — highest on top, current marked 📍 */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rankThresholds.map(rk => {
                const unlocked = referralCount >= rk.minReferrals;
                const isCurrent = rk.rank === currentRank.rank;
                return (
                  <Card
                    key={rk.rank}
                    padding="sm"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, position: 'relative',
                      background: isCurrent
                        ? 'linear-gradient(135deg,rgba(245,200,66,0.14),rgba(123,97,255,0.07))'
                        : unlocked ? 'rgba(245,200,66,0.04)' : 'rgba(255,255,255,0.02)',
                      border: `${isCurrent ? '2px' : '1px'} solid ${
                        isCurrent ? 'rgba(245,200,66,0.5)' : unlocked ? 'rgba(245,200,66,0.14)' : 'rgba(255,255,255,0.04)'
                      }`,
                      opacity: unlocked ? 1 : 0.42,
                      transition: 'all .15s',
                    }}
                  >
                    {isCurrent && (
                      <div style={{
                        position: 'absolute', top: 0, right: 10,
                        fontSize: 8, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
                        color: '#F5C842', background: 'rgba(245,200,66,0.18)',
                        padding: '2px 6px', borderRadius: '0 0 6px 6px',
                      }}>{r.you}</div>
                    )}
                    <span style={{ fontSize: 20, minWidth: 55, textAlign: 'center', flexShrink: 0, display: 'inline-block' }}>{rk.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <Text
                        variant="body"
                        weight={isCurrent ? 'bold' : 'bold'}
                        style={{
                          fontSize: 12,
                          color: isCurrent ? 'var(--accent, #F5C842)' : unlocked ? 'var(--text-primary, #F0F2F8)' : 'var(--text-secondary, #8B92A8)',
                          display: 'block',
                        }}
                      >
                        {rk.label}
                      </Text>
                      <Text variant="caption" color="--color-text-muted" style={{ marginTop: 1 }}>
                        {rk.minReferrals.toLocaleString()} {r.ref}
                      </Text>
                    </div>
                    {rk.bonus > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <Text variant="caption" weight="bold" style={{ color: isCurrent ? 'var(--accent, #F5C842)' : unlocked ? '#9B85FF' : 'var(--text-muted, #4A5270)' }}>
                          +{rk.bonus.toLocaleString()} ᚙ
                        </Text>
                        <Text variant="caption" color="--color-text-muted" style={{ fontSize: 9 }}>
                          {rk.pct}%
                        </Text>
                      </div>
                    )}
                    {isCurrent ? <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
                      : unlocked ? <span style={{ color: 'var(--green, #00D68F)', fontSize: 14, flexShrink: 0 }}>✓</span>
                      : null}
                  </Card>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Program rules */}
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
            <Text variant="caption" color="--color-text-muted" weight="bold" style={{ fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', padding: '18px 18px 8px', display: 'block' }}>
              {r.howItWorks}
            </Text>
            <div style={{ margin: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rules.map((rule) => (
                <Card key={rule.ico} padding="md" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 22, width: 36, textAlign: 'center', flexShrink: 0 }}>{rule.ico}</div>
                  <div>
                    <Text variant="body" weight="bold" color="--color-accent-gold">
                      {rule.title}
                    </Text>
                    <Text variant="caption" color="--color-text-secondary" style={{ marginTop: 2 }}>
                      {rule.sub}
                    </Text>
                  </div>
                </Card>
              ))}
              <Text variant="caption" color="--color-text-muted" style={{ padding: '6px 0', lineHeight: 1.5 }}>
                {r.bonusNote}
              </Text>
            </div>
          </>
        );
      })()}

      {/* Referral list */}
      {!loading && (data?.referrals?.length ?? 0) > 0 && (
        <>
          <Text variant="caption" color="--color-text-muted" weight="bold" style={{ fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', padding: '18px 18px 8px', display: 'block' }}>
            {r.referralsList} ({data!.total})
          </Text>
          {data!.referrals.map((ref) => (
            <Card
              key={ref.id}
              padding="sm"
              style={{
                margin: '0 18px',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Avatar user={ref as unknown as import("@/types").UserPublic} size="s" />
              <div style={{ flex: 1 }}>
                <Text variant="body" weight="bold">
                  {ref.firstName}
                </Text>
                <Text variant="caption" color="--color-text-secondary" style={{ marginTop: 1 }}>
                  ELO {ref.elo} · {fmtDate(ref.createdAt)}
                </Text>
              </div>
              <div>
                {ref.referralActivated ? (
                  <span style={{ display: 'inline-block', padding: '3px 8px', background: 'rgba(0,214,143,0.1)', color: 'var(--green, #00D68F)', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                    {r.active}
                  </span>
                ) : (
                  <span style={{ display: 'inline-block', padding: '3px 8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted, #4A5270)', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                    {r.pending}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </>
      )}

      {!loading && (data?.total ?? 0) === 0 && (
        <Text variant="body" style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: '32px 0', whiteSpace: 'pre-line' }}>
          {r.noReferrals}
        </Text>
      )}
    </PageLayout>
  );
};

