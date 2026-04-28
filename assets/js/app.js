/* ═══════════════════════════════════════════════════════
   AMOURA FLORALS — app.js v2.0
   Custom Cursor · Cart · Filters · Scroll · FAQ
   Testimonials · Mobile Menu · Reveal · Counters
═══════════════════════════════════════════════════════ */

/* ── Custom Cursor ─────────────────────────────────── */
(function () {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  let mouseX = 0, mouseY = 0;
  let ringX  = 0, ringY  = 0;
  let raf;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = mouseX + 'px';
    dot.style.top  = mouseY + 'px';
  }, { passive: true });

  function animateRing() {
    ringX += (mouseX - ringX) * 0.14;
    ringY += (mouseY - ringY) * 0.14;
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';
    raf = requestAnimationFrame(animateRing);
  }
  animateRing();

  // Hide cursor when leaving window
  document.addEventListener('mouseleave', () => {
    dot.style.opacity  = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity  = '1';
    ring.style.opacity = '1';
  });
})();

/* ── State ─────────────────────────────────────────── */
let cart = JSON.parse(localStorage.getItem('amoura_cart') || '[]');

/* ── DOM refs ──────────────────────────────────────── */
const header      = document.getElementById('site-header');
const cartToggle  = document.getElementById('cart-toggle');
const cartClose   = document.getElementById('cart-close');
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const cartCount   = document.getElementById('cart-count');
const cartItems   = document.getElementById('cart-items');
const cartEmpty   = document.getElementById('cart-empty');
const cartFooter  = document.getElementById('cart-footer');
const cartTotal   = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const toast       = document.getElementById('toast');

/* ── Hamburger + Mobile Menu (injected) ────────────── */
const hamburger = document.createElement('button');
hamburger.className = 'hamburger';
hamburger.setAttribute('aria-label', 'Open menu');
hamburger.innerHTML = '<span></span><span></span><span></span>';

const mobileMenu = document.createElement('nav');
mobileMenu.className = 'mobile-menu';
mobileMenu.setAttribute('aria-label', 'Mobile navigation');
mobileMenu.innerHTML = `
  <button class="mobile-menu-close" aria-label="Close menu">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>
  <div class="mobile-menu-top">
    <img src="assets/images/amoura_logo_transparent_clean.png" alt="Amoura Florals" class="mobile-menu-logo" />
  </div>
  <div class="mobile-menu-links">
    <a href="index.html">Home</a>
    <div class="mm-shop-group">
      <button class="mm-shop-toggle" aria-expanded="false">
        Shop
        <svg class="mm-shop-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="mm-shop-sub" aria-hidden="true">
        <a href="shop.html">All Products</a>
        <a href="bouquets.html">Bouquets</a>
        <a href="floral-boxes.html">Floral Boxes</a>
        <a href="balloons.html">Balloons</a>
        <a href="gifts.html">Add-ons</a>
      </div>
    </div>
    <a href="about.html">About</a>
    <a href="faq.html">FAQ</a>
    <a href="contact.html">Contact</a>
  </div>
  <div class="mobile-menu-bottom">
    <a href="https://www.instagram.com/amourafloralsfl/" target="_blank" rel="noopener" class="mm-instagram">
      @amourafloralsfl
    </a>
  </div>
`;
document.body.appendChild(mobileMenu);

const navLeft = document.querySelector('.nav-left');
if (navLeft) navLeft.insertBefore(hamburger, navLeft.firstChild);

function openMenu() {
  mobileMenu.classList.add('open');
  hamburger.classList.add('open');
  hamburger.setAttribute('aria-label', 'Close menu');
  document.body.style.overflow = 'hidden';
}

/* ── Mobile shop submenu toggle ─────────────────────── */
const mmShopToggle = mobileMenu.querySelector('.mm-shop-toggle');
const mmShopSub    = mobileMenu.querySelector('.mm-shop-sub');
mmShopToggle.addEventListener('click', () => {
  const expanded = mmShopToggle.getAttribute('aria-expanded') === 'true';
  mmShopToggle.setAttribute('aria-expanded', String(!expanded));
  mmShopSub.setAttribute('aria-hidden', String(expanded));
  mmShopSub.classList.toggle('open', !expanded);
  mmShopToggle.classList.toggle('active', !expanded);
});

function closeMenu() {
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-label', 'Open menu');
  document.body.style.overflow = '';
  mmShopToggle.setAttribute('aria-expanded', 'false');
  mmShopSub.setAttribute('aria-hidden', 'true');
  mmShopSub.classList.remove('open');
  mmShopToggle.classList.remove('active');
}

