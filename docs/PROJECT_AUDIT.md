# Amoura Florals — Project Audit

_Date: 2026-04-28_
_Effort level: max_

## 1. Architecture Summary

**Type:** Static HTML site + Vercel serverless API
**Frontend:** 11 plain HTML pages (no framework), shared `assets/css/style.css` (~60 KB) and `assets/js/app.js` (~21 KB).
**Backend:** Node.js 20 serverless functions in `/api` (Vercel `@vercel/node` runtime, default Express-like signature).
**Database:** Supabase Postgres (orders, order_items, webhook_events, products, faqs, testimonials, site_content, user_profiles).
**Storage:** Supabase Storage (`media` bucket).
**Auth:** Supabase Auth + `user_profiles.role` check (admin/viewer).
**Payments:** Stripe Checkout (server-side session creation, webhook on `checkout.session.completed`).
**Email:** Resend (customer order confirmation + admin notification).
**Deploy:** Vercel (`vercel.json` defines `functions: { "api/**/*.js": { maxDuration: 30 } }`, `cleanUrls: true`).

### Folder layout

```
/                   public HTML pages (index, shop, bouquets, …)
/admin              admin dashboard HTML (login, dashboard, products, orders, content, media)
/admin/css /admin/js admin-only assets
/api                serverless functions (checkout, webhook, public reads, /admin protected writes)
/api/admin          admin-only endpoints (verifyAdmin guard via Bearer JWT)
/api/lib            shared modules (supabase, stripe, email, products)
/assets             public CSS, JS, images, logo
/database           schema.sql + migrations/001_admin_tables.sql
```

## 2. What Is Already Working

- Stripe Checkout flow (`api/checkout.js`): server-side price validation, order insert, Stripe session, success/cancel URLs.
- Stripe Webhook (`api/webhook.js`): signature verification, idempotency via `webhook_events` table, customer + admin emails.
- Public read APIs: `/api/products`, `/api/faqs`, `/api/testimonials`, `/api/content`, `/api/order-status` with caching headers.
- Admin auth: Bearer JWT → `auth.getUser()` → `user_profiles.role === 'admin'`.
- Admin CRUD: products, orders, FAQs, testimonials, site content, media list/upload/delete.
- Admin UI: login, dashboard, products, orders, content (3 tabs), media — full layout, modals, toasts, confirm dialogs, mobile sidebar.
- Cart: localStorage-backed, sidebar UI, add/remove/quantity controls.
- Email templates: branded HTML for customer confirmation + plain-text admin notification.
- Database: full schema with RLS policies, indexes, triggers, seed data.

## 3. What Is Incomplete / Broken

| ID | Severity | Issue | File(s) | Note |
|----|----------|-------|---------|------|
| P1 | HIGH | `/api/admin/config` references `SUPABASE_ANON_KEY` but `.env.example` is missing it | `api/admin/config.js`, `.env.example` | Admin login will return 500 on first run |
| P2 | HIGH | Stored XSS in admin via incomplete onclick escaping | `admin/js/products.js`, `content.js`, `orders.js` | Backslash-escapes only `'`, can be broken by `\` or `<script>` payload |
| P3 | HIGH | FAQ page is static HTML — won't reflect admin edits | `faq.html` | Admin tool is effectively useless; need to load from `/api/faqs` |
| P4 | HIGH | Homepage/about testimonials hardcoded — won't reflect admin edits | `index.html`, `about.html` | Same problem |
| P5 | HIGH | Catalog pages (shop, bouquets, balloons, floral-boxes, gifts) hardcoded — won't reflect admin product edits | `shop.html`, `bouquets.html`, etc. | Admin tool effectively useless for products |
| P6 | MED | `gifts.html` title says "Add-ons" not "Gifts" | `gifts.html` | UX inconsistency |
| P7 | MED | Bouquets/balloons/floral-boxes/gifts pages have no filter buttons (shop.html does) | category pages | Inconsistent UX |
| P8 | MED | Body has no padding-top for announcement bar — content can underlap header on small screens | `assets/css/style.css` | The `--ann-h` variable is not added to body padding |
| P9 | MED | Admin modal close & buttons lack `:focus-visible` | `admin/css/admin.css` | Accessibility |
| P10 | MED | Date picker icon on Firefox uses `-webkit-` only pseudo-element | `assets/css/checkout.css` | Cross-browser bug |
| P11 | MED | `cursor: none` applied globally to `*` | `assets/css/style.css:102` | Hides cursor on touch + accessibility devices unless JS loads |
| P12 | LOW | Console.log left in webhook (informational only) | `api/webhook.js` | Acceptable but noisy |
| P13 | LOW | Stat-num CSS rule duplicated 3× in style.css | style.css 1379, 1854, 2363 | Maintenance |
| P14 | LOW | Orphaned `.value-icon` class | style.css:1041 | Dead code |
| P15 | LOW | "Newsletter subscribe" form has no backend wired up | `index.html`, `about.html`, `app.js` | Front-end only fake-success — should be documented |
| P16 | LOW | "Contact" form uses `mailto:` link only (no backend) | `contact.html`, `app.js` | Acceptable but should be documented |

## 4. Critical Bugs

- **P1** — first-time deploys will hit a 500 on `/api/admin/config` and the admin login page won't load. Documenting `SUPABASE_ANON_KEY` is required.
- **P2** — admin can be XSS'd by inserting `<img src=x onerror=alert(1)>` into a product name, FAQ question, or testimonial. Since admins control these inputs, this is a self-XSS today, but if a viewer-role user is ever introduced or if a session is compromised, this becomes serious.
- **P3–P5** — the admin dashboard exists but has no effect on the public site. The whole admin tool's value depends on this.

## 5. Security Risks

| ID | Risk | Status |
|----|------|--------|
| S1 | XSS via admin onclick template injection | OPEN — see P2 |
| S2 | Service-role Supabase key never sent to client | ✅ OK — only used in server functions |
| S3 | Stripe secret never sent to client | ✅ OK |
| S4 | Webhook signature verified before processing | ✅ OK |
| S5 | Idempotency for webhook events | ✅ OK |
| S6 | Admin auth: every endpoint calls `verifyAdmin` | ✅ OK |
| S7 | Server-side price validation in checkout | ✅ OK (`validateAndPriceItems` ignores client prices) |
| S8 | RLS on all admin tables; service role bypasses | ✅ OK |
| S9 | Anon key exposed to client via `/api/admin/config` | ✅ OK (anon keys are designed to be public) |
| S10 | Public read RLS policies allow `SELECT WHERE active = true` | ✅ OK |
| S11 | CORS uses `SITE_URL` for protected admin endpoints, `*` for public reads | ✅ Acceptable |
| S12 | File upload restricted to image MIME + 5 MB | ✅ OK |
| S13 | Media DELETE path-sanitized against `..` | ✅ OK |
| S14 | Order PII (email, phone, address) only readable through service role | ✅ OK |
| S15 | Admin endpoints leak error stack traces? | ✅ OK — only `error.message` returned |

## 6. Missing Env Vars

Already in `.env.example`:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL`
- `SITE_URL`
- `TAX_RATE` (optional)

