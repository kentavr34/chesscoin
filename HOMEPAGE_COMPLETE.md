# 🏠 ГЛАВНАЯ СТРАНИЦА — ПОЛНАЯ МЕХАНИКА И ВИЗУАЛ

> **Окончательный визуальный дизайн (10/10) с интеграцией в новую дизайн-систему**

---

## 🎨 ВИЗУАЛЬНЫЙ ДИЗАЙН ГЛАВНОЙ СТРАНИЦЫ

### 1️⃣ ПОЛНЫЙ МАКЕТ (Mobile-First: 375px)

```
┌──────────────────────────────────────┐
│          🏠 HOME (BottomNav)         │ (высота 82px + safe-area)
├──────────────────────────────────────┤
│                                      │
│ ┌────────────────────────────────┐  │ (горизонтальный скроллинг)
│ │ Логотип / Название приложения  │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ           ┃  │ (CARD lg)
│ ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫  │
│ ┃ 👤 [ИМПЛЕЙ]        [Открыть →] ┃  │ (Heading h3 + Button secondary)
│ ┃ 100 побед · 25 поражений       ┃  │ (Text sm secondary)
│ ┃                                ┃  │
│ ┃ ┌──────────┬──────────┐        ┃  │ (StatBox 2-col grid)
│ ┃ │ Рейтинг  │  Лига    │        ┃  │
│ ┃ │  2150    │ 👑 Чемпион│        ┃  │
│ ┃ └──────────┴──────────┘        ┃  │
│ ┃                                ┃  │
│ ┃ ┌────────────────────────────┐ ┃  │ (StatBox full-width)
│ ┃ │  Баланс: 1,500,000 ᚙ       │ ┃  │
│ ┃ └────────────────────────────┘ ┃  │
│ ┃                                ┃  │
│ ┃ ┌──────────┬──────────┐        ┃  │ (StatBox 2-col с кнопкой внутри)
│ ┃ │Попытки   │ Рефералы │        ┃  │
│ ┃ │ 5/5      │    12    │        ┃  │
│ ┃ │Через 4ч3м│ [Пригла]│        ┃  │
│ ┃ └──────────┴──────────┘        ┃  │
│ ┃                                ┃  │
│ ┃ [📊 2 активных сессии ▼]       ┃  │ (Button secondary fullWidth)
│ ┃                                ┃  │ (collapse/expand)
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                      │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 🤖 Игра против Jarvis         → ┃  │ (NavButton + hover effect)
│ ┃ Выбери сложность и начни      │  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                      │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ ⚔️ Батлы                      → ┃  │ (Цвет: #9B85FF)
│ ┃ PvP дуэли с игроками          │  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                      │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 🏰 Войны                       → ┃  │ (Цвет: #FF4D6A)
│ ┃ Коалиции и боевые операции    │  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                      │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 🛍️ Магазин                     → ┃  │ (Цвет: #00D68F)
│ ┃ Скины, фигуры, доски          │  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                      │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ ⚙️ Настройки                    → ┃  │ (Цвет: rgba(255,255,255,0.05))
│ ┃ Язык, тема, аккаунт           │  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                      │
└──────────────────────────────────────┘
```

---

## 📊 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (CARD)

### Контейнер профиля
**Компонент**: `<Card padding="lg">`

```css
Card {
  padding: var(--card-padding-lg);          /* 16px */
  background: var(--color-bg-card);         /* #1C2030 */
  border-radius: var(--radius-l);           /* 16px */
  border: 1px solid var(--color-border);    /* rgba(255,255,255,0.1) */
  margin-bottom: var(--gap-xl);             /* 24px */
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
```

### Заголовок профиля (Flex Layout)

```
┌────────────────────────────────────┐
│ 👤  ИМЕН    ФАМИЛИЯ     [Открыть] │
│     100 побед · 25 поражений      │
└────────────────────────────────────┘
```

