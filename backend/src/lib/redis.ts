import Redis from "ioredis";
import config from "@/config";

const createRedisClient = () => {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected");
  });

  return client;
};

// Основной клиент — для get/set/del
export const redis = createRedisClient();

// Отдельный для pub/sub (нельзя использовать один для обоих)
export const redisSub = createRedisClient();
export const redisPub = createRedisClient();

export const connectRedis = async () => {
  await redis.connect();
  await redisSub.connect();
  await redisPub.connect();

  // Включаем keyspace notifications для таймеров
  await redis.config("SET", "notify-keyspace-events", "Ex");
  console.log("[Redis] Keyspace notifications enabled");
};
