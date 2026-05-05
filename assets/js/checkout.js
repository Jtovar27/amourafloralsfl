/* ═══════════════════════════════════════════════════
   AMOURA FLORALS — checkout.js
   Handles checkout form: cart summary, validation,
   delivery toggles, and submission to /api/checkout.

   Wrapped in an IIFE so top-level `cart`, `form`, etc.
   stay local to this file. Without it they clash with
   identically-named globals in app.js (classic scripts
   share the same lexical environment), which throws a
   SyntaxError and prevents the submit handler from ever
   attaching — making the page reload on click.
═══════════════════════════════════════════════════ */

(function () {

const TAX_RATE     = 0.07;
const SHIPPING_FEE = 15.00;

/* ── Cart ───────────────────────────────────────────── */
const cart = JSON.parse(localStorage.getItem('amoura_cart') || '[]');

if (!cart.length) {
  window.location.href = 'shop.html';
}

/* ── DOM refs (defensive — script must not crash if any are absent) ─ */
const form        = document.getElementById('checkout-form');
const submitBtn   = document.getElementById('submit-btn');
const btnText     = submitBtn?.querySelector('.btn-text');
const btnSpinner  = submitBtn?.querySelector('.btn-spinner');
const formAlert   = document.getElementById('form-alert');
const addressFlds = document.getElementById('address-fields');
const giftFields  = document.getElementById('gift-fields');
const isGiftBox   = document.getElementById('is-gift');
const dateInput   = document.getElementById('delivery-date');
const phoneInput  = document.getElementById('customer-phone');

/* ── Email validation regex (stricter) ──────────────── */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/* ── Set minimum delivery date (today + 2 days) ─────── */
function computeMinDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}

if (dateInput) {
  dateInput.min = computeMinDateStr();
  // Re-set min on focus so an overnight-stale page picks up today's correct
  // floor before the user picks a date.
  dateInput.addEventListener('focus', () => {
    dateInput.min = computeMinDateStr();
  });
}

/* ── Phone formatting ───────────────────────────────── */
function formatPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 10);
  if (!digits) return '';
  if (digits.length < 4)  return `(${digits}`;
  if (digits.length < 7)  return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

if (phoneInput) {
  phoneInput.setAttribute('inputmode', 'numeric');
  phoneInput.setAttribute('maxlength', '14');
  phoneInput.addEventListener('input', e => {
    const cursorAtEnd = e.target.selectionStart === e.target.value.length;
    e.target.value = formatPhone(e.target.value);
    if (cursorAtEnd) {
      const len = e.target.value.length;
      e.target.setSelectionRange(len, len);
    }
  });
}

/* ── Order summary rendering ────────────────────────── */
function getDeliveryMethod() {
  return document.querySelector('input[name="delivery_method"]:checked')?.value || 'pickup';
}

function lineTotal(item) {
  const base = item.price || 0;
  const addonsSum = (item.addons || []).reduce((s, a) => s + (a.price || 0), 0);
  return (base + addonsSum) * (item.qty || 1);
}

function subtotalDollars() {
  return cart.reduce((s, i) => s + lineTotal(i), 0);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSummary() {
  const method    = getDeliveryMethod();
  const subtotal  = subtotalDollars();
  const shipping  = method === 'delivery' ? SHIPPING_FEE : 0;
  const tax       = (subtotal + shipping) * TAX_RATE;
  const total     = subtotal + shipping + tax;

  const itemsEl = document.getElementById('summary-items');
  if (itemsEl) {
    itemsEl.innerHTML = cart.map(i => {
      const addons = Array.isArray(i.addons) ? i.addons : [];
      const addonsHtml = addons.length
        ? `<div style="font-size:.78rem;color:#818263;font-style:italic;margin-top:2px;">${
            addons.map(a => `+ ${escapeHtml(a.name)}`).join(' &middot; ')
          }</div>`
        : '';
      return `
      <div class="summary-item">
        <div class="summary-item-info">
          <span class="summary-item-name">${escapeHtml(i.name)}</span>
          <span class="summary-item-qty">Qty: ${i.qty}</span>
          ${addonsHtml}
        </div>
        <span class="summary-item-price">$${lineTotal(i).toFixed(2)}</span>
      </div>`;
    }).join('');
  }

  const subEl  = document.getElementById('summary-subtotal');
  const shipEl = document.getElementById('summary-shipping');
  const taxEl  = document.getElementById('summary-tax');
  const totEl  = document.getElementById('summary-total');
  if (subEl)  subEl.textContent  = `$${subtotal.toFixed(2)}`;
  if (shipEl) shipEl.textContent = shipping > 0 ? `$${shipping.toFixed(2)}` : 'Free';
  if (taxEl)  taxEl.textContent  = `$${tax.toFixed(2)}`;
  if (totEl)  totEl.textContent  = `$${total.toFixed(2)}`;
}

/* ── Delivery method toggle ─────────────────────────── */
document.querySelectorAll('input[name="delivery_method"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isDelivery = radio.value === 'delivery';

    // Toggle address section
    if (addressFlds) {
      addressFlds.classList.toggle('hidden', !isDelivery);
      addressFlds.setAttribute('aria-hidden', String(!isDelivery));
    }

    // Required attributes on address inputs
    ['street', 'city', 'zip'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.required = isDelivery;
    });

    // Visual selected state on radio cards
    document.getElementById('radio-card-pickup')?.classList.toggle('selected', !isDelivery);
    document.getElementById('radio-card-delivery')?.classList.toggle('selected', isDelivery);

    renderSummary();
  });
});

/* ── Gift toggle ────────────────────────────────────── */
isGiftBox?.addEventListener('change', function () {
  if (giftFields) giftFields.style.display = this.checked ? 'block' : 'none';
});

