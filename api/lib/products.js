'use strict';

// Static fallback — used only if DB is unreachable
const PRODUCTS_STATIC = {
  '1':  { id: '1',  name: 'Blushing Bride Bridal Bouquet', priceCents: 24500, category: 'bouquets'     },
  '2':  { id: '2',  name: 'Garden Romance Bouquet',         priceCents:  8500, category: 'bouquets'     },
  '3':  { id: '3',  name: 'Sage & Bloom Floral Box',        priceCents: 15500, category: 'floral-boxes' },
  '4':  { id: '4',  name: 'Peach Petal Dreams',             priceCents:  7500, category: 'bouquets'     },
  '5':  { id: '5',  name: 'Rose Garden Luxury Box',         priceCents: 18500, category: 'floral-boxes' },
  '6':  { id: '6',  name: 'Celebration Balloon Bouquet',    priceCents:  5500, category: 'balloons'     },
  '7':  { id: '7',  name: 'Floral & Balloon Bundle',        priceCents:  9500, category: 'balloons'     },
  '8':  { id: '8',  name: 'Sun-Kissed Wrapped Blooms',      priceCents:  6500, category: 'gifts'        },
  '9':  { id: '9',  name: 'Lush Greenery Floral Box',       priceCents: 12000, category: 'floral-boxes' },
  '10': { id: '10', name: 'Wildflower Love Bundle',          priceCents:  9500, category: 'gifts'        },
};

const MAX_QTY_PER_ITEM = 20;

async function loadProductsFromDB() {
  try {
    const { getSupabase } = require('./supabase');
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, category')
      .eq('active', true);
    if (error || !data || data.length === 0) return null;
    const map = {};
    for (const p of data) {
      map[p.id] = { id: p.id, name: p.name, priceCents: p.price, category: p.category };
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

    const product   = PRODUCTS[id];
    const lineTotal = product.priceCents * qty;
    subtotalCents  += lineTotal;

    validatedItems.push({
      product_id:   product.id,
      product_name: product.name,
      unit_price:   product.priceCents,
      quantity:     qty,
      line_total:   lineTotal,
    });
  }

  return { validatedItems, subtotalCents };
}

module.exports = { PRODUCTS: PRODUCTS_STATIC, validateAndPriceItems };
