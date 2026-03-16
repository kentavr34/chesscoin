import { SessionStatus } from "@prisma/client";
import { redis, redisSub, redisPub } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { Chess } from "chess.js";
import { finishSession } from "./finish";
import { io } from "@/index";
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
};

// ─────────────────────────────────────────
// Слушатель истёкших таймеров
// ─────────────────────────────────────────
const watchedSessions = new Set<string>();

export const watchTimer = (sessionId: string, sideId: string) => {
  if (watchedSessions.has(sideId)) return;
  watchedSessions.add(sideId);
};

// Запускается один раз при старте сервера
export const startTimerWatcher = () => {
  const channel = `__keyevent@0__:expired`;

  redisSub.subscribe(channel, (err) => {
    if (err) console.error("[Timer] Subscribe error:", err);
    else console.log("[Timer] Watching Redis keyspace events");
  });

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

      console.log(`[Timer] Expired for side ${sideId} in session ${session.id}`);

      // Определяем победителя по взятому материалу
      let winnerSideId: string | undefined;
      let loserSideId: string | undefined;

      if (otherSide) {
        const expiredCaptures = calcCapturedScore(session.fen, expiredSide.isWhite);
        const otherCaptures = calcCapturedScore(session.fen, otherSide.isWhite);

        if (expiredCaptures > otherCaptures) {
          // У истёкшего игрока больше взятых фигур — он выигрывает
          winnerSideId = expiredSide.id;
          loserSideId = otherSide.id;
        } else {
          // Оппонент взял больше или равно — оппонент выигрывает (у него было время)
          winnerSideId = otherSide.id;
          loserSideId = expiredSide.id;
        }
      } else {
        loserSideId = expiredSide.id;
      }

      // Завершаем по истечению времени
      const finished = await finishSession(
        session.id,
        SessionStatus.TIME_EXPIRED,
        {
          winnerSideId,
          loserSideId,
        }
      );

      // Уведомляем клиентов
      const humanSide = session.sides.find((s: any) => !s.isBot);
      io.to(session.id).emit("game", formatSession(finished, humanSide?.playerId ?? null));
      io.to(session.id).emit("game:over", {
        status: "TIME_EXPIRED",
        winnerSideId,
      });

    } catch (err) {
      console.error("[Timer] Error processing expiry:", err);
    }
  });
};