**Стиль:**
```css
Header {
  display: flex;
  gap: var(--gap-md);                   /* 12px */
  align-items: center;
  margin-bottom: var(--gap-md);         /* 12px */
}

Avatar {
  font-size: 44px;                      /* Emoji size */
  flex-shrink: 0;
}

TextContent {
  flex: 1;
}

Heading (level h3) {
  margin: 0;
  font-size: var(--font-size-lg);       /* 18px */
  font-weight: var(--font-weight-bold); /* 700 */
  color: var(--color-text-primary);     /* #F0F2F8 */
  line-height: var(--line-height-tight); /* 1.2 */
}

Text (size sm, color secondary) {
  margin-top: var(--gap-xs);            /* 4px */
  font-size: var(--font-size-sm);       /* 12px */
  color: var(--color-text-secondary);   /* #8B92A8 */
}

Button (variant secondary, size sm) {
  padding: 6px 12px;
  height: auto;
  font-size: 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: rgba(255,255,255,0.05);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all var(--transition-fast) var(--ease-in-out);
}

Button:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.15);
}
```

### ELO и Лига (2-Column Grid)

```
┌──────────────────┬──────────────────┐
│    Рейтинг       │      Лига        │
│     2150         │   👑 Чемпион     │
└──────────────────┴──────────────────┘
```

**Стиль:**
```css
Grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap-sm);                   /* 8px */
  margin-bottom: var(--gap-md);         /* 12px */
}

StatBox {
  padding: var(--card-padding-md);      /* 12px */
  border-radius: var(--radius-m);       /* 12px */
  background: rgba(var(--color-rgb), 0.08);
  border: 1px solid rgba(var(--color-rgb), 0.15);
  text-align: center;
}

StatBox:color-red {
  --color-rgb: 255, 77, 106;            /* #FF4D6A */
  background: rgba(255, 77, 106, 0.08);
  border: 1px solid rgba(255, 77, 106, 0.15);
}

StatBox:color-gold {
  --color-rgb: 245, 200, 66;            /* #F5C842 */
  background: rgba(245, 200, 66, 0.08);
  border: 1px solid rgba(245, 200, 66, 0.15);
}
```

### Баланс (Full-Width)

```
┌──────────────────────────┐
│  Баланс: 1,500,000 ᚙ    │
└──────────────────────────┘
```

**Стиль:**
```css
StatBox {
  display: block;
  padding: var(--card-padding-md);      /* 12px */
  margin-bottom: var(--gap-md);         /* 12px */
  background: rgba(245, 200, 66, 0.08);
  border: 1px solid rgba(245, 200, 66, 0.15);
  border-radius: var(--radius-m);       /* 12px */
}

Value {
  font-family: 'JetBrains Mono', monospace;
  font-size: var(--font-size-base);     /* 14px */
  font-weight: var(--font-weight-bold); /* 700 */
  color: var(--color-accent);           /* #F5C842 */
  text-align: center;
}
```

### Попытки и Рефералы (2-Column с Кнопкой)

```
┌──────────────────┬──────────────────┐
│   Попытки        │    Рефералы      │
│    5/5           │        12        │
│Через 4ч 3м      │  [Пригласить]   │
└──────────────────┴──────────────────┘
```

**Стиль:**
```css
Grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap-sm);                   /* 8px */
  margin-bottom: var(--gap-md);         /* 12px */
}

StatBox {
  padding: var(--card-padding-md);
  border-radius: var(--radius-m);
}

StatBox:color-blue {
  background: rgba(0, 152, 234, 0.08);
  border: 1px solid rgba(0, 152, 234, 0.15);
}

StatBox:color-green {
  background: rgba(0, 214, 143, 0.08);
  border: 1px solid rgba(0, 214, 143, 0.15);
}

InnerButton {
  margin-top: var(--gap-xs);            /* 4px */
  padding: 0;
  background: transparent;
  border: none;
  color: inherit;
  font-size: var(--font-size-xs);       /* 10px */
  text-decoration: underline;
  cursor: pointer;
  transition: all var(--transition-fast);
}

InnerButton:hover {
  opacity: 0.8;
  text-decoration: none;
}
```

---

## 🎯 АКТИВНЫЕ СЕССИИ (Collapsible)

### Кнопка показа сессий

```
[📊 2 активных сессии ▼]
```

