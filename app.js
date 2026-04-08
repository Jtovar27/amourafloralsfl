/* ─────────────────────────────────────────────
   AMOURA FLORALS — App JS
   Cart | Filters | Scroll | FAQ | Toast | Mobile Menu
───────────────────────────────────────────── */

// ── State ──────────────────────────────────
let cart = JSON.parse(localStorage.getItem('amoura_cart') || '[]');

// ── DOM refs ───────────────────────────────
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

// ── Inject hamburger + mobile menu ─────────
const hamburger = document.createElement('button');
hamburger.className = 'hamburger';
hamburger.setAttribute('aria-label', 'Open menu');
hamburger.innerHTML = '<span></span><span></span><span></span>';

const mobileMenu = document.createElement('nav');
mobileMenu.className = 'mobile-menu';
mobileMenu.innerHTML = `
  <button class="mobile-menu-close" aria-label="Close menu">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>

  <div class="mobile-menu-top">
    <img src="logo.png" alt="Amoura Florals" class="mobile-menu-logo" />
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

// Insert hamburger as first element in nav-left (☰ | logo | cart)
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

// Close on link click
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', closeMenu);
});

// ── Navigation scroll behavior ─────────────
const scrollThreshold = 80;

window.addEventListener('scroll', () => {
  if (window.scrollY > scrollThreshold) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  // Subtle parallax on hero bg
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    const offset = window.scrollY * 0.3;
    heroBg.style.transform = `scale(1.05) translateY(${offset}px)`;
  }
}, { passive: true });

// ── Cart open / close ──────────────────────
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

cartToggle.addEventListener('click', openCart);
cartClose.addEventListener('click', closeCartFn);
cartOverlay.addEventListener('click', closeCartFn);

// ── Cart logic ─────────────────────────────
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
  showToast(`${name} added to cart`);
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
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  saveCart();
  renderCart();
  updateCartCount();
}

function updateCartCount() {
  const total = cart.reduce((acc, i) => acc + i.qty, 0);
  cartCount.textContent = total;
  cartCount.classList.toggle('visible', total > 0);
}

function renderCart() {
  cartItems.innerHTML = '';
  const total = cart.reduce((acc, i) => acc + i.qty, 0);

  if (total === 0) {
    cartEmpty.style.display = 'flex';
    cartFooter.style.display = 'none';
    return;
  }

  cartEmpty.style.display = 'none';
  cartFooter.style.display = 'block';

  cart.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <div style="background:var(--peach);height:80px;display:flex;align-items:center;justify-content:center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818263" stroke-width="1.2">
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
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    cartItems.appendChild(el);
  });

  cartTotal.textContent = `$${cart.reduce((acc, i) => acc + i.price * i.qty, 0).toFixed(2)}`;
}

// ── Add to cart — delegated ─────────────────
document.querySelectorAll('.quick-add').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const { id, name, price } = btn.dataset;
    addToCart(id, name, price);
  });
});

// ── Checkout mock ──────────────────────────
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    showToast('Redirecting to checkout...');
    setTimeout(() => {
      window.open('https://www.instagram.com/amourafloralsfl/', '_blank');
    }, 800);
  });
}

// ── Toast ──────────────────────────────────
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ── Catalog filters ────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.product-card').forEach(card => {
      if (filter === 'all' || card.dataset.category === filter) {
        card.classList.remove('hidden');
        card.style.animation = 'none';
        requestAnimationFrame(() => { card.style.animation = 'fadeIn 0.4s ease forwards'; });
      } else {
        card.classList.add('hidden');
      }
    });
  });
});

// ── FAQ accordion ──────────────────────────
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.faq-question').forEach(b => {
      b.setAttribute('aria-expanded', 'false');
      b.nextElementSibling.classList.remove('open');
    });
    if (!expanded) {
      btn.setAttribute('aria-expanded', 'true');
      btn.nextElementSibling.classList.add('open');
    }
  });
});

// ── Intersection observer — fade-in ─────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(
  '.product-card, .value-item, .testimonial-card, .faq-item, .about-text, .about-images, .featured-text, .featured-images'
).forEach(el => { el.classList.add('observe'); observer.observe(el); });

// Inject observe CSS
const observeStyle = document.createElement('style');
observeStyle.textContent = `
  .observe { opacity:0; transform:translateY(24px);
    transition: opacity 0.65s cubic-bezier(.25,.46,.45,.94), transform 0.65s cubic-bezier(.25,.46,.45,.94); }
  .observe.in-view { opacity:1; transform:translateY(0); }
  .product-card.observe { transition-delay: var(--delay,0ms); }
`;
document.head.appendChild(observeStyle);

document.querySelectorAll('.product-card').forEach((card, i) => card.style.setProperty('--delay', `${i * 60}ms`));
document.querySelectorAll('.value-item').forEach((el, i) => {
  el.style.transition = `opacity 0.65s ${i*100}ms cubic-bezier(.25,.46,.45,.94), transform 0.65s ${i*100}ms cubic-bezier(.25,.46,.45,.94)`;
});

// ── Smooth scroll for anchor links ─────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - header.offsetHeight, behavior: 'smooth' });
    }
  });
});

// ── Init ───────────────────────────────────
renderCart();
updateCartCount();
