import { Server, Socket } from "socket.io";
import { Chess } from "chess.js";
import { SessionStatus, SessionType, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { verifyAccessToken } from "@/services/auth";
import config from "@/config";
import {
  createBotSession,
  createBattleSession,
  createFriendlySession,
  joinBattleSession,
  getActiveBattles,
  cacheSession,
} from "./session";
import { finishSession } from "./finish";
import { setTimer, switchTimer, stopAllTimers } from "./timer";
import { formatSession, formatBattlesList } from "./format";

// Счётчик зрителей: sessionId → Set<socketId>
// Используем Set чтобы не было дублей при реконнекте
const spectatorRooms = new Map<string, Set<string>>();
import { updateBalance, canEmit } from "@/services/economy";

interface SocketData {
  userId: string;
}

type AuthSocket = Socket & { data: SocketData };

// ─────────────────────────────────────────
// Redis кэш для проверки пользователя (TTL 60 сек)
// Избегаем DB-запроса на каждое socket-соединение
// ─────────────────────────────────────────
const USER_CACHE_TTL = 60;

const getCachedUserStatus = async (userId: string): Promise<{ exists: boolean; isBanned: boolean } | null> => {
  try {
    const cached = await redis.get(`user:status:${userId}`);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
};

const setCachedUserStatus = async (userId: string, data: { exists: boolean; isBanned: boolean }) => {
  try {
    await redis.setex(`user:status:${userId}`, USER_CACHE_TTL, JSON.stringify(data));
  } catch {}
};

const invalidateUserCache = async (userId: string) => {
  try {
    await redis.del(`user:status:${userId}`);
  } catch {}
};

// ─────────────────────────────────────────
// Auth middleware для Socket.io
// ─────────────────────────────────────────
export const setupSocketAuth = (io: Server) => {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.slice(7);

      if (!token) return next(new Error("No token"));

      const userId = verifyAccessToken(token);

      // Проверяем кэш прежде чем идти в БД
      let userStatus = await getCachedUserStatus(userId);
      if (!userStatus) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, isBanned: true },
        });
        userStatus = user ? { exists: true, isBanned: user.isBanned } : { exists: false, isBanned: false };
        await setCachedUserStatus(userId, userStatus);
      }

      if (!userStatus.exists || userStatus.isBanned) return next(new Error("Unauthorized"));

      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });
};