/* ── Validation helpers ─────────────────────────────── */
function setError(inputId, errorId, msg) {
  const input = document.getElementById(inputId);
  const errEl = document.getElementById(errorId);
  if (input) input.classList.toggle('has-error', !!msg);
  if (errEl) {
    errEl.textContent = msg || '';
    errEl.classList.toggle('visible', !!msg);
  }
}

function validateForm() {
  let ok = true;
  const method = getDeliveryMethod();

  const name      = document.getElementById('customer-name')?.value.trim() || '';
  const emailRaw  = document.getElementById('customer-email')?.value || '';
  const email     = emailRaw.trim().toLowerCase();
  const phoneRaw  = document.getElementById('customer-phone')?.value || '';
  const phoneDigs = phoneRaw.replace(/\D/g, '');
  const date      = dateInput?.value || '';

  setError('customer-name',  'error-name',  '');
  setError('customer-email', 'error-email', '');
  setError('customer-phone', 'error-phone', '');
  setError('delivery-date',  'error-date',  '');

  if (!name) {
    setError('customer-name', 'error-name', 'Full name is required.');
    ok = false;
  }

  if (!email || !EMAIL_RE.test(email)) {
    setError('customer-email', 'error-email', 'Please enter a valid email address.');
    ok = false;
  }

  if (!phoneDigs) {
    setError('customer-phone', 'error-phone', 'Phone number is required.');
    ok = false;
  } else if (phoneDigs.length !== 10) {
    setError('customer-phone', 'error-phone', 'Phone must be 10 digits.');
    ok = false;
  }

  if (!date) {
    setError('delivery-date', 'error-date', 'Please select a delivery date.');
    ok = false;
  } else {
    const minDateStr = computeMinDateStr();
    if (date < minDateStr) {
      setError('delivery-date', 'error-date', 'Date must be at least 2 days from today.');
      ok = false;
    }
  }

  if (method === 'delivery') {
    const street = document.getElementById('street')?.value.trim() || '';
    const city   = document.getElementById('city')?.value.trim()   || '';
    const zip    = document.getElementById('zip')?.value.trim()    || '';

    setError('street', 'error-street', '');
    setError('city',   'error-city',   '');
    setError('zip',    'error-zip',    '');

    if (!street) { setError('street', 'error-street', 'Street address is required.'); ok = false; }
    if (!city)   { setError('city',   'error-city',   'City is required.'); ok = false; }
    if (!zip || !/^\d{5}(-\d{4})?$/.test(zip)) {
      setError('zip', 'error-zip', 'Valid 5-digit ZIP code is required.');
      ok = false;
    }
  }

  return ok;
}

function showFormAlert(msg) {
  if (!formAlert) return;
  formAlert.textContent = msg;
  formAlert.classList.add('visible');
  formAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideFormAlert() {
  formAlert?.classList.remove('visible');
}

/* ── Clear per-field errors on input ─────────────────── */
['customer-name', 'customer-email', 'customer-phone', 'delivery-date',
 'street', 'city', 'zip'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    document.getElementById(id).classList.remove('has-error');
    const errEl = document.getElementById(`error-${id.replace('customer-', '')}`);
    if (errEl) errEl.classList.remove('visible');
  });
});

/* ── Form submit ────────────────────────────────────── */
let isSubmitting = false;

form?.addEventListener('submit', async e => {
  e.preventDefault();
  if (isSubmitting) return;

  hideFormAlert();
  if (!validateForm()) return;

  isSubmitting = true;
  if (submitBtn)   submitBtn.disabled  = true;
  if (btnText)     btnText.textContent = 'Processing…';
  if (btnSpinner)  btnSpinner.style.display = 'inline-block';

  const method = getDeliveryMethod();
  const isGift = isGiftBox?.checked || false;

  // Phone — send formatted (XXX) XXX-XXXX for nicer admin display
  const phoneRaw  = document.getElementById('customer-phone')?.value || '';
  const phoneDigs = phoneRaw.replace(/\D/g, '');
  const phoneFmt  = formatPhone(phoneDigs);

  const payload = {
    items: cart.map(i => ({
      id:     i.id,
      qty:    i.qty,
      addons: Array.isArray(i.addons) ? i.addons.map(a => ({ id: a.id })) : [],
    })),
    customer: {
      name:  document.getElementById('customer-name').value.trim(),
      email: document.getElementById('customer-email').value.trim().toLowerCase(),
      phone: phoneFmt,
    },
    delivery: {
      method,
      date:  dateInput.value,
      ...(method === 'delivery' && {
        address: {
          street: document.getElementById('street').value.trim(),
          city:   document.getElementById('city').value.trim(),
          state:  document.getElementById('state').value.trim() || 'FL',
          zip:    document.getElementById('zip').value.trim(),
        },
      }),
      ...(isGift && {
        recipientName: document.getElementById('recipient-name')?.value.trim() || undefined,
        cardMessage:   document.getElementById('card-message')?.value.trim()   || undefined,
      }),
      specialInstructions:
        document.getElementById('special-instructions')?.value.trim() || undefined,
    },
  };

  try {
    const res  = await fetch('/api/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong. Please try again.');
    }

    // Redirect to Stripe Checkout — do not clear cart until payment confirmed
    window.location.href = data.url;

  } catch (err) {
    showFormAlert(err.message);
    isSubmitting = false;
    if (submitBtn)  submitBtn.disabled = false;
    if (btnText)    btnText.textContent = 'Continue to Payment';
    if (btnSpinner) btnSpinner.style.display = 'none';
  }
});

/* ── Init ───────────────────────────────────────────── */
renderSummary();

})();
