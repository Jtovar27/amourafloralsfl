-- Amoura Florals — Migration 006: product gallery_images + size variants
-- Run AFTER 005_vase_arrangements.sql.
-- Idempotent: safe to re-run; ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT
-- IF EXISTS guard the constraint creates.

-- ── Products: additional gallery images (cover stays in image_url) ───────────
-- Each product has a primary cover image stored in the existing `image_url`
-- column. This new column holds ADDITIONAL images shown on the product detail
-- page after the cover. Stored as a JSONB array of Supabase Storage public URL
-- strings (each entry is a string URL, not an object) to keep the public
-- product listing endpoint cheap to read without an extra join.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Guarantee the column is always a JSON array (never object/scalar/null) so
-- downstream code can safely iterate without defensive type checks.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_gallery_images_is_array;
ALTER TABLE products
  ADD CONSTRAINT products_gallery_images_is_array
  CHECK (jsonb_typeof(gallery_images) = 'array');

-- ── Products: optional size variants ────────────────────────────────────────
-- Products can advertise a list of size variants (e.g. "Small", "Medium",
-- "Large") each with their own price override. Empty array means the product
-- has no size variants and is sold at base price (`products.price`). Each
-- entry is shaped like:
--   { "id": "v_<short>", "label": "<text>", "price_cents": <int> }
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_variants_is_array;
ALTER TABLE products
  ADD CONSTRAINT products_variants_is_array
  CHECK (jsonb_typeof(variants) = 'array');

-- ── Order items: snapshot of the variant selected at checkout ───────────────
-- Snapshotted (label + price_cents) rather than referenced so historical
-- orders stay stable even if the variant is later renamed or removed. NULL
-- means the product had no size variants at the time of purchase. Each entry
-- is shaped like: { "label": "<text>", "price_cents": <int> }
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_variant JSONB DEFAULT NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_selected_variant_is_object;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_selected_variant_is_object
  CHECK (selected_variant IS NULL OR jsonb_typeof(selected_variant) = 'object');
