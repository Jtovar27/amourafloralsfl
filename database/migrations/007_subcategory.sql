-- Amoura Florals — Migration 007: products.subcategory
-- Run AFTER 006_variants_and_gallery.sql.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

-- Optional bucket inside the parent category. Used today only when
-- category = 'gifts' to split Gifts (teddy-bears, helium-balloons,
-- chocolate) from Add-ons (baby-breath-letters, crowns, butterflies).
-- Free-form text so we can grow buckets without a schema change.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
