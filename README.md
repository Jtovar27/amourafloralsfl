# Amoura Florals

Handcrafted floral arrangements in Orlando, Florida — public storefront, admin dashboard, and Stripe-powered checkout.

## Stack

- **Frontend:** Static HTML + plain CSS + plain JS (no framework, no build step)
- **Backend:** Node.js 20 serverless functions on Vercel (`/api/*`)
- **Database:** Supabase (Postgres) — orders, products, FAQs, testimonials, site content, user roles
- **Storage:** Supabase Storage (`media` bucket) for product images
- **Auth:** Supabase Auth + admin-role check (admin only)
- **Payments:** Stripe Checkout (server-side session creation + webhook)
- **Email:** Resend (customer order confirmation + admin notification)

## Local development

```bash
# Install dependencies
npm install

# Copy and fill the env file
cp .env.example .env

# Pull Vercel CLI to run the API functions locally
npm i -g vercel
vercel link        # one-time link to the Vercel project
vercel dev         # runs static files + serverless functions on http://localhost:3000
```

Notes:
- `vercel dev` is the recommended local server because the API endpoints under `/api` are Vercel functions. A plain static server (e.g. `python -m http.server`) will only show the public HTML; checkout will fail.
- Stripe webhooks need a public URL. Use `stripe listen --forward-to localhost:3000/api/webhook` while developing.

## Project layout

```
/                  Public HTML pages (index, shop, bouquets, …)
/admin             Admin dashboard (login, dashboard, products, orders, content, media)
/api               Serverless functions (public reads + Stripe + admin-protected writes)
/api/admin         Admin-only endpoints (Bearer JWT + role check)
/api/lib           Shared modules (supabase, stripe, email, products)
/assets            Public CSS, JS, images, logo
/database          schema.sql + migrations/001_admin_tables.sql
/docs              Audit, security review, deployment checklist, agent reports
```

## Deploying

See **`docs/DEPLOYMENT_CHECKLIST.md`** for the full step-by-step.

Short version:
1. Push to GitHub, import to Vercel.
2. Add all env vars from `.env.example` to Vercel.
3. Run `database/schema.sql` then `database/migrations/001_admin_tables.sql` then `database/migrations/002_security_and_forms.sql` in Supabase SQL Editor.
4. Create the `media` storage bucket (public) in Supabase Storage.
5. Add a Stripe webhook → `https://yourdomain.com/api/webhook`, subscribe to `checkout.session.completed`, copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Sign up an admin user in Supabase Auth, then `UPDATE user_profiles SET role = 'admin' WHERE email = ...;`.

## Admin

Visit `https://yourdomain.com/admin` to log in.

The admin dashboard supports:
- **Dashboard** — totals, revenue, recent orders.
- **Products** — full CRUD, category filter, archive vs. delete, image URL paste.
- **Orders** — paginated list, search, status update, internal notes.
- **Content** — FAQs, testimonials, and the site_content key/value editor (announcement bar, hero text, footer hours, social URLs, etc.).
- **Media** — upload/list/delete files in the Supabase `media` bucket; copy public URLs to paste into product `image_url`.

The public site progressively enhances when admin content changes:
- `/api/products` → catalog pages
- `/api/faqs` → FAQ page
- `/api/testimonials` → home and about pages
- `/api/content?section=announcement` → announcement bar text + visibility on every page

If the API is unavailable, the static fallback content remains visible.

## Public APIs

| Endpoint | Method | Description |
|---|---|---|
| `/api/products?category=` | GET | Active products (optionally filtered) |
| `/api/faqs` | GET | Active FAQs |
| `/api/testimonials` | GET | Active testimonials |
| `/api/content?section=` | GET | Site content key/value |
| `/api/checkout` | POST | Create order + Stripe session (rate-limited 10 / 5 min / IP) |
| `/api/contact` | POST | Persist contact message + email admin (rate-limited 5 / 10 min / IP) |
| `/api/newsletter` | POST | Persist newsletter signup (rate-limited 5 / 10 min / IP) |
| `/api/order-status?session_id=` | GET | Look up order by Stripe session |
| `/api/webhook` | POST | Stripe webhook (signature verified, idempotent) |

## Admin APIs

All require `Authorization: Bearer <supabase_access_token>` and the user must have `user_profiles.role = 'admin'`.

| Endpoint | Methods |
|---|---|
| `/api/admin/config` | GET (returns supabaseUrl + anon key) |
| `/api/admin/dashboard` | GET |
| `/api/admin/products` | GET / POST / PUT / DELETE |
| `/api/admin/orders` | GET / PUT |
| `/api/admin/content?type=faqs|testimonials|site_content` | GET / POST / PUT / DELETE |
| `/api/admin/media` | GET / DELETE (uploads happen client-side via Supabase Storage) |

## Documentation

- **Project audit:** `docs/PROJECT_AUDIT.md`
- **Security review:** `docs/SECURITY_REVIEW.md`
- **Deployment checklist:** `docs/DEPLOYMENT_CHECKLIST.md`
- **Implementation summary:** `docs/IMPLEMENTATION_SUMMARY.md`
- **Testing report:** `docs/TESTING_REPORT.md`
- **Final QA report (production-readiness pass):** `docs/FINAL_QA_REPORT.md`
- **Per-agent reports:** `docs/ai-agents/`

## Contact

Business: [@amourafloralsfl](https://www.instagram.com/amourafloralsfl/)
Email: amourafloralsco@gmail.com
WhatsApp: +1 (321) 295-9217
