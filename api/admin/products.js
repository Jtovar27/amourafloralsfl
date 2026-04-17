'use strict';
const { getSupabase } = require('../lib/supabase');
const { verifyAdmin, setCors, parseBody } = require('./_verify');

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

const VALID_CATEGORIES = ['bouquets', 'floral-boxes', 'balloons', 'gifts'];

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try { await verifyAdmin(req); }
  catch (err) { return res.status(err.status || 401).json({ error: err.message }); }

  const supabase = getSupabase();

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { id } = req.query;

    if (id) {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error || !data) return res.status(404).json({ error: 'Product not found' });
      return res.status(200).json({ product: data });
    }

    const { data, error } = await supabase
      .from('products').select('*').order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ error: 'Failed to fetch products' });
    return res.status(200).json({ products: data || [] });
  }

  // ── POST (create) ─────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return res.status(400).json({ error: err.message }); }

    const { name, description, price, category, image_url, featured, active, sort_order } = body;

    if (!name?.trim()) return res.status(400).json({ error: 'Product name is required' });
    const priceInt = parseInt(price, 10);
    if (isNaN(priceInt) || priceInt <= 0) return res.status(400).json({ error: 'Price must be a positive integer (cents)' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });

    const { data, error } = await supabase
      .from('products')
      .insert({
        name:        name.trim(),
        slug:        slugify(name.trim()),
        description: description?.trim() || null,
        price:       priceInt,
        category,
        image_url:   image_url?.trim()   || null,
        featured:    Boolean(featured),
        active:      active !== false,
        sort_order:  parseInt(sort_order, 10) || 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A product with this slug already exists. Try a different name.' });
      console.error('Product insert error:', error);
      return res.status(500).json({ error: 'Failed to create product' });
    }

    return res.status(201).json({ product: data });
  }

  // ── PUT (update) ─────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return res.status(400).json({ error: err.message }); }

    const { id, ...updates } = body;
    if (!id) return res.status(400).json({ error: 'Product ID is required' });

    const patch = {};
    if (updates.name !== undefined) {
      patch.name = updates.name.trim();
      patch.slug = slugify(updates.name.trim());
    }
    if (updates.description !== undefined) patch.description = updates.description?.trim() || null;
    if (updates.price !== undefined) {
      const p = parseInt(updates.price, 10);
      if (isNaN(p) || p <= 0) return res.status(400).json({ error: 'Invalid price' });
      patch.price = p;
    }
    if (updates.category !== undefined) {
      if (!VALID_CATEGORIES.includes(updates.category)) return res.status(400).json({ error: 'Invalid category' });
      patch.category = updates.category;
    }
    if (updates.image_url  !== undefined) patch.image_url  = updates.image_url?.trim()  || null;
    if (updates.featured   !== undefined) patch.featured   = Boolean(updates.featured);
    if (updates.active     !== undefined) patch.active     = Boolean(updates.active);
    if (updates.sort_order !== undefined) patch.sort_order = parseInt(updates.sort_order, 10) || 0;

    const { data, error } = await supabase
      .from('products').update(patch).eq('id', id).select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A product with this slug already exists.' });
      console.error('Product update error:', error);
      return res.status(500).json({ error: 'Failed to update product' });
    }

    return res.status(200).json({ product: data });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id, archive } = req.query;
    if (!id) return res.status(400).json({ error: 'Product ID is required' });

    if (archive === 'true') {
      const { error } = await supabase.from('products').update({ active: false }).eq('id', id);
      if (error) return res.status(500).json({ error: 'Failed to archive product' });
      return res.status(200).json({ success: true, archived: true });
    }

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete product' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
