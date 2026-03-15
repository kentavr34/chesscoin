import "dotenv/config";
import express from "express";
import cors from "cors";

// ─── Глобальный фикс BigInt сериализации ─────────────────────────────────────
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
import { setupSocketHandlers } from "@/services/game/socket";
import { startGameCrons } from "@/services/crons";

// Routes
import authRoutes from "@/routes/auth";
import leaderboardRoutes from "@/routes/leaderboard";
import profileRoutes from "@/routes/profile";
import attemptsRoutes from "@/routes/attempts";
import { shopRouter } from "@/routes/shop";
import { tasksRouter } from "@/routes/tasks";
import { botRouter } from "@/routes/bot";
import { nationsRouter } from "@/routes/nations";
import { warsRouter } from "@/routes/wars";
import tournamentsRouter from "@/routes/tournaments";
import screenshotterRouter from "@/routes/screenshotter";
import rateLimit from "express-rate-limit";

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: config.server.frontendUrl, methods: ["GET", "POST"], credentials: true },
  transports: ["websocket", "polling"],
});

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
app.use(`${API}/bot`,         botRouter);
app.use(`${API}/nations`,       nationsRouter);
app.use(`${API}/wars`,          warsRouter);
app.use(`${API}/tournaments`,   tournamentsRouter);
app.use(`${API}/screenshotter`, screenshotterRouter);

app.get("/health", async (_req, res) => {
  const cfg = await prisma.platformConfig.findUnique({ where: { id: "singleton" } });
  res.json({
    status: "ok", version: "6.0.1",
    phase: cfg?.currentPhase ?? 1,
    totalEmitted: cfg?.totalEmitted?.toString() ?? "0",
    emissionCap: cfg?.emissionCap?.toString() ?? "0",
  });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const start = async () => {
  try {
    await connectRedis();

    // Redis adapter для Socket.io — синхронизация между инстансами
    io.adapter(createAdapter(redisPub, redisSub));
    console.log("[Socket.io] Redis adapter enabled");

    await prisma.$connect();
    console.log("[DB] Connected");

    await prisma.platformConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    setupSocketHandlers(io);
    startTimerWatcher();
    startAttemptsCron();
    startCleanupCron();
    startGameCrons();

    httpServer.listen(config.server.port, () => {
      console.log(`[Server] ✅ Port ${config.server.port} · ${config.server.nodeEnv}`);
    });
  } catch (err) {
    console.error("[Start] Fatal:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
