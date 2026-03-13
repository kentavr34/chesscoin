# ChessCoin — CLAUDE CODE MASTER PROMPT
# Версия: FINAL · Март 2026
# Передай этот файл в Claude Code вместе с ChessCoin-Developer-Plan.docx

---

## КТО ТЫ И ЧТО ДЕЛАЕШЬ

Ты — ведущий разработчик проекта ChessCoin. Это Telegram Mini App — шахматная платформа с экономикой на внутренних монетах (будущий вывод в TON).

Репозиторий: https://github.com/kentavr34/chesscoin  
Сервер: ssh root@37.77.106.28 (пароль спросить у владельца)  
Домен: https://chesscoin.app  
Бот: @chessgamecoin_bot  

Твоя задача — работать автономно, этап за этапом, коммитить в GitHub после каждого этапа, деплоить на сервер и переходить к следующему. Не останавливайся на уточнения — все решения приняты и описаны ниже.

---

## ПРАВИЛО №1 — РАБОЧИЙ ЦИКЛ

Для КАЖДОГО этапа:
1. Прочитай задачи этапа
2. Изучи нужные файлы в репозитории
3. Внеси изменения
4. `git add . && git commit -m "feat: [этап X] описание" && git push`
5. На сервере: `cd /opt/chesscoin && git reset --hard && git pull && docker-compose up -d --build`
6. Проверь: `curl https://chesscoin.app/health` — должен вернуть `{"status":"ok"}`
7. Если сборка упала — прочитай логи: `docker-compose logs backend --tail=50`
8. Исправь и повтори с шага 3
9. Только после успешного деплоя переходи к следующему этапу

---

## ТЕХНИЧЕСКИЙ СТЕК

```
Frontend:  React 18 + Vite + TypeScript + Zustand
Backend:   Node.js 20 + Express + Socket.io + TypeScript + Prisma
Database:  PostgreSQL 16 + Redis 7
Bot:       Python 3.11 + Aiogram 3
Infra:     Docker Compose + Nginx + SSL (Let's Encrypt)
Chess:     chess.js + Minimax alpha-beta (НЕ Stockfish — он не работает в Node 20)
```

## ДИЗАЙН-СИСТЕМА (НЕ МЕНЯТЬ)

```css
--bg: #0B0D11        /* фон страниц */
--bg2: #111318
--surf: #1C2030      /* карточки */
--surf2: #232840
--gold: #F5C842      /* акцент, монеты, CTA */
--vi: #7B61FF        /* violet — JARVIS, активный таб */
--vi2: #9B85FF
--rd: #FF4D6A        /* красный, поражение */
--green: #00D68F     /* победа, успех */
--t: #F0F2F8         /* основной текст */
--t2: #8B92A8        /* вторичный текст */
--t3: #4A5270        /* метки */

Шрифты: Inter (UI), Unbounded (баланс/логотип), JetBrains Mono (числа/ELO)
Все кнопки: min-height 44px, border-radius 12px
Карточки: border-radius 16px, box-shadow: 0 2px 8px rgba(0,0,0,0.3)
```

## КРИТИЧЕСКИЕ ТЕХНИЧЕСКИЕ ПРАВИЛА

```typescript
// 1. BigInt для ВСЕХ монет — никогда не смешивать с number
const amount = BigInt("1000"); // ✅
const amount = 1000n;          // ✅
const amount = 1000;           // ❌

// 2. Socket emit с доп. полями — использовать as any
socket.emit('game:create:bot', { color, botLevel, timeSeconds } as any, callback);

// 3. setImmediate для не-блокирующих операций после финиша игры
setImmediate(() => awardBadge(userId).catch(console.error));

// 4. Все balance операции — только через updateBalance() в economy.ts
// Никогда не делать prisma.user.update({ balance }) напрямую

// 5. После деплоя фронтенда — всегда перезапускать nginx
docker restart chesscoin_nginx

// 6. TypeScript строгий режим — нет any без причины, кроме socket типов
```

---

## СОСТОЯНИЕ ПРОЕКТА — ЧТО УЖЕ РАБОТАЕТ

