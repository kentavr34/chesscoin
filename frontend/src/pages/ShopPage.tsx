import React, { useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { shopApi, authApi } from '@/api';
import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';

type Tab = 'skins' | 'avatars' | 'coins' | 'themes';

const SKINS = [
  { id: 'classic', name: 'Классика', active: true, price: null, colors: ['#E8EDF9', '#B7C0D8'] },
  { id: 'space', name: 'Тёмный космос', active: false, price: '15000', colors: ['#2A1A5A', '#1A0A3A'] },
  { id: 'forest', name: 'Лес', active: false, price: '20000', colors: ['#2A4A1A', '#1A3A0A'] },
  { id: 'ocean', name: 'Океан', active: false, price: '20000', colors: ['#1A3A5A', '#0A2A4A'] },
];

const THEMES = [
  { id: 'dark', name: 'Тёмная', ico: '🌑', active: true, price: null },
  { id: 'light', name: 'Светлая', ico: '☀️', active: false, price: '20000' },
  { id: 'violet', name: 'Неон Виолет', ico: '🔮', active: false, price: '35000' },
  { id: 'emerald', name: 'Изумруд', ico: '🌿', active: false, price: '35000' },
];

export const ShopPage: React.FC = () => {
  const { user, setUser } = useUserStore();
  const [tab, setTab] = useState<Tab>('skins');

  const handleBuySkin = async (skinId: string, price: string) => {
    if (!confirm(`Купить скин за ${fmtBalance(price)} ᚙ?`)) return;
    try {
      await shopApi.purchase(skinId);
      const updated = await authApi.me();
      setUser(updated);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <PageLayout title="Магазин" backTo="/">
      <div style={segStyle}>
        {(['skins', 'avatars', 'coins', 'themes'] as Tab[]).map((t) => (
          <button key={t} style={segBtn(tab === t)} onClick={() => setTab(t)}>
            {t === 'skins' ? 'Скины' : t === 'avatars' ? 'Аватары' : t === 'coins' ? 'Монеты' : 'Темы'}
          </button>
        ))}
      </div>

      {tab === 'skins' && (
        <>
          <div style={secStyle}>Скины доски</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 18px' }}>
            {SKINS.map((skin) => (
              <div key={skin.id} style={{ background: '#1C2030', border: `${skin.active ? '2px' : '1px'} solid ${skin.active ? '#F5C842' : 'rgba(255,255,255,0.07)'}`, borderRadius: 18, padding: 14, textAlign: 'center', cursor: 'pointer' }}>
                {/* Миниатюра */}
                <div style={{ width: '100%', aspectRatio: '1', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} style={{ background: (Math.floor(i / 4) + i) % 2 === 0 ? skin.colors[0] : skin.colors[1] }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F2F8' }}>{skin.name}</div>
                {skin.active
                  ? <div style={{ fontSize: 11, color: '#00D68F', marginTop: 2 }}>Активен</div>
                  : <button onClick={() => handleBuySkin(skin.id, skin.price!)} style={buySmallBtn}>
                      {fmtBalance(skin.price!)} ᚙ
                    </button>
                }
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'avatars' && (
        <>
          <div style={secStyle}>Аватарки</div>
          <div style={{ padding: '0 18px', fontSize: 13, color: '#8B92A8' }}>Раздел в разработке</div>
        </>
      )}

      {tab === 'coins' && (
        <>
          <div style={secStyle}>P2P Биржа</div>
          <div style={{ margin: '0 18px', padding: 16, background: 'linear-gradient(135deg,rgba(0,214,143,.06),transparent)', border: '1px solid rgba(0,214,143,.15)', borderRadius: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#00D68F', marginBottom: 4 }}>Купить / Продать ᚙ</div>
            <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 14 }}>Торгуй монетами. Комиссия 0.5%</div>
            {user && (
              <div style={{ fontSize: 13, color: '#8B92A8', marginBottom: 14 }}>
                Ваш баланс: <span style={{ color: '#F5C842', fontWeight: 700 }}>{fmtBalance(user.balance)} ᚙ</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...goldBtn, flex: 1 }}>Купить ᚙ</button>
              <button style={{ ...secBtn, flex: 1 }}>Продать ᚙ</button>
            </div>
          </div>
        </>
      )}

      {tab === 'themes' && (
        <>
          <div style={secStyle}>Глобальные темы</div>
          <div style={{ padding: '0 18px 8px', fontSize: 11, color: '#8B92A8' }}>🎨 Тема меняет весь интерфейс приложения</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 18px' }}>
            {THEMES.map((theme) => (
              <div key={theme.id} style={{ background: '#1C2030', border: `${theme.active ? '2px' : '1px'} solid ${theme.active ? '#F5C842' : 'rgba(255,255,255,0.07)'}`, borderRadius: 18, padding: 14, textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{theme.ico}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F2F8' }}>{theme.name}</div>
                {theme.active
                  ? <div style={{ fontSize: 11, color: '#00D68F', marginTop: 2 }}>Активна</div>
                  : <div style={{ fontSize: 11, color: '#F5C842', marginTop: 2 }}>{fmtBalance(theme.price!)} ᚙ</div>
                }
              </div>
            ))}
          </div>
        </>
      )}
    </PageLayout>
  );
};

const segStyle: React.CSSProperties = { display: 'flex', margin: '4px 18px 4px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3 };
const segBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: 8, border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: active ? '#F0F2F8' : '#8B92A8', background: active ? '#232840' : 'transparent', cursor: 'pointer' });
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#4A5270', padding: '16px 18px 8px' };
const goldBtn: React.CSSProperties = { padding: '10px 18px', background: '#F5C842', color: '#0B0D11', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const secBtn: React.CSSProperties = { padding: '10px 18px', background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const buySmallBtn: React.CSSProperties = { marginTop: 6, padding: '5px 12px', background: '#F5C842', color: '#0B0D11', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
