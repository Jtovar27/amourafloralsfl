/* Amoura Admin — Products Page */

let allProducts = [];
let filteredProducts = [];

async function loadProducts() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '<tr><td colspan="8"><div class="loading-overlay"><div class="spinner"></div> Loading…</div></td></tr>';

  try {
    const res  = await adminFetch('/api/admin/products');
    const data = await res.json();
    allProducts = data.products || [];
    applyFilter();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Failed to load products: ${err.message}</p></div></td></tr>`;
  }
}

function applyFilter() {
  const q   = document.getElementById('search-input').value.toLowerCase().trim();
  const cat = document.getElementById('filter-category').value;

  filteredProducts = allProducts.filter(p => {
    const matchQ   = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    const matchCat = !cat || p.category === cat;
    return matchQ && matchCat;
  });

  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('products-tbody');

  if (!filteredProducts.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>No products found.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filteredProducts.map(p => `
    <tr>
      <td>
        ${p.image_url
          ? `<img class="product-thumb" src="${p.image_url}" alt="${p.name}" loading="lazy" />`
          : `<div class="product-thumb-placeholder"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`}
      </td>
      <td>
        <div style="font-weight:600;font-size:.85rem">${p.name}</div>
        ${p.description ? `<div style="font-size:.75rem;color:var(--muted);margin-top:2px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.description}</div>` : ''}
      </td>
      <td><span class="badge badge-gray">${p.category}</span></td>
      <td>${formatPrice(p.price)}</td>
      <td>${p.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
      <td>${p.featured ? '<span class="badge badge-blue">Featured</span>' : '<span style="color:var(--muted);font-size:.8rem">—</span>'}</td>
      <td style="color:var(--muted);font-size:.82rem">${p.sort_order}</td>
      <td class="actions">
        <button class="btn-icon" title="Edit" onclick="openEditModal('${p.id}')">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" title="${p.active ? 'Deactivate' : 'Activate'}" onclick="toggleActive('${p.id}', ${p.active})">
          ${p.active
            ? `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
            : `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`}
        </button>
        <button class="btn-icon" title="Delete" onclick="deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')">
          <svg width="14" height="14" fill="none" stroke="#ef4444" stroke-width="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Product';
  document.getElementById('edit-id').value = '';
  document.getElementById('f-name').value        = '';
  document.getElementById('f-price').value       = '';
  document.getElementById('f-category').value    = '';
  document.getElementById('f-description').value = '';
  document.getElementById('f-image').value       = '';
  document.getElementById('f-sort').value        = '0';
  document.getElementById('f-active').checked    = true;
  document.getElementById('f-featured').checked  = false;
  clearErrors();
  openModal('product-modal');
}

function openEditModal(id) {
  const p = allProducts.find(p => p.id === id);
  if (!p) return;

  document.getElementById('modal-title').textContent = 'Edit Product';
  document.getElementById('edit-id').value           = p.id;
  document.getElementById('f-name').value            = p.name;
  document.getElementById('f-price').value           = (p.price / 100).toFixed(2);
  document.getElementById('f-category').value        = p.category;
  document.getElementById('f-description').value     = p.description || '';
  document.getElementById('f-image').value           = p.image_url   || '';
  document.getElementById('f-sort').value            = p.sort_order;
  document.getElementById('f-active').checked        = p.active;
  document.getElementById('f-featured').checked      = p.featured;
  clearErrors();
  openModal('product-modal');
}

function clearErrors() {
  ['err-name', 'err-price', 'err-category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

async function saveProduct() {
  const id       = document.getElementById('edit-id').value;
  const name     = document.getElementById('f-name').value.trim();
  const priceStr = document.getElementById('f-price').value.trim();
  const category = document.getElementById('f-category').value;

  let ok = true;
  if (!name)           { document.getElementById('err-name').textContent     = 'Name is required.';     ok = false; }
  if (!priceStr || isNaN(+priceStr) || +priceStr <= 0) {
    document.getElementById('err-price').textContent = 'Enter a valid price.'; ok = false;
  }
  if (!category)       { document.getElementById('err-category').textContent = 'Category is required.'; ok = false; }
  if (!ok) return;

  const priceCents = Math.round(parseFloat(priceStr) * 100);
  const payload = {
    name,
    price:       priceCents,
    category,
    description: document.getElementById('f-description').value.trim() || null,
    image_url:   document.getElementById('f-image').value.trim()       || null,
    sort_order:  parseInt(document.getElementById('f-sort').value, 10) || 0,
    active:      document.getElementById('f-active').checked,
    featured:    document.getElementById('f-featured').checked,
  };

  const btn = document.getElementById('btn-save-product');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const method = id ? 'PUT' : 'POST';
    if (id) payload.id = id;

    const res  = await adminFetch('/api/admin/products', { method, body: JSON.stringify(payload) });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Save failed');

    closeModal('product-modal');
    showToast(id ? 'Product updated.' : 'Product created.');
    await loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Product';
  }
}

async function toggleActive(id, currentlyActive) {
  try {
    const res  = await adminFetch('/api/admin/products', {
      method: 'PUT',
      body: JSON.stringify({ id, active: !currentlyActive }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    showToast(currentlyActive ? 'Product deactivated.' : 'Product activated.');
    await loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(id, name) {
  const confirmed = await showConfirm(`Delete "${name}"? This cannot be undone.`, 'Delete Product');
  if (!confirmed) return;

  try {
    const res = await adminFetch(`/api/admin/products?id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error);
    showToast('Product deleted.');
    await loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

(async () => {
  const session = await initAdmin();
  if (!session) return;

  await loadProducts();

  document.getElementById('btn-add-product').addEventListener('click', openAddModal);
  document.getElementById('btn-save-product').addEventListener('click', saveProduct);
  document.getElementById('btn-cancel-modal').addEventListener('click', () => closeModal('product-modal'));

  const searchInput    = document.getElementById('search-input');
  const filterCategory = document.getElementById('filter-category');
  searchInput.addEventListener('input',    debounce(applyFilter, 280));
  filterCategory.addEventListener('change', applyFilter);

  // Expose for inline onclick
  window.openEditModal  = openEditModal;
  window.toggleActive   = toggleActive;
  window.deleteProduct  = deleteProduct;
})();
