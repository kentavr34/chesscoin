/**
 * Тексты интерфейса из таблицы `ui_texts`.
 *
 * Кенан 31.07.2026: все видимые строки живут в одной таблице с указанием, где
 * они показываются; языки — колонками, новый язык добавляется колонкой без
 * правок кода. Фронт забирает словарь на старте и накладывает поверх
 * встроенного: если база недоступна, интерфейс всё равно работает.
 *
 * Бэкенд сам по себе одноязычный — он только отдаёт готовые строки.
 */
import { Router, Request, Response } from "express";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export const i18nRouter = Router();

// Колонки-языки таблицы. Добавить язык = добавить колонку и строку сюда.
const LANGS = ["ru", "en", "az", "tr"] as const;
type Lang = (typeof LANGS)[number];

const isLang = (v: string): v is Lang => (LANGS as readonly string[]).includes(v);

// ── GET /api/v1/i18n/langs — какие языки заполнены ───────────────────────────
i18nRouter.get("/langs", async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.uiText.findMany({ select: { ru: true, en: true, az: true, tr: true } });
    const filled = LANGS.map(lang => ({
      lang,
      // Сколько строк переведено на этот язык — видно, что готово, а что нет.
      translated: rows.filter(r => (r as Record<string, unknown>)[lang]).length,
      total: rows.length,
    }));
    res.json({ langs: filled });
  } catch (e: unknown) {
    logError("[i18n/langs]", e);
    res.status(500).json({ error: "Failed to load languages" });
  }
});

// ── GET /api/v1/i18n/:lang — словарь ключ → строка ───────────────────────────
i18nRouter.get("/:lang", async (req: Request, res: Response) => {
  const lang = String(req.params.lang);
  if (!isLang(lang)) return res.status(400).json({ error: "UNKNOWN_LANG", langs: LANGS });

  try {
    const rows = await prisma.uiText.findMany({
      select: { key: true, ru: true, en: true, az: true, tr: true },
    });

    const dict: Record<string, string> = {};
    for (const row of rows) {
      // Нет перевода — отдаём английский, нет и его — русский. Пустых мест
      // в интерфейсе быть не должно ни при каком раскладе.
      const value = (row as Record<string, unknown>)[lang] as string | null;
      dict[row.key] = value ?? row.en ?? row.ru;
    }

    // Словарь меняется редко — разрешаем клиенту подержать его у себя.
    res.set("Cache-Control", "public, max-age=300");
    res.json({ lang, count: Object.keys(dict).length, dict });
  } catch (e: unknown) {
    logError("[i18n/:lang]", e);
    res.status(500).json({ error: "Failed to load texts" });
  }
});
