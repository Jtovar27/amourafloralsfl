/* ═══════════════════════════════════════════════════
   AMOURA FLORALS — checkout.js
   Handles checkout form: cart summary, validation,
   delivery toggles, and submission to /api/checkout.
═══════════════════════════════════════════════════ */

const TAX_RATE    = 0.07;
const SHIPPING_FEE = 15.00;

/* ── Cart ───────────────────────────────────────────── */
const cart = JSON.parse(localStorage.getItem('amoura_cart') || '[]');

if (!cart.length) {
  window.location.href = 'shop.html';
}

/* ── DOM refs ───────────────────────────────────────── */
const form        = document.getElementById('checkout-form');
const submitBtn   = document.getElementById('submit-btn');
const btnText     = submitBtn?.querySelector('.btn-text');
const btnSpinner  = submitBtn?.querySelector('.btn-spinner');
const formAlert   = document.getElementById('form-alert');
const addressFlds = document.getElementById('address-fields');
const giftFields  = document.getElementById('gift-fields');
const isGiftBox   = document.getElementById('is-gift');
const dateInput   = document.getElementById('delivery-date');

/* ── Set minimum delivery date (today + 2 days) ─────── */
const minDate = new Date();
minDate.setDate(minDate.getDate() + 2);
dateInput.min = minDate.toISOString().split('T')[0];

/* ── Order summary rendering ────────────────────────── */
function getDeliveryMethod() {
  return document.querySelector('input[name="delivery_method"]:checked')?.value || 'pickup';
}

function renderSummary() {
  const method    = getDeliveryMethod();
  const subtotal  = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping  = method === 'delivery' ? SHIPPING_FEE : 0;
  const tax       = (subtotal + shipping) * TAX_RATE;
  const total     = subtotal + shipping + tax;

  const itemsEl = document.getElementById('summary-items');
  if (itemsEl) {
    itemsEl.innerHTML = cart.map(i => `
      <div class="summary-item">
        <div class="summary-item-info">
          <span class="summary-item-name">${i.name}</span>
          <span class="summary-item-qty">Qty: ${i.qty}</span>
        </div>
        <span class="summary-item-price">$${(i.price * i.qty).toFixed(2)}</span>
      </div>`).join('');
  }

  document.getElementById('summary-subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('summary-shipping').textContent  = shipping > 0 ? `$${shipping.toFixed(2)}` : 'Free';
  document.getElementById('summary-tax').textContent       = `$${tax.toFixed(2)}`;
  document.getElementById('summary-total').textContent     = `$${total.toFixed(2)}`;
}

/* ── Delivery method toggle ─────────────────────────── */
document.querySelectorAll('input[name="delivery_method"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isDelivery = radio.value === 'delivery';

    // Toggle address section
    addressFlds.classList.toggle('hidden', !isDelivery);
    addressFlds.setAttribute('aria-hidden', String(!isDelivery));

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
  giftFields.style.display = this.checked ? 'block' : 'none';
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

  const name  = document.getElementById('customer-name').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const date  = dateInput.value;

  setError('customer-name',  'error-name',  '');
  setError('customer-email', 'error-email', '');
  setError('customer-phone', 'error-phone', '');
  setError('delivery-date',  'error-date',  '');

  if (!name)  { setError('customer-name',  'error-name',  'Full name is required.'); ok = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError('customer-email', 'error-email', 'Valid email address is required.'); ok = false;
  }
  if (!phone) { setError('customer-phone', 'error-phone', 'Phone number is required.'); ok = false; }
  if (!date)  { setError('delivery-date',  'error-date',  'Please select a delivery date.'); ok = false; }

  if (method === 'delivery') {
    const street = document.getElementById('street').value.trim();
    const city   = document.getElementById('city').value.trim();
    const zip    = document.getElementById('zip').value.trim();

    setError('street', 'error-street', '');
    setError('city',   'error-city',   '');
    setError('zip',    'error-zip',    '');

    if (!street) { setError('street', 'error-street', 'Street address is required.'); ok = false; }
    if (!city)   { setError('city',   'error-city',   'City is required.'); ok = false; }
    if (!zip || !/^\d{5}(-\d{4})?$/.test(zip)) {
      setError('zip', 'error-zip', 'Valid 5-digit ZIP code is required.'); ok = false;
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
  submitBtn.disabled  = true;
  btnText.textContent = 'Processing…';
  btnSpinner.style.display = 'inline-block';

  const method = getDeliveryMethod();
  const isGift = isGiftBox?.checked || false;

  const payload = {
    items: cart.map(i => ({ id: i.id, qty: i.qty })),
    customer: {
      name:  document.getElementById('customer-name').value.trim(),
      email: document.getElementById('customer-email').value.trim(),
      phone: document.getElementById('customer-phone').value.trim(),
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
    isSubmitting          = false;
    submitBtn.disabled    = false;
    btnText.textContent   = 'Continue to Payment';
    btnSpinner.style.display = 'none';
  }
});

/* ── Init ───────────────────────────────────────────── */
renderSummary();
