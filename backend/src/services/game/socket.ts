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
            // mySide — тот, кто только что сделал ход. Если isGameOver() после его хода — он победил.
            const opponentSide = session.sides.find(s => s.id !== mySide.id);
            const finished = await finishSession(sessionId, status, {
              winnerSideId: chess.isDraw() ? undefined : mySide.id,
              loserSideId: chess.isDraw() ? undefined : opponentSide?.id,
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
            // Возвращаем ставку
            await updateBalance(userId, session.bet, TransactionType.BATTLE_BET, {
              reason: "battle_cancelled", sessionId: session.id,
            });
            // Возвращаем попытку (батл отменён до старта — попытка не должна сгорать)
            const cancellingUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { attempts: true, maxAttempts: true },
            });
            if (cancellingUser && cancellingUser.attempts < cancellingUser.maxAttempts) {
              await prisma.user.update({
                where: { id: userId },
                data: { attempts: { increment: 1 } },
              });
            }
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

    // ── Донат зрителя в батл ─────────────────────────────
    socket.on(
      "battle:donate",
      async (data: { sessionId: string; amount: string }, callback?: Function) => {
        try {
          const session = await prisma.session.findUnique({
            where: { id: data.sessionId },
            select: { id: true, type: true, status: true, donationPool: true },
          });
          if (!session || session.type !== SessionType.BATTLE || session.status !== SessionStatus.IN_PROGRESS) {
            throw new Error("BATTLE_NOT_FOUND");
          }

          const amountBig = BigInt(data.amount);
          if (amountBig <= 0n) throw new Error("INVALID_AMOUNT");

          const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
          if (!user || user.balance < amountBig) throw new Error("INSUFFICIENT_BALANCE");

          // Снимаем с баланса донора
          await updateBalance(userId, -amountBig, TransactionType.BATTLE_DONATION, {
            sessionId: data.sessionId, reason: "spectator_donation",
          });

          // Добавляем в пул доната сессии
          await prisma.session.update({
            where: { id: data.sessionId },
            data: { donationPool: { increment: amountBig } },
          });

          // Уведомляем всех в комнате
          io.to(data.sessionId).emit("battle:donated", {
            donorId: userId,
            amount: amountBig.toString(),
            totalPool: (session.donationPool + amountBig).toString(),
          });
          if (callback) callback({ ok: true });
        } catch (err: any) {
          if (callback) callback({ ok: false, error: err.message });
        }
      }
    );

    // ── Вызов игрока из клана ─────────────────────────────
    socket.on(
      "clan:challenge_player",
      async (data: { targetUserId: string; bet: string }, callback?: Function) => {
        try {
          const bet = BigInt(data.bet);
          if (bet <= 0n) throw new Error("INVALID_BET");
          // Создаём приватный батл и отправляем ссылку целевому игроку
          const session = await createBattleSession(userId, "white", 600, bet, true);
          socket.join(session.id);
          const formatted = formatSession(session, userId);
          if (callback) callback({ ok: true, session: formatted });

          // Уведомляем целевого игрока
          io.emit(`user:${data.targetUserId}`, {
            type: "battle:challenge",
            from: userId,
            sessionCode: session.code,
            bet: bet.toString(),
          });
        } catch (err: any) {
          if (callback) callback({ ok: false, error: err.message });
        }
      }
    );

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

// ═══════════════════════════════════════════════════════════════════════
// JARVIS AI ENGINE v2.0
// Alpha-Beta + Transposition Table + Null-Move + Killers + History + LMR
// Evaluation: material + PST + pawn structure + king safety + bishop pair
// ═══════════════════════════════════════════════════════════════════════

