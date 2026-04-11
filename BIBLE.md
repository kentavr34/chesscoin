# BIBLE.md — Правила кода ChessCoin
> Читать ПЕРЕД любыми изменениями. Нарушение = задача отклонена.

## 🚫 АБСОЛЮТНЫЕ ЗАПРЕТЫ
- НЕ упрощать компоненты (HomePage была уничтожена — помни)
- НЕ использовать `window.innerWidth` — только CSS media queries
- НЕ хардкодить цвета вне CSS-переменных палитры
- НЕ удалять анимации входа (`cc-fadein`, `cc-popIn`, `cc-pulse`)
- НЕ менять шрифт с Inter
- НЕ удалять рабочий код без явного запроса

## ✅ ЦВЕТОВАЯ ПАЛИТРА (только эти)
```
--color-bg-dark:       #0B0D11   ← фон страниц
--color-bg-card:       #1C2030   ← карточки
--color-bg-modal:      #161927   ← модалки
--color-bg-input:      #232840   ← инпуты
--color-bg-light:      #13161F   ← светлый фон
--color-accent:        #F5C842   ← золото (основной акцент)
--color-accent-dark:   #E8B61E
--color-text-primary:  #F0F2F8
--color-text-secondary:#8B92A8
--color-text-muted:    #4A5270
--color-green:         #00D68F
--color-red:           #FF4D6A
--color-blue:          #0098EA
--color-purple:        #9B85FF
--color-gold:          #FFD700
--color-border:        rgba(255,255,255,0.1)
```

## ✅ ТИПОГРАФИКА
- Шрифт: **Inter** — везде, без исключений
- Размеры: только через `var(--font-size-*)` (xs/sm/base/md/lg/xl/2xl/3xl)
- Веса: только через `var(--font-weight-*)` (regular/medium/semibold/bold)

## ✅ ОТСТУПЫ (только токены)
```
--space-xs: 4px  |  --space-s: 8px  |  --space-m: 12px
--space-l: 16px  |  --space-xl: 24px
```
- Боковые отступы карточек: минимум `var(--space-l)` (16px / .85rem)
- Иконки в режимных блоках: минимум 40px

## ✅ КОМПОНЕНТЫ
- CoinIcon: золотой конь, viewBox 32×32 — везде одинаково
- Доска по умолчанию: Premium Oak (#DEB887 / #8B4513)
- Модалки: `border-radius: 16px`, `box-shadow: 0 20px 60px rgba(0,0,0,0.5)`
- Кнопки: только через CSS-переменные `var(--btn-*)`

## ✅ АНИМАЦИИ (обязательны для новых элементов)
```css
.cc-fadein  { animation: fadeIn 0.3s ease }
.cc-popIn   { animation: popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) }
.cc-pulse   { animation: pulse 2s infinite }
```

## ✅ АДАПТИВНОСТЬ
- Только CSS `@media` — никаких JS breakpoints
- Мобиль: `max-width: 480px` | Планшет: `max-width: 768px`
- Grid: адаптироваться через `var(--grid-*)` токены

## ✅ ПРОЦЕСС
1. Читай этот файл
2. Читай CLAUDE.md для контекста задачи
3. Минимальные изменения — только то что нужно
4. Одна задача = одна ветка = один коммит
5. Коммит на русском: `feat:`, `fix:`, `refactor:`

## ✅ СТЕК
- Frontend: React + TypeScript (Vite), `/opt/chesscoin/frontend/src/`
- Backend: Node.js/Express, `/opt/chesscoin/backend/`
- БД: PostgreSQL (через pgbouncer), Redis
- Deploy: Docker Compose, `/opt/chesscoin/docker-compose.yml`
