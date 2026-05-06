'use strict';
const { getSupabase } = require('./lib/supabase');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeGalleryArr(input) {
  return Array.isArray(input) ? input.filter(x => typeof x === 'string') : [];
}

function sanitizeVariantsArr(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(v =>
    v &&
    typeof v === 'object' &&
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    Number.isInteger(v.price_cents)
  ).map(v => ({ id: v.id, label: v.label, price_cents: v.price_cents }));
}

function projectProduct(p) {
  return {
    ...p,
    gallery_images: sanitizeGalleryArr(p.gallery_images),
    variants: sanitizeVariantsArr(p.variants),
    addons: (Array.isArray(p.addons) ? p.addons : [])
      .filter(a => a && a.active !== false)
      .map(a => ({ id: a.id, name: a.name, price_cents: a.price_cents })),
  };
}

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

  const { category, id } = req.query;
  const supabase = getSupabase();

  // Single product fetch by ?id=<uuid>
  if (id) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, description, price, category, image_url, featured, sort_order, addons, gallery_images, variants')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      console.error('Product fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch product' });
    }

    if (!data) return res.status(404).json({ error: 'Product not found' });

    return res.status(200).json({ product: projectProduct(data) });
  }

  // List behavior (existing)
  let query = supabase
    .from('products')
    .select('id, name, slug, description, price, category, image_url, featured, sort_order, addons, gallery_images, variants')
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

  const products = (data || []).map(projectProduct);

  res.status(200).json({ products });
};
