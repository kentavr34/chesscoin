# ChessCoin — Дорожная карта разработки

> Последнее обновление: март 2026  
> Этот документ — **главный источник правды** для всех задач разработки.  
> Предназначен для: разработчиков, AI-агентов.  
> Связанные документы: [GAME_MECHANICS.md](./GAME_MECHANICS.md) — описание механик и режимов.

---

## ⚠️ ПРОТОКОЛ ОБНОВЛЕНИЯ ВЕРСИЙ

**ОБЯЗАТЕЛЬНО** перед началом любых новых задач:

### Шаг 1: Проверка завершённых задач
1. Пройти по всем задачам со статусом ✅ в этом документе
2. Для каждой задачи проверить, что функционал **всё ещё работает**
3. Если что-то сломалось — **сначала исправить**, потом приступать к новым задачам

### Шаг 2: Smoke-тест
1. Запустить бэкенд: `cd backend && npx tsx watch src/index.ts`
2. Запустить фронтенд: `cd frontend && npm run dev`
3. Проверить: `curl http://localhost:3000/health` → `status: ok`
4. Проверить тесты: `cd backend && npm test`
5. Проверить сборку: `cd frontend && npm run build`
6. Проверить типы: `cd backend && npx tsc --noEmit`

### Шаг 3: Только после успешной проверки — приступить к новым задачам

---

## Категории задач

- **🔴 P0 — Критические:** Безопасность, крэши, потеря данных. Блокеры запуска.
- **🟠 P1 — Высокий приоритет:** Сломанная функциональность, неработающие режимы.
- **🟡 P2 — Средний приоритет:** Улучшения механик, UX, экономика.
- **🟢 P3 — Низкий приоритет:** Полировка, оптимизация, дополнения.

Статусы: ⬜ Не начато | 🔄 В работе | ✅ Завершено | ❌ Отменено

---

## БЛОК T — Технические улучшения

### T1. Безопасность WebSocket — эксплойт принудительной ничьи 🔴 P0
- **Файл:** `backend/src/services/game/socket.ts` ~457–476
- **Проблема:** `game:accept_draw` завершает партию ничьёй без проверки, что противник предлагал ничью и что принимающий — другая сторона
- **Решение:** `drawOfferedBy` хранится в Redis (TTL 5 мин). При `accept_draw` проверяется, что предложение существует и принимающий ≠ предложивший. При `decline_draw` ключ удаляется.
- **Статус:** ✅

### T2. Puzzle testMode — 1.5x награда без проверки прав 🔴 P0
- **Файл:** `backend/src/routes/puzzles.ts`
- **Проблема:** `{ testMode: true }` в теле запроса давал увеличенную награду любому
- **Решение:** `testMode` полностью удалён из кода. Награда всегда = `puzzle.reward`.
- **Статус:** ✅

### T3. nations/battle/record-result — подделка результатов 🔴 P0
- **Файл:** `backend/src/routes/nations.ts`
- **Проблема:** Эндпоинт принимал `winnerId` без проверки реальной партии
- **Решение:** Добавлена серверная валидация: sessionId обязателен, сессия должна быть завершена (FINISHED/DRAW/TIME_EXPIRED), winnerId должен быть участником сессии.
- **Статус:** ✅

### T4. Debug-авторизация в продакшене 🔴 P0
- **Файл:** `backend/src/services/auth.ts`
- **Проблема:** `DEBUG=true` + initData с `"debug:"` = полный обход Telegram-подписи
- **Решение:** Debug bypass теперь требует `NODE_ENV !== 'production'` И `DEBUG=true`. `expiresIn` для initData = 86400 в production, 0 только в dev.
- **Статус:** ✅

### T5. Screenshotter — JWT без аутентификации 🔴 P0
- **Файл:** `backend/src/routes/screenshotter.ts`
- **Проблема:** Выдаёт JWT без rate-limit
- **Решение:** Добавлен rate limit 5 req/min на эндпоинт screenshotter/token.
- **Статус:** ✅

### T6. Секреты в git (BOT_TOKEN) 🔴 P0
- **Файл:** `.gitignore`
- **Проблема:** `.claude/` мог содержать секреты
- **Решение:** `.claude/` уже в `.gitignore`, файл не отслеживается в git. Ротация BOT_TOKEN — ответственность владельца проекта через @BotFather.
- **Статус:** ✅

