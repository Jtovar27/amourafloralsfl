'use strict';
const { getSupabase } = require('../lib/supabase');
const { verifyAdmin, setCors } = require('./_verify');

module.exports = async function handler(req, res) {
  setCors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try { await verifyAdmin(req); }
  catch (err) { return res.status(err.status || 401).json({ error: err.message }); }

  const supabase = getSupabase();

  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: activeProducts },
    { data: recentOrders },
    { data: revenueData },
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }).in('order_status', ['pending','confirmed','processing']),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('orders')
      .select('id, order_number, customer_name, total_amount, order_status, payment_status, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('orders').select('total_amount').eq('payment_status', 'paid'),
  ]);

  const totalRevenue = (revenueData || []).reduce((s, o) => s + (o.total_amount || 0), 0);

  res.status(200).json({
    stats: {
      total_orders:    totalOrders    || 0,
      pending_orders:  pendingOrders  || 0,
      active_products: activeProducts || 0,
      total_revenue:   totalRevenue,
    },
    recent_orders: recentOrders || [],
  });
};
