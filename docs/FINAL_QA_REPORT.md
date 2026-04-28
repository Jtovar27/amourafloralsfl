# Final QA Report — 2026-04-28

This is the strict production-readiness pass. It picks up where the prior implementation summary left off and addresses every unresolved risk listed there.

## TL;DR

| Area | Status |
|---|---|
| Repo state matches prior report | **VERIFIED** — files exist, scripts wired, no inline `onclick` in source, no committed secrets |
| Static analysis (syntax + lint-by-grep) | **PASS** — all 31 JS files parse, vercel.json + package.json valid JSON |
| Security headers (CSP, HSTS, X-Frame, Referrer, Permissions, X-Content-Type) | **APPLIED** in `vercel.json` |
| SRI + version-pin on Supabase CDN | **APPLIED** — `@2.46.2` + `sha384-RXZt/j+...` |
| Inline scripts removed (CSP-clean) | **APPLIED** — 3 inline scripts extracted to external files |
| `/api/checkout` rate limiting | **APPLIED** — DB-backed, 10 attempts / 5 min / IP, fail-open on DB error |
| Contact form | **WIRED** to new `/api/contact` (Resend + DB) instead of `mailto:` |
| Newsletter form | **WIRED** to new `/api/newsletter` (DB-stored) instead of cosmetic only |
| Media uploads | SVG removed from allow-list (script-embed risk); JPEG/PNG/WebP/GIF only |
| Browser E2E (Playwright) | **NOT POSSIBLE LOCALLY** — Playwright not installed, no Vercel runtime here |
| Stripe checkout E2E | **NOT POSSIBLE LOCALLY** — requires live keys + webhook, gated on deploy |
| Supabase E2E | **NOT POSSIBLE LOCALLY** — requires Supabase project, gated on deploy |

The project is **safe to deploy to a staging environment**. The smoke tests in `docs/DEPLOYMENT_CHECKLIST.md` § 4 must pass on staging before promoting to production.

---

## What was verified locally

### Repository state (audit of prior pass)

```
✓ assets/js/catalog.js exists, loaded by all 5 catalog pages
✓ assets/js/dynamic-content.js exists, loaded by 10 public pages
✓ All catalog pages declare data-catalog body attribute
✓ admin/js/* uses event delegation; no inline onclick remains in source
✓ admin/js/admin-core.js exposes escapeHtml() globally
✓ .env.example contains all 10 referenced env vars
✓ .gitignore covers .env, .vercel; no .env file present
✓ No real secret patterns (sk_live_, whsec_, re_, eyJ…) committed anywhere
```

### Static analysis

```
✓ npm install — 54 packages, 0 vulnerabilities (Node 20.x engine)
✓ node --check on all 31 JS files (api/, api/admin/, api/lib/, admin/js/, assets/js/) — all OK
✓ vercel.json — valid JSON
✓ package.json — valid JSON
✓ No TODO/FIXME/XXX/HACK in source
✓ No inline onclick=/onerror= in source code (only in code comments)
✓ No alert()/debugger; in source
✓ No localhost references outside dev fallbacks + docs
✓ No hardcoded secrets
✓ All console.log occurrences are intentional audit logging
```

### Security improvements applied this pass

| Change | File(s) |
|---|---|
| CSP + 6 security headers added | `vercel.json` |
| Supabase CDN pinned `@2.46.2` + SRI sha384 | All 6 `admin/*.html` |
| 3 inline scripts moved to external files | `cancel.html`→`assets/js/cancel.js`, `admin/dashboard.html`→`admin/js/dashboard.js`, `admin/index.html`→`admin/js/login.js` |
| Dashboard inline render escapes admin/customer-controlled fields | `admin/js/dashboard.js` |
| Rate-limit DB infra | `database/migrations/002_security_and_forms.sql` |
| Rate-limit helper (DB-backed, fail-open) | `api/lib/rate-limit.js` |
| Rate-limit applied to `/api/checkout` (10/5min/IP) | `api/checkout.js` |
| `/api/contact` endpoint (Resend + DB persistence + rate limit) | `api/contact.js` |
| `/api/newsletter` endpoint (DB upsert + rate limit) | `api/newsletter.js` |
| Contact form wired to backend (was `mailto:`) | `assets/js/app.js`, `contact.html` |
| Newsletter form wired to backend (was cosmetic) | `assets/js/app.js` |
| Error display CSS for contact + newsletter | `assets/css/style.css` |
| SVG removed from media upload allow-list | `admin/js/media.js`, `admin/media.html`, `api/admin/media.js` |