// ─────────────────────────────────────────
// Основной обработчик соединения
// ─────────────────────────────────────────
export const setupSocketHandlers = (io: Server) => {
  setupSocketAuth(io);

  io.on("connection", async (socket: AuthSocket) => {
    const userId = socket.data.userId;
    console.debug(`[Socket] Connected: ${socket.id} [user: ${userId}]`);

    // При подключении — только ID активных сессий (лёгкий запрос)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        activeSessions: { select: { id: true } },
      },
    });

    if (user?.activeSessions.length) {
      for (const session of user.activeSessions) {
        socket.join(session.id);
        console.debug(`[Socket] Rejoined session: ${session.id}`);
      }
    }

    // ── Disconnect ──────────────────────────────────────
    socket.on("disconnect", async () => {
      console.debug(`[Socket] Disconnected: ${socket.id} [user: ${userId}]`);
    });

    // ── Получить текущие активные сессии (reconnect) ────
    socket.on("game:current", async (callback?: Function) => {
      try {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            activeSessions: {
              select: {
                id: true, fen: true, pgn: true, status: true, type: true,
                currentSideId: true, winnerSideId: true, bet: true, botLevel: true,
                isSurrender: true, duration: true, turnStartedAt: true,
                startedAt: true, finishedAt: true, createdAt: true, code: true,
                sides: { include: { player: { select: { id: true, firstName: true, username: true, elo: true, avatar: true, avatarGradient: true } } } },
              },
            },
          },
        });

        const sessions = (currentUser?.activeSessions ?? []).map((s) =>
          formatSession(s, userId)
        );

        if (callback) callback({ ok: true, sessions });
        else socket.emit("game:current", sessions);
      } catch (err: any) {
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // ── Создать игру с ботом ─────────────────────────────
    socket.on(
      "game:create:bot",
      async (
        data: { color: "white" | "black"; botLevel: number; timeSeconds?: number },
        callback?: Function
      ) => {
        try {
          const session = await createBotSession(userId, data.color, data.botLevel, data.timeSeconds ?? 600);
          socket.join(session.id);
          const formatted = formatSession(session, userId);

          if (callback) callback({ ok: true, session: formatted });
          socket.emit("game", formatted);

          if (data.color === "black") {
            setTimeout(async () => {
              await makeBotMove(socket, io, session.id);
            }, 500);
          } else {
            await setTimer(session.id);
          }
        } catch (err: any) {
          if (callback) callback({ ok: false, error: err.message });
        }
      }
    );

    // ── Создать батл ─────────────────────────────────────
    socket.on(
      "game:create:battle",
      async (
        data: { color: "white" | "black"; duration: number; bet: string; isPrivate?: boolean },
        callback?: Function
      ) => {
        try {
          const session = await createBattleSession(
            userId,
            data.color,
            data.duration,
            BigInt(data.bet),
            data.isPrivate ?? false
          );
          socket.join(session.id);
          const formatted = formatSession(session, userId);

          if (callback) callback({ ok: true, session: formatted });
          socket.emit("game", formatted);

          const battles = await getActiveBattles();
          io.to("lobby").emit("battles:list", formatBattlesList(battles, buildSpectatorCounts(battles)));
        } catch (err: any) {
          if (callback) callback({ ok: false, error: err.message });
        }
      }
    );

    // ── Присоединиться к батлу ───────────────────────────
    socket.on(
      "game:join",
      async (data: { code: string }, callback?: Function) => {
        try {
          const session = await joinBattleSession(userId, data.code);
          socket.join(session.id);
          const formatted = formatSession(session, userId);

          if (callback) callback({ ok: true, session: formatted });
          io.to(session.id).emit("game", formatted);
          io.to(session.id).emit("game:started", { sessionId: session.id });

          await setTimer(session.id);

          const battles = await getActiveBattles();
          io.to("lobby").emit("battles:list", formatBattlesList(battles, buildSpectatorCounts(battles)));
        } catch (err: any) {
          if (callback) callback({ ok: false, error: err.message });
        }
      }
    );

    // ── Сделать ход ──────────────────────────────────────
    socket.on(
      "game:move",
      async (
        data: { sessionId: string; from: string; to: string; promotion?: string },
        callback?: Function
      ) => {
        try {
          const { sessionId, from, to, promotion = "q" } = data;

          const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: {
              id: true, fen: true, pgn: true, status: true, type: true,
              currentSideId: true, bet: true, botLevel: true,
              sides: { include: { player: { select: { id: true, firstName: true, username: true, elo: true, avatar: true, avatarGradient: true } } } },
            },
          });

          if (!session || session.status !== SessionStatus.IN_PROGRESS) {
            throw new Error("SESSION_NOT_ACTIVE");
          }

          const mySide = session.sides.find((s) => s.playerId === userId && !s.isBot);
          if (!mySide) throw new Error("NOT_YOUR_GAME");
          if (session.currentSideId !== mySide.id) throw new Error("NOT_YOUR_TURN");

          const chess = new Chess(session.fen);
          chess.loadPgn(session.pgn);

          let moveResult;
          try {
            moveResult = chess.move({ from, to, promotion });
          } catch {
            throw new Error("INVALID_MOVE");
          }

          await prisma.session.update({
            where: { id: sessionId },
            data: { fen: chess.fen(), pgn: chess.pgn(), turnStartedAt: new Date() },
          });

          // Монеты за фигуры ТОЛЬКО при игре с ботом (MasterPlan §5.3)
          if (moveResult.captured && session.type === SessionType.BOT) {
            const emitAllowed = await canEmit();
            if (emitAllowed) {
              const piecePrice =
                config.economy.piecePrice[moveResult.captured as keyof typeof config.economy.piecePrice] ?? 0n;
              if (piecePrice > 0n) {
                await updateBalance(userId, piecePrice, TransactionType.BOT_PIECE, {
                  piece: moveResult.captured, sessionId,
                }, { isEmission: true });
                // Трекинг монет за фигуры для отображения в модале результата
                await redis.incrby(`session:${sessionId}:pieceCoins:${userId}`, Number(piecePrice));
                await redis.expire(`session:${sessionId}:pieceCoins:${userId}`, 86400);
              }
            }
          }

          // Конец игры
          if (chess.isGameOver()) {
            const status = chess.isDraw() ? SessionStatus.DRAW : SessionStatus.FINISHED;
            const nextSide = session.sides.find(s => s.id !== session.currentSideId && !s.isBot);
            const finished = await finishSession(sessionId, status, {
              winnerSideId: chess.isDraw() ? undefined : nextSide?.id,
              loserSideId: chess.isDraw() ? undefined : mySide.id,
              isDraw: chess.isDraw() || chess.isStalemate(),
            });
            await stopAllTimers(sessionId);
            // Включаем pieceCoins в данные для отображения в модале результата
            const pieceCoinsRaw = await redis.get(`session:${sessionId}:pieceCoins:${userId}`);
            const formattedFinished = { ...formatSession(finished, userId), pieceCoins: pieceCoinsRaw ?? '0' };
            io.to(sessionId).emit("game", formattedFinished);
            io.to(sessionId).emit("game:over", { status: finished.status });
            if (callback) callback({ ok: true, session: formattedFinished });
            return;
          }

          // Переключаем ход
          const nextSide = session.sides.find(s => s.id !== session.currentSideId);
          await prisma.session.update({
            where: { id: sessionId },
            data: { currentSideId: nextSide?.id },
          });

          // Переключаем таймер для батлов и игр с ботом
          if ((session.type === SessionType.BATTLE || session.type === SessionType.BOT) && nextSide) {
            await switchTimer(sessionId, mySide.id, nextSide.id);
          }

          const updatedSession = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { sides: { include: { player: { select: { id: true, firstName: true, username: true, elo: true, avatar: true, avatarGradient: true } } } } },
          });

          await cacheSession(updatedSession);
          const formatted = formatSession(updatedSession, userId);
          io.to(sessionId).emit("game", formatted);
          if (callback) callback({ ok: true, session: formatted });

          // Ход бота
          if (session.type === SessionType.BOT && nextSide?.isBot) {
            setTimeout(async () => {
              await makeBotMove(socket, io, sessionId);
            }, 400 + Math.random() * 600);
          }
        } catch (err: any) {
          if (callback) callback({ ok: false, error: err.message });
        }
      }
    );

    // ── Сдаться ──────────────────────────────────────────
    socket.on(
      "game:surrender",
      async (data: { sessionId: string }, callback?: Function) => {
        try {
          const session = await prisma.session.findUnique({
            where: { id: data.sessionId },
            select: {
              id: true, status: true, type: true, bet: true,
              sides: { select: { id: true, playerId: true, isBot: true } },
            },
          });
          if (!session || session.status !== SessionStatus.IN_PROGRESS) return;

          const mySide = session.sides.find(s => s.playerId === userId);
          const opponentSide = session.sides.find(s => s.playerId !== userId);
          if (!mySide) return;

          await stopAllTimers(data.sessionId);
          const finished = await finishSession(data.sessionId, SessionStatus.FINISHED, {
            winnerSideId: opponentSide?.id,
            loserSideId: mySide.id,
          });

          await prisma.session.update({
            where: { id: data.sessionId },
            data: { isSurrender: true },
          });

          const formatted = formatSession(finished, userId);
          io.to(data.sessionId).emit("game", formatted);
          io.to(data.sessionId).emit("game:over", { status: "FINISHED", surrender: true });
          if (callback) callback({ ok: true });

          if (session.type === SessionType.BATTLE) {
            const battles = await getActiveBattles();
            io.to("lobby").emit("battles:list", formatBattlesList(battles, buildSpectatorCounts(battles)));
          }
        } catch (err: any) {
          if (callback) callback({ ok: false, error: err.message });
        }
      }
    );

    // ── Отменить ожидающий батл ──────────────────────────
    socket.on(
      "game:cancel",
      async (data: { sessionId: string }, callback?: Function) => {
        try {
          const session = await prisma.session.findUnique({
            where: { id: data.sessionId },
            select: {
              id: true, status: true, type: true, bet: true,
              sides: { select: { id: true, playerId: true } },
            },
          });

          if (!session || session.status !== SessionStatus.WAITING_FOR_OPPONENT) {
            throw new Error("Cannot cancel");
          }
          if (session.sides[0]?.playerId !== userId) {
            throw new Error("Not your session");
          }

          if (session.type === SessionType.BATTLE && session.bet) {
            await updateBalance(userId, session.bet, TransactionType.BATTLE_BET, {
              reason: "battle_cancelled", sessionId: session.id,
            });
          }

          await prisma.session.update({
            where: { id: data.sessionId },
            data: { status: SessionStatus.CANCELLED },
          });
          await prisma.user.update({
            where: { id: userId },
            data: { activeSessions: { disconnect: { id: data.sessionId } } },
          });

          if (callback) callback({ ok: true });
          const battles = await getActiveBattles();
          io.to("lobby").emit("battles:list", formatBattlesList(battles, buildSpectatorCounts(battles)));
        } catch (err: any) {
          if (callback) callback({ ok: false, error: err.message });
        }
      }
    );

    // ── Предложить / принять / отклонить ничью ───────────
    socket.on("game:offer_draw", async (data: { sessionId: string }) => {
      io.to(data.sessionId).emit("game:draw_offered", { by: userId });
    });

    socket.on("game:accept_draw", async (data: { sessionId: string }, callback?: Function) => {
      try {
        await stopAllTimers(data.sessionId);
        const finished = await finishSession(data.sessionId, SessionStatus.DRAW, { isDraw: true });
        const formatted = formatSession(finished, userId);
        io.to(data.sessionId).emit("game", formatted);
        io.to(data.sessionId).emit("game:over", { status: "DRAW" });
        if (callback) callback({ ok: true });
      } catch (err: any) {
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    socket.on("game:decline_draw", async (data: { sessionId: string }) => {
      io.to(data.sessionId).emit("game:draw_declined", { by: userId });
    });

    // ── Спектатор ────────────────────────────────────────
    socket.on("spectate", (data: { sessionId: string }) => {
      socket.join(`spectate:${data.sessionId}`);
      // Добавляем в счётчик зрителей
      if (!spectatorRooms.has(data.sessionId)) spectatorRooms.set(data.sessionId, new Set());
      spectatorRooms.get(data.sessionId)!.add(socket.id);
    });

    socket.on("unspectate", (data: { sessionId: string }) => {
      socket.leave(`spectate:${data.sessionId}`);
      spectatorRooms.get(data.sessionId)?.delete(socket.id);
    });

    // Чистим зрителей при дисконнекте
    socket.on("disconnect", () => {
      spectatorRooms.forEach((set) => set.delete(socket.id));
    });

    // ── Лобби батлов ─────────────────────────────────────
    // Хелпер: построить Map счётчиков зрителей для текущих батлов
    const buildSpectatorCounts = (battles: any[]) => {
      const counts = new Map<string, number>();
      for (const b of battles) {
        counts.set(b.id, spectatorRooms.get(b.id)?.size ?? 0);
      }
      return counts;
    };

    socket.on("battles:subscribe", async () => {
      socket.join("lobby");
      const battles = await getActiveBattles();
      socket.emit("battles:list", formatBattlesList(battles, buildSpectatorCounts(battles)));
    });

    socket.on("battles:unsubscribe", () => {
      socket.leave("lobby");
    });

    // ── Ping ─────────────────────────────────────────────
    socket.on("ping", () => socket.emit("pong"));
  });
};

