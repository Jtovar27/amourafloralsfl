'use strict';
const crypto = require('crypto');
const { getSupabase } = require('../lib/supabase');
const { verifyAdmin, setCors, parseBody } = require('./_verify');

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

const VALID_CATEGORIES = ['bouquets', 'floral-boxes', 'vase-arrangements', 'balloons', 'gifts'];

const VALID_SUBCATEGORIES = new Set([
  'teddy-bears', 'helium-balloons', 'chocolate',
  'baby-breath-letters', 'crowns', 'butterflies',
]);

function sanitizeSubcategory(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input !== 'string') return null;
  const v = input.trim();
  return VALID_SUBCATEGORIES.has(v) ? v : null;
}

const ADDON_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_ADDONS = 20;
const MAX_ADDON_PRICE_CENTS = 1_000_000;
const MAX_ADDON_NAME_LEN = 80;

function sanitizeGallery(input) {
  if (!Array.isArray(input)) return [];
  if (input.length > 12) {
    throw Object.assign(new Error('No more than 12 gallery images allowed.'), { status: 400 });
  }
  // Each entry must be a non-empty string ≤ 500 chars
  return input
    .filter(x => typeof x === 'string' && x.trim().length > 0)
    .map(x => x.trim().slice(0, 500))
    .filter(x => x.length > 0);
}

function sanitizeVariants(input) {
  if (!Array.isArray(input)) return [];
  if (input.length > 8) {
    throw Object.assign(new Error('No more than 8 size variants allowed.'), { status: 400 });
  }
  const out = [];
  const seenLabels = new Set();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 60) : '';
    if (!label) continue;
    const lc = label.toLowerCase();
    if (seenLabels.has(lc)) {
      throw Object.assign(new Error('Variant labels must be unique.'), { status: 400 });
    }
    seenLabels.add(lc);

    let id = typeof raw.id === 'string' ? raw.id : '';
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      id = 'v_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
    }

    let pc = Number(raw.price_cents);
    if (!Number.isFinite(pc) || !Number.isInteger(pc) || pc < 1) {
      throw Object.assign(new Error('Variant price must be a positive whole number of cents.'), { status: 400 });
    }
    if (pc > 10_000_000) pc = 10_000_000;

    out.push({ id, label, price_cents: pc });
  }
  return out;
}

function sanitizeAddons(input) {
  if (!Array.isArray(input)) return [];
  if (input.length > MAX_ADDONS) {
    throw Object.assign(new Error(`No more than ${MAX_ADDONS} add-ons allowed.`), { status: 400 });
  }

  const out = [];
  const seenNames = new Set();

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;

    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_ADDON_NAME_LEN) : '';
    if (!name) continue; // drop blanks

    const lc = name.toLowerCase();
    if (seenNames.has(lc)) {
      throw Object.assign(new Error('Add-on names must be unique.'), { status: 400 });
    }
    seenNames.add(lc);

    let id = typeof raw.id === 'string' ? raw.id : '';
    if (!ADDON_ID_RE.test(id)) {
      id = 'a_' + crypto.randomUUID().slice(0, 8);
    }

    let priceCents = Number(raw.price_cents);
    if (!Number.isFinite(priceCents) || !Number.isInteger(priceCents) || priceCents < 0) {
      priceCents = 0;
    }
    if (priceCents > MAX_ADDON_PRICE_CENTS) priceCents = MAX_ADDON_PRICE_CENTS;

    const active = raw.active === undefined ? true : Boolean(raw.active);

    out.push({ id, name, price_cents: priceCents, active });
  }

  return out;
}

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

    const { name, description, price, category, image_url, featured, active, sort_order, subcategory } = body;

    if (!name?.trim()) return res.status(400).json({ error: 'Product name is required' });
    const priceInt = parseInt(price, 10);
    if (isNaN(priceInt) || priceInt <= 0) return res.status(400).json({ error: 'Price must be a positive integer (cents)' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });

    let cleanAddons;
    try { cleanAddons = sanitizeAddons(body.addons); }
    catch (err) { return res.status(err.status || 400).json({ error: err.message }); }

    let cleanGallery, cleanVariants;
    try {
      cleanGallery  = sanitizeGallery(body.gallery_images);
      cleanVariants = sanitizeVariants(body.variants);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    // subcategory only meaningful when category === 'gifts'
    const subcatClean = category === 'gifts' ? sanitizeSubcategory(subcategory) : null;

    const { data, error } = await supabase
      .from('products')
      .insert({
        name:           name.trim(),
        slug:           slugify(name.trim()),
        description:    description?.trim() || null,
        price:          priceInt,
        category,
        image_url:      image_url?.trim()   || null,
        featured:       Boolean(featured),
        active:         active !== false,
        sort_order:     parseInt(sort_order, 10) || 0,
        addons:         cleanAddons,
        gallery_images: cleanGallery,
        variants:       cleanVariants,
        subcategory:    subcatClean,
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
    if (updates.addons     !== undefined) {
      try { patch.addons = sanitizeAddons(updates.addons); }
      catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
    }
    if (updates.gallery_images !== undefined) {
      try { patch.gallery_images = sanitizeGallery(updates.gallery_images); }
      catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
    }
    if (updates.variants !== undefined) {
      try { patch.variants = sanitizeVariants(updates.variants); }
      catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
    }
    if (updates.subcategory !== undefined) {
      patch.subcategory = sanitizeSubcategory(updates.subcategory);
    }

    // subcategory is only meaningful for category === 'gifts'. If the
    // resolved category (either the new patch value or the existing row's
    // category) isn't 'gifts', force subcategory = null. We need to read the
    // current row when the request didn't include category, so we know the
    // effective category before persisting.
    let resolvedCategory = patch.category;
    if (resolvedCategory === undefined) {
      const { data: existing } = await supabase
        .from('products').select('category').eq('id', id).maybeSingle();
      resolvedCategory = existing && existing.category;
    }
    if (resolvedCategory !== 'gifts') {
      // Force-clear if not a gift category, regardless of input
      if (patch.subcategory !== undefined || patch.category !== undefined) {
        patch.subcategory = null;
      }
    }

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
