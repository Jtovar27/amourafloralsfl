'use strict';
const { getSupabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { section, key } = req.query;
  const supabase = getSupabase();

  let query = supabase.from('site_content').select('key, value, section');

  if (key) {
    query = query.eq('key', key);
  } else if (section) {
    query = query.eq('section', section);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Content fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch content' });
  }

  const content = {};
  for (const row of (data || [])) content[row.key] = row.value;

  res.status(200).json({ content });
};