// ── Level config ──────────────────────────────────────────────────────
// errorRate: вероятность случайного хода (снижает силу на нижних уровнях)
// useTT:     включить таблицу транспозиций
// useNullMv: включить null-move pruning (сильно ускоряет поиск)
// useLMR:    включить Late Move Reductions
const JARVIS_LEVELS = [
  { level: 1,  name: 'Beginner',     reward: 1000,  thinkMs: 100,   maxDepth: 2,  errorRate: 70, useTT: false, useNullMv: false, useLMR: false },
  { level: 2,  name: 'Player',       reward: 3000,  thinkMs: 250,   maxDepth: 3,  errorRate: 48, useTT: false, useNullMv: false, useLMR: false },
  { level: 3,  name: 'Fighter',      reward: 5000,  thinkMs: 600,   maxDepth: 4,  errorRate: 28, useTT: false, useNullMv: false, useLMR: false },
  { level: 4,  name: 'Warrior',      reward: 7000,  thinkMs: 1200,  maxDepth: 5,  errorRate: 12, useTT: true,  useNullMv: false, useLMR: false },
  { level: 5,  name: 'Expert',       reward: 9000,  thinkMs: 3000,  maxDepth: 10, errorRate: 3,  useTT: true,  useNullMv: true,  useLMR: true  },
  { level: 6,  name: 'Master',       reward: 12000, thinkMs: 5000,  maxDepth: 14, errorRate: 0,  useTT: true,  useNullMv: true,  useLMR: true  },
  { level: 7,  name: 'Professional', reward: 15000, thinkMs: 7000,  maxDepth: 18, errorRate: 0,  useTT: true,  useNullMv: true,  useLMR: true  },
  { level: 8,  name: 'Epic',         reward: 20000, thinkMs: 10000, maxDepth: 24, errorRate: 0,  useTT: true,  useNullMv: true,  useLMR: true  },
  { level: 9,  name: 'Legendary',    reward: 30000, thinkMs: 14000, maxDepth: 32, errorRate: 0,  useTT: true,  useNullMv: true,  useLMR: true  },
  { level: 10, name: 'Mystic',       reward: 50000, thinkMs: 20000, maxDepth: 50, errorRate: 0,  useTT: true,  useNullMv: true,  useLMR: true  },
];

// ── Piece values (centipawns) ─────────────────────────────────────────
const PV: Record<string, number> = { p: 100, n: 325, b: 335, r: 500, q: 975, k: 20000 };

// ── Piece-Square Tables — белые, row 0 = rank 8 (верхний) ────────────
// Для чёрных: idx = (7 - row) * 8 + col
const PST: Record<string, number[]> = {
  // Пешка: продвижение вперёд, контроль центра
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    98, 134, 61, 95, 68, 126, 34, -11,
    -6,   7, 26, 31, 65,  56, 25, -20,
   -14,  13,  6, 21, 23,  12, 17, -23,
   -27,  -2, -5, 12, 17,   6, 10, -25,
   -26,  -4, -4,-10, 3,   3, 33, -12,
   -35,  -1,-20,-23,-15,  24, 38, -22,
     0,   0,  0,  0,  0,   0,  0,   0,
  ],
  // Конь: центр значительно лучше
  n: [
   -167, -89, -34, -49,  61, -97, -15, -107,
    -73, -41,  72,  36,  23,  62,   7,  -17,
    -47,  60,  37,  65,  84,  129,  73,   44,
     -9,  17,  19,  53,  37,   69,  18,   22,
    -13,   4,  16,  13,  28,   19,  21,   -8,
    -23,  -9,  12,  10,  19,   17,  25,  -16,
    -29, -53, -12,  -3,  -1,   18, -14,  -19,
   -105, -21, -58, -33, -17,  -28, -19,  -23,
  ],
  // Слон: активные диагонали, избегать углов
  b: [
   -29,   4, -82, -37, -25, -42,   7,  -8,
   -26,  16, -18, -13,  30,  59,  18, -47,
   -16,  37,  43,  40,  35,  50,  37,  -2,
    -4,   5,  19,  50,  37,  37,   7,  -2,
    -6,  13,  13,  26,  34,  12,  10,   4,
     0,  15,  15,  15,  14,  27,  18,  10,
     4,  15,  16,   0,   7,  21,  33,   1,
   -33,  -3, -14, -21, -13, -12, -39, -21,
  ],
  // Ладья: открытые вертикали, 7-й ряд
  r: [
    32,  42,  32,  51, 63,  9,  31,  43,
    27,  32,  58,  62, 80, 67,  26,  44,
    -5,  19,  26,  36, 17, 45,  61,  16,
   -24, -11,   7,  26, 24, 35,  -8, -20,
   -36, -26, -12,  -1,  9, -7,   6, -23,
   -45, -25, -16, -17,  3,  0,  -5, -33,
   -44, -16, -20,  -9, -1, 11,  -6, -71,
   -19, -13,   1,  17, 16,  7, -37, -26,
  ],
  // Ферзь: не выходить рано, защищать короля
  q: [
   -28,   0,  29,  12,  59,  44,  43,  45,
   -24, -39,  -5,   1, -16,  57,  28,  54,
   -13, -17,   7,   8,  29,  56,  47,  57,
   -27, -27, -16, -16,  -1,  17,  -2,   1,
    -9, -26,  -9, -10,  -2,  -4,   3,  -3,
   -14,   2, -11,  -2,  -5,   2,  14,   5,
   -35,  -8,  11,   2,   8,  15,  -3,   1,
    -1, -18,  -9,  10, -15, -25, -31, -50,
  ],
  // Король (дебют/миттельшпиль): прятаться за пешками
  k: [
   -65,  23,  16, -15, -56, -34,   2,  13,
    29,  -1, -20,  -7,  -8,  -4, -38, -29,
    -9,  24,   2, -16, -20,   6,  22, -22,
   -17, -20, -12, -27, -30, -25, -14, -36,
   -49,  -1, -27, -39, -46, -44, -33, -51,
   -14, -14, -22, -46, -44, -30, -15, -27,
     1,   7,  -8, -64, -43, -16,   9,   8,
   -15,  36,  12, -54,   8, -28,  24,  14,
  ],
  // Король (эндшпиль): активный king — идти в центр
  ke: [
   -74, -35, -18, -18, -11,  15,   4, -17,
   -12,  17,  14,  17,  17,  38,  23,  11,
    10,  17,  23,  15,  20,  45,  44,  13,
    -8,  22,  24,  27,  26,  33,  26,   3,
   -18,  -4,  21,  24,  27,  23,   9, -11,
   -19,  -3,  11,  21,  23,  16,   7,  -9,
   -27, -11,   4,  13,  14,   4,  -5, -17,
   -53, -34, -21, -11, -28, -14, -24, -43,
  ],
};

