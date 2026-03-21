/**
 * logger.ts — Q2: Централизованный logger на базе winston
 * Заменяет все console.log/console.error в критичных сервисах
 *
 * Использование:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Сообщение", { meta: "данные" });
 *   logger.error("Ошибка", { error: err.message, stack: err.stack });
 *   logger.warn("Предупреждение");
 *   logger.debug("Отладка — видно только при LOG_LEVEL=debug");
 */

import winston from "winston";

const isDev = process.env.NODE_ENV !== "production";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",

  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    isDev
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }: { timestamp: string; level: string; message: string; [key: string]: unknown }) => {
            const metaStr = Object.keys(meta).length
              ? " " + JSON.stringify(meta)
              : "";
            return `${timestamp} [${level}] ${message}${metaStr}`;
          })
        )
      : winston.format.json() // В продакшне: structured JSON для log aggregators
  ),

  transports: [
    new winston.transports.Console(),
  ],

  // Не падаем из-за ошибки логгера
  exitOnError: false,
});

// Хелпер для логирования ошибок с полным стеком
export const logError = (context: string, err: unknown, meta?: Record<string, unknown>) => {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error(`[${context}] ${error.message}`, {
    stack: error.stack,
    ...meta,
  });
};
