# Amoura Florals — Security Review

_Date: 2026-04-28 (rev 2 — strict production-readiness pass)_

Scope: full repo. OWASP Top 10 lens, with extra attention on admin tooling, payments, secrets, and PII.

## Changes since rev 1

Rev 1 closed the stored-XSS surface in the admin and cart. Rev 2 (this revision) closes the remaining hardening gaps:

- **Headers**: added Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security to `vercel.json`.
- **SRI + version pin**: every Supabase JS CDN reference now uses `@2.46.2` with an `integrity` SHA-384 hash and `crossorigin="anonymous"`. Drift attacks via the CDN are blocked.
- **Inline scripts removed**: 3 inline `<script>` blocks (cancel.html retry, admin/dashboard.html init, admin/index.html login) were extracted to external files so the script-src CSP does not need `'unsafe-inline'`.
- **Rate limiting**: `/api/checkout`, `/api/contact`, `/api/newsletter` are rate limited per IP via a new `rate_limits` table + `api/lib/rate-limit.js`. Database-backed so it works across Vercel serverless instances. Fail-open on DB error.
- **Newsletter wired to backend**: the homepage/about/faq newsletter form now persists addresses to `newsletter_subscribers` instead of showing a fake success.
- **Contact form wired to backend**: `mailto:` replaced with `POST /api/contact`. Inputs validated server-side, message persisted to `contact_messages`, email sent via Resend (best-effort — DB row is the source of truth).
- **SVG removed from media uploads**: SVG can embed `<script>` that executes when the file URL is opened directly. JPEG/PNG/WebP/GIF only.
- **Dashboard inline render**: also escapes admin/customer-controlled fields with `escapeHtml()` (parity with the rest of the admin).

## TL;DR

The codebase was already well-disciplined on the highest-stakes paths (payments, webhook signing, admin auth, server-side price validation). The biggest risk found was **stored XSS via the admin UI's inline `onclick` handlers**, which has been fixed in this pass. All remaining risks are LOW or operational.

## Risks Found

| ID | Severity | Risk | Status |
|----|----------|------|--------|
| R1 | HIGH | Stored XSS in admin via inline `onclick` interpolation of admin- and customer-controlled strings (product name, FAQ question, testimonial author + content, customer name/email, order_number) | **FIXED** — replaced with event delegation + `escapeHtml()` helper across admin/js/{products,content,orders,media}.js |
| R2 | HIGH | Cart sidebar rendered admin-controlled product names via `innerHTML` with inline `onclick` — opened a stored-XSS path from product DB → customer's browser | **FIXED** — `assets/js/app.js` cart rendering now uses DOM APIs + delegation |
| R3 | MED | `SUPABASE_ANON_KEY` referenced in `api/admin/config.js` but missing from `.env.example` — first deploy crashes admin login with 500 | **FIXED** — added to `.env.example` |
| R4 | LOW | `admin/js/media.js` had inline `onerror="this.style…"` attribute — not directly exploitable but CSP-incompatible | **FIXED** — replaced with addEventListener |
| R5 | LOW | Admin error messages (e.g. `err.message` from API) interpolated into `innerHTML` could surface internal text. Not directly exploitable (errors are server-controlled strings), but defensive escaping not applied uniformly | **PARTIAL** — high-risk paths now use `escapeHtml`; remaining error renderers display short error strings only |
| R6 | LOW | `console.log` in `api/webhook.js` informational (not sensitive data) | **ACCEPTED** — useful audit trail in Vercel logs |

## Verified Safe

