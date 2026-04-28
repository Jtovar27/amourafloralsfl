# Testing Report — 2026-04-28 (rev 2)

This report has been superseded by `docs/FINAL_QA_REPORT.md`, which captures the production-readiness pass. This file remains as the original test record.

## What was verified

### Static analysis
- ✅ `npm install` — 54 packages installed, no vulnerabilities reported (engine warning for Node 24 vs required 20.x is expected; production will run on 20.x via Vercel).
- ✅ `node --check` on all 28 JS files: all parse cleanly.
  - 8 server-side functions in `api/`
  - 7 admin endpoints in `api/admin/`
  - 4 server libs in `api/lib/`
  - 5 admin frontend scripts in `admin/js/`
  - 4 public frontend scripts in `assets/js/`

### Code-quality sweep
- ✅ No `TODO`, `FIXME`, `XXX`, or `HACK` markers in source code (`node_modules` excluded).
- ✅ No inline `onclick=` attributes in source (only in comments documenting the refactor that removed them).
- ✅ No `alert(` / `prompt(` / `console.debug` / `debugger;` left in production paths.
- ✅ `console.log` / `console.warn` only used for genuine audit / informational logging in `api/webhook.js` and `api/lib/email.js`.
- ✅ No real secrets in source — `.env.example` only contains placeholder values; `.env` is gitignored.
- ✅ No `href="#"` left in published HTML; the one remaining instance is in `admin/js/orders.js:38` which is a programmatically-generated link with `e.preventDefault()` in its delegated handler.

### Security checks
See `docs/SECURITY_REVIEW.md`.

Highlights:
- ✅ Stored XSS in admin via inline `onclick` template injection — **fixed**.
- ✅ Stored XSS in cart sidebar via product names — **fixed**.
- ✅ Stripe / Supabase service-role / Resend secrets never reach the client.
- ✅ Webhook signature verified before any DB write.
- ✅ Webhook idempotency via `webhook_events` PK.
- ✅ Server-side price validation (`validateAndPriceItems`).
- ✅ Admin auth enforced on every admin endpoint.
- ✅ RLS enabled on all tables.
- ✅ File-upload MIME + size limits (5 MB).
- ✅ Path-traversal protection on file delete.

### API endpoint inventory
Public:
- `GET /api/products[?category=]`
- `GET /api/faqs`
- `GET /api/testimonials`
- `GET /api/content[?section=][?key=]`
- `POST /api/checkout`
- `GET /api/order-status?session_id=`
- `POST /api/webhook` (Stripe-signed)

Admin (Bearer JWT + role=admin):
- `GET /api/admin/config`
- `GET /api/admin/dashboard`
- `GET|POST|PUT|DELETE /api/admin/products`
- `GET|PUT /api/admin/orders`
- `GET|POST|PUT|DELETE /api/admin/content?type={faqs|testimonials|site_content}`
- `GET|DELETE /api/admin/media`

### Env var inventory
| Var | Required | Where used |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | `api/lib/stripe.js` |
| `STRIPE_WEBHOOK_SECRET` | yes | `api/webhook.js` |
| `SUPABASE_URL` | yes | `api/lib/supabase.js`, `api/admin/config.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | `api/lib/supabase.js` |
| `SUPABASE_ANON_KEY` | yes | `api/admin/config.js` (sent to admin client) |
| `RESEND_API_KEY` | yes | `api/lib/email.js` |
| `FROM_EMAIL` | yes | `api/lib/email.js` |
| `ADMIN_EMAIL` | yes | `api/lib/email.js` |
| `SITE_URL` | yes | `api/checkout.js`, CORS in admin |
| `TAX_RATE` | optional (default 0.07) | `api/checkout.js` |

### Static-fallback resilience
Verified by code inspection:
- `assets/js/catalog.js` leaves the static cards in place if `/api/products` returns non-OK or empty.
- `assets/js/dynamic-content.js` leaves static FAQs / testimonials / announcement in place on API failure.

### Browser/UX checks (manual, recommended before launch)
The repo deploys as static HTML; some checks must be done in a real browser. Items marked **NOT RUN** were not exercisable from the audit environment (no Vercel runtime, no Stripe key) and are gated behind `docs/DEPLOYMENT_CHECKLIST.md` smoke tests.

| Check | Status |
|---|---|
| HTML pages render with valid markup | ✅ visual review of all 11 root + 6 admin HTML files |
| `script` and `link` references resolve | ✅ all referenced files exist in repo |
| Catalog hydrate from `/api/products` (live API) | NOT RUN — gated on Vercel + Supabase deployment |
| Stripe test checkout end-to-end | NOT RUN — gated on Stripe test keys + webhook |
| Mobile viewport rendering (320 / 375 / 768) | NOT RUN — manual; CSS reviewed by audit agent for known issues |
| Lighthouse / Pagespeed | NOT RUN |

## Tests not yet written

This codebase has no automated test suite. For a static-HTML site of this size, that is a reasonable choice — the highest-leverage tests are:

1. **Stripe webhook E2E** with a test event payload — would catch signature / idempotency regressions.
2. **`validateAndPriceItems` unit tests** — would lock down the server-side price validation against client tampering.

Both are mid-effort additions that can be done with Vitest + a single fixture. Out of scope for this pass.

## Result

**PASS** for static analysis, security review, and code-quality sweep.
**PARTIAL** for end-to-end / browser-rendering — those require a deployed environment (see `docs/DEPLOYMENT_CHECKLIST.md` § 4 "Smoke tests").
