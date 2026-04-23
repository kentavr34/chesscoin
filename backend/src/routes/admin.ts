import { logger, logError } from "@/lib/logger";
/**
 * routes/admin.ts
 *
 * Защищённые эндпойнты для управления контентом магазина.
 * Доступ только пользователям с isAdmin = true.
 *
 * Эндпойнты:
 *   POST   /admin/avatars/upload      — загрузить новый аватар на S3 + создать Item
 *   GET    /admin/avatars             — список всех премиум-аватаров
 *   PATCH  /admin/avatars/:id         — изменить название/цену/редкость
 *   DELETE /admin/avatars/:id         — деактивировать аватар (soft delete)
 *   POST   /admin/users/:telegramId/set-admin — выдать/забрать права админа
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "@/middleware/validate"; // R4
// eslint-disable-next-line @typescript-eslint/no-var-requires
let sharp: unknown; try { sharp = require("sharp"); } catch { sharp = null; }
import multer from "multer";
import { prisma } from "@/lib/prisma";
import { ItemType, ItemCategory, ItemRarity, TransactionType } from "@prisma/client"; // R1
import { redis } from "@/lib/redis";
import { safeStringify } from "@/lib/json"; // Q6: safe BigInt serialization
import { updateBalance } from "@/services/economy";
import { authMiddleware } from "@/middleware/auth";
import { saveFile, deleteFile } from "@/lib/storage";


// ── R4: Zod схемы валидации ───────────────────────────────────────────────────
const BalanceSchema = z.object({
  amount: z.string().regex(/^-?\d+$/, "Must be an integer (positive or negative)"),
  reason: z.string().min(1).max(200).optional().default("admin_adjustment"),
});

const BroadcastSchema = z.object({
  text: z.string().min(1, "Text is required").max(4096, "Max 4096 characters"),
  buttonText: z.string().max(50).optional(),
  buttonUrl: z.string().url("Invalid URL").optional(),
});

const ChannelSchema = z.object({
  text: z.string().min(1).max(4096),
  buttonText: z.string().max(50).optional(),
  buttonUrl: z.string().url().optional(),
});

const TournamentCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  entryFee: z.string().regex(/^\d+$/).default("0"),
  maxPlayers: z.number().int().min(2).max(10000).default(1000),
  type: z.enum(["WORLD", "COUNTRY", "SEASONAL", "MONTHLY", "WEEKLY"]).default("WORLD"),
  durationDays: z.number().int().min(1).max(365).default(7),
});

export const adminRouter = Router();

// ── Middleware: только админы ─────────────────────────────────────────────────
const adminOnly = async (req: Request, res: Response, next: Function) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// ── Multer: принимаем изображения до 10 МБ ───────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: import("express").Request, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"), false);
  },
});

// ── Хелпер: генерация slug из имени ─────────────────────────────────────────
function toSlug(name: string): string {
  return "avatar_" + name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/avatars/upload
// Принимает: multipart/form-data
//   file     — изображение (PNG / JPG / WebP / SVG)
//   name     — название аватара (обязательно)
//   rarity   — COMMON | RARE | EPIC | LEGENDARY  (default: COMMON)
//   price    — цена в монетах (default: 1000)
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.post(
  "/avatars/upload",
  authMiddleware,
  adminOnly,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });

      const { name, rarity = "COMMON", price = "1000" } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "name is required" });

      const slug = toSlug(name.trim());

      // Проверяем уникальность имени
      const existing = await prisma.item.findFirst({
        where: { type: ItemType.PREMIUM_AVATAR, name: name.trim() },
      });
      if (existing) return res.status(409).json({ error: `Avatar '${name}' already exists` });

      // B5: Проверяем что sharp установлен
      if (!sharp) {
        return res.status(500).json({
          error: "sharp is not installed. Run: npm install sharp",
          hint: "Avatar upload requires sharp. Install the package and restart."
        });
      }

      // Обрабатываем изображение: обрезаем в квадрат, ресайз 400×400, WebP
      const sharpFn = sharp as unknown as (input: Buffer) => { resize: (w: number, h: number, opts?: Record<string,unknown>) => { jpeg: (opts: Record<string,unknown>) => { toBuffer: () => Promise<Buffer> }; webp: (opts: Record<string,unknown>) => { toBuffer: () => Promise<Buffer> } } };
      const processedBuffer = await sharpFn(req.file.buffer)
        .resize(400, 400, { fit: "cover", position: "centre" })
        .webp({ quality: 88 })
        .toBuffer();

      // Загружаем на S3
      const s3Key = `premium-avatars/${slug}.webp`;
      const imageUrl = await saveFile(s3Key, processedBuffer, "image/webp");

      // Определяем category по rarity
      const category = (rarity === "LEGENDARY" || rarity === "EPIC") ? "PREMIUM" : "BASIC";

      const SORT: Record<string, number> = { COMMON: 10, RARE: 20, EPIC: 30, LEGENDARY: 40 };
      const RARITY_DESC: Record<string, string> = {
        COMMON: "Standard premium avatar",
        RARE: "Rare avatar with unique design",
        EPIC: "Epic avatar with effects",
        LEGENDARY: "Legendary avatar — only a few own it",
      };

      // Создаём запись в БД
      const item = await prisma.item.create({
        data: {
          type: ItemType.PREMIUM_AVATAR,
          category: category as ItemCategory,
          rarity: rarity as ItemRarity,
          name: name.trim(),
          description: RARITY_DESC[rarity] ?? "Premium avatar",
          imageUrl,
          previewUrl: imageUrl,
          priceCoins: BigInt(price),
          sortOrder: SORT[rarity] ?? 10,
          isActive: true,
        },
      });

      logger.info(`[Admin] Avatar uploaded: "${name}" (${rarity}) → ${s3Key}`);
      res.json({ success: true, item });
    } catch (err: unknown) {
      logger.error("[Admin/upload]", err);
      res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/avatars — список всех премиум-аватаров (включая неактивные)
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.get("/avatars", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      where: { type: ItemType.PREMIUM_AVATAR },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { owners: true } },
      },
    });

    const result = items.map((item: Record<string,unknown>) => ({
      ...item,
      priceCoins: (item as Record<string,unknown> & { priceCoins?: bigint }).priceCoins ?? 0n.toString(),
      ownersCount: ((item as Record<string,unknown> & { _count?: Record<string,unknown> })._count ?? {}).owners,
      _count: undefined,
    }));

    res.json({ items: result });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/avatars/:id — изменить название, цену, редкость
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.patch("/avatars/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, rarity, price, isActive } = req.body;

    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Avatar not found" });

    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(rarity !== undefined ? { rarity } : {}),
        ...(price !== undefined ? { priceCoins: BigInt(price) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    res.json({ success: true, item: { ...updated, priceCoins: updated.priceCoins.toString() } });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/avatars/:id — деактивировать (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.delete("/avatars/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Avatar not found" });

    // Считаем владельцев — если куплен, не удаляем с S3, только деактивируем
    const ownersCount = await prisma.userItem.count({ where: { itemId: id } });

    if (ownersCount === 0 && item.imageUrl?.includes("premium-avatars/")) {
      // Никто не купил — можно удалить с S3
      const key = item.imageUrl.split("/premium-avatars/")[1];
      if (key) await deleteFile(`premium-avatars/${key}`).catch(() => {});
      await prisma.item.delete({ where: { id } });
      return res.json({ success: true, deleted: true });
    }

    // Есть владельцы — только скрываем из магазина
    await prisma.item.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true, deleted: false, message: "Avatar hidden from shop (has owners)" });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users/:telegramId/set-admin — выдать/забрать права админа
// Только существующий админ может это делать.
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.post(
  "/users/:telegramId/set-admin",
  authMiddleware,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const { telegramId } = req.params;
      const { isAdmin } = req.body;

      const target = await prisma.user.findUnique({
        where: { telegramId },
        select: { id: true, firstName: true, isAdmin: true },
      });
      if (!target) return res.status(404).json({ error: "User not found" });

      await prisma.user.update({
        where: { telegramId },
        data: { isAdmin: Boolean(isAdmin) },
      });

      logger.info(`[Admin] ${isAdmin ? "Granted" : "Revoked"} admin for telegramId=${telegramId}`);
      res.json({ success: true, telegramId, isAdmin: Boolean(isAdmin) });
    } catch (err: unknown) {
      res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/me — проверить права текущего пользователя
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, firstName: true, telegramId: true },
    });
    res.json({ isAdmin: user?.isAdmin ?? false });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// ── GET /admin/stats — A5: дашборд статистики ────────────────────────────────
adminRouter.get("/stats", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const [users, sessions, config] = await Promise.all([
      prisma.user.count({ where: { isBot: false } }),
      prisma.session.count(),
      prisma.platformConfig.findUnique({ where: { id: "singleton" } }),
    ]);
    const activeSessions = await prisma.session.count({ where: { status: { in: ["IN_PROGRESS", "WAITING_FOR_OPPONENT"] } } });
    const battlesToday = await prisma.session.count({ where: { type: "BATTLE", createdAt: { gte: new Date(Date.now() - 86400000) } } });
    res.json({ users, sessions, activeSessions, battlesToday, totalEmitted: config?.totalEmitted?.toString() ?? "0", currentPhase: config?.currentPhase ?? 1, platformReserve: config?.platformReserve?.toString() ?? "0" });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── GET /admin/users — A1: поиск пользователей ───────────────────────────────
adminRouter.get("/users", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const { search, limit = "20" } = req.query as { search?: string; limit?: string };
    const users = await prisma.user.findMany({
      where: search ? {
        OR: [
          { telegramId: { contains: search } },
          { username: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
        ],
      } : { isBot: false },
      select: { id: true, telegramId: true, firstName: true, username: true, balance: true, elo: true, isBanned: true, isAdmin: true, createdAt: true },
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
    });
    res.json({ users: users.map(u => ({ ...u, balance: u.balance.toString() })) });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── POST /admin/users/:id/ban — A1: бан/разбан ───────────────────────────────
adminRouter.post("/users/:id/ban", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { isBanned: true } });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: !user.isBanned } });
    res.json({ ok: true, isBanned: updated.isBanned });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── POST /admin/users/:id/balance — A1: изменить баланс ──────────────────────
adminRouter.post("/users/:id/balance", authMiddleware, adminOnly, validate(BalanceSchema), async (req: Request, res: Response) => {
  try {
    const { amount, reason } = req.body; // R4: validated by BalanceSchema
    if (!amount) return res.status(400).json({ error: "amount required" });
    await updateBalance(req.params.id, BigInt(amount), TransactionType.REFERRAL_BONUS, { reason });
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { balance: true } });
    res.json({ ok: true, newBalance: user?.balance.toString() });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── POST /admin/broadcast — A2: рассылка с кнопкой ───────────────────────────
adminRouter.post("/broadcast", authMiddleware, adminOnly, validate(BroadcastSchema), async (req: Request, res: Response) => {
  try {
    const { text, buttonText, buttonUrl } = req.body; // R4: validated

    // Q5: Idempotency lock — защита от двойного нажатия
    const lockKey = "admin:broadcast:lock";
    const locked = await redis.set(lockKey, "1", "EX", 120, "NX");
    if (!locked) {
      return res.status(429).json({
        error: "BROADCAST_IN_PROGRESS",
        message: "Broadcast already in progress. Wait 2 minutes.",
      });
    }

    try {
      const botToken = process.env.BOT_TOKEN;
      if (!botToken) return res.status(500).json({ error: "BOT_TOKEN not set" });
      const users = await prisma.user.findMany({ where: { isBot: false, isBanned: false }, select: { telegramId: true }, take: 10000 });
      let sent = 0, failed = 0;
      const inlineKeyboard = buttonText && buttonUrl ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] } : undefined;
      for (let i = 0; i < users.length; i++) {
        try {
          const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: users[i].telegramId, text, parse_mode: "HTML", ...(inlineKeyboard ? { reply_markup: inlineKeyboard } : {}) }),
          });
          ((await r.json()) as Record<string,unknown>).ok ? sent++ : failed++;
        } catch { failed++; }
        if (i % 30 === 29) await new Promise(r => setTimeout(r, 1000));
      }
      res.json({ ok: true, sent, failed });
    } finally {
      // Q5: всегда снимаем lock — даже при ошибке
      await redis.del(lockKey).catch(() => {});
    }
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── POST /admin/channel — A3: пост в канал ───────────────────────────────────
adminRouter.post("/channel", authMiddleware, adminOnly, validate(ChannelSchema), async (req: Request, res: Response) => {
  try {
    const { text, buttonText, buttonUrl } = req.body; // R4: validated
    const channelId = process.env.TELEGRAM_CHANNEL_ID ?? process.env.TELEGRAM__1001755258296;
    const botToken = process.env.BOT_TOKEN;
    if (!botToken || !channelId) return res.status(500).json({ error: "BOT_TOKEN or CHANNEL_ID not set" });
    const inlineKeyboard = buttonText && buttonUrl ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] } : undefined;
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channelId, text, parse_mode: "HTML", ...(inlineKeyboard ? { reply_markup: inlineKeyboard } : {}) }),
    });
    const data = await r.json() as Record<string, unknown>; // R1
    if (!data.ok) return res.status(400).json({ error: data.description });
    res.json({ ok: true });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── POST /admin/tournaments — A4: создать турнир вручную ─────────────────────
adminRouter.post("/tournaments", authMiddleware, adminOnly, validate(TournamentCreateSchema), async (req: Request, res: Response) => {
  try {
    const { name, description, entryFee, maxPlayers, type, durationDays } = req.body; // R4: validated with defaults
    if (!name) return res.status(400).json({ error: "name required" });
    const endAt = new Date(Date.now() + parseInt(durationDays) * 86400000);
    // BUG-06 fix: используем статически импортированный prisma
    const tournament = await prisma.tournament.create({
      data: { name, description, entryFee: BigInt(entryFee), maxPlayers: parseInt(maxPlayers), startAt: new Date(), endAt, type, period: `admin-${Date.now()}`, status: "REGISTRATION" },
    });
    res.json({ ok: true, tournament });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── GET /admin/exchange/orders — Получить все ордера на бирже ────────────────
adminRouter.get("/exchange/orders", authMiddleware, adminOnly, async (_req: Request, res: Response) => {
  try {
    const orders = await prisma.p2POrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { seller: { select: { firstName: true, telegramId: true } }, buyer: { select: { firstName: true } } },
    });
    res.json({ orders: orders.map(o => ({
      ...o,
      amountCoins: o.amountCoins.toString(),
    })) });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── POST /admin/exchange/orders — Создать ордер от лица системы/админа ──────
adminRouter.post("/exchange/orders", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orderType, amountCoins, priceTon } = req.body;
    
    const amount = BigInt(amountCoins);
    const price = Number(priceTon);
    const totalTon = (Number(amount) / 1_000_000) * price;
    const feeTon = totalTon * 0.005;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.tonWalletAddress) return res.status(403).json({ error: 'Привяжите TON-кошелек к аккаунту админа сначала' });

    // Админ может создавать системные ордера без заморозки баланса или лимитов (создает монеты из воздуха при продаже)
    const order = await prisma.p2POrder.create({
      data: {
        sellerId: userId,
        orderType: orderType ?? "SELL",
        amountCoins: amount,
        priceTon: price,
        totalTon,
        feeTon,
        sellerWallet: user.tonWalletAddress,
        status: "OPEN"
      }
    });

    res.json({ ok: true, order: { ...order, amountCoins: order.amountCoins.toString() } });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});

// ── DELETE /admin/exchange/orders/:id — Отменить любой ордер (модерация) ─────
adminRouter.delete("/exchange/orders/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const order = await prisma.p2POrder.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== 'OPEN') return res.status(400).json({ error: "Order already closed" });

    await prisma.$transaction(async (tx) => {
      await tx.p2POrder.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      // Возвращаем замороженные монеты создателю, ЕСЛИ это был обычный SELL-ордер 
      if (order.orderType === "SELL") {
        await updateBalance(order.sellerId, order.amountCoins, TransactionType.EXCHANGE_UNFREEZE, { reason: 'admin_cancel', orderId }, { tx });
      }
    });

    res.json({ ok: true, deleted: true });
  } catch (err: unknown) { res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) }); }
});
