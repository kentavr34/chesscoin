// ─────────────────────────────────────────────────────────────────────────────
// ShopItemCards.tsx — переиспользуемые карточки товаров магазина
// Выделено из ShopPage.tsx (R3: декомпозиция)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect } from 'react';
import { useT } from '@/i18n/useT';
import { fmtBalance } from '@/utils/format';
import type { ShopItem } from '@/types';

export const RARITY_COLOR: Record<string, string> = {
  COMMON:    'var(--text-secondary, #8B92A8)',
  RARE:      '#7B61FF',
  EPIC:      'var(--accent, #F5C842)',
  LEGENDARY: '#FF6B35',
};

const btnStyle: React.CSSProperties = {
  padding: '7px 10px', border: 'none', borderRadius: 10,
  fontSize: 11, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', width: '100%',
};

const BoardPreview: React.FC<{ light: string; dark: string }> = ({ light, dark }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden' }}>
    {Array.from({ length: 16 }, (_, i) => {
      const isLight = (Math.floor(i / 4) + (i % 4)) % 2 === 0;
      return <div key={i} style={{ background: isLight ? light : dark }} />;
    })}
  </div>
);

const PiecePreview: React.FC<{ name: string }> = ({ name }) => {
  const filters: Record<string, string> = {
    'Golden pieces':      'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)',
    'Золотые фигуры':     'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.1)',
    'Crystal pieces':     'brightness(1.3) saturate(0.3) hue-rotate(180deg)',
    'Кристальные фигуры': 'brightness(1.3) saturate(0.3) hue-rotate(180deg)',
    'Silver pieces':      'grayscale(1) brightness(1.4)',
    'Серебряные фигуры':  'grayscale(1) brightness(1.4)',
    'Neon pieces':        'brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(80deg)',
    'Неоновые фигуры':    'brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(80deg)',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', aspectRatio: '1', background: 'var(--bg,#0B0D11)', borderRadius: 10, gap: 2 }}>
      {['♔', '♕', '♖'].map((p, i) => <span key={i} style={{ filter: filters[name] ?? 'none', fontSize: 22 }}>{p}</span>)}
    </div>
  );
};

const PieceSetPreview: React.FC<{ name: string }> = ({ name }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', aspectRatio: '1', background: 'linear-gradient(135deg,#0D0F1A,#151828)', borderRadius: 10, flexWrap: 'wrap', gap: 2, padding: 6 }}>
    {['♔', '♕', '♗', '♘'].map((p, i) => <span key={i} style={{ fontSize: 20, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>{p}</span>)}
    <span style={{ fontSize: 9, color: 'var(--text-muted,#4A5270)', width: '100%', textAlign: 'center' }}>{name}</span>
  </div>
);

export const BOARD_KNOWN: Record<string, [string, string]> = {
  'Классика': ['#F0D9B5','#B58863'], 'Classic': ['#F0D9B5','#B58863'],
  'ChessCoin': ['#EDF1FB','#8B9DD4'],
  'Мрамор': ['#E8E0D8','#8C7B6B'], 'Marble': ['#E8E0D8','#8C7B6B'],
  'Золото': ['#F5E6A0','#C8960A'], 'Gold': ['#F5E6A0','#C8960A'],
  'Ночь': ['#1C1C2E','#0D0D1A'], 'Night': ['#1C1C2E','#0D0D1A'],
  'Малахит': ['#A8D5A2','#3A7A34'], 'Malachite': ['#A8D5A2','#3A7A34'],
  'Неон': ['#0D1F2D','#071520'], 'Neon': ['#0D1F2D','#071520'],
  'Лёд': ['#D8EEF8','#6090B8'], 'Ice': ['#D8EEF8','#6090B8'],
};

// ── ItemCard ──────────────────────────────────────────────────
interface ItemCardProps {
  item: ShopItem;
  loading: boolean;
  highlighted?: boolean;
  onPurchase: () => void;
  onEquip: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, loading, highlighted, onPurchase, onEquip }) => {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const rarityColor = RARITY_COLOR[item.rarity] ?? 'var(--text-secondary, #8B92A8)';

  useEffect(() => {
    if (highlighted && cardRef.current)
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [highlighted]);

  const [imgError, setImgError] = React.useState(false);
  const renderPreview = () => {
    if (item.imageUrl && !imgError) return <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" onError={() => setImgError(true)} />;
    if (item.type === 'BOARD_SKIN') { const c = BOARD_KNOWN[item.name] ?? ['#E8EDF9','#8B9DD4']; return <BoardPreview light={c[0]} dark={c[1]} />; }
    if (item.type === 'PIECE_SKIN') return <PiecePreview name={item.name} />;
    if (item.type === 'PIECE_SET')  return <PieceSetPreview name={item.name} />;
    if (item.type === 'AVATAR_FRAME') return <span style={{ fontSize: 36, opacity: 0.6 }}>🖼</span>;
    if (item.type === 'MOVE_ANIMATION') return <span style={{ fontSize: 36, opacity: 0.6 }}>✨</span>;
    if (item.type === 'WIN_ANIMATION') return <span style={{ fontSize: 36, opacity: 0.6 }}>🎉</span>;
    if (item.type === 'CAPTURE_EFFECT') return <span style={{ fontSize: 36, opacity: 0.6 }}>💥</span>;
    if (item.type === 'SPECIAL_MOVE') return <span style={{ fontSize: 36, opacity: 0.6 }}>⚡</span>;
    if (item.type === 'THEME') return <span style={{ fontSize: 36, opacity: 0.6 }}>🎨</span>;
    if (item.type === 'FONT') {
      const fontMapping: Record<string, string> = {
        'Inter': "'Inter', sans-serif",
        'Roboto': "'Roboto', sans-serif",
        'Montserrat': "'Montserrat', sans-serif",
        'Playfair Display': "'Playfair Display', serif",
        'Comic Sans MS': "'Comic Sans MS', 'Comic Sans', cursive",
        'JetBrains Mono': "'JetBrains Mono', monospace",
      };
      const cssFont = fontMapping[item.name] || "'Inter', sans-serif";
      return <span style={{ fontSize: 40, fontFamily: cssFont }}>Aa</span>;
    }
    return <span style={{ fontSize: 32, opacity: 0.4 }}>🎮</span>;
  };

  return (
    <div ref={cardRef} style={{ background: 'var(--bg-card, #1C2030)', border: `${item.equipped || highlighted ? '2px' : '1px'} solid ${highlighted ? '#00D68F' : item.equipped ? 'var(--accent, #F5C842)' : `${rarityColor}33`}`, borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden', animation: highlighted ? 'highlightPulse 1.5s ease-in-out 2' : undefined }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)`, opacity: 0.6 }} />
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-card, #13161E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderPreview()}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: rarityColor, marginTop: 2, fontWeight: 600 }}>{(t.shop.rarity as Record<string,string>)[item.rarity] ?? item.rarity}</div>
      </div>
      {item.equipped ? (
        <div style={{ fontSize: 11, color: 'var(--green, #00D68F)', fontWeight: 700, textAlign: 'center', padding: '5px 8px', background: 'rgba(0,214,143,0.08)', borderRadius: 8, border: '1px solid rgba(0,214,143,0.2)' }}>✓ {t.shop.equipped ?? 'Equipped'}</div>
      ) : item.owned ? (
        <button onClick={onEquip} disabled={loading} style={{ ...btnStyle, background: '#7B61FF', color: '#fff' }}>{loading ? '...' : t.shop.equip}</button>
      ) : (
        <button onClick={onPurchase} disabled={loading} style={{ ...btnStyle, background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)' }}>{loading ? '...' : `${fmtBalance(item.priceCoins)} ᚙ`}</button>
      )}
    </div>
  );
};

// ── AvatarItemCard ────────────────────────────────────────────
interface AvatarItemCardProps {
  item: ShopItem;
  loading: boolean;
  highlighted?: boolean;
  onPurchase: () => void;
  onEquip: () => void;
  onUnequip: () => void;
}

export const AvatarItemCard: React.FC<AvatarItemCardProps> = ({ item, loading, highlighted, onPurchase, onEquip, onUnequip }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const rarityColor = RARITY_COLOR[item.rarity] ?? 'var(--text-secondary, #8B92A8)';
  const [imgError, setImgError] = React.useState(false);

  useEffect(() => {
    if (highlighted && cardRef.current)
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [highlighted]);

  return (
    <div ref={cardRef} style={{ background: 'var(--bg-card, #1C2030)', border: `${item.equipped || highlighted ? '2px' : '1px'} solid ${highlighted ? '#00D68F' : item.equipped ? 'var(--accent, #F5C842)' : `${rarityColor}44`}`, borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden', animation: highlighted ? 'highlightPulse 1.5s ease-in-out 2' : undefined }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)`, opacity: 0.7 }} />
      {item.equipped && <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--accent, #F5C842)', color: '#000', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6 }}>ACTIVE</div>}
      <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
        <div style={{ width: '80%', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${item.equipped ? 'var(--accent, #F5C842)' : `${rarityColor}66`}`, boxShadow: item.equipped ? `0 0 12px ${rarityColor}66` : undefined }}>
          {item.imageUrl && !imgError
            ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" onError={() => setImgError(true)} />
            : <div style={{ width: '100%', height: '100%', background: 'var(--bg-card,#13161E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, opacity: 0.4 }}>👤</div>
          }
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: rarityColor, marginTop: 2, fontWeight: 600 }}>
          {item.rarity === 'COMMON' ? 'Common' : item.rarity === 'RARE' ? 'Rare' : item.rarity === 'EPIC' ? 'Epic' : 'Legendary'}
        </div>
      </div>
      {item.equipped ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--green, #00D68F)', fontWeight: 700, textAlign: 'center', padding: '3px 0' }}>✓ Equipped</div>
          <button onClick={onUnequip} disabled={loading} style={{ ...btnStyle, background: 'rgba(255,77,106,0.12)', color: 'var(--red, #FF4D6A)', border: '1px solid rgba(255,77,106,0.25)' }}>{loading ? '...' : 'Unequip'}</button>
        </div>
      ) : item.owned ? (
        <button onClick={onEquip} disabled={loading} style={{ ...btnStyle, background: 'linear-gradient(135deg,#7B61FF,#9B85FF)', color: '#fff' }}>{loading ? '...' : '✨ Equip'}</button>
      ) : (
        <button onClick={onPurchase} disabled={loading} style={{ ...btnStyle, background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)' }}>{loading ? '...' : `${fmtBalance(item.priceCoins)} ᚙ`}</button>
      )}
    </div>
  );
};
