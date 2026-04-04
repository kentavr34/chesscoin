import { Server, Socket } from "socket.io";
import { logger, logError } from "@/lib/logger";
import { Chess } from "chess.js";
import { SessionStatus, SessionType, TransactionType, SessionSideStatus } from "@prisma/client";
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

// ── Telegram: автопост в канал при создании публичного батла ─────────────────
const BOT_TOKEN = () => process.env.BOT_TOKEN ?? "";
const CHANNEL_ID = () => process.env.TELEGRAM_CHANNEL_ID ?? "";
const BOT_LINK = "https://t.me/chessgamecoin_bot";

// ── Личное уведомление игроку в чат бота ─────────────────────────────────────
async function sendTgToUser(
  telegramId: string,
  text: string,
  url?: string,
  urlLabel?: string,
) {
  if (!BOT_TOKEN() || !telegramId) return;
  try {
    const body: Record<string, unknown> = {
      chat_id: telegramId,
      text,
      parse_mode: "HTML",
    };
    if (url && urlLabel) {
      body.reply_markup = { inline_keyboard: [[{ text: urlLabel, url }]] };
    }
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { /* silent */ }
}

// Проверяем: находится ли пользователь сейчас в комнате игры (просматривает партию)
function isUserInGameRoom(io: Server, sessionId: string, targetUserId: string): boolean {
  const room = io.sockets.adapter.rooms.get(sessionId);
  if (!room) return false;
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId);
    if ((s as any)?.data?.userId === targetUserId) return true;
  }
  return false;
}

async function postNewBattleToChannel(
  creatorName: string,
  bet: bigint,
  durationSecs: number,
  sessionCode: string,
) {
  if (!BOT_TOKEN() || !CHANNEL_ID()) return;
  if (bet < 50_000n) return; // постим только батлы от 50к монет
  try {
    const mins = Math.round(durationSecs / 60);
    const betFmt = (Number(bet) / 1_000_000).toFixed(bet % 1_000_000n === 0n ? 0 : 2);
    const text =
      `⚔️ <b>Новый публичный батл!</b>\n\n` +
      `👤 Игрок: <b>${creatorName}</b>\n` +
      `💰 Ставка: <b>${betFmt}M ᚙ</b>\n` +
      `⏱ Время: <b>${mins} мин</b>\n\n` +
      `🎯 Принять вызов → <a href="${BOT_LINK}?start=battle_${sessionCode}">Войти в батл</a>`;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHANNEL_ID(),
        text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "⚔️ Принять вызов", url: `${BOT_LINK}?start=battle_${sessionCode}` }]],
        },
      }),
    });
  } catch { /* silent — не блокируем и��ру */ }
}

