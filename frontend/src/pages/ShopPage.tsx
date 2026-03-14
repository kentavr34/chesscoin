import React, { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { shopApi, authApi } from '@/api';
import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';
import type { ShopItem, ItemType } from '@/types';

type Tab = 'frames' | 'boards' | 'pieces' | 'anims';

const TAB_TYPE: Record<Tab, ItemType> = {
  frames: 'AVATAR_FRAME',
  boards: 'BOARD_SKIN',
  pieces: 'PIECE_SKIN',
  anims: 'MOVE_ANIMATION',
};

const TAB_LABELS: Record<Tab, string> = {
  frames: 'Рамки',
  boards: 'Доски',
  pieces: 'Фигуры',
  anims: 'Анимации',
};

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#8B92A8',
  RARE: '#7B61FF',
  EPIC: '#F5C842',
  LEGENDARY: '#FF6B35',
};

const RARITY_LABEL: Record<string, string> = {
  COMMON: 'Обычный',
  RARE: 'Редкий',
  EPIC: 'Эпический',
  LEGENDARY: 'Легендарный',
};

export const ShopPage: React.FC = () => {
  const { user, setUser } = useUserStore();
  const [tab, setTab] = useState<Tab>('frames');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await shopApi.getItems(TAB_TYPE[tab]);
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handlePurchase = async (item: ShopItem) => {
    if (!confirm(`Купить «${item.name}» за ${fmtBalance(item.priceCoins)} ᚙ?`)) return;
    setActionId(item.id);
    try {
      const res = await shopApi.purchase(item.id);
      const updated = await authApi.me();
      setUser(updated);
      await loadItems();
      showToast(res.message);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleEquip = async (item: ShopItem) => {
    setActionId(item.id);
    try {
      const res = await shopApi.equip(item.id);
      await loadItems();
      showToast(res.message);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageLayout title="Магазин" backTo="/">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: '#232840', border: '1px solid #F5C842', borderRadius: 12,
          padding: '10px 20px', fontSize: 13, color: '#F5C842',
          zIndex: 9999, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Balance */}
      {user && (
        <div style={{ margin: '4px 18px 8px', padding: '10px 14px', background: '#1C2030', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#8B92A8' }}>Баланс</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#F5C842', fontFamily: 'JetBrains Mono, monospace' }}>
            {fmtBalance(user.balance)} ᚙ
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', margin: '0 18px 16px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8,
            fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
            color: tab === t ? '#F0F2F8' : '#8B92A8',
            background: tab === t ? '#232840' : 'transparent', cursor: 'pointer',
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Items grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#4A5270', fontSize: 13 }}>Загрузка...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#4A5270', fontSize: 13 }}>Нет предметов</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 18px 24px' }}>
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              loading={actionId === item.id}
              onPurchase={() => handlePurchase(item)}
              onEquip={() => handleEquip(item)}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
};

interface ItemCardProps {
  item: ShopItem;
  loading: boolean;
  onPurchase: () => void;
  onEquip: () => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, loading, onPurchase, onEquip }) => {
  const rarityColor = RARITY_COLOR[item.rarity] || '#8B92A8';
  const isEquipped = item.equipped;
  const isOwned = item.owned;

  return (
    <div style={{
      background: '#1C2030',
      border: `${isEquipped ? '2px' : '1px'} solid ${isEquipped ? '#F5C842' : `${rarityColor}33`}`,
      borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column',
      gap: 8, position: 'relative', overflow: 'hidden',
    }}>
      {/* Rarity glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)`,
        opacity: 0.6,
      }} />

      {/* Preview image */}
      <div style={{
        width: '100%', aspectRatio: '1',
        borderRadius: 12, overflow: 'hidden',
        background: '#13161E', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <span style={{ fontSize: 32, opacity: 0.4 }}>🎮</span>
        )}
      </div>

      {/* Name + rarity */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F2F8', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: rarityColor, marginTop: 2, fontWeight: 600 }}>
          {RARITY_LABEL[item.rarity] || item.rarity}
        </div>
      </div>

      {/* Action button */}
      {isEquipped ? (
        <div style={{ fontSize: 11, color: '#00D68F', fontWeight: 700, textAlign: 'center', padding: '4px 0' }}>
          ✓ Надето
        </div>
      ) : isOwned ? (
        <button
          onClick={onEquip}
          disabled={loading}
          style={{ ...btnStyle, background: '#7B61FF', color: '#fff' }}
        >
          {loading ? '...' : 'Надеть'}
        </button>
      ) : (
        <button
          onClick={onPurchase}
          disabled={loading}
          style={{ ...btnStyle, background: '#F5C842', color: '#0B0D11' }}
        >
          {loading ? '...' : `${fmtBalance(item.priceCoins)} ᚙ`}
        </button>
      )}
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '7px 10px', border: 'none', borderRadius: 10,
  fontSize: 11, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', width: '100%',
};
