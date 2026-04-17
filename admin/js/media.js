/* Amoura Admin — Media Page */

const BUCKET = 'media';
let supabase  = null;
let bucketUrl = '';

async function initMedia() {
  const session = await initAdmin();
  if (!session) return;

  const cfg = await fetch('/api/admin/config').then(r => r.json());
  supabase   = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, storageKey: 'amoura_admin_session' },
  });

  await loadMedia();
  setupUpload();

  document.getElementById('btn-refresh-media').addEventListener('click', loadMedia);
}

async function loadMedia() {
  const grid = document.getElementById('media-grid');
  const note = document.getElementById('media-note');
  grid.innerHTML = '<div class="loading-overlay" style="grid-column:1/-1"><div class="spinner"></div> Loading…</div>';
  note.style.display = 'none';

  try {
    const res  = await adminFetch('/api/admin/media');
    const data = await res.json();

    if (data.note) {
      note.textContent   = data.note;
      note.style.display = 'block';
    }

    const files = data.files || [];

    if (!files.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>No files uploaded yet.</p></div>';
      return;
    }

    grid.innerHTML = files.map(f => `
      <div class="media-item" data-name="${f.name}">
        <img src="${f.url}" alt="${f.name}" loading="lazy" onerror="this.style.background='var(--bg)';this.style.height='120px'" />
        <div class="media-item-info">
          <div class="media-item-name" title="${f.name}">${f.name}</div>
          <div class="media-item-size">${formatBytes(f.size)}</div>
        </div>
        <div class="media-item-actions">
          <button onclick="copyUrl('${f.url}')">Copy URL</button>
          <button onclick="deleteFile('${f.name}')" style="color:#ef4444">Delete</button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Failed to load media: ${err.message}</p></div>`;
  }
}

function setupUpload() {
  const zone        = document.getElementById('upload-zone');
  const fileInput   = document.getElementById('file-input');
  const progress    = document.getElementById('upload-progress');
  const statusEl    = document.getElementById('upload-status');

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  fileInput.addEventListener('change', () => {
    handleFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  async function handleFiles(files) {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'];
    const valid   = files.filter(f => allowed.includes(f.type) && f.size <= 5 * 1024 * 1024);

    if (!valid.length) {
      showToast('No valid images selected (JPEG/PNG/WebP/GIF/SVG, max 5 MB).', 'error');
      return;
    }

    progress.style.display = 'block';
    statusEl.textContent   = `Uploading 0 of ${valid.length}…`;

    let uploaded = 0;
    for (const file of valid) {
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      statusEl.textContent = `Uploading ${file.name}…`;

      const { error } = await supabase.storage.from(BUCKET).upload(safeName, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
      } else {
        uploaded++;
        statusEl.textContent = `Uploaded ${uploaded} of ${valid.length}…`;
      }
    }

    progress.style.display = 'none';
    showToast(`${uploaded} file${uploaded !== 1 ? 's' : ''} uploaded.`);
    await loadMedia();
  }
}

async function copyUrl(url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast('URL copied to clipboard.');
  } catch {
    prompt('Copy this URL:', url);
  }
}

async function deleteFile(name) {
  const confirmed = await showConfirm(`Delete "${name}"? This cannot be undone.`, 'Delete File');
  if (!confirmed) return;

  try {
    const res = await adminFetch(`/api/admin/media?path=${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error);
    showToast('File deleted.');
    await loadMedia();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

window.copyUrl    = copyUrl;
window.deleteFile = deleteFile;

initMedia();
