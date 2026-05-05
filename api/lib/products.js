'use strict';

// Static fallback — used only if DB is unreachable
const PRODUCTS_STATIC = {
  '1':  { id: '1',  name: 'Blushing Bride Bridal Bouquet', priceCents: 24500, category: 'bouquets',     addons: [] },
  '2':  { id: '2',  name: 'Garden Romance Bouquet',         priceCents:  8500, category: 'bouquets',     addons: [] },
  '3':  { id: '3',  name: 'Sage & Bloom Floral Box',        priceCents: 15500, category: 'floral-boxes', addons: [] },
  '4':  { id: '4',  name: 'Peach Petal Dreams',             priceCents:  7500, category: 'bouquets',     addons: [] },
  '5':  { id: '5',  name: 'Rose Garden Luxury Box',         priceCents: 18500, category: 'floral-boxes', addons: [] },
  '6':  { id: '6',  name: 'Celebration Balloon Bouquet',    priceCents:  5500, category: 'balloons',     addons: [] },
  '7':  { id: '7',  name: 'Floral & Balloon Bundle',        priceCents:  9500, category: 'balloons',     addons: [] },
  '8':  { id: '8',  name: 'Sun-Kissed Wrapped Blooms',      priceCents:  6500, category: 'gifts',        addons: [] },
  '9':  { id: '9',  name: 'Lush Greenery Floral Box',       priceCents: 12000, category: 'floral-boxes', addons: [] },
  '10': { id: '10', name: 'Wildflower Love Bundle',          priceCents:  9500, category: 'gifts',        addons: [] },
};

const MAX_QTY_PER_ITEM = 20;
const MAX_ADDONS_PER_ITEM = 10;

async function loadProductsFromDB() {
  try {
    const { getSupabase } = require('./supabase');
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, category, addons')
      .eq('active', true);
    if (error || !data || data.length === 0) return null;
    const map = {};
    for (const p of data) {
      map[p.id] = {
        id:         p.id,
        name:       p.name,
        priceCents: p.price,
        category:   p.category,
        addons:     Array.isArray(p.addons) ? p.addons : [],
      };
    }
    return map;
  } catch {
    return null;
  }
}

async function validateAndPriceItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw Object.assign(new Error('Your cart is empty.'), { status: 400 });
  }

  const PRODUCTS = (await loadProductsFromDB()) || PRODUCTS_STATIC;

  const validatedItems = [];
  let subtotalCents = 0;

  for (const item of rawItems) {
    const id  = String(item.id  ?? '').trim();
    const qty = parseInt(item.qty, 10);

    if (!id || !PRODUCTS[id]) {
      throw Object.assign(new Error(`Product not found. Please refresh the page and try again.`), { status: 400 });
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw Object.assign(new Error(`Invalid quantity for "${PRODUCTS[id].name}".`), { status: 400 });
    }

    const product = PRODUCTS[id];

    // Validate + snapshot addons (server is the source of truth for name + price)
    const rawAddons = Array.isArray(item.addons) ? item.addons : [];
    if (rawAddons.length > MAX_ADDONS_PER_ITEM) {
      throw Object.assign(new Error('Too many add-ons selected for one item.'), { status: 400 });
    }

    const selectedAddons = [];
    let addonsSumCents = 0;
    for (const a of rawAddons) {
      const aId = String(a?.id ?? '').trim();
      const match = product.addons.find(
        x => String(x?.id ?? '') === aId && x?.active !== false
      );
      if (!aId || !match) {
        throw Object.assign(
          new Error('An add-on you selected is no longer available. Please refresh and try again.'),
          { status: 400 }
        );
      }
      const priceCents = parseInt(match.price_cents, 10);
      if (!Number.isInteger(priceCents) || priceCents < 0) {
        throw Object.assign(
          new Error('An add-on you selected is no longer available. Please refresh and try again.'),
          { status: 400 }
        );
      }
      selectedAddons.push({ name: match.name, price_cents: priceCents });
      addonsSumCents += priceCents;
    }

    const unitPriceCents = product.priceCents + addonsSumCents;
    const lineTotal      = unitPriceCents * qty;
    subtotalCents       += lineTotal;

    validatedItems.push({
      product_id:      product.id,
      product_name:    product.name,
      unit_price:      unitPriceCents,    // BASE + ADDONS SUM
      quantity:        qty,
      line_total:      lineTotal,
      selected_addons: selectedAddons,    // [{ name, price_cents }]
    });
  }

  return { validatedItems, subtotalCents };
}

module.exports = { PRODUCTS: PRODUCTS_STATIC, validateAndPriceItems };
