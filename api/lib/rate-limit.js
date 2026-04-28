'use strict';
/*
 * Database-backed rate limiter for Vercel serverless functions.
 *
 * Why DB-backed: serverless instances are stateless and do not share memory,
 * so an in-memory limiter on one cold function instance does not see attempts
 * routed to another. The cost is one INSERT + one COUNT per request, both
 * indexed on (key, ts).
 *
 * Storage: see database/migrations/002_security_and_forms.sql.
 *
 * Usage:
 *   const { checkRateLimit, getClientIp } = require('./lib/rate-limit');
 *   const ip = getClientIp(req);
 *   const ok = await checkRateLimit(`checkout:${ip}`, 10, 300);
 *   if (!ok) return res.status(429).json({ error: '...' });
 */

const { getSupabase } = require('./supabase');

// Extract the originating client IP from Vercel-set headers. Falls back to a
// fixed bucket so the limiter still works (just against everyone collectively).
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim();
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length) return real.trim();
  return 'unknown';
}

/**
 * Returns true if the request is allowed (and records it).
 * Returns false if the limit has been hit in the current window.
 *
 * Fail-open policy: if the DB is unreachable, allow the request through. We
 * do not want a transient DB outage to break checkout for everyone. The
 * downside is that during such an outage the limit does not protect us.
 */
async function checkRateLimit(key, max, windowSeconds) {
  if (!key || typeof max !== 'number' || typeof windowSeconds !== 'number') {
    throw new Error('checkRateLimit requires (key, max, windowSeconds).');
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    return true; // env not configured — fail-open
  }

  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // Count current attempts in the window BEFORE inserting the new one. This
  // means the Nth allowed request is the one that pushes total to N (not N+1).
  const { count, error: countErr } = await supabase
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('key', key)
    .gte('ts', cutoff);

  if (countErr) {
    // DB error — allow the request rather than block legitimate traffic.
    console.warn('[rate-limit] count failed, failing open:', countErr.message);
    return true;
  }

  if ((count || 0) >= max) return false;

  // Record this attempt. Failure here only loses one attempt — not catastrophic.
  const { error: insertErr } = await supabase
    .from('rate_limits')
    .insert({ key });

  if (insertErr) {
    console.warn('[rate-limit] insert failed:', insertErr.message);
  }

  // Probabilistically prune old rows so the table does not grow unboundedly.
  // 1% chance per write keeps load tiny while preventing forever-growth.
  if (Math.random() < 0.01) {
    supabase.rpc('prune_rate_limits').then(() => {}).catch(() => {});
  }

  return true;
}

module.exports = { checkRateLimit, getClientIp };
