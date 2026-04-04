import { SessionStatus } from "@prisma/client";
import { logger, logError } from "@/lib/logger"; // Q2
import { redis, redisSub, redisPub } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { Chess } from "chess.js";
import { finishSession } from "./finish";
import { getIo } from "@/lib/io"; // Q7 fix: no circular dependency
import { formatSession } from "./format";

// Считает количество очков фигур, взятых данным игроком (чем больше — тем лучше)
const calcCapturedScore = (fen: string, isWhite: boolean): number => {
  const board = new Chess(fen).board().flat();
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const opponentColor = isWhite ? 'b' : 'w';
  const opponentRemaining = board
    .filter((sq): sq is NonNullable<typeof sq> => sq !== null && sq.color === opponentColor)
    .reduce((sum, sq) => sum + (values[sq.type] ?? 0), 0);
  // Начальный материал без короля: ферзь(9) + 2 ладьи(10) + 2 слона(6) + 2 коня(6) + 8 пешек(8) = 39
  return 39 - opponentRemaining;
};

const timerKey = (sideId: string) => `timer:${sideId}`;

// ─────────────────────────────────────────
// Установить таймер для текущего хода
// ─────────────────────────────────────────
export const setTimer = async (sessionId: string) => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { sides: true },
  });
  if (!session?.currentSideId) return;

  const currentSide = session.sides.find(s => s.id === session.currentSideId);
  if (!currentSide?.timeLeft || currentSide.timeLeft <= 0) return;

  await redisPub.setex(
    timerKey(currentSide.id),
    currentSide.timeLeft,
    sessionId
  );
};

// ─────────────────────────────────────────
// Переключить таймер после хода
// ─────────────────────────────────────────
export const switchTimer = async (sessionId: string, prevSideId: string, nextSideId: string) => {
  const key = timerKey(prevSideId);
  const timeLeft = await redis.ttl(key);

  if (timeLeft > 0) {
    // Сохраняем оставшееся время
    await prisma.sessionSide.update({
      where: { id: prevSideId },
      data: { timeLeft },
    });
    await redis.del(key);
  }

  // Запускаем таймер следующего игрока
  const nextSide = await prisma.sessionSide.findUnique({
    where: { id: nextSideId },
    select: { timeLeft: true },
  });

  if (nextSide?.timeLeft && nextSide.timeLeft > 0) {
    await redisPub.setex(timerKey(nextSideId), nextSide.timeLeft, sessionId);
  }
};

// ─────────────────────────────────────────
// Остановить все таймеры сессии
// ─────────────────────────────────────────
export const stopAllTimers = async (sessionId: string) => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { sides: true },
  });
  if (!session) return;

  for (const side of session.sides) {
    const key = timerKey(side.id);
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await prisma.sessionSide.update({
        where: { id: side.id },
        data: { timeLeft: ttl },
      });
      await redis.del(key);
    }
  }

  // FIX #10: чистим watchedSessions чтобы не копились мёртвые записи
  clearWatchedSides(session.sides.map(s => s.id));
};

// ─────────────────────────────────────────
// Слушатель истёкших таймеров
// ─────────────────────────────────────────
const watchedSessions = new Set<string>();

export const watchTimer = (sessionId: string, sideId: string) => {
  if (watchedSessions.has(sideId)) return;
  watchedSessions.add(sideId);
};

// FIX #10: Очищаем записи watchedSessions при завершении сессии,
// иначе Set растёт бесконечно — утечка памяти при долгой работе сервера.
// Вызывается из stopAllTimers (который вызывается при любом завершении партии).
export const clearWatchedSides = (sideIds: string[]) => {
  for (const id of sideIds) watchedSessions.delete(id);
};

// Запускается один раз при старте сервера
export const startTimerWatcher = () => {
  const channel = `__keyevent@0__:expired`;

  redisSub.subscribe(channel, (err) => {
    if (err) logger.error("[Timer] Subscribe error:", err);
    else logger.info("[Timer] Watching Redis keyspace events");
  });

  // PERF-001: Периодическая очистка watchedSessions от мёртвых записей
  // (на случай если сессия завершилась без вызова stopAllTimers)
  setInterval(() => {
    if (watchedSessions.size > 500) {
      logger.warn(`[Timer] watchedSessions size: ${watchedSessions.size}, forcing cleanup`);
      watchedSessions.clear();
    }
  }, 3600_000); // каждый час

  redisSub.on("message", async (_channel, message) => {
    if (!message.startsWith("timer:")) return;

    const sideId = message.slice(6); // убираем "timer:"

    try {
      // Находим сессию по этому side
      const side = await prisma.sessionSide.findUnique({
        where: { id: sideId },
        include: {
          session: {
            include: { sides: { include: { player: true } } },
          },
        },
      });

      if (!side || side.session.status !== SessionStatus.IN_PROGRESS) return;

      const session = side.session;
      const expiredSide = side;
      const otherSide = session.sides.find(s => s.id !== sideId);

      logger.info(`[Timer] Expired for side ${sideId} in session ${session.id}`);

      // Определяем победителя 
      const chess = new Chess(session.fen);
      const moves = chess.history();

      // Distributed lock: только один инстанс завершает сессию
      const lockKey = `finish:lock:${session.id}`;
      const locked = await redis.set(lockKey, "1", "EX", 15, "NX");
      if (!locked) {
        logger.info(`[Timer] Session ${session.id} already being finished by another instance`);
        return;
      }

      if (moves.length === 0) {
        // Никто не сделал ходов. Отменяем игру, возвращаем ставки как при ничьей
        logger.info(`[Timer] No moves made in session ${session.id}, cancelling`);
        const finished = await finishSession(session.id, SessionStatus.CANCELLED, { isDraw: true });
        getIo().to(session.id).emit("game", formatSession(finished, null));
        getIo().to(session.id).emit("game:over", { status: "CANCELLED" });
        getIo().to("lobby").emit("battles:live:removed", session.id);
        return;
      }

      // Игрок не сделал следующий ожидаемый шаг (таймаут) — побеждает тот, кто сделал ход (оппонент).
      const winnerSideId = otherSide?.id;
      const loserSideId = expiredSide.id;

      const finished = await finishSession(
        session.id,
        SessionStatus.TIME_EXPIRED,
        {
          winnerSideId,
          loserSideId,
        }
      );

      // Уведомляем клиентов
      getIo().to(session.id).emit("game", formatSession(finished, null));
      getIo().to(session.id).emit("game:over", {
        status: "TIME_EXPIRED",
        winnerSideId,
      });
      getIo().to("lobby").emit("battles:live:removed", session.id);

    } catch (err: unknown) {
      logger.error("[Timer] Error processing expiry:", err);
    }
  });
};