// ── Transposition Table ───────────────────────────────────────────────
interface TTEntry {
  score: number;
  depth: number;
  flag: 0 | 1 | 2; // 0=exact, 1=lowerbound (fail-high), 2=upperbound (fail-low)
  bestMove: string | null;  // "from+to" e.g. "e2e4"
}
// Используем отдельный TT на каждый вызов getStockfishMove (не глобальный)
// чтобы не смешивать позиции разных партий

// Ключ TT: первые 4 поля FEN (без счётчиков ходов)
function fenKey(chess: any): string {
  return chess.fen().split(' ').slice(0, 4).join(' ');
}

// ── Search context ────────────────────────────────────────────────────
interface SearchCtx {
  deadline: number;
  killers: Array<[string | null, string | null]>;  // [ply] → 2 тихих хода-убийцы
  history: Record<string, number>;                  // "piece+from+to" → бонус
  tt: Map<string, TTEntry>;
  useTT: boolean;
  useNullMv: boolean;
  useLMR: boolean;
  aborted: boolean;
}

// ── Endgame detection ─────────────────────────────────────────────────
function isEndgame(chess: any): boolean {
  let queens = 0, material = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq || sq.type === 'k' || sq.type === 'p') continue;
      if (sq.type === 'q') queens++;
      material += PV[sq.type] ?? 0;
    }
  return queens === 0 || material < 1300;
}

