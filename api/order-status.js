'use strict';
const { getSupabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET')     { res.status(405).json({ error: 'Method not allowed.' }); return; }

  // Parse session_id from URL query string
  const url       = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid or missing session_id.' });
  }

  const supabase = getSupabase();

  const { data: order, error } = await supabase
    .from('orders')
    .select([
      'order_number', 'customer_name', 'customer_email',
      'delivery_method', 'delivery_date', 'shipping_address',
      'recipient_name', 'card_message', 'special_instructions',
      'subtotal', 'shipping_amount', 'tax_amount', 'total_amount', 'currency',
      'payment_status', 'order_status', 'created_at',
      'id',
    ].join(', '))
    .eq('stripe_session_id', sessionId)
    .single();

  if (error || !order) {
    return res.status(404).json({ status: 'not_found' });
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('product_name, unit_price, quantity, line_total')
    .eq('order_id', order.id);

  // Don't expose internal UUID to the client after we've used it
  const { id: _id, ...publicOrder } = order;

  res.status(200).json({ ...publicOrder, items: items || [] });
};
