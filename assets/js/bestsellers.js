/* ═══════════════════════════════════════════════════════
   AMOURA FLORALS — bestsellers.js
   Renders the homepage Best Sellers carousel.
   Reads /api/products, filters featured===true, hydrates
   #bs-track and reveals the section if any results exist.
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var CATEGORY_LABELS = {
    'bouquets':     'Bouquets',
    'floral-boxes': 'Floral Boxes',
    'balloons':     'Balloons',
    'gifts':        'Gifts'
  };

  var FALLBACK_IMG = 'assets/images/floral-box-hero.jpg';

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPrice(cents) {
    var dollars = Number(cents) / 100;
    if (!isFinite(dollars)) return '$0';
    var integer  = Math.floor(dollars);
    var fraction = dollars - integer;
    if (fraction === 0) {
      return '$' + integer;
    }
    return '$' + dollars.toFixed(2);
  }

  function buildCardHtml(product) {
    var id        = escapeHtml(product.id);
    var name      = escapeHtml(product.name);
    var image     = escapeHtml(product.image_url || FALLBACK_IMG);
    var category  = CATEGORY_LABELS[product.category] || product.category || '';
    var catLabel  = escapeHtml(category);
    var priceStr  = escapeHtml(formatPrice(product.price));
    var priceAttr = escapeHtml((Number(product.price) / 100).toFixed(2));
    var hasVariants = Array.isArray(product.variants) && product.variants.length > 0 ? '1' : '';
    var detailUrl = 'product.html?id=' + id;

    return (
      '<article class="bs-card" data-id="' + id + '" role="listitem">' +
        '<a href="' + detailUrl + '" class="bs-card-link">' +
          '<div class="bs-card-img">' +
            '<img src="' + image + '" alt="' + name + '" loading="lazy" />' +
          '</div>' +
          '<div class="bs-card-info">' +
            '<p class="bs-card-cat">' + catLabel + '</p>' +
            '<h3 class="bs-card-name">' + name + '</h3>' +
            '<p class="bs-card-price">' + priceStr + '</p>' +
          '</div>' +
        '</a>' +
        '<button class="bs-card-cta quick-add" data-id="' + id + '" data-name="' + name + '" data-price="' + priceAttr + '" data-has-variants="' + hasVariants + '">Add to Cart</button>' +
      '</article>'
    );
  }

  function setupArrows(track, prevBtn, nextBtn) {
    function updateArrows() {
      var overflows = track.scrollWidth > track.clientWidth + 2;
      if (!overflows) {
        prevBtn.setAttribute('hidden', '');
        nextBtn.setAttribute('hidden', '');
        return;
      }
      var atStart = track.scrollLeft <= 0;
      var atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      if (atStart) prevBtn.setAttribute('hidden', '');
      else         prevBtn.removeAttribute('hidden');
      if (atEnd)   nextBtn.setAttribute('hidden', '');
      else         nextBtn.removeAttribute('hidden');
    }

    prevBtn.addEventListener('click', function () {
      track.scrollBy({ left: -track.clientWidth * 0.8, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', function () {
      track.scrollBy({ left: track.clientWidth * 0.8, behavior: 'smooth' });
    });

    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);

    // Initial pass after layout settles
    updateArrows();
    setTimeout(updateArrows, 60);
  }

  function init() {
    try {
      var section = document.getElementById('bestsellers');
      var track   = document.getElementById('bs-track');
      var prevBtn = document.getElementById('bs-prev');
      var nextBtn = document.getElementById('bs-next');
      if (!section || !track || !prevBtn || !nextBtn) return;

      fetch('/api/products')
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          var products = (data && Array.isArray(data.products)) ? data.products : [];
          var bestSellers = products.filter(function (p) {
            return p && p.featured && p.active !== false;
          });

          if (bestSellers.length === 0) return;

          var html = '';
          for (var i = 0; i < bestSellers.length; i++) {
            html += buildCardHtml(bestSellers[i]);
          }
          track.innerHTML = html;

          section.removeAttribute('hidden');
          setupArrows(track, prevBtn, nextBtn);
        })
        .catch(function () {
          // Silent: leave the section hidden, no UI degradation.
        });
    } catch (e) {
      // Silent fallback — never break the page.
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
