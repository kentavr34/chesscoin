import { Server, Socket } from "socket.io";
import { logger, logError } from "@/lib/logger";
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
    logger.debug(`[Socket] Connected: ${socket.id} [user: ${userId}]`);

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
        logger.debug(`[Socket] Rejoined session: ${session.id}`);
      }
    }

    // ── Disconnect ──────────────────────────────────────
    socket.on("disconnect", async () => {
      logger.debug(`[Socket] Disconnected: ${socket.id} [user: ${userId}]`);
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
                sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } },
              },
            },
          },
        });

        const sessions = (currentUser?.activeSessions ?? []).map((s: Record<string,unknown>) =>
          formatSession(s as unknown as import("@/types/db").SessionWithSides, userId)
        );

        if (callback) callback({ ok: true, sessions });
        else socket.emit("game:current", sessions);
      } catch (err: unknown) {
        if (callback) callback({ ok: false, error: (err as Error).message });
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
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
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
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
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
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
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
              sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } },
            },
          });

          if (!session || session.status !== SessionStatus.IN_PROGRESS) {
            throw new Error("SESSION_NOT_ACTIVE");
          }

          const mySide = session.sides.find((s: Record<string,unknown>) => s.playerId === userId && !s.isBot);
          if (!mySide) throw new Error("NOT_YOUR_GAME");
          if (session.currentSideId !== mySide.id) throw new Error("NOT_YOUR_TURN");

          // FIX #8: new Chess(fen) + loadPgn() конфликтуют — loadPgn сбрасывает FEN из конструктора.
          // Если PGN не пустой — восстанавливаем состояние через него (он содержит полную историю).
          // Если PGN пустой (начало партии) — используем FEN напрямую.
          const chess = session.pgn
            ? new Chess()
            : new Chess(session.fen);
          if (session.pgn) chess.loadPgn(session.pgn);

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
            include: { sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } } },
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
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
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
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
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
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
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
      } catch (err: unknown) {
        if (callback) callback({ ok: false, error: (err as Error).message });
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
    const buildSpectatorCounts = (battles: Array<{ id: string }>) => {
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

          // Добавляем в пул доната сессии и сразу читаем актуальное значение
          // FIX #7: раньше totalPool считался по устаревшему session.donationPool,
          // что при параллельных донатах давало неверную сумму в событии
          const updatedSession = await prisma.session.update({
            where: { id: data.sessionId },
            data: { donationPool: { increment: amountBig } },
            select: { donationPool: true },
          });

          // Уведомляем всех в комнате
          io.to(data.sessionId).emit("battle:donated", {
            donorId: userId,
            amount: amountBig.toString(),
            totalPool: updatedSession.donationPool.toString(),
          });
          if (callback) callback({ ok: true });
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
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
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
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
        sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } },
      },
    });
    if (!session || session.status !== SessionStatus.IN_PROGRESS) return;

    const botSide = session.sides.find(s => s.isBot);
    if (!session.currentSideId || session.currentSideId !== botSide?.id) return;

    // FIX #8: аналогично game:move — загружаем через PGN если он не пустой
    const chess = session.pgn
      ? new Chess()
      : new Chess(session.fen);
    if (session.pgn) chess.loadPgn(session.pgn);

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
      include: { sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } } },
    });

    io.to(sessionId).emit("game", formatSession(updatedSession, humanSide?.playerId ?? null));
  } catch (err: unknown) {
    logger.error("[BotMove] Error:", err);
  }
};

// ─────────────────────────────────────────
// ─────────────────────────────────────────
// Stockfish WASM через Worker Thread
// Не блокирует основной event loop.
// Каждый запрос — отдельный Worker, изолированное состояние.
// ─────────────────────────────────────────
import { Worker } from "worker_threads";
import { stockfishPool } from "./stockfishPool"; // OPT-6: Worker Pool
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Путь к скомпилированному воркеру (tsc собирает в dist/)
const WORKER_PATH = path.join(__dirname, "stockfishWorker.js");

const getStockfishMove = (
  fen: string,
  level: number
): Promise<{ from: string; to: string } | null> => {
  return new Promise(async (resolve) => {
    const requestId = uuidv4();
    // movetime на уровень + 5 сек запаса до полного kill
    // BUG-02 fix: расширено до 20 уровней (было 10)
    const levelMovetimes = [
      50,   // 1  Beginner
      100,  // 2  Rookie
      200,  // 3  Player
      300,  // 4  Challenger
      500,  // 5  Fighter
      800,  // 6  Guardian
      1200, // 7  Warrior
      2000, // 8  Knight
      3000, // 9  Expert
      4000, // 10 Tactician
      5000, // 11 Master
      6000, // 12 Grandmaster
      7500, // 13 Professional
      9000, // 14 Champion
      11000,// 15 Elite
      13000,// 16 Epic
      15000,// 17 Legendary
      18000,// 18 Immortal
      22000,// 19 Divine
      30000,// 20 Mystic
    ];
    const movetime = levelMovetimes[Math.max(0, Math.min(19, level - 1))];
    const hardTimeout = movetime + 6000;

    let worker: Worker;
    try {
      worker = await stockfishPool.acquire(movetime + 2000); // OPT-6: берём из пула
    } catch (err: unknown) {
      logger.warn("[JARVIS] Pool exhausted:", (err as Error).message, "→ random fallback");
      resolve(getRandomMove(fen));
      return;
    }

    const killTimer = setTimeout(() => {
      logger.warn("[JARVIS] Hard kill worker after", hardTimeout, "ms");
      stockfishPool.release(worker); // OPT-6: возвращаем в пул
      resolve(getRandomMove(fen));
    }, hardTimeout);

    worker.on("message", (msg: { bestmove?: string; type?: string; [key: string]: unknown }) => {
      // Первое сообщение от воркера — { ready: true }, игнорируем
      if (msg.ready) return;
      if (msg.requestId !== requestId) return;
      clearTimeout(killTimer);
      worker.terminate();
      resolve((msg.move ?? getRandomMove(fen)) as { from: string; to: string } | null);
    });

    worker.on("error", (err) => {
      logger.warn("[JARVIS] Worker error:", err.message, "→ random fallback");
      clearTimeout(killTimer);
      resolve(getRandomMove(fen));
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        logger.warn("[JARVIS] Worker exited with code", code);
      }
    });

    // Отправляем задание воркеру
    worker.postMessage({ fen, level, requestId });
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
