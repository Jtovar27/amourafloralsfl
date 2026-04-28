'use strict';
/*
 * Newsletter signup.
 *
 * - Validates email server-side (regex + length).
 * - Rate limits per IP.
 * - Upserts into `newsletter_subscribers`. Re-subscribing is idempotent.
 * - Does NOT send a welcome email — admin can export from the table later.
 *
 * Returns: { ok: true } on success.
 */

const { getSupabase }                 = require('./lib/supabase');
const { checkRateLimit, getClientIp } = require('./lib/rate-limit');

const NEWSLETTER_RATE_LIMIT     = 5;
const NEWSLETTER_RATE_WINDOW_S  = 600;

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { return jsonError(res, 405, 'Method not allowed.'); }

  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`newsletter:${ip}`, NEWSLETTER_RATE_LIMIT, NEWSLETTER_RATE_WINDOW_S);
  if (!allowed) {
    res.setHeader('Retry-After', String(NEWSLETTER_RATE_WINDOW_S));
    return jsonError(res, 429, 'Too many requests. Please try again later.');
  }

  let body;
  try {
    const raw = await getRawBody(req);
    if (!raw.length) return jsonError(res, 400, 'Request body is empty.');
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return jsonError(res, 400, 'Invalid JSON in request body.');
  }

  const email  = (body.email  || '').toString().trim().toLowerCase();
  const source = (body.source || '').toString().trim().slice(0, 50) || null;

  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return jsonError(res, 400, 'A valid email address is required.');
  }

  let supabase;
  try { supabase = getSupabase(); } catch (err) {
    console.error('[newsletter] Supabase env missing:', err.message);
    return jsonError(res, 500, 'Server is not configured for signups.');
  }

  // Upsert by email. If the row exists, mark active true (re-subscribe).
  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email, source, active: true }, { onConflict: 'email' });

  if (error) {
    console.error('[newsletter] DB upsert failed:', error.message);
    return jsonError(res, 500, 'Could not save your email. Please try again.');
  }

  res.status(200).json({ ok: true });
};
