'use strict';
const { createClient } = require('@supabase/supabase-js');

let _client;

function getSupabase() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

module.exports = { getSupabase };
