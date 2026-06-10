// ─────────────────────────────────────────────────────────────────────────────
// ShopItemCards.tsx — переиспользуемые карточки товаров магазина
// Выделено из ShopPage.tsx (R3: декомпозиция)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect } from 'react';
import { useT } from '@/i18n/useT';
import { fmtBalance } from '@/utils/format';
import type { ShopItem } from '@/types';
import { IcoBolt, IcoCamera, IcoGamepad, IcoMedal, IcoSettings, IcoUsers } from '@/components/icons/UiIcons';

export const RARITY_COLOR: Record<string, string> = {
  COMMON:    'var(--color-text-secondary, #8B92A8)',
  RARE:      'var(--color-purple-dark, #7B61FF)',
  EPIC:      'var(--color-accent, #F5C842)',
  LEGENDARY: 'var(--color-orange-red, #FF6B35)',
};

// «Дорогой вид» (Кенан 2026-06-10): glow-тени и градиентные подложки по rarity.
// COMMON — без glow (обычный товар), выше — нарастающее свечение.
const RARITY_GLOW: Record<string, { boxShadow: string; previewGlow: string }> = {
  COMMON: {
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    previewGlow: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.05), transparent 60%)',
  },
  RARE: {
    boxShadow: '0 2px 10px rgba(0,0,0,0.35), 0 0 14px rgba(123,97,255,0.22)',
    previewGlow: 'radial-gradient(circle at 32% 28%, rgba(123,97,255,0.12), transparent 60%)',
  },
  EPIC: {
    boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 0 18px rgba(245,200,66,0.10), 0 0 18px rgba(245,200,66,0.28)',
    previewGlow: 'radial-gradient(circle at 32% 28%, rgba(245,200,66,0.14), transparent 60%)',
  },
  LEGENDARY: {
    boxShadow: '0 2px 12px rgba(0,0,0,0.4), inset 0 0 22px rgba(255,107,53,0.12), 0 0 24px rgba(255,107,53,0.32)',
    previewGlow: 'radial-gradient(circle at 32% 28%, rgba(255,107,53,0.16), transparent 60%)',
  },
};

// CSS для hover/shine — инлайн-стили не умеют :hover, поэтому классы.
// Вставляется один раз на страницу через <ShopCardStyles/>.
export const ShopCardStyles: React.FC = () => (
  <style>{`
    .shop-card { transition: transform .18s ease-out, box-shadow .18s ease-out, border-color .18s ease-out; }
    .shop-card:hover { transform: translateY(-3px); }
    .shop-card-rare:hover { box-shadow: 0 6px 18px rgba(0,0,0,.45), 0 0 22px rgba(123,97,255,.4) !important; }
    .shop-card-epic:hover { box-shadow: 0 6px 18px rgba(0,0,0,.45), inset 0 0 18px rgba(245,200,66,.14), 0 0 28px rgba(245,200,66,.45) !important; }
    .shop-card-legendary:hover { box-shadow: 0 6px 20px rgba(0,0,0,.5), inset 0 0 24px rgba(255,107,53,.16), 0 0 34px rgba(255,107,53,.5) !important; }
    .shop-card-common:hover { box-shadow: 0 6px 16px rgba(0,0,0,.45) !important; }
    @keyframes shop-shine {
      0% { transform: translateX(-130%) skewX(-18deg); }
      55%, 100% { transform: translateX(230%) skewX(-18deg); }
    }
    .shop-shine { position: absolute; top: 0; bottom: 0; width: 38%; pointer-events: none;
      background: linear-gradient(100deg, transparent, rgba(255,235,200,0.10), transparent);
      animation: shop-shine 3.4s ease-in-out infinite; }
  `}</style>
);

const btnStyle: React.CSSProperties = {
  padding: 'var(--shop-btn-padding)', border: 'none', borderRadius: 10,
  fontSize: 'var(--shop-btn-font-size)', fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', width: '100%',
};

// Helper function to extract board colors from CSS variables
function getBoardColorsFromCSS(board: string): [string, string] {
  const vars = window.getComputedStyle(document.documentElement);
  const boardKey = board.toLowerCase()
    .replace('классика', 'classic')
    .replace('мрамор', 'marble')
    .replace('золото', 'gold')
    .replace('ночь', 'night')
    .replace('малахит', 'malachite')
    .replace('неон', 'neon')
    .replace('лёд', 'ice');

  const light = vars.getPropertyValue(`--shop-board-${boardKey}-light`).trim();
  const dark = vars.getPropertyValue(`--shop-board-${boardKey}-dark`).trim();
  return [light || '#E8EDF9', dark || '#8B9DD4'];
}

