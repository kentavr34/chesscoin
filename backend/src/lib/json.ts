/**
 * lib/json.ts — Q6: Безопасная сериализация BigInt в JSON
 *
 * Проблема: (BigInt.prototype as any).toJSON патч в index.ts — глобальный
 * anti-pattern. Может сломать сторонние библиотеки.
 *
 * Решение: кастомный replacer. Применяем в новых роутах.
 * Полный переход с патча — в v6.1 когда все роуты обновлены.
 *
 * Использование:
 *   import { safeJson } from "@/lib/json";
 *   res.type("json").send(safeJson({ balance: user.balance }));
 */

import { Response } from "express";

/** JSON replacer — конвертирует BigInt в string */
export const bigIntReplacer = (_key: string, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;

/** Сериализует данные с поддержкой BigInt */
export const safeStringify = (data: unknown): string =>
  JSON.stringify(data, bigIntReplacer);

/** Отправляет JSON-ответ с поддержкой BigInt (замена res.json()) */
export const safeJson = (res: Response, data: unknown, status = 200): Response =>
  res.status(status).type("json").send(safeStringify(data));