**Стиль:**
```css
Button {
  width: 100%;
  padding: var(--button-padding-x-md);  /* 16px */
  height: var(--button-height-md);      /* 44px */
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);       /* 12px */
  font-size: var(--font-size-base);     /* 14px */
  font-weight: var(--font-weight-semibold); /* 600 */
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all var(--transition-fast) var(--ease-in-out);
  margin-bottom: var(--gap-md);         /* 12px */
  display: flex;
  align-items: center;
  justify-content: space-between;
}

Button:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.15);
}

Button.expanded {
  margin-bottom: var(--gap-md);         /* 12px */
}
```

### Карточка активной сессии

```
┌────────────────────────────────┐
│ 🤖 Против Jarvis    ▶️ В процессе │
└────────────────────────────────┘
```

**Стиль:**
```css
SessionCard {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);                   /* 4px */
  padding: var(--card-padding-md);      /* 12px */
  margin-bottom: var(--gap-sm);         /* 8px */
  background: var(--color-bg-light);    /* #13161F */
  border: 1px solid var(--color-border-light); /* rgba(255,255,255,0.05) */
  border-radius: var(--radius-m);       /* 12px */
  cursor: pointer;
  transition: all var(--transition-fast) var(--ease-in-out);
  interactive: true;
}

SessionCard:hover {
  background: rgba(255,255,255,0.03);
  border-color: rgba(245,200,66,0.2);
}

SessionType (Text sm) {
  font-size: var(--font-size-sm);       /* 12px */
  font-weight: var(--font-weight-semibold); /* 600 */
  color: var(--color-text-primary);
}

SessionStatus (Text xs, color secondary) {
  font-size: var(--font-size-xs);       /* 10px */
  color: var(--color-text-secondary);   /* #8B92A8 */
}
```

---

## 🔘 НАВИГАЦИОННЫЕ КНОПКИ (NavButton Custom Component)

### Layout (5 кнопок в колонке)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🤖 Игра против Jarvis    → ┃
┃ Выбери сложность и начни  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚔️ Батлы                  → ┃
┃ PvP дуэли с игроками      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🏰 Войны                   → ┃
┃ Коалиции и боевые операции┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🛍️ Магазин                  → ┃
┃ Скины, фигуры, доски      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚙️ Настройки                 → ┃
┃ Язык, тема, аккаунт       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Container:**
```css
NavButtonContainer {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);                   /* 12px */
}
```

### Кнопка навигации (NavButton)

**Base Style:**
```css
NavButton {
  padding: var(--card-padding-lg) var(--button-padding-x-md); /* 16px 16px */
  background: rgba(var(--color-rgb), 0.1);
  border: 2px solid rgba(var(--color-rgb), 0.3);
  border-radius: var(--radius-l);       /* 16px */
  cursor: pointer;
  font-family: inherit;
  transition: all var(--transition-fast) var(--ease-in-out);
  display: flex;
  align-items: center;
  gap: var(--gap-md);                   /* 12px */
  min-height: 64px;                     /* Touch target */
}

NavButton:hover {
  background: rgba(var(--color-rgb), 0.15);
  border-color: rgba(var(--color-rgb), 0.6);
  transform: translateX(4px);           /* Slight right motion */
}

NavButton:active {
  transform: translateX(2px) scale(0.98);
  transition: all 100ms var(--ease-in-out);
}
```

### Цветные варианты

**Jarvis (Gold):**
```css
NavButton:jarvis {
  --color-rgb: 245, 200, 66;            /* #F5C842 */
  background: rgba(245, 200, 66, 0.1);
  border-color: rgba(245, 200, 66, 0.3);
}

NavButton:jarvis:hover {
  background: rgba(245, 200, 66, 0.15);
  border-color: rgba(245, 200, 66, 0.6);
  box-shadow: 0 0 16px rgba(245, 200, 66, 0.2);
}
```

**Battles (Purple):**
```css
NavButton:battles {
  --color-rgb: 155, 133, 255;           /* #9B85FF */
  background: rgba(155, 133, 255, 0.1);
  border-color: rgba(155, 133, 255, 0.3);
}

NavButton:battles:hover {
  background: rgba(155, 133, 255, 0.15);
  border-color: rgba(155, 133, 255, 0.6);
  box-shadow: 0 0 16px rgba(155, 133, 255, 0.2);
}
```