export const cleanupSpectators = (sessionId: string) => {
  spectatorRooms.delete(sessionId);
};
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

        const sessionsRaw = currentUser?.activeSessions ?? [];
        for (const s of sessionsRaw) {
          try {
            const sourceData = await redis.get(`session:source:${s.id}`);
            if (sourceData) {
              const parsed = JSON.parse(sourceData);
              (s as any).sourceType = parsed.sourceType;
              (s as any).sourceMeta = parsed.sourceMeta;
            }
          } catch (e) {}
        }

        const sessions = sessionsRaw.map((s: Record<string,unknown>) =>
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

          // T18: отправляем только добавленный батл (diff вместо полного списка)
          if (!data.isPrivate) {
            const newBattle = formatBattlesList([session], buildSpectatorCounts([session]))[0];
            io.to("lobby").emit("battles:added", newBattle);
            // Автопост в Telegram-канал для крупных публичных батлов
            const creator = session.sides[0]?.player;
            const creatorName = creator?.firstName ?? creator?.username ?? "Игрок";
            postNewBattleToChannel(creatorName, BigInt(data.bet), data.duration, session.code ?? "").catch(() => {});
          }
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

          // T18: diff — убираем батл из лобби (он начался)
          io.to("lobby").emit("battles:removed", session.id);

          // 🔔 Уведомление создателю батла: противник принял вызов
          try {
            const creatorSide = session.sides.find((s: Record<string, unknown>) => s.playerId !== userId);
            if (creatorSide) {
              const creator = await prisma.user.findUnique({
                where: { id: String(creatorSide.playerId) },
                select: { telegramId: true, firstName: true },
              });
              const joiner = session.sides.find((s: Record<string, unknown>) => s.playerId === userId);
              const joinerName = (joiner as any)?.player?.firstName ?? "Противник";
              if (creator?.telegramId) {
                const mins = Math.round((session as any).duration / 60);
                const betFmt = session.bet ? Number(session.bet) >= 1_000_000
                  ? `${(Number(session.bet) / 1_000_000).toFixed(2)}M`
                  : `${Math.round(Number(session.bet) / 1000)}K` : "0";
                await sendTgToUser(
                  creator.telegramId,
                  `⚔️ <b>Батл начался!</b>\n\n👤 Принял: <b>${joinerName}</b>\n💰 Ставка: <b>${betFmt} ᚙ</b>\n⏱ Время: <b>${mins} мин</b>\n\n▶️ Открой игру и ходи!`,
                  `${BOT_LINK}?start=game_${session.id}`,
                  "▶️ Играть",
                );
              }
            }
          } catch { /* silent — уведомление не блокирует игру */ }
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
        }
      }
    );

    // ── Принять приватный батл (Турнир / Война) ───────────────────────────
    socket.on(
      "game:accept_private",
      async (data: { sessionId: string }, callback?: Function) => {
        try {
          const session = await prisma.session.findUnique({
             where: { id: data.sessionId },
             include: { sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } } }
          });
          
          if (!session || session.status !== SessionStatus.WAITING_FOR_OPPONENT) throw new Error("SESSION_NOT_WAITING");
          
          const mySide = session.sides.find((s: Record<string,unknown>) => s.playerId === userId);
          if (!mySide) throw new Error("NOT_YOUR_GAME");

          let updatedSession = session;

          // Обновляем статус моей стороны (если еще не Accepted)
          if (mySide.status !== "IN_PROGRESS") {
             await prisma.sessionSide.update({ where: { id: mySide.id }, data: { status: SessionSideStatus.IN_PROGRESS } });
             
             // Проверяем, приняли ли ОБА игрока
             const updatedSides = await prisma.sessionSide.findMany({ where: { sessionId: data.sessionId } });
             const bothAccepted = updatedSides.every(s => s.status === SessionSideStatus.IN_PROGRESS) && updatedSides.length === 2;

             if (bothAccepted) {
                // Прямо сейчас "вылупляется" партия и становится публичной
                updatedSession = await prisma.session.update({
                  where: { id: data.sessionId },
                  data: {
                     status: SessionStatus.IN_PROGRESS,
                     startedAt: new Date(),
                     isPrivate: false, // ТЕПЕРЬ ОНО ПУБЛИЧНОЕ!
                  },
                  include: { sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } } }
                });
                
                const whiteSide = updatedSession.sides.find((s: Record<string,unknown>) => s.isWhite);
                updatedSession = await prisma.session.update({ 
                  where: { id: data.sessionId }, 
                  data: { currentSideId: whiteSide?.id },
                  include: { sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } } }
                });
                
                await setTimer(data.sessionId);
                
                io.to(data.sessionId).emit("game:started", { sessionId: data.sessionId });
                
                // Добавляем в лобби
                try {
                   const sourceData = await redis.get(`session:source:${data.sessionId}`);
                   if (sourceData) {
                     const parsed = JSON.parse(sourceData);
                     (updatedSession as any).sourceType = parsed.sourceType;
                     (updatedSession as any).sourceMeta = parsed.sourceMeta;
                   }
                } catch (e) {}

                const newBattle = formatBattlesList([updatedSession as any], buildSpectatorCounts([updatedSession]))[0];
                io.to("lobby").emit("battles:added", newBattle);
             } else {
                updatedSession = await prisma.session.findUniqueOrThrow({
                   where: { id: data.sessionId },
                   include: { sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } } }
                });
             }
          }

          try {
             const sourceData = await redis.get(`session:source:${data.sessionId}`);
             if (sourceData) {
               const parsed = JSON.parse(sourceData);
               (updatedSession as any).sourceType = parsed.sourceType;
               (updatedSession as any).sourceMeta = parsed.sourceMeta;
             }
          } catch (e) {}

          socket.join(data.sessionId);
          const formatted = formatSession(updatedSession as any, userId);
          
          if (callback) callback({ ok: true, session: formatted });
          io.to(data.sessionId).emit("game", formatted);
          
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

          // Distributed lock: предотвращает интерливинг ходов
          const moveLock = `move:lock:${sessionId}`;
          const acquired = await redis.set(moveLock, userId, "EX", 5, "NX");
          if (!acquired) {
            if (callback) callback({ ok: false, error: "MOVE_IN_PROGRESS" });
            return;
          }

          try {

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
            cleanupSpectators(sessionId);
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

          if (!updatedSession) {
            logger.error("[Socket] Session not found after move:", sessionId);
            if (callback) callback({ ok: false, error: "Session not found" });
            return;
          }

          await cacheSession(updatedSession);
          const formatted = formatSession(updatedSession, userId);
          io.to(sessionId).emit("game", formatted);
          if (callback) callback({ ok: true, session: formatted });

          // 🔔 Уведомление сопернику о ходе — только если он НЕ в комнате игры
          if (
            session.type === SessionType.BATTLE &&
            nextSide && !nextSide.isBot &&
            !isUserInGameRoom(io, sessionId, nextSide.playerId)
          ) {
            try {
              const opponent = await prisma.user.findUnique({
                where: { id: nextSide.playerId },
                select: { telegramId: true },
              });
              if (opponent?.telegramId) {
                const moverName = mySide
                  ? (session.sides.find((s: Record<string,unknown>) => s.id === mySide.id) as any)?.player?.firstName ?? "Противник"
                  : "Противник";
                await sendTgToUser(
                  opponent.telegramId,
                  `♟️ <b>${moverName}</b> сделал ход!\n\n⚡ Твой ход — не затягивай!`,
                  `${BOT_LINK}?start=game_${sessionId}`,
                  "▶️ Сделать ход",
                );
              }
            } catch { /* silent */ }
          }

          // Ход бота
          if (session.type === SessionType.BOT && nextSide?.isBot) {
            setTimeout(async () => {
              await makeBotMove(socket, io, sessionId);
            }, 400 + Math.random() * 600);
          }

          } finally {
            await redis.del(moveLock).catch(() => {});
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
          cleanupSpectators(data.sessionId);
          if (callback) callback({ ok: true });

          if (session.type === SessionType.BATTLE) {
            io.to("lobby").emit("battles:removed", data.sessionId);
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
          // T18: diff — убираем отменённый батл
          io.to("lobby").emit("battles:removed", data.sessionId);
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
        }
      }
    );

    // ── Предложить / принять / отклонить ничью ───────────
    socket.on("game:offer_draw", async (data: { sessionId: string }) => {
      try {
        await redis.setex(`draw:offered:${data.sessionId}`, 300, userId);
        io.to(data.sessionId).emit("game:draw_offered", { by: userId });
      } catch (err: unknown) {
        logger.error("[Socket] game:offer_draw error:", (err as Error).message);
      }
    });

    socket.on("game:accept_draw", async (data: { sessionId: string }, callback?: Function) => {
      try {
        const offeredBy = await redis.get(`draw:offered:${data.sessionId}`);
        if (!offeredBy) {
          if (callback) callback({ ok: false, error: "No draw offer pending" });
          return;
        }
        if (offeredBy === userId) {
          if (callback) callback({ ok: false, error: "Cannot accept own draw offer" });
          return;
        }
        await redis.del(`draw:offered:${data.sessionId}`);
        await stopAllTimers(data.sessionId);
        const finished = await finishSession(data.sessionId, SessionStatus.DRAW, { isDraw: true });
        const formatted = formatSession(finished, userId);
        io.to(data.sessionId).emit("game", formatted);
        io.to(data.sessionId).emit("game:over", { status: "DRAW" });
        cleanupSpectators(data.sessionId);
        if (callback) callback({ ok: true });
      } catch (err: unknown) {
        logger.error("[Socket] game:accept_draw error:", (err as Error).message);
        if (callback) callback({ ok: false, error: (err as Error).message });
      }
    });

    socket.on("game:decline_draw", async (data: { sessionId: string }) => {
      try {
        await redis.del(`draw:offered:${data.sessionId}`);
        io.to(data.sessionId).emit("game:draw_declined", { by: userId });
      } catch (err: unknown) {
        logger.error("[Socket] game:decline_draw error:", (err as Error).message);
      }
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
      try {
        socket.join("lobby");
        const battles = await getActiveBattles();
        socket.emit("battles:list", formatBattlesList(battles, buildSpectatorCounts(battles)));
      } catch (err: unknown) {
        logger.error("[Socket] battles:subscribe error:", (err as Error).message);
      }
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

    // ── Очередь для войн ──────────────────────────────
    socket.on(
      "war:queue_join",
      async (data: { warId: string; countryId: string }, callback?: Function) => {
        try {
          await redis.sadd(`war:queue:${data.warId}:${data.countryId}`, userId);
          // Auto expire key after 1 hour in case they get stuck
          await redis.expire(`war:queue:${data.warId}:${data.countryId}`, 3600);
          if (callback) callback({ ok: true });
        } catch (err: unknown) {
          if (callback) callback({ ok: false, error: (err as Error).message });
        }
      }
    );

    socket.on(
      "war:queue_leave",
      async (data: { warId: string; countryId: string }, callback?: Function) => {
        try {
          await redis.srem(`war:queue:${data.warId}:${data.countryId}`, userId);
          if (callback) callback({ ok: true });
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
      cleanupSpectators(sessionId);
      return;
    }

    const humanSide = session.sides.find(s => !s.isBot);
    if (!humanSide) {
      logger.error("[BotMove] No human side found in session:", sessionId);
      return;
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { currentSideId: humanSide.id },
    });

    // Переключаем таймер обратно к человеку после хода бота
    if (botSide) {
      await switchTimer(sessionId, botSide.id, humanSide.id);
    }

    const updatedSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { sides: { include: { player: { select: { id: true, firstName: true, lastName: true, username: true, elo: true, avatar: true, avatarType: true, avatarGradient: true, league: true } } } } },
    });

    if (!updatedSession) {
      logger.error("[BotMove] Session not found after update:", sessionId);
      return;
    }

    io.to(sessionId).emit("game", formatSession(updatedSession, humanSide.playerId));
  } catch (err: unknown) {
    logger.error("[BotMove] Error:", err);
  }
};