hamburger.addEventListener('click', () => {
  mobileMenu.classList.contains('open') ? closeMenu() : openMenu();
});

mobileMenu.querySelector('.mobile-menu-close').addEventListener('click', closeMenu);
mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));

/* ── Scroll: nav + hero parallax ───────────────────── */
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const y = window.scrollY;

  if (y > 60) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  // Hero parallax
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    heroBg.style.transform = `scale(1.06) translateY(${y * 0.22}px)`;
  }

  // Page banner parallax
  const bannerBg = document.querySelector('.page-banner-bg');
  if (bannerBg) {
    bannerBg.style.transform = `scale(1.06) translateY(${y * 0.15}px)`;
  }

  lastScroll = y;
}, { passive: true });

/* ── Cart open / close ─────────────────────────────── */
function openCart() {
  cartSidebar.classList.add('open');
  cartOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCartFn() {
  cartSidebar.classList.remove('open');
  cartOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

if (cartToggle)  cartToggle.addEventListener('click', openCart);
if (cartClose)   cartClose.addEventListener('click', closeCartFn);
if (cartOverlay) cartOverlay.addEventListener('click', closeCartFn);

// ESC to close
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCartFn();
    closeMenu();
  }
});

/* ── Cart logic ────────────────────────────────────── */
function saveCart() {
  localStorage.setItem('amoura_cart', JSON.stringify(cart));
}

function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price: parseFloat(price), qty: 1 });
  }
  saveCart();
  renderCart();
  updateCartCount();
  showToast(`${name} added`);
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCart();
  updateCartCount();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id); return; }
  saveCart();
  renderCart();
  updateCartCount();
}

function updateCartCount() {
  const total = cart.reduce((acc, i) => acc + i.qty, 0);
  if (cartCount) {
    cartCount.textContent = total;
    cartCount.classList.toggle('visible', total > 0);
  }
}

function renderCart() {
  if (!cartItems) return;
  cartItems.innerHTML = '';
  const total = cart.reduce((acc, i) => acc + i.qty, 0);

  if (total === 0) {
    if (cartEmpty)  cartEmpty.style.display  = 'flex';
    if (cartFooter) cartFooter.style.display = 'none';
    return;
  }

  if (cartEmpty)  cartEmpty.style.display  = 'none';
  if (cartFooter) cartFooter.style.display = 'block';

  cart.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.dataset.cartId = item.id;
    // Build via DOM APIs so admin-controlled product names cannot inject HTML
    const thumb = document.createElement('div');
    thumb.style.cssText = 'background:var(--off-white);aspect-ratio:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;width:80px;';
    thumb.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sage-light)" stroke-width="1.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

    const info = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'cart-item-name';
    name.textContent = item.name;
    const price = document.createElement('p');
    price.className = 'cart-item-price';
    price.textContent = `$${item.price.toFixed(2)}`;
    const qty = document.createElement('div');
    qty.className = 'cart-item-qty';
    qty.innerHTML =
      '<button class="qty-btn" data-cart-action="dec" type="button">−</button>' +
      `<span class="qty-num">${item.qty}</span>` +
      '<button class="qty-btn" data-cart-action="inc" type="button">+</button>';
    info.appendChild(name);
    info.appendChild(price);
    info.appendChild(qty);

    const remove = document.createElement('button');
    remove.className = 'cart-item-remove';
    remove.dataset.cartAction = 'remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
    remove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    el.appendChild(thumb);
    el.appendChild(info);
    el.appendChild(remove);
    cartItems.appendChild(el);
  });

  if (cartTotal) {
    cartTotal.textContent = `$${cart.reduce((acc, i) => acc + i.price * i.qty, 0).toFixed(2)}`;
  }
}

/* ── Quick-add delegation ──────────────────────────── */
// Uses event delegation so dynamically-injected cards (catalog.js) work too.
document.addEventListener('click', e => {
  const btn = e.target.closest('.quick-add');
  if (!btn) return;
  e.stopPropagation();
  const { id, name, price } = btn.dataset;
  addToCart(id, name, price);
});

/* ── Cart item delegation ──────────────────────────── */
// Replaces inline onclick="changeQty(...)" / onclick="removeFromCart(...)"
// so cart product names (admin-controlled) cannot break out of attribute context.
if (cartItems) {
  cartItems.addEventListener('click', e => {
    const btn = e.target.closest('button[data-cart-action]');
    if (!btn) return;
    const row = btn.closest('.cart-item');
    if (!row) return;
    const id = row.dataset.cartId;
    switch (btn.dataset.cartAction) {
      case 'inc':    return changeQty(id, +1);
      case 'dec':    return changeQty(id, -1);
      case 'remove': return removeFromCart(id);
    }
  });
}