// ─────────────────────────────────────────
// Ход бота (Stockfish или random fallback)
// ─────────────────────────────────────────
const makeBotMove = async (socket: AuthSocket, io: Server, sessionId: string) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true, fen: true, pgn: true, status: true, botLevel: true, currentSideId: true,
        sides: { include: { player: { select: { id: true, firstName: true, username: true, elo: true, avatar: true, avatarGradient: true } } } },
      },
    });
    if (!session || session.status !== SessionStatus.IN_PROGRESS) return;

    const botSide = session.sides.find(s => s.isBot);
    if (!session.currentSideId || session.currentSideId !== botSide?.id) return;

    const chess = new Chess(session.fen);
    chess.loadPgn(session.pgn);

    const move = await getStockfishMove(chess.fen(), session.botLevel ?? 1);
    if (!move) return;

    let moveResult;
    try {
      moveResult = chess.move({ from: move.from, to: move.to, promotion: "q" });
    } catch {
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return;
      moveResult = chess.move(moves[Math.floor(Math.random() * moves.length)]);
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { fen: chess.fen(), pgn: chess.pgn(), turnStartedAt: new Date() },
    });

    if (chess.isGameOver()) {
      const humanSide = session.sides.find(s => !s.isBot);
      const status = chess.isDraw() ? SessionStatus.DRAW : SessionStatus.FINISHED;
      const finished = await finishSession(sessionId, status, {
        winnerSideId: chess.isDraw() ? undefined : (chess.isCheckmate() ? botSide?.id : humanSide?.id),
        loserSideId: chess.isDraw() ? undefined : (chess.isCheckmate() ? humanSide?.id : botSide?.id),
        isDraw: chess.isDraw(),
      });
      await stopAllTimers(sessionId);
      const uid = humanSide?.playerId ?? null;
      // Включаем pieceCoins в данные для отображения в модале результата
      const pieceCoinsRaw = uid ? await redis.get(`session:${sessionId}:pieceCoins:${uid}`) : null;
      const formattedFinished = { ...formatSession(finished, uid), pieceCoins: pieceCoinsRaw ?? '0' };
      io.to(sessionId).emit("game", formattedFinished);
      io.to(sessionId).emit("game:over", { status: finished.status });
      return;
    }

    const humanSide = session.sides.find(s => !s.isBot);
    await prisma.session.update({
      where: { id: sessionId },
      data: { currentSideId: humanSide?.id },
    });

    // Переключаем таймер обратно к человеку после хода бота
    if (botSide && humanSide) {
      await switchTimer(sessionId, botSide.id, humanSide.id);
    }

    const updatedSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { sides: { include: { player: { select: { id: true, firstName: true, username: true, elo: true, avatar: true, avatarGradient: true } } } } },
    });

    io.to(sessionId).emit("game", formatSession(updatedSession, humanSide?.playerId ?? null));
  } catch (err) {
    console.error("[BotMove] Error:", err);
  }
};

