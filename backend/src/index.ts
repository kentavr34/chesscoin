import "dotenv/config";
import { logger, logError } from "@/lib/logger"; // Q2

// ─── Глобальные обработчики необработанных ошибок ─────────────────────────────
process.on("unhandledRejection", (reason) => {
  logger.error("[PROCESS] Unhandled rejection:", reason instanceof Error ? reason.message : String(reason));
  if (reason instanceof Error && reason.stack) {
    logger.error("[PROCESS] Stack:", reason.stack);
  }
});

process.on("uncaughtException", (err) => {
  logger.error("[PROCESS] Uncaught exception:", err.message);
  logger.error("[PROCESS] Stack:", err.stack);
  // Даём время записать логи, потом выходим
  setTimeout(() => process.exit(1), 1000);
});

import express from "express";
import cors from "cors";
import compression from "compression"; // OPT-2: gzip сжатие ответов
import helmet from "helmet"; // Q4: security headers

// ─── Глобальный фикс BigInt сериализации ─────────────────────────────────────
// Патч обратной совместимости — для res.json() с BigInt полями.
// Для новых роутов: safeJson из @/lib/json. Удалить в v6.1 после полного перехода.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { prisma } from "@/lib/prisma";
import { redis, connectRedis, redisPub, redisSub } from "@/lib/redis";
import config from "@/config";
import { startAttemptsCron } from "@/services/attempts";
import { startCleanupCron } from "@/services/cleanup";
import { startTimerWatcher } from "@/services/game/timer";
import { setIo } from "@/lib/io";
import { setupSocketHandlers } from "@/services/game/socket";
import { startGameCrons } from "@/services/crons";
import { startWarMatchmakingCron } from "@/services/game/warMatchmaking";

// Routes
import authRoutes from "@/routes/auth";
import leaderboardRoutes from "@/routes/leaderboard";
import profileRoutes from "@/routes/profile";
import attemptsRoutes from "@/routes/attempts";
import { shopRouter } from "@/routes/shop";
import { exchangeRouter } from "@/routes/exchange";
import { stockfishPool } from "@/services/game/stockfishPool";
import { airdropRouter } from "@/routes/airdrop";
import gamesRouter from "@/routes/games";
import { tasksRouter } from "@/routes/tasks";
import { botRouter } from "@/routes/bot";
import { nationsRouter } from "@/routes/nations";
import { warsRouter } from "@/routes/wars";
import tournamentsRouter from "@/routes/tournaments";
import screenshotterRouter from "@/routes/screenshotter";
import { puzzlesRouter } from "@/routes/puzzles";
import { adminRouter } from "@/routes/admin";
import { rateLimit } from "express-rate-limit";

const app = express();
app.set('trust proxy', 1); // за nginx — нужно для express-rate-limit
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: config.server.frontendUrl, methods: ["GET", "POST"], credentials: true },
  transports: ["websocket"], // OPT-3: только WebSocket (polling = 3x overhead)
  pingTimeout: 20000,      // Q7: 20 сек — disconnect если нет ответа на ping
  pingInterval: 25000,     // Q7: ping каждые 25 сек
  maxHttpBufferSize: 1e6,  // Q7: 1MB — защита от огромных пакетов
  connectTimeout: 10000,   // Q7: 10 сек на handshake
});
setIo(io); // BUG-01 fix: регистрируем io для использования в routes без circular dependency

// OPT-2: Gzip compression — ДО всех роутов (экономит 60-80% трафика)
app.use(compression({ level: 6, threshold: 1024 })); // не сжимать файлы < 1KB

// Q4: Security headers — helmet ДО cors и роутов
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Telegram WebApp использует iframe
  frameguard: false,                // Telegram тоже использует фреймы
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://telegram.org", "https://*.telegram.org"],
      connectSrc:  ["'self'", "wss:", "https:"],
      imgSrc:      ["'self'", "data:", "https:", "blob:"],
      mediaSrc:    ["'self'", "https:"],
    }
  }
}));
app.use(cors({ origin: config.server.frontendUrl, credentials: true }));
app.use(express.json({ limit: "10mb" }));

const API = "/api/v1";

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});
app.use(limiter);
app.use(`${API}/auth`, rateLimit({ windowMs: 60000, max: 20 }));

app.use(`${API}/auth`,        authRoutes);
app.use(`${API}/leaderboard`, leaderboardRoutes);
app.use(`${API}/profile`,     profileRoutes);
app.use(`${API}/attempts`,    attemptsRoutes);
app.use(`${API}/shop`,        shopRouter);
app.use(`${API}/tasks`,       tasksRouter);
app.use(`${API}/bot`, rateLimit({ windowMs: 60_000, max: 60, message: { error: 'Too many bot API requests' } }));
app.use(`${API}/bot`,         botRouter);
app.use(`${API}/nations`,       nationsRouter);
app.use(`${API}/wars`,          warsRouter);
app.use(`${API}/tournaments`,   tournamentsRouter);
app.use(`${API}/puzzles`,       puzzlesRouter);
app.use(`${API}/admin`, rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Too many admin requests' } }));
app.use(`${API}/admin`,         adminRouter);
app.use(`${API}/screenshotter`, screenshotterRouter);
// M3: Биржа — строгие лимиты (защита от спама ордерами)
app.use(`${API}/exchange/orders`,      rateLimit({ windowMs: 60_000, max: 10,  message: { error: 'Слишком много ордеров. Подождите минуту.' } }));
app.use(`${API}/exchange/buy-orders`,  rateLimit({ windowMs: 60_000, max: 10,  message: { error: 'Слишком много BUY-ордеров. Подождите минуту.' } }));
app.use(`${API}/exchange`,             rateLimit({ windowMs: 60_000, max: 60,  message: { error: 'Слишком много запросов к бирже.' } }));
app.use(`${API}/exchange`,     exchangeRouter);
app.use(`${API}/admin/airdrop`, airdropRouter);
app.use(`${API}/games`, gamesRouter);

app.get("/health", async (_req: import("express").Request, res: import("express").Response) => {
  try {
    const dbCheck = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    res.json({
      status: "ok",
      version: "7.2.0",
      uptime: Math.floor(process.uptime()),
      db: dbCheck ? "ok" : "error",
    });
  } catch (err) {
    res.status(503).json({ status: "error", version: "7.2.0", error: "Service unavailable" });
  }
});

app.use((_req: import("express").Request, res: import("express").Response) => res.status(404).json({ error: "Not found" }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("[Error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const start = async () => {
  try {
    await connectRedis();

    // Redis adapter для Socket.io — синхронизация между инстансами
    io.adapter(createAdapter(redisPub, redisSub));
    logger.info("[Socket.io] Redis adapter enabled");

    await prisma.$connect();
    logger.info("[DB] Connected");

    await prisma.platformConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    setupSocketHandlers(io);
    startTimerWatcher();
    startAttemptsCron();
    startCleanupCron();
    
    if (process.env.RUN_CRONS === 'true') {
      logger.info("[Scale] This node is a Cron Worker. Starting background matchmaking & tasks.");
      startGameCrons();
      startWarMatchmakingCron();
    } else {
      logger.info("[Scale] This node is a Web/Socket Server. Crons are disabled (needs RUN_CRONS=true).");
    }

    httpServer.listen(config.server.port, () => {
      logger.info(`[Server] ✅ Port ${config.server.port} · ${config.server.nodeEnv}`);
    });
  } catch (err) {
    logError("[Start] Fatal:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