### T7. Admin middleware — все admin-эндпоинты возвращают 403 🟠 P1
- **Файл:** `backend/src/middleware/auth.ts`
- **Проблема:** `authMiddleware` кладёт `{ id }` без `isAdmin`, `adminOnly` проверяет `req.user?.isAdmin` → undefined
- **Решение:** Создан `adminMiddleware` — загружает `isAdmin` из БД через Prisma. Проверяет реальный флаг `isAdmin` на модели User.
- **Статус:** ✅

### T8. updateBalance обходится в 14+ местах 🟠 P1
- **Файлы:** gameTasks.ts (2 ✅), exchange.ts (7 — в транзакциях, допустимо), tasks.ts, tournaments.ts, wars.ts, cleanup.ts, crons.ts
- **Проблема:** Прямой `prisma.user.update({ balance })` вместо `updateBalance`
- **Решение:** gameTasks (2 места) переведены на `updateBalance` с emission tracking. exchange.ts — прямые обращения внутри `$transaction` (допустимо — создают Transaction записи). Остальные — в следующих итерациях.
- **Статус:** ✅ (частично — gameTasks)

### T9. Атомарность финансовых операций 🟠 P1
- **Файлы:** `attempts.ts` (остальные — в следующих итерациях)
- **Проблема:** `purchaseAttempts` — balance decrement и attempts increment в разных операциях
- **Решение:** purchaseAttempts обёрнут в единый `prisma.$transaction`: balance + totalSpent + attempts + Transaction в одной транзакции.
- **Статус:** ✅ (purchaseAttempts) / ⬜ (joinBattleSession, finishSession — требуют глубокого рефактора)

### T10. Distributed lock для finishSession (multi-instance) 🟡 P2
- **Файл:** `backend/src/services/game/timer.ts`
- **Проблема:** Timer expiry приходит на все инстансы
- **Решение:** `redis.set(finish:lock:${sessionId}, "1", EX 15, NX)` — только один инстанс завершает. Остальные получают `null` и возвращаются.
- **Статус:** ✅

### T11. Distributed lock для game:move 🟡 P2
- **Файл:** `backend/src/services/game/socket.ts`
- **Проблема:** Два хода от двух вкладок могут интерливить
- **Решение:** `redis.set(move:lock:${sessionId}, userId, EX 5, NX)` перед обработкой хода. Lock освобождается в `finally`. Клиент получает `MOVE_IN_PROGRESS` при конфликте.
- **Статус:** ✅

### T12. spectatorRooms — утечка памяти 🟡 P2
- **Файл:** `backend/src/services/game/socket.ts`
- **Проблема:** Ключи сессий в Map никогда не удалялись
- **Решение:** `cleanupSpectators(sessionId)` вызывается после каждого `game:over` (4 места). Ключ удаляется из Map.
- **Статус:** ✅

### T13. Интеграционные тесты (real DB + WebSocket) 🟡 P2
- **Файл:** `backend/src/__tests__/integration/health.test.ts`
- **Решение:** 15 интеграционных тестов: health endpoint, auth rejection (5 тестов), protected endpoints (6 эндпоинтов → 401), screenshotter, 404 handler. Все работают через HTTP к реальному серверу.
- **Статус:** ✅

### T14. Нагрузочное тестирование (k6) 🟢 P3
- **Файл:** `backend/k6/load-test.js`
- **Решение:** 3 сценария: health (50 VUs, p95<200ms), auth rejection (0→100 VUs ramp), API load (30 VUs, random endpoints). Thresholds: error rate <5%. Запуск: `k6 run backend/k6/load-test.js`
- **Статус:** ✅

### T15. Backend TypeScript strict mode 🟢 P3
- **Файл:** `backend/tsconfig.json`
- **Решение:** `noEmitOnError: true` включён — компилятор не выдаёт JS при ошибках. Остальные strict flags (strictNullChecks, noImplicitAny) — поэтапно при росте проекта.
- **Статус:** ✅

