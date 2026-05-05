'use strict';
const { Resend } = require('resend');

let _resend;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM        = process.env.FROM_EMAIL   || 'Amoura Florals <orders@amouraflorals.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL  || 'amourafloralsco@gmail.com';

function cents(n) {
  return `$${(n / 100).toFixed(2)}`;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function itemRows(items) {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return items.map(i => {
    const addons = Array.isArray(i.selected_addons) ? i.selected_addons : [];
    const addonRow = addons.length
      ? `
    <tr>
      <td colspan="3" style="font-size:12px;color:#818263;font-style:italic;padding:0 0 8px 0;font-family:Helvetica,Arial,sans-serif;border-bottom:1px solid #f0ede9;">${addons.map(a => `+ ${esc(a.name)}`).join('  ·  ')}</td>
    </tr>`
      : '';
    return `
    <tr>
      <td style="padding:10px 0;border-bottom:${addons.length ? 'none' : '1px solid #f0ede9'};color:#1a1714;font-size:14px;font-family:Helvetica,Arial,sans-serif;">${i.product_name}</td>
      <td style="padding:10px 0;border-bottom:${addons.length ? 'none' : '1px solid #f0ede9'};color:#888;text-align:center;font-size:14px;font-family:Helvetica,Arial,sans-serif;">×${i.quantity}</td>
      <td style="padding:10px 0;border-bottom:${addons.length ? 'none' : '1px solid #f0ede9'};color:#1a1714;text-align:right;font-size:14px;font-family:Helvetica,Arial,sans-serif;">${cents(i.line_total)}</td>
    </tr>${addonRow}`;
  }).join('');
}

function buildConfirmationHtml(order, items) {
  const deliveryBlock = order.delivery_method === 'delivery'
    ? `<p style="margin:4px 0;font-size:14px;color:#555;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
         <strong>Delivery Address:</strong><br/>
         ${order.shipping_address.street}<br/>
         ${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.zip}
       </p>`
    : `<p style="margin:4px 0;font-size:14px;color:#555;font-family:Helvetica,Arial,sans-serif;line-height:1.7;">
         <strong>Pickup:</strong> Orlando, Florida<br/>
         Pickup instructions will be sent separately.
       </p>`;

  const giftBlock = order.recipient_name
    ? `<p style="margin:4px 0;font-size:14px;color:#555;font-family:Helvetica,Arial,sans-serif;"><strong>Gift Recipient:</strong> ${order.recipient_name}</p>
       ${order.card_message ? `<p style="margin:4px 0;font-size:14px;color:#555;font-family:Helvetica,Arial,sans-serif;"><strong>Card Message:</strong> "${order.card_message}"</p>` : ''}`
    : '';

  const instructionsBlock = order.special_instructions
    ? `<p style="margin:4px 0;font-size:14px;color:#555;font-family:Helvetica,Arial,sans-serif;"><strong>Special Instructions:</strong> ${order.special_instructions}</p>`
    : '';

  const shippingRow = order.shipping_amount > 0
    ? `<tr><td style="color:#666;padding:4px 0;font-size:14px;font-family:Helvetica,Arial,sans-serif;">Delivery Fee</td><td style="text-align:right;color:#666;padding:4px 0;font-size:14px;font-family:Helvetica,Arial,sans-serif;">${cents(order.shipping_amount)}</td></tr>`
    : `<tr><td style="color:#666;padding:4px 0;font-size:14px;font-family:Helvetica,Arial,sans-serif;">Pickup</td><td style="text-align:right;color:#666;padding:4px 0;font-size:14px;font-family:Helvetica,Arial,sans-serif;">Free</td></tr>`;

  const taxRow = order.tax_amount > 0
    ? `<tr><td style="color:#666;padding:4px 0;font-size:14px;font-family:Helvetica,Arial,sans-serif;">Tax</td><td style="text-align:right;color:#666;padding:4px 0;font-size:14px;font-family:Helvetica,Arial,sans-serif;">${cents(order.tax_amount)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Order Confirmed – Amoura Florals</title>
</head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#faf8f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">

        <tr><td style="background:#1a1714;padding:32px 40px;text-align:center;border-radius:8px 8px 0 0;">
          <p style="margin:0;color:#EFD7CF;font-size:10px;letter-spacing:4px;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">AMOURA FLORALS</p>
          <h1 style="margin:14px 0 0;color:#FAF8F5;font-size:24px;font-weight:300;letter-spacing:1px;font-family:Georgia,serif;">Order Confirmed</h1>
        </td></tr>

        <tr><td style="background:#ffffff;padding:36px 40px;border-radius:0 0 8px 8px;">

          <p style="margin:0 0 20px;color:#1a1714;font-size:16px;">Hello ${order.customer_name},</p>
          <p style="margin:0 0 28px;color:#555;font-size:14px;line-height:1.7;">
            Thank you for your order! We've received your request and are excited to create something beautiful for you.
          </p>

          <div style="background:#faf8f5;border-left:3px solid #818263;padding:16px 20px;margin-bottom:32px;border-radius:0 4px 4px 0;">
            <p style="margin:0;color:#818263;font-size:10px;letter-spacing:3px;text-transform:uppercase;">Order Number</p>
            <p style="margin:6px 0 0;color:#1a1714;font-size:22px;font-weight:600;letter-spacing:1px;font-family:Georgia,serif;">${order.order_number}</p>
          </div>

          <h3 style="margin:0 0 14px;color:#1a1714;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:500;">Your Arrangement</h3>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
            ${itemRows(items)}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #e8e3de;padding-top:16px;margin-bottom:32px;">
            <tr><td style="color:#666;padding:4px 0;font-size:14px;">Subtotal</td><td style="text-align:right;color:#666;padding:4px 0;font-size:14px;">${cents(order.subtotal)}</td></tr>
            ${shippingRow}
            ${taxRow}
            <tr>
              <td style="color:#1a1714;padding:14px 0 4px;font-size:15px;font-weight:600;border-top:1px solid #e8e3de;">Total Paid</td>
              <td style="text-align:right;color:#1a1714;padding:14px 0 4px;font-size:15px;font-weight:600;border-top:1px solid #e8e3de;">${cents(order.total_amount)}</td>
            </tr>
          </table>

          <h3 style="margin:0 0 12px;color:#1a1714;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:500;">Delivery Details</h3>
          <div style="margin-bottom:32px;line-height:1.8;">
            <p style="margin:4px 0;font-size:14px;color:#555;font-family:Helvetica,Arial,sans-serif;">
              <strong>Date:</strong> ${formatDate(order.delivery_date)}
            </p>
            ${deliveryBlock}
            ${giftBlock}
            ${instructionsBlock}
          </div>

          <div style="background:#faf8f5;padding:20px 24px;border-radius:6px;">
            <p style="margin:0 0 8px;color:#1a1714;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:500;">Questions?</p>
            <p style="margin:0;color:#555;font-size:14px;line-height:1.7;">
              Email us at <a href="mailto:amourafloralsco@gmail.com" style="color:#818263;text-decoration:none;">amourafloralsco@gmail.com</a><br/>
              WhatsApp: <a href="https://wa.me/13212959217" style="color:#818263;text-decoration:none;">(321) 295-9217</a>
            </p>
          </div>

        </td></tr>

        <tr><td style="text-align:center;padding:24px 20px;">
          <p style="margin:0;color:#aaa;font-size:12px;font-family:Helvetica,Arial,sans-serif;">
            © 2026 Amoura Florals · Orlando, Florida<br/>
            <a href="https://www.instagram.com/amourafloralsfl/" style="color:#818263;text-decoration:none;">@amourafloralsfl</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendOrderConfirmation(order, items) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping customer confirmation email.');
    return;
  }
  return getResend().emails.send({
    from:    FROM,
    to:      order.customer_email,
    subject: `Order Confirmed – ${order.order_number} | Amoura Florals`,
    html:    buildConfirmationHtml(order, items),
  });
}

async function sendAdminNotification(order, items) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping admin notification email.');
    return;
  }
  const lines = items.map(i => {
    const addons = Array.isArray(i.selected_addons) ? i.selected_addons : [];
    const base = `  • ${i.product_name} ×${i.quantity} — ${cents(i.line_total)}`;
    if (!addons.length) return base;
    const addonLines = addons.map(a => `    + ${a.name} (${cents(a.price_cents)})`).join('\n');
    return `${base}\n${addonLines}`;
  }).join('\n');
  const addr  = order.shipping_address
    ? `${order.shipping_address.street}, ${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.zip}`
    : 'Pickup';

  return getResend().emails.send({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: `New Order ${order.order_number} — ${cents(order.total_amount)}`,
    text:    [
      `New order received!\n`,
      `Order:    ${order.order_number}`,
      `Customer: ${order.customer_name} <${order.customer_email}>`,
      `Phone:    ${order.customer_phone}`,
      `\nItems:\n${lines}`,
      `\nSubtotal: ${cents(order.subtotal)}`,
      `Shipping: ${cents(order.shipping_amount)}`,
      `Tax:      ${cents(order.tax_amount)}`,
      `Total:    ${cents(order.total_amount)}`,
      `\nDelivery: ${order.delivery_method} — ${order.delivery_date}`,
      `Address:  ${addr}`,
      order.recipient_name ? `\nGift to:  ${order.recipient_name}` : '',
      order.card_message   ? `Message:  ${order.card_message}`  : '',
      order.special_instructions ? `Notes:    ${order.special_instructions}` : '',
    ].filter(Boolean).join('\n'),
  });
}

module.exports = { sendOrderConfirmation, sendAdminNotification };