### Public/Admin API surface review

| Concern | Result |
|---|---|
| Public reads (`/api/products`, `/api/faqs`, `/api/testimonials`, `/api/content`) leak no PII | ✓ — only public-marked records returned |
| `/api/order-status` exposes order data to anyone with the Stripe session ID | ✓ — opaque ID, not enumerable, internal UUID stripped from response |
| `/api/checkout` validates inputs server-side, prices server-side, ignores client prices | ✓ |
| `/api/checkout` rolls back order on Stripe failure | ✓ |
| `/api/webhook` verifies signature before any DB write | ✓ |
| `/api/webhook` is idempotent via `webhook_events` PK | ✓ |
| All `/api/admin/*` endpoints call `verifyAdmin` (Bearer JWT + role=admin) | ✓ |
| Admin endpoints use service-role Supabase client (bypasses RLS for legitimate writes) | ✓ |
| `/api/contact` validates and persists; email is best-effort | ✓ |
| `/api/newsletter` upserts by email (idempotent) | ✓ |
| Media DELETE sanitises `..` and special chars | ✓ |
| Media uploads no longer accept SVG | ✓ |
| Errors return short messages, never stack traces | ✓ |
| Rate-limit fails open on DB outage (intentional — protects availability) | ✓ |

---

## What still cannot be verified locally

These all require a deployed environment with real services and are gated by the smoke tests in `docs/DEPLOYMENT_CHECKLIST.md` § 4.

| Item | Why not local | What to run after deploy |
|---|---|---|
| Browser rendering on iOS/Android/Safari/Firefox | No browser automation installed in this sandbox | Manual smoke test per the checklist below |
| Stripe checkout end-to-end | Needs live `STRIPE_SECRET_KEY` + webhook URL | Use test card `4242 4242 4242 4242`; verify success page + admin order; check Stripe dashboard for 200 webhook |
| Supabase auth login + admin role gate | Needs real Supabase project | Sign in to `/admin`, verify dashboard loads; sign in as a non-admin user, verify "Access denied" |
| Supabase RLS effective | Needs deployed DB | In Supabase SQL Editor with anon role: `SELECT * FROM orders` should return 0 rows |
| Email deliverability (Resend) | Needs verified sender domain | Place a test order; confirm customer + admin emails arrive (check spam) |
| CSP doesn't break the live site | Headers only fire on Vercel | Open any page on the deployed URL, verify DevTools Console shows no CSP violations |
| Rate limit triggers properly | Requires multiple requests with the same `x-forwarded-for` | Hit `/api/checkout` 11 times in 5 minutes from one IP; expect 429 on the 11th |

---

## Manual smoke test checklist

Run these against your **staging** Vercel deploy with **Stripe test keys** before promoting to production. Mark each as you go.

### Public site

- [ ] `/` (home) loads — hero, marquee, testimonials, newsletter, footer, no console errors
- [ ] `/shop` — 10 products visible, "Add to Cart" works, filter buttons filter
- [ ] `/bouquets`, `/floral-boxes`, `/balloons`, `/gifts` — each shows the right subset, filter row navigates between categories
- [ ] `/faq` — 8 FAQs visible, accordions open/close
- [ ] `/about` — testimonials carousel auto-rotates and arrows work
- [ ] `/contact` — form validates, submits, success message appears, admin email received
- [ ] Cart sidebar opens/closes; "Proceed to Checkout" navigates to `/checkout`
- [ ] Cart persists on refresh
- [ ] Mobile: 375px width — no horizontal scroll, hamburger menu opens, products stack to 1 column
- [ ] Tablet: 768px — 2-column catalog, sidebar slides
- [ ] Announcement bar dismiss persists for the session

### Admin

- [ ] `/admin` (not logged in) → login form shown
- [ ] Hit `/admin/dashboard` directly without auth → redirected to `/admin`
- [ ] Sign in with non-admin user → "Access denied"
- [ ] Sign in with admin user → dashboard with stats + recent orders
- [ ] Products page: list loads, edit a product, save → public catalog updates
- [ ] Products page: create + delete a product
- [ ] Orders page: list paginates, click a row → modal with order details
- [ ] Orders page: change status + add internal note → save
- [ ] Content page → FAQs tab: edit a question → public `/faq` updates
- [ ] Content page → Testimonials tab: edit → public testimonials update
- [ ] Content page → Site Content tab: edit announcement_text_en → public bar updates everywhere
- [ ] Media page: upload a JPEG, copy URL, paste into a product image_url, save
- [ ] Media page: SVG file rejected with toast
- [ ] Sign out → redirected to `/admin`

