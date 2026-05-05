/* ═══════════════════════════════════════════════════
   AMOURA FLORALS — success.js
   Polls /api/order-status until payment is confirmed,
   then renders order details. Does NOT assume payment
   success just because the user landed here.

   IIFE-wrapped so top-level `const` / `let` declarations
   here can't collide with app.js (classic scripts share
   one lexical environment — a name clash there throws
   SyntaxError and prevents this whole script from
   running, which previously broke the checkout flow).
═══════════════════════════════════════════════════ */

(function () {

const MAX_ATTEMPTS   = 20;
const POLL_INTERVAL  = 1500; // ms

const params    = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');

const stateLoading    = document.getElementById('state-loading');
const stateConfirmed  = document.getElementById('state-confirmed');
const stateProcessing = document.getElementById('state-processing');

// Validate session_id format before doing anything
if (!sessionId || !sessionId.startsWith('cs_')) {
  window.location.href = 'shop.html';
}

/* ── Polling ────────────────────────────────────────── */
async function pollOrderStatus() {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(
        `/api/order-status?session_id=${encodeURIComponent(sessionId)}`
      );

      if (res.ok) {
        const order = await res.json();
        if (order.payment_status === 'paid') return order;
      }
    } catch (e) {
      // Network error — keep polling
    }
    await sleep(POLL_INTERVAL);
  }
  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ── Render confirmed order ─────────────────────────── */
function renderConfirmed(order) {
  // Clear cart only after confirmed payment
  localStorage.removeItem('amoura_cart');
  const cartCount = document.getElementById('cart-count');
  if (cartCount) { cartCount.textContent = '0'; cartCount.classList.remove('visible'); }

  setText('confirmed-order-number', order.order_number);
  setText('confirmed-customer-name', order.customer_name);
  setText('confirmed-email', order.customer_email);
  setText('confirmed-date',   formatDate(order.delivery_date));
  setText('confirmed-method',
    order.delivery_method === 'delivery' ? 'Local Delivery' : 'Local Pickup'
  );
  setText('confirmed-total', formatCents(order.total_amount));

  const itemsEl = document.getElementById('confirmed-items');
  if (itemsEl && order.items?.length) {
    const escHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    itemsEl.innerHTML = order.items.map(i => {
      const addons = Array.isArray(i.selected_addons) ? i.selected_addons : [];
      const addonsHtml = addons.length
        ? `<div class="order-items-list-addons" style="font-size:.78rem;color:#818263;font-style:italic;margin:-4px 0 8px;padding-left:6px;">${addons.map(a => `+ ${escHtml(a.name)}`).join(' · ')}</div>`
        : '';
      return `
      <div class="order-items-list-item">
        <span>${i.product_name} ×${i.quantity}</span>
        <span>${formatCents(i.line_total)}</span>
      </div>${addonsHtml}`;
    }).join('');
  }

  stateLoading.style.display    = 'none';
  stateConfirmed.style.display  = 'flex';
}

/* ── Render processing fallback ─────────────────────── */
function renderProcessing() {
  stateLoading.style.display    = 'none';
  stateProcessing.style.display = 'block';
}

/* ── Helpers ────────────────────────────────────────── */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/* ── Start ──────────────────────────────────────────── */
pollOrderStatus().then(order => {
  if (order) {
    renderConfirmed(order);
  } else {
    renderProcessing();
  }
});

})();
