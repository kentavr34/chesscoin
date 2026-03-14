import dotenv from "dotenv";
dotenv.config();

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env variable: ${key}`);
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

const num = (key: string, fallback: number): number =>
  parseInt(process.env[key] ?? String(fallback), 10);

const bigint = (key: string, fallback: bigint): bigint =>
  BigInt(process.env[key] ?? String(fallback));

const config = {
  server: {
    port: num("SERVER_PORT", 3000),
    nodeEnv: optional("NODE_ENV", "development"),
    debug: optional("DEBUG", "false") === "true",
    frontendUrl: optional("FRONTEND_URL", "http://localhost:5173"),
  },

  db: {
    url: required("DATABASE_URL"),
  },

  redis: {
    host: optional("REDIS_HOST", "localhost"),
    port: num("REDIS_PORT", 6379),
    password: optional("REDIS_PASSWORD", ""),
  },

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),   // обязателен — нет дефолта
    accessExpires: optional("JWT_ACCESS_EXPIRES", "2h"),
    refreshSecret: required("JWT_REFRESH_SECRET"),  // обязателен — нет дефолта
    refreshExpires: optional("JWT_REFRESH_EXPIRES", "7d"),
  },

  telegram: {
    botToken: optional("BOT_TOKEN", ""),
    botApiSecret: optional("BOT_API_SECRET", "internal_secret"),
  },

  s3: {
    endpoint: optional("S3_ENDPOINT", ""),
    region: optional("S3_REGION", "ru-1"),
    bucket: optional("S3_BUCKET", ""),
    accessKey: optional("S3_ACCESS_KEY", ""),
    secretKey: optional("S3_SECRET_ACCESS_KEY", ""),
  },

  // ─── Экономика ───────────────────────────────────
  economy: {
    hardCap: bigint("HARD_CAP", 100_000_000_000n),
    emissionCap: bigint("EMISSION_CAP", 30_000_000_000n),

    welcomeBonus: bigint("WELCOME_BONUS", 5000n),
    referralFirstGameBonus: bigint("REFERRAL_FIRST_GAME_BONUS", 3000n),

    maxAttempts: num("MAX_ATTEMPTS", 3),
    attemptRestoreHours: num("ATTEMPT_RESTORE_HOURS", 8),
    attemptPrice: bigint("ATTEMPT_PRICE", 1000n),
    maxPurchasedAttempts: 0, // покупка только до максимума 3, не сверх

    referrerIncomePercent: num("REFERRER_INCOME_PERCENT", 50),
    subReferrerIncomePercent: num("SUB_REFERRER_INCOME_PERCENT", 10),

    battleCommissionPercent: num("BATTLE_COMMISSION_PERCENT", 10),

    piecePrice: {
      p: bigint("PIECE_PRICE_PAWN", 100n),
      n: bigint("PIECE_PRICE_KNIGHT", 300n),
      b: bigint("PIECE_PRICE_BISHOP", 300n),
      r: bigint("PIECE_PRICE_ROOK", 500n),
      q: bigint("PIECE_PRICE_QUEEN", 900n),
      k: bigint("PIECE_PRICE_KING", 1000n),
    },

    botRewards: {
      1:  bigint("BOT_REWARD_1",  1000n),
      2:  bigint("BOT_REWARD_2",  3000n),
      3:  bigint("BOT_REWARD_3",  5000n),
      4:  bigint("BOT_REWARD_4",  7000n),
      5:  bigint("BOT_REWARD_5",  9000n),
      6:  bigint("BOT_REWARD_6",  12000n),
      7:  bigint("BOT_REWARD_7",  15000n),
      8:  bigint("BOT_REWARD_8",  20000n),
      9:  bigint("BOT_REWARD_9",  30000n),
      10: bigint("BOT_REWARD_10", 50000n),
      11: bigint("BOT_REWARD_11", 11000n),
      12: bigint("BOT_REWARD_12", 12000n),
      13: bigint("BOT_REWARD_13", 13000n),
      14: bigint("BOT_REWARD_14", 14000n),
      15: bigint("BOT_REWARD_15", 15000n),
      16: bigint("BOT_REWARD_16", 16000n),
      17: bigint("BOT_REWARD_17", 17000n),
      18: bigint("BOT_REWARD_18", 18000n),
      19: bigint("BOT_REWARD_19", 19000n),
      20: bigint("BOT_REWARD_20", 20000n),
    } as Record<number, bigint>,

    leagueThresholds: {
      BRONZE:   bigint("LEAGUE_BRONZE",   0n),
      SILVER:   bigint("LEAGUE_SILVER",   100_000n),
      GOLD:     bigint("LEAGUE_GOLD",     1_000_000n),
      DIAMOND:  bigint("LEAGUE_DIAMOND",  5_000_000n),
      CHAMPION: bigint("LEAGUE_CHAMPION", 10_000_000n),
      STAR:     bigint("LEAGUE_STAR",     50_000_000n),
    },
  },

  // ─── Сессии ──────────────────────────────────────
  sessions: {
    maxActive: num("MAX_ACTIVE_SESSIONS", 3),
    maxBotSessions: num("MAX_BOT_SESSIONS", 1),
  },
} as const;

export default config;
