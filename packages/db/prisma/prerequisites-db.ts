/**
 * Part 2: Prerequisites for DATABASE-tagged challenges
 * Run: cd packages/db && npx tsx prisma/prerequisites-db.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const updates: { slug: string; starterSchema: string }[] = [
  // ─── DATABASE DEBUGGING ────────────────────────────────────────────────────
  {
    slug: "connection-pool-exhaustion-debug",
    starterSchema: `-- App: E-commerce platform (Node.js + pg pool)
-- Problem: "remaining connection slots are reserved" errors at peak traffic
-- Pool config: { min: 2, max: 10, idleTimeoutMillis: 30000 }

CREATE TABLE users (
  id        SERIAL PRIMARY KEY,
  email     TEXT UNIQUE NOT NULL,
  name      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  stock_count INT DEFAULT 0
);

CREATE TABLE orders (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id),
  status     TEXT DEFAULT 'pending',
  total      NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INT REFERENCES orders(id),
  product_id INT REFERENCES products(id),
  quantity   INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL
);

INSERT INTO users (email, name) VALUES
  ('alice@shop.com','Alice'),('bob@shop.com','Bob'),('carol@shop.com','Carol');
INSERT INTO products (name, price, stock_count) VALUES
  ('Widget A', 9.99, 500),('Widget B', 24.99, 200),('Gadget X', 99.99, 50);

-- ── Diagnostics to run ──────────────────────────────────────────
-- Check current connections by state:
SELECT count(*), state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, wait_event_type, wait_event;

-- Find long-running queries holding connections:
SELECT pid, now() - query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - query_start) > interval '30 seconds'
  AND state != 'idle';

-- Max connections setting:
SHOW max_connections;
SELECT count(*) FROM pg_stat_activity;`,
  },

  {
    slug: "db-timeout-debugging",
    starterSchema: `-- App: Analytics dashboard  statement_timeout = '30s'
-- Problem: Queries on events table (50M+ rows) intermittently timing out
-- Root cause: missing index on created_at, forcing sequential scan

CREATE TABLE events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT NOT NULL,
  event_type TEXT NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_aggregates (
  id         SERIAL PRIMARY KEY,
  date       DATE NOT NULL,
  event_type TEXT NOT NULL,
  count      INT DEFAULT 0,
  UNIQUE (date, event_type)
);

-- Seed 100k rows to simulate slow query
INSERT INTO events (user_id, event_type, created_at)
SELECT
  (random() * 10000)::INT,
  CASE (random() * 3)::INT
    WHEN 0 THEN 'page_view'
    WHEN 1 THEN 'click'
    WHEN 2 THEN 'purchase'
    ELSE 'signup'
  END,
  NOW() - (random() * 365 * interval '1 day')
FROM generate_series(1, 100000);

-- ── Problem query (times out on prod) ───────────────────────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT event_type, COUNT(*) AS cnt
FROM events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type;

-- ── Fix: add index concurrently (no table lock) ──────────────────
-- CREATE INDEX CONCURRENTLY idx_events_created_at ON events(created_at);

-- ── Verify plan changes to Index Scan after fix ──────────────────
-- EXPLAIN ANALYZE SELECT ... same query ...`,
  },

  {
    slug: "deadlock-debug-fix",
    starterSchema: `-- App: Inventory management system
-- Problem: Deadlocks during concurrent order processing
-- TX-A locks product 101 then 102; TX-B locks 102 then 101 → deadlock

CREATE TABLE warehouses (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  location TEXT
);

CREATE TABLE inventory (
  product_id   INT PRIMARY KEY,
  warehouse_id INT REFERENCES warehouses(id),
  quantity     INT NOT NULL CHECK (quantity >= 0),
  reserved     INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reservations (
  id         BIGSERIAL PRIMARY KEY,
  product_id INT REFERENCES inventory(product_id),
  quantity   INT NOT NULL,
  order_id   INT NOT NULL,
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO warehouses VALUES (1,'East Coast Hub','Newark, NJ'),(2,'West Coast Hub','LA, CA');
INSERT INTO inventory VALUES (101,1,500,0,NOW()),(102,1,300,0,NOW()),(103,2,150,0,NOW());

-- ── Deadlock reproduction ────────────────────────────────────────
-- Session A:
--   BEGIN;
--   UPDATE inventory SET reserved = reserved+5 WHERE product_id = 101;
--   -- (pause) --
--   UPDATE inventory SET reserved = reserved+3 WHERE product_id = 102;  -- waits for B
--   COMMIT;
--
-- Session B (concurrent):
--   BEGIN;
--   UPDATE inventory SET reserved = reserved+2 WHERE product_id = 102;
--   UPDATE inventory SET reserved = reserved+1 WHERE product_id = 101;  -- DEADLOCK
--   COMMIT;

-- ── Fix: always acquire locks in consistent order ─────────────────
-- SELECT * FROM inventory
-- WHERE product_id = ANY(ARRAY[101,102])
-- ORDER BY product_id                -- consistent order prevents deadlock
-- FOR UPDATE;

-- ── Monitor deadlocks ────────────────────────────────────────────
-- SET log_lock_waits = ON;
-- SET deadlock_timeout = '1s';`,
  },

  {
    slug: "n-plus-one-query-logging",
    starterSchema: `-- App: Content platform with feed endpoint
-- Problem: /feed makes 1 + N + N queries (posts + authors + comment counts)

CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL,
  display_name   TEXT NOT NULL,
  avatar_url     TEXT,
  follower_count INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  id          SERIAL PRIMARY KEY,
  author_id   INT REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  published   BOOLEAN DEFAULT FALSE,
  view_count  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
  id         SERIAL PRIMARY KEY,
  post_id    INT REFERENCES posts(id) ON DELETE CASCADE,
  author_id  INT REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE likes (
  post_id INT REFERENCES posts(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

INSERT INTO users (username, display_name) VALUES
  ('alice','Alice Chen'),('bob','Bob Kumar'),
  ('carol','Carol Wu'),('dave','Dave Smith');
INSERT INTO posts (author_id, title, body, published) VALUES
  (1,'Scaling Postgres','Tips for scaling...', TRUE),
  (2,'Redis Patterns','Caching strategies...', TRUE),
  (3,'Docker Best Practices','Container tips...', TRUE),
  (1,'Index Strategies','B-tree vs GiST...', TRUE);
INSERT INTO comments (post_id, author_id, body) VALUES
  (1,2,'Great!'),(1,3,'Helpful'),(2,1,'Redis rocks'),(3,4,'Thanks!');
INSERT INTO likes VALUES (1,2),(1,3),(2,1),(3,4),(4,2);

-- ── N+1 Problem (what the ORM generates) ────────────────────────
-- SELECT * FROM posts WHERE published = TRUE;           -- 1 query
-- SELECT * FROM users WHERE id = 1;                    -- N queries (per post)
-- SELECT COUNT(*) FROM comments WHERE post_id = 1;     -- N queries

-- ── Fix: single JOIN query ───────────────────────────────────────
SELECT
  p.id, p.title, p.created_at,
  u.display_name, u.avatar_url,
  COUNT(DISTINCT c.id)  AS comment_count,
  COUNT(DISTINCT l.user_id) AS like_count
FROM posts p
JOIN users u ON u.id = p.author_id
LEFT JOIN comments c ON c.post_id = p.id
LEFT JOIN likes l ON l.post_id = p.id
WHERE p.published = TRUE
GROUP BY p.id, u.id
ORDER BY p.created_at DESC;`,
  },

  {
    slug: "query-plan-regression",
    starterSchema: `-- App: SaaS analytics — accounts table grew 10x last month
-- Problem: Query plan changed from Index Scan → Seq Scan after data growth
-- Root cause: stale table statistics; planner underestimates row count

CREATE TABLE accounts (
  id         BIGSERIAL PRIMARY KEY,
  plan       TEXT NOT NULL DEFAULT 'free',
  region     TEXT NOT NULL DEFAULT 'us-east',
  status     TEXT NOT NULL DEFAULT 'active',
  mrr        NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  churned_at TIMESTAMPTZ
);

CREATE TABLE account_events (
  id          BIGSERIAL PRIMARY KEY,
  account_id  BIGINT REFERENCES accounts(id),
  event_type  TEXT NOT NULL,
  metadata    JSONB,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_plan_status   ON accounts(plan, status);
CREATE INDEX idx_accounts_created_at    ON accounts(created_at DESC);
CREATE INDEX idx_acct_events_account    ON account_events(account_id);
CREATE INDEX idx_acct_events_occurred   ON account_events(occurred_at);

-- Seed 100k rows (simulates growth scenario)
INSERT INTO accounts (plan, region, status, mrr, created_at)
SELECT
  CASE (i % 10) WHEN 0 THEN 'enterprise' WHEN 1 THEN 'pro' ELSE 'free' END,
  CASE (i % 3) WHEN 0 THEN 'us-east' WHEN 1 THEN 'us-west' ELSE 'eu' END,
  CASE WHEN i % 20 = 0 THEN 'churned' ELSE 'active' END,
  CASE (i % 10) WHEN 0 THEN 999 WHEN 1 THEN 49 ELSE 0 END,
  NOW() - ((i % 730) * interval '1 day')
FROM generate_series(1, 100000) AS i;

-- ── Regressed query — check the plan ────────────────────────────
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM accounts
WHERE plan = 'enterprise' AND status = 'active'
ORDER BY created_at DESC LIMIT 50;

-- ── Diagnostics ──────────────────────────────────────────────────
SELECT relname, n_live_tup, n_dead_tup, last_analyze, last_autoanalyze
FROM pg_stat_user_tables WHERE relname = 'accounts';

SELECT tablename, attname, n_distinct, correlation
FROM pg_stats WHERE tablename = 'accounts' AND attname IN ('plan','status');

-- ── Fix ──────────────────────────────────────────────────────────
-- ANALYZE accounts;   -- refresh statistics immediately
-- or tune: ALTER TABLE accounts SET (autovacuum_analyze_scale_factor = 0.01);`,
  },

  // ─── DATABASE / DEVOPS ────────────────────────────────────────────────────
  {
    slug: "db-migration-with-zero-downtime",
    starterSchema: `-- App: User auth service (PostgreSQL, high traffic)
-- Goal: Add NOT NULL column 'subscription_tier' without downtime
-- Pattern: 3-phase expand/migrate/contract migration

-- ── Current production schema ────────────────────────────────────
CREATE TABLE users (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token   ON sessions(token);

INSERT INTO users (email, name) VALUES
  ('alice@example.com','Alice'),('bob@example.com','Bob'),
  ('carol@example.com','Carol');

-- ── Phase 1 — EXPAND (deploy v1, backward compatible) ────────────
-- Add nullable column — no lock:
-- ALTER TABLE users ADD COLUMN subscription_tier TEXT;

-- ── Phase 2 — MIGRATE (backfill in batches, no downtime) ─────────
-- DO $$
-- DECLARE batch_size INT := 1000; last_id BIGINT := 0;
-- BEGIN
--   LOOP
--     UPDATE users SET subscription_tier = 'free'
--     WHERE id > last_id AND subscription_tier IS NULL
--     ORDER BY id LIMIT batch_size
--     RETURNING id INTO last_id;
--     EXIT WHEN NOT FOUND;
--     PERFORM pg_sleep(0.01);  -- throttle
--   END LOOP;
-- END$$;

-- ── Phase 3 — CONTRACT (deploy v2, add constraint) ───────────────
-- ALTER TABLE users ALTER COLUMN subscription_tier SET NOT NULL;
-- ALTER TABLE users ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- ── Verify ────────────────────────────────────────────────────────
SELECT count(*) FILTER (WHERE subscription_tier IS NULL) AS missing
FROM users;`,
  },

  {
    slug: "db-migration-cicd-pipeline",
    starterSchema: `-- App: Multi-service platform using Flyway for migrations
-- Goal: Automate DB migrations in CI/CD with rollback safety

-- ── flyway.conf ──────────────────────────────────────────────────
-- flyway.url=jdbc:postgresql://localhost:5432/appdb
-- flyway.user=app_user
-- flyway.password=\${DB_PASSWORD}
-- flyway.locations=filesystem:./migrations
-- flyway.validateOnMigrate=true
-- flyway.outOfOrder=false
-- flyway.baselineOnMigrate=false

-- ── V1__initial_schema.sql ───────────────────────────────────────
CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);

-- ── V2__add_audit_log.sql ─────────────────────────────────────────
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  UUID REFERENCES tenants(id),
  actor_id   UUID REFERENCES users(id),
  action     TEXT NOT NULL,
  resource   TEXT NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC);

-- ── CI/CD pipeline steps ─────────────────────────────────────────
-- 1. Run migrations:  flyway -configFiles=flyway.conf migrate
-- 2. Check status:    flyway info
-- 3. Validate:        flyway validate
-- 4. Rollback (undo): flyway undo  (requires Flyway Teams)
-- Alt rollback: keep V2__rollback.sql with DROP TABLE audit_log;`,
  },

  {
    slug: "db-health-check-endpoint",
    starterSchema: `-- App: Microservice with /health/db endpoint
-- Goal: Comprehensive DB health check (connectivity, replication lag, pool)

CREATE TABLE health_checks (
  id           SERIAL PRIMARY KEY,
  check_name   TEXT NOT NULL,
  status       TEXT NOT NULL,  -- 'ok', 'degraded', 'critical'
  latency_ms   INT,
  message      TEXT,
  checked_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_config VALUES
  ('db_health_threshold_ms', '100', NOW()),
  ('replica_lag_threshold_s', '30',  NOW());

-- ── Health check queries to implement ───────────────────────────
-- 1. Connectivity check:
SELECT 1 AS alive;

-- 2. Write latency check:
INSERT INTO health_checks (check_name, status, latency_ms)
VALUES ('write_test', 'ok', 0) RETURNING id;

-- 3. Replication lag (on primary):
SELECT
  client_addr,
  state,
  EXTRACT(EPOCH FROM (now() - write_lag))::INT AS write_lag_s,
  EXTRACT(EPOCH FROM (now() - replay_lag))::INT AS replay_lag_s
FROM pg_stat_replication;

-- 4. Connection pool saturation:
SELECT count(*) AS active,
       (SELECT setting::INT FROM pg_settings WHERE name='max_connections') AS max
FROM pg_stat_activity
WHERE datname = current_database();

-- 5. Bloat / vacuum needed:
SELECT relname, n_dead_tup, n_live_tup,
       round(n_dead_tup::NUMERIC/NULLIF(n_live_tup,0)*100,1) AS dead_pct
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 5;`,
  },

  {
    slug: "backup-verification-pipeline",
    starterSchema: `-- App: Financial SaaS — nightly pg_dump backups must be verified
-- Goal: Restore backup to test instance, run assertions, alert on failure

CREATE TABLE transactions (
  id          BIGSERIAL PRIMARY KEY,
  account_id  INT NOT NULL,
  type        TEXT NOT NULL,  -- 'credit', 'debit'
  amount      NUMERIC(14,2) NOT NULL,
  currency    TEXT DEFAULT 'USD',
  status      TEXT DEFAULT 'completed',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  id         SERIAL PRIMARY KEY,
  owner_name TEXT NOT NULL,
  balance    NUMERIC(14,2) DEFAULT 0,
  currency   TEXT DEFAULT 'USD'
);

CREATE INDEX idx_txn_account_date ON transactions(account_id, created_at DESC);

INSERT INTO accounts (owner_name, balance) VALUES
  ('Alice Corp', 125000.00),('Bob LLC', 48500.50),('Carol Inc', 9875.25);
INSERT INTO transactions (account_id, type, amount) VALUES
  (1,'credit',50000),(1,'debit',2500),(2,'credit',48500.50),(3,'credit',9875.25);

-- ── Verification assertions (run after restore) ──────────────────
-- A. Row counts match backup manifest:
SELECT 'accounts' AS tbl, count(*) FROM accounts
UNION ALL
SELECT 'transactions', count(*) FROM transactions;

-- B. Balance integrity:
SELECT a.id, a.balance,
       COALESCE(SUM(CASE WHEN t.type='credit' THEN t.amount ELSE -t.amount END),0) AS computed
FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id, a.balance
HAVING a.balance != COALESCE(SUM(CASE WHEN t.type='credit' THEN t.amount ELSE -t.amount END),0);

-- C. No orphaned transactions:
SELECT count(*) AS orphaned
FROM transactions t
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = t.account_id);

-- Shell: pg_dump -Fc -d prod_db > backup_$(date +%Y%m%d).dump
-- Shell: pg_restore -d verify_db backup_$(date +%Y%m%d).dump`,
  },

  {
    slug: "connection-pool-monitoring",
    starterSchema: `-- App: API server using PgBouncer + PostgreSQL
-- Goal: Alert when connection pool saturation > 80%

CREATE TABLE connection_metrics (
  id           BIGSERIAL PRIMARY KEY,
  pool_name    TEXT NOT NULL,
  active_conns INT NOT NULL,
  waiting      INT NOT NULL DEFAULT 0,
  max_conns    INT NOT NULL,
  utilization  NUMERIC(5,2),
  recorded_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id         SERIAL PRIMARY KEY,
  severity   TEXT NOT NULL,  -- 'warning', 'critical'
  message    TEXT NOT NULL,
  resolved   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conn_metrics_time ON connection_metrics(recorded_at DESC);

-- ── PgBouncer SHOW STATS (run via pgbouncer admin) ───────────────
-- psql -p 6432 -U pgbouncer pgbouncer -c "SHOW POOLS;"
-- Columns: database, user, cl_active, cl_waiting, sv_active, sv_idle, maxwait

-- ── PostgreSQL-side monitoring ────────────────────────────────────
SELECT
  count(*) FILTER (WHERE state = 'active')  AS active,
  count(*) FILTER (WHERE state = 'idle')    AS idle,
  count(*) FILTER (WHERE wait_event_type = 'Lock') AS blocked,
  (SELECT setting::INT FROM pg_settings WHERE name='max_connections') AS max_conns
FROM pg_stat_activity
WHERE datname = current_database();

-- ── Alert threshold query ─────────────────────────────────────────
-- INSERT INTO alerts (severity, message)
-- SELECT
--   CASE WHEN utilization > 0.95 THEN 'critical' ELSE 'warning' END,
--   format('Pool utilization at %s%%', round(utilization*100))
-- FROM connection_metrics
-- WHERE recorded_at > NOW() - INTERVAL '1 min'
--   AND utilization > 0.80
-- ORDER BY recorded_at DESC LIMIT 1;`,
  },

  {
    slug: "db-backed-job-queue",
    starterSchema: `-- App: Background job processing using PostgreSQL as queue
-- Goal: Reliable job queue with worker auto-scaling

CREATE TABLE jobs (
  id          BIGSERIAL PRIMARY KEY,
  queue       TEXT NOT NULL DEFAULT 'default',
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending, running, done, failed
  priority    INT NOT NULL DEFAULT 5,
  attempts    INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_queue_status ON jobs(queue, status, priority DESC, scheduled_at)
  WHERE status IN ('pending','failed');
CREATE INDEX idx_jobs_running ON jobs(status, started_at) WHERE status = 'running';

INSERT INTO jobs (queue, payload, priority) VALUES
  ('email', '{"to":"alice@example.com","template":"welcome"}', 10),
  ('email', '{"to":"bob@example.com","template":"invoice"}', 8),
  ('reports', '{"report_id":42,"format":"pdf"}', 5),
  ('sync', '{"entity":"orders","from":"2024-01-01"}', 3);

-- ── Dequeue (atomic, safe for concurrent workers) ────────────────
-- SELECT * FROM jobs
-- WHERE status = 'pending'
--   AND queue = 'email'
--   AND scheduled_at <= NOW()
-- ORDER BY priority DESC, scheduled_at
-- LIMIT 1
-- FOR UPDATE SKIP LOCKED;

-- ── Auto-scaling signal (# waiting jobs) ────────────────────────
SELECT queue, count(*) AS pending
FROM jobs
WHERE status = 'pending' AND scheduled_at <= NOW()
GROUP BY queue;

-- ── Dead job cleanup ──────────────────────────────────────────────
UPDATE jobs SET status = 'failed', error = 'timeout'
WHERE status = 'running' AND started_at < NOW() - INTERVAL '10 minutes';`,
  },

  {
    slug: "db-metrics-grafana",
    starterSchema: `-- App: PostgreSQL metrics exposed for Grafana via postgres_exporter
-- Goal: Dashboard covering query perf, connections, bloat, replication

-- ── Queries used as Grafana data sources ─────────────────────────

-- 1. Active connections over time:
SELECT
  now() AS time,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle')   AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_txn
FROM pg_stat_activity
WHERE datname = current_database();

-- 2. Top slow queries (pg_stat_statements required):
SELECT query, calls, round(total_exec_time::NUMERIC,2) AS total_ms,
       round(mean_exec_time::NUMERIC,2) AS mean_ms, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 20;

-- 3. Table bloat:
SELECT schemaname, tablename, n_live_tup, n_dead_tup,
       round(n_dead_tup::NUMERIC/NULLIF(n_live_tup,0)*100,1) AS dead_pct,
       last_vacuum, last_autovacuum
FROM pg_stat_user_tables ORDER BY dead_pct DESC NULLS LAST LIMIT 10;

-- 4. Replication lag (on primary):
SELECT client_addr,
       EXTRACT(EPOCH FROM replay_lag)::INT AS replay_lag_s
FROM pg_stat_replication;

-- 5. Cache hit rate (should be > 99%):
SELECT
  round(heap_blks_hit::NUMERIC/(heap_blks_hit+heap_blks_read+1)*100,2) AS cache_hit_pct
FROM pg_statio_user_tables
WHERE heap_blks_read + heap_blks_hit > 0
ORDER BY (heap_blks_hit+heap_blks_read) DESC LIMIT 10;

-- ── Sample application schema (to generate metrics) ───────────────
CREATE TABLE IF NOT EXISTS api_requests (
  id         BIGSERIAL PRIMARY KEY,
  endpoint   TEXT NOT NULL,
  method     TEXT NOT NULL,
  status_code INT NOT NULL,
  latency_ms  INT,
  user_id    INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_req_time ON api_requests(created_at DESC);`,
  },

  {
    slug: "slow-query-detection-alert",
    starterSchema: `-- Goal: Detect queries running > N seconds and alert via pg_cron / application

-- Enable required extensions:
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- CREATE EXTENSION IF NOT EXISTS pg_cron;  -- for scheduled alerts

CREATE TABLE slow_query_log (
  id         BIGSERIAL PRIMARY KEY,
  pid        INT NOT NULL,
  duration_s NUMERIC(10,2) NOT NULL,
  query      TEXT NOT NULL,
  state      TEXT,
  wait_event TEXT,
  logged_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE query_alerts (
  id          SERIAL PRIMARY KEY,
  threshold_s INT NOT NULL DEFAULT 30,
  notified    BOOLEAN DEFAULT FALSE,
  query_text  TEXT,
  pid         INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Detection query (poll every 30s or via pg_cron) ──────────────
SELECT pid,
       now() - query_start AS duration,
       state,
       wait_event_type,
       wait_event,
       left(query, 200) AS query_preview
FROM pg_stat_activity
WHERE state NOT IN ('idle')
  AND query_start < NOW() - INTERVAL '30 seconds'
  AND query NOT LIKE '%pg_stat_activity%';

-- ── Top queries from pg_stat_statements ──────────────────────────
SELECT
  left(query,100) AS query,
  calls,
  round(total_exec_time::NUMERIC/calls,1) AS avg_ms,
  round(max_exec_time::NUMERIC,1) AS max_ms
FROM pg_stat_statements
WHERE calls > 10
ORDER BY max_exec_time DESC
LIMIT 10;

-- ── pg_cron schedule (run as superuser) ───────────────────────────
-- SELECT cron.schedule('slow-query-alert','*/1 * * * *',
--   $$INSERT INTO slow_query_log(pid,duration_s,query,state)
--     SELECT pid, EXTRACT(EPOCH FROM(now()-query_start)), query, state
--     FROM pg_stat_activity
--     WHERE query_start < NOW()-INTERVAL '30 seconds' AND state!='idle'$$);`,
  },

  {
    slug: "read-replica-lag-monitoring",
    starterSchema: `-- App: Read-heavy SaaS using Postgres streaming replication