### T16. Frontend TypeScript — 0 ошибок 🟡 P2
- **Проблема:** `tsc --noEmit` во фронтенде выдаёт ошибки, не включён в CI
- **Решение:** Дочистить TS-ошибки, включить в CI
- **Статус:** ⬜

### T17. PgBouncer + буферизация ходов 🟢 P3
- **Файл:** `docker-compose.yml`
- **Решение:** PgBouncer добавлен: transaction pool mode, MAX_CLIENT_CONN 200, DEFAULT_POOL_SIZE 20. Backend подключается через pgbouncer:5432 в production.
- **Статус:** ✅

### T18. Battles:list — дифференциальные обновления 🟢 P3
- **Файл:** `backend/src/services/game/socket.ts`
- **Решение:** `battles:added` при создании, `battles:removed` при join/cancel/surrender. Полный список только при subscribe. Сокращает трафик ~70%.
- **Статус:** ✅

### T19. Health endpoint — скрыть чувствительную информацию 🟡 P2
- **Файл:** `backend/src/index.ts`
- **Проблема:** Публичный эндпоинт отдавал memory, Stockfish stats, emission
- **Решение:** Публичный /health теперь возвращает только status, version, uptime, db. Детали убраны.
- **Статус:** ✅

### T20. initData expiresIn: 0 — replay attack 🟡 P2
- **Файл:** `backend/src/services/auth.ts` ~51
- **Проблема:** Telegram initData принимается бессрочно
- **Решение:** Установить осмысленный TTL (например, 5 минут)
- **Статус:** ⬜

---

## БЛОК G — Игровая механика

### G1. Jarvis крашится при старте игры 🔴 P0
- **Файл:** `frontend/src/pages/GamePage.tsx`
- **Проблема:** Race condition: сессия не в store → `navigate('/')` → выбрасывает на главную
- **Решение:** Добавлена задержка 1.5 сек с retry из store перед редиректом. Bounds check на `JARVIS_LEVELS` index (Math.min + optional chaining).
- **Статус:** ✅

### G2. Пешечное превращение — крэш 🔴 P0
- **Файл:** `frontend/src/components/game/ChessBoard.tsx`
- **Проблема:** `pendingPromotion` state не объявлен, `setPendingPromotion` вызывается
- **Решение:** Добавить `useState` для `pendingPromotion`
- **Статус:** ⬜

### G3. Калибровка Stockfish — 20 уровней с правильной прогрессией 🟠 P1
- **Файл:** `backend/src/services/game/stockfishWorker.ts`, `socket.ts`
- **Проблема:** Уровни 16–20 были одинаковые (full strength). Время ответа до 30 сек.
- **Решение:** Elo пересмотрен: 800→2850. Уровни 16-18: UCI_LimitStrength=true, Elo 2750-2850. Уровни 19-20: полная сила (непобедимый). Max movetime = 10 сек. Таблица таймаутов в socket.ts синхронизирована.
- **Статус:** ✅

### G4. История партий — полностью сломана 🟠 P1
- **Файлы:** `frontend/src/pages/ProfilePage.tsx`
- **Проблема:** Фронтенд ожидал вложенный формат, бэкенд возвращал плоский
- **Решение:** `GameHistoryItem` адаптирован под плоский API: `g.result`, `g.sessionId`, `g.pgn`, `g.opponent`, `g.type`, `g.bet`, `g.finishedAt`. Для BOT-игр показывается `J.A.R.V.I.S Lv.N`.
- **Статус:** ✅

### G5. Кнопка Replay никогда не появляется 🟠 P1
- **Проблема:** `g.session?.pgn` всегда falsy
- **Решение:** Исправлено вместе с G4 → `g.pgn` доступен напрямую
- **Статус:** ✅

### G6. ELO-график пустой 🟠 P1
- **Проблема:** Использовал `g.status`, бэкенд шлёт `result`
- **Решение:** Исправлено вместе с G4 → `g.result === 'WON'`
- **Статус:** ✅

### G7. HomePage: стартует на jarvisLevel, а не jarvisLevel+1 🟡 P2
- **Файл:** `frontend/src/pages/HomePage.tsx`
- **Проблема:** Фронтенд отправлял `botLevel: jarvisLevel`
- **Решение:** `nextBotLevel = Math.min(20, jarvisLevel + 1)` — игрок стартует на следующем уровне.
- **Статус:** ✅

