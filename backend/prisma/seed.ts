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
    { name: "Russia",        countryCode: "RU", flag: "🇷🇺", description: "Team Russia" },
    { name: "Brazil",        countryCode: "BR", flag: "🇧🇷", description: "Seleção do Brasil" },
    { name: "Germany",       countryCode: "DE", flag: "🇩🇪", description: "Mannschaft" },
    { name: "India",         countryCode: "IN", flag: "🇮🇳", description: "Team India" },
    { name: "USA",           countryCode: "US", flag: "🇺🇸", description: "Team USA" },
    { name: "China",         countryCode: "CN", flag: "🇨🇳", description: "Team China" },
    { name: "France",        countryCode: "FR", flag: "🇫🇷", description: "Les Bleus" },
    { name: "Spain",         countryCode: "ES", flag: "🇪🇸", description: "La Roja" },
    { name: "Argentina",     countryCode: "AR", flag: "🇦🇷", description: "La Albiceleste" },
    { name: "Japan",         countryCode: "JP", flag: "🇯🇵", description: "Team Japan" },
    { name: "South Korea",   countryCode: "KR", flag: "🇰🇷", description: "Team Korea" },
    { name: "Ukraine",       countryCode: "UA", flag: "🇺🇦", description: "Team Ukraine" },
    { name: "Kazakhstan",    countryCode: "KZ", flag: "🇰🇿", description: "Team Kazakhstan" },
    { name: "Belarus",       countryCode: "BY", flag: "🇧🇾", description: "Team Belarus" },
    { name: "Poland",        countryCode: "PL", flag: "🇵🇱", description: "Team Poland" },
    { name: "Turkey",        countryCode: "TR", flag: "🇹🇷", description: "Team Turkey" },
    { name: "Italy",         countryCode: "IT", flag: "🇮🇹", description: "Gli Azzurri" },
    { name: "UK",            countryCode: "GB", flag: "🇬🇧", description: "Team UK" },
    { name: "Canada",        countryCode: "CA", flag: "🇨🇦", description: "Team Canada" },
    { name: "Australia",     countryCode: "AU", flag: "🇦🇺", description: "Team Australia" },
    { name: "Mexico",        countryCode: "MX", flag: "🇲🇽", description: "Team Mexico" },
    { name: "Indonesia",     countryCode: "ID", flag: "🇮🇩", description: "Team Indonesia" },
    { name: "Nigeria",       countryCode: "NG", flag: "🇳🇬", description: "Team Nigeria" },
    { name: "Egypt",         countryCode: "EG", flag: "🇪🇬", description: "Team Egypt" },
    { name: "Iran",          countryCode: "IR", flag: "🇮🇷", description: "Team Iran" },
    { name: "Uzbekistan",    countryCode: "UZ", flag: "🇺🇿", description: "Team Uzbekistan" },
    { name: "Azerbaijan",    countryCode: "AZ", flag: "🇦🇿", description: "Team Azerbaijan" },
    { name: "Georgia",       countryCode: "GE", flag: "🇬🇪", description: "Team Georgia" },
    { name: "Armenia",       countryCode: "AM", flag: "🇦🇲", description: "Team Armenia" },
    { name: "Philippines",   countryCode: "PH", flag: "🇵🇭", description: "Team Philippines" },
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
    { name: "Golden Frame",       description: "Sparkling gold frame for champions",             type: "AVATAR_FRAME" as const, category: "BASIC" as const,   rarity: "RARE" as const,      priceCoins: BigInt(50_000),    sortOrder: 1, imageUrl: `${S3}/avatar_frame_gold.svg`,        previewUrl: `${S3}/avatar_frame_gold.svg` },
    { name: "Silver Frame",       description: "Elegant silver frame",                           type: "AVATAR_FRAME" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(20_000),    sortOrder: 2, imageUrl: `${S3}/avatar_frame_silver.svg`,      previewUrl: `${S3}/avatar_frame_silver.svg` },
    { name: "Platinum Frame",     description: "Rare platinum glow around your avatar",          type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(100_000),   sortOrder: 3, imageUrl: `${S3}/avatar_frame_platinum.svg`,    previewUrl: `${S3}/avatar_frame_platinum.svg` },
    { name: "Diamond Frame",      description: "Crystal clear diamond ice frame",                type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),   sortOrder: 4, imageUrl: `${S3}/avatar_frame_diamond.svg`,     previewUrl: `${S3}/avatar_frame_diamond.svg` },
    { name: "Fire Frame",         description: "Blazing frame for aggressive players",           type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),   sortOrder: 5, imageUrl: `${S3}/avatar_frame_fire.svg`,        previewUrl: `${S3}/avatar_frame_fire.svg` },
    { name: "Neon Frame",         description: "Bright neon glow — cyberpunk style",             type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(250_000),   sortOrder: 6, imageUrl: `${S3}/avatar_frame_neon.svg`,        previewUrl: `${S3}/avatar_frame_neon.svg` },
    { name: "Crystal Frame",      description: "Icy crystal shimmering in the light",            type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(300_000),   sortOrder: 7, imageUrl: `${S3}/avatar_frame_crystal.svg`,     previewUrl: `${S3}/avatar_frame_crystal.svg` },
    { name: "Commander Frame",    description: "Frame for Commanders — bold and fierce",         type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(400_000),   sortOrder: 8, imageUrl: `${S3}/avatar_frame_commander.svg`,   previewUrl: `${S3}/avatar_frame_commander.svg` },
    { name: "Legendary Frame ♟",  description: "Only for those who reached the top",             type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(1_000_000), sortOrder: 9, imageUrl: `${S3}/avatar_frame_legendary.svg`,   previewUrl: `${S3}/avatar_frame_legendary.svg` },
    { name: "Champion Frame",     description: "Golden aura of a ChessCoin World Champion",      type: "AVATAR_FRAME" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(2_000_000), sortOrder: 10, imageUrl: `${S3}/avatar_frame_champion.svg`,   previewUrl: `${S3}/avatar_frame_champion.svg` },
  ];

  // ─── Shop Items — Board Skins ─────────────────────────────────────────────
  const boardSkins = [
    { name: "Classic",        description: "Traditional wooden chess board",                 type: "BOARD_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(10_000),   sortOrder: 10, imageUrl: `${S3}/board_classic.svg`,    previewUrl: `${S3}/board_classic.svg` },
    { name: "Dark Wood",      description: "Dark mahogany board",                            type: "BOARD_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(25_000),   sortOrder: 11, imageUrl: `${S3}/board_darkwood.svg`,   previewUrl: `${S3}/board_darkwood.svg` },
    { name: "Marble",         description: "Black and white marble board",                   type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(75_000),   sortOrder: 12, imageUrl: `${S3}/board_marble.svg`,     previewUrl: `${S3}/board_marble.svg` },
    { name: "Malachite",      description: "Green malachite with golden veins",              type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(100_000),  sortOrder: 13, imageUrl: `${S3}/board_malachite.svg`,  previewUrl: `${S3}/board_malachite.svg` },
    { name: "Gold",            description: "Golden board for true champions",               type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(150_000),  sortOrder: 14, imageUrl: `${S3}/board_gold.svg`,       previewUrl: `${S3}/board_gold.svg` },
    { name: "Ice",             description: "Crystal ice surface",                           type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),  sortOrder: 15, imageUrl: `${S3}/board_ice.svg`,        previewUrl: `${S3}/board_ice.svg` },
    { name: "Night",           description: "Dark board for night games",                    type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),  sortOrder: 16, imageUrl: `${S3}/board_night.svg`,      previewUrl: `${S3}/board_night.svg` },
    { name: "Neon",            description: "Cyberpunk style with neon glow",                type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(300_000),  sortOrder: 17, imageUrl: `${S3}/board_neon.svg`,       previewUrl: `${S3}/board_neon.svg` },
    { name: "Desert",          description: "Sandy board with desert patterns",              type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(350_000),  sortOrder: 18, imageUrl: `${S3}/board_desert.svg`,     previewUrl: `${S3}/board_desert.svg` },
    { name: "Cyber",           description: "Holographic cybernetic board",                  type: "BOARD_SKIN" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(750_000),  sortOrder: 19, imageUrl: `${S3}/board_cyber.svg`,      previewUrl: `${S3}/board_cyber.svg` },
  ];

  // ─── Shop Items — Piece Skins ─────────────────────────────────────────────
  const pieceSkins = [
    { name: "Standard",          description: "Classic Staunton pieces",                       type: "PIECE_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(5_000),    sortOrder: 20, imageUrl: `${S3}/pieces_standard.svg`,   previewUrl: `${S3}/pieces_standard.svg` },
    { name: "Silver pieces",     description: "Silver pieces with matte shine",                type: "PIECE_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(30_000),   sortOrder: 21, imageUrl: `${S3}/pieces_silver.svg`,     previewUrl: `${S3}/pieces_silver.svg` },
    { name: "Bronze pieces",     description: "Warm bronze tone of classic chess",             type: "PIECE_SKIN" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(40_000),   sortOrder: 22, imageUrl: `${S3}/pieces_bronze.svg`,     previewUrl: `${S3}/pieces_bronze.svg` },
    { name: "Golden pieces",     description: "All pieces coated in gold",                     type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(150_000),  sortOrder: 23, imageUrl: `${S3}/pieces_gold.svg`,       previewUrl: `${S3}/pieces_gold.svg` },
    { name: "Shadow pieces",     description: "Dark silhouettes with mysterious glow",         type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(200_000),  sortOrder: 24, imageUrl: `${S3}/pieces_shadow.svg`,     previewUrl: `${S3}/pieces_shadow.svg` },
    { name: "Neon pieces",       description: "Glowing neon green in the dark",                type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(300_000),  sortOrder: 25, imageUrl: `${S3}/pieces_neon.svg`,       previewUrl: `${S3}/pieces_neon.svg` },
    { name: "Crystal pieces",    description: "Transparent pieces with inner glow",            type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(500_000),  sortOrder: 26, imageUrl: `${S3}/pieces_crystal.svg`,    previewUrl: `${S3}/pieces_crystal.svg` },
    { name: "Pixel pieces",      description: "Retro 8-bit pixel art style",                   type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(400_000),  sortOrder: 27, imageUrl: `${S3}/pieces_pixel.svg`,      previewUrl: `${S3}/pieces_pixel.svg` },
    { name: "Anime pieces",      description: "Bright anime characters on each piece",         type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(450_000),  sortOrder: 28, imageUrl: `${S3}/pieces_anime.svg`,      previewUrl: `${S3}/pieces_anime.svg` },
    { name: "Legend Gold",       description: "Legendary set engraved with ELO champions",     type: "PIECE_SKIN" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(1_500_000),sortOrder: 29, imageUrl: `${S3}/pieces_legend.svg`,     previewUrl: `${S3}/pieces_legend.svg` },
  ];

  // ─── Shop Items — Move Animations ────────────────────────────────────────
  const moveAnimations = [
    { name: "Lightning",   description: "Quick lightning bolt on every move",          type: "MOVE_ANIMATION" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(30_000),   sortOrder: 30, imageUrl: `${S3}/anim_lightning.svg`, previewUrl: `${S3}/anim_lightning.svg` },
    { name: "Stars",       description: "Starry trail behind each piece",              type: "MOVE_ANIMATION" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(40_000),   sortOrder: 31, imageUrl: `${S3}/anim_stars.svg`,     previewUrl: `${S3}/anim_stars.svg` },
    { name: "Fire",        description: "Fiery trail behind moving pieces",            type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(120_000),  sortOrder: 32, imageUrl: `${S3}/anim_fire.svg`,      previewUrl: `${S3}/anim_fire.svg` },
    { name: "Ice",         description: "Icy trail — freeze your opponent",            type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(120_000),  sortOrder: 33, imageUrl: `${S3}/anim_ice.svg`,       previewUrl: `${S3}/anim_ice.svg` },
    { name: "Explosion",   description: "Explosion on every capture",                  type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(150_000),  sortOrder: 34, imageUrl: `${S3}/anim_explosion.svg`, previewUrl: `${S3}/anim_explosion.svg` },
    { name: "Smoke",       description: "Mysterious smoke trail",                      type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(200_000),  sortOrder: 35, imageUrl: `${S3}/anim_smoke.svg`,     previewUrl: `${S3}/anim_smoke.svg` },
    { name: "Rainbow",     description: "Rainbow trail — bright and positive",         type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(250_000),  sortOrder: 36, imageUrl: `${S3}/anim_rainbow.svg`,   previewUrl: `${S3}/anim_rainbow.svg` },
    { name: "Matrix",      description: "Green Matrix code behind every move",         type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(300_000),  sortOrder: 37, imageUrl: `${S3}/anim_matrix.svg`,    previewUrl: `${S3}/anim_matrix.svg` },
    { name: "Portal",      description: "Piece teleports through a portal",            type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(500_000),  sortOrder: 38, imageUrl: `${S3}/anim_portal.svg`,    previewUrl: `${S3}/anim_portal.svg` },
    { name: "Thunder",     description: "Thunder and lightning — board domination",     type: "MOVE_ANIMATION" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(750_000),  sortOrder: 39, imageUrl: `${S3}/anim_thunder.svg`,   previewUrl: `${S3}/anim_thunder.svg` },
  ];


  const pieceSets = [
    { name: "ChessCoin Original", description: "Default ChessCoin piece set",                  type: "PIECE_SET" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(0),         sortOrder: 50 },
    { name: "Classic (Lichess)",  description: "Classic Staunton set by Lichess (cburnett)",    type: "PIECE_SET" as const, category: "BASIC" as const, rarity: "COMMON" as const, priceCoins: BigInt(25_000),    sortOrder: 51 },
    { name: "Flat Minimal",       description: "Flat minimalist pieces without shadows",       type: "PIECE_SET" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(15_000),    sortOrder: 52 },
    { name: "Glossy 3D",          description: "Glossy 3D pieces with highlights",             type: "PIECE_SET" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(100_000),   sortOrder: 53 },
    { name: "Neon Glow",          description: "Dark pieces with neon outline glow",           type: "PIECE_SET" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(250_000),   sortOrder: 54 },
    { name: "Crystal Glass",      description: "Transparent glass pieces with blue tint",      type: "PIECE_SET" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(750_000),   sortOrder: 55 },
    { name: "Emoji Fun",          description: "Fun Unicode chess symbols ♔♕♖♗♘♙",           type: "PIECE_SET" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(5_000),     sortOrder: 56 },
  ];

  // ─── Shop Items — Fonts ──────────────────────────────────────────────────
  const fonts = [
    { name: "Inter",             description: "Modern, clean, and highly readable font",               type: "FONT" as const, category: "BASIC" as const,   rarity: "COMMON" as const,    priceCoins: BigInt(0),         sortOrder: 60, imageUrl: null, previewUrl: null },
    { name: "Roboto",            description: "Classic Google font with a mechanical skeleton",        type: "FONT" as const, category: "PREMIUM" as const, rarity: "RARE" as const,      priceCoins: BigInt(5_000),     sortOrder: 61, imageUrl: null, previewUrl: null },
    { name: "Montserrat",        description: "Geometric sans-serif typography",                       type: "FONT" as const, category: "PREMIUM" as const, rarity: "EPIC" as const,      priceCoins: BigInt(15_000),    sortOrder: 62, imageUrl: null, previewUrl: null },
    { name: "Playfair Display",  description: "Elegant serif font for a royal experience",             type: "FONT" as const, category: "PREMIUM" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(25_000),    sortOrder: 63, imageUrl: null, previewUrl: null },
    { name: "Comic Sans MS",     description: "The ultimate legendary troll font",                     type: "FONT" as const, category: "SEASONAL" as const, rarity: "LEGENDARY" as const, priceCoins: BigInt(100_000),   sortOrder: 64, imageUrl: null, previewUrl: null },
  ];

  const allItems = [...avatarFrames, ...boardSkins, ...pieceSkins, ...moveAnimations, ...pieceSets, ...fonts];

  // Mapping old Russian names → new English names for data migration
  const nameMapping: Record<string, string> = {
    'Золотая рамка': 'Golden Frame', 'Серебряная рамка': 'Silver Frame', 'Платиновая рамка': 'Platinum Frame',
    'Алмазная рамка': 'Diamond Frame', 'Огненная рамка': 'Fire Frame', 'Неоновая рамка': 'Neon Frame',
    'Хрустальная рамка': 'Crystal Frame', 'Командирская рамка': 'Commander Frame',
    'Легендарная рамка ♟': 'Legendary Frame ♟', 'Чемпионская рамка': 'Champion Frame',
    'Классика': 'Classic', 'Дерево тёмное': 'Dark Wood', 'Мрамор': 'Marble', 'Малахит': 'Malachite',
    'Золото': 'Gold', 'Лёд': 'Ice', 'Ночь': 'Night', 'Неон': 'Neon', 'Пустыня': 'Desert', 'Кибер': 'Cyber',
    'Стандарт': 'Standard', 'Серебряные фигуры': 'Silver pieces', 'Бронзовые фигуры': 'Bronze pieces',
    'Золотые фигуры': 'Golden pieces', 'Теневые фигуры': 'Shadow pieces', 'Неоновые фигуры': 'Neon pieces',
    'Кристальные фигуры': 'Crystal pieces', 'Пиксельные фигуры': 'Pixel pieces',
    'Аниме фигуры': 'Anime pieces', 'Золото Легенды': 'Legend Gold',
    'Молния': 'Lightning', 'Звёзды': 'Stars', 'Огонь': 'Fire', 'Взрыв': 'Explosion',
    'Дым': 'Smoke', 'Радуга': 'Rainbow', 'Матрица': 'Matrix', 'Портал': 'Portal', 'Гром': 'Thunder',
    'Конфетти': 'Confetti', 'Салют': 'Fireworks', 'Дракон': 'Dragon',
    'Взятие: Огонь': 'Capture: Fire', 'Взятие: Лёд': 'Capture: Ice',
    'Взятие: Призрак': 'Capture: Ghost', 'Взятие: Молния': 'Capture: Thunder',
    'Классик': 'Classic', 'Кровь': 'Blood', 'Галактика': 'Galaxy', 'Призрак': 'Ghost',
  };

  // Migrate existing Russian-named items to English
  for (const [oldName, newName] of Object.entries(nameMapping)) {
    const existing = await prisma.item.findFirst({ where: { name: oldName } });
    if (existing) {
      const newItem = allItems.find(i => i.name === newName && i.type === existing.type);
      await prisma.item.update({
        where: { id: existing.id },
        data: { name: newName, description: newItem?.description ?? existing.description },
      });
    }
  }

  for (const item of allItems) {
    const existing = await prisma.item.findFirst({
      where: { name: item.name, type: item.type },
    });
    if (existing) {
      await prisma.item.update({
        where: { id: existing.id },
        data: { imageUrl: item.imageUrl, previewUrl: item.previewUrl, description: item.description },
      });
    } else {
      await prisma.item.create({ data: item });
    }
  }
  console.log(`✅ ${allItems.length} Shop items`);

  // ─── Tasks ────────────────────────────────────────────────────────────────
  // N15: добавлены базовые игровые задания
  const tasks = [
    // Social tasks
    {
      taskType: "SUBSCRIBE_TELEGRAM" as const,
      icon: "📢",
      title: "Subscribe to ChessCoin channel",
      description: "Follow our official channel and earn coins",
      metadata: { url: "https://t.me/chesscoin_official", channelId: "@chesscoin_official" },
      winningAmount: BigInt(5_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "🐦",
      title: "Follow on Twitter/X",
      description: "Follow our Twitter and earn coins",
      metadata: { url: "https://x.com/chesscoin" },
      winningAmount: BigInt(3_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "💬",
      title: "Join ChessCoin chat",
      description: "Join our Telegram community",
      metadata: { url: "https://t.me/chesscoin_chat" },
      winningAmount: BigInt(2_000),
    },
    {
      taskType: "FOLLOW_LINK" as const,
      icon: "▶️",
      title: "Watch the video guide",
      description: "Learn how to earn more in ChessCoin",
      metadata: { url: "https://youtube.com/@chesscoin" },
      winningAmount: BigInt(1_000),
    },
    // Referral tasks
    {
      taskType: "REFERRAL" as const,
      icon: "👥",
      title: "Invite 1 friend",
      description: "Invite a friend who plays their first game",
      metadata: { referralCount: 1 },
      winningAmount: BigInt(3_000),
    },
    {
      taskType: "REFERRAL" as const,
      icon: "🤝",
      title: "Invite 5 friends",
      description: "Invite 5 friends who play at least one game",
      metadata: { referralCount: 5 },
      winningAmount: BigInt(25_000),
    },
    {
      taskType: "REFERRAL" as const,
      icon: "👑",
      title: "Invite 20 friends",
      description: "Build an army of 20 referrals",
      metadata: { referralCount: 20 },
      winningAmount: BigInt(150_000),
    },
    // Game tasks via ENTER_CODE (universal type)
    {
      taskType: "ENTER_CODE" as const,
      icon: "🌅",
      title: "First login",
      description: "Open ChessCoin and start your journey!",
      metadata: { code: "WELCOME2026", autoComplete: true },
      winningAmount: BigInt(500),
    },
    {
      taskType: "ENTER_CODE" as const,
      icon: "♟",
      title: "Play your first game",
      description: "Play your first match — vs J.A.R.V.I.S or a real player",
      metadata: { code: "FIRSTGAME", autoComplete: true },
      winningAmount: BigInt(1_000),
    },
    {
      taskType: "ENTER_CODE" as const,
      icon: "🤖",
      title: "Beat J.A.R.V.I.S 3 times",
      description: "Prove you're stronger than AI",
      metadata: { code: "JARVIS3WIN", autoComplete: true, target: 3 },
      winningAmount: BigInt(1_500),
    },
    {
      taskType: "ENTER_CODE" as const,
      icon: "🏆",
      title: "Win 5 games",
      description: "Win 5 games in any mode",
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

  // ─── Sprint 5: Default rewards (canonical) — пере-выставляем награды
  // по спецификации (idempotent upsert по id, чтобы не плодить дубликаты)
  const sprint5Defaults: Array<{ id: string; taskType: any; icon: string; title: string; description: string; metadata: any; winningAmount: bigint }> = [
    { id: 'task_daily_login',     taskType: 'DAILY_LOGIN',        icon: '📅', title: 'Ежедневный вход',         description: 'Войди в игру сегодня',                          metadata: { resetDaily: true, category: 'DAILY' },                  winningAmount: 500n },
    { id: 'task_first_game',      taskType: 'FIRST_GAME',         icon: '♟️', title: 'Первая партия',           description: 'Сыграй свою первую шахматную партию',           metadata: { targetCount: 1, category: 'DAILY' },                    winningAmount: 2000n },
    { id: 'task_win_5',           taskType: 'WIN_N',              icon: '🏆', title: '5 побед',                 description: 'Одержи 5 побед в батлах',                       metadata: { targetCount: 5, category: 'DAILY' },                    winningAmount: 5000n },
    { id: 'task_win_bot_3',       taskType: 'WIN_BOT_N',          icon: '🤖', title: 'Победи Джарвиса 3 раза',  description: 'Одержи 3 победы против J.A.R.V.I.S',            metadata: { targetCount: 3, category: 'DAILY' },                    winningAmount: 3000n },
    { id: 'task_win_streak_3',    taskType: 'WIN_STREAK_N',       icon: '🔥', title: '3 победы подряд',         description: 'Выиграй 3 партии без поражений',                metadata: { targetCount: 3, category: 'DAILY' },                    winningAmount: 7000n },
    { id: 'task_play_10',         taskType: 'PLAY_N',             icon: '🎯', title: '10 партий',               description: 'Сыграй 10 партий (любых)',                      metadata: { targetCount: 10, category: 'DAILY' },                   winningAmount: 4000n },
    { id: 'task_referral_1',      taskType: 'REFERRAL',           icon: '👥', title: 'Пригласи друга',          description: 'Пригласи 1 друга, активного игрока',            metadata: { referralCount: 1, category: 'SOCIAL' },                 winningAmount: 3000n },
    { id: 'task_referral_5',      taskType: 'REFERRAL',           icon: '🤝', title: 'Пригласи 5 друзей',       description: 'Пригласи 5 активных рефералов',                  metadata: { referralCount: 5, category: 'SOCIAL' },                 winningAmount: 20000n },
    { id: 'task_referral_10',    taskType: 'REFERRAL',            icon: '👑', title: 'Пригласи 10 друзей',     description: 'Пригласи 10 активных рефералов',                metadata: { referralCount: 10, category: 'SOCIAL' },                winningAmount: 50000n },
    { id: 'task_subscribe_tg',    taskType: 'SUBSCRIBE_TELEGRAM', icon: '📢', title: 'Подпишись на канал',      description: 'Подпишись на официальный канал ChessCoin',      metadata: { url: 'https://t.me/chesscoin_official', category: 'SOCIAL' }, winningAmount: 1000n },
    { id: 'task_follow_link',     taskType: 'FOLLOW_LINK',        icon: '🔗', title: 'Перейди по ссылке',       description: 'Открой ссылку и получи награду',                metadata: { url: 'https://chesscoin.app', category: 'SOCIAL' },     winningAmount: 500n },
    { id: 'task_enter_code',      taskType: 'ENTER_CODE',         icon: '🎟️', title: 'Введи промокод',         description: 'Активируй промокод для бонуса',                  metadata: { code: 'CHESSCOIN', category: 'SOCIAL' },                winningAmount: 1000n },
  ];

  for (const t of sprint5Defaults) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: { winningAmount: t.winningAmount, title: t.title, description: t.description, icon: t.icon, metadata: t.metadata, status: 'ACTIVE' },
      create: { ...t, status: 'ACTIVE' },
    });
  }
  console.log(`✅ ${sprint5Defaults.length} Sprint5 default rewards (upsert)`);

  // ─── Темы интерфейса ─────────────────────────────────────────────────────
  const themes = [
    { name: 'Binance Pro',    description: 'Binance style — dark, professional',        priceCoins: 10_000n,    rarity: 'COMMON'    },
    { name: 'Chess Classic',  description: 'Chess.com classic — green and cream',       priceCoins: 50_000n,    rarity: 'COMMON'    },
    { name: 'Neon Cyber',     description: 'Neon cyberpunk — purple/blue',              priceCoins: 100_000n,   rarity: 'RARE'      },
    { name: 'Royal Gold',     description: 'Royal blue with gold accents',              priceCoins: 250_000n,   rarity: 'RARE'      },
    { name: 'Matrix Dark',    description: 'Green Matrix code on black',                priceCoins: 500_000n,   rarity: 'EPIC'      },
    { name: 'Crystal Ice',    description: 'Crystal ice — blue tones',                  priceCoins: 1_000_000n, rarity: 'LEGENDARY' },

  // ─── V3: Win animations ─────────────────────────────────────────────────
  { name: 'Confetti',         type: 'WIN_ANIMATION' as const, description: 'Golden confetti on victory',             priceCoins: 5_000n,   rarity: 'COMMON'    as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Fireworks',        type: 'WIN_ANIMATION' as const, description: 'Fireworks on victory',                   priceCoins: 15_000n,  rarity: 'RARE'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Victory Blast',    type: 'WIN_ANIMATION' as const, description: 'Explosion and shockwave on victory',    priceCoins: 25_000n,  rarity: 'EPIC'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Storm',            type: 'WIN_ANIMATION' as const, description: 'Lightning and thunder on victory',      priceCoins: 35_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Dragon',           type: 'WIN_ANIMATION' as const, description: 'Fire-breathing dragon — legendary win', priceCoins: 100_000n, rarity: 'LEGENDARY' as const, category: 'PREMIUM' as const, imageUrl: null },

  // ─── V3: Capture effects ──────────────────────────────────────────────────
  { name: 'Capture: Fire',    type: 'CAPTURE_EFFECT' as const, description: 'Fiery flash on capture',               priceCoins: 8_000n,  rarity: 'COMMON' as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Capture: Ice',     type: 'CAPTURE_EFFECT' as const, description: 'Ice shards on capture',                priceCoins: 8_000n,  rarity: 'COMMON' as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Capture: Ghost',   type: 'CAPTURE_EFFECT' as const, description: 'Ghostly piece disappearance',          priceCoins: 20_000n, rarity: 'RARE'   as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Capture: Thunder', type: 'CAPTURE_EFFECT' as const, description: 'Electric discharge on capture',        priceCoins: 30_000n, rarity: 'EPIC'   as const, category: 'PREMIUM' as const, imageUrl: null },

  // ─── V3: Special move / opening announcements (SPECIAL_MOVE) ────────────
  { name: 'Classic',          type: 'SPECIAL_MOVE' as const, description: 'Elegant golden text for openings',        priceCoins: 5_000n,   rarity: 'COMMON'    as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Neon',             type: 'SPECIAL_MOVE' as const, description: 'Neon letters — cyberpunk style',          priceCoins: 12_000n,  rarity: 'COMMON'    as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Fire',             type: 'SPECIAL_MOVE' as const, description: 'Burning letters for openings',            priceCoins: 20_000n,  rarity: 'RARE'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Ice',              type: 'SPECIAL_MOVE' as const, description: 'Icy letters — cold style',                priceCoins: 20_000n,  rarity: 'RARE'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Gold',             type: 'SPECIAL_MOVE' as const, description: 'Shiny golden letters',                    priceCoins: 35_000n,  rarity: 'RARE'      as const, category: 'BASIC'   as const, imageUrl: null },
  { name: 'Matrix',           type: 'SPECIAL_MOVE' as const, description: 'Matrix code style text',                  priceCoins: 40_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Blood',            type: 'SPECIAL_MOVE' as const, description: 'Bloody letters — for aggressive openings',priceCoins: 50_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Galaxy',           type: 'SPECIAL_MOVE' as const, description: 'Cosmic letters with stars',               priceCoins: 60_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Rainbow',          type: 'SPECIAL_MOVE' as const, description: 'Shimmering rainbow colors',               priceCoins: 75_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Ghost',            type: 'SPECIAL_MOVE' as const, description: 'Mysterious appearance from darkness',      priceCoins: 90_000n,  rarity: 'EPIC'      as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Thunder',          type: 'SPECIAL_MOVE' as const, description: 'Lightning bolt — swift opening',           priceCoins: 120_000n, rarity: 'LEGENDARY' as const, category: 'PREMIUM' as const, imageUrl: null },
  { name: 'Dragon',           type: 'SPECIAL_MOVE' as const, description: 'Fire-breathing dragon for legendary moves',priceCoins: 200_000n, rarity: 'LEGENDARY' as const, category: 'PREMIUM' as const, imageUrl: null },
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
