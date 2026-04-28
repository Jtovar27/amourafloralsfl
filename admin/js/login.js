/* Amoura Admin — Login Page */

(async () => {
  // If already logged in as admin, redirect to dashboard
  let sb;
  try {
    const cfg = await fetch('/api/admin/config').then(r => r.json());
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, storageKey: 'amoura_admin_session' },
    });
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const check = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (check.ok) { window.location.href = '/admin/dashboard'; return; }
    }
  } catch {}

  const form     = document.getElementById('login-form');
  const errorEl  = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.classList.remove('show');
    loginBtn.textContent = 'Signing in…';
    loginBtn.disabled = true;

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const cfg = await fetch('/api/admin/config').then(r => r.json());
      if (!sb) {
        sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: true, storageKey: 'amoura_admin_session' },
        });
      }

      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { showError(error.message); return; }

      // Verify admin role
      const check = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });

      if (check.status === 403) {
        await sb.auth.signOut();
        showError('Access denied. Your account does not have admin privileges.');
        return;
      }
      if (!check.ok) {
        showError('Login succeeded but could not verify admin access. Try again.');
        return;
      }

      window.location.href = '/admin/dashboard';
    } catch (err) {
      showError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      loginBtn.textContent = 'Sign In';
      loginBtn.disabled = false;
    }
  });
})();
