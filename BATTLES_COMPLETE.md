# ⚔️ БАТЛЫ — ПОЛНАЯ МЕХАНИКА И ВИЗУАЛ

> **Исправленная версия с правильной логикой + визуальный дизайн 10/10**

---

## 🔴 ИСПРАВЛЕННАЯ ЛОГИКА БАТЛОВ

### Минимум: 10,000 ᚙ | Максимум: баланс игрока

```
Игрок А: ставит 1,000 ᚙ
Игрок Б: ставит 1,000 ᚙ
──────────────────────────────
ОБЩИЙ БАНК: 2,000 ᚙ
Комиссия системы (10%): 200 ᚙ 🏦
──────────────────────────────
ЧИСТЫЙ ПРИЗОВОЙ ФОНД: 1,800 ᚙ
ПОБЕДИТЕЛЬ ПОЛУЧАЕТ: 1,800 ᚙ (и ТОЛЬКО это)

✅ СИСТЕМА = посредник (10% комиссия)
✅ БАТЛ = чистая сделка между двумя игроками
❌ НЕ добавляем 1,000 обратно победителю (уже в банке)
```

---

## 🎨 ВИЗУАЛЬНЫЙ ДИЗАЙН МОДАЛОВ

### 1️⃣ СОЗДАНИЕ БАТЛА (Sheet Modal — 480px max)

```
┌──────────────────────────────────┐
│ ════════════════════ (ручка)   ✕ │
├──────────────────────────────────┤
│                                  │
│ СТАВКА                           │
│ ┌────────────────────────────┐   │
│ │   1,000 ᚙ                 │   │ (большой моноспейс текст)
│ └────────────────────────────┘   │
│                                  │
│ [≡════════════════════════════]  │ (ползунок)
│                                  │
│ ┌──────┐ ┌───────┐ ┌─────────┐  │ (4 кнопки быстрого выбора)
│ │10,000│ │ 50,000│ │100,000  │  │
│ └──────┘ └───────┘ └─────────┘  │
│                                  │
│ ВЫБРАТЬ ЦВЕТ                     │
│ ┌──────┐ ┌──────┐ ┌──────┐      │ (3 кнопки с иконками)
│ │  🎲  │ │  ♔   │ │  ♚   │      │
│ │Random│ │White │ │Black │      │
│ └──────┘ └──────┘ └──────┘      │
│                                  │
│ КОНТРОЛЬ ВРЕМЕНИ                 │
│ ┌──────┐ ┌──────┐ ┌──────┐      │ (3×2 сетка с иконками)
│ │ ⚡ 1m│ │ 🔥 3m│ │ ♟  5m │      │
│ ├──────┤ ├──────┤ ├──────┤      │
│ │🎯 10m│ │🏆 20m│ │👑 30m│      │
│ └──────┘ └──────┘ └──────┘      │
│                                  │
│ ┌─────────────┐ ┌──────────────┐ │ (2 кнопки: публичный/приватный)
│ │  📢 PUBLIC  │ │ 🔒 PRIVATE   │ │
│ └─────────────┘ └──────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │ (главная кнопка создания)
│ │   ⚔️ СОЗДАТЬ БАТЛ            │ │
│ └──────────────────────────────┘ │
│                                  │
└──────────────────────────────────┘
```

**Стили:**
```
Overlay: черный 70% + blur(8px) backdrop
Sheet: #13161F граница 1px rgba(255,255,255,0.1), borderRadius 24px top
Handle: 36×4px #2A2F48
Padding: 16px 18px (+ safe-area-inset-bottom)

Ставка (display):
  - Font: JetBrains Mono 30px 800
  - Color: #F5C842 (accent gold)
  - Text-align: center

Ползунок:
  - accentColor: #F5C842
  - Width: 100%

Кнопки быстрого выбора (4 кнопки):
  - Grid: 1fr 1fr 1fr 1fr
  - Gap: 6px
  - Padding: 8px 4px
  - Border-radius: 10px
  - Active: background rgba(245,200,66,0.12) + border rgba(245,200,66,0.3)
  - Inactive: background #1C2030 + border rgba(255,255,255,0.07)
  - Color active: #F5C842 | inactive: #8B92A8
  - Font: 11px 700

Кнопки цвета (3 кнопки):
  - Grid: 1fr 1fr 1fr
  - Gap: 8px
  - Padding: 18px 8px
  - Min-height: 76px
  - Border-radius: 14px
  - Border: 2px solid (active) или 1px (inactive)
  - Active: background rgba(245,200,66,0.1) + border #F5C842 + transform scale(1.04)
  - Inactive: background #1C2030 + border rgba(255,255,255,0.07)
  - Transition: all 0.15s
  - Icon: 22px шрифт

Кнопки времени (3×2 сетка):
  - Grid: 1fr 1fr 1fr (2 строки)
  - Gap: 8px
  - Padding: 14px 8px
  - Min-height: 68px
  - Border-radius: 12px
  - Active: background rgba(123,97,255,0.15) + border rgba(123,97,255,0.4) + color #9B85FF
  - Inactive: background #1C2030 + border rgba(255,255,255,0.07) + color #8B92A8
  - Transition: all 0.15s
  - Font: 13px 700
  - Icon: 16px + label

Кнопки типа (публичный/приватный):
  - Grid: 1fr 1fr
  - Gap: 8px
  - Padding: 12px
  - Border-radius: 12px
  - Active: background rgba(245,200,66,0.1) + border rgba(245,200,66,0.3) + color #F5C842
  - Inactive: background #1C2030 + border rgba(255,255,255,0.07) + color #8B92A8
  - Font: 12px 600

Кнопка создания (главная):
  - Width: 100%
  - Padding: 14px
  - Border-radius: 14px
  - Enabled: background #F5C842 + color #0B0D11 + box-shadow 0 4px 14px rgba(245,200,66,0.2)
  - Disabled: background #2A2F48 + color #4A5270
  - Font: 15px 800
  - Cursor: pointer (enabled) | not-allowed (disabled)
```

