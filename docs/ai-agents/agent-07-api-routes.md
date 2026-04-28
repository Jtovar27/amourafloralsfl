# Agent 07 — API Routes Audit

## Scope reviewed
All files under `api/`, plus how each is referenced from frontend code.

## Public endpoints

| Endpoint | Method | File | Behaviour |
|---|---|---|---|
| `/api/products[?category=]` | GET | `api/products.js` | Returns active products from `products` table, filtered by category if given. Cache: 60s s-maxage, 300s SWR. |
| `/api/faqs` | GET | `api/faqs.js` | Active FAQs ordered by `sort_order`. Cache 300s/600s. |
| `/api/testimonials` | GET | `api/testimonials.js` | Active testimonials. Cache 300s/600s. |
| `/api/content[?section=][?key=]` | GET | `api/content.js` | site_content KV. Cache 60s/300s. |
| `/api/checkout` | POST | `api/checkout.js` | Validates inputs server-side, prices items via `validateAndPriceItems`, inserts order, creates Stripe session, returns `{url}`. Rolls order back on Stripe failure. |
| `/api/order-status?session_id=` | GET | `api/order-status.js` | Looks up order by Stripe session ID, returns public-safe subset. Strips internal UUID before responding. |
| `/api/webhook` | POST | `api/webhook.js` | Verifies Stripe signature, idempotency-checks via `webhook_events`, marks order paid, sends customer + admin emails (errors don't block 200 response). |

## Admin endpoints

All require `Authorization: Bearer <jwt>` and `user_profiles.role = 'admin'`.

| Endpoint | Methods | File | Behaviour |
|---|---|---|---|
| `/api/admin/config` | GET | `api/admin/config.js` | Returns `{supabaseUrl, supabaseAnonKey}` so the admin login page can boot Supabase. |
| `/api/admin/dashboard` | GET | `api/admin/dashboard.js` | Stats + recent orders. Used by login flow as an admin-role gate. |
| `/api/admin/products` | GET POST PUT DELETE | `api/admin/products.js` | Full CRUD. DELETE supports `?archive=true` for soft-archive. Slug auto-generated from name. |
| `/api/admin/orders` | GET PUT | `api/admin/orders.js` | List with pagination + search + status filter. PUT updates `order_status` and `internal_notes`. |
| `/api/admin/content?type=` | GET POST PUT DELETE | `api/admin/content.js` | Routes by `type=faqs|testimonials|site_content`. Site content uses a batch update. |
| `/api/admin/media` | GET DELETE | `api/admin/media.js` | Lists files in the `media` bucket; DELETE has path-traversal sanitisation. Uploads happen client-side via Supabase Storage with the user's JWT. |

## Bugs found
None in the API layer itself. All endpoints properly:
- Return JSON errors with `error.message`.
- Set CORS headers (`SITE_URL` for admin, `*` for public reads).
- Handle OPTIONS preflight.
- Use consistent status codes (400 invalid input, 401 unauth, 403 forbidden, 404 not found, 405 method not allowed, 409 conflict, 500 server error).

## Missing features found
None for this scope. Could add a contact-form endpoint if the `mailto:` UX needs to be replaced.

## Verification
```
node --check api/*.js api/admin/*.js api/lib/*.js   # all OK
```

## Result: PASS — no API changes needed.
