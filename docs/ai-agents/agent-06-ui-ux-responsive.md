# Agent 06 — UI / UX / Responsiveness

## Scope reviewed
All public HTML pages, `assets/css/style.css`, `assets/css/checkout.css`, `admin/css/admin.css`.

## Bugs found
- **HIGH**: `* { cursor: none !important; }` applied unconditionally on touch devices and assistive-tech contexts.
- **HIGH**: announcement bar offset (`--ann-h`) was applied to `#site-header` but inner pages without a hero had no top padding, causing the first content block to underlap the nav on small screens.
- **HIGH**: `:focus-visible` outlines missing on `.btn`, `.nav-link`, `.cart-btn`, `.filter-btn`, `.faq-question`, `.t-arrow`, admin buttons, modal-close.
- **HIGH**: Firefox-only — date picker calendar icon was webkit-only pseudo-element; Firefox users had to click into an unmarked field.
- **MED**: form input focus showed only border-colour change, no outline (WCAG AA fail for sighted keyboard users).
- **MED**: placeholder colour `#c0bbb5` failed WCAG AA contrast on white in checkout form.
- **MED**: modal animation in admin had no `prefers-reduced-motion` guard.
- **LOW**: `.value-icon` orphaned class in style.css (never referenced).
- **LOW**: `.stat-num` rule duplicated three times in style.css.
- **LOW**: bouquets/balloons/floral-boxes/gifts pages had no filter navigation (only shop.html did).

## Changes made
- `style.css`: cursor scoped to `@media (pointer: fine)`; `prefers-reduced-motion` falls back to native cursor; `body.has-ann-bar.inner-page` now gets `padding-top: var(--ann-h)`; focus-visible rules added.
- `checkout.css`: cross-browser date icon, focus outline on inputs, placeholder colour fix.
- `admin.css`: focus-visible rules on `.btn`, `.btn-icon`, `.modal-close`, `.sb-link`, `.tab-btn`; modal animation respects reduced motion.
- Catalog category pages (bouquets, floral-boxes, balloons, gifts) gained a filter row with `<a class="filter-btn">` links navigating across pages, with the active page highlighted.

## Items intentionally left
- `.value-icon` orphan and `.stat-num` duplicate are LOW priority dead-code; not changed in this pass to avoid CSS noise. Documented for future cleanup.
- `cursor: none` is preserved as a brand choice on fine-pointer devices.

## Remaining risks
- Cross-browser visual QA (Safari, Firefox, mobile Chrome) gated behind a deployed environment — see `docs/DEPLOYMENT_CHECKLIST.md` § 4 smoke tests.
- iOS Safari 100vh quirk (modal `max-height: 90vh`) noted but not exercised.

## Result: PASS — improvements applied. Visual verification deferred to deploy.
