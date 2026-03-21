import { PrismaClient } from "@prisma/client";
import { COUNTRIES } from "./seeds/countries";
import { BUILTIN_PUZZLES, calcPuzzleReward } from "./seeds/puzzles";

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
    { name: "Золотая рамка",       description: "Сверкающая золотая рамка для чемпионов",       type: "AVATAR_FRAME" as const, category: "BASIC" as const,   rarity: "RARE" as const,      priceCoins: BigInt(50_000),    sortOrder: 1, imageUrl: `${S3}/avatar_frame_gold.svg`,        previewUrl: `${S3}/avatar_frame_gold.svg` },
    { name: "Серебряная рамка",    description: "Элегантная серебряная рамка",                   type: "AVATAR_FRAME" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(20_000),    sortOrder: 2, imageUrl: `${S3}/avatar_frame_silver.svg`,      previewUrl: `${S3}/avatar_frame_silver.svg` },
    { name: "Платиновая рамка",    description: "Редкий платиновый блеск вокруг аватара",        type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(100_000),   sortOrder: 3, imageUrl: `${S3}/avatar_frame_platinum.svg`,    previewUrl: `${S3}/avatar_frame_platinum.svg` },
    { name: "Алмазная рамка",      description: "Кристально чистая рамка из алмазного льда",    type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),   sortOrder: 4, imageUrl: `${S3}/avatar_frame_diamond.svg`,     previewUrl: `${S3}/avatar_frame_diamond.svg` },
    { name: "Огненная рамка",      description: "Пламенная рамка для агрессивных игроков",       type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),   sortOrder: 5, imageUrl: `${S3}/avatar_frame_fire.svg`,        previewUrl: `${S3}/avatar_frame_fire.svg` },
    { name: "Неоновая рамка",      description: "Яркое неоновое свечение — стиль киберпанк",    type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(250_000),   sortOrder: 6, imageUrl: `${S3}/avatar_frame_neon.svg`,        previewUrl: `${S3}/avatar_frame_neon.svg` },
    { name: "Хрустальная рамка",   description: "Ледяной кристалл переливается на солнце",      type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(300_000),   sortOrder: 7, imageUrl: `${S3}/avatar_frame_crystal.svg`,     previewUrl: `${S3}/avatar_frame_crystal.svg` },
    { name: "Командирская рамка",  description: "Рамка для Главнокомандующих — алая и грозная", type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(400_000),   sortOrder: 8, imageUrl: `${S3}/avatar_frame_commander.svg`,   previewUrl: `${S3}/avatar_frame_commander.svg` },
    { name: "Легендарная рамка ♟", description: "Только для тех, кто достиг вершины",           type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(1_000_000), sortOrder: 9, imageUrl: `${S3}/avatar_frame_legendary.svg`,   previewUrl: `${S3}/avatar_frame_legendary.svg` },
    { name: "Чемпионская рамка",   description: "Золотая аура Чемпиона мира по ChessCoin",      type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(2_000_000), sortOrder: 10, imageUrl: `${S3}/avatar_frame_champion.svg`,   previewUrl: `${S3}/avatar_frame_champion.svg` },
  ];

  // ─── Shop Items — Board Skins ─────────────────────────────────────────────
  const boardSkins = [
    { name: "Классика",       description: "Деревянная доска в традиционном стиле",          type: "BOARD_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(10_000),   sortOrder: 10, imageUrl: `${S3}/board_classic.svg`,    previewUrl: `${S3}/board_classic.svg` },
    { name: "Дерево тёмное",  description: "Тёмная доска из красного дерева",                type: "BOARD_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(25_000),   sortOrder: 11, imageUrl: `${S3}/board_darkwood.svg`,   previewUrl: `${S3}/board_darkwood.svg` },
    { name: "Мрамор",         description: "Доска из белого и чёрного мрамора",              type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(75_000),   sortOrder: 12, imageUrl: `${S3}/board_marble.svg`,     previewUrl: `${S3}/board_marble.svg` },
    { name: "Малахит",        description: "Зелёный малахит с прожилками золота",            type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(100_000),  sortOrder: 13, imageUrl: `${S3}/board_malachite.svg`,  previewUrl: `${S3}/board_malachite.svg` },
    { name: "Золото",         description: "Золотая доска для истинных победителей",         type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(150_000),  sortOrder: 14, imageUrl: `${S3}/board_gold.svg`,       previewUrl: `${S3}/board_gold.svg` },
    { name: "Лёд",            description: "Кристальная ледяная поверхность",                type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),  sortOrder: 15, imageUrl: `${S3}/board_ice.svg`,        previewUrl: `${S3}/board_ice.svg` },
    { name: "Ночь",           description: "Тёмная доска для ночных партий",                 type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),  sortOrder: 16, imageUrl: `${S3}/board_night.svg`,      previewUrl: `${S3}/board_night.svg` },
    { name: "Неон",           description: "Киберпанк стиль с неоновой подсветкой",          type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(300_000),  sortOrder: 17, imageUrl: `${S3}/board_neon.svg`,       previewUrl: `${S3}/board_neon.svg` },
    { name: "Пустыня",        description: "Песочная доска с узорами пустыни",               type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(350_000),  sortOrder: 18, imageUrl: `${S3}/board_desert.svg`,     previewUrl: `${S3}/board_desert.svg` },
    { name: "Кибер",          description: "Голографическая кибернетическая доска",          type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(750_000),  sortOrder: 19, imageUrl: `${S3}/board_cyber.svg`,      previewUrl: `${S3}/board_cyber.svg` },
  ];

  // ─── Shop Items — Piece Skins ─────────────────────────────────────────────
  const pieceSkins = [
    { name: "Стандарт",          description: "Классические фигуры Staunton",                  type: "PIECE_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(5_000),    sortOrder: 20, imageUrl: `${S3}/pieces_standard.svg`,   previewUrl: `${S3}/pieces_standard.svg` },
    { name: "Серебряные фигуры", description: "Серебристые фигуры с матовым блеском",          type: "PIECE_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(30_000),   sortOrder: 21, imageUrl: `${S3}/pieces_silver.svg`,     previewUrl: `${S3}/pieces_silver.svg` },
    { name: "Бронзовые фигуры",  description: "Тёплый бронзовый оттенок классики",             type: "PIECE_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(40_000),   sortOrder: 22, imageUrl: `${S3}/pieces_bronze.svg`,     previewUrl: `${S3}/pieces_bronze.svg` },
    { name: "Золотые фигуры",    description: "Все фигуры покрыты золотом",                    type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(150_000),  sortOrder: 23, imageUrl: `${S3}/pieces_gold.svg`,       previewUrl: `${S3}/pieces_gold.svg` },
    { name: "Теневые фигуры",    description: "Тёмные силуэты с таинственным свечением",       type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(200_000),  sortOrder: 24, imageUrl: `${S3}/pieces_shadow.svg`,     previewUrl: `${S3}/pieces_shadow.svg` },
    { name: "Неоновые фигуры",   description: "Светятся неоновым зелёным в темноте",           type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(300_000),  sortOrder: 25, imageUrl: `${S3}/pieces_neon.svg`,       previewUrl: `${S3}/pieces_neon.svg` },
    { name: "Кристальные фигуры",description: "Прозрачные фигуры с внутренней подсветкой",    type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(500_000),  sortOrder: 26, imageUrl: `${S3}/pieces_crystal.svg`,    previewUrl: `${S3}/pieces_crystal.svg` },
    { name: "Пиксельные фигуры", description: "Ретро-стиль 8-бит пиксель арт",                type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(400_000),  sortOrder: 27, imageUrl: `${S3}/pieces_pixel.svg`,      previewUrl: `${S3}/pieces_pixel.svg` },
    { name: "Аниме фигуры",      description: "Яркие аниме-персонажи на каждой фигуре",       type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(450_000),  sortOrder: 28, imageUrl: `${S3}/pieces_anime.svg`,      previewUrl: `${S3}/pieces_anime.svg` },
    { name: "Золото Легенды",    description: "Легендарный набор с гравировкой ELO чемпионов", type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(1_500_000),sortOrder: 29, imageUrl: `${S3}/pieces_legend.svg`,     previewUrl: `${S3}/pieces_legend.svg` },
  ];

  // ─── Shop Items — Move Animations ────────────────────────────────────────
  const moveAnimations = [
    { name: "Молния",    description: "Быстрая молния при каждом ходу",              type: "MOVE_ANIMATION" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(30_000),   sortOrder: 30, imageUrl: `${S3}/anim_lightning.svg`, previewUrl: `${S3}/anim_lightning.svg` },
    { name: "Звёзды",   description: "Звёздный след за фигурой",                    type: "MOVE_ANIMATION" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(40_000),   sortOrder: 31, imageUrl: `${S3}/anim_stars.svg`,     previewUrl: `${S3}/anim_stars.svg` },
    { name: "Огонь",    description: "Огненный след за движущейся фигурой",         type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(120_000),  sortOrder: 32, imageUrl: `${S3}/anim_fire.svg`,      previewUrl: `${S3}/anim_fire.svg` },
    { name: "Лёд",      description: "Ледяной шлейф — замораживает противника",     type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(120_000),  sortOrder: 33, imageUrl: `${S3}/anim_ice.svg`,       previewUrl: `${S3}/anim_ice.svg` },
    { name: "Взрыв",    description: "Взрыв при каждом взятии фигуры",              type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(150_000),  sortOrder: 34, imageUrl: `${S3}/anim_explosion.svg`, previewUrl: `${S3}/anim_explosion.svg` },
    { name: "Дым",      description: "Таинственный дымовой след",                   type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),  sortOrder: 35, imageUrl: `${S3}/anim_smoke.svg`,     previewUrl: `${S3}/anim_smoke.svg` },
    { name: "Радуга",   description: "Радужный след — яркий и позитивный",          type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(250_000),  sortOrder: 36, imageUrl: `${S3}/anim_rainbow.svg`,   previewUrl: `${S3}/anim_rainbow.svg` },
    { name: "Матрица",  description: "Зелёный код Матрицы за каждым ходом",         type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(300_000),  sortOrder: 37, imageUrl: `${S3}/anim_matrix.svg`,    previewUrl: `${S3}/anim_matrix.svg` },
    { name: "Портал",   description: "Фигура телепортируется сквозь портал",        type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(500_000),  sortOrder: 38, imageUrl: `${S3}/anim_portal.svg`,    previewUrl: `${S3}/anim_portal.svg` },
    { name: "Гром",     description: "Гром и молния — доминирование на доске",      type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(750_000),  sortOrder: 39, imageUrl: `${S3}/anim_thunder.svg`,   previewUrl: `${S3}/anim_thunder.svg` },
  ];


  const pieceSets = [
    { name: "ChessCoin Original", description: "Фирменные фигуры ChessCoin — по умолчанию",   type: "PIECE_SET" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(0),         sortOrder: 50 },
    { name: "Classic (Lichess)",  description: "Классический набор Staunton от Lichess (cburnett)", type: "PIECE_SET" as const, category: "BASIC" as const, rarity: "COMMON" as const, priceCoins: BigInt(25_000),    sortOrder: 51 },
    { name: "Flat Minimal",       description: "Плоские минималистичные фигуры без теней",     type: "PIECE_SET" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(15_000),    sortOrder: 52 },
    { name: "Glossy 3D",          description: "Глянцевые объёмные фигуры с бликом",           type: "PIECE_SET" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(100_000),   sortOrder: 53 },
    { name: "Neon Glow",          description: "Тёмные фигуры с неоновым свечением контура",   type: "PIECE_SET" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(250_000),   sortOrder: 54 },
    { name: "Crystal Glass",      description: "Прозрачные стеклянные фигуры с синим оттенком", type: "PIECE_SET" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(750_000),   sortOrder: 55 },
    { name: "Emoji Fun",          description: "Весёлые Unicode шахматные символы ♔♕♖♗♘♙",    type: "PIECE_SET" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(5_000),     sortOrder: 56 },
  ];

  const allItems = [...avatarFrames, ...boardSkins, ...pieceSkins, ...moveAnimations, ...pieceSets];

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
  // N15: добавлены базовые игровые задания
  const tasks = [
    // Социальные задачи
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
      metadata: { url: "https://youtube.com/@chesscoin" },
      winningAmount: BigInt(1_000),
    },
    // Реферальные задачи
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
    // N15: Игровые задачи через ENTER_CODE (используем как универсальный тип)
    // TODO v6.0.9: добавить DAILY_LOGIN, GAME_WIN, GAME_PLAY в TaskType enum
    {
      taskType: "ENTER_CODE" as const,
      icon: "🌅",
      title: "Первый вход в игру",
      description: "Открой ChessCoin и начни своё путешествие!",
      metadata: { code: "WELCOME2026", autoComplete: true },
      winningAmount: BigInt(500),
    },
    {
      taskType: "ENTER_CODE" as const,
      icon: "♟",
      title: "Сыграть первую партию",
      description: "Проведи свой первый бой — с Джарвисом или живым игроком",
      metadata: { code: "FIRSTGAME", autoComplete: true },
      winningAmount: BigInt(1_000),
    },
    {
      taskType: "ENTER_CODE" as const,
      icon: "🤖",
      title: "Победить Джарвиса 3 раза",
      description: "Докажи что ты сильнее искусственного интеллекта",
      metadata: { code: "JARVIS3WIN", autoComplete: true, target: 3 },
      winningAmount: BigInt(1_500),
    },
    {
      taskType: "ENTER_CODE" as const,
      icon: "🏆",
      title: "Одержать 5 побед",
      description: "Выиграй 5 партий в любом режиме",
      metadata: { code: "WIN5", autoComplete: true, target: 5 },
      winningAmount: BigInt(2_000),
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

  // ─── V3: Анимации победы ─────────────────────────────────────────────────
  { name: 'Конфетти',        nameEn: 'Confetti',     type: 'WIN_ANIMATION' as const, description: 'Золотое конфетти при победе',           priceCoins: 5_000n,   rarity: 'COMMON'    as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Салют',           nameEn: 'Fireworks',    type: 'WIN_ANIMATION' as const, description: 'Фейерверк при победе',                  priceCoins: 15_000n,  rarity: 'RARE'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Взрыв',           nameEn: 'Explosion',    type: 'WIN_ANIMATION' as const, description: 'Взрыв и ударная волна при победе',       priceCoins: 25_000n,  rarity: 'EPIC'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Молния',          nameEn: 'Lightning',    type: 'WIN_ANIMATION' as const, description: 'Молния и гром при победе',               priceCoins: 35_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Дракон',          nameEn: 'Dragon',       type: 'WIN_ANIMATION' as const, description: 'Огнедышащий дракон — легендарная победа', priceCoins: 100_000n, rarity: 'LEGENDARY' as const, category: 'PREMIUM' as const, imageUrl: null },

  // ─── V3: Эффекты взятия ──────────────────────────────────────────────────
  { name: 'Взятие: Огонь',   nameEn: 'Capture: Fire',    type: 'CAPTURE_EFFECT' as const, description: 'Огненная вспышка при взятии',       priceCoins: 8_000n,  rarity: 'COMMON' as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Взятие: Лёд',    nameEn: 'Capture: Ice',     type: 'CAPTURE_EFFECT' as const, description: 'Ледяные осколки при взятии',         priceCoins: 8_000n,  rarity: 'COMMON' as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Взятие: Призрак', nameEn: 'Capture: Ghost',   type: 'CAPTURE_EFFECT' as const, description: 'Призрачное исчезновение фигуры',     priceCoins: 20_000n, rarity: 'RARE'   as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Взятие: Молния',  nameEn: 'Capture: Thunder', type: 'CAPTURE_EFFECT' as const, description: 'Электрический разряд при взятии',   priceCoins: 30_000n, rarity: 'EPIC'   as const, category: 'PREMIUM' as const, imageUrl: null },

  // ─── V3: Анимации спецходов и дебютов (SPECIAL_MOVE) ────────────────────
  // Меняют то, как показывается объявление о спецходе / дебюте
  { name: 'Классик',          nameEn: 'Classic',        type: 'SPECIAL_MOVE' as const, description: 'Элегантный золотой текст для дебютов',         priceCoins: 5_000n,   rarity: 'COMMON'    as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Неон',             nameEn: 'Neon',           type: 'SPECIAL_MOVE' as const, description: 'Неоновые буквы — киберпанк стиль',              priceCoins: 12_000n,  rarity: 'COMMON'    as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Огонь',            nameEn: 'Fire',           type: 'SPECIAL_MOVE' as const, description: 'Горящие буквы при дебюте',                      priceCoins: 20_000n,  rarity: 'RARE'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Лёд',              nameEn: 'Ice',            type: 'SPECIAL_MOVE' as const, description: 'Ледяные буквы — холодный стиль',                priceCoins: 20_000n,  rarity: 'RARE'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Золото',           nameEn: 'Gold',           type: 'SPECIAL_MOVE' as const, description: 'Золотые буквы с блеском',                       priceCoins: 35_000n,  rarity: 'RARE'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Матрица',          nameEn: 'Matrix',         type: 'SPECIAL_MOVE' as const, description: 'Текст в стиле кода Матрицы',                    priceCoins: 40_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Кровь',            nameEn: 'Blood',          type: 'SPECIAL_MOVE' as const, description: 'Кровавые буквы — для агрессивных дебютов',      priceCoins: 50_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Галактика',        nameEn: 'Galaxy',         type: 'SPECIAL_MOVE' as const, description: 'Космические буквы со звёздами',                 priceCoins: 60_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Радуга',           nameEn: 'Rainbow',        type: 'SPECIAL_MOVE' as const, description: 'Переливающиеся цвета радуги',                   priceCoins: 75_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Призрак',          nameEn: 'Ghost',          type: 'SPECIAL_MOVE' as const, description: 'Таинственное появление из тьмы',                priceCoins: 90_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Молния',           nameEn: 'Thunder',        type: 'SPECIAL_MOVE' as const, description: 'Разряд молнии — стремительный дебют',           priceCoins: 120_000n, rarity: 'LEGENDARY' as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Дракон',           nameEn: 'Dragon',         type: 'SPECIAL_MOVE' as const, description: 'Огнедышащий дракон для легендарных ходов',      priceCoins: 200_000n, rarity: 'LEGENDARY' as const, category: 'PREMIUM' as const, imageUrl: null },
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

  // ─── Puzzles ─────────────────────────────────────────────────────────────
  let puzzlesCount = 0;
  for (const p of BUILTIN_PUZZLES) {
    await prisma.puzzle.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        fen: p.fen,
        moves: p.moves,
        rating: p.rating,
        themes: p.themes,
        reward: calcPuzzleReward(p.rating),
      },
    });
    puzzlesCount++;
  }
  // Задача дня — первая easy-задача
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await prisma.puzzle.updateMany({ where: { isDaily: true }, data: { isDaily: false } });
  await prisma.puzzle.update({
    where: { id: 'easy01' },
    data: { isDaily: true, dailyDate: today },
  }).catch(() => {}); // если easy01 уже удалена — не падаем
  console.log(`✅ ${puzzlesCount} Puzzles (builtin set)`);


  // ── v7.1.7: Геймплейные задания (BUG #1 fix) ──────────────────────────────
  const gameplayTasks = [
    {
      id: 'task_daily_login',
      taskType: 'DAILY_LOGIN' as const,
      status: 'ACTIVE' as const,
      icon: '📅',
      title: 'Ежедневный вход',
      description: 'Войди в игру сегодня',
      winningAmount: 500n,
      metadata: { resetDaily: true },
    },
    {
      id: 'task_first_game',
      taskType: 'FIRST_GAME' as const,
      status: 'ACTIVE' as const,
      icon: '♟️',
      title: 'Первая партия',
      description: 'Сыграй свою первую шахматную партию',
      winningAmount: 1000n,
      metadata: { targetCount: 1 },
    },
    {
      id: 'task_win_5',
      taskType: 'WIN_N' as const,
      status: 'ACTIVE' as const,
      icon: '🏆',
      title: '5 побед',
      description: 'Одержи 5 побед в батлах',
      winningAmount: 2000n,
      metadata: { targetCount: 5 },
    },
    {
      id: 'task_win_25',
      taskType: 'WIN_N' as const,
      status: 'ACTIVE' as const,
      icon: '👑',
      title: '25 побед',
      description: 'Одержи 25 побед в батлах',
      winningAmount: 8000n,
      metadata: { targetCount: 25 },
    },
    {
      id: 'task_win_bot_3',
      taskType: 'WIN_BOT_N' as const,
      status: 'ACTIVE' as const,
      icon: '🤖',
      title: 'Победи Джарвиса 3 раза',
      description: 'Одержи 3 победы против J.A.R.V.I.S',
      winningAmount: 1500n,
      metadata: { targetCount: 3 },
    },
    {
      id: 'task_win_bot_20',
      taskType: 'WIN_BOT_N' as const,
      status: 'ACTIVE' as const,
      icon: '🦾',
      title: 'Мастер Джарвиса',
      description: 'Победи J.A.R.V.I.S 20 раз',
      winningAmount: 10000n,
      metadata: { targetCount: 20 },
    },
    {
      id: 'task_play_10',
      taskType: 'PLAY_N' as const,
      status: 'ACTIVE' as const,
      icon: '🎯',
      title: '10 партий',
      description: 'Сыграй 10 партий (любых)',
      winningAmount: 1000n,
      metadata: { targetCount: 10 },
    },
    {
      id: 'task_win_streak_3',
      taskType: 'WIN_STREAK_N' as const,
      status: 'ACTIVE' as const,
      icon: '🔥',
      title: '3 победы подряд',
      description: 'Выиграй 3 партии без поражений',
      winningAmount: 3000n,
      metadata: { targetCount: 3 },
    },
  ];

  for (const task of gameplayTasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: { title: task.title, winningAmount: task.winningAmount },
      create: task,
    });
  }
  console.log(`✅ ${gameplayTasks.length} Gameplay Tasks seeded`);

  console.log("🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
