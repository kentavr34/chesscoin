# ▶️ ИНСТРУКЦИЯ 1 — ВХОД В КОНТЕКСТ

> Выполняется **до планирования любых изменений**. Каждый пункт — фактом, не по памяти.
> Цель: не повторять уже решённое и не ломать работающее.
>
> **Когда обязательно:** задача меняет код, БД, сервер, дизайн, конфиг, документы.
> **Когда не обязательно:** чистое чтение и обсуждение («расскажи», «как думаешь»,
> «что там с X»). Читать можно свободно — ломать нельзя.

Одной командой всё сразу:

```bash
python project_management/tools/session_start.py "тема работы"
```

Скрипт выполняет шаги 1–7 и регистрирует вход. Если он недоступен — руками, по порядку:

## Шаг 1. Регистрация входа (принцип библиотеки)

```sql
INSERT INTO chesscoin_pm.session_log (agent, purpose) VALUES ('claude', '<зачем вошла>') RETURNING id;
```

Все изменения сессии привязываются к этому id.

## Шаг 2. Диалог за последние 24 часа — о чём говорили

```sql
SELECT to_char(timestamp,'MM-DD HH24:MI'), role, left(coalesce(text_summary,text,user_message),200)
FROM claudia_memory.dialog_history
WHERE project='chesscoin' AND timestamp > now()-interval '24 hours'
ORDER BY timestamp;
```

Это первое, что нужно знать: что Кенан говорил, что я отвечала, на чём остановились.

## Шаг 3. Память проекта — что уже решали

```sql
-- проблемы и корни по теме
SELECT problem, root_cause, notes, rating FROM public.claudia_learned_solutions
 WHERE project='chesscoin' AND (problem ILIKE '%<тема>%' OR notes ILIKE '%<тема>%')
 ORDER BY rating DESC NULLS LAST LIMIT 10;

-- мои прошлые промахи по теме
SELECT happened_on, mistake, rule FROM chesscoin_pm.agent_mistakes
 WHERE mistake ILIKE '%<тема>%' OR rule ILIKE '%<тема>%';
```

**Тема уже встречалась — сначала читаем, чем закончилось, и только потом планируем.**

## Шаг 4. Где прод и что на нём

```bash
Resolve-DnsName chesscoin.app -Type A          # ожидаемо 45.67.216.36
ssh root@45.67.216.36 "cd /opt/chesscoin && git log --oneline -3 && docker ps --format '{{.Names}} {{.Status}}'"
```

IP не совпал с `00_CONTEXT.md` — **сначала правим документацию, потом работаем**
(урок 11.05 и 29.07: деплой уходил мимо прода).

## Шаг 5. Что менялось за сутки и совпадает ли это с реестром

```bash
ssh root@45.67.216.36 "find /opt/chesscoin -mtime -1 -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -20"
git -C D:\Документы\chesscoin log --oneline --since=1.day
```

Расхождение реестра и диска — красный сигнал: либо забыли записать, либо файл чужой.

## Шаг 6. Открытые дефекты и состояние работ

`registry/TODO_FIXES.md` — что сломано и ждёт.
`registry/PROJECT_MANAGEMENT.md` — какие задачи в работе, какие закрыты.
`registry/OPERATIONS_LOG.md` — что делали в прошлый раз.

## Шаг 7. Целостность до правок

```bash
python project_management/tools/regression.py
```

Если что-то уже сломано — **сначала это**, потом новая задача. Иначе моя правка
ляжет поверх чужой поломки и корень будет не найти.

## Шаг 8. План

Только теперь: что делаю, чем докажу, что не сломаю.
Каждый пункт из сообщения Кенана — отдельной строкой в TaskCreate и в `TODO_FIXES.md`.
Критерий готовности формулируется **заранее** и по-пользовательски:
не «поправила стиль кнопки», а «в Telegram на телефоне кнопка X открывает модал Y».
