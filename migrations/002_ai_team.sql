-- ═══════════════════════════════════════════════════════════════════════
-- Миграция 002 — AI_TEAM: роли, команда, история, уроки
-- Идея: роли персонифицированы и динамичны (можно нанимать/увольнять),
-- мозги (LLM модели) назначаются ролям и меняются на лету.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. ROLES (штатное расписание — должности) ─────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT UNIQUE NOT NULL,            -- 'librarian', 'developer'
    persona         TEXT NOT NULL,                   -- 'Библиотекарь'
    department      TEXT,                            -- 'dev', 'ops', 'content'
    job_description TEXT NOT NULL,                   -- зона ответственности
    default_system_prompt TEXT NOT NULL,             -- характер/правила
    specialization  TEXT[] DEFAULT '{}',             -- ['pgvector','fts']
    trigger_keywords TEXT[] DEFAULT '{}',            -- для авто-роутинга
    min_quality     FLOAT DEFAULT 0.85,              -- порог качества
    cost_budget_monthly NUMERIC DEFAULT NULL,        -- $ на месяц (NULL = без лимита)
    hired_at        TIMESTAMPTZ DEFAULT NOW(),
    hired_by        TEXT DEFAULT 'claudia',
    fired_at        TIMESTAMPTZ,
    fire_reason     TEXT,
    is_active       BOOLEAN GENERATED ALWAYS AS (fired_at IS NULL) STORED
);

CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_roles_department ON roles(department);
CREATE INDEX IF NOT EXISTS idx_roles_keywords ON roles USING gin(trigger_keywords);

-- ─── 2. TEAM_ROSTER (назначения мозгов на роли) ───────────────────────
CREATE TABLE IF NOT EXISTS team_roster (
    role_name       TEXT PRIMARY KEY REFERENCES roles(name) ON DELETE CASCADE,

    -- Постоянный мозг
    current_provider TEXT NOT NULL,
    current_model    TEXT NOT NULL,
    current_tier     TEXT DEFAULT 'standard',
    current_since    TIMESTAMPTZ DEFAULT NOW(),
    assigned_by      TEXT DEFAULT 'claudia',

    -- Временная замена (опционально)
    temp_provider    TEXT,
    temp_model       TEXT,
    temp_tier        TEXT,
    temp_until       TIMESTAMPTZ,
    temp_reason      TEXT,

    -- Параметры вызова
    max_tokens       INT DEFAULT 2000,
    temperature      FLOAT DEFAULT 0.3,

    -- Метрики (обновляются при вызовах)
    success_30d      INT DEFAULT 0,
    fail_30d         INT DEFAULT 0,
    avg_latency_ms   INT DEFAULT 0,
    cost_30d_usd     NUMERIC DEFAULT 0,
    last_invoked     TIMESTAMPTZ,
    total_invocations BIGINT DEFAULT 0,

    notes            TEXT
);

-- ─── 3. TEAM_HISTORY (аудит перестановок) ─────────────────────────────
CREATE TABLE IF NOT EXISTS team_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name        TEXT NOT NULL,
    event_type       TEXT NOT NULL,                  -- 'hire','fire','reassign','temp_assign','temp_revert'
    prev_provider    TEXT,
    prev_model       TEXT,
    new_provider     TEXT,
    new_model        TEXT,
    reason           TEXT,
    decided_by       TEXT DEFAULT 'claudia',         -- 'claudia' | 'kenan'
    metrics_before   JSONB,
    metrics_after    JSONB,                          -- заполняется через 7 дней
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_history_role ON team_history(role_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_history_type ON team_history(event_type);

-- ─── 4. SPECIALIST_LESSONS (уроки, сохраняющиеся между мозгами) ───────
CREATE TABLE IF NOT EXISTS specialist_lessons (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name        TEXT REFERENCES roles(name) ON DELETE CASCADE,
    project          TEXT DEFAULT 'claudia',
    lesson           TEXT NOT NULL,
    source           TEXT DEFAULT 'claudia',         -- 'auto','kenan','claudia','reflection'
    confidence       FLOAT DEFAULT 1.0,
    learned_at       TIMESTAMPTZ DEFAULT NOW(),
    used_count       INT DEFAULT 0,
    evidence_refs    UUID[],                          -- ссылки на conversations
    is_active        BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_lessons_role ON specialist_lessons(role_name) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_lessons_project ON specialist_lessons(project);

-- ─── 5. INVOCATIONS (лог каждого вызова специалиста) ──────────────────
CREATE TABLE IF NOT EXISTS specialist_invocations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name        TEXT,
    provider         TEXT,
    model            TEXT,
    prompt_hash      TEXT,
    tokens_in        INT,
    tokens_out       INT,
    latency_ms       INT,
    cost_usd         NUMERIC,
    success          BOOLEAN,
    error_msg        TEXT,
    task_type        TEXT,                            -- 'search','code','summary'...
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoc_role_time ON specialist_invocations(role_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoc_success ON specialist_invocations(role_name, success, created_at DESC);

-- ─── Trigger: обновлять метрики team_roster при новом invocation ──────
CREATE OR REPLACE FUNCTION update_roster_metrics() RETURNS TRIGGER AS $$
BEGIN
    UPDATE team_roster
    SET last_invoked = NEW.created_at,
        total_invocations = total_invocations + 1,
        success_30d = success_30d + (CASE WHEN NEW.success THEN 1 ELSE 0 END),
        fail_30d    = fail_30d    + (CASE WHEN NEW.success THEN 0 ELSE 1 END),
        cost_30d_usd = cost_30d_usd + COALESCE(NEW.cost_usd, 0),
        avg_latency_ms = (COALESCE(avg_latency_ms,0)*9 + COALESCE(NEW.latency_ms,0)) / 10
    WHERE role_name = NEW.role_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_roster_metrics ON specialist_invocations;
CREATE TRIGGER trg_update_roster_metrics
AFTER INSERT ON specialist_invocations
FOR EACH ROW EXECUTE FUNCTION update_roster_metrics();

-- ─── Проверка ─────────────────────────────────────────────────────────
SELECT 'AI_TEAM migration 002 applied' AS status;
