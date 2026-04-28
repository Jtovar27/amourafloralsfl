# Agent 08 — Environment & Config

## Scope reviewed
- `.env.example`, `.gitignore`
- `vercel.json`
- All `process.env.*` references in `api/`

## Required env vars (verified by source inspection)

| Var | Required | First reference | Notes |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | yes | `api/lib/stripe.js:8` | Stripe SDK init |
| `STRIPE_WEBHOOK_SECRET` | yes | `api/webhook.js:20` | Signature verification |
| `SUPABASE_URL` | yes | `api/lib/supabase.js:9`, `api/admin/config.js:10` | |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | `api/lib/supabase.js:10` | Server only — never expose |
| `SUPABASE_ANON_KEY` | yes | `api/admin/config.js:11` | **Was missing from `.env.example` — added in this pass** |
| `RESEND_API_KEY` | yes | `api/lib/email.js:6`, `141`, `155` | Optional at runtime — emails are skipped if missing |
| `FROM_EMAIL` | yes | `api/lib/email.js:10` | Has a default but should be set explicitly |
| `ADMIN_EMAIL` | yes | `api/lib/email.js:11` | Has a default but should be set explicitly |
| `SITE_URL` | yes | `api/checkout.js:186`, `api/admin/_verify.js:33` | Stripe redirects + admin CORS |
| `TAX_RATE` | optional | `api/checkout.js:8` | Defaults to `0.07` |

## Gaps fixed
- Added `SUPABASE_ANON_KEY` to `.env.example` with explanation. This was the only missing required var.

## .gitignore
Already covers `.env`, `.vercel`, `__pycache__/`, `.venv/`. Verified.

## vercel.json
Configures cleanUrls + 30s function timeout. No issues.

## Result: PASS — all required env vars now documented.
