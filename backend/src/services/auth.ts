import jwt from "jsonwebtoken";
import { validate } from "@telegram-apps/init-data-node";
import { prisma } from "@/lib/prisma";
import config from "@/config";
import { logger } from "@/lib/logger";
import { giveWelcomeBonus } from "@/services/economy";
import { generateGradient } from "@/utils/gradient";

// Manual initData parser (replaces broken parse() from @telegram-apps/init-data-node v1.2.2)
function parseInitData(initDataString: string) {
  const params = new URLSearchParams(initDataString);
  const userStr = params.get("user");
  const user = userStr ? JSON.parse(userStr) : null;
  return {
    queryId: params.get("query_id") ?? undefined,
    hash: params.get("hash") ?? "",
    authDate: params.has("auth_date")
      ? new Date(parseInt(params.get("auth_date")!, 10) * 1000)
      : new Date(),
    user: user
      ? {
          id: user.id,
          firstName: user.first_name ?? "",
          lastName: user.last_name ?? undefined,
          username: user.username ?? undefined,
          languageCode: user.language_code ?? undefined,
          photoUrl: user.photo_url ?? undefined,
          isPremium: user.is_premium ?? false,
          allowsWriteToPm: user.allows_write_to_pm ?? false,
        }
      : undefined,
    startParam: params.get("start_param") ?? undefined,
  };
}

// ─────────────────────────────────────────
// Telegram Login / Register
// ─────────────────────────────────────────
export const loginWithTelegram = async (
  initDataString: string,
  referrerTelegramId?: string
) => {
  // 1. Валидация подписи Telegram
  if (config.server.nodeEnv !== "production" && config.server.debug && initDataString.startsWith("debug:")) {
    const telegramId = initDataString.replace("debug:", "");
    return loginDebug(parseInt(telegramId));
  }

  try {
    validate(initDataString, config.telegram.botToken, {
      expiresIn: 300, // T20: 5min TTL in all envs
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
    logger.error("[Auth] initData validation failed: " + errMsg);
    throw new Error("Invalid Telegram initData");
  }

  const initData = parseInitData(initDataString);
  if (!initData.user) throw new Error("No user in initData");

  const { id, firstName, lastName, username, languageCode, photoUrl } =
    initData.user;

  // 2. Upsert пользователя
  const isNew = !(await prisma.user.findUnique({
    where: { telegramId: id.toString() },
    select: { id: true },
  }));

  const user = await prisma.user.upsert({
    where: { telegramId: id.toString() },
    update: {
      firstName,
      lastName: lastName ?? null,
      username: username ?? null,
      // Всегда сохраняем оригинальный Telegram-аватар в отдельное поле
      ...(photoUrl ? { telegramAvatar: photoUrl } : {}),
      // Обновляем активный avatar ТОЛЬКО если пользователь не надел премиум-аватар
      // (avatarType NFT = надет предмет из магазина, не трогаем)
      ...(photoUrl ? {
        avatar: prisma.user.fields?.avatarType
          ? undefined // будет заменено ниже через raw check
          : photoUrl,
      } : {}),
    },
    create: {
      telegramId: id.toString(),
      firstName,
      lastName: lastName ?? null,
      username: username ?? null,
      language: languageCode ?? "ru",
      avatar: photoUrl ?? null,
      telegramAvatar: photoUrl ?? null,
      avatarType: photoUrl ? "TELEGRAM" : "GRADIENT",
      avatarGradient: generateGradient(id.toString()),
    },
  });

  // После upsert — обновляем avatar только если не надет премиум (avatarType !== NFT)
  if (photoUrl && user.avatarType !== "NFT" && user.avatarType !== "UPLOAD") {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar: photoUrl, avatarType: "TELEGRAM", telegramAvatar: photoUrl },
    });
  } else if (photoUrl) {
    // Всегда сохраняем оригинальный Telegram-аватар для возможности восстановления
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramAvatar: photoUrl },
    });
  }

  // 3. Welcome бонус новым пользователям
  if (isNew) {
    await giveWelcomeBonus(user.id);

    // 4. Привязываем реферера если есть (из параметра ИЛИ из PendingReferral)
    let effectiveReferrerTelegramId = referrerTelegramId;
    if (!effectiveReferrerTelegramId) {
      // Проверяем pending referral (пришёл по ссылке до первого login)
      const pending = await prisma.pendingReferral.findUnique({
        where: { newTelegramId: id.toString() },
      });
      if (pending) {
        effectiveReferrerTelegramId = pending.referrerTelegramId;
        await prisma.pendingReferral.delete({ where: { newTelegramId: id.toString() } }).catch(() => {});
      }
    }

    if (effectiveReferrerTelegramId && effectiveReferrerTelegramId !== id.toString()) {
      const referrer = await prisma.user.findUnique({
        where: { telegramId: effectiveReferrerTelegramId },
        select: { id: true },
      });
      if (referrer) {
        await prisma.user.update({
          where: { id: user.id },
          data: { referrerId: referrer.id },
        });
      }
    }
  }

  // 5. Re-fetch user with all relations needed by formatUser
  const fullUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      activeSessions: {
        select: {
          id: true, type: true, status: true, fen: true, bet: true, botLevel: true,
          sides: {
            select: {
              isWhite: true, timeLeft: true, isBot: true,
              player: { select: { firstName: true, avatar: true } },
            },
          },
        },
      },
      inventory: {
        where: { isEquipped: true },
        select: {
          isEquipped: true,
          item: { select: { id: true, type: true, name: true, imageUrl: true } },
        },
      },
    },
  });

  // 6. Генерируем токены
  const tokens = generateTokens(user.id);
  return { ...tokens, user: fullUser };
};

// ─────────────────────────────────────────
// DEV: тестовый вход без Telegram
// ─────────────────────────────────────────
const loginDebug = async (telegramId: number) => {
  if (!config.server.debug) throw new Error("Debug mode is disabled");

  const user = await prisma.user.upsert({
    where: { telegramId: telegramId.toString() },
    update: { firstName: `TestUser_${telegramId}` },
    create: {
      telegramId: telegramId.toString(),
      firstName: `TestUser_${telegramId}`,
      avatarGradient: generateGradient(telegramId.toString()),
    },
  });

  const tokens = generateTokens(user.id);
  return { ...tokens, user };
};

// ─────────────────────────────────────────
// Refresh Token
// ─────────────────────────────────────────
export const refreshAccessToken = async (refreshToken: string) => {
  let payload: { userId: string };
  try {
    payload = jwt.verify(
      refreshToken,
      config.jwt.refreshSecret
    ) as { userId: string };
  } catch {
    throw new Error("Invalid refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, isBanned: true },
  });

  if (!user || user.isBanned) throw new Error("User not found or banned");

  return { accessToken: generateAccessToken(payload.userId) };
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
export const signAccessToken = (userId: string) =>
  jwt.sign({ userId }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpires,
  } as jwt.SignOptions);

const generateAccessToken = signAccessToken;

const generateTokens = (userId: string) => ({
  accessToken: generateAccessToken(userId),
  refreshToken: jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpires,
  } as jwt.SignOptions),
});

// ─────────────────────────────────────────
// Middleware: verifyToken
// ─────────────────────────────────────────
export const verifyAccessToken = (token: string): string => {
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as {
      userId: string;
    };
    return payload.userId;
  } catch {
    throw new Error("Invalid access token");
  }
};
