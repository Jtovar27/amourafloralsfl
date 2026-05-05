/* Amoura Admin — Orders Page */

let currentPage  = 1;
let totalOrders  = 0;
const PAGE_LIMIT = 20;
let currentOrderId = null;

async function loadOrders() {
  const tbody  = document.getElementById('orders-tbody');
  const search = document.getElementById('search-input').value.trim();
  const status = document.getElementById('filter-status').value;

  tbody.innerHTML = '<tr><td colspan="9"><div class="loading-overlay"><div class="spinner"></div> Loading…</div></td></tr>';

  const params = new URLSearchParams({ page: currentPage, limit: PAGE_LIMIT });
  if (search) params.set('search', search);
  if (status) params.set('status', status);

  try {
    const res  = await adminFetch(`/api/admin/orders?${params}`);
    const data = await res.json();

    const orders = data.orders || [];
    totalOrders  = data.total  || 0;

    document.getElementById('orders-count-label').textContent =
      `${totalOrders} order${totalOrders !== 1 ? 's' : ''} total`;

    updatePagination();

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>No orders found.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr data-order-id="${escapeHtml(o.id)}">
        <td><a href="#" class="order-link" style="color:var(--accent);font-weight:600">${escapeHtml(o.order_number)}</a></td>
        <td>
          <div style="font-weight:500">${escapeHtml(o.customer_name)}</div>
          <div style="font-size:.75rem;color:var(--muted)">${escapeHtml(o.customer_email)}</div>
        </td>
        <td style="font-size:.8rem;color:var(--muted)">—</td>
        <td>${formatPrice(o.total_amount)}</td>
        <td>${statusBadge(o.order_status)}</td>
        <td>${statusBadge(o.payment_status)}</td>
        <td>
          <span class="badge badge-gray">${escapeHtml(o.delivery_method)}</span>
          ${o.delivery_date ? `<div style="font-size:.72rem;color:var(--muted);margin-top:2px">${formatDate(o.delivery_date)}</div>` : ''}
        </td>
        <td style="font-size:.8rem;white-space:nowrap">${formatDateTime(o.created_at)}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-action="view">View</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>Failed to load orders: ${err.message}</p></div></td></tr>`;
  }
}

function updatePagination() {
  const totalPages = Math.ceil(totalOrders / PAGE_LIMIT);
  const info       = document.getElementById('pagination-info');
  const prevBtn    = document.getElementById('btn-prev');
  const nextBtn    = document.getElementById('btn-next');

  const from = totalOrders === 0 ? 0 : (currentPage - 1) * PAGE_LIMIT + 1;
  const to   = Math.min(currentPage * PAGE_LIMIT, totalOrders);
  info.textContent = totalOrders ? `Showing ${from}–${to} of ${totalOrders}` : '';

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

async function openOrderModal(orderId) {
  currentOrderId = orderId;
  const body = document.getElementById('order-modal-body');
  body.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Loading…</div>';
  openModal('order-modal');

  try {
    const res  = await adminFetch(`/api/admin/orders?id=${orderId}`);
    const data = await res.json();
    const o    = data.order;

    document.getElementById('order-modal-title').textContent = `Order ${o.order_number}`;

    const addr = o.shipping_address
      ? `${o.shipping_address.street}, ${o.shipping_address.city}, ${o.shipping_address.state} ${o.shipping_address.zip}`
      : 'Pickup';

    const itemsHtml = (o.items || []).map(i => {
      const addons = Array.isArray(i.selected_addons) ? i.selected_addons : [];
      const addonsLine = addons.length
        ? `<div style="margin-top:.25rem;padding-left:.75rem;font-size:.78rem;font-style:italic;color:var(--sage)">${addons.map(a => `+ ${escapeHtml(a.name || '')}`).join(' · ')}</div>`
        : '';
      return `
      <div style="padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.85rem">
        <div style="display:flex;justify-content:space-between">
          <span>${escapeHtml(i.product_name)} × ${escapeHtml(i.quantity)}</span>
          <span>${formatPrice(i.line_total)}</span>
        </div>
        ${addonsLine}
      </div>`;
    }).join('') || '<p style="color:var(--muted);font-size:.85rem">No items recorded.</p>';

    const email = o.customer_email || '';
    const phone = o.customer_phone || '';
    const emailHtml = email
      ? `<a href="mailto:${escapeHtml(email)}" style="color:var(--accent);text-decoration:none">${escapeHtml(email)}</a> <button type="button" data-copy="${escapeHtml(email)}" data-copy-label="Email" class="btn btn-ghost btn-sm" style="padding:1px 6px;font-size:.7rem;margin-left:4px" title="Copy email">Copy</button>`
      : '—';
    const phoneHtml = phone
      ? `<a href="tel:${escapeHtml(phone)}" style="color:var(--accent);text-decoration:none">${escapeHtml(phone)}</a> <button type="button" data-copy="${escapeHtml(phone)}" data-copy-label="Phone" class="btn btn-ghost btn-sm" style="padding:1px 6px;font-size:.7rem;margin-left:4px" title="Copy phone">Copy</button>`
      : '—';

    body.innerHTML = `
      <p style="font-size:.78rem;color:var(--muted);margin:-.25rem 0 1rem">Placed ${formatDateTime(o.created_at)}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem">
        <div>
          <p style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;margin-bottom:.3rem">Customer</p>
          <p style="font-weight:600">${escapeHtml(o.customer_name)}</p>
          <p style="font-size:.83rem">${emailHtml}</p>
          <p style="font-size:.83rem">${phoneHtml}</p>
        </div>
        <div>
          <p style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;margin-bottom:.3rem">Delivery</p>
          <p style="font-size:.83rem;font-weight:500">${o.delivery_method === 'delivery' ? 'Local Delivery' : 'Pickup'}</p>
          <p style="font-size:.83rem">${escapeHtml(addr)}</p>
          ${o.delivery_date ? `<p style="font-size:.83rem">Date: ${formatDate(o.delivery_date)}</p>` : ''}
        </div>
      </div>

      ${o.recipient_name || o.card_message ? `
        <div style="background:var(--bg);border-radius:6px;padding:.75rem 1rem;margin-bottom:1rem;font-size:.83rem">
          ${o.recipient_name ? `<p><strong>Recipient:</strong> ${escapeHtml(o.recipient_name)}</p>` : ''}
          ${o.card_message   ? `<p style="margin-top:.25rem"><strong>Card:</strong> ${escapeHtml(o.card_message)}</p>` : ''}
        </div>` : ''}

      ${o.special_instructions ? `
        <div style="background:var(--warning-bg);border-radius:6px;padding:.75rem 1rem;margin-bottom:1rem;font-size:.83rem;color:var(--warning)">
          <strong>Special Instructions:</strong> ${escapeHtml(o.special_instructions)}
        </div>` : ''}

      <div style="margin-bottom:1rem">
        <p style="font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;margin-bottom:.5rem">Items</p>
        ${itemsHtml}
        <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-size:.83rem;color:var(--muted)">
          <span>Subtotal</span><span>${formatPrice(o.subtotal)}</span>
        </div>
        ${o.shipping_amount ? `<div style="display:flex;justify-content:space-between;padding:.2rem 0;font-size:.83rem;color:var(--muted)"><span>Shipping</span><span>${formatPrice(o.shipping_amount)}</span></div>` : ''}
        ${o.tax_amount ? `<div style="display:flex;justify-content:space-between;padding:.2rem 0;font-size:.83rem;color:var(--muted)"><span>Tax</span><span>${formatPrice(o.tax_amount)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:.5rem 0;font-weight:700;border-top:1px solid var(--border);margin-top:.25rem">
          <span>Total</span><span>${formatPrice(o.total_amount)}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
        <div class="form-group">
          <label>Order Status</label>
          <select id="modal-order-status">
            ${['pending','confirmed','processing','completed','cancelled'].map(s =>
              `<option value="${s}"${o.order_status === s ? ' selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Payment</label>
          <p style="padding:.55rem 0;font-size:.85rem">${statusBadge(o.payment_status)}</p>
        </div>
      </div>

      <div class="form-group">
        <label>Internal Notes</label>
        <textarea id="modal-internal-notes" rows="3" placeholder="Notes visible only to admins…"></textarea>
      </div>

      <div class="form-group">
        <label>Payment Details</label>
        <div style="background:var(--bg);border-radius:6px;padding:.75rem 1rem;font-size:.83rem;display:grid;gap:.5rem">
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="color:var(--muted);min-width:90px">Status</span>
            <span>${statusBadge(o.payment_status)}</span>
          </div>
          ${o.payment_provider ? `
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="color:var(--muted);min-width:90px">Provider</span>
            <span>${escapeHtml(o.payment_provider)}</span>
          </div>` : ''}
          ${o.stripe_payment_intent ? `
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span style="color:var(--muted);min-width:90px">Payment Intent</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem;background:var(--off-white);padding:2px 6px;border-radius:3px">${escapeHtml(o.stripe_payment_intent)}</span>
            <a href="https://dashboard.stripe.com/payments/${encodeURIComponent(o.stripe_payment_intent)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="padding:1px 8px;font-size:.72rem">Open in Stripe ↗</a>
          </div>` : ''}
          ${o.stripe_session_id ? `
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span style="color:var(--muted);min-width:90px">Session</span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem;background:var(--off-white);padding:2px 6px;border-radius:3px">${escapeHtml(o.stripe_session_id)}</span>
            <a href="https://dashboard.stripe.com/checkout/sessions/${encodeURIComponent(o.stripe_session_id)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="padding:1px 8px;font-size:.72rem">Open in Stripe ↗</a>
          </div>` : ''}
          ${!o.stripe_payment_intent && !o.stripe_session_id ? `
          <div style="color:var(--muted);font-size:.78rem;font-style:italic">No Stripe references on file.</div>` : ''}
        </div>
      </div>
    `;

    // Set notes via .value to avoid HTML interpretation of admin-typed content
    document.getElementById('modal-internal-notes').value = o.internal_notes || '';

    // Wire up "Copy" mini buttons (defensive: never throw, never submit form)
    body.querySelectorAll('button[data-copy]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const value = btn.getAttribute('data-copy') || '';
        const label = btn.getAttribute('data-copy-label') || 'Value';
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(
              () => showToast(`${label} copied.`),
              () => {}
            );
          }
        } catch (_) {
          // silent
        }
      });
    });

  } catch (err) {
    body.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent = `Failed to load order: ${err.message}`;
    wrap.appendChild(p);
    body.appendChild(wrap);
  }
}

async function saveOrderStatus() {
  if (!currentOrderId) return;

  const status = document.getElementById('modal-order-status')?.value;
  const notes  = document.getElementById('modal-internal-notes')?.value.trim() || null;

  const btn = document.getElementById('btn-save-status');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    const res = await adminFetch('/api/admin/orders', {
      method: 'PUT',
      body: JSON.stringify({ id: currentOrderId, order_status: status, internal_notes: notes }),
    });
    if (!res.ok) throw new Error((await res.json()).error);

    showToast('Order updated.');
    closeModal('order-modal');
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Status';
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

(async () => {
  const session = await initAdmin();
  if (!session) return;

  await loadOrders();

  document.getElementById('btn-save-status').addEventListener('click', saveOrderStatus);

  const searchInput  = document.getElementById('search-input');
  const filterStatus = document.getElementById('filter-status');

  searchInput.addEventListener('input', debounce(() => { currentPage = 1; loadOrders(); }, 300));
  filterStatus.addEventListener('change', () => { currentPage = 1; loadOrders(); });

  document.getElementById('btn-prev').addEventListener('click', () => { currentPage--; loadOrders(); });
  document.getElementById('btn-next').addEventListener('click', () => { currentPage++; loadOrders(); });

  // Event delegation for "View" / order-number link clicks
  document.getElementById('orders-tbody').addEventListener('click', e => {
    const row = e.target.closest('tr[data-order-id]');
    if (!row) return;
    const link = e.target.closest('.order-link');
    const action = e.target.closest('button[data-action]');
    if (link || action) {
      e.preventDefault();
      openOrderModal(row.dataset.orderId);
    }
  });

  // Pre-open order if URL has ?id=
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) openOrderModal(id);
})();