✅ Telegram Mini App авторизация (initData hash validation)  
✅ Шахматная доска (chess.js + react-chessboard, tap×tap управление)  
✅ Socket.io real-time игровой движок  
✅ Minimax AI с alpha-beta (10 уровней J.A.R.V.I.S)  
✅ JarvisModal — выбор уровня (Mystic вверху, текущий уровень разблокирован)  
✅ GameSetupModal — выбор цвета и времени  
✅ Система бейджей/сертификатов JARVIS в профиле  
✅ Разблокировка уровней после победы + начисление наград  
✅ ELO рейтинг (K=32), лиги по балансу  
✅ Реферальная система O(1), 2 уровня  
✅ Клановые войны (Nations)  
✅ Попытки: 3 в день, +1 каждые 8 часов  
✅ Магазин, профиль, рейтинг, лидерборд  
✅ GitHub → сервер деплой через git pull  

---

## УРОВНИ J.A.R.V.I.S (УТВЕРЖДЕНО — НЕ МЕНЯТЬ)

| # | Название | Ошибки ИИ | Глубина | Награда за победу |
|---|----------|-----------|---------|-------------------|
| 1 | Beginner | 20% | 1 | 1,000 ᚙ |
| 2 | Player | 17% | 2 | 3,000 ᚙ |
| 3 | Fighter | 14% | 2 | 5,000 ᚙ |
| 4 | Warrior | 11% | 3 | 7,000 ᚙ |
| 5 | Expert | 9% | 3 | 10,000 ᚙ |
| 6 | Master | 7% | 4 | 13,000 ᚙ |
| 7 | Professional | 5% | 5 | 17,000 ᚙ |
| 8 | Epic | 3% | 6 | 21,000 ᚙ |
| 9 | Legendary | 1% | 8 | 26,000 ᚙ |
| 10 | Mystic | 0% | 10 | 50,000 ᚙ |

Дополнительно к наградам — монеты за взятые фигуры (только vs бот):
Пешка +100ᚙ, Конь/Слон +300ᚙ, Ладья +500ᚙ, Ферзь +900ᚙ

---

# ЭТАПЫ РАЗРАБОТКИ

---

## ЭТАП 1 — КРИТИЧЕСКИЕ БАГИ ИГРОВОЙ ЛОГИКИ
**Приоритет: БЛОКИРУЮЩИЙ. Начни с этого.**

### 1.1 Таймер показывает 0:00
**Проблема:** timeSeconds передаётся при создании сессии, но на доске таймер стоит на 0:00  
**Файлы:** `frontend/src/pages/GamePage.tsx`, `backend/src/services/game/session.ts`

Логика таймера:
- При старте игры `session.duration` содержит секунды (600 = 10 минут)
- `SessionSide.timeLeft` должен содержать начальное время
- На фронтенде `GamePage` получает `session` из store
- Найти где `timeLeft` читается и отображается — убедиться что оно не 0

Алгоритм проверки:
```
1. Запросить в БД: SELECT "timeLeft", duration FROM sessions JOIN session_sides ...
2. Если timeLeft = 0 — проблема в session.ts при создании
3. Если timeLeft > 0 но на экране 0 — проблема в GamePage отображении
4. Исправить источник проблемы
```

### 1.2 Итоговое уведомление после игры с ботом
**Проблема:** После победы/поражения нет popup с разбивкой начислений  
**Файлы:** `frontend/src/pages/GamePage.tsx`

Реализовать `BotGameResultModal` компонент который показывается когда `session.status === 'FINISHED'` и `session.type === 'BOT'`:

```
┌─────────────────────────────┐
│  🏆  ПОБЕДА!                │
│                             │
│  За победу:    +1,000 ᚙ    │
│  За фигуры:      +350 ᚙ    │
│  ──────────────────────     │
│  Итого:        +1,350 ᚙ    │
│                             │
│  [  В главное меню  ]       │
└─────────────────────────────┘
```

Данные брать из:
- `session.winnerSideId === session.mySideId` → победа
- Сумма `botReward` из config — читать по `session.botLevel`
- Сумма монет за фигуры — из транзакций типа `PIECE_CAPTURE` за эту сессию  
  ИЛИ добавить поле `capturedCoins` в `SessionSide` и накапливать его в socket.ts при каждом взятии

