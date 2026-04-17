'use strict';
const { getSupabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('testimonials')
    .select('id, author_name, author_label, content, rating, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Testimonials fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch testimonials' });
  }

  res.status(200).json({ testimonials: data || [] });
};