// No-op listener — delegation already handles catalog:rendered cards.
document.addEventListener('catalog:rendered', function () {});

/* ── Checkout ──────────────────────────────────────── */
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    window.location.href = 'checkout.html';
  });
}

/* ── Toast ─────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ── Catalog filters ───────────────────────────────── */
function applyFilter(filter) {
  let delay = 0;
  document.querySelectorAll('.product-card').forEach(card => {
    if (filter === 'all' || card.dataset.category === filter) {
      card.classList.remove('hidden');
      card.style.animationDelay = `${delay * 60}ms`;
      card.style.animation = 'none';
      requestAnimationFrame(() => {
        card.style.animation = 'fadeUp 0.45s var(--ease-out) both';
      });
      delay++;
    } else {
      card.classList.add('hidden');
    }
  });
}

// Event delegation handles both static and dynamically-injected filter buttons.
document.addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn[data-filter]');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter(btn.dataset.filter);
});

// Re-apply the active filter after catalog.js replaces the grid.
document.addEventListener('catalog:rendered', () => {
  const active = document.querySelector('.filter-btn.active[data-filter]');
  if (active) applyFilter(active.dataset.filter);
});

/* ── Auto-apply filter from URL param (?filter=xxx) ── */
(function () {
  const params = new URLSearchParams(window.location.search);
  const f = params.get('filter');
  if (!f) return;

  // Pre-hide non-matching cards immediately so they never flash on screen
  if (f !== 'all') {
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.dataset.category !== f) card.classList.add('hidden');
    });
  }

  const target = document.querySelector(`.filter-btn[data-filter="${f}"]`);
  if (target) target.click();
})();

/* ── FAQ accordion ─────────────────────────────────── */
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    // close all
    document.querySelectorAll('.faq-question').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      b.nextElementSibling.classList.remove('open');
    });
    // open clicked if was closed
    if (!expanded) {
      btn.setAttribute('aria-expanded', 'true');
      btn.nextElementSibling.classList.add('open');
    }
  });
});

/* ── Testimonials carousel ─────────────────────────── */
(function () {
  const track = document.querySelector('.testimonials-track');
  if (!track) return;

  const prev = document.querySelector('.t-prev');
  const next = document.querySelector('.t-next');
  const INTERVAL = 4800;

  let current = 0;
  let timer;
  let cards = [];
  let bound = false;

  function refresh() {
    cards = Array.from(track.querySelectorAll('.testimonial-card'));
    current = 0;
    if (cards.length) {
      cards.forEach((c, i) => c.setAttribute('aria-hidden', i === 0 ? 'false' : 'true'));
      track.style.transform = 'translateX(0)';
    }
  }

  function goTo(index) {
    if (!cards.length) return;
    if (cards[current]) cards[current].setAttribute('aria-hidden', 'true');
    current = ((index % cards.length) + cards.length) % cards.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    cards[current].setAttribute('aria-hidden', 'false');
  }

  function stopAuto()  { if (timer) { clearInterval(timer); timer = null; } }
  function startAuto() { stopAuto(); if (cards.length > 1) timer = setInterval(() => goTo(current + 1), INTERVAL); }
  function resetAuto() { stopAuto(); startAuto(); }

  function bindOnce() {
    if (bound) return;
    if (prev) prev.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
    if (next) next.addEventListener('click', () => { goTo(current + 1); resetAuto(); });

    let touchStartX = 0;
    track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) { goTo(dx < 0 ? current + 1 : current - 1); resetAuto(); }
    });
    bound = true;
  }

  function init() { refresh(); bindOnce(); startAuto(); }

  init();
  // Re-init when dynamic-content.js replaces cards.
  document.addEventListener('testimonials:rendered', init);
})();

/* ── Scroll Reveal (data-reveal) ───────────────────── */
(function () {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => observer.observe(el));
})();