const BoardPreview: React.FC<{ light: string; dark: string }> = ({ light, dark }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'var(--shop-board-grid-columns)',
    width: '100%',
    aspectRatio: '1',
    borderRadius: 10,
    overflow: 'hidden',
  }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', aspectRatio: '1', background: 'var(--color-bg-dark, #0B0D11)', borderRadius: 10, gap: 2 }}>
      {['♔', '♕', '♖'].map((p, i) => <span key={i} style={{ filter: filters[name] ?? 'none', fontSize: 22 }}>{p}</span>)}
    </div>
  );
};

const PieceSetPreview: React.FC<{ name: string }> = ({ name }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', aspectRatio: '1', background: 'var(--shop-pieceset-gradient, linear-gradient(135deg,var(--color-bg-dark, #0D0F1A),#151828))', borderRadius: 10, flexWrap: 'wrap', gap: 2, padding: 6 }}>
    {['♔', '♕', '♗', '♘'].map((p, i) => <span key={i} style={{ fontSize: 20, filter: 'var(--shop-pieceset-shadow, drop-shadow(0 1px 3px rgba(0,0,0,0.5)))' }}>{p}</span>)}
    <span style={{ fontSize: 9, color: 'var(--color-text-muted,#4A5270)', width: '100%', textAlign: 'center' }}>{name}</span>
  </div>
);

export const BOARD_KNOWN: Record<string, [string, string]> = {
  'Классика': getBoardColorsFromCSS('classic'), 'Classic': getBoardColorsFromCSS('classic'),
  'ChessCoin': getBoardColorsFromCSS('chesscoin'),
  'Мрамор': getBoardColorsFromCSS('marble'), 'Marble': getBoardColorsFromCSS('marble'),
  'Золото': getBoardColorsFromCSS('gold'), 'Gold': getBoardColorsFromCSS('gold'),
  'Ночь': getBoardColorsFromCSS('night'), 'Night': getBoardColorsFromCSS('night'),
  'Малахит': getBoardColorsFromCSS('malachite'), 'Malachite': getBoardColorsFromCSS('malachite'),
  'Неон': getBoardColorsFromCSS('neon'), 'Neon': getBoardColorsFromCSS('neon'),
  'Лёд': getBoardColorsFromCSS('ice'), 'Ice': getBoardColorsFromCSS('ice'),
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
  const rarityColor = RARITY_COLOR[item.rarity] ?? 'var(--color-text-secondary, #8B92A8)';

  useEffect(() => {
    if (highlighted && cardRef.current)
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [highlighted]);

  const [imgError, setImgError] = React.useState(false);
  const renderPreview = () => {
    const fallbackBoardColors = getBoardColorsFromCSS('chesscoin');
    if (item.imageUrl && !imgError) return <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" onError={() => setImgError(true)} />;
    if (item.type === 'BOARD_SKIN') { const c = BOARD_KNOWN[item.name] ?? fallbackBoardColors; return <BoardPreview light={c[0]} dark={c[1]} />; }
    if (item.type === 'PIECE_SKIN') return <PiecePreview name={item.name} />;
    if (item.type === 'PIECE_SET')  return <PieceSetPreview name={item.name} />;
    const previewIcon = (Icon: React.FC<{ size?: number; color?: string }>) =>
      <span style={{ opacity: 0.6, color: rarityColor }}><Icon size={36} /></span>;
    if (item.type === 'AVATAR_FRAME') return previewIcon(IcoCamera);
    if (item.type === 'MOVE_ANIMATION') return previewIcon(IcoBolt);
    if (item.type === 'WIN_ANIMATION') return previewIcon(IcoMedal);
    if (item.type === 'CAPTURE_EFFECT') return previewIcon(IcoBolt);
    if (item.type === 'SPECIAL_MOVE') return previewIcon(IcoBolt);
    if (item.type === 'THEME') return previewIcon(IcoSettings);
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
    return <span style={{ opacity: 0.4 }}><IcoGamepad size={32} /></span>;
  };

  // A3 (Кенан 2026-05-19): фон карточек захардкожен на гарантированно
  // тёмный градиент. 2026-06-10: + rarity-glow, hover, shine для LEGENDARY —
  // «дорогой вид» товаров (запрос Кенана: магазин выглядел дёшево).
  const cardBg = 'linear-gradient(135deg, #141018 0%, #0F0E18 100%)';
  const previewBg = '#0B0D11';
  const glow = RARITY_GLOW[item.rarity] ?? RARITY_GLOW.COMMON;

  return (
    <div ref={cardRef} className={`shop-card shop-card-${item.rarity.toLowerCase()}`} style={{ background: cardBg, border: `${item.equipped || highlighted ? '2px' : '1px'} solid ${highlighted ? '#3DBA7A' : item.equipped ? '#F0C85A' : `${rarityColor}66`}`, borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden', boxShadow: glow.boxShadow, animation: highlighted ? 'highlightPulse 1.5s ease-in-out 2' : undefined }}>
      {/* Rarity-полоса сверху — усилена (3px + свечение) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)`, filter: `drop-shadow(0 0 5px ${rarityColor})` }} />
      {/* Shine-блик для LEGENDARY — медленный проблеск как на витрине */}
      {item.rarity === 'LEGENDARY' && <div className="shop-shine" />}
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: `${glow.previewGlow}, ${previewBg}`, border: `1px solid ${rarityColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderPreview()}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#EAE2CC', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: rarityColor, marginTop: 2, fontWeight: 600 }}>{(t.shop.rarity as Record<string,string>)[item.rarity] ?? item.rarity}</div>
      </div>
      {item.equipped ? (
        <div style={{ fontSize: 11, color: '#3DBA7A', fontWeight: 700, textAlign: 'center', padding: '5px 8px', background: 'rgba(61,186,122,0.10)', borderRadius: 8, border: '1px solid rgba(61,186,122,0.30)' }}>✓ {t.shop.equipped ?? 'Equipped'}</div>
      ) : item.owned ? (
        <button onClick={onEquip} disabled={loading} style={{ ...btnStyle, background: 'linear-gradient(135deg,#7B61FF,#9B85FF)', color: '#fff' }}>{loading ? '...' : t.shop.equip}</button>
      ) : (
        <button onClick={onPurchase} disabled={loading} style={{ ...btnStyle, background: 'linear-gradient(135deg,#F0C85A,#D4A843)', color: '#1A1208' }}>{loading ? '...' : `${fmtBalance(item.priceCoins)}`}</button>
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
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const rarityColor = RARITY_COLOR[item.rarity] ?? 'var(--color-text-secondary, #8B92A8)';
  const [imgError, setImgError] = React.useState(false);

  useEffect(() => {
    if (highlighted && cardRef.current)
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [highlighted]);

  // 2026-06-10: rarity-glow + shine — синхронно с ItemCard («дорогой вид»).
  const glow = RARITY_GLOW[item.rarity] ?? RARITY_GLOW.COMMON;

  return (
    <div ref={cardRef} className={`shop-card shop-card-${item.rarity.toLowerCase()}`} style={{ background: 'linear-gradient(135deg, #141018 0%, #0F0E18 100%)', border: `${item.equipped || highlighted ? '2px' : '1px'} solid ${highlighted ? '#3DBA7A' : item.equipped ? '#F0C85A' : `${rarityColor}66`}`, borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden', boxShadow: glow.boxShadow, animation: highlighted ? 'highlightPulse 1.5s ease-in-out 2' : undefined }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)`, filter: `drop-shadow(0 0 5px ${rarityColor})` }} />
      {item.rarity === 'LEGENDARY' && <div className="shop-shine" />}
      {item.equipped && <div style={{ position: 'absolute', top: 8, right: 8, background: '#F0C85A', color: '#1A1208', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, zIndex: 1 }}>ACTIVE</div>}
      <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, background: glow.previewGlow, borderRadius: 12 }}>
        <div style={{ width: '86%', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${item.equipped ? '#F0C85A' : `${rarityColor}88`}`, boxShadow: item.equipped ? `0 0 14px ${rarityColor}88` : `0 0 10px ${rarityColor}33` }}>
          {item.imageUrl && !imgError
            ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" onError={() => setImgError(true)} />
            : <div style={{ width: '100%', height: '100%', background: '#0B0D11', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A5248' }}><IcoUsers size={32} /></div>
          }
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#EAE2CC', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: rarityColor, marginTop: 2, fontWeight: 600 }}>
          {(t.shop.rarity as Record<string,string>)[item.rarity] ?? item.rarity}
        </div>
      </div>
      {item.equipped ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: '#3DBA7A', fontWeight: 700, textAlign: 'center', padding: '3px 0' }}>✓ {t.shop.equipped ?? 'Equipped'}</div>
          <button onClick={onUnequip} disabled={loading} style={{ ...btnStyle, background: 'rgba(255,77,106,0.14)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.35)' }}>{loading ? '...' : t.shop.unequip}</button>
        </div>
      ) : item.owned ? (
        <button onClick={onEquip} disabled={loading} style={{ ...btnStyle, background: 'linear-gradient(135deg,#7B61FF,#9B85FF)', color: '#fff' }}>{loading ? '...' : t.shop.equip}</button>
      ) : (
        <button onClick={onPurchase} disabled={loading} style={{ ...btnStyle, background: 'linear-gradient(135deg,#F0C85A,#D4A843)', color: '#1A1208' }}>{loading ? '...' : `${fmtBalance(item.priceCoins)}`}</button>
      )}
    </div>
  );
};