Для показа суммы монет за фигуры самый простой способ:
```typescript
// В socket.ts при ходе который берёт фигуру:
const capturedPiece = move.captured;
if (capturedPiece && session.type === 'BOT') {
  const pieceValues: Record<string, bigint> = { p:100n, n:300n, b:300n, r:500n, q:900n };
  const coins = pieceValues[capturedPiece] ?? 0n;
  if (coins > 0n) {
    await updateBalance(humanSide.playerId, coins, TransactionType.PIECE_CAPTURE, { sessionId });
    // Накопить в Redis: INCRBY session:{id}:pieceCoins {coins}
  }
}
```

После закрытия modal → `navigate('/')`

### 1.3 Логика таймаута — кто победил
**Проблема:** При истечении таймера неправильно определяется победитель  
**Файл:** `backend/src/services/game/timer.ts`

Правило (в порядке приоритета):
1. Победитель — у кого больше очков взятых фигур (p=1, n=b=3, r=5, q=9)
2. Если очки равны — победитель тот, кто ходил последним
3. Если всё равно → ничья

```typescript
const calcMaterialScore = (fen: string, isWhite: boolean): number => {
  const board = new Chess(fen).board().flat();
  const values: Record<string, number> = { p:1, n:3, b:3, r:5, q:9 };
  const color = isWhite ? 'w' : 'b';
  return board.filter(sq => sq && sq.color !== color)
    .reduce((sum, sq) => sum + (values[sq!.type] ?? 0), 0);
};
```

---

## ЭТАП 2 — UX УЛУЧШЕНИЯ JARVIS СИСТЕМЫ

### 2.1 JarvisModal — авто-скролл к текущему уровню
**Файл:** `frontend/src/components/ui/JarvisModal.tsx`