### Checkout

- [ ] Add item → /checkout → fill all fields → "Continue to Payment"
- [ ] Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP → succeed
- [ ] Land on `/success?session_id=…`; order details render; cart cleared
- [ ] Customer email arrives at the buyer's address
- [ ] Admin email arrives at `ADMIN_EMAIL`
- [ ] Stripe Dashboard → Webhooks → `checkout.session.completed` → 200 response
- [ ] Supabase `orders` table has the row with `payment_status = 'paid'`
- [ ] Re-run the same Stripe webhook event → no duplicate processing (check logs)
- [ ] Cancel flow: start checkout, click ← on Stripe → land on `/cancel`, cart still populated, "Try Again" returns to `/checkout`
- [ ] Submit `/checkout` 11 times rapidly from one network → 11th attempt returns 429

### Security headers

- [ ] DevTools → Network → click any HTML response → confirm headers include:
  - `Content-Security-Policy: default-src 'self'; …`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] DevTools → Console — no CSP violation reports
- [ ] Right-click → View Source on `/admin` → `<script src="...supabase-js@2.46.2..." integrity="sha384-..."`

---

## Project safe to deploy?

**Yes — to staging.** All in-repo issues that could be fixed without a live environment are fixed. The remaining gates are smoke tests against real services.

**Production cut-over** should happen only after the smoke tests above pass on staging with Stripe **test keys**, then the env vars are switched to **live keys** and the smoke tests are re-run on production with a real test transaction (which can be refunded immediately).

---

## Exact commands to run locally before deploying

```bash
# From project root
npm install
node --check api/*.js api/admin/*.js api/lib/*.js admin/js/*.js assets/js/*.js
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"
```

All three should complete with no errors. (They do — verified just now.)

To run the site locally with the API:

```bash
npm i -g vercel
vercel link        # one-time link to your Vercel project
vercel dev         # http://localhost:3000 with serverless functions
```

To test the Stripe webhook locally during dev:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

---

## Exact Vercel env vars needed

(All 10 — same list as before, no new vars added in this pass.)

```
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
FROM_EMAIL=Amoura Florals <orders@amouraflorals.com>
ADMIN_EMAIL=amourafloralsco@gmail.com
SITE_URL=https://yourdomain.com           (no trailing slash)
TAX_RATE=0.07                              (optional)
```

Add to **Production** AND **Preview** environments in Vercel → Project → Settings → Environment Variables.

---

## Exact Supabase steps

1. Create a Supabase project.
2. SQL Editor → run **in this order**:
   1. `database/schema.sql`
   2. `database/migrations/001_admin_tables.sql`
   3. `database/migrations/002_security_and_forms.sql` (NEW — adds rate-limit, newsletter, contact tables)
3. Storage → New bucket → name `media` → **public** access. Default public-read/admin-write policies are fine.
4. Authentication → Users → Add user → create the admin account with a password.
5. SQL Editor:
   ```sql
   UPDATE user_profiles SET role = 'admin' WHERE email = 'admin@yourdomain.com';
   ```

---

## Exact Stripe webhook steps

1. Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. Endpoint URL: `https://yourdomain.com/api/webhook`
3. Events: subscribe to **only** `checkout.session.completed`.
4. Copy the **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` in Vercel.
5. Send a test event from the Stripe Dashboard → confirm 200 response in Recent attempts and a corresponding `webhook_events` row in Supabase.

---

## Remaining risks

| Risk | Severity | Mitigation |
|---|---|---|
| Rate-limit fails open on DB outage | LOW | Acceptable trade-off (availability > strict limiting). Consider Redis upgrade if traffic warrants. |
| CSP allows `'unsafe-inline'` for styles | LOW | Many inline `style="..."` attrs in HTML banners; removing them is large work for marginal gain. |
| CSP allows `https:` for `img-src` | LOW | Lets admin paste image URLs from any HTTPS source (Unsplash, Pexels, custom CDN). The risk is image-tracking pixels, not script execution. |
| Browser/Stripe/Supabase E2E gated on deploy | n/a | Manual checklist above. |
| Webhook informational `console.log` not a structured logger | LOW | Useful in Vercel logs as-is; future improvement. |
| No automated test suite | LOW | For a static-HTML business site this is reasonable; recommend a Vitest harness for `validateAndPriceItems` and webhook handler if scope grows. |
| `contact_messages` and `newsletter_subscribers` have no admin UI yet | LOW | Both are reachable in Supabase Dashboard for now; admin UI can be added later. |