// ─────────────────────────────────────────
// Stockfish через нативный HTTP микросервис
// Архитектура идентична v1.0.2:
//   - Отдельный контейнер с нативным бинарником Stockfish
//   - node-uci общается с ним через stdin/stdout нативного процесса
//   - depth 10 за ~200-500ms (WASM было 8-15 секунд!)
//   - Простой HTTP POST /move { fen, level } → { bestmove }
// ─────────────────────────────────────────
const STOCKFISH_URL = process.env.STOCKFISH_URL ?? "http://stockfish:3020";

// Таймауты по уровням (с запасом: maxMovetime из server.js + 5 секунд)
const LEVEL_TIMEOUTS = [
  5000, 5000, 5000, 5000, 5000,   // 1-5:  50-500ms movetime + запас
  7000, 7500, 8000, 8500, 8500,   // 6-10: 2000-3500ms movetime + запас
  9000, 9500, 10000, 10500, 11000,// 11-15: 4000-6000ms + запас
  9000, 10000, 11000, 12000, 13000,// 16-20: 4000-8000ms + запас
];

export const getStockfishMove = async (
  fen: string,
  level: number
): Promise<{ from: string; to: string } | null> => {
  const timeoutMs = LEVEL_TIMEOUTS[Math.max(0, Math.min(19, level - 1))];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${STOCKFISH_URL}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, level }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as { bestmove?: string };
    const bestmove = data.bestmove;

    if (!bestmove || bestmove === "(none)") return getRandomMove(fen);

    const from = bestmove.slice(0, 2);
    const to   = bestmove.slice(2, 4);
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return getRandomMove(fen);

    return { from, to };

  } catch (err: unknown) {
    logger.warn("[JARVIS] Stockfish HTTP error:", err instanceof Error ? err.message : String(err), "→ random fallback");
    return getRandomMove(fen);
  }
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
