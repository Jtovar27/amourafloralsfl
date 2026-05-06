/* ═══════════════════════════════════════════════════════
   AMOURA FLORALS — gifts.js
   Renders /gifts.html grouped by subcategory:
     Group "Gifts"   → teddy-bears, helium-balloons, chocolate
     Group "Add-ons" → baby-breath-letters, crowns, butterflies
     Group "Other"   → anything else (incl. NULL subcategory)
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var GIFTS_BUCKETS    = ['teddy-bears', 'helium-balloons', 'chocolate'];
  var ADDONS_BUCKETS   = ['baby-breath-letters', 'crowns', 'butterflies'];
  var CATEGORY_LABELS  = { 'gifts': 'Gifts / Add-ons' };  // for card category line

  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatPrice(cents) {
    var d = Number(cents) / 100;
    var i = Math.floor(d);
    return d - i === 0 ? '$' + i : '$' + d.toFixed(2);
  }

  function buildCardHtml(product) {
    var id = escapeHtml(product.id);
    var name = escapeHtml(product.name);
    var image = escapeHtml(product.image_url || 'assets/images/floral-box-hero.jpg');
    var label = escapeHtml(CATEGORY_LABELS[product.category] || product.category || '');
    var priceStr = escapeHtml(formatPrice(product.price));
    var priceAttr = escapeHtml((Number(product.price) / 100).toFixed(2));
    var hasVariants = Array.isArray(product.variants) && product.variants.length > 0 ? '1' : '';
    var detailUrl = 'product.html?id=' + id;
    return (
      '<div class="product-card" data-reveal>' +
        '<a href="' + detailUrl + '" class="product-card-link">' +
          '<div class="product-img-wrap"><img src="' + image + '" alt="' + name + '" loading="lazy" /></div>' +
          '<div class="product-info">' +
            '<p class="product-category">' + label + '</p>' +
            '<h3 class="product-name">' + name + '</h3>' +
            '<p class="product-price">' + priceStr + '</p>' +
          '</div>' +
        '</a>' +
        '<button class="quick-add" data-id="' + id + '" data-name="' + name + '" data-price="' + priceAttr + '" data-has-variants="' + hasVariants + '">Add to Cart</button>' +
      '</div>'
    );
  }

  function groupProducts(products) {
    var byBucket = {};
    products.forEach(function (p) {
      var sub = (p.subcategory || '').trim();
      if (!byBucket[sub]) byBucket[sub] = [];
      byBucket[sub].push(p);
    });
    return byBucket;
  }

  function init() {
    var loadingEl = document.getElementById('gifts-loading');
    var emptyEl   = document.getElementById('gifts-empty');
    var page      = document.getElementById('gifts-page');
    if (!page) return;

    fetch('/api/products?category=gifts')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var products = (data && data.products) || [];
        var byBucket = groupProducts(products);

        var allBucketSlugs = GIFTS_BUCKETS.concat(ADDONS_BUCKETS);

        var renderBucket = function (slug) {
          var bucketEl = page.querySelector('.gifts-bucket[data-subcategory="' + slug + '"]');
          if (!bucketEl) return false;
          var grid = bucketEl.querySelector('.catalog-grid');
          var items = byBucket[slug] || [];
          if (!items.length) {
            bucketEl.hidden = true;
            return false;
          }
          grid.innerHTML = items.map(buildCardHtml).join('');
          bucketEl.hidden = false;
          return true;
        };

        var giftsAny  = GIFTS_BUCKETS.map(renderBucket).some(Boolean);
        var addonsAny = ADDONS_BUCKETS.map(renderBucket).some(Boolean);

        // Other = products in 'gifts' category with subcategory = '' / null /
        // not in our canonical list. Keeps the page useful while admins are
        // assigning subcategories.
        var otherItems = [];
        Object.keys(byBucket).forEach(function (k) {
          if (allBucketSlugs.indexOf(k) === -1) {
            byBucket[k].forEach(function (p) { otherItems.push(p); });
          }
        });
        var otherGroup  = page.querySelector('.gifts-group[data-group="other"]');
        if (otherItems.length) {
          var otherGrid = otherGroup.querySelector('.catalog-grid');
          otherGrid.innerHTML = otherItems.map(buildCardHtml).join('');
          otherGroup.hidden = false;
        }

        page.querySelector('.gifts-group[data-group="gifts"]').hidden  = !giftsAny;
        page.querySelector('.gifts-group[data-group="addons"]').hidden = !addonsAny;

        loadingEl.hidden = true;
        if (!giftsAny && !addonsAny && !otherItems.length) emptyEl.hidden = false;

        document.dispatchEvent(new CustomEvent('catalog:rendered'));
      })
      .catch(function () {
        loadingEl.hidden = true;
        emptyEl.hidden = false;
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
