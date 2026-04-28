# Deployment Checklist

_Required before first production deploy. Steps are ordered._

## 1. External services

### Supabase

1. Create a new Supabase project.
2. Go to SQL Editor → New Query → paste and run `database/schema.sql`.
3. Run `database/migrations/001_admin_tables.sql`.
4. Run `database/migrations/002_security_and_forms.sql` (rate limits + newsletter + contact tables).
5. Storage → New bucket → name `media`, **public** (so the website can render uploaded images).
6. Storage → `media` → Policies → ensure the default policies allow:
   - `SELECT` for `anon` (public)
   - `INSERT` / `DELETE` for `authenticated` (admin)
   The defaults Supabase creates for a public bucket usually work.
7. Settings → API → copy these values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (NEVER expose this client-side)

### Stripe

1. Create a Stripe account (or use test mode for staging).
2. Developers → API keys → copy **Secret key** → `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → Add endpoint:
   - Endpoint URL: `https://yourdomain.com/api/webhook`
   - Events: `checkout.session.completed`
4. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`.

### Resend

1. Sign up at resend.com.
2. Add and verify a sending domain (matches the `FROM_EMAIL` you use).
3. API Keys → Create API key → copy → `RESEND_API_KEY`.

## 2. Vercel

1. Push the repo to GitHub.
2. Vercel → Add New → Project → import the repo.
3. Framework preset: **Other** (no build command). Output directory `.` (already set in `vercel.json`).
4. Project Settings → Environment Variables → add (Production + Preview):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `FROM_EMAIL`  (e.g. `Amoura Florals <orders@amouraflorals.com>`)
   - `ADMIN_EMAIL` (e.g. `amourafloralsco@gmail.com`)
   - `SITE_URL` (no trailing slash, e.g. `https://amourafloralsfl.vercel.app` or your custom domain)
   - `TAX_RATE` (optional, defaults to `0.07`)
5. Deploy.

## 3. Create the admin user

1. Visit your deployed site at `https://yourdomain.com/admin`.
2. The page tries to log in but you don't have an account yet — that's fine, leave it.
3. In Supabase Dashboard → Authentication → Users → "Add user" → "Create new user" with the admin email + password. Do NOT use the magic-link flow for the first admin (you need a password to log in to the admin panel).
4. In SQL Editor:
   ```sql
   UPDATE user_profiles
   SET role = 'admin'
   WHERE email = 'admin@yourdomain.com';
   ```
   The `user_profiles` row is created automatically by the `handle_new_user()` trigger when you created the user above.
5. Refresh the admin login page and sign in.

## 4. Smoke tests

| Test | Steps | Pass when |
|---|---|---|
| Public site loads | Visit `/` | Hero + nav + cart + footer render with no console errors |
| Catalog hydrates from DB | Visit `/shop`. Open DevTools → Network. | `/api/products` returns 200 with the seeded products |
| FAQ hydrates | Visit `/faq`. | `/api/faqs` returns 200; no console errors |
| Testimonials rotate | Visit `/`. Scroll to testimonials. | Auto-advance every ~5s; arrows work |
| Cart persists | Add an item → refresh | Item still in cart |
| Checkout (test mode) | Add item → proceed to checkout → fill form → use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC | Redirect to `/success?session_id=...`, order appears in admin Orders, customer receives confirmation email, admin email arrives |
| Webhook recorded | Stripe Dashboard → Webhooks → Recent attempts | 200 OK on `checkout.session.completed` |
| Cancel flow | Start checkout → click back arrow on Stripe page | Land on `/cancel`, cart preserved, "Try Again" returns to `/checkout` |
| Admin login | Visit `/admin`, sign in | Redirect to `/admin/dashboard`, stats show |
| Admin can edit | Edit a product name → save → refresh public site | New name appears |
| Admin role guard | Sign in as a non-admin user (one with `role = 'viewer'`) | "Access denied" message; redirected back to login |
| Contact form | Submit a contact form | Success message; row in `contact_messages`; email at `ADMIN_EMAIL` |
| Newsletter | Submit a newsletter email | Success state; row in `newsletter_subscribers` |
| Rate limit | Hit `/api/checkout` 11 times in 5 min from one IP (use `curl -X POST`) | 11th request returns 429 with `Retry-After` header |
| Media SVG rejection | Try to upload a `.svg` in admin/media | Toast error: "No valid images selected (JPEG, PNG, WebP, or GIF — max 5 MB each)" |

## 5. Verify security headers (post-deploy)

Once deployed, open any page in DevTools → Network → click the HTML response and confirm these response headers are present (set in `vercel.json`):
- `Content-Security-Policy: default-src 'self'; …`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

DevTools Console must show no CSP violations. If a violation appears, check `docs/FINAL_QA_REPORT.md` § "Remaining risks" and adjust the policy in `vercel.json`.

View Source on `/admin` and confirm the Supabase script tag has `integrity="sha384-..."` and `crossorigin="anonymous"`.

## 7. Final hardening (optional)

- Verify your custom domain in Vercel and switch `SITE_URL` to it.
- Switch Stripe to **live mode** keys when ready, and update the webhook to a live-mode endpoint (Webhooks → Production).

## 8. Post-deploy ops

- **Vercel logs**: Project → Deployments → Functions → tail logs to debug a failing webhook or checkout.
- **Supabase logs**: Database → Logs → API.
- **Resend logs**: dashboard → Logs to confirm emails delivered.
- **Stripe webhooks**: Dashboard → Developers → Webhooks → recent attempts.

## 9. Rollback

1. Vercel → Deployments → previous successful deploy → "Promote to Production".
2. If a DB migration was the cause: revert with a manual SQL down-migration. The current migrations are idempotent and additive (no destructive changes), so reverts are usually unnecessary.