// ─────────────────────────────────────────
// Stockfish через npm пакет (без отдельного контейнера)
// level 1–20 → depth 1–20
// ─────────────────────────────────────────

// Уровень 1-20 → глубина поиска 1-20
const levelToDepth = (level: number): number =>
  Math.max(1, Math.min(20, level));

// Уровни JARVIS
const JARVIS_LEVELS = [
  { level: 1,  name: 'Beginner',     reward: 1000,  errorRate: 20, depth: 1 },
  { level: 2,  name: 'Player',       reward: 3000,  errorRate: 17, depth: 2 },
  { level: 3,  name: 'Fighter',      reward: 5000,  errorRate: 14, depth: 2 },
  { level: 4,  name: 'Warrior',      reward: 7000,  errorRate: 11, depth: 3 },
  { level: 5,  name: 'Expert',       reward: 10000, errorRate: 9,  depth: 3 },
  { level: 6,  name: 'Master',       reward: 13000, errorRate: 7,  depth: 4 },
  { level: 7,  name: 'Professional', reward: 17000, errorRate: 5,  depth: 5 },
  { level: 8,  name: 'Epic',         reward: 21000, errorRate: 3,  depth: 6 },
  { level: 9,  name: 'Legendary',    reward: 26000, errorRate: 1,  depth: 8 },
  { level: 10, name: 'Mystic',       reward: 30000, errorRate: 0,  depth: 10 },
];

