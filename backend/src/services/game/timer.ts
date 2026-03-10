import { SessionStatus } from "@prisma/client";
import { redis, redisSub, redisPub } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { finishSession } from "./finish";
import { io } from "@/index";
import { formatSession } from "./format";

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
      const winnerSide = session.sides.find(s => s.id !== sideId && !s.isBot);
      const loserSide = side;

      console.log(`[Timer] Expired for side ${sideId} in session ${session.id}`);

      // Завершаем по истечению времени
      const finished = await finishSession(
        session.id,
        SessionStatus.TIME_EXPIRED,
        {
          winnerSideId: winnerSide?.id,
          loserSideId: loserSide.id,
        }
      );

      // Уведомляем клиентов
      io.to(session.id).emit("game", formatSession(finished, null));
      io.to(session.id).emit("game:over", {
        status: "TIME_EXPIRED",
        winnerSideId: winnerSide?.id,
      });

    } catch (err) {
      console.error("[Timer] Error processing expiry:", err);
    }
  });
};
