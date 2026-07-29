-- Прогресс уроков (Sprint 5, Floor 2: Learning).
-- Модель LessonProgress была в schema.prisma, а таблицы на проде не существовало:
-- эндпоинт /tasks/lessons/progress падал с P2010 «relation lesson_progress does not exist».
-- Найдено 2026-07-29 визуальным эталоном при съёмке экрана /lessons.
--
-- Только добавление. Общий `prisma migrate diff` применять НЕЛЬЗЯ: он предлагает
-- удалить колонки, индексы и шесть таблиц, включая чужие (claudia_memory,
-- claudia_tasks, conversations) — они живут в этой же БД.

CREATE TABLE IF NOT EXISTS "lesson_progress" (
    "userId" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3)[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("userId")
);
