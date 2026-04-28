# Agent 01 — Repo Map

## Scope reviewed
Whole repo at `C:\Users\Jtova\OneDrive\Desktop\amourafloralsfl-main`.

## Files inspected
- `package.json`, `vercel.json`, `.gitignore`, `.env.example`
- All 11 root HTML pages
- `admin/*.html`, `admin/css/admin.css`, `admin/js/*.js`
- `api/*.js`, `api/admin/*.js`, `api/lib/*.js`
- `database/schema.sql`, `database/migrations/001_admin_tables.sql`
- `assets/css/{style,checkout}.css`, `assets/js/{app,checkout,success}.js`

## Architecture

**Stack:** Static HTML + Vercel Node 20 functions + Supabase + Stripe + Resend.

**Domain model:**
- `orders` (UUID, order_number, customer/recipient, delivery, totals in cents, payment + order status, Stripe IDs, internal_notes)
- `order_items` (FK to orders)
- `webhook_events` (idempotency)
- `products` (UUID, slug, price cents, category bouquets/floral-boxes/balloons/gifts, image_url, featured/active/sort)
- `faqs`, `testimonials`, `site_content` (KV), `user_profiles` (FK auth.users, role admin/viewer)

**Auth flow (admin):**
1. `/admin/index.html` → fetch `/api/admin/config` → `{supabaseUrl, supabaseAnonKey}`
2. Sign in via Supabase Auth → JWT in localStorage (`amoura_admin_session`)
3. JWT sent as Bearer to `/api/admin/*`
4. Server `verifyAdmin` validates JWT and checks `user_profiles.role === 'admin'`

**Checkout flow:**
1. Client builds cart in localStorage
2. POST `/api/checkout` with items + customer + delivery
3. Server validates inputs, prices items server-side, inserts order, creates Stripe session
4. Client redirected to Stripe-hosted checkout
5. On success → `/success?session_id=cs_...` polls `/api/order-status`
6. Stripe → POST `/api/webhook` → verify sig → mark paid → email customer + admin

## Bugs found
See `docs/PROJECT_AUDIT.md` § 3.

## Result: PASS — repo map produced.
