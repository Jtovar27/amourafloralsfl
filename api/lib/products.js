'use strict';

// Static fallback — used only if DB is unreachable
const PRODUCTS_STATIC = {
  '1':  { id: '1',  name: 'Blushing Bride Bridal Bouquet', priceCents: 24500, category: 'bouquets',     addons: [], variants: [] },
  '2':  { id: '2',  name: 'Garden Romance Bouquet',         priceCents:  8500, category: 'bouquets',     addons: [], variants: [] },
  '3':  { id: '3',  name: 'Sage & Bloom Floral Box',        priceCents: 15500, category: 'floral-boxes', addons: [], variants: [] },
  '4':  { id: '4',  name: 'Peach Petal Dreams',             priceCents:  7500, category: 'bouquets',     addons: [], variants: [] },
  '5':  { id: '5',  name: 'Rose Garden Luxury Box',         priceCents: 18500, category: 'floral-boxes', addons: [], variants: [] },
  '6':  { id: '6',  name: 'Celebration Balloon Bouquet',    priceCents:  5500, category: 'balloons',     addons: [], variants: [] },
  '7':  { id: '7',  name: 'Floral & Balloon Bundle',        priceCents:  9500, category: 'balloons',     addons: [], variants: [] },
  '8':  { id: '8',  name: 'Sun-Kissed Wrapped Blooms',      priceCents:  6500, category: 'gifts',        addons: [], variants: [] },
  '9':  { id: '9',  name: 'Lush Greenery Floral Box',       priceCents: 12000, category: 'floral-boxes', addons: [], variants: [] },
  '10': { id: '10', name: 'Wildflower Love Bundle',          priceCents:  9500, category: 'gifts',        addons: [], variants: [] },
};

const MAX_QTY_PER_ITEM = 20;
const MAX_ADDONS_PER_ITEM = 10;

async function loadProductsFromDB() {
  try {
    const { getSupabase } = require('./supabase');
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, category, addons, variants')
      .eq('active', true);
    if (error || !data || data.length === 0) return null;
    const map = {};
    for (const p of data) {
      map[p.id] = {
        id:         p.id,
        name:       p.name,
        priceCents: p.price,
        category:   p.category,
        addons:     Array.isArray(p.addons)   ? p.addons   : [],
        variants:   Array.isArray(p.variants) ? p.variants : [],
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

    // Variant resolution — must run BEFORE addon processing so basePriceCents
    // is set correctly. Products with a non-empty variants[] REQUIRE a
    // variantId; products without variants silently ignore any variantId the
    // client may have stuffed in (don't fail the cart over a stale client).
    const variantId = typeof item.variantId === 'string' ? item.variantId.trim() : '';
    let selectedVariant = null;
    let basePriceCents  = product.priceCents;

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      // Product has variants — variantId is REQUIRED
      if (!variantId) {
        throw Object.assign(
          new Error(`Please select a size for "${product.name}".`),
          { status: 400 }
        );
      }
      const v = product.variants.find(x => x && x.id === variantId);
      if (!v) {
        throw Object.assign(
          new Error(`Selected size for "${product.name}" is no longer available. Please refresh and try again.`),
          { status: 400 }
        );
      }
      const vPrice = parseInt(v.price_cents, 10);
      if (!Number.isInteger(vPrice) || vPrice < 1) {
        throw Object.assign(
          new Error(`Pricing error on "${product.name}". Please refresh.`),
          { status: 400 }
        );
      }
      basePriceCents = vPrice;
      selectedVariant = { label: String(v.label), price_cents: vPrice };
    } else if (variantId) {
      // No variants on product, but client sent a variantId — silently ignore
      selectedVariant = null;
    }

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

    const unitPriceCents = basePriceCents + addonsSumCents;
    const lineTotal      = unitPriceCents * qty;
    subtotalCents       += lineTotal;

    validatedItems.push({
      product_id:       product.id,
      product_name:     product.name,
      unit_price:       unitPriceCents,    // (variant or base) + ADDONS SUM
      quantity:         qty,
      line_total:       lineTotal,
      selected_addons:  selectedAddons,    // [{ name, price_cents }]
      selected_variant: selectedVariant,   // { label, price_cents } or null
    });
  }

  return { validatedItems, subtotalCents };
}

module.exports = { PRODUCTS: PRODUCTS_STATIC, validateAndPriceItems };