/* ── Stat counters ─────────────────────────────────── */
(function () {
  const stats = document.querySelectorAll('.stat-num[data-count]');
  if (!stats.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.textContent.replace(/[0-9]/g, '');
      let start     = 0;
      const dur     = 1400;
      const step    = 16;
      const inc     = target / (dur / step);

      const tick = setInterval(() => {
        start = Math.min(start + inc, target);
        el.textContent = Math.floor(start) + suffix;
        if (start >= target) clearInterval(tick);
      }, step);

      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  stats.forEach(el => observer.observe(el));
})();

/* ── Smooth anchor scroll ──────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = header ? header.offsetHeight : 0;
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - offset,
        behavior: 'smooth'
      });
    }
  });
});

/* ── Announcement Bar ──────────────────────────────── */
(function () {
  const bar   = document.getElementById('announcement-bar');
  const close = document.getElementById('ann-close');
  if (!bar) return;

  if (sessionStorage.getItem('ann_dismissed')) {
    bar.classList.add('dismissed');
  } else {
    document.body.classList.add('has-ann-bar');
  }

  if (close) {
    close.addEventListener('click', () => {
      bar.classList.add('dismissed');
      document.body.classList.remove('has-ann-bar');
      sessionStorage.setItem('ann_dismissed', '1');
    });
  }
})();

/* ── Newsletter Form ───────────────────────────────── */
// POSTs to /api/newsletter — server stores the address in newsletter_subscribers
// (idempotent re-subscribe). On API failure the user is told the request couldn't
// be saved instead of being silently lied to with a fake success.
(function () {
  const form    = document.getElementById('newsletter-form');
  const success = document.getElementById('newsletter-success');
  if (!form) return;

  const input = form.querySelector('input[type="email"]');
  let submitting = false;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;

    const email = input.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      input.style.borderBottom = '1px solid #c0635a';
      input.focus();
      return;
    }
    input.style.borderBottom = '';
    submitting = true;

    try {
      const res = await fetch('/api/newsletter', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, source: window.location.pathname.replace(/^\//, '') || 'home' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        input.style.borderBottom = '1px solid #c0635a';
        if (success) {
          success.textContent = data.error || "Couldn't save your email. Please try again.";
          success.classList.add('show', 'is-error');
        }
        return;
      }
      form.querySelector('.newsletter-field').style.display = 'none';
      if (success) {
        success.textContent = 'Thank you for subscribing!';
        success.classList.remove('is-error');
        success.classList.add('show');
      }
    } catch (err) {
      input.style.borderBottom = '1px solid #c0635a';
      if (success) {
        success.textContent = 'Network error — please try again.';
        success.classList.add('show', 'is-error');
      }
    } finally {
      submitting = false;
    }
  });

  input.addEventListener('input', () => { input.style.borderBottom = ''; });
})();

/* ── Contact Form ──────────────────────────────────── */
// POSTs to /api/contact — server validates inputs, persists to contact_messages,
// and emails ADMIN_EMAIL via Resend. The DB row is the source of truth so a mail
// failure does not lose the message.
(function () {
  const form    = document.getElementById('contact-form');
  const success = document.getElementById('contact-success');
  const errorEl = document.getElementById('contact-error');
  if (!form) return;

  function validate() {
    let ok = true;
    form.querySelectorAll('[required]').forEach(el => {
      const empty = el.value.trim() === '';
      const emailBad = el.type === 'email' && el.value.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
      if (empty || emailBad) {
        el.classList.add('invalid');
        ok = false;
      } else {
        el.classList.remove('invalid');
      }
    });
    return ok;
  }

  form.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('invalid'));
  });

  let submitting = false;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    const btn = form.querySelector('.contact-btn');
    submitting       = true;
    btn.textContent  = 'Sending…';
    btn.disabled     = true;
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('show'); }

    const payload = {
      first_name: form.first_name.value.trim(),
      last_name:  form.last_name?.value.trim()  || '',
      email:      form.email.value.trim(),
      phone:      form.phone?.value.trim()      || '',
      message:    form.message.value.trim(),
    };

    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (errorEl) {
          errorEl.textContent = data.error || 'Could not send your message. Please try again.';
          errorEl.classList.add('show');
        }
        return;
      }

      form.reset();
      if (success) {
        success.classList.add('show');
        setTimeout(() => success.classList.remove('show'), 5000);
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Network error — please try again.';
        errorEl.classList.add('show');
      }
    } finally {
      submitting      = false;
      btn.textContent = 'Send Message';
      btn.disabled    = false;
    }
  });
})();

/* ── Init ──────────────────────────────────────────── */
renderCart();
updateCartCount();

/* ── Values Carousel ───────────────────────────────── */
(function () {
  const carousel = document.getElementById('valuesCarousel');
  if (!carousel) return;
  const dots = document.querySelectorAll('.vc-dot');

  function updateDots(index) {
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  carousel.addEventListener('scroll', () => {
    const index = Math.round(carousel.scrollLeft / carousel.offsetWidth);
    updateDots(index);
  }, { passive: true });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const i = parseInt(dot.dataset.index);
      carousel.scrollTo({ left: i * carousel.offsetWidth, behavior: 'smooth' });
      updateDots(i);
    });
  });
})();