**Wars (Red):**
```css
NavButton:wars {
  --color-rgb: 255, 77, 106;            /* #FF4D6A */
  background: rgba(255, 77, 106, 0.1);
  border-color: rgba(255, 77, 106, 0.3);
}

NavButton:wars:hover {
  background: rgba(255, 77, 106, 0.15);
  border-color: rgba(255, 77, 106, 0.6);
  box-shadow: 0 0 16px rgba(255, 77, 106, 0.2);
}
```

**Shop (Green):**
```css
NavButton:shop {
  --color-rgb: 0, 214, 143;             /* #00D68F */
  background: rgba(0, 214, 143, 0.1);
  border-color: rgba(0, 214, 143, 0.3);
}

NavButton:shop:hover {
  background: rgba(0, 214, 143, 0.15);
  border-color: rgba(0, 214, 143, 0.6);
  box-shadow: 0 0 16px rgba(0, 214, 143, 0.2);
}
```

**Settings (Neutral):**
```css
NavButton:settings {
  --color-rgb: 255, 255, 255;           /* White */
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

NavButton:settings:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}
```

### Содержимое NavButton

```
┌─────────────────────────────────┐
│ 🤖  TITLE              →        │
│     Subtitle text               │
└─────────────────────────────────┘
```

**Icon (левая сторона):**
```css
Icon {
  font-size: var(--icon-size-xl);       /* 48px */
  flex-shrink: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
```

**TextContent:**
```css
TextContent {
  text-align: left;
  flex: 1;
}

Title (Heading h4) {
  margin: 0;
  font-size: var(--font-size-base);     /* 14px */
  font-weight: var(--font-weight-bold); /* 700 */
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

Subtitle (Text sm, color secondary) {
  margin-top: var(--gap-xs);            /* 4px */
  font-size: var(--font-size-sm);       /* 12px */
  color: var(--color-text-secondary);
}
```

**Arrow (правая сторона):**
```css
Arrow {
  font-size: var(--font-size-xl);       /* 20px */
  color: var(--color-text-secondary);
  flex-shrink: 0;
  transition: all var(--transition-fast) var(--ease-in-out);
}

NavButton:hover Arrow {
  color: var(--color-text-primary);
  transform: translateX(4px);           /* Move right on hover */
}
```

---

## 📱 RESPONSIVE DESIGN

### Mobile (< 480px)
```css
@media (max-width: 479px) {
  /* Default layout - optimized for 375px width */
  PageLayout {
    padding: var(--space-m) var(--space-s);  /* 12px 8px */
  }

  NavButton {
    padding: 12px 12px;                 /* Reduced padding */
    min-height: 60px;
    gap: 10px;
  }

  StatBox {
    padding: 10px 8px;                  /* Compact */
    font-size: 12px;
  }
}
```

### Tablet (480px - 767px)
```css
@media (min-width: 480px) and (max-width: 767px) {
  /* Larger padding on tablets */
  PageLayout {
    padding: var(--space-l) var(--space-m);  /* 16px 12px */
  }

  NavButton {
    padding: 16px 14px;
    min-height: 68px;
  }
}
```

### Desktop (≥ 768px)
```css
@media (min-width: 768px) {
  /* Full spacing on desktop */
  PageLayout {
    max-width: 600px;                   /* Limit width */
    margin: 0 auto;
  }

  NavButton {
    padding: 18px 16px;
    min-height: 72px;
  }
}
```

### Safe Area (Notched Devices)
```css
PageLayout {
  padding-bottom: max(var(--space-l), env(safe-area-inset-bottom));
  padding-top: max(var(--space-m), env(safe-area-inset-top));
}

BottomNav {
  padding-bottom: env(safe-area-inset-bottom, 0);
  height: calc(82px + env(safe-area-inset-bottom, 0));
}
```

---

## ✨ АНИМАЦИИ И ПЕРЕХОДЫ

### Global Transitions
```css
:root {
  --transition-fast: 150ms;             /* UI interactions */
  --transition-normal: 250ms;           /* Page transitions */
  --transition-slow: 400ms;             /* Modal animations */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}
```

