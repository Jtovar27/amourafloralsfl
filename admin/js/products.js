/* Amoura Admin — Products Page */

const MEDIA_BUCKET   = 'media';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg','image/png','image/webp','image/gif'];

let allProducts = [];
let filteredProducts = [];
let isUploadingImage = false;
let addonsState = [];

function genAddonId() {
  return 'a_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function renderAddons() {
  const container = document.getElementById('addons-list');
  if (!container) return;

  if (!addonsState.length) {
    container.innerHTML = `<p class="addons-empty">No add-ons yet. Click "+ Add Option" to create one.</p>`;
    return;
  }

  container.innerHTML = addonsState.map((a, i) => {
    const priceUsd = ((a.price_cents || 0) / 100).toFixed(2);
    return `
      <div class="addon-row" data-addon-index="${i}">
        <div class="addon-field addon-name">
          <input type="text" data-addon-key="name" placeholder="e.g. Premium Vase" value="${escapeHtml(a.name || '')}" />
        </div>
        <div class="addon-field addon-price">
          <span class="addon-price-prefix">$</span>
          <input type="number" data-addon-key="price" min="0" step="0.01" placeholder="0.00" value="${escapeHtml(priceUsd)}" />
        </div>
        <div class="addon-field addon-active">
          <label class="switch"><input type="checkbox" data-addon-key="active" ${a.active !== false ? 'checked' : ''} /><span class="slider"></span></label>
        </div>
        <div class="addon-field addon-remove">
          <button type="button" class="btn-icon" data-addon-key="remove" title="Remove add-on" aria-label="Remove add-on">
            <svg width="14" height="14" fill="none" stroke="#ef4444" stroke-width="1.6" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function addAddon() {
  addonsState.push({ id: genAddonId(), name: '', price_cents: 0, active: true });
  renderAddons();
  const container = document.getElementById('addons-list');
  if (container) {
    const inputs = container.querySelectorAll('input[data-addon-key="name"]');
    const last = inputs[inputs.length - 1];
    if (last) last.focus();
  }
}

function handleAddonsListInput(e) {
  const target = e.target;
  if (!target.matches('input[data-addon-key]')) return;
  const row = target.closest('.addon-row');
  if (!row) return;
  const idx = parseInt(row.dataset.addonIndex, 10);
  if (!Number.isFinite(idx) || !addonsState[idx]) return;

  const key = target.dataset.addonKey;
  if (key === 'name') {
    addonsState[idx].name = target.value;
  } else if (key === 'price') {
    const cents = Math.round(parseFloat(target.value) * 100);
    addonsState[idx].price_cents = Number.isFinite(cents) ? Math.max(0, cents) : 0;
  } else if (key === 'active') {
    addonsState[idx].active = target.checked;
  }
}

function handleAddonsListClick(e) {
  const btn = e.target.closest('button[data-addon-key="remove"]');
  if (!btn) return;
  const row = btn.closest('.addon-row');
  if (!row) return;
  const idx = parseInt(row.dataset.addonIndex, 10);
  if (!Number.isFinite(idx)) return;
  addonsState.splice(idx, 1);
  renderAddons();
}

async function loadProducts() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '<tr><td data-label="" colspan="8"><div class="loading-overlay"><div class="spinner"></div> Loading…</div></td></tr>';

  try {
    const res  = await adminFetch('/api/admin/products');
    const data = await res.json();
    allProducts = data.products || [];
    applyFilter();
  } catch (err) {
    tbody.innerHTML = `<tr><td data-label="" colspan="8"><div class="empty-state"><p>Failed to load products: ${err.message}</p></div></td></tr>`;
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
    tbody.innerHTML = `<tr><td data-label="" colspan="8"><div class="empty-state"><p>No products found.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filteredProducts.map(p => `
    <tr data-product-id="${escapeHtml(p.id)}">
      <td data-label="Image">
        ${p.image_url
          ? `<img class="product-thumb" src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
          : `<div class="product-thumb-placeholder"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`}
      </td>
      <td data-label="Name">
        <div style="font-weight:600;font-size:.85rem">${escapeHtml(p.name)}</div>
        ${p.description ? `<div style="font-size:.75rem;color:var(--muted);margin-top:2px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.description)}</div>` : ''}
      </td>
      <td data-label="Category"><span class="badge badge-gray">${escapeHtml(p.category)}</span></td>
      <td data-label="Price">${formatPrice(p.price)}</td>
      <td data-label="Status">${p.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
      <td data-label="Best Seller">${p.featured ? '<span class="badge badge-blue">Best Seller</span>' : '<span style="color:var(--muted);font-size:.8rem">—</span>'}</td>
      <td data-label="Sort" style="color:var(--muted);font-size:.82rem">${escapeHtml(p.sort_order)}</td>
      <td data-label="" class="actions">
        <button class="btn-icon" title="Edit" data-action="edit">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" title="${p.active ? 'Deactivate' : 'Activate'}" data-action="toggle" data-active="${p.active ? '1' : '0'}">
          ${p.active
            ? `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
            : `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`}
        </button>
        <button class="btn-icon" title="Delete" data-action="delete">
          <svg width="14" height="14" fill="none" stroke="#ef4444" stroke-width="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function handleProductAction(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('tr[data-product-id]');
  if (!row) return;
  const id = row.dataset.productId;
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  switch (btn.dataset.action) {
    case 'edit':   return openEditModal(id);
    case 'toggle': return toggleActive(id, product.active);
    case 'delete': return deleteProduct(id, product.name);
  }
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
  addonsState = [];
  renderAddons();
  setImagePreview('');
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
  addonsState = Array.isArray(p.addons) ? JSON.parse(JSON.stringify(p.addons)) : [];
  renderAddons();
  setImagePreview(p.image_url || '');
  clearErrors();
  openModal('product-modal');
}

// ── Image upload (Supabase Storage) ─────────────────────────────────────────

function setImagePreview(url) {
  const zone     = document.getElementById('image-upload-zone');
  const empty    = document.getElementById('image-upload-empty');
  const preview  = document.getElementById('image-upload-preview');
  const previewImg = document.getElementById('f-image-preview');
  const overlay  = document.getElementById('image-upload-overlay');
  const hidden   = document.getElementById('f-image');

  hidden.value = url || '';

  if (url) {
    previewImg.src = url;
    empty.hidden   = true;
    preview.hidden = false;
    overlay.hidden = true;
    zone.dataset.state = 'filled';
  } else {
    previewImg.removeAttribute('src');
    empty.hidden   = false;
    preview.hidden = true;
    overlay.hidden = true;
    zone.dataset.state = 'empty';
  }
}

function setUploadOverlay(visible, label) {
  const overlay = document.getElementById('image-upload-overlay');
  const status  = document.getElementById('image-upload-status');
  if (label && status) status.textContent = label;
  if (overlay) overlay.hidden = !visible;
}

function setUploadingState(uploading) {
  isUploadingImage = uploading;
  const saveBtn = document.getElementById('btn-save-product');
  if (saveBtn) {
    saveBtn.disabled = uploading;
    if (uploading) saveBtn.dataset.prevText = saveBtn.textContent;
    saveBtn.textContent = uploading ? 'Uploading image…' : (saveBtn.dataset.prevText || 'Save Product');
  }
}

async function handleImageFile(file) {
  if (!file) return;

  const errEl = document.getElementById('err-image');
  errEl.textContent = '';

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    errEl.textContent = 'Use a JPEG, PNG, WebP, or GIF image.';
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    errEl.textContent = 'Image is over 5 MB. Pick a smaller one.';
    return;
  }

  // Show local preview immediately for snappy UX
  const localUrl = URL.createObjectURL(file);
  setImagePreview(localUrl);
  setUploadOverlay(true, 'Uploading…');
  setUploadingState(true);

  try {
    const sb = await getSupabaseClient();
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error } = await sb.storage.from(MEDIA_BUCKET).upload(safeName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

    if (error) throw error;

    const { data: pub } = sb.storage.from(MEDIA_BUCKET).getPublicUrl(safeName);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) throw new Error('Could not resolve public URL.');

    // Swap the blob preview for the real public URL
    setImagePreview(publicUrl);
    URL.revokeObjectURL(localUrl);
    showToast('Image uploaded.', 'success');
  } catch (err) {
    console.error('Image upload failed:', err);
    errEl.textContent = err.message || 'Upload failed. Try again.';
    setImagePreview('');
    URL.revokeObjectURL(localUrl);
    showToast('Image upload failed.', 'error');
  } finally {
    setUploadingState(false);
    setUploadOverlay(false);
  }
}

function setupImageUpload() {
  const zone     = document.getElementById('image-upload-zone');
  const fileIn   = document.getElementById('f-image-file');
  const replace  = document.getElementById('btn-replace-image');
  const remove   = document.getElementById('btn-remove-image');

  // Click on empty zone → open picker
  zone.addEventListener('click', e => {
    // Ignore clicks on action buttons inside the preview
    if (e.target.closest('.image-action-btn')) return;
    if (zone.dataset.state === 'empty') fileIn.click();
  });

  // Drag & drop (desktop)
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImageFile(file);
  });

  fileIn.addEventListener('change', () => {
    const file = fileIn.files?.[0];
    if (file) handleImageFile(file);
    fileIn.value = ''; // allow re-selecting the same file
  });

  replace.addEventListener('click', e => {
    e.stopPropagation();
    fileIn.click();
  });

  remove.addEventListener('click', e => {
    e.stopPropagation();
    setImagePreview('');
    document.getElementById('err-image').textContent = '';
  });
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

  if (isUploadingImage) {
    showToast('Image is still uploading. Wait a moment.', 'info');
    return;
  }

  // Sanitize add-ons
  const cleanAddons = addonsState
    .map(a => ({
      id: a.id || genAddonId(),
      name: (a.name || '').trim(),
      price_cents: Number.isFinite(a.price_cents) ? Math.max(0, Math.round(a.price_cents)) : 0,
      active: a.active !== false,
    }))
    .filter(a => a.name);

  // Validate add-ons
  if (cleanAddons.some(a => a.price_cents < 0)) {
    showToast('Add-on prices must be 0 or greater.', 'error');
    return;
  }
  const seenNames = new Set();
  for (const a of cleanAddons) {
    const key = a.name.toLowerCase();
    if (seenNames.has(key)) {
      showToast('Add-on names must be unique.', 'error');
      return;
    }
    seenNames.add(key);
  }

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
    addons:      cleanAddons,
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

  setupImageUpload();

  document.getElementById('btn-add-product').addEventListener('click', openAddModal);
  document.getElementById('btn-save-product').addEventListener('click', saveProduct);
  document.getElementById('btn-cancel-modal').addEventListener('click', () => closeModal('product-modal'));

  document.getElementById('btn-add-addon').addEventListener('click', addAddon);
  const addonsListEl = document.getElementById('addons-list');
  addonsListEl.addEventListener('input',  handleAddonsListInput);
  addonsListEl.addEventListener('change', handleAddonsListInput);
  addonsListEl.addEventListener('click',  handleAddonsListClick);

  const searchInput    = document.getElementById('search-input');
  const filterCategory = document.getElementById('filter-category');
  searchInput.addEventListener('input',    debounce(applyFilter, 280));
  filterCategory.addEventListener('change', applyFilter);

  // Event delegation: row action buttons (edit / toggle active / delete).
  // Replaces inline onclick="…" — values like product names are user-controlled
  // and unsafe to interpolate into onclick attributes.
  document.getElementById('products-tbody').addEventListener('click', handleProductAction);
})();
