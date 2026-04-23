-- Миграция S3 → локальная файловая система.
-- Старые URL на TimeWeb-bucket недоступны (bucket удалён при переходе).
-- Обнуляем их, чтобы фронтенд показывал fallback (generated gradient / default avatar).
-- Пользователи перезальют аватары через профиль.

UPDATE "User"
SET "avatar" = NULL
WHERE "avatar" LIKE 'https://%.s3.%'
   OR "avatar" LIKE 'https://s3.timeweb.%'
   OR "avatar" LIKE 'https://%timeweb.cloud%';

UPDATE "Item"
SET "imageUrl" = NULL
WHERE "imageUrl" LIKE 'https://%.s3.%'
   OR "imageUrl" LIKE 'https://s3.timeweb.%'
   OR "imageUrl" LIKE 'https://%timeweb.cloud%';

UPDATE "Item"
SET "previewUrl" = NULL
WHERE "previewUrl" LIKE 'https://%.s3.%'
   OR "previewUrl" LIKE 'https://s3.timeweb.%'
   OR "previewUrl" LIKE 'https://%timeweb.cloud%';