-- Goal: Monitor replica lag and handle it in application routing

-- ── On PRIMARY: check replication status ────────────────────────
SELECT
  client_addr       AS replica_ip,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  write_lag,
  flush_lag,
  replay_lag,
  sync_state
FROM pg_stat_replication;

-- ── On REPLICA: check own lag ─────────────────────────────────────
SELECT
  now() - pg_last_xact_replay_timestamp() AS replication_delay,
  pg_is_in_recovery()                     AS is_replica,
  pg_last_wal_receive_lsn()               AS received_lsn,
  pg_last_wal_replay_lsn()               AS replayed_lsn;

-- ── Application schema ────────────────────────────────────────────
CREATE TABLE replica_lag_metrics (
  id         BIGSERIAL PRIMARY KEY,
  replica_id TEXT NOT NULL,
  lag_seconds NUMERIC(10,3),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO app_settings VALUES
  ('max_acceptable_replica_lag_s', '10'),
  ('fallback_to_primary_on_lag', 'true');

-- ── Routing logic (application-level pseudocode) ──────────────────
-- lag = SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
-- if lag > threshold: route to PRIMARY
-- else: route to REPLICA`,
  },

  {
    slug: "schema-drift-detection",
    starterSchema: `-- Goal: Detect when production schema drifts from migration-controlled baseline

CREATE TABLE schema_snapshots (
  id          SERIAL PRIMARY KEY,
  environment TEXT NOT NULL,  -- 'production', 'staging', 'dev'
  snapshot    JSONB NOT NULL,
  taken_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schema_drift_alerts (
  id         SERIAL PRIMARY KEY,
  table_name TEXT,
  column_name TEXT,
  drift_type TEXT,  -- 'missing_column', 'extra_column', 'type_mismatch', 'missing_index'
  expected   TEXT,
  actual     TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved   BOOLEAN DEFAULT FALSE
);

-- ── Snapshot current schema ───────────────────────────────────────
SELECT json_agg(row_to_json(t)) AS snapshot FROM (
  SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position
) t;

-- ── Snapshot indexes ──────────────────────────────────────────────
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ── Snapshot foreign keys ─────────────────────────────────────────
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';`,
  },

  {
    slug: "pgbouncer-connection-pooling",
    starterSchema: `-- App: High-traffic API hitting Postgres directly (too many connections)
-- Goal: Add PgBouncer in transaction mode to reduce server connections

-- ── Application schema ────────────────────────────────────────────
CREATE TABLE api_keys (
  id         SERIAL PRIMARY KEY,
  key_hash   TEXT UNIQUE NOT NULL,
  user_id    INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used  TIMESTAMPTZ
);

CREATE TABLE requests_log (
  id          BIGSERIAL PRIMARY KEY,
  api_key_id  INT REFERENCES api_keys(id),
  endpoint    TEXT NOT NULL,
  latency_ms  INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE requests_log_2024 PARTITION OF requests_log
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- ── pgbouncer.ini (key settings) ──────────────────────────────────
-- [databases]
-- appdb = host=postgres port=5432 dbname=appdb
--
-- [pgbouncer]
-- pool_mode = transaction          ; safest for stateless APIs
-- max_client_conn = 1000           ; clients can connect freely
-- default_pool_size = 20           ; actual PG connections per db/user
-- reserve_pool_size = 5
-- reserve_pool_timeout = 3
-- max_db_connections = 50
-- server_idle_timeout = 600
-- listen_port = 6432
-- auth_type = md5
-- auth_file = /etc/pgbouncer/userlist.txt

-- ── Verify via pgbouncer admin console ───────────────────────────
-- psql -p 6432 -U pgbouncer pgbouncer
-- SHOW POOLS;
-- SHOW STATS;
-- SHOW CLIENTS;

-- ── Known limitations in transaction mode ────────────────────────
-- ✗ SET LOCAL / SET SESSION don't persist
-- ✗ Advisory locks per-session
-- ✗ LISTEN/NOTIFY
-- ✓ Prepared statements (with server_reset_query)`,
  },

  {
    slug: "multi-env-db-config",
    starterSchema: `-- Goal: Manage DB config across dev / staging / production safely

-- ── Per-environment schema approach ──────────────────────────────
CREATE TABLE app_environments (
  name       TEXT PRIMARY KEY,
  db_host    TEXT NOT NULL,
  db_port    INT  NOT NULL DEFAULT 5432,
  db_name    TEXT NOT NULL,
  pool_min   INT  NOT NULL DEFAULT 2,
  pool_max   INT  NOT NULL DEFAULT 10,
  ssl_mode   TEXT NOT NULL DEFAULT 'prefer'  -- dev: disable, prod: require
);

INSERT INTO app_environments VALUES
  ('dev',     'localhost',            5432, 'appdb_dev',     1,  5,  'disable'),
  ('staging', 'staging-db.internal', 5432, 'appdb_staging', 2,  10, 'require'),
  ('prod',    'prod-db.internal',    5432, 'appdb_prod',    5,  50, 'require');

-- ── .env per environment ──────────────────────────────────────────
-- .env.development:
--   DATABASE_URL=postgres://dev_user:dev_pass@localhost:5432/appdb_dev?sslmode=disable
--   DB_POOL_MAX=5
--
-- .env.staging:
--   DATABASE_URL=postgres://app_user:\${STAGING_DB_PASS}@staging-db.internal:5432/appdb_staging?sslmode=require
--   DB_POOL_MAX=10
--
-- .env.production:
--   DATABASE_URL=postgres://app_user:\${PROD_DB_PASS}@prod-db.internal:5432/appdb_prod?sslmode=require
--   DB_POOL_MAX=50

-- ── Database role per environment ────────────────────────────────
CREATE ROLE dev_user LOGIN PASSWORD 'dev_pass';
GRANT ALL ON DATABASE appdb_dev TO dev_user;

CREATE ROLE staging_user LOGIN;
GRANT CONNECT ON DATABASE appdb_staging TO staging_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO staging_user;

-- Prod: least privilege, separate read/write users
CREATE ROLE app_writer LOGIN;  -- for writes
CREATE ROLE app_reader LOGIN;  -- for reads
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_reader;`,
  },

  {
    slug: "db-backed-job-queue",
    starterSchema: `-- App: Background processing using Postgres as a reliable job queue
-- Goal: Workers dequeue atomically; auto-scale based on queue depth

CREATE TABLE jobs (
  id           BIGSERIAL PRIMARY KEY,
  queue        TEXT NOT NULL DEFAULT 'default',
  payload      JSONB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  priority     INT  NOT NULL DEFAULT 5,
  attempts     INT  NOT NULL DEFAULT 0,
  max_attempts INT  NOT NULL DEFAULT 3,
  run_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_dequeue ON jobs(queue, status, priority DESC, run_at)
  WHERE status IN ('pending','failed');

INSERT INTO jobs (queue, payload, priority) VALUES
  ('email',   '{"to":"alice@example.com","tpl":"welcome"}', 10),
  ('reports', '{"id":42,"format":"pdf"}', 5),
  ('sync',    '{"entity":"orders","from":"2024-01-01"}', 3);

-- ── Dequeue atomically (safe for concurrent workers) ─────────────
-- WITH next_job AS (
--   SELECT id FROM jobs
--   WHERE queue = $1 AND status = 'pending' AND run_at <= NOW()
--   ORDER BY priority DESC, run_at
--   LIMIT 1
--   FOR UPDATE SKIP LOCKED
-- )
-- UPDATE jobs SET status='running', started_at=NOW(), attempts=attempts+1
-- FROM next_job WHERE jobs.id = next_job.id
-- RETURNING *;

-- ── Auto-scaling signal ───────────────────────────────────────────
SELECT queue, count(*) AS pending_count
FROM jobs WHERE status='pending' AND run_at<=NOW()
GROUP BY queue;

-- Scale rule: if pending_count > 100 → spin up another worker pod`,
  },

  {
    slug: "k8s-db-secrets-management",
    starterSchema: `-- Goal: Store DB connection strings as Kubernetes Secrets (not ConfigMaps)

-- ── K8s Secret (base64 encoded) ───────────────────────────────────
-- apiVersion: v1
-- kind: Secret
-- metadata:
--   name: postgres-credentials
--   namespace: production
-- type: Opaque
-- stringData:               # kubectl encodes automatically
--   DATABASE_URL: postgres://app_user:s3cr3t@postgres-svc:5432/appdb?sslmode=require
--   DB_PASSWORD: s3cr3t
--   DB_READ_ONLY_URL: postgres://reader:r3adonly@postgres-ro-svc:5432/appdb

-- ── Reference in Deployment ────────────────────────────────────────
-- env:
--   - name: DATABASE_URL
--     valueFrom:
--       secretKeyRef:
--         name: postgres-credentials
--         key: DATABASE_URL

-- ── Application schema ────────────────────────────────────────────
CREATE TABLE secret_audit_log (
  id         SERIAL PRIMARY KEY,
  secret_name TEXT NOT NULL,
  accessed_by TEXT NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE db_connections (
  id          SERIAL PRIMARY KEY,
  environment TEXT NOT NULL,
  host        TEXT NOT NULL,
  port        INT NOT NULL DEFAULT 5432,
  db_name     TEXT NOT NULL,
  ssl_mode    TEXT DEFAULT 'require'
);

-- ── Seal secrets with Sealed Secrets / External Secrets Operator ─
-- apiVersion: external-secrets.io/v1beta1
-- kind: ExternalSecret
-- metadata:
--   name: postgres-secret
-- spec:
--   secretStoreRef:
--     name: vault-backend
--   target:
--     name: postgres-credentials
--   data:
--     - secretKey: DATABASE_URL
--       remoteRef:
--         key: secret/production/postgres
--         property: url`,
  },

  {
    slug: "redis-sentinel-ha",
    starterSchema: `-- Goal: Redis Sentinel for HA caching (auto-failover from primary to replica)

-- ── Redis Sentinel config (sentinel.conf) ────────────────────────
-- sentinel monitor mymaster redis-primary 6379 2
-- sentinel down-after-milliseconds mymaster 5000
-- sentinel failover-timeout mymaster 60000
-- sentinel parallel-syncs mymaster 1

-- ── Application schema (cache metadata) ──────────────────────────
CREATE TABLE cache_entries_meta (
  key         TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id   BIGINT NOT NULL,
  cached_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  hit_count   INT DEFAULT 0
);

CREATE TABLE cache_invalidation_log (
  id          BIGSERIAL PRIMARY KEY,
  keys        TEXT[] NOT NULL,
  reason      TEXT,
  triggered_by TEXT,
  invalidated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Node.js / ioredis Sentinel connection ────────────────────────
-- const Redis = require('ioredis');
-- const redis = new Redis({
--   sentinels: [
--     { host: 'sentinel-1', port: 26379 },
--     { host: 'sentinel-2', port: 26379 },
--     { host: 'sentinel-3', port: 26379 },
--   ],
--   name: 'mymaster',
--   role: 'master',       // writes go to master
--   enableReadyCheck: true,
--   retryStrategy: (times) => Math.min(times * 100, 3000),
-- });
-- const redisReader = new Redis({ sentinels: [...], name:'mymaster', role:'slave' });

-- ── Cache-aside pattern with PG fallback ─────────────────────────
-- async function getUser(id: number) {
--   const cached = await redis.get(\`user:\${id}\`);
--   if (cached) return JSON.parse(cached);
--   const user = await db.query('SELECT * FROM users WHERE id=$1',[id]);
--   await redis.setex(\`user:\${id}\`, 300, JSON.stringify(user));
--   return user;
-- }`,
  },

  {
    slug: "zero-downtime-db-upgrade",
    starterSchema: `-- Goal: Upgrade Postgres 14 → 16 with zero downtime using logical replication

-- ── Step 1: Verify replication prerequisites on source ───────────
SHOW wal_level;           -- must be 'logical'
SHOW max_replication_slots;
SHOW max_wal_senders;

-- ── Step 2: Application schema (to be replicated) ─────────────────
CREATE TABLE users (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id),
  total      NUMERIC(12,2),
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user   ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status) WHERE status != 'completed';

INSERT INTO users (email, name) VALUES ('alice@co.com','Alice'),('bob@co.com','Bob');
INSERT INTO orders (user_id,total,status) VALUES (1,129.99,'pending'),(2,49.50,'completed');

-- ── Step 3: Create publication on source (PG14) ───────────────────
-- CREATE PUBLICATION upgrade_pub FOR ALL TABLES;

-- ── Step 4: Create subscription on target (PG16) ─────────────────
-- CREATE SUBSCRIPTION upgrade_sub
--   CONNECTION 'host=pg14-host dbname=appdb user=replicator password=...'
--   PUBLICATION upgrade_pub;

-- ── Step 5: Monitor lag ────────────────────────────────────────────
SELECT subname, received_lsn, latest_end_lsn,
       (received_lsn = latest_end_lsn) AS caught_up
FROM pg_stat_subscription;

-- ── Step 6: Cutover (once lag = 0) ────────────────────────────────
-- UPDATE app config → point DATABASE_URL to PG16
-- DROP SUBSCRIPTION upgrade_sub;  (on PG16)
-- DROP PUBLICATION upgrade_pub;   (on PG14)`,
  },

  // ─── DATABASE / SECURITY ──────────────────────────────────────────────────
  {
    slug: "postgres-row-level-security",
    starterSchema: `-- App: Multi-tenant SaaS — each tenant must only see their own data
-- Goal: Implement RLS so DB enforces isolation, not just application code

CREATE TABLE tenants (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'free'
);

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',
  UNIQUE (tenant_id, email)
);

CREATE TABLE documents (
  id         BIGSERIAL PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id   UUID REFERENCES users(id),
  title      TEXT NOT NULL,
  body       TEXT,
  is_public  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_docs_tenant ON documents(tenant_id);

INSERT INTO tenants VALUES
  ('11111111-0000-0000-0000-000000000001','Acme Corp','pro'),
  ('22222222-0000-0000-0000-000000000002','Beta LLC','free');

-- ── Enable RLS ────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;

-- ── Policy: tenants only see their own rows ───────────────────────
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY user_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- ── Set context per request (in application) ─────────────────────
-- SET LOCAL app.tenant_id = '11111111-0000-0000-0000-000000000001';
-- SELECT * FROM documents;  -- only returns Acme's docs

-- ── Test: try cross-tenant access ─────────────────────────────────
-- SET LOCAL app.tenant_id = '22222222-0000-0000-0000-000000000002';
-- SELECT * FROM documents;  -- should only return Beta LLC's docs`,
  },

  {
    slug: "column-encryption-at-rest",
    starterSchema: `-- Goal: Encrypt PII columns at the application level before storing
-- Using pgcrypto for in-DB encryption or application-layer AES-256

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE customers (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,          -- not encrypted (needed for lookup)
  name_enc    BYTEA,                         -- AES-256 encrypted
  ssn_enc     BYTEA,                         -- AES-256 encrypted
  dob_enc     BYTEA,                         -- AES-256 encrypted
  phone_enc   BYTEA,                         -- AES-256 encrypted
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE encryption_keys (
  id          SERIAL PRIMARY KEY,
  key_id      TEXT UNIQUE NOT NULL,
  algorithm   TEXT DEFAULT 'AES-256-GCM',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  rotated_at  TIMESTAMPTZ,
  is_active   BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_customers_email ON customers(email);

-- ── pgcrypto approach (DEK per row) ──────────────────────────────
-- Encrypt:
-- UPDATE customers SET name_enc = pgp_sym_encrypt('Alice Smith', 'master-key-from-vault')
-- WHERE id = 1;

-- Decrypt:
-- SELECT pgp_sym_decrypt(name_enc, 'master-key-from-vault') AS name
-- FROM customers WHERE email = 'alice@example.com';

-- ── Application-layer approach (preferred) ────────────────────────
-- const crypto = require('crypto');
-- const encrypt = (text, key) => {
--   const iv = crypto.randomBytes(12);
--   const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
--   const enc = Buffer.concat([cipher.update(text,'utf8'), cipher.final()]);
--   return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
-- };

-- ── Audit: find unencrypted PII ────────────────────────────────────
SELECT count(*) AS unencrypted FROM customers
WHERE name_enc IS NULL OR ssn_enc IS NULL;`,
  },

  {
    slug: "sql-injection-orm-audit",
    starterSchema: `-- Goal: Find and fix SQL injection vulnerabilities in ORM / raw query usage

CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT DEFAULT 'user',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE search_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT,
  query_text TEXT,
  result_count INT,
  ip_address TEXT,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (username, email, password_hash, role) VALUES
  ('alice', 'alice@co.com', 'hashed_pw_1', 'admin'),
  ('bob',   'bob@co.com',   'hashed_pw_2', 'user');

-- ── VULNERABLE code patterns to find and fix ──────────────────────

-- ✗ VULNERABLE: string concatenation
-- const query = "SELECT * FROM users WHERE username = '" + req.body.username + "'";
-- Payload: ' OR '1'='1  →  returns ALL users
-- Payload: '; DROP TABLE users;--  →  catastrophic

-- ✗ VULNERABLE: template literal in raw query
-- db.raw(\`SELECT * FROM users WHERE email = '\${email}'\`);

-- ✓ FIXED: parameterised query (node-postgres)
-- db.query('SELECT * FROM users WHERE username = $1', [req.body.username]);

-- ✓ FIXED: Prisma ORM (always parameterised)
-- prisma.users.findFirst({ where: { username: req.body.username } });

-- ✓ FIXED: if raw SQL is necessary, use tagged template:
-- import { sql } from 'drizzle-orm';
-- db.execute(sql\`SELECT * FROM users WHERE username = \${username}\`);

-- ── Audit queries: find raw string concat in codebase ─────────────
-- grep -rn "db.query.*\\+" --include="*.ts" src/
-- grep -rn "\\$execute.*\\$\\{" --include="*.ts" src/`,
  },

  {
    slug: "least-privilege-db-users",
    starterSchema: `-- Goal: One DB role per service, each with minimal permissions

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price       NUMERIC(10,2),
  stock_count INT DEFAULT 0
);

CREATE TABLE orders (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT NOT NULL,
  total      NUMERIC(12,2),
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  table_name TEXT,
  record_id  BIGINT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO products (name,price,stock_count) VALUES
  ('Widget',9.99,500),('Gadget',49.99,100);

-- ── Create least-privilege roles ──────────────────────────────────

-- API server: reads products, writes orders
CREATE ROLE api_service LOGIN PASSWORD 'change_me_api';
GRANT CONNECT ON DATABASE appdb TO api_service;
GRANT USAGE ON SCHEMA public TO api_service;
GRANT SELECT ON products TO api_service;
GRANT SELECT, INSERT, UPDATE ON orders TO api_service;
GRANT USAGE, SELECT ON SEQUENCE orders_id_seq TO api_service;

-- Analytics: read-only across all tables
CREATE ROLE analytics_reader LOGIN PASSWORD 'change_me_analytics';
GRANT CONNECT ON DATABASE appdb TO analytics_reader;
GRANT USAGE ON SCHEMA public TO analytics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_reader;

-- Auditor: append-only on audit_log
CREATE ROLE audit_writer LOGIN PASSWORD 'change_me_audit';
GRANT CONNECT ON DATABASE appdb TO audit_writer;
GRANT USAGE ON SCHEMA public TO audit_writer;
GRANT INSERT ON audit_log TO audit_writer;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO audit_writer;

-- ── Verify permissions ────────────────────────────────────────────
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('api_service','analytics_reader','audit_writer')
ORDER BY grantee, table_name;`,
  },

  {
    slug: "pgaudit-database-audit",
    starterSchema: `-- Goal: Audit all DDL, role changes, and sensitive table access with pgaudit

-- ── Setup (run as superuser) ──────────────────────────────────────
-- CREATE EXTENSION pgaudit;
-- ALTER SYSTEM SET pgaudit.log = 'ddl, role, read, write';
-- ALTER SYSTEM SET pgaudit.log_catalog = off;  -- skip pg_catalog noise
-- ALTER SYSTEM SET log_connections = on;
-- ALTER SYSTEM SET log_disconnections = on;
-- SELECT pg_reload_conf();

-- ── Application schema ────────────────────────────────────────────
CREATE TABLE payment_cards (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL,
  last_four   CHAR(4) NOT NULL,
  card_type   TEXT NOT NULL,
  exp_month   SMALLINT,
  exp_year    SMALLINT,
  token       TEXT UNIQUE NOT NULL  -- tokenized by payment provider
);

CREATE TABLE pii_data (
  id       SERIAL PRIMARY KEY,
  user_id  INT NOT NULL,
  ssn_hash TEXT,
  dob      DATE
);

-- ── Object-level audit on sensitive tables ────────────────────────
-- ALTER TABLE payment_cards SET (pgaudit.log = 'read, write');
-- ALTER TABLE pii_data        SET (pgaudit.log = 'read, write');

-- ── Tail audit log (PostgreSQL log file) ─────────────────────────
-- tail -f /var/log/postgresql/postgresql.log | grep AUDIT

-- ── Parse audit log into structured table ────────────────────────
CREATE TABLE audit_events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT,
  statement_id INT,
  substatement_id INT,
  object_type TEXT,
  object_name TEXT,
  command     TEXT,
  parameter   TEXT,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logged_at ON audit_events(logged_at DESC);
CREATE INDEX idx_audit_object     ON audit_events(object_name, command);`,
  },

  {
    slug: "db-credential-rotation",
    starterSchema: `-- Goal: Rotate DB password with zero application downtime

-- ── Strategy: dual-password window ───────────────────────────────
-- Phase 1: Add new password alongside old  (both work)
-- Phase 2: Deploy app with new password
-- Phase 3: Remove old password

CREATE TABLE credential_rotation_log (
  id          SERIAL PRIMARY KEY,
  service     TEXT NOT NULL,
  rotated_at  TIMESTAMPTZ DEFAULT NOW(),
  old_key_id  TEXT,
  new_key_id  TEXT,
  status      TEXT DEFAULT 'pending'  -- pending, complete, rolled_back
);

-- ── Phase 1: Create new role with new password ────────────────────
-- CREATE ROLE app_service_v2 LOGIN PASSWORD 'new-secure-password';
-- GRANT CONNECT ON DATABASE appdb TO app_service_v2;
-- GRANT USAGE ON SCHEMA public TO app_service_v2;
-- GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO app_service_v2;
-- GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO app_service_v2;

-- ── Phase 2: Update app config + rolling restart ──────────────────
-- kubectl set env deployment/api-server DB_USER=app_service_v2 DB_PASS=new-secure-password
-- kubectl rollout status deployment/api-server

-- ── Phase 3: Remove old role ──────────────────────────────────────
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_service_v1;
-- DROP ROLE app_service_v1;

-- ── Automated with Vault dynamic credentials ──────────────────────
-- vault write database/roles/app-role \
--   db_name=postgres \
--   creation_statements="CREATE ROLE..." \
--   default_ttl="1h" max_ttl="24h"
--
-- vault read database/creds/app-role  -- gets fresh user+pass every time

INSERT INTO credential_rotation_log (service,old_key_id,new_key_id)
VALUES ('api-server','app_service_v1','app_service_v2');`,
  },

  {
    slug: "data-masking-non-prod",
    starterSchema: `-- Goal: Mask PII when cloning production DB to staging/dev

CREATE TABLE users (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  ssn         TEXT,       -- PII, must be masked
  date_of_birth DATE,     -- PII, must be masked
  address     TEXT,       -- PII, must be masked
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id),
  total      NUMERIC(12,2),
  cc_last4   CHAR(4),    -- PII
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO users (email,full_name,phone,ssn,date_of_birth,address) VALUES
  ('alice@real.com','Alice Smith','555-1234','123-45-6789','1985-03-15','123 Main St, NY'),
  ('bob@real.com','Bob Jones','555-5678','987-65-4321','1990-07-22','456 Oak Ave, CA');

-- ── Masking script (run after pg_restore to staging) ─────────────
UPDATE users SET
  email       = 'user_' || id || '@masked.example.com',
  full_name   = 'Test User ' || id,
  phone       = '555-000-' || LPAD(id::TEXT, 4, '0'),
  ssn         = '000-00-' || LPAD(id::TEXT, 4, '0'),
  date_of_birth = '1970-01-01',
  address     = '1 Masked St, Test City, TC 00000';

UPDATE orders SET cc_last4 = '0000';

-- ── Verify no real PII remains ────────────────────────────────────
SELECT count(*) FROM users WHERE email NOT LIKE '%@masked.example.com';
SELECT count(*) FROM users WHERE ssn NOT LIKE '000-00-%';

-- ── Tool: Faker / Anonymizer for automated masking ───────────────
-- pip install postgresql-anonymizer
-- anon.init(); anon.anonymize_database();`,
  },

  {
    slug: "vault-db-secrets",
    starterSchema: `-- Goal: Use HashiCorp Vault to issue dynamic short-lived DB credentials

-- ── Vault setup ───────────────────────────────────────────────────
-- vault secrets enable database
-- vault write database/config/postgres \
--   plugin_name=postgresql-database-plugin \
--   allowed_roles="app-role" \
--   connection_url="postgresql://{{username}}:{{password}}@postgres:5432/appdb" \
--   username="vault_admin" \
--   password="vault_admin_pass"
--
-- vault write database/roles/app-role \
--   db_name=postgres \
--   creation_statements="CREATE ROLE {{name}} LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';
--     GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO {{name}};
--     GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO {{name}};" \
--   default_ttl="1h" max_ttl="24h"

-- ── Application schema ────────────────────────────────────────────
CREATE TABLE vault_lease_tracking (
  id          SERIAL PRIMARY KEY,
  lease_id    TEXT UNIQUE NOT NULL,
  db_role     TEXT NOT NULL,
  issued_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  service     TEXT
);

CREATE TABLE app_data (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL,
  value      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_data (key,value) VALUES ('config','example');

-- ── Fetch credentials in app ──────────────────────────────────────
-- const res = await vault.read('database/creds/app-role');
-- const { username, password } = res.data;
-- const pool = new Pool({ user: username, password, host: 'postgres', database: 'appdb' });
-- // Refresh before TTL expires:
-- setTimeout(() => pool.end() && reconnect(), (res.lease_duration - 60) * 1000);

-- ── Monitor active leases ─────────────────────────────────────────
-- vault list sys/leases/lookup/database/creds/app-role`,
  },

  {
    slug: "pitr-disaster-recovery",
    starterSchema: `-- Goal: Set up and test Point-in-Time Recovery (PITR) for Postgres

-- ── Enable WAL archiving (postgresql.conf) ────────────────────────
-- wal_level = replica
-- archive_mode = on
-- archive_command = 'aws s3 cp %p s3://my-wal-bucket/wal/%f'
-- archive_timeout = 60   -- seconds, force WAL segment rotation

-- ── Base backup ───────────────────────────────────────────────────
-- pg_basebackup -h localhost -U replicator -D /backups/base -Ft -z -P --wal-method=stream

-- ── Application schema (simulate data to recover) ─────────────────
CREATE TABLE financial_records (
  id          BIGSERIAL PRIMARY KEY,
  account_id  INT NOT NULL,
  amount      NUMERIC(14,2) NOT NULL,
  type        TEXT NOT NULL,
  description TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recovery_tests (
  id          SERIAL PRIMARY KEY,
  test_name   TEXT NOT NULL,
  target_time TIMESTAMPTZ NOT NULL,
  rows_before INT,
  rows_after  INT,
  success     BOOLEAN,
  tested_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO financial_records (account_id,amount,type,description) VALUES
  (1,10000,'deposit','Initial deposit'),
  (1,-250,'withdrawal','ATM withdrawal'),
  (2,5000,'deposit','Wire transfer');

-- ── recovery.conf / postgresql.conf (restore target) ─────────────
-- restore_command = 'aws s3 cp s3://my-wal-bucket/wal/%f %p'
-- recovery_target_time = '2024-06-15 14:30:00 UTC'
-- recovery_target_action = 'promote'

-- ── Verify recovery ────────────────────────────────────────────────
SELECT pg_last_xact_replay_timestamp() AS recovered_to;
SELECT count(*) FROM financial_records;  -- compare with expected count`,
  },

  {
    slug: "db-anomaly-detection-alert",
    starterSchema: `-- Goal: Detect anomalous DB access patterns (bulk reads, off-hours access, etc.)

CREATE TABLE users (
  id       SERIAL PRIMARY KEY,
  email    TEXT UNIQUE NOT NULL,
  role     TEXT DEFAULT 'user'
);

CREATE TABLE sensitive_records (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id),
  data       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE db_access_log (
  id            BIGSERIAL PRIMARY KEY,
  db_user       TEXT NOT NULL,
  client_addr   INET,
  query_type    TEXT,  -- SELECT, INSERT, UPDATE, DELETE
  table_name    TEXT,
  rows_affected INT,
  duration_ms   INT,
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_access_log_user_time ON db_access_log(db_user, logged_at DESC);
CREATE INDEX idx_access_log_table     ON db_access_log(table_name, logged_at DESC);

INSERT INTO users (email,role) VALUES ('alice@co.com','admin'),('bob@co.com','analyst');

-- ── Anomaly detection queries ─────────────────────────────────────

-- 1. Bulk read anomaly (> 10k rows in single query):
SELECT db_user, table_name, rows_affected, logged_at
FROM db_access_log
WHERE query_type = 'SELECT' AND rows_affected > 10000
ORDER BY logged_at DESC;

-- 2. Off-hours access (outside 8am-8pm):
SELECT db_user, table_name, logged_at
FROM db_access_log
WHERE EXTRACT(HOUR FROM logged_at AT TIME ZONE 'UTC') NOT BETWEEN 8 AND 20
ORDER BY logged_at DESC LIMIT 20;

-- 3. Unusual client IP:
SELECT client_addr, count(*) AS requests, max(logged_at)
FROM db_access_log
WHERE logged_at > NOW() - INTERVAL '1 hour'
GROUP BY client_addr
HAVING count(*) > 1000
ORDER BY requests DESC;`,
  },

  {
    slug: "db-network-isolation-k8s",
    starterSchema: `-- Goal: Restrict DB access to only authorised pods using K8s NetworkPolicy

-- ── NetworkPolicy YAML ────────────────────────────────────────────
-- apiVersion: networking.k8s.io/v1
-- kind: NetworkPolicy
-- metadata:
--   name: postgres-network-policy
--   namespace: production
-- spec:
--   podSelector:
--     matchLabels:
--       app: postgres
--   policyTypes:
--     - Ingress
--     - Egress
--   ingress:
--     - from:
--         - podSelector:
--             matchLabels:
--               db-access: "true"  # only pods with this label
--       ports:
--         - protocol: TCP
--           port: 5432
--   egress: []  # postgres sends no outbound traffic

-- ── Label authorised pods ─────────────────────────────────────────
-- kubectl label pod api-server-xxx db-access=true -n production
-- kubectl label pod worker-xxx    db-access=true -n production

-- ── Application schema ────────────────────────────────────────────
CREATE TABLE network_policy_audit (
  id          SERIAL PRIMARY KEY,
  pod_name    TEXT,
  namespace   TEXT,
  allowed     BOOLEAN,
  tested_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services (
  id        SERIAL PRIMARY KEY,
  name      TEXT UNIQUE NOT NULL,
  needs_db  BOOLEAN DEFAULT TRUE,
  label     TEXT  -- 'db-access=true' if needs_db
);

INSERT INTO services (name,needs_db,label) VALUES
  ('api-server', TRUE, 'db-access=true'),
  ('worker',     TRUE, 'db-access=true'),
  ('frontend',   FALSE, NULL),
  ('prometheus', FALSE, NULL);

-- ── Test connectivity ─────────────────────────────────────────────
-- kubectl exec -it api-server-xxx -- nc -zv postgres-svc 5432  # should succeed
-- kubectl exec -it frontend-xxx  -- nc -zv postgres-svc 5432  # should FAIL`,
  },

  {
    slug: "db-tls-enforcement",
    starterSchema: `-- Goal: Enforce TLS for all PostgreSQL connections; reject plaintext

-- ── postgresql.conf settings ──────────────────────────────────────
-- ssl = on
-- ssl_cert_file = 'server.crt'
-- ssl_key_file  = 'server.key'
-- ssl_ca_file   = 'root.crt'

-- ── pg_hba.conf: require SSL for all non-local connections ────────
-- # TYPE  DATABASE  USER  ADDRESS     METHOD
-- local   all       all               peer
-- host    all       all  0.0.0.0/0   reject    # reject plain TCP
-- hostssl all       all  0.0.0.0/0   scram-sha-256

-- ── Application schema ────────────────────────────────────────────
CREATE TABLE tls_connection_log (
  id          BIGSERIAL PRIMARY KEY,
  client_addr INET,
  ssl         BOOLEAN NOT NULL,
  ssl_version TEXT,
  ssl_cipher  TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Verify TLS on current connection ─────────────────────────────
SELECT ssl, version, cipher, bits, client_dn
FROM pg_stat_ssl
JOIN pg_stat_activity USING (pid)
WHERE pg_stat_activity.pid = pg_backend_pid();

-- ── Check all current connections for non-TLS ─────────────────────
SELECT a.pid, a.client_addr, a.usename, s.ssl, a.state
FROM pg_stat_activity a
LEFT JOIN pg_stat_ssl s USING (pid)
WHERE a.client_addr IS NOT NULL  -- exclude local socket
  AND (s.ssl IS FALSE OR s.ssl IS NULL)
ORDER BY a.client_addr;

-- ── Node.js connection with SSL required ─────────────────────────
-- const pool = new Pool({
--   host: 'db.prod.internal',
--   ssl: { rejectUnauthorized: true, ca: fs.readFileSync('root.crt') }
-- });`,
  },

  {
    slug: "backup-encryption-secure-storage",
    starterSchema: `-- Goal: Encrypt pg_dump backups with GPG and store in S3 with versioning

-- ── Backup script (backup.sh) ─────────────────────────────────────
-- #!/bin/bash
-- set -euo pipefail
-- DATE=$(date +%Y%m%d_%H%M%S)
-- BACKUP_FILE="appdb_\${DATE}.dump"
--
-- # Dump
-- pg_dump -Fc -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" > "/tmp/\${BACKUP_FILE}"
--
-- # Encrypt with GPG (recipient's public key)
-- gpg --recipient "backup@company.com" \
--     --output "/tmp/\${BACKUP_FILE}.gpg" \
--     --encrypt "/tmp/\${BACKUP_FILE}"
-- rm "/tmp/\${BACKUP_FILE}"
--
-- # Upload to S3 (versioned bucket)
-- aws s3 cp "/tmp/\${BACKUP_FILE}.gpg" \
--     "s3://company-db-backups/\${DATE:0:6}/\${BACKUP_FILE}.gpg" \
--     --sse aws:kms --sse-kms-key-id "$KMS_KEY_ID"
-- rm "/tmp/\${BACKUP_FILE}.gpg"

-- ── Backup manifest table ─────────────────────────────────────────
CREATE TABLE backup_manifest (
  id          SERIAL PRIMARY KEY,
  filename    TEXT UNIQUE NOT NULL,
  s3_key      TEXT NOT NULL,
  size_bytes  BIGINT,
  checksum    TEXT NOT NULL,  -- SHA256 of plaintext before encryption
  encrypted   BOOLEAN DEFAULT TRUE,
  verified    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO backup_manifest (filename,s3_key,size_bytes,checksum) VALUES
  ('appdb_20240615_020000.dump.gpg','202406/appdb_20240615_020000.dump.gpg',
   52428800,'abc123...');

-- ── Verify restore from backup ────────────────────────────────────
-- gpg --decrypt backup.dump.gpg > backup.dump
-- pg_restore -d verify_db backup.dump
-- SELECT count(*) FROM users;  -- compare with expected`,
  },

  {
    slug: "container-image-db-scanning",
    starterSchema: `-- Goal: Scan PostgreSQL container image for CVEs in CI/CD pipeline

-- ── Dockerfile (to be scanned) ───────────────────────────────────
-- FROM postgres:14.5         # ← should pin to specific digest
-- ENV POSTGRES_DB=appdb
-- ENV POSTGRES_USER=app
-- ENV POSTGRES_PASSWORD_FILE=/run/secrets/db_password
-- COPY init.sql /docker-entrypoint-initdb.d/

-- ── CI scanning step (GitHub Actions) ────────────────────────────
-- - name: Scan DB image for CVEs
--   uses: aquasecurity/trivy-action@master
--   with:
--     image-ref: postgres:14.5
--     format: sarif
--     output: trivy-results.sarif
--     severity: CRITICAL,HIGH
--     exit-code: 1   # fail CI on critical CVEs

-- ── Application schema ────────────────────────────────────────────
CREATE TABLE image_scan_results (
  id           SERIAL PRIMARY KEY,
  image_ref    TEXT NOT NULL,
  image_digest TEXT NOT NULL,
  scanner      TEXT NOT NULL,  -- 'trivy', 'grype', 'snyk'
  severity     TEXT NOT NULL,
  cve_id       TEXT,
  package      TEXT,
  fixed_in     TEXT,
  scanned_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scan_severity ON image_scan_results(severity, scanned_at DESC);

INSERT INTO image_scan_results (image_ref,image_digest,scanner,severity,cve_id,package,fixed_in)
VALUES
  ('postgres:14.5','sha256:abc...','trivy','HIGH','CVE-2023-1234','libssl','postgres:14.6'),
  ('postgres:14.5','sha256:abc...','trivy','CRITICAL','CVE-2023-5678','openssl','postgres:14.6');

-- ── Alert on critical findings ────────────────────────────────────
SELECT count(*) AS critical_cves FROM image_scan_results
WHERE severity = 'CRITICAL' AND scanned_at > NOW() - INTERVAL '24 hours';`,
  },

  // ─── AI + DATABASE (hybrid) ───────────────────────────────────────────────
  {
    slug: "semantic-search-pgvector",
    starterSchema: `-- Goal: Hybrid full-text + semantic search using pgvector

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE documents (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  source      TEXT,
  embedding   VECTOR(1536),  -- OpenAI text-embedding-3-small
  ts_vector   TSVECTOR GENERATED ALWAYS AS (
                to_tsvector('english', title || ' ' || body)
              ) STORED,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_docs_embedding   ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
CREATE INDEX idx_docs_ts          ON documents USING GIN (ts_vector);
CREATE INDEX idx_docs_title_trgm  ON documents USING GIN (title gin_trgm_ops);

INSERT INTO documents (title, body, source) VALUES
  ('Postgres Indexing Guide','B-tree indexes are default...','docs'),
  ('Vector Search with pgvector','Store and query embeddings...','blog'),
  ('RAG Architecture Patterns','Retrieval augmented generation...','research'),
  ('Chunking Strategies','Optimal chunk sizes for RAG...','blog');

-- ── Hybrid search query (combine BM25 + cosine similarity) ────────
-- WITH semantic AS (
--   SELECT id, 1 - (embedding <=> $query_vec::vector) AS sem_score
--   FROM documents ORDER BY embedding <=> $query_vec::vector LIMIT 50
-- ),
-- keyword AS (
--   SELECT id, ts_rank(ts_vector, websearch_to_tsquery('english',$query)) AS kw_score
--   FROM documents WHERE ts_vector @@ websearch_to_tsquery('english',$query)
-- )
-- SELECT d.id, d.title,
--   COALESCE(s.sem_score,0)*0.7 + COALESCE(k.kw_score,0)*0.3 AS score
-- FROM documents d
-- LEFT JOIN semantic s USING(id)
-- LEFT JOIN keyword  k USING(id)
-- WHERE s.id IS NOT NULL OR k.id IS NOT NULL
-- ORDER BY score DESC LIMIT 10;`,
  },

  {
    slug: "vector-db-document-dedup",
    starterSchema: `-- Goal: Deduplicate documents using cosine similarity of embeddings

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE raw_documents (
  id         BIGSERIAL PRIMARY KEY,
  source     TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  embedding  VECTOR(1536),
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of BIGINT REFERENCES raw_documents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dedup_runs (
  id             SERIAL PRIMARY KEY,
  threshold      NUMERIC(4,3) NOT NULL DEFAULT 0.95,
  dupes_found    INT DEFAULT 0,
  docs_processed INT DEFAULT 0,
  ran_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raw_docs_embedding ON raw_documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);
CREATE INDEX idx_raw_docs_dedup ON raw_documents(is_duplicate);

INSERT INTO raw_documents (source,title,body) VALUES
  ('web','Postgres Tips','How to optimise Postgres queries...'),
  ('rss','PostgreSQL Tips','How to optimize Postgres queries...'),  -- near-dup
  ('blog','Redis Caching','Using Redis to cache API responses...');

-- ── Find near-duplicates (cosine similarity > 0.95) ───────────────
-- SELECT a.id, b.id,
--        1 - (a.embedding <=> b.embedding) AS similarity
-- FROM raw_documents a
-- CROSS JOIN LATERAL (
--   SELECT id, embedding FROM raw_documents b
--   WHERE b.id > a.id
--   ORDER BY a.embedding <=> b.embedding
--   LIMIT 5
-- ) b
-- WHERE 1 - (a.embedding <=> b.embedding) > 0.95;

-- ── Mark duplicates ───────────────────────────────────────────────
-- UPDATE raw_documents SET is_duplicate = TRUE, duplicate_of = original_id
-- WHERE id IN (SELECT duplicate_id FROM ...);`,
  },

  {
    slug: "ai-query-generation-safe",
    starterSchema: `-- Goal: Build a safe NL→SQL generator that prevents injection and validates output

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  stock_count INT DEFAULT 0,
  rating      NUMERIC(3,2)
);

CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  parent_id INT REFERENCES categories(id)
);

CREATE TABLE query_log (
  id             BIGSERIAL PRIMARY KEY,
  natural_query  TEXT NOT NULL,
  generated_sql  TEXT,
  validated      BOOLEAN DEFAULT FALSE,
  executed       BOOLEAN DEFAULT FALSE,
  row_count      INT,
  error          TEXT,
  user_id        INT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name) VALUES ('Electronics'),('Books'),('Clothing');
INSERT INTO products (name,category,price,stock_count,rating) VALUES
  ('Laptop Pro','Electronics',999.99,50,4.5),
  ('Python Cookbook','Books',39.99,200,4.8),
  ('Running Shoes','Clothing',89.99,150,4.3);

-- ── Allowed tables whitelist ──────────────────────────────────────
-- const ALLOWED_TABLES = ['products','categories'];
-- const ALLOWED_OPERATIONS = ['SELECT'];

-- ── LLM prompt for safe SQL generation ───────────────────────────
-- System: You are a SQL generator. Only generate SELECT queries.
-- Only query these tables: products, categories.
-- Never use: DROP, DELETE, UPDATE, INSERT, TRUNCATE, ALTER, CREATE.
-- Always add LIMIT 100 unless explicitly asked for more.
-- Return ONLY the SQL, no explanation.

-- ── Validation (before execution) ────────────────────────────────
-- 1. Parse AST and verify operation = SELECT
-- 2. Check only whitelisted tables
-- 3. Run EXPLAIN (not EXECUTE) to validate syntax
-- 4. Check estimated rows < 10000
-- EXPLAIN SELECT name, price FROM products WHERE category = 'Electronics';`,
  },

  // ─── FRONTEND + DATABASE ──────────────────────────────────────────────────
  {
    slug: "data-table-server-side-sort",
    starterSchema: `-- Goal: Server-side sort, filter, and pagination for large data tables

CREATE TABLE employees (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  department  TEXT NOT NULL,
  title       TEXT NOT NULL,
  salary      NUMERIC(10,2),
  hire_date   DATE NOT NULL,
  status      TEXT DEFAULT 'active',
  email       TEXT UNIQUE NOT NULL
);

CREATE INDEX idx_emp_department ON employees(department);
CREATE INDEX idx_emp_status     ON employees(status);
CREATE INDEX idx_emp_hire_date  ON employees(hire_date DESC);
CREATE INDEX idx_emp_name       ON employees USING GIN (name gin_trgm_ops);

INSERT INTO employees (name,department,title,salary,hire_date,email) VALUES
  ('Alice Chen','Engineering','Senior Engineer',120000,'2021-03-01','alice@co.com'),
  ('Bob Kumar','Product','PM',110000,'2020-06-15','bob@co.com'),
  ('Carol Wu','Engineering','Staff Engineer',150000,'2019-01-10','carol@co.com'),
  ('Dave Smith','Design','UX Designer',95000,'2022-09-01','dave@co.com');

-- ── Parameterised sort + pagination (safe) ────────────────────────
-- IMPORTANT: column name cannot be parameterised — use allowlist
-- const ALLOWED_SORT_COLS = ['name','department','salary','hire_date'];
-- const col = ALLOWED_SORT_COLS.includes(req.query.sort) ? req.query.sort : 'name';
--
-- SELECT *, count(*) OVER() AS total_count
-- FROM employees
-- WHERE status = $1
--   AND ($2::text IS NULL OR department = $2)
-- ORDER BY {col} {dir}    -- col injected safely from allowlist
-- LIMIT $3 OFFSET $4;

-- ── Cursor-based pagination (for large tables) ────────────────────
-- SELECT * FROM employees
-- WHERE (hire_date, id) < ($last_hire_date, $last_id)
-- ORDER BY hire_date DESC, id DESC
-- LIMIT 50;`,
  },

  {
    slug: "form-autosave-database",
    starterSchema: `-- Goal: Autosave form drafts to DB with conflict resolution

CREATE TABLE form_drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type   TEXT NOT NULL,
  user_id     INT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  version     INT NOT NULL DEFAULT 1,
  last_saved  TIMESTAMPTZ DEFAULT NOW(),
  submitted   BOOLEAN DEFAULT FALSE,
  UNIQUE (form_type, user_id)  -- one draft per form per user
);

CREATE TABLE form_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type   TEXT NOT NULL,
  user_id     INT NOT NULL,
  data        JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO form_drafts (form_type, user_id, data) VALUES
  ('onboarding', 1, '{"step":2,"company":"Acme","size":"50-100"}'),
  ('job_application', 2, '{"position":"Engineer","cover_letter":"I am..."}');

-- ── Upsert draft (optimistic concurrency with version) ────────────
-- INSERT INTO form_drafts (form_type, user_id, data, version)
-- VALUES ($form_type, $user_id, $data::jsonb, 1)
-- ON CONFLICT (form_type, user_id) DO UPDATE
--   SET data = EXCLUDED.data,
--       version = form_drafts.version + 1,
--       last_saved = NOW()
--   WHERE form_drafts.version = $expected_version  -- optimistic lock
-- RETURNING version, last_saved;

-- ── Load draft on page mount ──────────────────────────────────────
SELECT data, version, last_saved FROM form_drafts
WHERE form_type = 'onboarding' AND user_id = 1 AND submitted = FALSE;`,
  },

  {
    slug: "realtime-dashboard-db",
    starterSchema: `-- Goal: Real-time metrics dashboard backed by Postgres + SSE

CREATE TABLE metrics (
  id         BIGSERIAL PRIMARY KEY,
  metric     TEXT NOT NULL,
  value      NUMERIC NOT NULL,
  labels     JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (recorded_at);

CREATE TABLE metrics_current PARTITION OF metrics
  FOR VALUES FROM (CURRENT_TIMESTAMP - INTERVAL '1 day') TO (UNBOUNDED);

CREATE TABLE alert_thresholds (
  metric     TEXT PRIMARY KEY,
  warning    NUMERIC,
  critical   NUMERIC
);

CREATE INDEX idx_metrics_metric_time ON metrics(metric, recorded_at DESC);

INSERT INTO alert_thresholds VALUES
  ('cpu_pct',70,90),('mem_pct',80,95),('error_rate',1,5);

INSERT INTO metrics (metric,value,labels) VALUES
  ('cpu_pct',  45.2, '{"host":"web-1"}'),
  ('mem_pct',  62.0, '{"host":"web-1"}'),
  ('req_count',1240, '{"endpoint":"/api/data"}'),
  ('error_rate',0.3, '{"service":"api"}');

-- ── Live aggregate (polled every 5s via SSE) ─────────────────────
SELECT
  metric,
  round(avg(value),2) AS avg_5m,
  round(max(value),2) AS max_5m,
  count(*) AS samples
FROM metrics
WHERE recorded_at > NOW() - INTERVAL '5 minutes'
GROUP BY metric;

-- ── NOTIFY on new critical metric ────────────────────────────────
-- CREATE OR REPLACE FUNCTION notify_critical() RETURNS trigger AS $$
-- BEGIN
--   IF NEW.value > (SELECT critical FROM alert_thresholds WHERE metric=NEW.metric) THEN
--     PERFORM pg_notify('alerts', row_to_json(NEW)::text);
--   END IF;
--   RETURN NEW;
-- END$$ LANGUAGE plpgsql;
-- CREATE TRIGGER trg_notify_critical AFTER INSERT ON metrics FOR EACH ROW EXECUTE FUNCTION notify_critical();`,
  },

  {
    slug: "search-typeahead-db",
    starterSchema: `-- Goal: Sub-100ms typeahead search backed by Postgres full-text + trigrams

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE products (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  sku         TEXT UNIQUE NOT NULL,
  category    TEXT NOT NULL,
  price       NUMERIC(10,2),
  active      BOOLEAN DEFAULT TRUE,
  search_vec  TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', unaccent(name) || ' ' || sku)
  ) STORED
);

CREATE INDEX idx_products_trgm   ON products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_products_ts     ON products USING GIN (search_vec);
CREATE INDEX idx_products_active ON products(active) WHERE active = TRUE;

INSERT INTO products (name,sku,category,price) VALUES
  ('Apple MacBook Pro 14"','MBP14-2023','Laptops',1999.99),
  ('Apple MacBook Air M2', 'MBA-M2-2023','Laptops',1099.99),
  ('Apple iPad Pro 12.9"','IPAD-PRO-129','Tablets',1099.99),
  ('Samsung Galaxy S24',  'SGS24-256','Phones',799.99),
  ('Sony WH-1000XM5',     'SONY-WH5','Audio',349.99);

-- ── Typeahead query (fast trigram prefix match) ───────────────────
SELECT id, name, sku, category, price
FROM products
WHERE active = TRUE
  AND name ILIKE $1 || '%'  -- prefix match: 'apple%'
ORDER BY similarity(name, $1) DESC
LIMIT 10;

-- ── Full search (trigram + FTS combined) ─────────────────────────
SELECT id, name, sku,
  similarity(name, $query) AS trgm_score,
  ts_rank(search_vec, websearch_to_tsquery('english', $query)) AS ts_score
FROM products
WHERE active = TRUE
  AND (name % $query OR search_vec @@ websearch_to_tsquery('english', $query))
ORDER BY trgm_score + ts_score DESC
LIMIT 20;`,
  },

  {
    slug: "virtual-list-large-dataset",
    starterSchema: `-- Goal: Efficiently paginate 1M+ rows for virtualised list rendering

CREATE TABLE transactions (
  id          BIGSERIAL PRIMARY KEY,
  account_id  INT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  currency    CHAR(3) DEFAULT 'USD',
  type        TEXT NOT NULL,  -- 'debit', 'credit'
  description TEXT,
  merchant    TEXT,
  status      TEXT DEFAULT 'completed',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_txn_account_time ON transactions(account_id, created_at DESC);
CREATE INDEX idx_txn_status       ON transactions(status) WHERE status != 'completed';
CREATE INDEX idx_txn_merchant     ON transactions USING GIN (merchant gin_trgm_ops);

-- Seed 1M rows
INSERT INTO transactions (account_id,amount,type,description,merchant,created_at)
SELECT
  (random()*1000+1)::INT,
  round((random()*1000)::NUMERIC,2),
  CASE WHEN random()>0.5 THEN 'debit' ELSE 'credit' END,
  'Transaction ' || i,
  CASE (i%5) WHEN 0 THEN 'Amazon' WHEN 1 THEN 'Uber' WHEN 2 THEN 'Netflix'
             WHEN 3 THEN 'Starbucks' ELSE 'Walmart' END,
  NOW() - (random() * 365 * interval '1 day')
FROM generate_series(1, 1000000) AS i;

-- ── Cursor pagination (stable, no OFFSET performance cliff) ───────
-- First page:
SELECT id, amount, type, description, merchant, created_at
FROM transactions
WHERE account_id = $account_id
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- Subsequent pages (cursor = last row's created_at + id):
-- SELECT ... WHERE account_id=$aid AND (created_at,id)<($cur_date,$cur_id)
-- ORDER BY created_at DESC, id DESC LIMIT 50;

-- ── Total count (approximate, fast) ──────────────────────────────
SELECT reltuples::BIGINT AS approx_count
FROM pg_class WHERE relname = 'transactions';`,
  },

  {
    slug: "offline-first-sync-db",
    starterSchema: `-- Goal: Sync offline-first client changes to server DB with conflict resolution

CREATE TABLE sync_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     TEXT NOT NULL,     -- device/client identifier
  user_id       INT  NOT NULL,
  collection    TEXT NOT NULL,     -- 'todos', 'notes', etc.
  data          JSONB NOT NULL,
  version       BIGINT NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted       BOOLEAN DEFAULT FALSE,
  server_seq    BIGINT GENERATED ALWAYS AS IDENTITY  -- monotonic server-side ordering
);

CREATE TABLE sync_checkpoints (
  user_id       INT NOT NULL,
  client_id     TEXT NOT NULL,
  last_seq      BIGINT NOT NULL DEFAULT 0,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id)
);

CREATE INDEX idx_sync_user_seq    ON sync_items(user_id, server_seq);
CREATE INDEX idx_sync_collection  ON sync_items(user_id, collection, updated_at DESC);
CREATE INDEX idx_sync_client      ON sync_items(client_id, updated_at DESC);

INSERT INTO sync_items (client_id,user_id,collection,data) VALUES
  ('device-A',1,'todos','{"title":"Buy milk","done":false}'),
  ('device-B',1,'todos','{"title":"Buy milk","done":true}');  -- conflict!

-- ── Pull: get changes since last sync ────────────────────────────
-- SELECT * FROM sync_items
-- WHERE user_id=$uid AND server_seq > $last_seq
-- ORDER BY server_seq LIMIT 500;

-- ── Push: upsert with last-write-wins ─────────────────────────────
-- INSERT INTO sync_items (id,client_id,user_id,collection,data,version,updated_at)
-- VALUES ($id,$client,$uid,$col,$data::jsonb,$version,NOW())
-- ON CONFLICT (id) DO UPDATE
--   SET data=EXCLUDED.data, version=EXCLUDED.version, updated_at=EXCLUDED.updated_at
--   WHERE sync_items.version < EXCLUDED.version;  -- LWW conflict resolution`,
  },

  // ─── BACKEND + DATABASE ───────────────────────────────────────────────────
  {
    slug: "graphql-api-dataloader",
    starterSchema: `-- Goal: GraphQL API with DataLoader to batch N+1 queries

CREATE TABLE authors (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  bio        TEXT
);

CREATE TABLE books (
  id         SERIAL PRIMARY KEY,
  author_id  INT REFERENCES authors(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  isbn       TEXT UNIQUE,
  published  DATE,
  genre      TEXT
);

CREATE TABLE reviews (
  id         SERIAL PRIMARY KEY,
  book_id    INT REFERENCES books(id) ON DELETE CASCADE,
  reviewer   TEXT NOT NULL,
  rating     INT CHECK (rating BETWEEN 1 AND 5),
  body       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_books_author ON books(author_id);
CREATE INDEX idx_reviews_book ON reviews(book_id);

INSERT INTO authors (name,email) VALUES
  ('Alice Writer','alice@books.com'),('Bob Author','bob@books.com');
INSERT INTO books (author_id,title,isbn,genre) VALUES
  (1,'GraphQL Mastery','978-0-001','Tech'),
  (1,'API Design Patterns','978-0-002','Tech'),
  (2,'The Great Query','978-0-003','Fiction');
INSERT INTO reviews (book_id,reviewer,rating,body) VALUES
  (1,'Carol',5,'Excellent!'),(1,'Dave',4,'Very good'),(2,'Eve',5,'A must read');

-- ── DataLoader batch query (books by author IDs) ──────────────────
-- SELECT * FROM books WHERE author_id = ANY($1::int[]);
-- Then group by author_id in application layer

-- ── DataLoader batch query (reviews by book IDs) ─────────────────
-- SELECT * FROM reviews WHERE book_id = ANY($1::int[]);

-- ── Without DataLoader: N+1 (bad) ────────────────────────────────
-- query { books { title author { name } reviews { rating } } }
-- → SELECT * FROM books
-- → for each book: SELECT * FROM authors WHERE id=?   (N queries)
-- → for each book: SELECT * FROM reviews WHERE book_id=? (N queries)`,
  },

  {
    slug: "event-sourcing-audit-log",
    starterSchema: `-- Goal: Event-sourced audit log with CQRS — immutable event stream

CREATE TABLE domain_events (
  id           BIGSERIAL PRIMARY KEY,
  event_id     UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type TEXT NOT NULL,  -- 'Order', 'User', 'Product'
  event_type   TEXT NOT NULL,    -- 'OrderPlaced', 'OrderShipped', etc.
  event_version INT NOT NULL DEFAULT 1,
  payload      JSONB NOT NULL,
  metadata     JSONB DEFAULT '{}',  -- actor, IP, trace_id
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sequence_num BIGINT GENERATED ALWAYS AS IDENTITY
);

CREATE INDEX idx_events_aggregate ON domain_events(aggregate_id, sequence_num);
CREATE INDEX idx_events_type      ON domain_events(event_type, occurred_at DESC);
CREATE INDEX idx_events_aggregate_type ON domain_events(aggregate_type, occurred_at DESC);

-- Read model (materialised view updated by event projector)
CREATE TABLE order_read_model (
  id           UUID PRIMARY KEY,
  status       TEXT NOT NULL,
  customer_id  UUID NOT NULL,
  total        NUMERIC(12,2),
  item_count   INT DEFAULT 0,
  placed_at    TIMESTAMPTZ,
  shipped_at   TIMESTAMPTZ,
  last_event   TEXT,
  last_event_at TIMESTAMPTZ
);

-- ── Sample events ──────────────────────────────────────────────────
INSERT INTO domain_events (aggregate_id,aggregate_type,event_type,payload) VALUES
  ('order-1','Order','OrderPlaced',
    '{"customer_id":"cust-1","items":[{"sku":"WDG","qty":2}],"total":19.98}'),
  ('order-1','Order','PaymentCaptured',
    '{"amount":19.98,"payment_method":"card","transaction_id":"txn-123"}'),
  ('order-1','Order','OrderShipped',
    '{"carrier":"FedEx","tracking":"1234567890","estimated_delivery":"2024-06-20"}');

-- ── Replay events to rebuild state ────────────────────────────────
SELECT event_type, payload, occurred_at
FROM domain_events WHERE aggregate_id='order-1'
ORDER BY sequence_num;`,
  },

  {
    slug: "fix-n-plus-1-queries",
    starterSchema: `-- Goal: Identify and fix N+1 queries in a social feed endpoint

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  id          BIGSERIAL PRIMARY KEY,
  author_id   INT REFERENCES users(id),
  content     TEXT NOT NULL,
  media_url   TEXT,
  published   BOOLEAN DEFAULT TRUE,
  like_count  INT DEFAULT 0,   -- denormalized for speed
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tags (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE post_tags (
  post_id INT REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INT REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_posts_author_time ON posts(author_id, created_at DESC);
CREATE INDEX idx_post_tags_post    ON post_tags(post_id);
CREATE INDEX idx_post_tags_tag     ON post_tags(tag_id);

INSERT INTO users (username,display_name) VALUES ('alice','Alice'),('bob','Bob'),('carol','Carol');
INSERT INTO posts (author_id,content) VALUES (1,'Hello world!'),(2,'Postgres tips'),(3,'GraphQL FTW');
INSERT INTO tags (name) VALUES ('tech'),('postgres'),('graphql');
INSERT INTO post_tags VALUES (1,1),(2,1),(2,2),(3,1),(3,3);

-- ── N+1 pattern (what the broken code does) ───────────────────────
-- posts = SELECT * FROM posts LIMIT 20;           (1 query)
-- for post in posts:
--   author = SELECT * FROM users WHERE id=post.author_id  (20 queries)
--   tags   = SELECT t.name FROM tags t JOIN post_tags pt ON... WHERE pt.post_id=post.id (20 queries)

-- ── Fix: single JOIN with JSON aggregation ────────────────────────
SELECT
  p.id, p.content, p.created_at,
  u.username, u.display_name,
  COALESCE(json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '[]') AS tags
FROM posts p
JOIN users u ON u.id = p.author_id
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id
WHERE p.published = TRUE
GROUP BY p.id, u.id
ORDER BY p.created_at DESC
LIMIT 20;`,
  },

  {
    slug: "debug-encoding-corruption",
    starterSchema: `-- Goal: Debug Unicode/encoding corruption in a data pipeline

CREATE TABLE raw_imports (
  id           BIGSERIAL PRIMARY KEY,
  source_file  TEXT NOT NULL,
  raw_content  TEXT,           -- original bytes as text
  encoding     TEXT,           -- detected encoding (e.g. 'UTF-8', 'latin-1')
  processed    BOOLEAN DEFAULT FALSE,
  error        TEXT,
  imported_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clean_records (
  id           BIGSERIAL PRIMARY KEY,
  import_id    BIGINT REFERENCES raw_imports(id),
  name         TEXT NOT NULL,
  description  TEXT,
  country      TEXT,
  normalized   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE encoding_errors (
  id           BIGSERIAL PRIMARY KEY,
  import_id    BIGINT REFERENCES raw_imports(id),
  column_name  TEXT,
  raw_value    BYTEA,          -- store as bytes to inspect
  error_type   TEXT,           -- 'mojibake', 'null_byte', 'invalid_utf8'
  detected_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sample corrupted data (Mojibake: UTF-8 read as Latin-1)
INSERT INTO raw_imports (source_file,raw_content,encoding) VALUES
  ('customers_fr.csv','NomÃ© PrÃ©nom','latin-1'),  -- "Nomé Prénom" corrupted
  ('suppliers_jp.csv','<garbled_shift_jis_bytes>','shift-jis');   -- Japanese garbled

-- ── Diagnose encoding ─────────────────────────────────────────────
SELECT id, raw_content,
  octet_length(raw_content) AS bytes,
  length(raw_content) AS chars,
  encode(raw_content::bytea, 'hex') AS hex_dump
FROM raw_imports;

-- ── Fix: re-encode in Python before insert ────────────────────────
-- text = open('file.csv','rb').read().decode('latin-1')
-- corrected = text.encode('utf-8').decode('utf-8')  # now properly UTF-8
-- Or: import chardet; enc = chardet.detect(raw)['encoding']`,
  },

  {
    slug: "debug-timezone-bug",
    starterSchema: `-- Goal: Debug timezone bugs in a scheduling/events application

CREATE TABLE scheduled_events (
  id           BIGSERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,   -- always store in UTC
  ends_at      TIMESTAMPTZ NOT NULL,
  timezone     TEXT NOT NULL,          -- user's local timezone label
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reminders (
  id           SERIAL PRIMARY KEY,
  event_id     BIGINT REFERENCES scheduled_events(id),
  remind_at    TIMESTAMPTZ NOT NULL,   -- UTC
  sent         BOOLEAN DEFAULT FALSE
);

-- ── Insert events in user's local timezone ────────────────────────
INSERT INTO scheduled_events (title,starts_at,ends_at,timezone) VALUES
  ('Team standup',
   '2024-06-15 09:00:00 America/New_York',
   '2024-06-15 09:30:00 America/New_York',
   'America/New_York'),
  ('EU sync',
   '2024-06-15 16:00:00 Europe/London',
   '2024-06-15 17:00:00 Europe/London',
   'Europe/London');

-- ── Bug: comparing without timezone awareness ─────────────────────
-- WRONG: SELECT * FROM scheduled_events WHERE starts_at::date = '2024-06-15';
-- This compares in server timezone, not user timezone!

-- ── Fix: always work in UTC, convert for display ──────────────────
SELECT
  title,
  starts_at AT TIME ZONE timezone AS local_start,  -- display in user tz
  starts_at,                                         -- store/compare in UTC
  timezone
FROM scheduled_events
WHERE starts_at >= '2024-06-15 00:00:00 UTC'
  AND starts_at <  '2024-06-16 00:00:00 UTC';

-- ── Debug: check server timezone ─────────────────────────────────
SHOW timezone;
SELECT NOW(), NOW() AT TIME ZONE 'America/New_York', NOW() AT TIME ZONE 'UTC';`,
  },
];

async function main() {
  console.log(`Seeding prerequisites for \${updates.length} database challenges...`);
  let ok = 0, skip = 0;
  for (const u of updates) {
    const result = await prisma.challenge.updateMany({
      where: { slug: u.slug, starterSchema: null },
      data:  { starterSchema: u.starterSchema },
    });
    if (result.count > 0) { ok++; console.log(`  ✓ \${u.slug}`); }
    else                   { skip++; console.log(`  - \${u.slug} (skipped — already has schema)`); }
  }
  console.log(`\nDone: \${ok} updated, \${skip} skipped.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
