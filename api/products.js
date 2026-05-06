'use strict';
const { getSupabase } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // No CDN cache: admin toggles (Best Seller, active, price) must show up
  // immediately on the storefront — caching here previously made it look like
  // only the first 1–2 best sellers were "allowed" because the home kept
  // serving the stale list for up to 5 minutes.
  res.setHeader('Cache-Control', 'no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { category } = req.query;
  const supabase = getSupabase();

  let query = supabase
    .from('products')
    .select('id, name, slug, description, price, category, image_url, featured, sort_order, addons')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Products fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }

  const products = (data || []).map(p => ({
    ...p,
    addons: (Array.isArray(p.addons) ? p.addons : [])
      .filter(a => a && a.active !== false)
      .map(a => ({ id: a.id, name: a.name, price_cents: a.price_cents })),
  }));

  res.status(200).json({ products });
};