const getStockfishMove = (
  fen: string,
  level: number
): Promise<{ from: string; to: string } | null> => {
  return new Promise((resolve) => {
    try {
      const { Chess } = require("chess.js");
      const jarvisConfig = JARVIS_LEVELS[Math.max(0, Math.min(9, level - 1))];
      const depth = jarvisConfig.depth;
      const errorRate = jarvisConfig.errorRate;

      const chess = new Chess(fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return resolve(null);

      // Делаем случайный ход с вероятностью errorRate%
      if (errorRate > 0 && Math.random() * 100 < errorRate) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        console.debug("[JARVIS] Level " + level + " — random move (error simulation)");
        return resolve({ from: m.from, to: m.to });
      }

      if (depth <= 1) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        return resolve({ from: m.from, to: m.to });
      }

      let best: any = null;
      let bestScore = -99999;
      for (const m of moves) {
        chess.move(m);
        const score = -chessMinimaxFn(chess, depth - 1, -99999, 99999);
        chess.undo();
        if (score > bestScore) { bestScore = score; best = m; }
      }
      console.debug("[JARVIS] Level " + level + " depth " + depth + " — bestmove " + (best?.from ?? "") + (best?.to ?? ""));
      resolve(best ? { from: best.from, to: best.to } : null);
    } catch (err) {
      console.warn("[JARVIS] Error:", (err as Error).message);
      resolve(getRandomMove(fen));
    }
  });
};

function chessMinimaxFn(chess: any, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) return chessEvalBoardFn(chess);
  const moves = chess.moves({ verbose: true });
  let best = -99999;
  for (const m of moves) {
    chess.move(m);
    const score = -chessMinimaxFn(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function chessEvalBoardFn(chess: any): number {
  const vals: Record<string, number> = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };
  let score = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq === null) continue;
      const v = vals[sq.type] || 0;
      score += sq.color === "w" ? v : -v;
    }
  }
  return score;
}
const getRandomMove = (fen: string): { from: string; to: string } | null => {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;
    const move = moves[Math.floor(Math.random() * moves.length)];
    return { from: move.from, to: move.to };
  } catch {
    return null;
  }
};
