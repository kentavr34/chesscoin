import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/i18n/useT';
import type { Lang } from '@/i18n/translations';
import { profileApi, authApi } from '@/api';
import { fmtBalance, fmtDate, leagueEmoji } from '@/utils/format';
import type { Transaction } from '@/types';
import { JARVIS_LEVELS } from '@/components/ui/JarvisModal';

// ── BadgeDetailModal ─────────────────────────────────────────────────────────
const BadgeDetailModal: React.FC<{
  badgeName: string;
  date?: string;
  onClose: () => void;
}> = ({ badgeName, date, onClose }) => {
  const t = useT();
  const lvlData = JARVIS_LEVELS.find(l => l.name === badgeName);
  const colors: Record<string, string> = {
    Beginner: '#8B92A8', Player: '#00B4D8', Fighter: '#00D68F',
    Warrior: '#4CAF50', Expert: '#9B85FF', Master: '#F5C842',
    Professional: '#FF9F43', Epic: '#FF6B6B', Legendary: '#E040FB', Mystic: '#F5C842',
  };
  const color = colors[badgeName] ?? '#9B85FF';
  const formattedDate = date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 320, background: 'linear-gradient(160deg,#13161F,#0B0D11)', border: `1px solid ${color}40`, borderRadius: 24, padding: '32px 24px 24px', textAlign: 'center', boxShadow: `0 0 60px ${color}20` }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4A5270', marginBottom: 8 }}>{t.gameResult.jarvisCert}</div>
        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color, marginBottom: 8 }}>{badgeName}</div>
        <div style={{ fontSize: 13, color: '#8B92A8', marginBottom: 20 }}>
          {t.profile.level} {lvlData?.level ?? '?'} · +{(lvlData?.reward ?? 0).toLocaleString()} ᚙ
        </div>
        {formattedDate && (
          <div style={{ fontSize: 14, color: '#8B92A8', marginBottom: 8 }}>📅 {formattedDate}</div>
        )}
        <div style={{ fontSize: 12, color: '#00D68F', marginBottom: 24 }}>{t.gameResult.confirmedBy}</div>
        <button onClick={onClose} style={{ width: '100%', padding: 12, background: '#1C2030', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#F0F2F8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {t.gameResult.close}
        </button>
      </div>
    </div>
  );
};