---

### 2️⃣ ЛИСТ ПУБЛИЧНЫХ БАТЛОВ

```
┌────────────────────────────────────────────┐
│ БАТЛЫ (вкладка: Публичные | Приватные)    │
├────────────────────────────────────────────┤
│                                            │
│ ОЖИДАЮТ СОПЕРНИКА                          │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ 🔥 ТОП СТАВКА        ⚔️ БАТЛ          │ │ (header)
│ ├────────────────────────────────────────┤ │
│ │ [👤 Игрок A]   [⚔️ LIVE]   [👤 ?]      │ │
│ │ [ELO 2000]      [100,000 ᚙ] [?]        │
│ │                 [10м]                   │ │
│ │                 [ПРИНЯТЬ]                │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │                 ⚔️ БАТЛ                 │ │ (header)
│ ├────────────────────────────────────────┤ │
│ │ [👤 Игрок B]   [50,000 ᚙ]   [👤 ?]    │ │
│ │ [ELO 1800]      [5м]                    │ │
│ │                 [ПРИНЯТЬ]                │ │
│ └────────────────────────────────────────┘ │
│                                            │
│         ＋ (FAB кнопка внизу справа)       │
│                                            │
└────────────────────────────────────────────┘
```

**Карточка батла (waiting):**
```
Style: wcardStyle
- Margin: 0 18px 8px
- Background: #1C2030
- Border: 1px solid rgba(255,255,255,0.07)
- Border-radius: 18px
- Padding: 14px (БЫЛО padding: 0, теперь padding нужен)
- Display: flex
- Gap: 12px
- Cursor: pointer
- Transition: all 0.2s

Header (сверху батла):
- Background: #1C2030
- Border-bottom: 1px solid rgba(255,255,255,0.05)
- Padding: 6px 14px
- Font: 10px 700 uppercase
- Color: #8B92A8
- Display: flex
- Justify-content: space-between
- Letter-spacing: 0.06em
- Border-radius: 18px 18px 0 0

Icon слева в header:
- 🔥 для ТОП СТАВКИ (красный цвет #F5C842)
- ⚔️ для обычных батлов

Content (основной контент):
- Flex: 1 (каждая часть)
- Display: flex
- Flex-direction: column
- Gap: 4px

Player (слева и справа):
- Avatar size: m
- Name: 13px 700 primary
- ELO: 11px 600 secondary
- Flag emoji под avatar

Center (середина):
- Flex-direction: column
- Align-items: center
- Gap: 4px
- Ставка: 12px 700 #F5C842
- Время: 11px secondary
- Кнопка ПРИНЯТЬ: acceptBtn style (8px 14px, #F5C842, #0B0D11, 12px 600)
- Margin-top: 4px

FAB кнопка (создание):
- Position: fixed
- Bottom: 94px (над BottomNav)
- Right: 18px
- Width: 48px
- Height: 48px
- Border-radius: 50%
- Background: #F5C842
- Color: #0B0D11
- Font: 22px 800
- Box-shadow: 0 4px 20px rgba(245,200,66,0.4)
- Z-index: 49
- Cursor: pointer
```

---

### 3️⃣ АКТИВНЫЕ ИГРЫ (LIVE)

```
┌────────────────────────────────────────────┐
│                 ⚫ LIVE                      │ (header красный)
│                                            │
│ [👤 Мой ник]  [⏱️ 4:32]  [👤 Соперник]    │
│ [ELO 2000]     [🔴 LIVE]  [ELO 1900]       │
│                [100,000 ᚙ]                 │
│                                            │
│ (интерактивно → клик → переход в /game/)  │
└────────────────────────────────────────────┘
```