**MISSING but required:**
- `SUPABASE_ANON_KEY` — required by `api/admin/config.js` for the admin login page

## 7. Database / Schema Issues

- Schema is solid. Migration `001_admin_tables.sql` is idempotent and safe to re-run.
- Public products are seeded with UUID IDs but the static checkout fallback uses string IDs `'1'`-`'10'`. Today the catalog pages send integer-like string IDs, which match the static fallback in `api/lib/products.js`. **If catalog pages are ever made dynamic from `/api/products`, they will use UUIDs and the static fallback is no longer used. This is fine — the system already prefers DB lookups when `loadProductsFromDB()` returns rows.**
- No issues with RLS, indexes, or triggers.

## 8. Admin Dashboard Gaps

The admin dashboard is **substantially complete**. Remaining items:
- XSS hardening (P2)
- Focus-visible on close buttons (P9)
- No newsletter management (out of scope — newsletter form is FE-only)

## 9. Checkout / Payment Gaps

The checkout flow is **complete and production-ready**. Verifications:
- Server-side prices ✅
- Order rolled back on Stripe failure ✅
- Stripe session expires in 30 minutes ✅
- Webhook idempotency ✅
- Email failure does not break webhook (200 returned to Stripe) ✅
- Cart only cleared after `payment_status === 'paid'` confirmed via polling ✅
- No double-charging on refresh / webhook replay ✅

The `cancel.html` "Try Again" button correctly preserves cart state.

## 10. Recommended Implementation Plan

### Phase A — Block release (must-fix)
1. Add `SUPABASE_ANON_KEY` to `.env.example` (P1)
2. Fix admin XSS via event delegation + textContent rendering (P2)
3. Make `faq.html` load FAQs from `/api/faqs` (P3)
4. Make `index.html` and `about.html` testimonials load from `/api/testimonials` (P4)
5. Make catalog pages (shop, bouquets, balloons, floral-boxes, gifts) hydrate from `/api/products` (P5)
6. Fix `gifts.html` title (P6)

### Phase B — Polish (should-fix)
1. Add filter buttons to bouquets/balloons/floral-boxes/gifts pages (P7)
2. Body padding for announcement bar (P8)
3. Focus-visible on admin (P9)
4. Cross-browser date picker (P10)
5. Limit `cursor: none` to non-touch + non-keyboard (P11)

### Phase C — Documentation
1. README.md with deploy instructions
2. DEPLOYMENT_CHECKLIST.md
3. SECURITY_REVIEW.md
4. IMPLEMENTATION_SUMMARY.md
5. TESTING_REPORT.md

### Phase D — Verification
1. `npm install` succeeds
2. All JS files parse (`node --check`)
3. All HTML pages have matching script/css references
4. No remaining placeholder content
