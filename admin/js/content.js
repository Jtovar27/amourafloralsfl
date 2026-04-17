/* Amoura Admin — Content Page */

// ── Tabs ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── FAQs ──────────────────────────────────────────────────────────────────────

let allFaqs = [];

async function loadFaqs() {
  const tbody = document.getElementById('faqs-tbody');
  tbody.innerHTML = '<tr><td colspan="4"><div class="loading-overlay"><div class="spinner"></div> Loading…</div></td></tr>';

  try {
    const res  = await adminFetch('/api/admin/content?type=faqs');
    const data = await res.json();
    allFaqs = data.faqs || [];
    renderFaqs();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>Failed to load FAQs: ${err.message}</p></div></td></tr>`;
  }
}

function renderFaqs() {
  const tbody = document.getElementById('faqs-tbody');

  if (!allFaqs.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>No FAQs yet. Add your first one.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = allFaqs.map(f => `
    <tr>
      <td style="color:var(--muted);font-size:.82rem">${f.sort_order}</td>
      <td style="font-size:.85rem;font-weight:500;max-width:400px">${f.question}</td>
      <td>${f.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Hidden</span>'}</td>
      <td class="actions">
        <button class="btn-icon" title="Edit" onclick="openFaqEdit('${f.id}')">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" title="Delete" onclick="deleteFaq('${f.id}', '${f.question.substring(0,40).replace(/'/g,"\\'")}…')">
          <svg width="14" height="14" fill="none" stroke="#ef4444" stroke-width="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function openFaqAdd() {
  document.getElementById('faq-modal-title').textContent = 'Add FAQ';
  document.getElementById('faq-edit-id').value = '';
  document.getElementById('faq-question').value = '';
  document.getElementById('faq-answer').value   = '';
  document.getElementById('faq-sort').value     = '99';
  document.getElementById('faq-active').checked = true;
  document.getElementById('faq-err-q').textContent = '';
  document.getElementById('faq-err-a').textContent = '';
  openModal('faq-modal');
}

function openFaqEdit(id) {
  const f = allFaqs.find(f => f.id === id);
  if (!f) return;
  document.getElementById('faq-modal-title').textContent = 'Edit FAQ';
  document.getElementById('faq-edit-id').value  = f.id;
  document.getElementById('faq-question').value = f.question;
  document.getElementById('faq-answer').value   = f.answer;
  document.getElementById('faq-sort').value     = f.sort_order;
  document.getElementById('faq-active').checked = f.active;
  document.getElementById('faq-err-q').textContent = '';
  document.getElementById('faq-err-a').textContent = '';
  openModal('faq-modal');
}

async function saveFaq() {
  const id       = document.getElementById('faq-edit-id').value;
  const question = document.getElementById('faq-question').value.trim();
  const answer   = document.getElementById('faq-answer').value.trim();

  let ok = true;
  if (!question) { document.getElementById('faq-err-q').textContent = 'Question is required.'; ok = false; }
  if (!answer)   { document.getElementById('faq-err-a').textContent = 'Answer is required.';   ok = false; }
  if (!ok) return;

  const btn = document.getElementById('btn-save-faq');
  btn.disabled = true; btn.textContent = 'Saving…';

  const payload = {
    question,
    answer,
    sort_order: parseInt(document.getElementById('faq-sort').value, 10) || 99,
    active: document.getElementById('faq-active').checked,
  };
  if (id) payload.id = id;

  try {
    const method = id ? 'PUT' : 'POST';
    const res = await adminFetch('/api/admin/content?type=faqs', { method, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error((await res.json()).error);
    closeModal('faq-modal');
    showToast(id ? 'FAQ updated.' : 'FAQ created.');
    await loadFaqs();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save FAQ';
  }
}

async function deleteFaq(id, label) {
  const confirmed = await showConfirm(`Delete FAQ "${label}"?`, 'Delete FAQ');
  if (!confirmed) return;
  try {
    const res = await adminFetch(`/api/admin/content?type=faqs&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error);
    showToast('FAQ deleted.');
    await loadFaqs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Testimonials ──────────────────────────────────────────────────────────────

let allTestimonials = [];

async function loadTestimonials() {
  const tbody = document.getElementById('testimonials-tbody');
  tbody.innerHTML = '<tr><td colspan="6"><div class="loading-overlay"><div class="spinner"></div> Loading…</div></td></tr>';

  try {
    const res  = await adminFetch('/api/admin/content?type=testimonials');
    const data = await res.json();
    allTestimonials = data.testimonials || [];
    renderTestimonials();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>Failed to load testimonials.</p></div></td></tr>`;
  }
}

function renderTestimonials() {
  const tbody = document.getElementById('testimonials-tbody');

  if (!allTestimonials.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>No testimonials yet.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = allTestimonials.map(t => `
    <tr>
      <td style="color:var(--muted);font-size:.82rem">${t.sort_order}</td>
      <td>
        <div style="font-weight:600;font-size:.85rem">${t.author_name}</div>
        ${t.author_label ? `<div style="font-size:.75rem;color:var(--muted)">${t.author_label}</div>` : ''}
      </td>
      <td style="font-size:.82rem;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)">${t.content}</td>
      <td>${'⭐'.repeat(t.rating)}</td>
      <td>${t.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Hidden</span>'}</td>
      <td class="actions">
        <button class="btn-icon" title="Edit" onclick="openTestimonialEdit('${t.id}')">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" title="Delete" onclick="deleteTestimonial('${t.id}', '${t.author_name.replace(/'/g,"\\'")}')">
          <svg width="14" height="14" fill="none" stroke="#ef4444" stroke-width="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function openTestimonialAdd() {
  document.getElementById('testimonial-modal-title').textContent = 'Add Testimonial';
  document.getElementById('t-edit-id').value  = '';
  document.getElementById('t-author').value  = '';
  document.getElementById('t-label').value   = '';
  document.getElementById('t-content').value = '';
  document.getElementById('t-rating').value  = '5';
  document.getElementById('t-sort').value    = '99';
  document.getElementById('t-active').checked = true;
  document.getElementById('t-err-author').textContent  = '';
  document.getElementById('t-err-content').textContent = '';
  openModal('testimonial-modal');
}

function openTestimonialEdit(id) {
  const t = allTestimonials.find(t => t.id === id);
  if (!t) return;
  document.getElementById('testimonial-modal-title').textContent = 'Edit Testimonial';
  document.getElementById('t-edit-id').value  = t.id;
  document.getElementById('t-author').value  = t.author_name;
  document.getElementById('t-label').value   = t.author_label || '';
  document.getElementById('t-content').value = t.content;
  document.getElementById('t-rating').value  = t.rating;
  document.getElementById('t-sort').value    = t.sort_order;
  document.getElementById('t-active').checked = t.active;
  openModal('testimonial-modal');
}

async function saveTestimonial() {
  const id      = document.getElementById('t-edit-id').value;
  const author  = document.getElementById('t-author').value.trim();
  const content = document.getElementById('t-content').value.trim();

  let ok = true;
  if (!author)  { document.getElementById('t-err-author').textContent  = 'Author name is required.'; ok = false; }
  if (!content) { document.getElementById('t-err-content').textContent = 'Content is required.';     ok = false; }
  if (!ok) return;

  const btn = document.getElementById('btn-save-testimonial');
  btn.disabled = true; btn.textContent = 'Saving…';

  const payload = {
    author_name:  author,
    author_label: document.getElementById('t-label').value.trim()   || null,
    content,
    rating:       parseInt(document.getElementById('t-rating').value, 10) || 5,
    sort_order:   parseInt(document.getElementById('t-sort').value,   10) || 99,
    active:       document.getElementById('t-active').checked,
  };
  if (id) payload.id = id;

  try {
    const method = id ? 'PUT' : 'POST';
    const res = await adminFetch('/api/admin/content?type=testimonials', { method, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error((await res.json()).error);
    closeModal('testimonial-modal');
    showToast(id ? 'Testimonial updated.' : 'Testimonial created.');
    await loadTestimonials();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Testimonial';
  }
}

async function deleteTestimonial(id, name) {
  const confirmed = await showConfirm(`Delete testimonial by "${name}"?`, 'Delete Testimonial');
  if (!confirmed) return;
  try {
    const res = await adminFetch(`/api/admin/content?type=testimonials&id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error);
    showToast('Testimonial deleted.');
    await loadTestimonials();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Site Content ──────────────────────────────────────────────────────────────

let siteContentData = [];

async function loadSiteContent() {
  const body = document.getElementById('site-content-body');
  body.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Loading…</div>';

  try {
    const res  = await adminFetch('/api/admin/content?type=site_content');
    const data = await res.json();
    siteContentData = data.content || [];
    renderSiteContent();
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><p>Failed to load content: ${err.message}</p></div>`;
  }
}

function renderSiteContent() {
  const body = document.getElementById('site-content-body');

  if (!siteContentData.length) {
    body.innerHTML = '<div class="empty-state"><p>No site content keys found. Add rows to the site_content table in Supabase.</p></div>';
    return;
  }

  let currentSection = '';
  let html = '';
  siteContentData.forEach(item => {
    if (item.section !== currentSection) {
      if (currentSection) html += '</div>';
      html += `<div style="margin-bottom:1.5rem"><p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin-bottom:.75rem">${item.section || 'General'}</p><div>`;
      currentSection = item.section;
    }
    const isLong = (item.value || '').length > 80;
    html += `
      <div class="form-group">
        <label for="sc-${item.key}">${item.key}</label>
        ${isLong
          ? `<textarea id="sc-${item.key}" data-key="${item.key}" rows="3">${item.value || ''}</textarea>`
          : `<input type="text" id="sc-${item.key}" data-key="${item.key}" value="${(item.value || '').replace(/"/g, '&quot;')}" />`}
      </div>`;
  });
  if (currentSection) html += '</div></div>';
  body.innerHTML = html;
}

async function saveSiteContent() {
  const inputs  = document.getElementById('site-content-body').querySelectorAll('[data-key]');
  const updates = Array.from(inputs).map(el => ({ key: el.dataset.key, value: el.value }));

  const btn = document.getElementById('btn-save-content');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const res = await adminFetch('/api/admin/content?type=site_content', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    showToast('Site content saved.');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save All Changes';
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

(async () => {
  const session = await initAdmin();
  if (!session) return;

  await Promise.all([loadFaqs(), loadTestimonials(), loadSiteContent()]);

  document.getElementById('btn-add-faq').addEventListener('click', openFaqAdd);
  document.getElementById('btn-save-faq').addEventListener('click', saveFaq);

  document.getElementById('btn-add-testimonial').addEventListener('click', openTestimonialAdd);
  document.getElementById('btn-save-testimonial').addEventListener('click', saveTestimonial);

  document.getElementById('btn-save-content').addEventListener('click', saveSiteContent);

  window.openFaqEdit         = openFaqEdit;
  window.deleteFaq           = deleteFaq;
  window.openTestimonialEdit = openTestimonialEdit;
  window.deleteTestimonial   = deleteTestimonial;
})();
