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

  // ─── Chess Puzzles (Lessons) ─────────────────────────────────────────────────
  const lessons = [
    { id: 'lesson_001', title: 'Шах и мат в 1 ход', description: 'Поставьте мат за один ход.', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', moves: 'h5f7', difficulty: 5, reward: 1000n },
    { id: 'lesson_002', title: 'Вилка конём', description: 'Используйте вилку конём для выигрыша материала.', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3', moves: 'c6d4 f3d4', difficulty: 15, reward: 2000n },
    { id: 'lesson_003', title: 'Связка слона', description: 'Свяжите коня противника.', fen: 'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4', moves: 'c1d2 b4c3 d2c3', difficulty: 20, reward: 3000n },
    { id: 'lesson_004', title: 'Двойной удар ферзём', description: 'Атакуйте одновременно две фигуры ферзём.', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'd1b3', difficulty: 25, reward: 4000n },
    { id: 'lesson_005', title: 'Открытый шах', description: 'Используйте открытый шах для выигрыша материала.', fen: 'r2qkb1r/ppp1pppp/2np1n2/8/2BPP1b1/2P2N2/PP3PPP/RNBQK2R w KQkq - 1 6', moves: 'f3e5 g4d1 c4f7 e8f7 e5g4', difficulty: 35, reward: 6000n },
    { id: 'lesson_006', title: 'Мат Легаля', description: 'Классический ловушечный мат.', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 3 4', moves: 'c6e5 c4f7 e8f7 d1h5 f7e6 h5e5', difficulty: 40, reward: 8000n },
    { id: 'lesson_007', title: 'Мат Эпаулет', description: 'Ладьи ограничивают короля.', fen: '6k1/5ppp/8/8/8/8/8/R5RK w - - 0 1', moves: 'g1g7 g8h8 a1g1', difficulty: 30, reward: 5000n },
    { id: 'lesson_008', title: 'Принципы дебюта', description: 'Изучите основные принципы дебютной игры.', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6', difficulty: 10, reward: 1500n },
    { id: 'lesson_009', title: 'Итальянская партия', description: 'Изучите итальянское начало.', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4', difficulty: 20, reward: 3000n },
    { id: 'lesson_010', title: 'Короткая рокировка', description: 'Выполните рокировку для защиты короля.', fen: 'rnbqk2r/pppp1ppp/4pn2/8/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4', moves: 'e1g1', difficulty: 8, reward: 1200n },
    { id: 'lesson_011', title: 'Батарея ладей', description: 'Используйте две ладьи на одной линии.', fen: '6k1/8/8/8/8/8/8/R1R3K1 w - - 0 1', moves: 'c1c8 a1c1', difficulty: 22, reward: 3500n },
    { id: 'lesson_012', title: 'Слоновые окончания', description: 'Используйте слона в эндшпиле.', fen: '8/5k2/8/8/8/8/8/4BK2 w - - 0 1', moves: 'e1d2 f7e6 f1e2 e6d5 e2d3', difficulty: 28, reward: 4500n },
    { id: 'lesson_013', title: 'Оппозиция королей', description: 'Используйте оппозицию в пешечном окончании.', fen: '8/8/8/3k4/8/3K4/8/8 w - - 0 1', moves: 'd3e3 d5e5 e3f3 e5f5 f3g3', difficulty: 18, reward: 2500n },
    { id: 'lesson_014', title: 'Проходная пешка', description: 'Проведите пешку в ферзи.', fen: '8/P7/8/8/8/8/8/k1K5 w - - 0 1', moves: 'a7a8q', difficulty: 12, reward: 2000n },
    { id: 'lesson_015', title: 'Мат двумя слонами', description: 'Поставьте мат двумя слонами.', fen: '8/8/8/8/8/2k5/8/2BB1K2 w - - 0 1', moves: 'd1e2 c3c4 e2d3 c4b4 d3c3 b4a4 c3b4', difficulty: 45, reward: 10000n },
    { id: 'lesson_016', title: 'Жертва слона на h7', description: 'Классическая жертва слона на h7.', fen: 'r1bq1rk1/ppp2ppp/3p1n2/8/2BnP3/5N2/PPP2PPP/R1BQR1K1 w - - 0 1', moves: 'c4h7 g8h7 d1d4 h7g8 d4h8', difficulty: 55, reward: 15000n },
    { id: 'lesson_017', title: 'Мат Андерсена', description: 'Красивая комбинация с жертвой.', fen: 'r4rk1/ppp1ppbp/3p1np1/8/4P3/2N2N2/PPP2PPP/R1BR2K1 w - - 0 1', moves: 'f3g5 f6e4 g5f7 a8a7 f7h6', difficulty: 60, reward: 18000n },
    { id: 'lesson_018', title: 'Ловушка Легаля', description: 'Ловушка в испанской партии.', fen: 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: 'b5c6 d7c6 f3e5 d8d1 e5f7 e8f7 e1d1', difficulty: 38, reward: 7000n },
    { id: 'lesson_019', title: 'Сицилианская защита', description: 'Изучите сицилианское начало.', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4', difficulty: 25, reward: 4000n },
    { id: 'lesson_020', title: 'Мат Эпаулет ладьями', description: 'Быстрый мат ладьями на краю.', fen: '6k1/8/6K1/8/8/8/8/7R w - - 0 1', moves: 'h1h8', difficulty: 10, reward: 1500n },
  ];

  for (const l of lessons) {
    await (prisma as any).chessPuzzle.upsert({
      where: { id: l.id },
      update: { title: l.title, description: l.description, fen: l.fen, moves: l.moves, difficulty: l.difficulty, reward: l.reward },
      create: { id: l.id, type: 'LESSON', title: l.title, description: l.description, fen: l.fen, moves: l.moves, difficulty: l.difficulty, reward: l.reward, isActive: true },
    });
  }
  console.log(`✅ ${lessons.length} Puzzle Lessons`);

  // ─── Chess Puzzles (Daily) ────────────────────────────────────────────────────
  const dailies = [
    { id: 'daily_001', title: 'Мат в 1 (понедельник)', description: 'Найдите мат в один ход.', fen: '7k/5Q1p/7K/8/8/8/8/8 w - - 0 1', moves: 'f7f8', difficulty: 10, reward: 5000n },
    { id: 'daily_002', title: 'Тактика (вторник)', description: 'Выиграйте материал тактикой.', fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2PPn3/2N5/PP2PPPP/R1BQKBNR w KQkq - 1 5', moves: 'd1a4', difficulty: 20, reward: 7000n },
    { id: 'daily_003', title: 'Эндшпиль (среда)', description: 'Доведите пешку до превращения.', fen: '8/8/8/8/8/3K4/3P4/3k4 w - - 0 1', moves: 'd3e3 d1c1 e3e4 c1d1 d2d4 d1c1 d4d5', difficulty: 30, reward: 8000n },
    { id: 'daily_004', title: 'Вилка (четверг)', description: 'Поставьте вилку конём.', fen: 'r1bqkb1r/ppppnppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 4', moves: 'f3g5 e7c6 d1h5 g7g6 h5f7', difficulty: 35, reward: 9000n },
    { id: 'daily_005', title: 'Связка (пятница)', description: 'Используйте связку для выигрыша.', fen: 'r3kb1r/ppp1pppp/2nq1n2/3p4/3P4/2N1PN2/PPP2PPP/R1BQKB1R w KQkq - 2 5', moves: 'f1b5', difficulty: 25, reward: 7000n },
    { id: 'daily_006', title: 'Мат в 2 (суббота)', description: 'Поставьте мат в два хода.', fen: '4k3/4Q3/4K3/8/8/8/8/8 w - - 0 1', moves: 'e7e5 e8d8 e5d5', difficulty: 15, reward: 6000n },
    { id: 'daily_007', title: 'Комбинация (воскресенье)', description: 'Найдите лучшую комбинацию.', fen: 'r3r1k1/pp1q1ppp/2n1pn2/3pN3/3P4/2PB4/PP2QPPP/R3R1K1 w - - 0 15', moves: 'e5c6 d7c6 d3h7 g8h7 e2h5 h7g8 h5f7', difficulty: 65, reward: 20000n },
    { id: 'daily_008', title: 'Пешечный эндшпиль', description: 'Используйте оппозицию.', fen: '8/8/2k5/2p5/2P5/2K5/8/8 w - - 0 1', moves: 'c3b3 c6b5 b3b2 b5c4 b2c2', difficulty: 40, reward: 10000n },
    { id: 'daily_009', title: 'Жертва качества', description: 'Пожертвуйте ладью за атаку.', fen: 'r2qkb1r/pp3ppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQK2R w KQkq - 0 8', moves: 'e1g1 d5c4 f1c4', difficulty: 45, reward: 12000n },
    { id: 'daily_010', title: 'Финал недели', description: 'Сложная позиция — найдите выигрывающий ход.', fen: 'r1b1kb1r/ppq1pppp/2np1n2/2p5/2PPP3/2NB1N2/PP3PPP/R1BQK2R w KQkq c6 0 7', moves: 'd4d5 c6d5 e4d5 c6b4 d3b5 b4d3 c1d2', difficulty: 70, reward: 25000n },
  ];

  for (const d of dailies) {
    await (prisma as any).chessPuzzle.upsert({
      where: { id: d.id },
      update: { title: d.title, description: d.description, fen: d.fen, moves: d.moves, difficulty: d.difficulty, reward: d.reward },
      create: { id: d.id, type: 'DAILY', title: d.title, description: d.description, fen: d.fen, moves: d.moves, difficulty: d.difficulty, reward: d.reward, isActive: true },
    });
  }
  console.log(`✅ ${dailies.length} Daily Puzzles`);

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
