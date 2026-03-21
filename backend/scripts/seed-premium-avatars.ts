/**
 * seed-premium-avatars.ts
 *
 * Запуск:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-premium-avatars.ts
 *
 * Что делает:
 *  1. Генерирует 12 уникальных SVG-аватаров прямо в коде (не нужны внешние файлы)
 *  2. Загружает их в S3 в папку premium-avatars/
 *  3. Создаёт записи Item в БД (идемпотентно — повторный запуск безопасен)
 *
 * После запуска аватары доступны в магазине на вкладке "Аватары".
 * Если хочешь заменить SVG на свои PNG — положи файлы в scripts/avatars/*.png
 * и скрипт подхватит их автоматически.
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { uploadToS3 } from "../src/lib/s3";

const prisma = new PrismaClient();

// ─── Дефиниции 12 премиум-аватаров ───────────────────────────────────────────

const PREMIUM_AVATARS: Array<{
  id: string;        // уникальный slug (используется как ключ идемпотентности)
  name: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  price: bigint;
  svg: string;       // inline SVG
}> = [
  // ── COMMON (500–1000 ᚙ) ──────────────────────────────────────────────────
  {
    id: "avatar_knight_blue",
    name: "Blue Knight",
    rarity: "COMMON",
    price: 500n,
    svg: makeSVG({
      bg: ["#1A2A6C", "#B21F1F"],
      icon: "♞",
      accent: "#64B5F6",
      glow: "#1565C0",
    }),
  },
  {
    id: "avatar_pawn_green",
    name: "Green Pawn",
    rarity: "COMMON",
    price: 500n,
    svg: makeSVG({
      bg: ["#1B5E20", "#33691E"],
      icon: "♟",
      accent: "#A5D6A7",
      glow: "#2E7D32",
    }),
  },
  {
    id: "avatar_rook_steel",
    name: "Steel Rook",
    rarity: "COMMON",
    price: 750n,
    svg: makeSVG({
      bg: ["#263238", "#455A64"],
      icon: "♜",
      accent: "#B0BEC5",
      glow: "#607D8B",
    }),
  },
  {
    id: "avatar_bishop_violet",
    name: "Violet Bishop",
    rarity: "COMMON",
    price: 750n,
    svg: makeSVG({
      bg: ["#4A148C", "#6A1B9A"],
      icon: "♝",
      accent: "#CE93D8",
      glow: "#7B1FA2",
    }),
  },

  // ── RARE (1500–2500 ᚙ) ───────────────────────────────────────────────────
  {
    id: "avatar_queen_gold",
    name: "Golden Queen",
    rarity: "RARE",
    price: 1500n,
    svg: makeSVG({
      bg: ["#F57F17", "#E65100"],
      icon: "♛",
      accent: "#FFD54F",
      glow: "#FF8F00",
    }),
  },
  {
    id: "avatar_king_crimson",
    name: "Crimson King",
    rarity: "RARE",
    price: 2000n,
    svg: makeSVG({
      bg: ["#B71C1C", "#880E4F"],
      icon: "♚",
      accent: "#EF9A9A",
      glow: "#C62828",
    }),
  },
  {
    id: "avatar_cyber_knight",
    name: "Cyber Knight",
    rarity: "RARE",
    price: 2500n,
    svg: makeSVGCyber({
      bg1: "#0D0D2B",
      bg2: "#1A1A4B",
      icon: "♞",
      neon: "#00E5FF",
    }),
  },

  // ── EPIC (5000–8000 ᚙ) ───────────────────────────────────────────────────
  {
    id: "avatar_galaxy_queen",
    name: "Galaxy Queen",
    rarity: "EPIC",
    price: 5000n,
    svg: makeSVGGalaxy({
      icon: "♛",
      color1: "#7B1FA2",
      color2: "#0D47A1",
      color3: "#AD1457",
    }),
  },
  {
    id: "avatar_dragon_king",
    name: "Dragon King",
    rarity: "EPIC",
    price: 6000n,
    svg: makeSVGCyber({
      bg1: "#1A0000",
      bg2: "#3D0000",
      icon: "♚",
      neon: "#FF3D00",
    }),
  },
  {
    id: "avatar_frost_bishop",
    name: "Frost Bishop",
    rarity: "EPIC",
    price: 8000n,
    svg: makeSVGGalaxy({
      icon: "♝",
      color1: "#006064",
      color2: "#01579B",
      color3: "#00ACC1",
    }),
  },

  // ── LEGENDARY (15000–25000 ᚙ) ────────────────────────────────────────────
  {
    id: "avatar_legend_zeus",
    name: "Zeus",
    rarity: "LEGENDARY",
    price: 15000n,
    svg: makeSVGLegendary({
      icon: "♛",
      color: "#FFD700",
      bgColor: "#0A0A1A",
    }),
  },
  {
    id: "avatar_legend_shadow",
    name: "Shadow Master",
    rarity: "LEGENDARY",
    price: 25000n,
    svg: makeSVGLegendary({
      icon: "♚",
      color: "#9C27B0",
      bgColor: "#050510",
    }),
  },
];

// ─── SVG Generators ───────────────────────────────────────────────────────────

function makeSVG(p: { bg: [string, string]; icon: string; accent: string; glow: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${p.bg[0]}"/>
      <stop offset="100%" stop-color="${p.bg[1]}"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="100" cy="100" r="100" fill="url(#bg)"/>
  <circle cx="100" cy="100" r="96" fill="none" stroke="${p.accent}" stroke-width="1.5" opacity="0.4"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="${p.accent}" stroke-width="0.8" opacity="0.2"/>
  <text x="100" y="125" text-anchor="middle" font-size="72" filter="url(#glow)"
    fill="${p.accent}" font-family="serif">${p.icon}</text>
  <circle cx="100" cy="100" r="98" fill="none" stroke="${p.glow}" stroke-width="3" opacity="0.6"/>
</svg>`;
}

function makeSVGCyber(p: { bg1: string; bg2: string; icon: string; neon: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${p.bg2}"/>
      <stop offset="100%" stop-color="${p.bg1}"/>
    </radialGradient>
    <filter id="neon">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="100" cy="100" r="100" fill="url(#bg)"/>
  <!-- Hexagonal grid lines -->
  <path d="M100 10 L185 55 L185 145 L100 190 L15 145 L15 55 Z"
    fill="none" stroke="${p.neon}" stroke-width="1.5" opacity="0.5"/>
  <path d="M100 30 L170 68 L170 132 L100 170 L30 132 L30 68 Z"
    fill="none" stroke="${p.neon}" stroke-width="0.8" opacity="0.3"/>
  <text x="100" y="125" text-anchor="middle" font-size="72" filter="url(#neon)"
    fill="${p.neon}" font-family="serif">${p.icon}</text>
  <!-- Corner accents -->
  <line x1="15" y1="55" x2="40" y2="55" stroke="${p.neon}" stroke-width="2" opacity="0.8"/>
  <line x1="160" y1="55" x2="185" y2="55" stroke="${p.neon}" stroke-width="2" opacity="0.8"/>
  <line x1="15" y1="145" x2="40" y2="145" stroke="${p.neon}" stroke-width="2" opacity="0.8"/>
  <line x1="160" y1="145" x2="185" y2="145" stroke="${p.neon}" stroke-width="2" opacity="0.8"/>
</svg>`;
}

function makeSVGGalaxy(p: { icon: string; color1: string; color2: string; color3: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="space" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${p.color1}" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="${p.color2}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#050515"/>
    </radialGradient>
    <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${p.color3}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <filter id="starGlow">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="100" cy="100" r="100" fill="url(#space)"/>
  <circle cx="100" cy="100" r="80" fill="url(#glow2)" opacity="0.5"/>
  <!-- Stars -->
  <circle cx="30" cy="25" r="1.5" fill="white" opacity="0.9"/>
  <circle cx="160" cy="40" r="1" fill="white" opacity="0.7"/>
  <circle cx="170" cy="160" r="2" fill="white" opacity="0.8"/>
  <circle cx="25" cy="155" r="1.5" fill="white" opacity="0.6"/>
  <circle cx="145" cy="20" r="1" fill="white" opacity="0.9"/>
  <circle cx="55" cy="175" r="1.5" fill="white" opacity="0.7"/>
  <circle cx="180" cy="90" r="1" fill="white" opacity="0.8"/>
  <text x="100" y="125" text-anchor="middle" font-size="72" filter="url(#starGlow)"
    fill="white" font-family="serif" opacity="0.95">${p.icon}</text>
  <circle cx="100" cy="100" r="98" fill="none" stroke="${p.color3}" stroke-width="2" opacity="0.5"/>
</svg>`;
}

function makeSVGLegendary(p: { icon: string; color: string; bgColor: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="goldbg" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${p.color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${p.bgColor}"/>
    </radialGradient>
    <filter id="legend">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <circle cx="100" cy="100" r="100" fill="${p.bgColor}"/>
  <circle cx="100" cy="100" r="100" fill="url(#goldbg)"/>
  <!-- Ornate rings -->
  <circle cx="100" cy="100" r="95" fill="none" stroke="${p.color}" stroke-width="3" opacity="0.9"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="${p.color}" stroke-width="0.8" opacity="0.5"/>
  <circle cx="100" cy="100" r="75" fill="none" stroke="${p.color}" stroke-width="0.5" opacity="0.3"/>
  <!-- Diamond points -->
  <polygon points="100,5 105,20 100,18 95,20" fill="${p.color}" opacity="0.9"/>
  <polygon points="100,195 105,180 100,182 95,180" fill="${p.color}" opacity="0.9"/>
  <polygon points="5,100 20,95 18,100 20,105" fill="${p.color}" opacity="0.9"/>
  <polygon points="195,100 180,95 182,100 180,105" fill="${p.color}" opacity="0.9"/>
  <!-- Crown accent -->
  <text x="100" y="125" text-anchor="middle" font-size="72" filter="url(#legend)"
    fill="${p.color}" font-family="serif">${p.icon}</text>
  <!-- Sparkles -->
  <circle cx="50" cy="50" r="3" fill="${p.color}" opacity="0.7" filter="url(#legend)"/>
  <circle cx="150" cy="50" r="2" fill="${p.color}" opacity="0.6" filter="url(#legend)"/>
  <circle cx="50" cy="150" r="2" fill="${p.color}" opacity="0.6" filter="url(#legend)"/>
  <circle cx="150" cy="150" r="3" fill="${p.color}" opacity="0.7" filter="url(#legend)"/>
</svg>`;
}

// ─── Описания редкости ────────────────────────────────────────────────────────

const RARITY_DESC: Record<string, string> = {
  COMMON: "Стандартный премиум-аватар",
  RARE: "Редкий аватар с уникальным дизайном",
  EPIC: "Эпический аватар с эффектами",
  LEGENDARY: "Легендарный аватар — единицы обладают им",
};

const SORT_ORDER: Record<string, number> = {
  COMMON: 10,
  RARE: 20,
  EPIC: 30,
  LEGENDARY: 40,
};

// ─── Главная функция ──────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Seeding premium avatars...\n");

  // Проверяем, есть ли локальные PNG/WebP файлы для замены SVG
  const localAvatarsDir = path.join(__dirname, "avatars");
  const hasLocalFiles = fs.existsSync(localAvatarsDir);
  if (hasLocalFiles) {
    console.log(`📁 Found local avatars dir: ${localAvatarsDir}`);
    console.log("   PNG/WebP files there will override generated SVG.\n");
  }

  let created = 0;
  let skipped = 0;

  for (const avatar of PREMIUM_AVATARS) {
    // Идемпотентность: ищем по уникальному slug в description
    const existing = await prisma.item.findFirst({
      where: { type: "PREMIUM_AVATAR", name: avatar.name },
    });

    if (existing) {
      console.log(`  ⏭  Skip: "${avatar.name}" (already exists)`);
      skipped++;
      continue;
    }

    // Определяем что заливать — локальный файл или SVG
    let buffer: Buffer;
    let contentType: string;
    let ext: string;

    const localPng = path.join(localAvatarsDir, `${avatar.id}.png`);
    const localWebp = path.join(localAvatarsDir, `${avatar.id}.webp`);

    if (hasLocalFiles && fs.existsSync(localPng)) {
      buffer = fs.readFileSync(localPng);
      contentType = "image/png";
      ext = "png";
      console.log(`  📸 Using local PNG: ${avatar.id}.png`);
    } else if (hasLocalFiles && fs.existsSync(localWebp)) {
      buffer = fs.readFileSync(localWebp);
      contentType = "image/webp";
      ext = "webp";
      console.log(`  📸 Using local WebP: ${avatar.id}.webp`);
    } else {
      buffer = Buffer.from(avatar.svg, "utf-8");
      contentType = "image/svg+xml";
      ext = "svg";
    }

    // Загружаем на S3
    const s3Key = `premium-avatars/${avatar.id}.${ext}`;
    let imageUrl: string;

    try {
      imageUrl = await uploadToS3(s3Key, buffer, contentType);
      console.log(`  ✅ Uploaded to S3: ${s3Key}`);
    } catch (err: any) {
      console.error(`  ❌ S3 upload failed for ${avatar.id}:`, err.message);
      console.log(`     Storing placeholder URL (can be fixed later)`);
      imageUrl = `https://s3.timeweb.cloud/chesscoin/${s3Key}`;
    }

    // Создаём запись в БД
    await prisma.item.create({
      data: {
        type: "PREMIUM_AVATAR" as any,
        category: avatar.rarity === "LEGENDARY" || avatar.rarity === "EPIC" ? "PREMIUM" : "BASIC",
        rarity: avatar.rarity,
        name: avatar.name,
        description: RARITY_DESC[avatar.rarity],
        imageUrl,
        previewUrl: imageUrl,
        priceCoins: avatar.price,
        sortOrder: SORT_ORDER[avatar.rarity],
        isActive: true,
      },
    });

    console.log(`  🎨 Created item: "${avatar.name}" (${avatar.rarity}) — ${avatar.price} ᚙ`);
    created++;
  }

  console.log(`\n✨ Done! Created: ${created}, Skipped: ${skipped}`);
  console.log("\nNext steps:");
  console.log("  1. Run: npx prisma migrate deploy (if migration not applied yet)");
  console.log("  2. Check shop in app — new 'Аватары' tab should appear");
  console.log("  3. To replace SVG with real PNG: put files in scripts/avatars/<avatar_id>.png");
  console.log("     then re-run this script (existing items won't be duplicated)\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
