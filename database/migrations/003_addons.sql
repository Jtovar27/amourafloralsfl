-- Amoura Florals — Migration 003: optional product add-ons
-- Run AFTER schema.sql, 001_admin_tables.sql, and 002_security_and_forms.sql
-- Idempotent: uses ADD COLUMN IF NOT EXISTS / DROP IF EXISTS guards.

-- ── Products: optional add-ons catalog ───────────────────────────────────────
-- Each product can advertise a list of optional paid add-ons (e.g. "Add a card",
-- "Premium wrap"). Stored inline as JSONB to avoid an extra join on the public
-- product listing endpoint. Each entry is shaped like:
--   { "id": "<uuid|slug>", "name": "<text>", "price_cents": <int>, "active": <bool optional> }
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS addons JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Guarantee the column is always a JSON array (never object/scalar/null) so
-- downstream code can safely iterate without defensive type checks.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_addons_is_array;
ALTER TABLE products
  ADD CONSTRAINT products_addons_is_array
  CHECK (jsonb_typeof(addons) = 'array');

-- ── Order items: snapshot of add-ons selected at checkout ───────────────────
-- Snapshotted (name + price_cents) rather than referenced so historical orders
-- remain stable even if the parent product's add-on catalog later changes.
-- Each entry is shaped like: { "name": "<text>", "price_cents": <int> }
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_addons JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_selected_addons_is_array;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_selected_addons_is_array
  CHECK (jsonb_typeof(selected_addons) = 'array');
