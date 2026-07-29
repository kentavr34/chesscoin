-- ChessCoin · управляющий контур (project management)
-- Создано 2026-07-29 по требованию Кенана: перенять алгоритм 994 и адаптировать.
-- Схема отдельная, чтобы не смешиваться с Claudia и Jobus на том же сервере.

CREATE SCHEMA IF NOT EXISTS chesscoin_pm;

-- 1. Регистрация входа (принцип библиотеки: кто вошёл, зачем, когда вышел)
CREATE TABLE IF NOT EXISTS chesscoin_pm.session_log (
  id          serial PRIMARY KEY,
  agent       text NOT NULL DEFAULT 'claude',
  purpose     text,
  opened_at   timestamptz DEFAULT now(),
  closed_at   timestamptz,
  summary     text
);

-- 2. Мои ошибки (не дефекты продукта, а промахи исполнителя) → правило, которое их закрывает
CREATE TABLE IF NOT EXISTS chesscoin_pm.agent_mistakes (
  id            serial PRIMARY KEY,
  happened_on   date,
  mistake       text NOT NULL,
  kenan_quote   text,
  root_cause    text,
  rule          text,
  prevented_by  text,
  repeat_count  int DEFAULT 1,
  created_at    timestamptz DEFAULT now()
);

-- 3. Боевой путь подсистемы: чем проверять и чем легко ошибиться
CREATE TABLE IF NOT EXISTS chesscoin_pm.prod_path_registry (
  id          serial PRIMARY KEY,
  subsystem   text UNIQUE NOT NULL,
  prod_path   text NOT NULL,
  how_to_test text,
  trap        text,
  updated_at  timestamptz DEFAULT now()
);

-- 4. Эталон достигнутого: что уже доказано работающим
CREATE TABLE IF NOT EXISTS chesscoin_pm.regression_cases (
  id           serial PRIMARY KEY,
  tema         text NOT NULL,
  kind         text NOT NULL DEFAULT 'api',   -- api | ui | db | bot | infra
  check_cmd    text,
  must_contain text,
  must_not     text,
  proven_at    date,
  origin       text,                          -- из какой реальной аварии родился случай
  active       boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS chesscoin_pm.regression_runs (
  id       serial PRIMARY KEY,
  case_id  int REFERENCES chesscoin_pm.regression_cases(id),
  ts       timestamptz DEFAULT now(),
  passed   boolean,
  note     text
);

-- 5. Реестр файлов: снимок всего, что лежит в контурах проекта
CREATE TABLE IF NOT EXISTS chesscoin_pm.file_inventory (
  id         bigserial PRIMARY KEY,
  scanned_at timestamptz DEFAULT now(),
  contour    text,        -- prod | repo | bot | infra
  path       text,
  size       bigint,
  mtime      timestamptz,
  sha        text,
  kind       text
);
CREATE INDEX IF NOT EXISTS ix_cc_inv_scan ON chesscoin_pm.file_inventory(scanned_at);
CREATE INDEX IF NOT EXISTS ix_cc_inv_path ON chesscoin_pm.file_inventory(path);

-- 6. Журнал операций по ходу работы (note.py)
CREATE TABLE IF NOT EXISTS chesscoin_pm.operations_log (
  id         serial PRIMARY KEY,
  ts         timestamptz DEFAULT now(),
  session_id int,
  kind       text DEFAULT 'note',   -- note | change | deploy | rollback | verify
  text       text NOT NULL,
  files      text[]
);