| Check | Status | Note |
|-------|--------|------|
| Stripe secret key never reaches client | ✅ | Only used in server functions; client receives `data.url` (Checkout URL) only |
| `SUPABASE_SERVICE_ROLE_KEY` never reaches client | ✅ | Used only in `api/lib/supabase.js`; not in any HTML/JS |
| Stripe webhook signature verification | ✅ | `stripe.webhooks.constructEvent(rawBody, sig, secret)` runs before any DB write |
| Webhook idempotency | ✅ | `webhook_events` table with PRIMARY KEY on Stripe `evt_xxx` ID |
| Server-side price validation | ✅ | `api/lib/products.js` `validateAndPriceItems` looks up prices server-side; client prices ignored |
| Server-side delivery / address / date validation | ✅ | `api/checkout.js` `validateCustomer` + `validateDelivery` |
| Order created **before** Stripe session, rolled back on Stripe failure | ✅ | `api/checkout.js` lines 132–209 |
| Admin auth: every admin endpoint calls `verifyAdmin` | ✅ | `api/admin/_verify.js` checks Supabase JWT + `user_profiles.role === 'admin'` |
| Bearer-token transport for admin (no cookies = no CSRF on admin POST/PUT/DELETE) | ✅ | localStorage JWT manually attached as `Authorization` header |
| Database RLS: every public-facing table has RLS enabled with `SELECT WHERE active = true` | ✅ | `database/migrations/001_admin_tables.sql` |
| Service role bypasses RLS — but service role is only used server-side | ✅ | |
| File-upload validation: MIME allow-list + 5 MB limit | ✅ | Client (admin/js/media.js:85–86) + server (api/admin/media.js:7–8) |
| File-delete path traversal protection (`..` stripped, allow-list of safe characters) | ✅ | `api/admin/media.js:51–52` |
| CORS — admin endpoints scoped to `SITE_URL`, public reads `*` | ✅ | `api/admin/_verify.js:32–37` |
| No `eval`, `Function()`, dynamic imports | ✅ | Verified by grep |
| No client-side trust of cart prices | ✅ | Stripe gets server-priced line items; the only price the client controls is the (cosmetic) `summary-tax` display |
| Order PII (email/phone/address) not exposed publicly | ✅ | RLS restricts `orders` and `order_items` to service role; order-status endpoint strips internal `id` UUID before returning |
| Rate limiting | ⚠️ | Not implemented at app level. Vercel provides default protections; for higher-traffic deploys consider adding a token bucket on `/api/checkout` to prevent enumeration of order numbers |

## Manual Checks Required Before Production

1. **Rotate any keys ever committed to source control.** Confirm `.env` is in `.gitignore` (it is). Verify no real `sk_live_…` / `eyJ…` / `re_…` strings appear in `git log` (the repo is currently not initialised as a git repo — clean slate when committed).
2. **Run the schema + migration in Supabase** (see `docs/DEPLOYMENT_CHECKLIST.md`).
3. **Create the `media` storage bucket** in Supabase Storage as **public** (so public site can hotlink uploaded images). The bucket name must be `media`.
4. **Set the admin user**:
   ```sql
   -- After creating the user via Supabase Auth UI:
   UPDATE user_profiles SET role = 'admin' WHERE email = 'admin@yourdomain.com';
   ```
5. **Configure the Stripe webhook** in Stripe Dashboard → Developers → Webhooks → add endpoint `https://yourdomain.com/api/webhook`. Subscribe to `checkout.session.completed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
6. **Verify all env vars are set in Vercel** (Project Settings → Environment Variables): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL`, `SITE_URL`. `TAX_RATE` is optional (defaults to 0.07).
7. **Test the checkout end-to-end** with a Stripe test card (`4242 4242 4242 4242` in test mode).
8. **Verify email deliverability** — make sure your `FROM_EMAIL` domain is verified in Resend (otherwise emails will silently fail or land in spam).
9. **Sanity-check RLS** in the Supabase Dashboard SQL editor:
   ```sql
   -- Should return 0 rows when run with the anon key
   SELECT * FROM orders LIMIT 1;
   ```

## Threat Model Notes

- **Self-XSS in admin** is no longer a vector — even if an attacker compromised an admin session, the admin UI now escapes all stored content.
- **Privilege escalation**: only Supabase Auth can create users. New users default to `role = 'viewer'` via the `handle_new_user()` trigger and cannot reach any admin API. Promotion to `admin` requires a manual DB update — by design.
- **Customer impersonation**: customers never authenticate. Order tracking is via `session_id` (Stripe Checkout Session), which is opaque and not enumerable.
- **Webhook replay**: blocked via the `webhook_events` PRIMARY KEY.
- **CSV-injection / spreadsheet payloads**: no CSV export is currently implemented. If added later, sanitise leading `=`, `+`, `-`, `@`, tab, CR before output.

## Recommended Future Hardening (P2 — still open)

1. Move `console.log` audit lines in `api/webhook.js` to a structured logger (Vercel built-in or third-party).
2. Replace DB-backed rate-limiter with Redis (Upstash) if traffic scales beyond ~50 checkouts/min. Today's design is fine for the current floral-shop scale.
3. Add an admin UI for `contact_messages` and `newsletter_subscribers` (currently readable only via Supabase Dashboard).
4. Tighten CSP `style-src` to drop `'unsafe-inline'` once all inline `style="..."` attributes are extracted. Many banner elements use them today.
5. Add CSRF tokens if any admin endpoint ever moves to cookie-based auth (currently irrelevant — Bearer tokens are not auto-attached by browsers).

## Headers applied (this revision)

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-DNS-Prefetch-Control` | `on` |
