import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { shopApi, authApi, profileApi } from '@/api';

import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';
import type { ShopItem, ItemType } from '@/types';
import { setActiveTheme } from '@/lib/theme';
import type { ThemeKey } from '@/lib/theme';
import { useT, useText } from '@/i18n/useT';
import { useI18nStore } from '@/i18n/useI18nStore';
import { ExchangeTab } from './ExchangeTab';
import { ItemCard, AvatarItemCard, ShopCardStyles } from '@/components/shop/ShopItemCards';

import { IcoBolt, IcoExchange, IcoShop, IcoTon, IcoMask, IcoFrame, IcoPalette, IcoSparkles, IcoDiceShop } from '@/components/icons/UiIcons';

// N6: 6 вкладок покупок (объединены Фигуры = pieces+pieceSets+anims) + TON отдельно сверху
// S1: 6 вкладок в 2 ряда по 3: [Аватары|Рамки|Визуал] / [Темы|Эффекты|Биржа]
type Tab = 'avatars' | 'frames' | 'visual' | 'themes' | 'effects' | 'exchange';

// S1: маппинг вкладок → типы товаров
const TAB_TYPE: Partial<Record<Tab, ItemType | ItemType[]>> = {
  avatars:  'PREMIUM_AVATAR',
  frames:   'AVATAR_FRAME',
  visual:   'BOARD_SKIN',
  // Звуковые наборы живут рядом с анимациями: и то и другое — то, что
  // происходит при ходе (Кенан 03.08.2026).
  effects:  ['MOVE_ANIMATION', 'SOUND'],
  themes:   'THEME',
};

// Map item name to ThemeKey
const THEME_NAME_TO_KEY: Record<string, ThemeKey> = {
  'Binance Pro':   'binance',
  'Chess Classic': 'chess_classic',
  'Neon Cyber':    'neon_cyber',
  'Royal Gold':    'royal_gold',
  'Matrix Dark':   'matrix_dark',
  'Crystal Ice':   'crystal_ice',
};

// Курс: 100 000 монет за 1 TON (Кенан 31.07.2026). Настоящий курс
// приходит с бэкенда, это запасное значение до ответа.
const DEFAULT_TON_TO_COINS = 100_000;
const DEFAULT_USDT_TO_COINS = 200_000;
const FEE_PERCENT = 0.5;

// ── Premium Dark style constants ─────────────────────────────
const S = {
  card: {
    background: 'linear-gradient(135deg,#141018,#0F0E18)',
    border: '.5px solid rgba(154,148,144,.22)',
    borderRadius: 16,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: '.58rem',
    fontWeight: 700,
    color: '#7A7875',
    textTransform: 'uppercase' as const,
    letterSpacing: '.14em',
  } as React.CSSProperties,
  primaryText: { color: '#EAE2CC' } as React.CSSProperties,
  mutedText: { color: '#7A7875' } as React.CSSProperties,
  goldBtn: {
    background: 'linear-gradient(135deg,#2A1E08,#4A3810)',
    border: '.5px solid rgba(212,168,67,.42)',
    color: '#F0C85A',
    borderRadius: 12,
    padding: '12px 20px',
    fontWeight: 900,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all .15s',
  } as React.CSSProperties,
  input: {
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.1)',
    color: '#EAE2CC',
    borderRadius: 10,
    padding: '10px 14px',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
  } as React.CSSProperties,
};

