'use strict';
const { getStripe }  = require('./lib/stripe');
const { getSupabase } = require('./lib/supabase');
const { sendOrderConfirmation, sendAdminNotification } = require('./lib/email');

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data',  chunk => chunks.push(Buffer.from(chunk)));
    req.on('end',   ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const rawBody = await getRawBody(req);
  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    console.error('Webhook: missing Stripe-Signature header or STRIPE_WEBHOOK_SECRET.');
    return res.status(400).json({ error: 'Missing webhook signature.' });
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const supabase = getSupabase();

  // Idempotency: skip already-processed events
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();

  if (existing) {
    console.log(`Webhook event ${event.id} already processed. Skipping.`);
    return res.status(200).json({ received: true });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleSessionCompleted(event.data.object, supabase);
    }
    // Record event so it is never processed twice
    await supabase.from('webhook_events').insert({ id: event.id, event_type: event.type });
  } catch (err) {
    console.error(`Error handling webhook ${event.type}:`, err);
    // Return 500 so Stripe retries
    return res.status(500).json({ error: 'Internal error.' });
  }

  res.status(200).json({ received: true });
};

async function handleSessionCompleted(session, supabase) {
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.error('checkout.session.completed: no order_id in metadata — skipping.');
    return;
  }

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) {
    throw new Error(`Order ${orderId} not found: ${fetchErr?.message}`);
  }

  // Guard against double processing
  if (order.payment_status === 'paid') {
    console.log(`Order ${orderId} already marked paid — skipping.`);
    return;
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      payment_status:        'paid',
      order_status:          'confirmed',
      stripe_session_id:     session.id,
      stripe_payment_intent: session.payment_intent || null,
    })
    .eq('id', orderId);

  if (updateErr) throw new Error(`Failed to update order: ${updateErr.message}`);

  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsErr) throw new Error(`Failed to fetch order items: ${itemsErr.message}`);

  const confirmedOrder = {
    ...order,
    payment_status:        'paid',
    order_status:          'confirmed',
    stripe_payment_intent: session.payment_intent,
  };

  // Email failures must NOT prevent webhook from succeeding
  try {
    await sendOrderConfirmation(confirmedOrder, items);
  } catch (emailErr) {
    console.error('Customer confirmation email failed:', emailErr);
  }

  try {
    await sendAdminNotification(confirmedOrder, items);
  } catch (adminErr) {
    console.error('Admin notification email failed:', adminErr);
  }

  console.log(`Order ${order.order_number} confirmed successfully.`);
}