**Стиль bcardStyle:**
```
- Margin: 0 18px 10px
- Background: #1C2030
- Border: 1px solid rgba(255,255,255,0.07)
- Border-radius: 18px
- Overflow: hidden
- Cursor: pointer
- Padding: 0 (для внутреннего header)

Header (сверху):
- Background: #1C2030
- Border-bottom: 1px solid rgba(255,255,255,0.05)
- Padding: 6px 14px
- Display: flex
- Align-items: center
- Justify-content: space-between
- Font: 10px 700 uppercase
- Color: #8B92A8
- Letter-spacing: 0.06em
- Border-radius: 18px 18px 0 0

Content (основной):
- Display: flex
- Align-items: center
- Padding: 16px
- Gap: 12px
- Justify-content: space-between

Live indicator:
- Display: inline-block
- Background: #EF4444
- Color: #FFF
- Font: 10px 800
- Padding: 2px 8px
- Border-radius: 4px
- Letter-spacing: 0.05em

Time (монофонт):
- Font-family: JetBrains Mono monospace
- Font-size: 24px
- Font-weight: 800
- Color: #F0F2F8

Ставка (внизу):
- Font-size: 12px
- Color: #F5C842
- Font-weight: 700
```

---

### 4️⃣ ПРИВАТНЫЕ БАТЛЫ (WAITING)

```
┌────────────────────────────────┐
│ 🔒 ПРИВАТНЫЕ БАТЛЫ             │
├────────────────────────────────┤
│                                │
│ Что это?                        │
│ ┌───────────────────────────┐  │
│ │  🔒 ПРИВАТНЫЕ БАТЛЫ       │  │
│ │                            │  │
│ │ Вызови друга или игрока    │  │
│ │ на личный матч. Только     │  │
│ │ вас двоих. Поделись        │  │
│ │ ссылкой через TG.          │  │
│ └───────────────────────────┘  │
│                                │
│ МОИ ПРИВАТНЫЕ (ОЖИДАЮТ)        │
│                                │
│ ┌───────────────────────────┐  │
│ │ ⏳ ОЖИДАНИЕ СОПЕРНИКА      │  │
│ │ 🔒 ПРИВАТНЫЙ               │  │
│ │                            │  │
│ │ [👤 Я]  [10,000 ᚙ] [👤 ?] │  │
│ │ [link] [ПРИНЯТЬ] [status] │  │
│ └───────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

---

## 🎯 ИНТЕГРАЦИЯ С НОВОЙ ДИЗАЙН-СИСТЕМОЙ

**Вместо:**
- `segStyle` → использовать Button component (variant="primary"/"secondary")
- `wcardStyle` → использовать Card component (padding="md")
- `acceptBtn` → использовать Button component (variant="secondary" size="sm")
- `fabStyle` → использовать Button component (круглая) + position fixed
- Все цвета → design tokens (--color-accent-gold, --color-red и т.д.)
- Все font-size → design tokens (--font-size-sm, --font-size-md и т.д.)

**Что ИНТЕГРИРОВАТЬ:**
- Ползунок от 10,000 до max (сохранить точно как в старой версии)
- Градиент header для ТОП СТАВКИ: `linear-gradient(90deg,rgba(245,200,66,0.1),transparent)`
- Красный live indicator: #EF4444 + glow-shadow
- Монофонт для времени: JetBrains Mono
- FAB кнопка (48×48) с box-shadow

---

## 📋 ЧЕКЛИСТ ВИЗУАЛЬНОГО ДИЗАЙНА (10/10)

- ✅ Ползунок ставок (10,000 - max)
- ✅ 4 кнопки быстрого выбора ставок
- ✅ 3 кнопки выбора цвета с иконками (🎲 ♔ ♚)
- ✅ 3×2 сетка времени с иконками (⚡ 🔥 ♟ 🎯 🏆 👑)
- ✅ 2 кнопки типа (PUBLIC/PRIVATE) с иконками
- ✅ Главная кнопка создания с box-shadow
- ✅ Вкладки (Публичные | Приватные)
- ✅ Header карточек с градиентом
- ✅ Live indicator с красным цветом и glow
- ✅ Монофонт для времени
- ✅ FAB кнопка (＋) с тенью
- ✅ Player компонент с avatar + ник + ELO
- ✅ Правильная сортировка по ставкам
- ✅ Автоочистка батлов (30 дней)
- ✅ Backdrop blur для модала

---

**ПОРЯДОК РАЗРАБОТКИ:**

1. ✅ Исправить логику батлов (правильный расчет)
2. 🔄 Визуальный дизайн модалов (НАЧАТЬ ОТСЮДА)
3. 📊 Интеграция с новой дизайн-системой
4. 🎮 Функционал создания батлов
5. ⚔️ Функционал принятия батлов
6. 📈 Live статистика (зрители, донаты)
