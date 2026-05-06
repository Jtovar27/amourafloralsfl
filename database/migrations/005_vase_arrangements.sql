-- Amoura Florals — Migration 005: add 'vase-arrangements' category
-- Run AFTER 004_storage_bucket.sql.
-- Idempotent: DROP IF EXISTS guards the CHECK swap.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('bouquets','floral-boxes','vase-arrangements','balloons','gifts'));
