# AGENTS.md

## Общие правила

- Общение с пользователем ведётся **на русском языке**.

## Cursor Cloud specific instructions

### Project overview

ChessCoin is a Telegram Mini App — a chess gaming platform with in-game token economy and P2P exchange. See `README.md` for full architecture and env var documentation.

### Key documents
- `GAME_MECHANICS.md` — полное описание игровых режимов, механик и возможностей (для игроков, разработчиков и AI)
- `ROADMAP.md` — дорожная карта разработки: все задачи, приоритеты, статусы, протокол обновления версий
- `AUDIT.md` — текущий аудит кода (67 находок)
- `.cursorrules` — стек проекта

**Перед началом работы** обязательно следуйте протоколу обновления из `ROADMAP.md` (раздел «Протокол обновления версий»).

### Services

| Service | Port | Start command |
|---------|------|--------------|
| PostgreSQL 16 | 5432 | `sudo docker start chesscoin_postgres` (or create: see below) |
| Redis 7 | 6379 | `sudo docker start chesscoin_redis` (or create: see below) |
| Backend (Node.js 20) | 3000 | `cd backend && npx tsx watch src/index.ts` |
| Frontend (Vite) | 5173 | `cd frontend && npm run dev` |
| Bot (Python, optional) | — | `cd bot && python main.py` |

### Node.js version

This project requires **Node.js 20** (not 22+). The `tsx watch` command in the `npm run dev` script uses a syntax incompatible with Node 22. Use `nvm use 20` before running backend/frontend commands. If nvm isn't loaded, run:
```
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20
```

### Docker containers for PostgreSQL and Redis

If containers don't exist yet, create them:
```
sudo docker run -d --name chesscoin_postgres -e POSTGRES_DB=chesscoin -e POSTGRES_USER=chesscoin -e POSTGRES_PASSWORD=devpass123 -p 5432:5432 postgres:16-alpine
sudo docker run -d --name chesscoin_redis -p 6379:6379 redis:7-alpine redis-server --requirepass devredis123
```

If they already exist but are stopped: `sudo docker start chesscoin_postgres chesscoin_redis`

### Backend dev startup (requires running DB + Redis)

```
cd backend
npx prisma generate
npx prisma migrate deploy
npx tsx watch src/index.ts
```

The `npm run dev` script in `package.json` uses `tsx --tsconfig tsconfig.json -r tsconfig-paths/register watch src/index.ts` which fails on current tsx versions. Use `npx tsx watch src/index.ts` directly instead; path aliases (`@/*`) are resolved by tsx automatically from `tsconfig.json`.

### Backend `.env` file

Copy from `.env.example`. Required non-defaulted values: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. For local dev, use:
- `DATABASE_URL="postgresql://chesscoin:devpass123@localhost:5432/chesscoin?schema=public"`
- `REDIS_PASSWORD=devredis123`
- `JWT_ACCESS_SECRET=dev_access_secret_change_in_production`
- `JWT_REFRESH_SECRET=dev_refresh_secret_change_in_production`

### Key commands

- **Backend tests**: `cd backend && npm test` (122 tests; `referral.test.ts` suite has a known BigInt serialization issue in Jest, all 122 individual tests pass)
- **Backend type check**: `cd backend && npx tsc --noEmit`
- **Frontend build**: `cd frontend && npm run build`
- **Frontend type check**: `cd frontend && npm run typecheck` (may have some TS errors — not yet enforced in CI)
- **Database seed**: `cd backend && npx tsx -r tsconfig-paths/register prisma/seed.ts`

### Notes

- Frontend is a Telegram Mini App. Opening `http://localhost:5173` in a browser shows a landing page asking to open via Telegram bot since the Telegram WebApp SDK context is missing. The full app UI only renders inside Telegram.
- Vite dev server proxies `/api/v1` and `/socket.io` to `http://localhost:3000` (configured in `frontend/vite.config.ts`).
- Backend embeds Stockfish via npm package (`stockfish@16.0.0`) — no external binary needed.
- The bot (Python/aiogram) is optional for local development; it handles Telegram interactions but the core chess and API functionality works without it.