// ── Main Shop ────────────────────────────────────────────────
export const ShopPage: React.FC = () => {
  const t = useT();
  const { user, setUser } = useUserStore();
  const location = useLocation();
  const initTab = (location.state as Record<string,unknown>)?.tab as Tab ?? 'avatars';
  const highlightItemId: string | null = ((location.state as Record<string,unknown>)?.highlightItemId as string) ?? null;
  const [tab, setTab] = useState<Tab>(initTab);
  const [visualSubType, setVisualSubType] = useState<'BOARD_SKIN'|'PIECE_SKIN'|'PIECE_SET'|'CELL_SHAPE'|'MOVE_ANIMATION'|'FONT'>('BOARD_SKIN');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const shopSlides = [
    { icon: <IcoShop size={32} color="#F5C842" />, title: t?.shop?.title ?? 'Магазин ChessCoin', desc: 'Покупай аватары, рамки, доски и темы за монеты. Подключи TON-кошелёк, чтобы купить монеты за TON или торговать ими на бирже с другими игроками.' },
    { icon: <IcoBolt size={32} color="#F5C842" />, title: 'Как использовать предметы', desc: 'Купи предмет, затем нажми "Применить". Он мгновенно появится в твоем профиле и будет виден для других игроков.' },
    { icon: <IcoTon size={32} color="#0098EA" />, title: 'TON Wallet', desc: 'Подключи TON кошелек чтобы выводить заработанные монеты. Курс конвертации обновляется автоматически.' },
  ];
  const shopInfo = useInfoPopup('shop', shopSlides);
  const [confirmPurchase, ConfirmPurchaseDialog] = useConfirm();
  // Названия товаров и подпись «Цена» на языке интерфейса — диалог покупки
  // был на английском («Buy … ?», «Price», «Buy»).
  const dict = useI18nStore((st) => st.dict);
  const priceLabel = useText('shop.priceLabel', 'Цена');
  const effectsTitle = useText('shop.effects.title', 'Ход и звук');
  const effectsSubtitle = useText('shop.effects.subtitle', 'Анимации ходов и звуковые наборы');
  const cellsLabel = useText('shop.visualTabs.cells', 'Клетки');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const refreshUser = useCallback(async () => {
    try { const u = await authApi.me(); setUser(u); } catch {}
  }, [setUser]);

  const loadItems = useCallback(async () => {
    const tabType = TAB_TYPE[tab];
    if (!tabType) return;
    setLoading(true);
    try {
      if (tab === 'visual') {
        const data = await shopApi.getItems(visualSubType);
        setItems(data.items);
      } else if (Array.isArray(tabType)) {
        const results = await Promise.all(tabType.map(t => shopApi.getItems(t)));
        setItems(results.flatMap(r => r.items));
      } else {
        const data = await shopApi.getItems(tabType);
        setItems(data.items);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, visualSubType]);

  const handleThemePurchase = async (item: ShopItem) => {
    // Диалог покупки был на английском: «Buy … ?», «Price», «Buy».
    const shownName = dict[`shop.item.${item.id}.name`] ?? item.name;
    if (!await confirmPurchase({
      title: `${t.shop.buy} «${shownName}»?`,
      message: `${priceLabel}: ${fmtBalance(item.priceCoins)}`,
      okLabel: t.shop.buy,
    })) return;
    setActionId(item.id);
    try {
      const res = await shopApi.purchase(item.id);
      await refreshUser();
      await loadItems();
      // Применяем тему ТОЛЬКО если у товара есть реальная тема. Иначе (это
      // мис-категоризированные эффекты под типом THEME — Fireworks, Capture:…)
      // НЕ трогаем активную тему пользователя, чтобы не сбросить её в default.
      const key = THEME_NAME_TO_KEY[item.name];
      if (key) {
        setActiveTheme(key);
        profileApi.saveTheme(key).catch(() => {});
      }
      showToast(key ? `Тема «${item.name}» куплена и применена` : `«${item.name}» куплено`);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  const handleThemeApply = (item: ShopItem) => {
    const key = THEME_NAME_TO_KEY[item.name];
    if (key) {
      setActiveTheme(key);
      profileApi.saveTheme(key).catch(() => {});
      showToast(`Тема «${item.name}» применена`);
    } else {
      // Товар куплен, но это эффект без живой механики — не сбрасываем тему.
      showToast(`«${item.name}» — эффект появится в игре`);
    }
  };

  useEffect(() => { loadItems(); }, [loadItems]);

  const handlePurchase = async (item: ShopItem) => {
    // Диалог покупки был на английском: «Buy … ?», «Price», «Buy».
    const shownName = dict[`shop.item.${item.id}.name`] ?? item.name;
    if (!await confirmPurchase({
      title: `${t.shop.buy} «${shownName}»?`,
      message: `${priceLabel}: ${fmtBalance(item.priceCoins)}`,
      okLabel: t.shop.buy,
    })) return;
    setActionId(item.id);
    try {
      const res = await shopApi.purchase(item.id);
      await refreshUser();
      await loadItems();
      showToast(res.message);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  const handleEquip = async (item: ShopItem) => {
    setActionId(item.id);
    try {
      const res = await shopApi.equip(item.id);
      await refreshUser();
      await loadItems();
      showToast(res.message);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  const handleUnequip = async (item: ShopItem) => {
    setActionId(item.id);
    try {
      await shopApi.unequip(item.id);
      await refreshUser();
      await loadItems();
      showToast('Avatar unequipped');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : "Error"));
    } finally {
      setActionId(null);
    }
  };

  // Иконки вместо эмодзи (правило проекта, подтверждено Кенаном 03.08.2026).
  const SHOP_TABS: { key: Tab; label: string; Icon: React.FC<{ size?: number; color?: string }> }[] = [
    { key: 'avatars',   label: t.shop.tabs.avatars,  Icon: IcoMask     },
    { key: 'frames',    label: t.shop.tabs.frames,   Icon: IcoFrame    },
    { key: 'visual',    label: t.shop.tabs.visual,   Icon: IcoDiceShop },
    { key: 'themes',    label: t.shop.tabs.themes,   Icon: IcoPalette  },
    { key: 'effects',   label: t.shop.tabs.effects,  Icon: IcoSparkles },
    { key: 'exchange',  label: t.shop.tabs.exchange, Icon: IcoExchange },
  ];
  const tabRows = [SHOP_TABS.slice(0, 3), SHOP_TABS.slice(3, 6)];

  return (
    <PageLayout title={t.shop.title} centered>
      {/* Hover/shine стили карточек — один раз на страницу */}
      <ShopCardStyles />
      {shopInfo.show && <InfoPopup infoKey="shop" slides={shopSlides} onClose={shopInfo.close} />}
      {ConfirmPurchaseDialog}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg,#1A1508,#2A2010)',
          border: '.5px solid rgba(212,168,67,.42)',
          borderRadius: 12, padding: '10px 20px',
          fontSize: 13, color: '#F0C85A',
          zIndex: 400, fontWeight: 700, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,.5)',
        }}>
          {toast}
        </div>
      )}

      {/* Balance bar */}
      {user && (
        <div style={{ margin: '4px 18px 10px', padding: '11px 16px', ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...S.sectionLabel }}>{t.profile.balance}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#F5C842' }}>
            {fmtBalance(user.balance)}
          </span>
        </div>
      )}

      {/* Отдельной кнопки «TON кошелёк» здесь больше нет. Она вела ровно
          туда же, куда вкладка «Биржа», и при уже подключённом кошельке
          продолжала звать подключаться — Кенан 05.08.2026: «внутри магазина
          осталась кнопка биржа… после привязки не сворачивается в одну тонкую
          полоску». Вход один — вкладка; кошелёк живёт наверху биржи. */}

      {/* Tab bar — 2 rows × 3 */}
      <div style={{ margin: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Tab container background */}
        <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 14, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabRows.map((row, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {row.map(({ key, label, Icon }) => {
                const isActive = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      padding: '8px 4px', border: 'none', borderRadius: 10, fontFamily: 'inherit',
                      fontSize: 11, fontWeight: isActive ? 800 : 600, cursor: 'pointer', transition: 'all .15s',
                      background: isActive ? 'linear-gradient(135deg,#2A1E08,#4A3810)' : 'transparent',
                      color: isActive ? '#F0C85A' : '#7A7875',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}
                  >
                    <Icon size={15} color={isActive ? '#F0C85A' : '#7A7875'} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Effects tab header */}
      {tab === 'effects' && (
        <div style={{ margin: '0 18px 10px', padding: '12px 14px', ...S.card, background: 'linear-gradient(135deg,rgba(155,133,255,.1),rgba(100,80,220,.06))', border: '.5px solid rgba(155,133,255,.22)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EAE2CC', marginBottom: 3, display: 'inline-flex', alignItems: 'center', gap: 5 }}><IcoBolt size={13} color="#9B85FF" /> {effectsTitle}</div>
          <div style={{ fontSize: 11, color: '#7A7875' }}>{effectsSubtitle}</div>
        </div>
      )}

      {/* Visual subtabs */}
      {tab === 'visual' && (
        <div style={{ margin: '0 18px 10px', display: 'flex', background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: 3, gap: 2 }}>
          {([
            ['BOARD_SKIN',     t.shop.visualTabs.boards],
            ['PIECE_SKIN',     t.shop.visualTabs.pieces],
            ['PIECE_SET',      t.shop.visualTabs.sets],
            // Форма клеток — отдельное измерение (B9, Кенан 30.07.2026).
            ['CELL_SHAPE',     cellsLabel],
            ['MOVE_ANIMATION', t.shop.visualTabs.animations],
            ['FONT',           t.shop.visualTabs.fonts],
          ] as const).map(([type, label]) => {
            const isActive = visualSubType === type;
            return (
              <button key={type} onClick={() => setVisualSubType(type)} style={{
                flex: 1, padding: '7px 4px', border: 'none', borderRadius: 8,
                fontFamily: 'inherit', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                background: isActive ? 'linear-gradient(135deg,#2A1E08,#4A3810)' : 'transparent',
                color: isActive ? '#F0C85A' : '#7A7875',
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {/* Exchange tab */}
      {tab === 'exchange' && (
        <ExchangeTab user={user} showToast={showToast} onUserRefresh={refreshUser} />
      )}

      {/* Piece sets & skins grid */}
      {tab === 'avatars' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#7A7875', fontSize: 13 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#7A7875', fontSize: 13 }}>No items</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 18px 24px' }}>
            {items.map((item) => (
              <AvatarItemCard
                key={item.id}
                item={item}
                loading={actionId === item.id}
                highlighted={item.id === highlightItemId}
                onPurchase={() => handlePurchase(item)}
                onEquip={() => handleEquip(item)}
                onUnequip={() => handleUnequip(item)}
              />
            ))}
          </div>
        )
      )}

      {/* All other tabs except avatars and exchange */}
      {tab !== 'avatars' && tab !== 'exchange' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#7A7875', fontSize: 13 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#7A7875', fontSize: 13 }}>No items</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 18px 24px' }}>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                loading={actionId === item.id}
                highlighted={item.id === highlightItemId}
                comingSoon={item.type === 'THEME' && !THEME_NAME_TO_KEY[item.name]}
                onPurchase={() => handlePurchase(item)}
                onEquip={() => handleEquip(item)}
              />
            ))}
          </div>
        )
      )}
    </PageLayout>
  );
};
