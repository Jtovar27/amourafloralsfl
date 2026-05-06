/* ═══════════════════════════════════════════════════════
   AMOURA FLORALS — catalog.js
   Progressive enhancement: replaces static product cards
   with live data from /api/products when available.
═══════════════════════════════════════════════════════ */

(function () {
  var grid = document.getElementById('catalog-grid');
  if (!grid) return;

  var category = document.body.dataset.catalog;
  if (!category) return;

  var url = category === 'all'
    ? '/api/products'
    : '/api/products?category=' + encodeURIComponent(category);

  var CATEGORY_LABELS = {
    'bouquets':          'Bouquets',
    'floral-boxes':      'Floral Boxes',
    'vase-arrangements': 'Vase Arrangements',
    'balloons':          'Balloons',
    'gifts':             'Gifts / Add-ons'
  };

  function formatPrice(cents) {
    var dollars = cents / 100;
    var integer  = Math.floor(dollars);
    var fraction = dollars - integer;
    if (fraction === 0) {
      return '$' + integer;
    }
    return '$' + dollars.toFixed(2);
  }

  function buildCard(product, index) {
    var card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-category', product.category);
    card.setAttribute('data-reveal', '');

    // Stagger delay cycles 1-4
    card.setAttribute('data-delay', String((index % 4) + 1));

    // Image wrapper
    var imgWrap = document.createElement('div');
    imgWrap.className = 'product-img-wrap';

    var img = document.createElement('img');
    img.setAttribute('src', product.image_url || '');
    img.setAttribute('alt', product.name);
    img.setAttribute('loading', 'lazy');
    imgWrap.appendChild(img);

    // Info block
    var info = document.createElement('div');
    info.className = 'product-info';

    var catEl = document.createElement('p');
    catEl.className = 'product-category';
    catEl.textContent = CATEGORY_LABELS[product.category] || product.category;

    var nameEl = document.createElement('h3');
    nameEl.className = 'product-name';
    nameEl.textContent = product.name;

    var priceEl = document.createElement('p');
    priceEl.className = 'product-price';
    priceEl.textContent = formatPrice(product.price);

    info.appendChild(catEl);
    info.appendChild(nameEl);
    info.appendChild(priceEl);

    // Quick-add button
    var btn = document.createElement('button');
    btn.className = 'quick-add';
    btn.setAttribute('data-id', product.id);
    btn.setAttribute('data-name', product.name);
    btn.setAttribute('data-price', (product.price / 100).toFixed(2));
    btn.textContent = 'Add to Cart';

    card.appendChild(imgWrap);
    card.appendChild(info);
    card.appendChild(btn);

    return card;
  }

  function attachRevealObserver(cards) {
    if (!window.IntersectionObserver) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    cards.forEach(function (card) { observer.observe(card); });
  }

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var products = data && Array.isArray(data.products) ? data.products : [];
      if (products.length === 0) return;

      // Build fragment to avoid multiple reflows
      var fragment = document.createDocumentFragment();
      var newCards  = [];

      products.forEach(function (product, i) {
        var card = buildCard(product, i);
        newCards.push(card);
        fragment.appendChild(card);
      });

      // Replace grid contents
      grid.innerHTML = '';
      grid.appendChild(fragment);

      // Re-attach reveal observer for new cards
      attachRevealObserver(newCards);

      // Notify app.js (no-op for delegation, but defensive hook)
      document.dispatchEvent(new CustomEvent('catalog:rendered', { bubbles: false }));
    })
    .catch(function (err) {
      console.warn('[catalog.js] Could not load products from API — static fallback remains.', err);
    });
})();
