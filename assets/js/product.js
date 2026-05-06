/* ═══════════════════════════════════════════════════════
   AMOURA FLORALS — product.js
   Public product detail page hydrator.
   Reads ?id=<uuid> from the URL, fetches /api/products?id=,
   renders gallery / variants / addons / qty, and dispatches
   the cart entry through the shared bridge (window helper
   or 'amoura:add-to-cart' custom event).
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── DOM ─────────────────────────────────────────────
  var loadingEl   = document.getElementById('product-loading');
  var errorEl     = document.getElementById('product-error');
  var detailEl    = document.getElementById('product-detail');

  var mainImgEl   = document.getElementById('product-main-img');
  var thumbsEl    = document.getElementById('product-gallery-thumbs');

  var catTagEl    = document.getElementById('product-category-tag');
  var titleEl     = document.getElementById('product-title');
  var priceEl     = document.getElementById('product-price-display');
  var descEl      = document.getElementById('product-description');

  var variantsWrapEl = document.getElementById('product-variants');
  var variantsListEl = document.getElementById('product-variants-list');

  var addonsWrapEl   = document.getElementById('product-addons');
  var addonsListEl   = document.getElementById('product-addons-list');

  var qtyValueEl  = document.getElementById('product-qty-value');
  var qtyMinusEl  = document.getElementById('product-qty-minus');
  var qtyPlusEl   = document.getElementById('product-qty-plus');

  var validationEl = document.getElementById('product-validation');
  var ctaEl       = document.getElementById('product-cta');

  // ─── State ───────────────────────────────────────────
  var product          = null;
  var selectedVariant  = null;   // {id,label,price_cents}
  var qty              = 1;
  var QTY_MAX          = 10;
  var QTY_MIN          = 1;

  var CATEGORY_MAP = {
    'bouquets':           'Bouquets',
    'floral-boxes':       'Floral Boxes',
    'vase-arrangements':  'Vase Arrangements',
    'balloons':           'Balloon Bouquets',
    'gifts':              'Gifts / Add-ons'
  };

  var FALLBACK_IMG = 'assets/images/bridal-bouquet.jpg';

  // ─── Helpers ─────────────────────────────────────────
  function formatPrice(cents) {
    var n = Number(cents) || 0;
    var dollars = n / 100;
    if (Math.round(dollars * 100) % 100 === 0) {
      return '$' + Math.round(dollars);
    }
    return '$' + dollars.toFixed(2);
  }

  function getQueryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      var v = params.get(name);
      return v ? v.trim() : '';
    } catch (_) {
      return '';
    }
  }

  function showError() {
    if (loadingEl) loadingEl.hidden = true;
    if (detailEl)  detailEl.hidden  = true;
    if (errorEl)   errorEl.hidden   = false;
  }

  function showDetail() {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl)   errorEl.hidden   = true;
    if (detailEl)  detailEl.hidden  = false;
  }

  function dedupeImages(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var u = list[i];
      if (typeof u === 'string' && u.trim() && !seen[u]) {
        seen[u] = 1;
        out.push(u);
      }
    }
    return out;
  }

  function getSelectedAddonsState() {
    if (!addonsListEl) return [];
    var inputs = addonsListEl.querySelectorAll('input[type="checkbox"]:checked');
    var arr = [];
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      arr.push({
        id: inp.getAttribute('data-addon-id'),
        name: inp.getAttribute('data-addon-name'),
        price_cents: parseInt(inp.getAttribute('data-price-cents'), 10) || 0
      });
    }
    return arr;
  }

  function pushToCart(entry) {
    // 1) Helper hook (agent F may expose it on window)
    if (typeof window.amouraAddToCart === 'function') {
      try { window.amouraAddToCart(entry); return; } catch (_) {}
    }
    // 2) Custom event fallback
    document.dispatchEvent(new CustomEvent('amoura:add-to-cart', { detail: entry }));
  }

  // ─── Render: gallery ────────────────────────────────
  function renderGallery(p) {
    var imgs = dedupeImages([p.image_url].concat(Array.isArray(p.gallery_images) ? p.gallery_images : []));
    if (imgs.length === 0) imgs = [FALLBACK_IMG];

    if (mainImgEl) {
      mainImgEl.src = imgs[0];
      mainImgEl.alt = p.name || 'Product photo';
    }

    if (!thumbsEl) return;
    thumbsEl.innerHTML = '';
    if (imgs.length <= 1) {
      thumbsEl.style.display = 'none';
      return;
    }
    thumbsEl.style.display = '';

    imgs.forEach(function (url, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.setAttribute('aria-label', 'Show photo ' + (i + 1));
      var im = document.createElement('img');
      im.src = url;
      im.alt = '';
      im.loading = 'lazy';
      btn.appendChild(im);
      btn.addEventListener('click', function () {
        if (mainImgEl) mainImgEl.src = url;
        var siblings = thumbsEl.querySelectorAll('button');
        for (var s = 0; s < siblings.length; s++) {
          siblings[s].setAttribute('aria-selected', siblings[s] === btn ? 'true' : 'false');
        }
      });
      thumbsEl.appendChild(btn);
    });
  }

  // ─── Render: variants ────────────────────────────────
  function renderVariants(p) {
    var variants = Array.isArray(p.variants) ? p.variants : [];
    if (!variantsWrapEl || !variantsListEl) return;

    if (variants.length === 0) {
      variantsWrapEl.hidden = true;
      return;
    }

    variantsWrapEl.hidden = false;
    variantsListEl.innerHTML = '';

    variants.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'variant-pill';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('data-variant-id', v.id);
      btn.setAttribute('data-variant-label', v.label || '');
      btn.setAttribute('data-price-cents', String(v.price_cents || 0));

      var labelEl = document.createElement('span');
      labelEl.className = 'variant-pill-label';
      labelEl.textContent = v.label || '';

      var priceEl2 = document.createElement('span');
      priceEl2.className = 'variant-pill-price';
      priceEl2.textContent = formatPrice(v.price_cents || 0);

      btn.appendChild(labelEl);
      btn.appendChild(priceEl2);

      btn.addEventListener('click', function () {
        // toggle selection
        var siblings = variantsListEl.querySelectorAll('.variant-pill');
        for (var s = 0; s < siblings.length; s++) {
          siblings[s].classList.remove('selected');
          siblings[s].setAttribute('aria-checked', 'false');
        }
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
        selectedVariant = {
          id: v.id,
          label: v.label || '',
          price_cents: v.price_cents || 0
        };
        clearValidation();
        updatePriceDisplay();
        updateCtaState();
      });

      variantsListEl.appendChild(btn);
    });
  }

  // ─── Render: addons ──────────────────────────────────
  function renderAddons(p) {
    var addons = Array.isArray(p.addons) ? p.addons : [];
    if (!addonsWrapEl || !addonsListEl) return;

    if (addons.length === 0) {
      addonsWrapEl.hidden = true;
      return;
    }

    addonsWrapEl.hidden = false;
    addonsListEl.innerHTML = '';

    addons.forEach(function (a) {
      var label = document.createElement('label');

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('data-addon-id', a.id);
      input.setAttribute('data-addon-name', a.name || '');
      input.setAttribute('data-price-cents', String(a.price_cents || 0));
      input.addEventListener('change', updatePriceDisplay);

      var nameSpan = document.createElement('span');
      nameSpan.className = 'addon-name';
      nameSpan.textContent = a.name || '';

      var priceSpan = document.createElement('span');
      priceSpan.className = 'addon-price';
      priceSpan.textContent = '+ ' + formatPrice(a.price_cents || 0);

      label.appendChild(input);
      label.appendChild(nameSpan);
      label.appendChild(priceSpan);
      addonsListEl.appendChild(label);
    });
  }

  // ─── Price display & CTA state ──────────────────────
  function getMinVariantCents(p) {
    var variants = Array.isArray(p.variants) ? p.variants : [];
    if (variants.length === 0) return null;
    var min = Infinity;
    for (var i = 0; i < variants.length; i++) {
      var c = parseInt(variants[i].price_cents, 10) || 0;
      if (c < min) min = c;
    }
    return min === Infinity ? 0 : min;
  }

  function updatePriceDisplay() {
    if (!product || !priceEl) return;
    var hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    var addonsTotal = getSelectedAddonsState().reduce(function (acc, a) { return acc + (a.price_cents || 0); }, 0);

    if (hasVariants) {
      if (selectedVariant) {
        priceEl.textContent = formatPrice((selectedVariant.price_cents || 0) + addonsTotal);
      } else {
        var minC = getMinVariantCents(product) || 0;
        priceEl.textContent = 'from ' + formatPrice(minC + addonsTotal);
      }
    } else {
      var basePc = parseInt(product.price, 10) || 0;
      priceEl.textContent = formatPrice(basePc + addonsTotal);
    }
  }

  function updateCtaState() {
    if (!ctaEl || !product) return;
    var hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    if (hasVariants && !selectedVariant) {
      ctaEl.disabled = true;
      ctaEl.textContent = 'Select a size';
    } else {
      ctaEl.disabled = false;
      ctaEl.textContent = 'Add to Cart';
    }
  }

  // ─── Quantity controls ──────────────────────────────
  function updateQtyUi() {
    if (qtyValueEl) qtyValueEl.textContent = String(qty);
    if (qtyMinusEl) qtyMinusEl.disabled = qty <= QTY_MIN;
    if (qtyPlusEl)  qtyPlusEl.disabled  = qty >= QTY_MAX;
  }

  function bindQtyControls() {
    if (qtyMinusEl) {
      qtyMinusEl.addEventListener('click', function () {
        if (qty > QTY_MIN) { qty -= 1; updateQtyUi(); }
      });
    }
    if (qtyPlusEl) {
      qtyPlusEl.addEventListener('click', function () {
        if (qty < QTY_MAX) { qty += 1; updateQtyUi(); }
      });
    }
  }

  // ─── Validation ─────────────────────────────────────
  function showValidation(msg) {
    if (!validationEl) return;
    validationEl.textContent = msg || '';
    validationEl.classList.toggle('visible', !!msg);
  }
  function clearValidation() { showValidation(''); }

  // ─── Add to cart ────────────────────────────────────
  function bindCta() {
    if (!ctaEl) return;
    ctaEl.addEventListener('click', function () {
      if (!product) return;
      var hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
      if (hasVariants && !selectedVariant) {
        showValidation('Please choose a size.');
        return;
      }
      clearValidation();

      var baseCents = selectedVariant
        ? (selectedVariant.price_cents || 0)
        : (parseInt(product.price, 10) || 0);

      var chosenAddons = getSelectedAddonsState();

      var entry = {
        id:    product.id,
        name:  product.name,
        price: baseCents / 100,
        qty:   qty
      };
      if (selectedVariant) {
        entry.variantId    = selectedVariant.id;
        entry.variantLabel = selectedVariant.label;
      }
      if (chosenAddons.length) {
        entry.addons = chosenAddons.map(function (a) {
          return { id: a.id, name: a.name, price: (a.price_cents || 0) / 100 };
        });
      }

      pushToCart(entry);

      // Visual feedback + open cart
      var prevText = ctaEl.textContent;
      ctaEl.disabled = true;
      ctaEl.textContent = 'Added ✓';
      setTimeout(function () {
        ctaEl.textContent = prevText;
        updateCtaState();
      }, 1400);

      if (typeof window.openCart === 'function') {
        try { window.openCart(); } catch (_) {}
      } else {
        document.dispatchEvent(new CustomEvent('amoura:open-cart'));
      }
    });
  }

  // ─── Hydrate from API response ──────────────────────
  function hydrate(p) {
    product = p;

    // Title (page + h1)
    document.title = (p.name || 'Product') + ' — Amoura Florals';
    if (titleEl) titleEl.textContent = p.name || '';

    // Category friendly label
    if (catTagEl) {
      catTagEl.textContent = CATEGORY_MAP[p.category] || (p.category || '');
    }

    // Description (textContent — never innerHTML)
    if (descEl) descEl.textContent = p.description || '';

    renderGallery(p);
    renderVariants(p);
    renderAddons(p);

    updatePriceDisplay();
    updateCtaState();
    updateQtyUi();
    showDetail();
  }

  // ─── Fetch ──────────────────────────────────────────
  function loadProduct() {
    var id = getQueryParam('id');
    if (!id) { showError(); return; }

    fetch('/api/products?id=' + encodeURIComponent(id), {
      headers: { 'Accept': 'application/json' }
    })
      .then(function (res) {
        if (res.status === 404) throw new Error('not_found');
        if (!res.ok) throw new Error('http_' + res.status);
        return res.json();
      })
      .then(function (data) {
        var p = data && data.product ? data.product : null;
        if (!p || !p.id) { showError(); return; }
        try { hydrate(p); }
        catch (e) { console.error('[product] hydrate failed', e); showError(); }
      })
      .catch(function (err) {
        console.warn('[product] fetch failed', err);
        showError();
      });
  }

  // ─── Boot ───────────────────────────────────────────
  function boot() {
    try {
      bindQtyControls();
      bindCta();
      loadProduct();
    } catch (err) {
      console.error('[product] boot error', err);
      showError();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
