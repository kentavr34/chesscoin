-- Идемпотентный сид REFERRAL-задач (канон Кенана § B.5 MASTER_PLAN):
-- 6 milestones — 3/5/10/20/50/100 рефералов → 3K/5K/10K/20K/50K/100K монет.
--
-- Сначала чистим старые REFERRAL-задачи с другими порогами/наградами,
-- затем вставляем 6 канонических. UPSERT по уникальному referralCount.
--
-- Безопасно: пользовательские completed_tasks ссылаются на task.id —
-- если задача удалена, FK ON DELETE CASCADE убирает completedTask.
-- Это корректно (rc=1 → rc=3 — пользователи с 1-2 рефералами уже
-- не должны были получить старую награду как «постоянную»; auto-complete
-- ре-проверит при первом GET /tasks).

-- 1) Сохраним «уже выполнившим» — миграцию задумывали идемпотентной,
--    чтобы локальный dev не сломался. На проде эти 6 задач уже
--    отредактированы вручную (см. JOURNAL 2026-05-15 B.5).

-- Удаляем все старые REFERRAL-задачи кроме тех, что точно совпадают
-- с каноном по (referralCount, winningAmount).
DELETE FROM "tasks"
WHERE "taskType" = 'REFERRAL'
  AND NOT (
    ((metadata->>'referralCount')::int, "winningAmount") IN (
      (3, 3000), (5, 5000), (10, 10000),
      (20, 20000), (50, 50000), (100, 100000)
    )
  );

-- Вставляем недостающие.
INSERT INTO "tasks" (id, "taskType", status, icon, title, description, metadata, "winningAmount", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'REFERRAL', 'ACTIVE', 'users',
       'Invite ' || rc || ' friends',
       'Bonus ' || amt || ' coins for ' || rc || ' active referrals',
       jsonb_build_object('referralCount', rc, 'category', 'SOCIAL'),
       amt, NOW(), NOW()
FROM (VALUES
  (3, 3000), (5, 5000), (10, 10000),
  (20, 20000), (50, 50000), (100, 100000)
) AS canon(rc, amt)
WHERE NOT EXISTS (
  SELECT 1 FROM "tasks" t
  WHERE t."taskType" = 'REFERRAL'
    AND (t.metadata->>'referralCount')::int = canon.rc
);
