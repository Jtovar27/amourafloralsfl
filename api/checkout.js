'use strict';
const { validateAndPriceItems } = require('./lib/products');
const { getSupabase }           = require('./lib/supabase');
const { getStripe }             = require('./lib/stripe');

// Florida sales tax — verify your exact rate with a tax professional.
// Override via TAX_RATE env var (e.g. "0.065" for 6.5%).
const TAX_RATE               = parseFloat(process.env.TAX_RATE || '0.07');
const SHIPPING_DELIVERY_CENTS = 1500; // $15.00 flat local delivery

function generateOrderNumber() {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AMF-${date}-${suffix}`;
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data',  chunk => chunks.push(Buffer.from(chunk)));
    req.on('end',   ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function validateCustomer(c) {
  if (!c?.name?.trim())  return 'Customer name is required.';
  if (!c?.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))
    return 'A valid email address is required.';
  if (!c?.phone?.trim()) return 'Phone number is required.';
  return null;
}

function validateDelivery(d) {
  if (!['pickup', 'delivery'].includes(d?.method))
    return 'Delivery method must be "pickup" or "delivery".';

  if (!d?.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date))
    return 'Delivery date is required (YYYY-MM-DD).';

  const [y, m, day] = d.date.split('-').map(Number);
  const selected    = new Date(y, m - 1, day);
  const minDate     = new Date();
  minDate.setHours(0, 0, 0, 0);
  minDate.setDate(minDate.getDate() + 2);
  if (selected < minDate) return 'Delivery date must be at least 2 days from today.';

  if (d.method === 'delivery') {
    const a = d.address ?? {};
    if (!a.street?.trim()) return 'Street address is required for delivery.';
    if (!a.city?.trim())   return 'City is required for delivery.';
    if (!a.zip?.trim() || !/^\d{5}(-\d{4})?$/.test(a.zip.trim()))
      return 'A valid 5-digit ZIP code is required for delivery.';
  }
  return null;
}

function jsonError(res, status, message) {
  res.status(status).json({ error: message });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { return jsonError(res, 405, 'Method not allowed.'); }

  // Parse body
  let body;
  try {
    const raw = await getRawBody(req);
    if (!raw.length) return jsonError(res, 400, 'Request body is empty.');
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return jsonError(res, 400, 'Invalid JSON in request body.');
  }

  const { items, customer, delivery } = body;

  // Validate inputs
  const customerErr = validateCustomer(customer);
  if (customerErr) return jsonError(res, 400, customerErr);

  const deliveryErr = validateDelivery(delivery);
  if (deliveryErr) return jsonError(res, 400, deliveryErr);

  // Price items server-side — client prices are ignored
  let validatedItems, subtotalCents;
  try {
    ({ validatedItems, subtotalCents } = await validateAndPriceItems(items));
  } catch (err) {
    return jsonError(res, err.status || 400, err.message);
  }

  const shippingCents = delivery.method === 'delivery' ? SHIPPING_DELIVERY_CENTS : 0;
  const taxCents      = Math.round((subtotalCents + shippingCents) * TAX_RATE);
  const totalCents    = subtotalCents + shippingCents + taxCents;
  const orderNumber   = generateOrderNumber();
  const supabase      = getSupabase();
  const stripe        = getStripe();

  // Build order record
  const orderPayload = {
    order_number:         orderNumber,
    customer_name:        customer.name.trim(),
    customer_email:       customer.email.trim().toLowerCase(),
    customer_phone:       customer.phone.trim(),
    recipient_name:       delivery.recipientName?.trim()        || null,
    card_message:         delivery.cardMessage?.trim()          || null,
    delivery_method:      delivery.method,
    delivery_date:        delivery.date,
    shipping_address:     delivery.method === 'delivery' ? {
      street: delivery.address.street.trim(),
      city:   delivery.address.city.trim(),
      state:  (delivery.address.state || 'FL').trim().toUpperCase(),
      zip:    delivery.address.zip.trim(),
    } : null,
    special_instructions: delivery.specialInstructions?.trim() || null,
    subtotal:             subtotalCents,
    shipping_amount:      shippingCents,
    tax_amount:           taxCents,
    total_amount:         totalCents,
    currency:             'usd',
    payment_provider:     'stripe',
    payment_status:       'pending',
    order_status:         'pending',
  };

  // Insert order
  const { data: newOrder, error: insertErr } = await supabase
    .from('orders')
    .insert(orderPayload)
    .select()
    .single();

  if (insertErr) {
    console.error('DB order insert error:', insertErr);
    return jsonError(res, 500, 'Failed to create order. Please try again.');
  }

  // Insert order items
  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(validatedItems.map(i => ({ ...i, order_id: newOrder.id })));

  if (itemsErr) {
    console.error('DB items insert error:', itemsErr);
    await supabase.from('orders').delete().eq('id', newOrder.id);
    return jsonError(res, 500, 'Failed to save order items. Please try again.');
  }

  // Build Stripe line items (exact breakdown shown at checkout)
  const lineItems = validatedItems.map(i => ({
    price_data: {
      currency:     'usd',
      product_data: { name: i.product_name },
      unit_amount:  i.unit_price,
    },
    quantity: i.quantity,
  }));

  if (shippingCents > 0) {
    lineItems.push({
      price_data: {
        currency:     'usd',
        product_data: { name: 'Local Delivery' },
        unit_amount:  shippingCents,
      },
      quantity: 1,
    });
  }

  if (taxCents > 0) {
    lineItems.push({
      price_data: {
        currency:     'usd',
        product_data: { name: `Estimated Tax (${(TAX_RATE * 100).toFixed(1)}%)` },
        unit_amount:  taxCents,
      },
      quantity: 1,
    });
  }

  const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

  // Create Stripe Checkout Session
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      line_items:           lineItems,
      customer_email:       orderPayload.customer_email,
      metadata: {
        order_id:     newOrder.id,
        order_number: orderNumber,
      },
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/cancel`,
      expires_at:  Math.floor(Date.now() / 1000) + 30 * 60,
    });
  } catch (err) {
    console.error('Stripe session creation error:', err);
    // Clean up pending order on Stripe failure
    await supabase.from('order_items').delete().eq('order_id', newOrder.id);
    await supabase.from('orders').delete().eq('id', newOrder.id);
    return jsonError(res, 500, 'Failed to create payment session. Please try again.');
  }

  // Attach session ID to order
  await supabase
    .from('orders')
    .update({ stripe_session_id: session.id })
    .eq('id', newOrder.id);

  res.status(200).json({ url: session.url });
};