type Tab = 'info' | 'games' | 'saves' | 'ach' | 'settings';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useUserStore();
  const { lang, setLang, soundEnabled, setSoundEnabled } = useSettingsStore();
  const t = useT();
  const [tab, setTab] = useState<Tab>('info');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedBadge, setSelectedBadge] = useState<{ name: string; date?: string } | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarDelete = async () => {
    if (!confirm(t.profile.deleteAvatar)) return;
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
    if (tab === 'games') {
      profileApi.getTransactions().then((r) => setTransactions(r.transactions)).catch(() => {});
    }
  }, [tab]);

  if (!user) return null;

  const totalGames = user.totalGames ?? 0;
  const wins = user.wins ?? 0;
  const losses = user.losses ?? 0;
  const draws = user.draws ?? 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const lossRate = totalGames > 0 ? Math.round((losses / totalGames) * 100) : 0;
  const drawRate = 100 - winRate - lossRate;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'info',     label: t.profile.tabs.info },
    { id: 'games',    label: t.profile.tabs.games },
    { id: 'saves',    label: t.profile.tabs.saves },
    { id: 'ach',      label: t.profile.tabs.achievements },
    { id: 'settings', label: t.profile.tabs.settings },
  ];

  const rightAction = (
    <button onClick={() => setTab('settings')} style={tbaStyle}>⚙</button>
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
        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 18, fontWeight: 700, color: '#F0F2F8', letterSpacing: '-.02em', textAlign: 'center' }}>
          {user.firstName} {user.lastName ?? ''}
        </div>
        <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 3 }}>@{user.username ?? 'unknown'}</div>
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
          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color: '#F5C842' }}>
            {fmtBalance(user.balance)} <span style={{ fontSize: 13, opacity: .5 }}>ᚙ</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => navigate('/shop')} style={secBtn}>{t.profile.shop}</button>
          <button onClick={() => navigate('/referrals')} style={ghostBtn}>{t.profile.referrals}</button>
        </div>
      </div>

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
            <CircStat value={wins}   pct={winRate}  color="#00D68F" label={t.profile.wins}   />
            <CircStat value={losses} pct={lossRate} color="#FF4D6A" label={t.profile.losses} />
            <CircStat value={draws}  pct={drawRate} color="#9B85FF" label={t.profile.draws}  />
          </div>

          <div style={{ margin: '0 18px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 12 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '8px 18px 0' }}>
            <StatCard val={totalGames}       lbl={t.profile.games}  />
            <StatCard val={user.elo}         lbl={t.profile.elo}    color="#9B85FF" />
            <StatCard val={user.winStreak ?? 0} lbl={t.profile.streak} color="#F5C842" />
          </div>

          <div style={secStyle}>{t.profile.refSection}</div>
          <div style={{ margin: '0 18px', padding: 14, background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F2F8' }}>{t.profile.refLink}</div>
              <div style={{ fontSize: 10, color: '#4A5270', fontFamily: "'JetBrains Mono',monospace", marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                t.me/chessgamecoin_bot?start=ref_{user.telegramId}
              </div>
            </div>
            <button style={goldBtn}>{t.profile.invite}</button>
          </div>
        </>
      )}

      {/* Games tab */}
      {tab === 'games' && (
        <>
          <div style={secStyle}>{t.profile.txHistory}</div>
          {transactions.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', padding: 32 }}>{t.profile.noTx}</div>
          )}
          {transactions.map((tx) => {
            const isPos = BigInt(tx.amount) > 0n;
            return (
              <div key={tx.id} style={stripStyle}>
                <span style={{ fontSize: 20 }}>{isPos ? '📈' : '📉'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{tx.type}</div>
                  <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>{fmtDate(tx.createdAt)}</div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: isPos ? '#00D68F' : '#FF4D6A' }}>
                  {isPos ? '+' : ''}{fmtBalance(tx.amount)} ᚙ
                </span>
              </div>
            );
          })}
        </>
      )}

      {/* Saves tab */}
      {tab === 'saves' && (
        <>
          <div style={secStyle}>{t.profile.savedGames}</div>
          <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 13 }}>
            {t.profile.noSaves}
          </div>
        </>
      )}

      {/* Achievements tab */}
      {tab === 'ach' && (
        <>
          <div style={secStyle}>{t.profile.jarvisCerts}</div>
          {((user as any).jarvisBadges?.length ?? 0) === 0 ? (
            <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 13 }}>
              {t.profile.noJarvis}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 18px' }}>
              {[...((user as any).jarvisBadges ?? [])].reverse().map((badgeName: string, i: number) => {
                const lvlData = JARVIS_LEVELS.find(l => l.name === badgeName);
                const badgeDates = (user as any).jarvisBadgeDates as Record<string, string> | null;
                const dateStr = badgeDates?.[badgeName];
                const colors: Record<string, string> = {
                  Beginner: '#8B92A8', Player: '#00B4D8', Fighter: '#00D68F',
                  Warrior: '#4CAF50', Expert: '#9B85FF', Master: '#F5C842',
                  Professional: '#FF9F43', Epic: '#FF6B6B', Legendary: '#E040FB', Mystic: '#F5C842',
                };
                const color = colors[badgeName] ?? '#9B85FF';
                return (
                  <div key={i} onClick={() => setSelectedBadge({ name: badgeName, date: dateStr })} style={{ background: 'linear-gradient(135deg,#1C2030,#13161F)', border: `1px solid ${color}40`, borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}18`, border: `2px solid ${color}60`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 22 }}>🤖</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color, marginBottom: 3 }}>{t.gameResult.jarvisCert}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F2F8' }}>{badgeName}</div>
                      <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 2 }}>{t.profile.level} {lvlData?.level ?? '?'} · +{((lvlData?.reward ?? 0) / 1000).toFixed(0)}K ᚙ</div>
                      {dateStr && (
                        <div style={{ fontSize: 10, color: '#4A5270', marginTop: 4 }}>
                          📅 {new Date(dateStr).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18 }}>✓</div>
                      <div style={{ fontSize: 9, color: '#4A5270', marginTop: 2 }}>{t.profile.passed}</div>
                    </div>
                  </div>
                );
              })}
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
                      color: lang === l ? '#0B0D11' : '#8B92A8',
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
                <div style={{ fontSize: 11, color: '#4A5270', marginTop: 3 }}>
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
      <div style={{ fontSize: 10, color: '#4A5270', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
};

const StatCard: React.FC<{ val: number; lbl: string; color?: string }> = ({ val, lbl, color }) => (
  <div style={{ background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 20, fontWeight: 800, color: color ?? '#F0F2F8' }}>{val}</div>
    <div style={{ fontSize: 10, color: '#4A5270', marginTop: 3, fontWeight: 500 }}>{lbl}</div>
  </div>
);

// Styles
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#4A5270', padding: '16px 18px 8px' };
const microLbl: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#4A5270', marginBottom: 3 };
const balCard: React.CSSProperties = { margin: '12px 18px 0', padding: '14px 18px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const ptabsStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', margin: '12px 18px 0', overflowX: 'auto' as any };
const ptab = (active: boolean): React.CSSProperties => ({ flex: '0 0 auto', textAlign: 'center', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: active ? '#F5C842' : '#8B92A8', cursor: 'pointer', border: 'none', borderBottom: `2px solid ${active ? '#F5C842' : 'transparent'}`, outline: 'none', background: 'none', fontFamily: 'inherit', transition: 'all .2s', whiteSpace: 'nowrap' } as any);
const stripStyle: React.CSSProperties = { margin: '4px 18px 0', padding: '13px 16px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 };
const tbaStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 11, background: '#1C2030', border: '1px solid rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: '#8B92A8' };
const secBtn: React.CSSProperties = { padding: '8px 14px', background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn: React.CSSProperties = { ...secBtn, background: 'transparent', color: '#8B92A8' };
const goldBtn: React.CSSProperties = { padding: '8px 14px', background: '#F5C842', color: '#0B0D11', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const tagGold: React.CSSProperties = { display: 'inline-flex', padding: '3px 8px', background: 'rgba(245,200,66,0.12)', color: '#F5C842', borderRadius: 6, fontSize: 10, fontWeight: 700 };
const tagVi: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const tagGr: React.CSSProperties = { ...tagGold, background: 'rgba(0,214,143,0.10)', color: '#00D68F' };
const tagRobot: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const avatarRingStyle: React.CSSProperties = { position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid #F5C842', opacity: .4, animation: 'ring-pulse 3s ease-in-out infinite' };
const settingCard: React.CSSProperties = { background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
