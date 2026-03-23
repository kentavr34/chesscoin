import { SessionStatus, SessionType, SessionSideStatus, TransactionType } from "@prisma/client";
import { Chess } from "chess.js";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import config from "@/config";
import { useAttempt } from "@/services/attempts";
import { updateBalance } from "@/services/economy";

const SESSION_CACHE_TTL = 60 * 60 * 24; // 24 часа в Redis

// ─────────────────────────────────────────
// Проверки перед созданием сессии
// ─────────────────────────────────────────
export const validateCanStartSession = async (
  userId: string,
  type: SessionType
) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { activeSessions: true },
  });

  // Проверка попыток
  if (user.attempts <= 0) {
    throw new Error("NO_ATTEMPTS");
  }

  // Проверка лимита: считаем по типам отдельно
  // BOT сессий максимум 1, BATTLE сессий максимум (maxActive - 1)
  // Итого одновременно: 1 бот + до 2 батлов = 3 сессии

  const botSessions = user.activeSessions.filter(s => s.type === SessionType.BOT);
  const battleSessions = user.activeSessions.filter(s => s.type === SessionType.BATTLE);

  if (type === SessionType.BOT) {
    if (botSessions.length >= config.sessions.maxBotSessions) {
      throw new Error("You are already playing with J.A.R.V.I.S. Finish your current game first.");
    }
  }

  if (type === SessionType.BATTLE) {
    const maxBattles = config.sessions.maxActive - 1; // оставляем слот для бота
    if (battleSessions.length >= maxBattles) {
      throw new Error("Max active battles reached. Finish one of your current games.");
    }
  }

  // Общий лимит как защита
  if (user.activeSessions.length >= config.sessions.maxActive) {
    throw new Error("Active game limit reached. Finish one of your current games.");
  }

  return user;
};

// ─────────────────────────────────────────
// Получить бот-пользователя (JARVIS)
// ─────────────────────────────────────────
export const getBot = async () => {
  return prisma.user.upsert({
    where: { telegramId: "0" },
    update: {},
    create: {
      telegramId: "0",
      firstName: "J.A.R.V.I.S",
      isBot: true,
      avatarType: "GRADIENT",
      avatarGradient: "linear-gradient(135deg, #1a202c, #4a5568)",
    },
  });
};

// ─────────────────────────────────────────
// Создать игру с ботом
// ─────────────────────────────────────────
export const createBotSession = async (
  userId: string,
  color: "white" | "black",
  botLevel: number,
  timeSeconds: number = 600
) => {
  if (botLevel < 1 || botLevel > 20) throw new Error("Invalid bot level");
  if (timeSeconds < 60 || timeSeconds > 3600) timeSeconds = 600;

  const user = await validateCanStartSession(userId, SessionType.BOT);

  // Проверяем разблокировку уровня (нельзя играть уровень выше разблокированного + 1)
  const maxAllowed = (user.jarvisLevel ?? 1) + 1;
  if (botLevel > maxAllowed) throw new Error(`Уровень ${botLevel} ещё не разблокирован. Сначала победи уровень ${maxAllowed - 1}`);

  const bot = await getBot();
  const chess = new Chess();

  await useAttempt(userId);

  const equippedSkins = await prisma.userItem.findMany({
    where: { userId, isEquipped: true, item: { type: { in: ['BOARD_SKIN', 'PIECE_SKIN'] } } },
    include: { item: { select: { type: true, imageUrl: true } } },
  });
  const boardSkinUrl = equippedSkins.find(ui => ui.item.type === 'BOARD_SKIN')?.item.imageUrl ?? null;
  const pieceSkinUrl = equippedSkins.find(ui => ui.item.type === 'PIECE_SKIN')?.item.imageUrl ?? null;

  const session = await prisma.session.create({
    data: {
      type: SessionType.BOT,
      duration: timeSeconds,
      status: SessionStatus.IN_PROGRESS,
      fen: chess.fen(),
      pgn: chess.pgn(),
      botLevel,
      boardSkinUrl,
      pieceSkinUrl,
      turnStartedAt: new Date(),
      sides: {
        create: [
          {
            playerId: userId,
            isWhite: color === "white",
            status: SessionSideStatus.IN_PROGRESS,
            timeLeft: timeSeconds,
          },
          {
            playerId: bot.id,
            isWhite: color === "black",
            isBot: true,
            status: SessionSideStatus.IN_PROGRESS,
            timeLeft: timeSeconds,
          },
        ],
      },
    },
    include: { sides: { include: { player: true } } },
  });

  // Устанавливаем currentSide: белые всегда ходят первыми (правило шахмат)
  const currentSide = session.sides.find((s: Record<string,unknown>) => s.isWhite);
  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: { currentSideId: currentSide?.id },
    include: { sides: { include: { player: true } } },
  });

  // Привязываем к активным сессиям пользователя
  await prisma.user.update({
    where: { id: userId },
    data: { activeSessions: { connect: { id: session.id } } },
  });

  // Кешируем в Redis
  await cacheSession(updatedSession);

  return updatedSession;
};

