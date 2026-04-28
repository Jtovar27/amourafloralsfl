# Agent 10 — Deployment Readiness

## Scope reviewed
`vercel.json`, `package.json`, `.env.example`, `.gitignore`, all top-level config; deploy-related references in HTML.

## Bugs found / blockers
- **BLOCKER (FIXED)**: `SUPABASE_ANON_KEY` missing from `.env.example` would cause 500 on `/api/admin/config` on first deploy → admin login broken.

## Vercel config
`vercel.json`:
- `outputDirectory: "."` — correct for static-root deploy.
- `cleanUrls: true` — good for `/about` vs `/about.html`.
- `trailingSlash: false` — consistent.
- `functions: { "api/**/*.js": { maxDuration: 30 } }` — appropriate for Stripe latency.

No build command needed; this is a static-deploy project.

## Node version
`package.json` pins `engines.node = "20.x"`. Vercel runtime should match.

## Production checklist (summary; full version in DEPLOYMENT_CHECKLIST.md)
- [ ] Run `database/schema.sql` and `database/migrations/001_admin_tables.sql` in Supabase
- [ ] Create `media` bucket (public) in Supabase Storage
- [ ] Add all env vars (10 variables — see `.env.example`)
- [ ] Configure Stripe webhook to `https://yourdomain.com/api/webhook`, subscribe to `checkout.session.completed`
- [ ] Verify Resend sender domain
- [ ] Create admin user, set `role = 'admin'` in `user_profiles`
- [ ] Run smoke tests (DEPLOYMENT_CHECKLIST.md § 4)

## Recommended hardening before live mode
1. Add CSP / security headers via `vercel.json` `headers` block.
2. Pin Supabase JS UMD version in `admin/*.html` from `@2` to `@2.46.2`.
3. Switch Stripe to live keys, redo webhook setup.
4. Verify cleanUrls work for `/admin` (Vercel may serve `/admin/index.html`).

## Verification
```
npm install            ✓
node --check (all)     ✓
```

## Result: PASS — repo is ready for staging deploy. Live deployment gated on the manual checklist in `docs/DEPLOYMENT_CHECKLIST.md`.