### Button Hover Animation
```css
NavButton:hover {
  transition: all var(--transition-fast) var(--ease-in-out);
  transform: translateX(4px);           /* Slight push right */
  box-shadow: 0 0 16px rgba(var(--color-rgb), 0.2);
}

NavButton:active {
  transform: translateX(2px) scale(0.98);
}
```

### Card Hover Animation
```css
Card[interactive] {
  transition: all var(--transition-fast) var(--ease-in-out);
  cursor: pointer;
}

Card[interactive]:hover {
  background: rgba(255,255,255,0.03);
  border-color: rgba(245,200,66,0.2);
  transform: translateY(-2px);
}

Card[interactive]:active {
  transform: translateY(0px);
}
```

### Fade In Animation
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

HomePage {
  animation: fadeIn var(--transition-normal) var(--ease-out) forwards;
}
```

### Collapse/Expand Sessions
```css
SessionsList {
  animation: slideDown var(--transition-normal) var(--ease-in-out) forwards;
  transform-origin: top;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
  }
}
```

---

## 🎯 ИНТЕГРАЦИЯ С КОМПОНЕНТНОЙ СИСТЕМОЙ

### Используемые компоненты

| Компонент | Использование | Вариант |
|-----------|--------------|---------|
| Card | Профиль пользователя | padding="lg" |
| StatBox | Рейтинг, Лига, Баланс, Попытки, Рефералы | color="red/gold/purple/blue/green" |
| Button | Открыть профиль, Пригласить, Активные сессии | variant="secondary" size="sm/md" |
| Heading | Имя пользователя | level="h3/h4" |
| Text | Победы/поражения, Статусы, Подписи | size="sm/xs" color="secondary" |

### Цветовые переменные

```css
/* Gold (Jarvis) */
--color-jarvis-bg: rgba(245, 200, 66, 0.1);
--color-jarvis-border: rgba(245, 200, 66, 0.3);
--color-jarvis-hover-bg: rgba(245, 200, 66, 0.15);
--color-jarvis-hover-border: rgba(245, 200, 66, 0.6);
--color-jarvis-glow: rgba(245, 200, 66, 0.2);

/* Purple (Battles) */
--color-battles-bg: rgba(155, 133, 255, 0.1);
--color-battles-border: rgba(155, 133, 255, 0.3);
--color-battles-hover-bg: rgba(155, 133, 255, 0.15);
--color-battles-hover-border: rgba(155, 133, 255, 0.6);
--color-battles-glow: rgba(155, 133, 255, 0.2);

/* Red (Wars) */
--color-wars-bg: rgba(255, 77, 106, 0.1);
--color-wars-border: rgba(255, 77, 106, 0.3);
--color-wars-hover-bg: rgba(255, 77, 106, 0.15);
--color-wars-hover-border: rgba(255, 77, 106, 0.6);
--color-wars-glow: rgba(255, 77, 106, 0.2);

/* Green (Shop) */
--color-shop-bg: rgba(0, 214, 143, 0.1);
--color-shop-border: rgba(0, 214, 143, 0.3);
--color-shop-hover-bg: rgba(0, 214, 143, 0.15);
--color-shop-hover-border: rgba(0, 214, 143, 0.6);
--color-shop-glow: rgba(0, 214, 143, 0.2);