// ─────────────────────────────────────────
// Создать батл (на ставку)
// ─────────────────────────────────────────
export const createBattleSession = async (
  userId: string,
  color: "white" | "black",
  duration: number, // секунды на игрока
  bet: bigint,
  isPrivate: boolean = false
) => {
  if (bet < 1000n) throw new Error("Min bet is 1000");
  if (duration < 60 || duration > 3600) throw new Error("Invalid duration");

  const user = await validateCanStartSession(userId, SessionType.BATTLE);

  if (user.balance < bet) throw new Error("INSUFFICIENT_BALANCE");

  // Тратим попытку
  await useAttempt(userId);

  // Списываем ставку
  await updateBalance(userId, -(bet as bigint), TransactionType.BATTLE_BET, {
    reason: "battle_created",
  });

  // Генерируем уникальный код
  const code = await generateUniqueCode();
  const chess = new Chess();

  // S3: Читаем экипированные скины создателя
  const equippedSkins = await prisma.userItem.findMany({
    where: { userId, isEquipped: true, item: { type: { in: ['BOARD_SKIN', 'PIECE_SKIN'] } } },
    include: { item: { select: { type: true, imageUrl: true } } },
  });
  const boardSkinUrl = equippedSkins.find(ui => ui.item.type === 'BOARD_SKIN')?.item.imageUrl ?? null;
  const pieceSkinUrl = equippedSkins.find(ui => ui.item.type === 'PIECE_SKIN')?.item.imageUrl ?? null;

  const session = await prisma.session.create({
    data: {
      code,
      type: SessionType.BATTLE,
      status: SessionStatus.WAITING_FOR_OPPONENT,
      fen: chess.fen(),
      pgn: chess.pgn(),
      bet,
      isPrivate,
      duration,
      turnStartedAt: new Date(),
      boardSkinUrl,
      pieceSkinUrl,
      sides: {
        create: {
          playerId: userId,
          isWhite: color === "white",
          status: SessionSideStatus.WAITING_FOR_OPPONENT,
          timeLeft: duration,
        },
      },
    },
    include: { sides: { include: { player: true } } },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { activeSessions: { connect: { id: session.id } } },
  });

  await cacheSession(session);
  return session;
};

