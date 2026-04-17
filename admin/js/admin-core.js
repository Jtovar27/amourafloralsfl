/* Amoura Florals — Admin Core: Auth, API helpers, UI utilities */

let _supabase = null;
let _config   = null;

async function loadConfig() {
  if (_config) return _config;
  const res = await fetch('/api/admin/config');
  if (!res.ok) throw new Error('Could not load configuration. Check SUPABASE_URL and SUPABASE_ANON_KEY env vars.');
  _config = await res.json();
  return _config;
}

async function getSupabaseClient() {
  if (_supabase) return _supabase;
  const cfg = await loadConfig();
  _supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, storageKey: 'amoura_admin_session' },
  });
  return _supabase;
}

async function getSession() {
  const sb = await getSupabaseClient();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

async function getToken() {
  const session = await getSession();
  return session?.access_token || null;
}

// Verify admin + return session. Redirects to /admin/ if not authenticated/authorized.
async function initAdmin() {
  try {
    const token = await getToken();
    if (!token) { window.location.href = '/admin/'; return null; }

    // Verify admin role via protected endpoint
    const res = await fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      await adminLogout(false);
      window.location.href = '/admin/';
      return null;
    }

    // Set user email in sidebar
    const session = await getSession();
    const emailEl = document.getElementById('sb-user-email');
    if (emailEl && session?.user?.email) emailEl.textContent = session.user.email;

    return session;
  } catch (err) {
    console.error('initAdmin error:', err);
    window.location.href = '/admin/';
    return null;
  }
}

async function adminLogout(redirect = true) {
  try {
    const sb = await getSupabaseClient();
    await sb.auth.signOut();
  } catch {}
  if (redirect) window.location.href = '/admin/';
}

// Fetch wrapper that injects JWT and handles auth errors
async function adminFetch(url, opts = {}) {
  const token = await getToken();
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (res.status === 401 || res.status === 403) {
    showToast('Session expired. Redirecting to login...', 'error');
    setTimeout(() => { window.location.href = '/admin/'; }, 1500);
    throw new Error('Unauthorized');
  }
  return res;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'success') {
  let el = document.getElementById('admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'admin-toast';
    el.className = 'admin-toast';
    document.body.appendChild(el);
  }
  clearTimeout(_toastTimer);
  el.textContent = msg;
  el.className = `admin-toast ${type} show`;
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function showConfirm(msg, title = 'Confirm action') {
  return new Promise(resolve => {
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirm-overlay';
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <p class="confirm-title" id="confirm-title"></p>
          <p class="confirm-msg"   id="confirm-msg"></p>
          <div class="confirm-actions">
            <button class="btn btn-ghost btn-sm" id="confirm-cancel">Cancel</button>
            <button class="btn btn-danger btn-sm" id="confirm-ok">Delete</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent   = msg;
    overlay.classList.add('open');

    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');

    function cleanup(result) {
      overlay.classList.remove('open');
      ok.replaceWith(ok.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));
      resolve(result);
    }

    document.getElementById('confirm-ok').addEventListener('click',     () => cleanup(true),  { once: true });
    document.getElementById('confirm-cancel').addEventListener('click', () => cleanup(false), { once: true });
  });
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
  if (e.target.classList.contains('modal-close')) {
    e.target.closest('.modal-overlay')?.classList.remove('open');
  }
});

// ── Formatting ────────────────────────────────────────────────────────────────
function formatPrice(cents) {
  return '$' + (cents / 100).toFixed(2).replace(/\.00$/, '');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Order status badge ────────────────────────────────────────────────────────
const STATUS_CLASS = {
  pending:    'badge-yellow',
  confirmed:  'badge-blue',
  processing: 'badge-blue',
  completed:  'badge-green',
  cancelled:  'badge-red',
  paid:       'badge-green',
  failed:     'badge-red',
  refunded:   'badge-gray',
};
function statusBadge(status) {
  const cls = STATUS_CLASS[status] || 'badge-gray';
  return `<span class="badge ${cls}">${status}</span>`;
}

// ── Sidebar mobile toggle ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const toggle  = document.getElementById('sb-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('sb-overlay');
  const logoutBtn = document.getElementById('btn-logout');

  function closeSidebar() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  }

  toggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', closeSidebar);

  logoutBtn?.addEventListener('click', () => adminLogout());
});

// Expose globally
window.initAdmin      = initAdmin;
window.adminLogout    = adminLogout;
window.adminFetch     = adminFetch;
window.getToken       = getToken;
window.getSupabaseClient = getSupabaseClient;
window.showToast      = showToast;
window.showConfirm    = showConfirm;
window.openModal      = openModal;
window.closeModal     = closeModal;
window.formatPrice    = formatPrice;
window.formatDate     = formatDate;
window.formatDateTime = formatDateTime;
window.debounce       = debounce;
window.statusBadge    = statusBadge;