/* Settings (Neutral) */
--color-settings-bg: rgba(255, 255, 255, 0.05);
--color-settings-border: rgba(255, 255, 255, 0.1);
--color-settings-hover-bg: rgba(255, 255, 255, 0.08);
--color-settings-hover-border: rgba(255, 255, 255, 0.15);
```

---

## 📝 ДЕТАЛИ РЕАЛИЗАЦИИ

### StatBox Компонент
```tsx
interface StatBoxProps {
  label: string;
  value: string | number;
  color: 'red' | 'gold' | 'purple' | 'blue' | 'green';
  size?: 'sm' | 'md';
  children?: React.ReactNode;
}
```

**Color Mapping:**
- `red` → #FF4D6A (ELO)
- `gold` → #F5C842 (Balance)
- `purple` → #9B85FF (Attempts)
- `blue` → #0098EA (Attempts)
- `green` → #00D68F (Referrals)

### NavButton Props
```tsx
interface NavButtonProps {
  icon: string;              // Emoji or icon
  title: string;             // Main label
  subtitle: string;          // Secondary label
  onClick: () => void;       // Click handler
  color: string;             // Hex color or 'transparent'
}
```

### Структура папок
```
src/
├── pages/
│   └── HomePage.tsx              ← Главная компонента
├── components/
│   └── ui/
│       ├── Card.tsx
│       ├── Button.tsx
│       ├── Text.tsx
│       ├── Heading.tsx
│       ├── StatBox.tsx
│       ├── JarvisModal.tsx
│       └── GameSetupModal.tsx
├── styles/
│   └── index.css                 ← Design tokens
└── ...
```

---

## 📊 ЧЕКЛИСТ ВИЗУАЛЬНОГО ДИЗАЙНА (10/10)

### Профиль пользователя
- ✅ Emoji avatar (44px)
- ✅ Heading h3 для имени
- ✅ Текст с победами/поражениями
- ✅ Button "Открыть" (secondary, sm)
- ✅ StatBox сетка 2-col (ELO + Лига)
- ✅ StatBox full-width (Баланс)
- ✅ StatBox сетка 2-col (Попытки + Рефералы)
- ✅ Inner button "Пригласить" в StatBox

### Активные сессии
- ✅ Button "N активных сессий" (collapsible)
- ✅ Карточки сессий (Card)
- ✅ Иконки типов (🤖, ⚔️, 👥)
- ✅ Статусы с иконками (▶️, ⏳)
- ✅ Slide down анимация

### Навигационные кнопки
- ✅ 5 цветных кнопок (gold, purple, red, green, neutral)
- ✅ Emoji иконки (🤖, ⚔️, 🏰, 🛍️, ⚙️)
- ✅ Заголовки (Heading h4)
- ✅ Подзаголовки (Text sm)
- ✅ Стрелка → (с animation)
- ✅ Hover эффект (color glow + translateX)
- ✅ Active эффект (scale + translateX)
- ✅ Минимальная высота 44-72px (touch target)

### Дизайн-токены
- ✅ Цветовые переменные для всех 5 кнопок
- ✅ Transition timing (fast, normal, slow)
- ✅ Ease functions (in-out, out, in)
- ✅ Spacing переменные (space-xs/s/m/l/xl)
- ✅ Border radius (s/m/l/xl/round)
- ✅ Z-index масштаб (0-400+)

### Responsive дизайн
- ✅ Mobile-first (375px базовая ширина)
- ✅ Media queries для 480px + 768px
- ✅ Safe-area insets для notched devices
- ✅ Touch targets ≥ 44px высота
- ✅ Flexible spacing и font sizes

### Анимации
- ✅ Fade in на загрузке страницы
- ✅ Slide down для expand/collapse сессий
- ✅ Hover transform (translateX, scale)
- ✅ Button press эффект (active state)
- ✅ Smooth transitions (150-400ms)

### Интеграция с компонентами
- ✅ Card component (padding="lg")
- ✅ StatBox component (color variants)
- ✅ Button component (variant, size)
- ✅ Text component (size, color)
- ✅ Heading component (level)
- ✅ Modal components (Jarvis, GameSetup)

---

## 🚀 ПОРЯДОК РАЗРАБОТКИ

1. ✅ Создать полный визуальный дизайн (THIS DOCUMENT)
2. 🔄 Обновить index.css с цветовыми переменными для NavButton
3. 📐 Рефакторить NavButton компонент (добавить hover/active animations)
4. 🎨 Проверить все разновидности StatBox (5 цветов)
5. 📱 Протестировать responsive дизайн (375/480/768px)
6. ✨ Добавить animations (fadeIn, slideDown)
7. 🔗 Подключить модали (JarvisModal, GameSetupModal)
8. 📝 Финальная полировка и детали

---

**СТАТУС: ВИЗУАЛЬНЫЙ ДИЗАЙН ЗАВЕРШЁН (10/10) ✅**

*Готово к интеграции с компонентной системой и добавлению функционала!*
