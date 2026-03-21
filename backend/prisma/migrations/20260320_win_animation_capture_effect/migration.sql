-- V3: Добавляем новые типы предметов магазина
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'WIN_ANIMATION';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'CAPTURE_EFFECT';