// ── Static evaluation (from CURRENT player's perspective) ────────────
function evaluate(chess: any, eg: boolean): number {
  if (chess.isCheckmate()) return -28000;
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) return 0;

  const board = chess.board();
  const turn = chess.turn();
  let score = 0;
  let wBishops = 0, bBishops = 0;
  const wPawns = new Array(8).fill(0);
  const bPawns = new Array(8).fill(0);
  const wPassedMask = new Array(8).fill(0); // max rank reached per file
  const bPassedMask = new Array(8).fill(8);

  // First pass: pawns for passed/isolated/doubled detection
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq || sq.type !== 'p') continue;
      if (sq.color === 'w') {
        wPawns[c]++;
        if (r < wPassedMask[c]) wPassedMask[c] = r; // smaller r = higher rank (closer to 8th)
      } else {
        bPawns[c]++;
        if (r > bPassedMask[c]) bPassedMask[c] = r;
      }
    }
  }

  // Main evaluation loop
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const isW = sq.color === 'w';

      // Material + PST
      const pstKey = (sq.type === 'k' && eg) ? 'ke' : sq.type;
      const idx = isW ? r * 8 + c : (7 - r) * 8 + c;
      const pst = PST[pstKey];
      const pieceScore = PV[sq.type] + (pst ? (pst[idx] ?? 0) : 0);
      score += isW ? pieceScore : -pieceScore;

      if (sq.type === 'b') isW ? wBishops++ : bBishops++;

      // Passed pawn bonus (pawns that can't be blocked by opponent pawns)
      if (sq.type === 'p') {
        const rank = isW ? (7 - r) : r; // 0=start, 6=almost queening
        if (isW) {
          const blocked = (c > 0 && bPawns[c - 1] > 0 && bPassedMask[c - 1] < r)
            || (bPawns[c] > 0 && bPassedMask[c] < r)
            || (c < 7 && bPawns[c + 1] > 0 && bPassedMask[c + 1] < r);
          if (!blocked) score += 15 + rank * rank * 3; // exponential bonus near promotion
        } else {
          const blocked = (c > 0 && wPawns[c - 1] > 0 && wPassedMask[c - 1] > r)
            || (wPawns[c] > 0 && wPassedMask[c] > r)
            || (c < 7 && wPawns[c + 1] > 0 && wPassedMask[c + 1] > r);
          if (!blocked) score -= 15 + rank * rank * 3;
        }
      }

      // Rook on open/semi-open file
      if (sq.type === 'r') {
        if (isW) {
          if (wPawns[c] === 0 && bPawns[c] === 0) score += 20; // open file
          else if (wPawns[c] === 0) score += 10;               // semi-open
        } else {
          if (wPawns[c] === 0 && bPawns[c] === 0) score -= 20;
          else if (bPawns[c] === 0) score -= 10;
        }
      }
    }
  }

  // Pawn structure
  for (let c = 0; c < 8; c++) {
    if (wPawns[c] > 1) score -= 12 * (wPawns[c] - 1); // doubled
    if (bPawns[c] > 1) score += 12 * (bPawns[c] - 1);
    const wIso = wPawns[c] > 0 && (c === 0 || wPawns[c - 1] === 0) && (c === 7 || wPawns[c + 1] === 0);
    const bIso = bPawns[c] > 0 && (c === 0 || bPawns[c - 1] === 0) && (c === 7 || bPawns[c + 1] === 0);
    if (wIso) score -= 20;
    if (bIso) score += 20;
  }

  // Bishop pair
  if (wBishops >= 2) score += 30;
  if (bBishops >= 2) score -= 30;

  // Mobility
  const mobilityMoves = chess.moves().length;
  score += mobilityMoves * (turn === 'w' ? 4 : -4);

  return turn === 'w' ? score : -score;
}

// ── Move key ──────────────────────────────────────────────────────────
function mvKey(m: any): string { return m.from + m.to + (m.promotion ?? ''); }

// ── Move ordering ─────────────────────────────────────────────────────
// TT move → MVV-LVA captures → promotions → killer moves → history → quiet
function orderMoves(moves: any[], ctx: SearchCtx, ply: number, ttMove: string | null): any[] {
  const [k1, k2] = ply < ctx.killers.length ? ctx.killers[ply] : [null, null];
  return moves.slice().sort((a, b) => {
    const sc = (m: any): number => {
      const key = mvKey(m);
      if (ttMove && key === ttMove) return 30000;
      if (m.captured) return 10000 + (PV[m.captured] ?? 0) * 10 - (PV[m.piece] ?? 0); // MVV-LVA
      if (m.flags?.includes('p')) return 9000 + (m.promotion === 'q' ? 500 : 0);
      if (key === k1) return 8000;
      if (key === k2) return 7500;
      return ctx.history[m.piece + key] ?? 0;
    };
    return sc(b) - sc(a);
  });
}

