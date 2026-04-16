-- AlterEnum: add FONT value to ItemType enum
-- Required for font shop items seeding
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'FONT';