// ─────────────────────────────────────────
// Присоединиться к батлу
// ─────────────────────────────────────────
export const joinBattleSession = async (userId: string, code: string) => {
  const session = await prisma.session.findUnique({
    where: { code },
    include: { sides: { include: { player: true } } },
  });

  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (session.status !== SessionStatus.WAITING_FOR_OPPONENT) {
    throw new Error("SESSION_NOT_WAITING");
  }
  if (session.sides[0].playerId === userId) {
    throw new Error("CANNOT_JOIN_OWN_SESSION");
  }

  const bet = session.bet!;
  await validateCanStartSession(userId, SessionType.BATTLE);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.balance < bet) throw new Error("INSUFFICIENT_BALANCE");

  // Тратим попытку и ставку
  await useAttempt(userId);
  await updateBalance(userId, -(bet as bigint), TransactionType.BATTLE_BET, {
    reason: "battle_joined",
    sessionId: session.id,
  });

  // Добавляем второго игрока
  const opponentColor = session.sides[0].isWhite ? "black" : "white";

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      status: SessionStatus.IN_PROGRESS,
      startedAt: new Date(),
      sides: {
        create: {
          playerId: userId,
          isWhite: opponentColor === "white",
          status: SessionSideStatus.IN_PROGRESS,
          timeLeft: session.duration ?? 300,
        },
      },
    },
    include: { sides: { include: { player: true } } },
  });

  // Устанавливаем первый ход (белые начинают)
  const whiteSide = updatedSession.sides.find((s: Record<string,unknown>) => s.isWhite);
  const finalSession = await prisma.session.update({
    where: { id: session.id },
    data: { currentSideId: whiteSide?.id },
    include: { sides: { include: { player: true } } },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { activeSessions: { connect: { id: session.id } } },
  });

  // Также обновляем статус первого игрока
  await prisma.sessionSide.updateMany({
    where: { sessionId: session.id },
    data: { status: SessionSideStatus.IN_PROGRESS },
  });

  await cacheSession(finalSession);
  return finalSession;
};

// ─────────────────────────────────────────
// Создать дружескую игру
// ─────────────────────────────────────────
export const createFriendlySession = async (
  userId: string,
  color: "white" | "black",
  duration: number
) => {
  await validateCanStartSession(userId, SessionType.FRIENDLY);
  await useAttempt(userId);

  const code = await generateUniqueCode();
  const chess = new Chess();

  const session = await prisma.session.create({
    data: {
      code,
      type: SessionType.FRIENDLY,
      status: SessionStatus.WAITING_FOR_OPPONENT,
      fen: chess.fen(),
      pgn: chess.pgn(),
      duration,
      turnStartedAt: new Date(),
      sides: {
        create: {
          playerId: userId,
          isWhite: color === "white",
          status: SessionSideStatus.WAITING_FOR_OPPONENT,
          timeLeft: duration,
        },
      },
    },
    include: { sides: { include: { player: true } } },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { activeSessions: { connect: { id: session.id } } },
  });

  await cacheSession(session);
  return session;
};

// ─────────────────────────────────────────
// Redis cache helpers
// ─────────────────────────────────────────
const sessionKey = (id: string) => `session:${id}`;

export const cacheSession = async (session: Record<string,unknown>) => {
  await redis.setex(
    sessionKey(session.id as string),
    SESSION_CACHE_TTL,
    JSON.stringify(session)
  );
};

export const getCachedSession = async (id: string) => {
  const cached = await redis.get(sessionKey(id));
  return cached ? JSON.parse(cached) : null;
};

export const deleteCachedSession = async (id: string) => {
  await redis.del(sessionKey(id));
};

// ─────────────────────────────────────────
// Генерация уникального кода батла
// ─────────────────────────────────────────
export const generateUniqueCode = async (): Promise<string> => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  let attempts = 0;

  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
    const existing = await prisma.session.findUnique({ where: { code } });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  return code!;
};

// ─────────────────────────────────────────
// Получить список активных батлов (для лобби)
// ─────────────────────────────────────────
export const getActiveBattles = async () => {
  return prisma.session.findMany({
    where: {
      type: SessionType.BATTLE,
      status: SessionStatus.WAITING_FOR_OPPONENT,
      isPrivate: false,       // приватные не попадают в публичный список
    },
    include: {
      sides: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              avatar: true,
              avatarType: true,
              avatarGradient: true,
              elo: true,
              league: true,
            },
          },
        },
      },
    },
    orderBy: { bet: "desc" }, // больше ставка — выше в списке (MasterPlan §3.3)
    take: 50,
  });
};
