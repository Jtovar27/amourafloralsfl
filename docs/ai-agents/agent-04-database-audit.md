# Agent 04 — Database & Schema Audit

## Scope reviewed
`database/schema.sql`, `database/migrations/001_admin_tables.sql`. Cross-checked with all server queries in `api/**/*.js`.

## Bugs found
None. The schema is well-structured and idempotent.

## Schema summary

### Core (schema.sql)
- `orders` — UUID PK, `order_number` UNIQUE, customer / delivery / amounts in cents, `payment_status` + `order_status` CHECK constraints, Stripe session ID UNIQUE, auto-updated `updated_at` trigger.
- `order_items` — UUID PK, FK to `orders` with `ON DELETE CASCADE`, line totals in cents, qty CHECK > 0.
- `webhook_events` — Stripe event ID PK for idempotency.

### Admin (001_admin_tables.sql)
- `products` — UUID, slug UNIQUE, price in cents (CHECK > 0), category CHECK in (bouquets, floral-boxes, balloons, gifts), active/featured/sort_order.
- `faqs`, `testimonials` — straightforward CRUD tables with sort_order + active.
- `site_content` — KV store keyed by `key`, with `section` for grouping in the admin UI.
- `user_profiles` — FK to `auth.users`, role CHECK in (admin, viewer); auto-created on user signup via trigger `handle_new_user()`.
- Adds `internal_notes TEXT` to `orders`.

### Indexes
- `orders`: stripe_session_id, customer_email, payment_status, created_at DESC.
- `order_items`: order_id.
- `products`: active, category, sort_order.
- `faqs`, `testimonials`: active, sort_order.

### RLS
- All public-facing tables have RLS enabled.
- Public read policies: `SELECT WHERE active = true` on products, faqs, testimonials.
- `site_content` is fully public-readable.
- `user_profiles` has owner-self read/update only.
- `orders` / `order_items` / `webhook_events` have NO public policies — service role bypasses RLS for legitimate server access.

## Migration safety
Both files are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `CREATE OR REPLACE`). Safe to re-run.

## Seed data
`001_admin_tables.sql` seeds: 14 site_content keys, 8 FAQs (matching the static HTML), 3 testimonials (matching the static HTML), 10 products (matching the static catalog with prices in cents).

## Remaining risks
- Products are seeded with new UUIDs, but the static catalog HTML uses string IDs `'1'`-`'10'`. The runtime `api/lib/products.js` falls back to a static map keyed by `'1'`-`'10'` when the DB is unreachable. Once the DB is reachable, IDs are UUIDs. Cart contents persist across page loads in localStorage — if you replace the DB seed with new IDs after a customer adds items, that cart will still resolve through the static fallback if the DB lookup fails for those IDs.
- This is documented in `docs/IMPLEMENTATION_SUMMARY.md` § "Known limitations".

## Result: PASS
