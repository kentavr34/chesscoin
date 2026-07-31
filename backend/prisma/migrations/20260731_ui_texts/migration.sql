-- Единая таблица текстов интерфейса (Кенан 31.07.2026).
--
-- Замысел: все видимые пользователю строки живут в одном месте с указанием,
-- ГДЕ они показываются — на каком экране, в каком месте, что это такое
-- (заголовок окна, надпись на кнопке, инструкция, уведомление). Языки —
-- отдельными колонками. Новый язык = одна колонка, без правок кода.
--
-- Повод: во фронте 444 строки написаны прямо в коде мимо словаря — при смене
-- языка они остаются русскими.
CREATE TABLE IF NOT EXISTS "ui_texts" (
    "key"       TEXT PRIMARY KEY,        -- exchange.createOrder.title
    "screen"    TEXT NOT NULL,           -- ExchangeTab
    "place"     TEXT,                    -- модалка создания ордера
    "kind"      TEXT NOT NULL,           -- title | button | label | hint | error | notification
    "ru"        TEXT NOT NULL,           -- русский обязателен: это исходный язык
    "en"        TEXT,
    "az"        TEXT,
    "tr"        TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ui_texts_screen_idx" ON "ui_texts"("screen");
CREATE INDEX IF NOT EXISTS "ui_texts_kind_idx"   ON "ui_texts"("kind");
