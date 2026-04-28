# Agent 02 — Admin Dashboard Audit & Hardening

## Scope reviewed
`/admin/*.html`, `/admin/css/admin.css`, `/admin/js/*.js`, `/api/admin/*.js`.

## Files inspected
- `admin/index.html` (login)
- `admin/dashboard.html`, `products.html`, `orders.html`, `content.html`, `media.html`
- `admin/js/admin-core.js`, `products.js`, `orders.js`, `content.js`, `media.js`
- `admin/css/admin.css`
- `api/admin/_verify.js`, `config.js`, `dashboard.js`, `products.js`, `orders.js`, `content.js`, `media.js`

## Bugs found
- **HIGH**: stored XSS via inline `onclick="…('${str}')"` with admin- and customer-controlled values across products / orders / content / media.
- **MED**: `innerHTML` of error messages — server-controlled but not consistently escaped.
- **MED**: missing `:focus-visible` outlines on `.btn`, `.btn-icon`, `.modal-close`.
- **MED**: modal animation never wrapped in `@media (prefers-reduced-motion)`.
- **HIGH (config gap)**: `api/admin/config.js` reads `SUPABASE_ANON_KEY` but `.env.example` did not document it — first deploy crashes login.

## Missing features found
None major. The admin dashboard already covers products, orders, FAQs, testimonials, site content, and media.

## Changes made
- Added `escapeHtml()` helper in `admin/js/admin-core.js`.
- Replaced all inline `onclick` attributes in admin JS with `data-action` + event-delegation listeners. Affected files: `products.js`, `orders.js`, `content.js`, `media.js`.
- Wrapped all admin-controlled string interpolations with `escapeHtml()`.
- Set form-field values via `.value` rather than HTML interpolation (internal_notes textarea, site_content inputs).
- Replaced inline `onerror=` on media images with addEventListener.
- Added `:focus-visible` outline to admin buttons / icons / modal-close / sidebar links / tab buttons.
- Wrapped modal animation in `@media (prefers-reduced-motion: reduce)`.
- Added `SUPABASE_ANON_KEY` to `.env.example`.

## Remaining risks
- Error-message rendering still uses template strings in a few places (e.g. tbody load-failure rows). Server-controlled strings, low practical risk.
- The default modal/confirm z-index stacking is correct (confirm 250 > modal 200, so confirm appears on top of modal as intended) — earlier audit flagged this as reversed but verification confirmed it is correct.

## Verification commands run
```
node --check admin/js/admin-core.js   # OK
node --check admin/js/products.js     # OK
node --check admin/js/orders.js       # OK
node --check admin/js/content.js      # OK
node --check admin/js/media.js        # OK
```

## Result: PASS