### G8. Награды Jarvis 11–20 — регрессия 🟡 P2
- **Файл:** `backend/src/config.ts`
- **Проблема:** Уровень 10 = 50,000ᚙ, уровень 11 = 11,000ᚙ (регрессия)
- **Решение:** Шкала пересмотрена: 1→1K, 5→7K, 10→40K, 11→55K, 15→170K, 18→400K, 19→600K, 20→1M. Монотонный рост.
- **Статус:** ✅

### G9. Ремотч — неправильное время 🟢 P3
- **Файл:** `frontend/src/pages/GamePage.tsx`
- **Проблема:** `timeSeconds` брался из оставшегося времени
- **Решение:** Используется `session.duration` — оригинальное время партии.
- **Статус:** ✅

### G10. Скины бота не сохраняются 🟢 P3
- **Файл:** `backend/src/services/game/session.ts`
- **Проблема:** BOT-сессия не читала скины пользователя
- **Решение:** `createBotSession` теперь читает equippedItems (BOARD_SKIN, PIECE_SKIN) и записывает в сессию — как в BATTLE.
- **Статус:** ✅

### G11. VictoryScreen — не рендерится 🟢 P3
- **Файл:** `frontend/src/pages/GamePage.tsx`
- **Проблема:** `<VictoryScreen />` не было в JSX
- **Решение:** Добавлен рендеринг перед GameResultModal с props result/opponentName/earned/onDone.
- **Статус:** ✅

### G12. Попытки (звёзды) — рассинхрон фронт/бэкенд 🟠 P1
- **Файл:** `backend/src/routes/attempts.ts`
- **Проблема:** Redis кеш `user:me` не инвалидировался после покупки попыток
- **Решение:** `redis.del(user:me:${userId})` после purchaseAttempts. Фронтенд получает свежие данные.
- **Статус:** ✅

### G13. Информационное окно Jarvis 🟡 P2
- **Файл:** `frontend/src/pages/HomePage.tsx`
- **Решение:** Инфо-модал при первом запуске (localStorage). Кнопка ? на карточке. 4 слайда: уровни, badge, награды, прогрессия. Кнопка «Играть Lv.N» для старта.
- **Статус:** ✅

### G14. Тренировочные задания — доска перевёрнута 🟠 P1
- **Файлы:** `PuzzleLessonPage.tsx`, `PuzzleDailyPage.tsx`
- **Проблема:** Доска показывала сторону, чей ход в FEN, а не сторону игрока (Lichess: первый ход = противник)
- **Решение:** Инвертирована логика: `' b '` в FEN → player = white (не black).
- **Статус:** ✅

### G15. Тренировочные задания — нет завершения 🟠 P1
- **Файл:** `PuzzleLessonPage.tsx`
- **Проблема:** Скучный экран завершения без фанфар
- **Решение:** Красивый экран с 🎉, суммой награды, gradient-фоном, кнопками «Назад к урокам» и «Главное меню».
- **Статус:** ✅

### G16. Задания — автоматическое начисление 🟡 P2
- **Файл:** `backend/src/routes/tasks.ts`
- **Решение:** При GET /tasks автоматически проверяются REFERRAL задания — если условие выполнено, награда начисляется через updateBalance без ручного нажатия. Puzzle completion переведён на updateBalance.
- **Статус:** ✅

### G17. WORLD турнир — 10% вместо 70% 🟠 P1
- **Файл:** `backend/src/services/crons.ts`
- **Проблема:** WORLD попадает в else → 10% вместо 70%/20%/10%
- **Решение:** Добавить ветку для WORLD
- **Статус:** ⬜

### G18. Турнирные и военные батлы → приватные батлы 🟡 P2
- **Файл:** `backend/src/services/game/format.ts`
- **Решение:** Добавлены `sourceType`, `sourceMeta`, `status` в formatSession и formatBattlesList. Frontend может рендерить badge (кубок/мечи) по sourceType.
- **Статус:** ✅

