-- Amoura Florals — Database Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Orders ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          TEXT        UNIQUE NOT NULL,
  customer_name         TEXT        NOT NULL,
  customer_email        TEXT        NOT NULL,
  customer_phone        TEXT        NOT NULL,
  recipient_name        TEXT,
  card_message          TEXT,
  delivery_method       TEXT        NOT NULL CHECK (delivery_method IN ('pickup','delivery')),
  delivery_date         DATE        NOT NULL,
  shipping_address      JSONB,
  special_instructions  TEXT,
  subtotal              INTEGER     NOT NULL,          -- cents
  shipping_amount       INTEGER     NOT NULL DEFAULT 0,
  tax_amount            INTEGER     NOT NULL DEFAULT 0,
  total_amount          INTEGER     NOT NULL,
  currency              TEXT        NOT NULL DEFAULT 'usd',
  payment_provider      TEXT        NOT NULL DEFAULT 'stripe',
  payment_status        TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','failed','refunded')),
  order_status          TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (order_status IN ('pending','confirmed','processing','completed','cancelled')),
  stripe_session_id     TEXT        UNIQUE,
  stripe_payment_intent TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Order Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   TEXT        NOT NULL,
  product_name TEXT        NOT NULL,
  unit_price   INTEGER     NOT NULL,   -- cents
  quantity     INTEGER     NOT NULL CHECK (quantity > 0),
  line_total   INTEGER     NOT NULL,   -- cents
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Webhook Events (idempotency) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT        PRIMARY KEY,   -- Stripe event ID (evt_xxx)
  event_type   TEXT        NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON order_items(order_id);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- The service role key (used server-side only) bypasses RLS.
-- These policies prevent accidental public read access.
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- No public access — all reads/writes go through the service role key on the server.
-- Add policies here if you later build a Supabase Auth-protected admin dashboard.
