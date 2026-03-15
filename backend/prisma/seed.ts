import { PrismaClient } from "@prisma/client";
import { COUNTRIES } from "./seeds/countries";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed started...");

  // ─── PlatformConfig ─────────────────────────────────────────────────────────
  await prisma.platformConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  console.log("✅ PlatformConfig");

  // ─── Bot J.A.R.V.I.S ────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { telegramId: "0" },
    create: {
      telegramId: "0",
      firstName: "J.A.R.V.I.S",
      username: "jarvis_chess_bot",
      isBot: true,
      balance: BigInt("999999999999"),
      elo: 3000,
    },
    update: {},
  });
  console.log("✅ J.A.R.V.I.S bot");

  // ─── Clans (сборные) ─────────────────────────────────────────────────────────
  const clans = [
    { name: "Россия",       countryCode: "RU", flag: "🇷🇺", description: "Сборная России" },
    { name: "Бразилия",     countryCode: "BR", flag: "🇧🇷", description: "Seleção do Brasil" },
    { name: "Германия",     countryCode: "DE", flag: "🇩🇪", description: "Mannschaft" },
    { name: "Индия",        countryCode: "IN", flag: "🇮🇳", description: "Team India" },
    { name: "США",          countryCode: "US", flag: "🇺🇸", description: "Team USA" },
    { name: "Китай",        countryCode: "CN", flag: "🇨🇳", description: "中国队" },
    { name: "Франция",      countryCode: "FR", flag: "🇫🇷", description: "Les Bleus" },
    { name: "Испания",      countryCode: "ES", flag: "🇪🇸", description: "La Roja" },
    { name: "Аргентина",    countryCode: "AR", flag: "🇦🇷", description: "La Albiceleste" },
    { name: "Япония",       countryCode: "JP", flag: "🇯🇵", description: "侍ジャパン" },
    { name: "Южная Корея",  countryCode: "KR", flag: "🇰🇷", description: "대한민국" },
    { name: "Украина",      countryCode: "UA", flag: "🇺🇦", description: "Збірна України" },
    { name: "Казахстан",    countryCode: "KZ", flag: "🇰🇿", description: "Қазақстан" },
    { name: "Беларусь",     countryCode: "BY", flag: "🇧🇾", description: "Беларусь" },
    { name: "Польша",       countryCode: "PL", flag: "🇵🇱", description: "Polska" },
  ];

  for (const clan of clans) {
    await prisma.clan.upsert({
      where: { countryCode: clan.countryCode },
      create: clan,
      update: { flag: clan.flag, name: clan.name },
    });
  }
  console.log(`✅ ${clans.length} Clans`);

  const S3 = "https://s3.twcstorage.ru/799d3c02-99e72b95-3b78-492f-af40-bfc39c0f8bb7/items";

  // ─── Shop Items — Avatar Frames ───────────────────────────────────────────
  const avatarFrames = [
    {
      name: "Золотая рамка",
      description: "Сверкающая золотая рамка для чемпионов",
      type: "AVATAR_FRAME" as const,
      category: "PREMIUM" as const,
      rarity: "RARE" as const,
      priceCoins: BigInt(50_000),
      sortOrder: 1,
      imageUrl: `${S3}/avatar_frame_gold.svg`,
      previewUrl: `${S3}/avatar_frame_gold.svg`,
    },
    {
      name: "Алмазная рамка",
      description: "Кристально чистая рамка из алмазного льда",
      type: "AVATAR_FRAME" as const,
      category: "PREMIUM" as const,
      rarity: "EPIC" as const,
      priceCoins: BigInt(200_000),
      sortOrder: 2,
      imageUrl: `${S3}/avatar_frame_diamond.svg`,
      previewUrl: `${S3}/avatar_frame_diamond.svg`,
    },
    {
      name: "Огненная рамка",
      description: "Пламенная рамка для агрессивных игроков",
      type: "AVATAR_FRAME" as const,
      category: "PREMIUM" as const,
      rarity: "EPIC" as const,
      priceCoins: BigInt(200_000),
      sortOrder: 3,
      imageUrl: `${S3}/avatar_frame_fire.svg`,
      previewUrl: `${S3}/avatar_frame_fire.svg`,
    },
    {
      name: "Легендарная рамка ♟",
      description: "Только для тех, кто достиг вершины",
      type: "AVATAR_FRAME" as const,
      category: "PREMIUM" as const,
      rarity: "LEGENDARY" as const,
      priceCoins: BigInt(1_000_000),
      sortOrder: 4,
      imageUrl: `${S3}/avatar_frame_legendary.svg`,
      previewUrl: `${S3}/avatar_frame_legendary.svg`,
    },
  ];

  // ─── Shop Items — Board Skins ─────────────────────────────────────────────
  const boardSkins = [
    {
      name: "Классика",
      description: "Деревянная доска в традиционном стиле",
      type: "BOARD_SKIN" as const,
      category: "BASIC" as const,
      rarity: "COMMON" as const,
      priceCoins: BigInt(10_000),
      sortOrder: 10,
      imageUrl: `${S3}/board_classic.svg`,
      previewUrl: `${S3}/board_classic.svg`,
    },
    {
      name: "Мрамор",
      description: "Доска из белого и чёрного мрамора",
      type: "BOARD_SKIN" as const,
      category: "PREMIUM" as const,
      rarity: "RARE" as const,
      priceCoins: BigInt(75_000),
      sortOrder: 11,
      imageUrl: `${S3}/board_marble.svg`,
      previewUrl: `${S3}/board_marble.svg`,
    },
    {
      name: "Неон",
      description: "Киберпанк стиль с неоновой подсветкой",
      type: "BOARD_SKIN" as const,
      category: "PREMIUM" as const,
      rarity: "EPIC" as const,
      priceCoins: BigInt(300_000),
      sortOrder: 12,
      imageUrl: `${S3}/board_neon.svg`,
      previewUrl: `${S3}/board_neon.svg`,
    },
  ];

  // ─── Shop Items — Piece Skins ─────────────────────────────────────────────
  const pieceSkins = [
    {
      name: "Стандарт",
      description: "Классические фигуры Staunton",
      type: "PIECE_SKIN" as const,
      category: "BASIC" as const,
      rarity: "COMMON" as const,
      priceCoins: BigInt(5_000),
      sortOrder: 20,
      imageUrl: `${S3}/pieces_standard.svg`,
      previewUrl: `${S3}/pieces_standard.svg`,
    },
    {
      name: "Золотые фигуры",
      description: "Все фигуры покрыты золотом",
      type: "PIECE_SKIN" as const,
      category: "PREMIUM" as const,
      rarity: "RARE" as const,
      priceCoins: BigInt(150_000),
      sortOrder: 21,
      imageUrl: `${S3}/pieces_gold.svg`,
      previewUrl: `${S3}/pieces_gold.svg`,
    },
    {
      name: "Кристальные фигуры",
      description: "Прозрачные фигуры с внутренней подсветкой",
      type: "PIECE_SKIN" as const,
      category: "PREMIUM" as const,
      rarity: "EPIC" as const,
      priceCoins: BigInt(500_000),
      sortOrder: 22,
      imageUrl: `${S3}/pieces_crystal.svg`,
      previewUrl: `${S3}/pieces_crystal.svg`,
    },
  ];

  // ─── Shop Items — Move Animations ────────────────────────────────────────
  const moveAnimations = [
    {
      name: "Молния",
      description: "Быстрая молния при каждом ходу",
      type: "MOVE_ANIMATION" as const,
      category: "PREMIUM" as const,
      rarity: "RARE" as const,
      priceCoins: BigInt(30_000),
      sortOrder: 30,
      imageUrl: `${S3}/anim_lightning.svg`,
      previewUrl: `${S3}/anim_lightning.svg`,
    },
    {
      name: "Огонь",
      description: "Огненный след за движущейся фигурой",
      type: "MOVE_ANIMATION" as const,
      category: "PREMIUM" as const,
      rarity: "EPIC" as const,
      priceCoins: BigInt(120_000),
      sortOrder: 31,
      imageUrl: `${S3}/anim_fire.svg`,
      previewUrl: `${S3}/anim_fire.svg`,
    },
  ];

  const allItems = [...avatarFrames, ...boardSkins, ...pieceSkins, ...moveAnimations];

  for (const item of allItems) {
    const existing = await prisma.item.findFirst({
      where: { name: item.name, type: item.type },
    });
    if (existing) {
      // Update imageUrl/previewUrl for existing items
      await prisma.item.update({
        where: { id: existing.id },
        data: { imageUrl: item.imageUrl, previewUrl: item.previewUrl },
      });
    } else {
      await prisma.item.create({ data: item });
    }
  }
  console.log(`✅ ${allItems.length} Shop items`);

  // ─── Tasks ────────────────────────────────────────────────────────────────
  const tasks = [
    {
      taskType: "SUBSCRIBE_TELEGRAM" as const,
      icon: "📢",
      title: "Подписаться на канал ChessCoin",
      description: "Подпишись на официальный канал и получи монеты",
      metadata: { url: "https://t.me/chesscoin_official", channelId: "@chesscoin_official" },
      winningAmount: BigInt(5_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "🐦",
      title: "Подписаться на Twitter/X",
      description: "Подпишись на наш Twitter и получи монеты",
      metadata: { url: "https://x.com/chesscoin" },
      winningAmount: BigInt(3_000),
    },
    {
      taskType: "REFERRAL" as const,
      icon: "👥",
      title: "Пригласить 1 друга",
      description: "Пригласи друга, который сыграет первую игру",
      metadata: { referralCount: 1 },
      winningAmount: BigInt(3_000),
    },
    {
      taskType: "REFERRAL" as const,
      icon: "🤝",
      title: "Пригласить 5 друзей",
      description: "Пригласи 5 друзей, которые сыграют хотя бы одну игру",
      metadata: { referralCount: 5 },
      winningAmount: BigInt(25_000),
    },
    {
      taskType: "REFERRAL" as const,
      icon: "👑",
      title: "Пригласить 20 друзей",
      description: "Создай армию из 20 рефералов",
      metadata: { referralCount: 20 },
      winningAmount: BigInt(150_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "💬",
      title: "Вступить в чат ChessCoin",
      description: "Присоединись к нашему сообществу в Telegram",
      metadata: { url: "https://t.me/chesscoin_chat" },
      winningAmount: BigInt(2_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "▶️",
      title: "Посмотреть видео-гайд",
      description: "Узнай как зарабатывать больше в ChessCoin",
      metadata: { url: "https://youtube.com/@chesscoin", category: "SOCIAL" },
      winningAmount: BigInt(1_000),
    },
    // ─── Обучающие задачи (LEARN) ────────────────────────────────────────────
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "♟️",
      title: "Урок 1: Как ходят фигуры",
      description: "Изучи базовые правила движения всех шахматных фигур",
      metadata: { url: "https://lichess.org/learn#/1", category: "LEARN" },
      winningAmount: BigInt(500),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "♔",
      title: "Урок 2: Цель игры — мат королю",
      description: "Узнай что такое шах, мат и пат — основные правила победы",
      metadata: { url: "https://lichess.org/learn#/4", category: "LEARN" },
      winningAmount: BigInt(1_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "⚖️",
      title: "Урок 3: Ценность фигур",
      description: "Научись оценивать силу каждой фигуры и принимать выгодные размены",
      metadata: { url: "https://lichess.org/learn#/8", category: "LEARN" },
      winningAmount: BigInt(2_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "🎯",
      title: "Урок 4: Тактика — вилка и связка",
      description: "Освой мощные тактические удары: вилку конём и связку слоном",
      metadata: { url: "https://lichess.org/learn#/15", category: "LEARN" },
      winningAmount: BigInt(3_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "🏁",
      title: "Урок 5: Основы эндшпиля",
      description: "Изучи ключевые позиции эндшпиля: король и пешка против короля",
      metadata: { url: "https://lichess.org/learn#/27", category: "LEARN" },
      winningAmount: BigInt(5_000),
    },
  ];

  for (const task of tasks) {
    const existing = await prisma.task.findFirst({ where: { title: task.title } });
    if (!existing) {
      await prisma.task.create({ data: task });
    }
  }
  console.log(`✅ ${tasks.length} Tasks`);

  // ─── Темы интерфейса ─────────────────────────────────────────────────────
  const themes = [
    { name: 'Binance Pro',    description: 'Стиль Binance — тёмный, профессиональный', priceCoins: 10_000n,    rarity: 'COMMON'    },
    { name: 'Chess Classic',  description: 'Классика Chess.com — зелёный и кремовый',  priceCoins: 50_000n,    rarity: 'COMMON'    },
    { name: 'Neon Cyber',     description: 'Неон и киберпанк — фиолетовый/голубой',    priceCoins: 100_000n,   rarity: 'RARE'      },
    { name: 'Royal Gold',     description: 'Королевский синий с золотом',              priceCoins: 250_000n,   rarity: 'RARE'      },
    { name: 'Matrix Dark',    description: 'Зелёный матрицы на чёрном',               priceCoins: 500_000n,   rarity: 'EPIC'      },
    { name: 'Crystal Ice',    description: 'Ледяной кристалл — голубые тона',         priceCoins: 1_000_000n, rarity: 'LEGENDARY' },
  ];

  for (const t of themes) {
    await prisma.item.upsert({
      where: { id: `theme_${t.name.replace(/\s+/g,'_').toLowerCase()}` },
      update: {},
      create: {
        id: `theme_${t.name.replace(/\s+/g,'_').toLowerCase()}`,
        type: 'THEME',
        category: t.rarity === 'LEGENDARY' || t.rarity === 'EPIC' ? 'PREMIUM' : 'BASIC',
        name: t.name,
        description: t.description,
        priceCoins: t.priceCoins,
        rarity: t.rarity as any,
        isActive: true,
        sortOrder: 100,
      },
    });
  }
  console.log(`✅ ${themes.length} Themes`);

  // ─── Countries ──────────────────────────────────────────────────────────────
  let countriesCount = 0;
  for (const c of COUNTRIES) {
    await (prisma as any).country.upsert({
      where: { code: c.code },
      update: { nameRu: c.nameRu, nameEn: c.nameEn, flag: c.flag },
      create: { code: c.code, nameRu: c.nameRu, nameEn: c.nameEn, flag: c.flag },
    });
    countriesCount++;
  }
  console.log(`✅ ${countriesCount} Countries`);

  console.log("🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