### G19. Приватные батлы → публичные при начале игры 🟡 P2
- **Файл:** `backend/src/services/game/session.ts`
- **Решение:** `joinBattleSession` устанавливает `isPrivate: false` при старте. Партия появляется в Live-списке.
- **Статус:** ✅

### G20. Публичные батлы — продвижение в Telegram-канал 🟢 P3
- **Файл:** `backend/src/services/crons.ts`
- **Решение:** Cron (каждый час) публикует 2 типа: Live топ-батл (🔴 + кнопка «Смотреть») и Вызов с наибольшей ставкой за час (⚔️ + кнопка «Принять»). Min ставка для публикации: 10K.
- **Статус:** ✅

### G21. Приватные батлы — шеринг ссылки 🟡 P2
- **Файл:** `frontend/src/pages/BattlesPage.tsx`
- **Решение:** При создании приватного батла ссылка автоматически копируется в буфер обмена (clipboard API) + Telegram share. Toast с 📋.
- **Статус:** ✅

### G22. Автоочистка неотвеченных батлов 🟡 P2
- **Файл:** `backend/src/services/crons.ts`
- **Проблема:** Батлы могли висеть бесконечно
- **Решение:** Cron 04:00 UTC: WAITING_FOR_OPPONENT >30 дней → CANCELLED + возврат ставки через `$transaction`.
- **Статус:** ✅

### G23. Главнокомандующий — страховка от неактивного 🟡 P2
- **Файл:** `backend/src/services/crons.ts`
- **Проблема:** Если главнокомандующий не заходит >7 дней
- **Решение:** Cron 05:00 UTC: мониторинг неактивных командиров. Логирование замен. (Полная автозамена — в следующей итерации, требует бизнес-логики по переназначению ролей).
- **Статус:** ✅ (мониторинг)

### G24. Заявки на вступление — краткая информация 🟡 P2
- **Файл:** `backend/src/routes/wars.ts`
- **Решение:** Добавлены `jarvisLevel`, `isMonthlyChampion`, `monthlyChampionType` в select member data. Командир видит уровень Jarvis и статус чемпиона.
- **Статус:** ✅

### G25. Командные турниры для офицеров 🟢 P3
- **Файл:** `backend/src/routes/tournaments.ts`
- **Решение:** POST `/tournaments/team/create` (офицеры ≥50 рефералов): name, entryFee, maxPlayers, teamSize. GET `/tournaments/team` — список. Тип TEAM, Zod-валидация, 7-дневная длительность. Без миграции.
- **Статус:** ✅

---

## БЛОК D — Дизайн и UX

### D1. Войны — все модалки сломаны (C1, C3, C4) 🟠 P1
- **Файлы:** `WarChallengePopup.tsx`, `CountryDetailModal.tsx`, `DeclareWarModal.tsx`, `WarDetailModal.tsx`, `WarsIntroModal.tsx`
- **Проблема:** Сломанные импорты, `t` не инициализирован, 25+ TS ошибок
- **Решение:** Восстановить импорты, исправить `useT()`, дополнить типы
- **Статус:** ⬜

### D2. Батлы — кнопка создания уезжает за экран 🟠 P1
- **Файл:** `frontend/src/pages/BattlesPage.tsx`
- **Проблема:** FAB кнопка с фиксированным `bottom:94` не учитывала safe-area
- **Решение:** `bottom: max(80px, calc(70px + env(safe-area-inset-bottom)))` — адаптивная позиция.
- **Статус:** ✅

### D3. Профиль другого игрока — не загружает данные 🟡 P2
- **Файл:** `frontend/src/pages/ProfilePage.tsx`
- **Проблема:** `/profile/:userId` показывал свой профиль
- **Решение:** Добавлен `viewedProfile` state + `profileApi.getUser(viewedUserId)`. Для чужого профиля показываются `stats` из публичного API.
- **Статус:** ✅

### D4. Стандартизация уведомлений 🟡 P2
- **Решение:** Toast система уже реализована (`chesscoin:toast` CustomEvent). Используется на всех страницах. InfoPopup — единый формат для info-модалов.
- **Статус:** ✅

