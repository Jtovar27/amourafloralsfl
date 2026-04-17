'use strict';
const { getSupabase } = require('../lib/supabase');
const { verifyAdmin, setCors, parseBody } = require('./_verify');

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'completed', 'cancelled'];

module.exports = async function handler(req, res) {
  setCors(res, 'GET, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try { await verifyAdmin(req); }
  catch (err) { return res.status(err.status || 401).json({ error: err.message }); }

  const supabase = getSupabase();

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { id, page = '1', limit = '20', status, search } = req.query;

    // Single order with items
    if (id) {
      const { data: order, error } = await supabase
        .from('orders').select('*').eq('id', id).single();
      if (error || !order) return res.status(404).json({ error: 'Order not found' });

      const { data: items } = await supabase
        .from('order_items').select('*').eq('order_id', id).order('created_at');

      return res.status(200).json({ order: { ...order, items: items || [] } });
    }

    // List
    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * limitNum;

    let query = supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_email, total_amount, order_status, payment_status, delivery_method, delivery_date, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (status && VALID_STATUSES.includes(status)) query = query.eq('order_status', status);
    if (search) query = query.or(`customer_name.ilike.%${search}%,order_number.ilike.%${search}%,customer_email.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) {
      console.error('Orders list error:', error);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }

    return res.status(200).json({ orders: data || [], total: count || 0, page: pageNum, limit: limitNum });
  }

  // ── PUT (update status / notes) ───────────────────────────────────────────────
  if (req.method === 'PUT') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return res.status(400).json({ error: err.message }); }

    const { id, order_status, internal_notes } = body;
    if (!id) return res.status(400).json({ error: 'Order ID is required' });

    if (order_status && !VALID_STATUSES.includes(order_status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const patch = {};
    if (order_status     !== undefined) patch.order_status    = order_status;
    if (internal_notes   !== undefined) patch.internal_notes  = internal_notes?.trim() || null;

    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const { data, error } = await supabase
      .from('orders').update(patch).eq('id', id).select().single();

    if (error) {
      console.error('Order update error:', error);
      return res.status(500).json({ error: 'Failed to update order' });
    }

    return res.status(200).json({ order: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
