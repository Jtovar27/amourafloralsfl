'use strict';
/*
 * Contact form endpoint.
 *
 * - Validates inputs server-side (length caps, email format).
 * - Rate limits per IP to deter spam.
 * - Persists the message to `contact_messages` (so nothing is lost if email fails).
 * - Sends an email to ADMIN_EMAIL via Resend with a reply-to set to the customer.
 *
 * Returns: { ok: true } on success. Never echoes secrets or stack traces.
 */

const { getSupabase }                 = require('./lib/supabase');
const { checkRateLimit, getClientIp } = require('./lib/rate-limit');
const { Resend }                      = require('resend');

const CONTACT_RATE_LIMIT     = 5;    // messages
const CONTACT_RATE_WINDOW_S  = 600;  // 10 minutes per IP

const FROM        = process.env.FROM_EMAIL  || 'Amoura Florals <orders@amouraflorals.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'amourafloralsco@gmail.com';

let _resend;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data',  c => chunks.push(Buffer.from(c)));
    req.on('end',   () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function jsonError(res, status, message) { res.status(status).json({ error: message }); }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body) {
  const first   = (body.first_name || '').toString().trim();
  const last    = (body.last_name  || '').toString().trim();
  const email   = (body.email      || '').toString().trim();
  const phone   = (body.phone      || '').toString().trim();
  const message = (body.message    || '').toString().trim();

  if (!first || first.length > 60)         return 'First name is required (max 60 characters).';
  if (last.length > 60)                    return 'Last name must be under 60 characters.';
  if (!email || !EMAIL_RE.test(email) || email.length > 200)
                                            return 'A valid email address is required.';
  if (phone.length > 40)                   return 'Phone number is too long.';
  if (!message || message.length < 5)      return 'Please write a longer message.';
  if (message.length > 4000)               return 'Message is too long (max 4000 characters).';

  return { first, last, email, phone, message };
}

// Plain-text only — no HTML rendering on either persistence or email side.
function escape(s) { return String(s ?? '').slice(0, 4000); }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { return jsonError(res, 405, 'Method not allowed.'); }

  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`contact:${ip}`, CONTACT_RATE_LIMIT, CONTACT_RATE_WINDOW_S);
  if (!allowed) {
    res.setHeader('Retry-After', String(CONTACT_RATE_WINDOW_S));
    return jsonError(res, 429, 'Too many messages from this address. Please try again later.');
  }

  let body;
  try {
    const raw = await getRawBody(req);
    if (!raw.length) return jsonError(res, 400, 'Request body is empty.');
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return jsonError(res, 400, 'Invalid JSON in request body.');
  }

  const v = validate(body);
  if (typeof v === 'string') return jsonError(res, 400, v);

  const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 250);

  // Persist first; email is best-effort.
  let supabase;
  try { supabase = getSupabase(); } catch (err) {
    console.error('[contact] Supabase env missing:', err.message);
    return jsonError(res, 500, 'Server is not configured to receive messages.');
  }

  const { error: dbErr } = await supabase
    .from('contact_messages')
    .insert({
      first_name: v.first,
      last_name:  v.last || null,
      email:      v.email.toLowerCase(),
      phone:      v.phone || null,
      message:    v.message,
      ip,
      user_agent: userAgent,
    });

  if (dbErr) {
    console.error('[contact] DB insert failed:', dbErr.message);
    return jsonError(res, 500, 'Could not save your message. Please try again.');
  }

  // Send email — failure does NOT cause a 500. The DB row is the source of truth.
  if (process.env.RESEND_API_KEY) {
    try {
      const fullName = [v.first, v.last].filter(Boolean).join(' ');
      const text = [
        `New contact form submission`,
        ``,
        `Name:    ${escape(fullName)}`,
        `Email:   ${escape(v.email)}`,
        `Phone:   ${escape(v.phone) || 'N/A'}`,
        ``,
        `Message:`,
        escape(v.message),
        ``,
        `IP:      ${escape(ip)}`,
        `Sent:    ${new Date().toISOString()}`,
      ].join('\n');

      await getResend().emails.send({
        from:      FROM,
        to:        ADMIN_EMAIL,
        subject:   `Contact: ${escape(fullName)} — ${escape(v.email)}`,
        reply_to:  v.email,
        text,
      });
    } catch (mailErr) {
      console.warn('[contact] Email send failed (DB row already saved):', mailErr.message);
    }
  }

  res.status(200).json({ ok: true });
};
