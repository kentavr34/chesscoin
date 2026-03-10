import React, { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { useUserStore } from '@/store/useUserStore';
import { nationsApi } from '@/api';
import type { Nation } from '@/types';

export const NationsPage: React.FC = () => {
  const { user } = useUserStore();
  const [nations, setNations] = useState<Nation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    nationsApi.list().then((r) => setNations(r.clans)).finally(() => setLoading(false));
  }, []);

  const myNation = nations.find((n) => n.id === user?.nationId);

  const handleJoin = async (clanId: string) => {
    try {
      await nationsApi.join(clanId);
      const { authApi } = await import('@/api');
      const updated = await authApi.me();
      useUserStore.getState().setUser(updated);
      const list = await nationsApi.list();
      setNations(list.clans);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <PageLayout title="Сборные" backTo="/">
      {/* Моя сборная */}
      {myNation && (
        <div style={clanHeroStyle}>
          <span style={{ fontSize: 36, marginBottom: 8, display: 'block' }}>{myNation.flag}</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F2F8' }}>{myNation.name}</div>
          <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 4 }}>
            {user?.nationRank ?? 'Участник'} · {myNation._count?.members ?? myNation.memberCount ?? 0} игроков
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
            <Stat val={myNation.wins ?? 0} lbl="Побед" color="#00D68F" />
            <Stat val={myNation.losses ?? 0} lbl="Поражений" color="#FF4D6A" />
            <Stat val={`${myNation.elo ?? myNation.avgElo ?? 1000}`} lbl="ELO" color="#F5C842" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button style={secBtn}>Казна</button>
            <button style={secBtn}>Участники</button>
            <button style={{ ...goldBtn, marginLeft: 'auto' }}>⚔ В бой!</button>
          </div>
        </div>
      )}

      {/* Война */}
      <div style={{ margin: '6px 18px 0', padding: '13px 16px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18 }}>
        <div style={secLbl}>Текущая война</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🇷🇺</span>
          <span style={{ fontSize: 14, color: '#4A5270', margin: '0 4px' }}>⚔</span>
          <span style={{ fontSize: 20 }}>🇧🇷</span>
          <div style={{ flex: 1, marginLeft: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>Война с Бразилией</div>
            <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>Осталось 8 дней · Раунд 3/5</div>
          </div>
          <span style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 14, fontWeight: 800, color: '#F5C842' }}>3:1</span>
        </div>
        <div style={{ height: 6, background: '#181B22', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: '75%', background: '#00D68F', borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={tagGr}>🇷🇺 3 победы</span>
          <span style={tagRd}>🇧🇷 1 победа</span>
        </div>
      </div>

      <div style={secStyle}>Рейтинг сборных</div>
      {loading && <div style={{ textAlign: 'center', color: '#4A5270', padding: 24 }}>Загрузка...</div>}
      {nations.map((n, i) => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? '#F5C842' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#4A5270', width: 18 }}>{i + 1}</span>
          <span style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{n.flag}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{n.name}</div>
            <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>
              {n._count?.members ?? n.memberCount ?? 0} игроков · ELO {n.elo ?? n.avgElo ?? 1000}
            </div>
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#8B92A8' }}>
            {n.elo ?? n.avgElo ?? 1000}
          </span>
          {n.id !== user?.nationId && (
            <button onClick={() => handleJoin(n.id)} style={{ ...goldBtn, marginLeft: 8 }}>Вступить</button>
          )}
        </div>
      ))}
    </PageLayout>
  );
};

const Stat: React.FC<{ val: string | number; lbl: string; color: string }> = ({ val, lbl, color }) => (
  <div>
    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 20, fontWeight: 800, color }}>{val}</div>
    <div style={{ fontSize: 10, color: '#4A5270', marginTop: 2 }}>{lbl}</div>
  </div>
);

const clanHeroStyle: React.CSSProperties = {
  margin: '6px 18px', padding: 20,
  background: 'linear-gradient(135deg,#1A2015,#101A12)',
  border: '1px solid rgba(0,214,143,0.15)', borderRadius: 22,
  position: 'relative', overflow: 'hidden',
};
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#4A5270', padding: '16px 18px 8px' };
const secLbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#4A5270', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 };
const secBtn: React.CSSProperties = { padding: '8px 14px', background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const goldBtn: React.CSSProperties = { padding: '8px 14px', background: '#F5C842', color: '#0B0D11', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const tagGr: React.CSSProperties = { display: 'inline-flex', padding: '3px 8px', background: 'rgba(0,214,143,0.10)', color: '#00D68F', borderRadius: 6, fontSize: 10, fontWeight: 700 };
const tagRd: React.CSSProperties = { ...tagGr, background: 'rgba(255,77,106,0.10)', color: '#FF4D6A' };