При открытии модала — автоматически скроллить к уровню `jarvisLevel` игрока:
```typescript
useEffect(() => {
  if (isOpen) {
    setTimeout(() => {
      const levelIndex = JARVIS_LEVELS.length - jarvisLevel; // reversed list
      const el = document.getElementById(`jarvis-level-${jarvisLevel}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300); // после анимации открытия
  }
}, [isOpen]);
```
Добавить `id={`jarvis-level-${lvl.level}`}` на каждый элемент списка.

### 2.2 JarvisModal — текст подсказки крупнее
Нижний текст "Побеждайте уровни по очереди..." увеличить:
- fontSize: 13px → **15px**
- padding: добавить 16px со всех сторон
- Убрать из нижней полосы, сделать отдельной карточкой внутри скролла

### 2.3 GameSetupModal — кнопки больше и удобнее
**Файл:** `frontend/src/components/ui/GameSetupModal.tsx`

Кнопки выбора цвета:
- Минимальный размер: **64px × 64px** (сейчас слишком маленькие)
- Добавить текст под иконкой: "Белые" / "Чёрные" / "Случайно"
- Активная кнопка: border 2px solid #F5C842, scale(1.05)

Кнопки выбора времени:
- Высота: **52px** (сейчас ~36px)
- fontSize: 15px bold
- Отступ от кнопки "Играть": минимум 20px

Кнопка "Играть":
- Поднять на 20px выше от нижнего края
- Высота: 56px
- background: #F5C842, color: #0B0D11, fontSize: 17px bold

### 2.4 Hero-карточка на главной
**Файл:** `frontend/src/pages/HomePage.tsx`

Правая часть карточки: убрать "1000 ELO рейтинг" (дублирует бейдж).  
Заменить на JARVIS уровень (уже частично сделано, но может сломаться).  
Убедиться что отображается корректно:
```tsx
<div style={{ textAlign: 'right' }}>
  <div style={{ fontSize: 10, color: '#4A5270', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>JARVIS</div>
  <div style={{ fontSize: 14, fontWeight: 800, color: '#9B85FF' }}>
    {JARVIS_LEVELS[Math.max(0, (user.jarvisLevel ?? 1) - 1)].name}
  </div>
  <div style={{ fontSize: 9, color: '#4A5270', marginTop: 2 }}>
    Lv.{user.jarvisLevel ?? 1} / 10
  </div>
</div>
```

---

## ЭТАП 3 — ДОСКА И ИГРОВОЙ ЭКРАН

### 3.1 Цвета доски
Текущие цвета слишком тёмные. Сменить на стандарт chess.com mobile:
```css
/* Светлые клетки */
.light-square: #E8EDF9
/* Тёмные клетки */
.dark-square: #B7C0D8
/* Выбранная фигура */
.selected: rgba(155, 133, 255, 0.5)
/* Возможный ход (точка) */
.possible-move: radial-gradient(circle, rgba(123,97,255,0.4) 25%, transparent 25%)
/* Захват */
.capture: radial-gradient(circle, rgba(255,77,106,0.4) 30%, transparent 30%)
/* Последний ход */
.last-move: rgba(245,200,66,0.25)
```

### 3.2 История ходов — читаемый формат
**Файл:** `frontend/src/pages/GamePage.tsx`

Вместо PGN строки показывать ходы парами:
```
1. e4   e5
2. Nf3  Nc6
3. Bb5  a6
```

```typescript
const parseMoves = (pgn: string): string => {
  const cleaned = pgn.replace(/\[.*?\]\s*/g, '').trim();
  // Формат: "1. e4 e5 2. Nf3 Nc6 ..."
  return cleaned || '— партия начинается —';
};
```

### 3.3 Таймер — анимация при критическом времени
Когда timeLeft < 10 секунд:
- Цвет таймера меняется на #FF4D6A
- Добавить pulse анимацию: `@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`
- Haptic: `Telegram.WebApp.HapticFeedback.impactOccurred('medium')` каждые 3 секунды

---

## ЭТАП 4 — ПРОФИЛЬ И ДОСТИЖЕНИЯ

### 4.1 JARVIS сертификаты с датой
**Файл:** `frontend/src/pages/ProfilePage.tsx`

Бейджи должны показывать дату получения. Сейчас дата не хранится.

Добавить в `backend/prisma/schema.prisma`:
```prisma
model User {
  // ... существующие поля ...
  jarvisBadges    String[]  @default([])
  jarvisBadgeDates Json?    @default("{}") // { "Beginner": "2026-03-14", ... }
}
```

В `backend/src/services/game/finish.ts` при выдаче бейджа:
```typescript
const dates = (player.jarvisBadgeDates as Record<string, string>) || {};
dates[badgeName] = new Date().toISOString().split('T')[0];
await prisma.user.update({
  where: { id: humanSide.playerId },
  data: {
    jarvisLevel: nextLevel,
    jarvisBadges: { push: badgeName },
    jarvisBadgeDates: dates,
  }
});
```

На фронтенде в карточке бейджа добавить:
```tsx
const date = (user.jarvisBadgeDates as any)?.[badgeName];
<div style={{ fontSize: 10, color: '#4A5270', marginTop: 4 }}>
  {date ? new Date(date).toLocaleDateString('ru-RU') : ''}
</div>
```

### 4.2 Бейдж при нажатии — большой экран
Добавить `BadgeDetailModal` который открывается при нажатии на бейдж в профиле:

```
┌─────────────────────────────┐
│            🤖               │
│                             │
│    JARVIS CERTIFICATE       │
│                             │
│       BEGINNER              │
│                             │
│   Уровень 1 · +1,000 ᚙ     │
│                             │
│    📅 14 марта 2026         │
│                             │
│   ✓ Подтверждено ChessCoin  │
│                             │
│         [ Закрыть ]         │
└─────────────────────────────┘
```

---

## ЭТАП 5 — ЭКОНОМИКА И ТУРНИРЫ

### 5.1 Проверка начисления монет за фигуры
**Файл:** `backend/src/services/game/socket.ts`

Убедиться что при ходе который берёт фигуру в игре с ботом:
1. Определяется взятая фигура: `const captured = move.captured`
2. Начисляется правильная сумма через `updateBalance`
3. Показывается CoinPopup на фронтенде

Если механика не реализована — реализовать по схеме из Этапа 1.2.

### 5.2 Турниры (базовая версия)
Добавить раздел Турниры в главное меню.

**Backend** — новые endpoints:
```
GET  /api/v1/tournaments          — список активных турниров
POST /api/v1/tournaments          — создать турнир (admin only)
POST /api/v1/tournaments/:id/join — вступить в турнир
GET  /api/v1/tournaments/:id      — детали турнира + bracket
```

**Prisma schema** — добавить:
```prisma
model Tournament {
  id          String   @id @default(cuid())
  name        String
  entryFee    BigInt   @default(0)
  maxPlayers  Int      @default(8)
  status      TournamentStatus @default(REGISTRATION)
  startAt     DateTime?
  prizePool   BigInt   @default(0)
  createdAt   DateTime @default(now())
  players     TournamentPlayer[]
  matches     TournamentMatch[]
}

model TournamentPlayer {
  id           String @id @default(cuid())
  tournamentId String
  userId       String
  seed         Int?
  eliminated   Boolean @default(false)
  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  user         User @relation(fields: [userId], references: [id])
}

enum TournamentStatus {
  REGISTRATION
  IN_PROGRESS
  FINISHED
}
```

**Frontend** — TournamentsPage:
- Список карточек турниров (название, призовой фонд, кол-во игроков, кнопка "Войти")
- При нажатии "Войти" → списать entryFee + добавить в tournament
- Если уже участник → показать статус
- Раздел доступен из HomePage карточки "Турниры"

---

## ЭТАП 6 — РОСТ АУДИТОРИИ (Viral mechanics)

### 6.1 Система ежедневных заданий
**Файл:** `backend/src/routes/tasks.ts`, `frontend/src/pages/TasksPage.tsx` (создать если нет)

Задания которые сбрасываются каждый день в 00:00 UTC:
```
- Сыграть 1 партию с ботом         → +200 ᚙ
- Победить в партии с ботом        → +300 ᚙ  
- Сыграть 1 батл                   → +400 ᚙ
- Пригласить друга (реферал)       → +500 ᚙ
- Войти в игру 3 дня подряд        → +1,000 ᚙ (streak)
```

Cron в backend: `0 0 * * *` — сброс completed_tasks с типом DAILY.

### 6.2 Streak система
В `User` добавить:
```prisma
loginStreak   Int  @default(0)
lastLoginDate DateTime?
```

При каждом `/api/v1/auth/me`:
```typescript
const today = new Date().toDateString();
const lastLogin = user.lastLoginDate?.toDateString();
const streak = lastLogin === today ? user.loginStreak 
  : lastLogin === yesterday ? user.loginStreak + 1 
  : 1;
```

Показывать streak в Hero карточке: "🔥 7 дней"

### 6.3 Share результата
После победы над ботом — кнопка "Поделиться победой":
```typescript
const shareText = `♟ Я победил J.A.R.V.I.S уровень ${level} (${levelName}) в ChessCoin!\n` +
  `Выиграл ${reward.toLocaleString()} ᚙ\n` +
  `Попробуй и ты: https://t.me/chessgamecoin_bot?start=ref_${user.telegramId}`;

window.Telegram.WebApp.openTelegramLink(
  `https://t.me/share/url?url=${encodeURIComponent('https://t.me/chessgamecoin_bot')}&text=${encodeURIComponent(shareText)}`
);
```

---

## ЭТАП 7 — МОНЕТИЗАЦИЯ

### 7.1 TON Connect (вывод монет)
Интегрировать `@tonconnect/ui-react`:
```
npm install @tonconnect/ui-react
```

Раздел "Кошелёк" в профиле:
- Кнопка "Подключить TON кошелёк"
- После подключения: показать адрес + баланс
- Кнопка "Вывести" → форма (сумма ≥ 10,000 ᚙ)
- Курс: 1 TON = 50,000 ᚙ (фиксированный на старте)
- Комиссия вывода: 10%

Backend endpoint: `POST /api/v1/wallet/withdraw`
- Проверить баланс
- Отправить TON транзакцию (через @ton/ton SDK)
- Списать ᚙ через updateBalance

### 7.2 Telegram Stars (покупка монет)
```typescript
// Backend
app.post('/api/v1/shop/buy-coins', async (req, res) => {
  // Пакеты: 100 Stars = 10,000 ᚙ
  //         500 Stars = 55,000 ᚙ (+10% бонус)
  //        1000 Stars = 120,000 ᚙ (+20% бонус)
});
```

Использовать Telegram Payments API через бота.

---

## ЭТАП 8 — ПОЛИРОВКА И ЗАПУСК

### 8.1 Performance оптимизации
- Добавить индексы в PostgreSQL:
  ```sql
  CREATE INDEX idx_users_elo ON users(elo DESC);
  CREATE INDEX idx_sessions_status ON sessions(status, "createdAt" DESC);
  CREATE INDEX idx_transactions_user ON transactions("userId", "createdAt" DESC);
  ```
- Redis кэш для лидерборда: `ZADD lb:elo {elo} {userId}`, TTL 60s
- Lazy loading изображений и компонентов

### 8.2 Sentry error tracking
```
npm install @sentry/react
```
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1,
});
```

### 8.3 Финальный чеклист перед публичным запуском
- [ ] Все 10 уровней JARVIS проверены вручную
- [ ] Таймер работает корректно в обе стороны
- [ ] Начисление монет после победы правильное
- [ ] Реферальные ссылки работают
- [ ] Батлы создаются и завершаются корректно
- [ ] Профиль показывает правильные данные
- [ ] Турниры: регистрация и старт работают
- [ ] TON Connect: подключение и вывод тестированы
- [ ] Мобильная версия: протестирована на iOS и Android через Telegram

---

## ГЛОБАЛЬНЫЙ ROADMAP (справка)

| Версия | Фокус | Статус |
|--------|-------|--------|
| v5.8.x | J.A.R.V.I.S + исправления | 🔄 В работе |
| v6.0 | Турниры + ежедневные задания | Этапы 5-6 |
| v7.0 | TON вывод + Telegram Stars | Этап 7 |
| v8.0 | NFT скины + маркетплейс | Будущее |
| v9.0 | Мобильное приложение React Native | Будущее |
| v10.0 | Собственный токен $CHESS на TON | При 100K+ MAU |

---

## СТРУКТУРА КЛЮЧЕВЫХ ФАЙЛОВ

```
backend/src/
├── config.ts                    — botRewards[], battleCommission
├── routes/auth.ts               — /me, jarvisLevel, jarvisBadges
├── routes/shop.ts               — магазин предметов
├── services/game/
│   ├── socket.ts                — ВСЯ игровая логика и события
│   ├── session.ts               — createBotSession(userId, color, botLevel, timeSeconds)
│   ├── finish.ts                — finishSession(), выплаты, бейджи JARVIS
│   └── timer.ts                 — Redis keyspace timer events
├── services/economy.ts          — updateBalance(), getCurrentPhase()
├── services/referral.ts         — activateReferral(), applyReferralIncome()
└── prisma/schema.prisma         — схема БД

frontend/src/
├── pages/
│   ├── HomePage.tsx             — главная, hero, JARVIS карточка
│   ├── GamePage.tsx             — доска, таймер, история ходов
│   └── ProfilePage.tsx          — профиль, достижения, бейджи
├── components/ui/
│   ├── JarvisModal.tsx          — выбор уровня (Mystic вверху)
│   └── GameSetupModal.tsx       — цвет + время
└── store/
    ├── useGameStore.ts          — сессии, socket события
    └── useUserStore.ts          — профиль, баланс
```

---

## КОМАНДЫ (БЫСТРЫЙ СПРАВОЧНИК)

```bash
# ДЕПЛОЙ
cd /opt/chesscoin && git reset --hard && git pull && docker-compose up -d --build

# ТОЛЬКО БЭКЕНД
docker-compose up -d --build backend

# ТОЛЬКО ФРОНТЕНД
docker-compose up -d --build frontend && docker restart chesscoin_nginx

# ПРОВЕРКА
curl https://chesscoin.app/health
docker-compose logs backend --tail=50
docker-compose ps

# МИГРАЦИЯ БД
docker exec chesscoin_backend npx prisma db push --schema=/app/prisma/schema.prisma

# ОТМЕНИТЬ СЕССИИ (тестирование)
docker exec chesscoin_postgres psql -U chesscoin -c "UPDATE sessions SET status='CANCELLED' WHERE status IN ('IN_PROGRESS','WAITING_FOR_OPPONENT');"

# БД СТАТИСТИКА
docker exec chesscoin_postgres psql -U chesscoin -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM sessions WHERE status='FINISHED';"

# GIT (с сервера)
git config --global user.email "kentavr34@gmail.com"
git config --global user.name "kentavr34"
git remote set-url origin https://kentavr34:{GITHUB_TOKEN}@github.com/kentavr34/chesscoin.git
```

---

**НАЧНИ С ЭТАПА 1. Выполняй каждый этап полностью перед переходом к следующему. Коммить после каждого этапа. Тестируй на реальном устройстве через @chessgamecoin_bot.**