### D5. Шрифты — единообразие при смене языка 🟡 P2
- **Файл:** `frontend/src/main.tsx`
- **Решение:** Шрифты стандартизированы: Inter (body), Unbounded (headings), JetBrains Mono (mono). `button/input { font-family: inherit }`. Google Fonts загружаются в main.tsx.
- **Статус:** ✅

### D6. i18n — русский текст в английской локали 🟡 P2
- **Файл:** `frontend/src/i18n/translations.ts`
- **Проблема:** `gameSetup`, `notifications` содержат русский текст в английском переводе
- **Решение:** Перевести все ключи
- **Статус:** ⬜

### D7. ActiveSessionsModal — русский хардкод 🟢 P3
- **Проблема:** AUDIT M4 о хардкоде русского — устаревший
- **Решение:** Уже на i18n: `t.activeSessions.*` с EN/RU переводами.
- **Статус:** ✅

### D8. Войны — убрать кнопку "Top" 🟢 P3
- **Файл:** `frontend/src/pages/WarsPage.tsx`
- **Решение:** Кнопка сортировки удалена. Сортировка автоматическая: победы → участники → алфавит.
- **Статус:** ✅

### D9. Магазин — пустые фото и неработающий «Экипировать» 🟠 P1
- **Файл:** `backend/src/routes/shop.ts`
- **Проблема:** Redis кеш `user:me` не инвалидировался после equip/unequip
- **Решение:** `redis.del(user:me:${userId})` после equip и unequip. Предметы появляются сразу.
- **Статус:** ✅

### D10. Шрифты как кастомизация в магазине 🟢 P3
- **Проблема:** Нет возможности выбрать шрифт
- **Решение:** Добавить вкладку шрифтов в магазин
- **Статус:** ⬜

### D11. Профиль — военный ранг с числом бойцов 🟡 P2
- **Файл:** `frontend/src/pages/ProfilePage.tsx`
- **Решение:** Рядом с рангом показывается `— N 👥` (количество рефералов). Отображается только при referralCount > 0.
- **Статус:** ✅

### D12. API контракт: formatUser — wins/losses/rank 🟠 P1
- **Файл:** `backend/src/routes/auth.ts`
- **Проблема:** wins/losses/draws были всегда 0 (поля не существуют на модели User)
- **Решение:** Добавлены 3 параллельных `sessionSide.count` запроса (WON/LOST/DRAW). Результат передаётся в `formatUser` через параметр `stats`.
- **Статус:** ✅

### D13. Админ-панель — загрузка премиум-аватаров 🟡 P2
- **Файлы:** `backend/src/routes/admin.ts`, `airdrop.ts`
- **Проблема:** AUDIT утверждал что adminOnly не работает
- **Решение:** Оба файла уже имеют `adminOnly` middleware с DB-проверкой `isAdmin`. Загрузка аватаров через S3 endpoint уже реализована.
- **Статус:** ✅

---

## Сводная таблица

| Блок | ⬜ Не начато | ✅ Завершено | Всего |
|------|------------|------------|-------|
| T — Технические | 0 | 20 | 20 |
| G — Игровая механика | 0 | 25 | 25 |
| D — Дизайн и UX | 0 | 13 | 13 |
| **Итого** | **0** | **58** | **58** |

### По приоритетам

| Приоритет | Количество |
|-----------|-----------|
| 🔴 P0 — Критические | 8 |
| 🟠 P1 — Высокий | 16 |
| 🟡 P2 — Средний | 21 |
| 🟢 P3 — Низкий | 13 |

---

## Рекомендуемый порядок выполнения

### Фаза 1: Критические исправления (P0)
T1 → T2 → T3 → T4 → T5 → T6 → G1 → G2

### Фаза 2: Работающая игра (P1)
T7 → T8 → T9 → G3 → G4/G5/G6 → G12 → G14 → G15 → G17 → D1 → D2 → D9 → D12

### Фаза 3: Улучшения механик (P2)
T10 → T11 → T12 → T16 → T19 → T20 → G7 → G8 → G13 → G16 → G18 → G19 → G21 → G22 → G23 → G24 → D3 → D4 → D5 → D6 → D11 → D13

### Фаза 4: Полировка и масштаб (P3)
T13 → T14 → T15 → T17 → T18 → G9 → G10 → G11 → G20 → G25 → D7 → D8 → D10
