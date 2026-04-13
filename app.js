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
    <img src="amoura_logo_transparent_clean.png" alt="Amoura Florals" class="mobile-menu-logo" />
  </div>
  <div class="mobile-menu-links">
    <a href="index.html">Home</a>
    <a href="shop.html">Shop</a>
    <a href="about.html">About</a>
    <a href="faq.html">FAQ</a>
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

function closeMenu() {
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-label', 'Open menu');
  document.body.style.overflow = '';
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
    el.innerHTML = `
      <div style="background:var(--off-white);aspect-ratio:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;width:80px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sage-light)" stroke-width="1.2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div>
        <p class="cart-item-name">${item.name}</p>
        <p class="cart-item-price">$${item.price.toFixed(2)}</p>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Remove ${item.name}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    cartItems.appendChild(el);
  });

  if (cartTotal) {
    cartTotal.textContent = `$${cart.reduce((acc, i) => acc + i.price * i.qty, 0).toFixed(2)}`;
  }
}

/* ── Quick-add delegation ──────────────────────────── */
document.querySelectorAll('.quick-add').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const { id, name, price } = btn.dataset;
    addToCart(id, name, price);
  });
});

/* ── Checkout ──────────────────────────────────────── */
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    showToast('Connecting to Instagram…');
    setTimeout(() => window.open('https://www.instagram.com/amourafloralsfl/', '_blank'), 900);
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
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
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
  });
});

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

  const cards    = track.querySelectorAll('.testimonial-card');
  const dots     = document.querySelectorAll('.t-dot');
  let current    = 0;
  let timer;
  const INTERVAL = 4800;

  function goTo(index) {
    cards[current].setAttribute('aria-hidden', 'true');
    if (dots[current]) {
      dots[current].classList.remove('active');
      dots[current].setAttribute('aria-selected', 'false');
    }
    current = ((index % cards.length) + cards.length) % cards.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    cards[current].setAttribute('aria-hidden', 'false');
    if (dots[current]) {
      dots[current].classList.add('active');
      dots[current].setAttribute('aria-selected', 'true');
    }
  }

  function startAuto() { timer = setInterval(() => goTo(current + 1), INTERVAL); }
  function resetAuto()  { clearInterval(timer); startAuto(); }

  dots.forEach((dot, i) => dot.addEventListener('click', () => { goTo(i); resetAuto(); }));

  // Touch/swipe
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { goTo(dx < 0 ? current + 1 : current - 1); resetAuto(); }
  });

  startAuto();
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
