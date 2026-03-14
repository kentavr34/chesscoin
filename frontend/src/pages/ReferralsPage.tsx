import React, { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { profileApi } from '@/api';
import { fmtBalance, fmtDate } from '@/utils/format';
import { toast } from '@/components/ui/Toast';

const RANK_THRESHOLDS = [
  { rank: 'EMPEROR',      label: 'Император',         emoji: '👑',     minReferrals: 1_000_000, bonus: 40_000,  pct: 15 },
  { rank: 'MARSHAL',      label: 'Маршал',             emoji: '🏅',     minReferrals: 500_000,   bonus: 35_000,  pct: 14 },
  { rank: 'COL_GENERAL',  label: 'Генерал-полковник',  emoji: '🌟🌟🌟', minReferrals: 300_000,   bonus: 30_000,  pct: 13 },
  { rank: 'LT_GENERAL',   label: 'Генерал-лейтенант',  emoji: '🌟🌟',  minReferrals: 200_000,   bonus: 25_000,  pct: 12 },
  { rank: 'MAJ_GENERAL',  label: 'Генерал-майор',      emoji: '🌟',     minReferrals: 100_000,   bonus: 20_000,  pct: 11 },
  { rank: 'BRIGADIER',    label: 'Бригадир',           emoji: '🎖️',    minReferrals: 80_000,    bonus: 15_000,  pct: 10 },
  { rank: 'COLONEL',      label: 'Полковник',          emoji: '⭐⭐⭐',  minReferrals: 60_000,    bonus: 14_000,  pct:  9 },
  { rank: 'LT_COLONEL',   label: 'Подполковник',       emoji: '⭐⭐',   minReferrals: 40_000,    bonus: 13_000,  pct:  8 },
  { rank: 'MAJOR',        label: 'Майор',              emoji: '⭐',     minReferrals: 20_000,    bonus: 12_000,  pct:  7 },
  { rank: 'CAPTAIN',      label: 'Капитан',            emoji: '🔵🔵🔵🔵',minReferrals: 10_000,   bonus: 10_000,  pct:  6 },
  { rank: 'SR_LIEUTENANT',label: 'Ст. Лейтенант',      emoji: '🔵🔵🔵', minReferrals: 5_000,    bonus:  9_000,  pct:  5 },
  { rank: 'LIEUTENANT',   label: 'Лейтенант',          emoji: '🔵🔵',   minReferrals: 3_000,    bonus:  8_000,  pct:  5 },
  { rank: 'JR_LIEUTENANT',label: 'Мл. Лейтенант',      emoji: '🔵',     minReferrals: 1_000,    bonus:  7_000,  pct:  5 },
  { rank: 'WARRANT',      label: 'Прапорщик',          emoji: '🔶',     minReferrals: 500,       bonus:  6_000,  pct:  4 },
  { rank: 'SERGEANT',     label: 'Сержант',            emoji: '🔷',     minReferrals: 100,       bonus:  5_000,  pct:  3 },
  { rank: 'CORPORAL',     label: 'Ефрейтор',           emoji: '🔹',     minReferrals: 50,        bonus:  4_000,  pct:  2 },
  { rank: 'PRIVATE',      label: 'Рядовой',            emoji: '🪖',     minReferrals: 10,        bonus:  3_000,  pct:  1 },
  { rank: 'RECRUIT',      label: 'Новобранец',         emoji: '🙂',     minReferrals: 0,         bonus:      0,  pct:  0 },
];

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
  const { user } = useUserStore();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi.getReferrals()
      .then((r) => setData(r as ReferralData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refLink = data?.refLink ??
    `https://t.me/chessgamecoin_bot?start=ref_${user?.telegramId ?? ''}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(refLink);
      toast.success('Ссылка скопирована!');
    } catch {
      toast.info(refLink);
    }
  };

  const handleShare = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('♟ Играй в ChessCoin — зарабатывай монеты в шахматах!')}`
      );
    } else {
      handleCopy();
    }
  };

  return (
    <PageLayout title="Рефералы" backTo="/profile">
      {/* Шапка */}
      <div style={heroCard}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 16, fontWeight: 700, color: '#F0F2F8' }}>
          Реферальная программа
        </div>
        <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 6, lineHeight: 1.6 }}>
          Приглашай друзей и зарабатывай автоматически
        </div>

        <div style={incomeBadge}>
          <div>
            <div style={microLbl}>Заработано всего</div>
            <div style={incomeNum}>{fmtBalance(data?.totalIncome ?? '0')} ᚙ</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={microLbl}>Рефералов</div>
            <div style={{ ...incomeNum, color: '#F0F2F8' }}>
              {data?.active ?? 0} <span style={{ fontSize: 12, opacity: .5 }}>/ {data?.total ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Ссылка */}
        <div style={linkBox}>
          <div style={{ fontSize: 11, color: '#4A5270', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {refLink}
          </div>
          <button onClick={handleCopy} style={copyBtn}>Копировать</button>
        </div>

        <button onClick={handleShare} style={shareBtn}>
          ↗ Поделиться в Telegram
        </button>
      </div>

      {/* Military Rank Progress */}
      {(() => {
        const referralCount = user?.referralCount ?? (data?.total ?? 0);
        const currentRankIdx = RANK_THRESHOLDS.findIndex(r => referralCount >= r.minReferrals);
        const currentRank = RANK_THRESHOLDS[Math.max(0, currentRankIdx)];
        const nextRank = currentRankIdx > 0 ? RANK_THRESHOLDS[currentRankIdx - 1] : null;
        const progress = nextRank
          ? Math.min(100, ((referralCount - currentRank.minReferrals) / (nextRank.minReferrals - currentRank.minReferrals)) * 100)
          : 100;

        return (
          <div style={{ margin: '12px 18px 0', padding: '16px', background: '#13161E', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#4A5270', marginBottom: 10 }}>Военное звание</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 28 }}>{currentRank.emoji}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#F5C842' }}>{currentRank.label}</div>
                <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>{referralCount} рефералов</div>
                {currentRank.bonus > 0 && (
                  <div style={{ fontSize: 10, color: '#7B61FF', marginTop: 2 }}>
                    +{currentRank.bonus.toLocaleString()} ᚙ за реферала · {currentRank.pct}% от выигрыша
                  </div>
                )}
              </div>
              {nextRank && (
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: '#4A5270', marginBottom: 2 }}>Следующий ранг</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#7B61FF' }}>{nextRank.emoji} {nextRank.label}</div>
                  <div style={{ fontSize: 10, color: '#4A5270' }}>{nextRank.minReferrals.toLocaleString()} реф.</div>
                </div>
              )}
            </div>
            {nextRank && (
              <>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#7B61FF,#F5C842)', borderRadius: 999, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: 10, color: '#4A5270', marginTop: 6, textAlign: 'right' }}>
                  {nextRank.minReferrals - referralCount} до следующего звания
                </div>
              </>
            )}
            {/* Rank ladder */}
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {RANK_THRESHOLDS.slice().reverse().map(r => (
                <span key={r.rank} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 8,
                  background: referralCount >= r.minReferrals ? 'rgba(245,200,66,0.12)' : 'rgba(255,255,255,0.04)',
                  color: referralCount >= r.minReferrals ? '#F5C842' : '#4A5270',
                  border: `1px solid ${referralCount >= r.minReferrals ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  fontWeight: 600,
                }}>
                  {r.emoji} {r.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Условия программы */}
      {(() => {
        const referralCount = user?.referralCount ?? (data?.total ?? 0);
        const currentRankIdx = RANK_THRESHOLDS.findIndex(r => referralCount >= r.minReferrals);
        const currentRank = RANK_THRESHOLDS[Math.max(0, currentRankIdx)];
        const activationBonus = user?.militaryRank?.activationBonus
          ? Number(user.militaryRank.activationBonus)
          : currentRank.bonus;
        const l1Percent = user?.militaryRank?.l1Percent ?? currentRank.pct;

        const rules = [
          {
            ico: '🎁',
            title: activationBonus > 0 ? `+${activationBonus.toLocaleString()} ᚙ` : 'Нет бонуса',
            sub: 'когда друг сыграет первую партию',
          },
          {
            ico: '⚔️',
            title: l1Percent > 0 ? `${l1Percent}% от выигрыша` : 'Нет бонуса',
            sub: 'за каждую победу друга (уровень 1)',
          },
          {
            ico: '🔗',
            title: '10% от выигрыша',
            sub: 'от побед друзей вашего друга (уровень 2)',
          },
        ];

        return (
          <>
            <div style={secLbl}>Как это работает</div>
            <div style={{ margin: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rules.map((r) => (
                <div key={r.ico} style={ruleRow}>
                  <div style={{ fontSize: 22, width: 36, textAlign: 'center', flexShrink: 0 }}>{r.ico}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F5C842' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>{r.sub}</div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#4A5270', padding: '6px 0', lineHeight: 1.5 }}>
                * Бонус начисляется только после первой завершённой партии реферала. Размер зависит от вашего военного звания.
              </div>
            </div>
          </>
        );
      })()}

      {/* Список рефералов */}
      {!loading && (data?.referrals?.length ?? 0) > 0 && (
        <>
          <div style={secLbl}>Мои рефералы ({data!.total})</div>
          {data!.referrals.map((ref) => (
            <div key={ref.id} style={refRow}>
              <Avatar user={ref as any} size="s" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>
                  {ref.firstName}
                </div>
                <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 1 }}>
                  ELO {ref.elo} · {fmtDate(ref.createdAt)}
                </div>
              </div>
              <div>
                {ref.referralActivated ? (
                  <span style={tagGreen}>✓ Активен</span>
                ) : (
                  <span style={tagGray}>⏳ Ждёт</span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && (data?.total ?? 0) === 0 && (
        <div style={{ textAlign: 'center', color: '#4A5270', fontSize: 13, padding: '32px 0' }}>
          Пока нет рефералов.<br />Поделитесь ссылкой с друзьями!
        </div>
      )}
    </PageLayout>
  );
};

// ── Styles ──
const heroCard: React.CSSProperties = {
  margin: '8px 18px',
  padding: '20px',
  background: 'linear-gradient(135deg, #1A1D2E, #13162A)',
  border: '1px solid rgba(123,97,255,0.2)',
  borderRadius: 20,
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  textAlign: 'center', gap: 0,
};
const incomeBadge: React.CSSProperties = {
  width: '100%', marginTop: 16,
  padding: '14px 16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center',
};
const microLbl: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: '#4A5270',
  letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 4,
};
const incomeNum: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace",
  fontSize: 18, fontWeight: 800, color: '#F5C842',
};
const linkBox: React.CSSProperties = {
  width: '100%', marginTop: 12,
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 12,
  display: 'flex', alignItems: 'center', gap: 8,
};
const copyBtn: React.CSSProperties = {
  padding: '6px 12px', background: 'rgba(245,200,66,0.12)',
  color: '#F5C842', border: '1px solid rgba(245,200,66,0.25)',
  borderRadius: 8, fontSize: 11, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
};
const shareBtn: React.CSSProperties = {
  width: '100%', marginTop: 10,
  padding: '11px', background: '#7B61FF', color: '#fff',
  border: 'none', borderRadius: 14,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const secLbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: '#4A5270',
  padding: '18px 18px 8px',
};
const ruleRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12,
  padding: '12px 14px',
  background: '#1C2030',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
};
const refRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 18px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
};
const tagGreen: React.CSSProperties = {
  display: 'inline-block', padding: '3px 8px',
  background: 'rgba(0,214,143,0.1)', color: '#00D68F',
  borderRadius: 6, fontSize: 10, fontWeight: 700,
};
const tagGray: React.CSSProperties = {
  display: 'inline-block', padding: '3px 8px',
  background: 'rgba(255,255,255,0.05)', color: '#4A5270',
  borderRadius: 6, fontSize: 10, fontWeight: 700,
};
