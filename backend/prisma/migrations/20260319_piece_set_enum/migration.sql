-- Migration: Add PIECE_SET to ItemType enum
DO $$ BEGIN
  ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'PIECE_SET';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
