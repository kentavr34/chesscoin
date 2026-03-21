-- TAIL-1: Добавляем REFUND в TransactionType
-- Migration: 20260320_add_refund_transaction_type

ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REFUND';
