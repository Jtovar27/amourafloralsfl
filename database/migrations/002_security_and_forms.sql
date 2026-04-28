-- Amoura Florals — Migration 002: rate limiting + form storage
-- Run AFTER schema.sql and 001_admin_tables.sql
-- Idempotent: uses IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ── Rate limits ──────────────────────────────────────────────────────────────
-- Append-only attempt log used by /api/lib/rate-limit.js. The table grows fast
-- but is trimmed by `prune_rate_limits()` (called probabilistically on each insert).
-- The unique key per attempt is `key`, e.g. "checkout:1.2.3.4" or "contact:1.2.3.4".
CREATE TABLE IF NOT EXISTS rate_limits (
  id          BIGSERIAL    PRIMARY KEY,
  key         TEXT         NOT NULL,
  ts          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_ts ON rate_limits(key, ts DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ts     ON rate_limits(ts);

-- Prune attempts older than 24 hours. Called from JS with ~1% probability per
-- write so old data does not accumulate without a separate cron job.
CREATE OR REPLACE FUNCTION prune_rate_limits()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rate_limits WHERE ts < NOW() - INTERVAL '24 hours';
END;
$$;

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No public policies. Service role bypasses RLS, which is what /api uses.

-- ── Newsletter subscribers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT         UNIQUE NOT NULL,
  source     TEXT,                                -- e.g. "homepage", "faq"
  active     BOOLEAN      NOT NULL DEFAULT TRUE,  -- false = unsubscribed
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT newsletter_email_format CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

CREATE INDEX IF NOT EXISTS idx_newsletter_active     ON newsletter_subscribers(active);
CREATE INDEX IF NOT EXISTS idx_newsletter_created_at ON newsletter_subscribers(created_at DESC);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- No public policies. Subscriptions go through /api/newsletter, which uses the
-- service role on the server. Admin can list via a future endpoint if needed.

-- ── Contact messages ─────────────────────────────────────────────────────────
-- Persisted as a backup in case the email send fails or the inbox is missed.
CREATE TABLE IF NOT EXISTS contact_messages (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT         NOT NULL,
  last_name  TEXT,
  email      TEXT         NOT NULL,
  phone      TEXT,
  message    TEXT         NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
-- No public policies. Inserts go through /api/contact (service role).
