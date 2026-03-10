import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { profileApi } from '@/api';
import { fmtBalance, fmtDate, leagueEmoji } from '@/utils/format';
import type { Transaction } from '@/types';

type Tab = 'info' | 'games' | 'saves' | 'ach';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('info');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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

  const rightAction = (
    <button style={tbaStyle}>⚙</button>
  );

  return (
    <PageLayout backTo="/" rightAction={rightAction}>
      {/* Шапка */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 18px 0' }}>
        <div onClick={() => navigate('/shop')} style={{ position: 'relative', marginBottom: 12, cursor: 'pointer' }}>
          <div style={avatarRingStyle} />
          <Avatar user={user} size="xl" gold />
        </div>
        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 18, fontWeight: 700, color: '#F0F2F8', letterSpacing: '-.02em', textAlign: 'center' }}>
          {user.firstName} {user.lastName ?? ''}
        </div>
        <div style={{ fontSize: 12, color: '#8B92A8', marginTop: 3 }}>@{user.username ?? 'unknown'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, justifyContent: 'center' }}>
          <span style={tagGold}>{leagueEmoji[user.league]} #1</span>
          <span style={tagVi}>ELO {user.elo}</span>
          <span style={tagGr}>🇷🇺 {user.nationRank ?? 'Участник'}</span>
        </div>
      </div>

      {/* Баланс */}
      <div style={balCard}>
        <div>
          <div style={microLbl}>Баланс</div>
          <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 22, fontWeight: 800, color: '#F5C842' }}>
            {fmtBalance(user.balance)} <span style={{ fontSize: 13, opacity: .5 }}>ᚙ</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => navigate('/shop')} style={secBtn}>🛍 Магазин</button>
          <button onClick={() => navigate('/referrals')} style={ghostBtn}>👥 Рефералы →</button>
        </div>
      </div>

      {/* Табы */}
      <div style={ptabsStyle}>
        {(['info', 'games', 'saves', 'ach'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={ptab(tab === t)}>
            {t === 'info' ? 'Инфо' : t === 'games' ? 'Игры' : t === 'saves' ? 'Сохранения' : 'Достижения'}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <>
          <div style={secStyle}>Статистика</div>
          {/* Круговые диаграммы */}
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 18px' }}>
            <CircStat value={wins} pct={winRate} color="#00D68F" label="Победы" />
            <CircStat value={losses} pct={lossRate} color="#FF4D6A" label="Поражения" />
            <CircStat value={draws} pct={drawRate} color="#9B85FF" label="Ничьи" />
          </div>

          {/* ELO-график заглушка */}
          <div style={{ margin: '0 18px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 12 }}>
            <div style={microLbl}>График ELO</div>
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
            <StatCard val={totalGames} lbl="Игр" />
            <StatCard val={user.elo} lbl="ELO" color="#9B85FF" />
            <StatCard val={user.winStreak ?? 0} lbl="Серия" color="#F5C842" />
          </div>

          <div style={secStyle}>Рефералы</div>
          <div style={{ margin: '0 18px', padding: 14, background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F2F8' }}>Реферальная ссылка</div>
              <div style={{ fontSize: 10, color: '#4A5270', fontFamily: "'JetBrains Mono',monospace", marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                t.me/chessgamecoin_bot?start=ref_{user.telegramId}
              </div>
            </div>
            <button style={goldBtn}>Пригласить</button>
          </div>
        </>
      )}

      {tab === 'games' && (
        <>
          <div style={secStyle}>История транзакций</div>
          {transactions.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', padding: 32 }}>Нет транзакций</div>
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

      {tab === 'saves' && (
        <>
          <div style={secStyle}>Сохранённые партии</div>
          <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 13 }}>
            Нет сохранённых партий
          </div>
        </>
      )}

      {tab === 'ach' && (
        <>
          <div style={secStyle}>Достижения</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '0 18px' }}>
            {[
              { ico: '💎', lbl: 'Алмаз #1', gold: true },
              { ico: '⚔️', lbl: 'Воин', gold: false },
              { ico: '🏆', lbl: 'Победитель', gold: false },
              { ico: '👑', lbl: 'Офицер', gold: true },
            ].map((a) => (
              <div key={a.lbl} style={{ background: '#1C2030', border: `1px solid ${a.gold ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 12, textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 28 }}>{a.ico}</div>
                <div style={{ fontSize: 10, color: a.gold ? '#F5C842' : '#8B92A8', fontWeight: a.gold ? 700 : 600, marginTop: 4 }}>{a.lbl}</div>
              </div>
            ))}
          </div>
        </>
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

// styles
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#4A5270', padding: '16px 18px 8px' };
const microLbl: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#4A5270', marginBottom: 3 };
const balCard: React.CSSProperties = { margin: '12px 18px 0', padding: '14px 18px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const ptabsStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', margin: '12px 18px 0' };
const ptab = (active: boolean): React.CSSProperties => ({ flex: 1, textAlign: 'center', padding: '10px 0', fontSize: 11, fontWeight: 600, color: active ? '#F5C842' : '#8B92A8', cursor: 'pointer', borderBottom: `2px solid ${active ? '#F5C842' : 'transparent'}`, background: 'none', fontFamily: 'inherit', transition: 'all .2s' } as any);
const stripStyle: React.CSSProperties = { margin: '4px 18px 0', padding: '13px 16px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12 };
const tbaStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 11, background: '#1C2030', border: '1px solid rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', color: '#8B92A8' };
const secBtn: React.CSSProperties = { padding: '8px 14px', background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn: React.CSSProperties = { ...secBtn, background: 'transparent', color: '#8B92A8' };
const goldBtn: React.CSSProperties = { padding: '8px 14px', background: '#F5C842', color: '#0B0D11', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const tagGold: React.CSSProperties = { display: 'inline-flex', padding: '3px 8px', background: 'rgba(245,200,66,0.12)', color: '#F5C842', borderRadius: 6, fontSize: 10, fontWeight: 700 };
const tagVi: React.CSSProperties = { ...tagGold, background: 'rgba(123,97,255,0.12)', color: '#9B85FF' };
const tagGr: React.CSSProperties = { ...tagGold, background: 'rgba(0,214,143,0.10)', color: '#00D68F' };
const avatarRingStyle: React.CSSProperties = { position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid #F5C842', opacity: .4, animation: 'ring-pulse 3s ease-in-out infinite' };
