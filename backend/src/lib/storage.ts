// ─── Локальное файловое хранилище (замена S3) ──────────────────────────────
// Файлы ложатся в STATIC_ROOT (по умолчанию /app/static внутри контейнера,
// bind-mount к ./static на хосте). Nginx отдаёт /static/* напрямую с диска.
//
// Публичный URL — относительный (/static/<key>), поэтому работает и через
// Telegram WebApp, и напрямую без переписывания доменов.
//
// Миграция с S3: файлы на старом TimeWeb-bucket потеряны, старые URL вида
// https://s3.timeweb.cloud/... в БД нулятся отдельной миграцией, пользователи
// перегрузят аватары.
// ────────────────────────────────────────────────────────────────────────────

import fs from "fs/promises";
import path from "path";

const STATIC_ROOT = process.env.STATIC_ROOT || "/app/static";
const PUBLIC_PREFIX = "/static";

/** Нормализует key: убирает ведущий слеш, запрещает '..'. */
function safeKey(key: string): string {
  const k = key.replace(/^\/+/, "");
  if (k.includes("..")) throw new Error(`invalid storage key: ${key}`);
  return k;
}

/** Сохраняет buffer под `key`, возвращает публичный URL (/static/<key>). */
export async function saveFile(
  key: string,
  body: Buffer,
  _contentType: string,
): Promise<string> {
  const k = safeKey(key);
  const abs = path.join(STATIC_ROOT, k);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body);
  return `${PUBLIC_PREFIX}/${k}`;
}

/** Удаляет файл. Принимает key или полный URL (/static/<key>). */
export async function deleteFile(keyOrUrl: string): Promise<void> {
  const key = keyOrUrl.startsWith(PUBLIC_PREFIX + "/")
    ? keyOrUrl.slice(PUBLIC_PREFIX.length + 1)
    : keyOrUrl.replace(/^\/+/, "");
  if (!key || key.includes("..")) return;
  const abs = path.join(STATIC_ROOT, key);
  await fs.unlink(abs).catch(() => {});
}

/** Вычисляет публичный URL для уже известного key. */
export function publicUrl(key: string): string {
  return `${PUBLIC_PREFIX}/${safeKey(key)}`;
}

// ─── Совместимость со старым s3.ts (deprecated) ────────────────────────────
// Имена оставлены чтобы минимизировать diff в call-сайтах; поведение —
// локальное хранилище, никаких S3.
export const uploadToS3 = saveFile;
export const deleteFromS3 = deleteFile;
export const s3Url = publicUrl;
