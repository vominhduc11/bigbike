-- Durable audit/checkpoint state for the one-time guarded WordPress live migration.
-- These rows contain only hashes/counts/status metadata, never source content or secrets.
CREATE TABLE IF NOT EXISTS live_migration_runs (
    run_id uuid PRIMARY KEY,
    snapshot_id varchar(160) NOT NULL UNIQUE,
    source_dump_sha256 varchar(64) NOT NULL,
    reviewed_plan_sha256 varchar(64) NOT NULL,
    plan_digest_sha256 varchar(64) NOT NULL,
    status varchar(20) NOT NULL,
    protected_counts jsonb NOT NULL,
    started_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    completed_at timestamptz,
    last_error text,
    CONSTRAINT ck_live_migration_runs_source_sha
        CHECK (source_dump_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_live_migration_runs_plan_sha
        CHECK (reviewed_plan_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_live_migration_runs_digest_sha
        CHECK (plan_digest_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_live_migration_runs_status
        CHECK (status IN ('RUNNING', 'FAILED', 'COMPLETED'))
);

CREATE TABLE IF NOT EXISTS live_migration_checkpoints (
    run_id uuid NOT NULL,
    domain varchar(40) NOT NULL,
    batch_number integer NOT NULL,
    row_count integer NOT NULL,
    result jsonb NOT NULL,
    committed_at timestamptz NOT NULL,
    CONSTRAINT pk_live_migration_checkpoints PRIMARY KEY (run_id, domain, batch_number),
    CONSTRAINT fk_live_migration_checkpoints_run
        FOREIGN KEY (run_id) REFERENCES live_migration_runs(run_id) ON DELETE RESTRICT,
    CONSTRAINT ck_live_migration_checkpoints_batch CHECK (batch_number >= 0),
    CONSTRAINT ck_live_migration_checkpoints_rows CHECK (row_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_live_migration_checkpoints_domain
    ON live_migration_checkpoints (run_id, domain, batch_number);

-- Rollback after the migration audit retention period only:
--   DROP TABLE IF EXISTS live_migration_checkpoints;
--   DROP TABLE IF EXISTS live_migration_runs;