// ── Quiescence search ─────────────────────────────────────────────────
function qsearch(chess: any, alpha: number, beta: number, ctx: SearchCtx, eg: boolean, depth = 0): number {
  if (ctx.aborted || Date.now() >= ctx.deadline) return 0;
  if (depth > 12) return evaluate(chess, eg);

  const stand = evaluate(chess, eg);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;

  // Look at captures + promotions only
  const moves = chess.moves({ verbose: true })
    .filter((m: any) => m.captured || m.flags?.includes('p'))
    .sort((a: any, b: any) => {
      const s = (m: any) => m.captured ? (PV[m.captured] ?? 0) * 10 - (PV[m.piece] ?? 0) : 0;
      return s(b) - s(a);
    });

  for (const m of moves) {
    if (Date.now() >= ctx.deadline) { ctx.aborted = true; break; }
    chess.move(m);
    const score = -qsearch(chess, -beta, -alpha, ctx, eg, depth + 1);
    chess.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// ── Null move helper ──────────────────────────────────────────────────
// Chess.js не поддерживает null move, поэтому модифицируем FEN напрямую
function makeNullChess(chess: any): any | null {
  try {
    const parts = chess.fen().split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-'; // убрать en-passant
    return new (chess.constructor)(parts.join(' '));
  } catch { return null; }
}

// ── Alpha-Beta (negamax) ──────────────────────────────────────────────
function alphaBeta(
  chess: any,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchCtx,
  eg: boolean,
  allowNull: boolean,
): number {
  if (ctx.aborted) return 0;
  if (Date.now() >= ctx.deadline) { ctx.aborted = true; return 0; }
  if (chess.isGameOver()) return evaluate(chess, eg);
  if (depth <= 0) return qsearch(chess, alpha, beta, ctx, eg);

  const isPV = beta > alpha + 1;
  const inCheck = chess.inCheck();

  // TT probe
  const ttKey = ctx.useTT ? fenKey(chess) : null;
  let ttMove: string | null = null;
  if (ctx.useTT && ttKey) {
    const tte = ctx.tt.get(ttKey);
    if (tte) {
      ttMove = tte.bestMove;
      if (tte.depth >= depth) {
        if (tte.flag === 0) return tte.score;
        if (tte.flag === 1 && tte.score > alpha) alpha = tte.score;
        if (tte.flag === 2 && tte.score < beta) beta = tte.score;
        if (alpha >= beta) return tte.score;
      }
    }
  }

  // Null-move pruning (не в PV, не в шахе, не в эндшпиле если риск цугцванга)
  if (ctx.useNullMv && allowNull && !isPV && !inCheck && depth >= 3 && !eg) {
    const R = depth >= 6 ? 3 : 2;
    const nullChess = makeNullChess(chess);
    if (nullChess) {
      const nullScore = -alphaBeta(nullChess, depth - 1 - R, -beta, -beta + 1, ply + 1, ctx, eg, false);
      if (!ctx.aborted && nullScore >= beta) return beta; // прунинг
    }
  }

  const moves = chess.moves({ verbose: true });
  const originalAlpha = alpha;
  const ordered = orderMoves(moves, ctx, ply, ttMove);
  let best = -99999;
  let bestMoveKey: string | null = null;
  let moveCount = 0;

  for (const m of ordered) {
    if (ctx.aborted || Date.now() >= ctx.deadline) { ctx.aborted = true; break; }

    chess.move(m);
    moveCount++;
    const givesCheck = chess.inCheck();

    let score: number;
    const newDepth = depth - 1 + (givesCheck ? 1 : 0); // check extension

    if (moveCount === 1) {
      // Первый ход — полный поиск
      score = -alphaBeta(chess, newDepth, -beta, -alpha, ply + 1, ctx, eg, true);
    } else if (ctx.useLMR && moveCount > 4 && depth >= 3 && !m.captured && !inCheck && !givesCheck) {
      // LMR: тихие поздние ходы ищем с уменьшенной глубиной
      const R = moveCount > 10 ? Math.floor(depth / 3) + 1 : 1;
      score = -alphaBeta(chess, newDepth - R, -alpha - 1, -alpha, ply + 1, ctx, eg, true);
      if (!ctx.aborted && score > alpha) {
        // Пересмотреть на полной глубине если ход оказался хорошим
        score = -alphaBeta(chess, newDepth, -beta, -alpha, ply + 1, ctx, eg, true);
      }
    } else if (isPV && moveCount > 1) {
      // PVS: null-window для неPV ходов
      score = -alphaBeta(chess, newDepth, -alpha - 1, -alpha, ply + 1, ctx, eg, true);
      if (!ctx.aborted && score > alpha && score < beta) {
        score = -alphaBeta(chess, newDepth, -beta, -alpha, ply + 1, ctx, eg, true);
      }
    } else {
      score = -alphaBeta(chess, newDepth, -beta, -alpha, ply + 1, ctx, eg, true);
    }

    chess.undo();
    if (ctx.aborted) break;

    if (score > best) {
      best = score;
      bestMoveKey = mvKey(m);
    }
    if (score > alpha) {
      alpha = score;
      // Обновить killers и history для тихих ходов
      if (!m.captured && !m.flags?.includes('p')) {
        const key = mvKey(m);
        const histKey = m.piece + key;
        ctx.history[histKey] = Math.min(8000, (ctx.history[histKey] ?? 0) + depth * depth);
        if (score >= beta && ply < ctx.killers.length) {
          ctx.killers[ply][1] = ctx.killers[ply][0];
          ctx.killers[ply][0] = key;
        }
      }
    }
    if (alpha >= beta) break;
  }

  if (!ctx.aborted && ctx.useTT && ttKey) {
    const flag: 0 | 1 | 2 = best >= beta ? 1 : (best <= originalAlpha ? 2 : 0);
    ctx.tt.set(ttKey, { score: best, depth, flag, bestMove: bestMoveKey });
  }

  return best;
}

// ── Main JARVIS entry point ───────────────────────────────────────────
const getStockfishMove = (fen: string, level: number): Promise<{ from: string; to: string } | null> => {
  return new Promise((resolve) => {
    try {
      const { Chess: ChessLib } = require("chess.js");
      const cfg = JARVIS_LEVELS[Math.max(0, Math.min(9, level - 1))];

      // Случайный ход для низких уровней
      if (cfg.errorRate > 0 && Math.floor(Math.random() * 100) < cfg.errorRate) {
        const rnd = getRandomMove(fen);
        console.debug(`[JARVIS] Lv${level} — random move (${cfg.errorRate}%)`);
        return resolve(rnd);
      }

      const chess = new ChessLib(fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return resolve(null);

      const deadline = Date.now() + cfg.thinkMs;
      const eg = isEndgame(chess);

      const ctx: SearchCtx = {
        deadline,
        killers: Array.from({ length: 64 }, () => [null, null] as [null, null]),
        history: {},
        tt: new Map(),
        useTT: cfg.useTT,
        useNullMv: cfg.useNullMv,
        useLMR: cfg.useLMR,
        aborted: false,
      };

      // Стартовый ход (fallback)
      let bestMove = moves[Math.floor(Math.random() * moves.length)];

      // Iterative deepening
      for (let depth = 1; depth <= cfg.maxDepth; depth++) {
        if (Date.now() >= deadline) break;

        ctx.aborted = false;
        let localBest: any = null;
        let localBestScore = -99999;

        const orderedMoves = orderMoves(moves, ctx, 0, ctx.tt.get(fenKey(chess))?.bestMove ?? null);

        for (const m of orderedMoves) {
          if (Date.now() >= deadline || ctx.aborted) { ctx.aborted = true; break; }
          chess.move(m);
          const score = -alphaBeta(chess, depth - 1, -99999, 99999, 1, ctx, eg, false);
          chess.undo();
          if (!ctx.aborted && score > localBestScore) {
            localBestScore = score;
            localBest = m;
          }
        }

        // Принимаем результат только если глубина завершена полностью
        if (!ctx.aborted && localBest) {
          bestMove = localBest;
          console.debug(`[JARVIS] Lv${level} depth=${depth} score=${localBestScore} move=${localBest.from}${localBest.to} TT=${ctx.tt.size}`);
        }
        if (ctx.aborted) break;
      }

      resolve({ from: bestMove.from, to: bestMove.to });
    } catch (err) {
      console.warn("[JARVIS] Error:", (err as Error).message);
      resolve(getRandomMove(fen));
    }
  });
};

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
