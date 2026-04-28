/* Amoura Admin — Dashboard Page */

(async () => {
  const session = await initAdmin();
  if (!session) return;

  try {
    const res  = await adminFetch('/api/admin/dashboard');
    const data = await res.json();
    const { stats, recent_orders } = data;

    document.getElementById('stat-orders').textContent   = stats.total_orders;
    document.getElementById('stat-pending').textContent  = stats.pending_orders;
    document.getElementById('stat-revenue').textContent  = formatPrice(stats.total_revenue);
    document.getElementById('stat-products').textContent = stats.active_products;

    const tbody = document.getElementById('recent-orders-tbody');
    if (!recent_orders.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>No orders yet.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = recent_orders.map(o => `
      <tr>
        <td><a href="/admin/orders?id=${escapeHtml(o.id)}" style="color:var(--accent);font-weight:600">${escapeHtml(o.order_number)}</a></td>
        <td>${escapeHtml(o.customer_name)}</td>
        <td>${formatPrice(o.total_amount)}</td>
        <td>${statusBadge(o.order_status)}</td>
        <td>${formatDateTime(o.created_at)}</td>
      </tr>`).join('');
  } catch (err) {
    console.error(err);
  }
})();
