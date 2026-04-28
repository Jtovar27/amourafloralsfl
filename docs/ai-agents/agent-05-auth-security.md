# Agent 05 — Auth & Security

## Scope reviewed
- Admin auth: `admin/index.html`, `admin/js/admin-core.js`, `api/admin/_verify.js`.
- Payment security: `api/checkout.js`, `api/webhook.js`, `api/lib/stripe.js`.
- Secrets handling: `.env.example`, all `process.env.*` references in api/.
- File-upload security: `api/admin/media.js`, `admin/js/media.js`.
- XSS surface: all `innerHTML`, all `onclick` interpolation.
- CSRF surface: how admin POST/PUT/DELETE tokens are transmitted.

## Bugs found
- **HIGH**: stored XSS in admin via `onclick` interpolation (R1 in SECURITY_REVIEW.md).
- **HIGH**: stored XSS in cart sidebar via product names (R2).
- **HIGH**: `SUPABASE_ANON_KEY` env var not documented in `.env.example` despite being read by `api/admin/config.js` (R3).
- **LOW**: `onerror=` inline in media tile images (R4).
- **LOW**: default informational `console.log` in webhook (R6) — accepted, not sensitive data.

## Missing features found
- No CSP header configured in `vercel.json`. Recommended baseline noted in SECURITY_REVIEW.md.
- No SRI on the Supabase CDN script.
- Supabase JS UMD bundle pinned only to `@2`, allowing minor-version drift; package.json pins to `^2.46.2`.

## Changes made
All HIGH severity issues fixed (see SECURITY_REVIEW.md § "Risks Found"). LOW-severity items captured as recommended future hardening.

## Remaining risks
- Pre-production hardening items (CSP, SRI, version pin) are documented but not yet applied.
- Rate limiting at the application layer is not implemented.

## Verification commands run
```
grep -rn "onclick=" admin/ assets/ api/   # only matches in code comments now
node --check ...                            # all JS files OK
```

## Result: PASS — see `docs/SECURITY_REVIEW.md` for full detail.
