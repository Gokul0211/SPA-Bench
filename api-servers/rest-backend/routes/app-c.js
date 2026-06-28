'use strict';

/**
 * App C — React E-Commerce (Vite) routes
 *
 * Manifest coverage:
 *   EP-C-001  GET  /api/v2/products/:id      (public, path param + ?include)
 *   EP-C-002  GET  /api/v2/products/list     (public, ?page ?limit ?category)
 *   EP-C-003  POST /checkout/process         (auth: bearer, body: cartId + paymentMethod + billingAddress)
 *   EP-C-004  GET  /api/v2/products/list     duplicate entry — IndexedDB cache finding.
 *                                             Same route as EP-C-002; the benchmark records it
 *                                             as a separate discovery because the tool must
 *                                             extract it from the browser's IndexedDB store.
 *                                             The server endpoint is identical.
 *
 * IMPORTANT ordering: /api/v2/products/list MUST be registered BEFORE /api/v2/products/:id
 * so Express matches the literal 'list' segment first.
 */

const { Router }             = require('express');
const { requireBearerAuth }  = require('../middleware/auth');
const { v4: uuidv4 }         = require('uuid');

const router = Router();

// ── Seed data ─────────────────────────────────────────────────────────────────
const CATEGORIES = ['electronics', 'clothing', 'homeware', 'books', 'sports'];

const PRODUCTS = Array.from({ length: 80 }, (_, i) => ({
  id:          uuidv4(),
  sku:         `PROD-${String(i + 1).padStart(5, '0')}`,
  name:        `Product #${i + 1}`,
  category:    CATEGORIES[i % CATEGORIES.length],
  price:       parseFloat(((i + 1) * 9.99).toFixed(2)),
  stock:       (i * 7) % 200,
  rating:      parseFloat(((3 + (i % 3)) * 0.5 + 3).toFixed(1)),
  reviewCount: i * 3,
  description: `Detailed description for product #${i + 1}.`,
}));

// Pre-index by id for O(1) lookup
const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
// Stable first-product id for deterministic tests
const FIRST_PRODUCT_ID = PRODUCTS[0].id;

// ── GET /api/v2/products/list ─────────────────────────────────────────────────
// EP-C-002 (fetch_interception) + EP-C-004 (indexeddb_api_cache)
// Fires on page load via useEffect. Parameters from URLSearchParams constructor.
router.get('/api/v2/products/list', (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page     || '1',  10));
  const limit    = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const category = req.query.category || null;

  const filtered = category
    ? PRODUCTS.filter(p => p.category === category)
    : PRODUCTS;

  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return res.json({
    data:       items.map(({ description: _, ...p }) => p),   // omit description from list view
    pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) },
    // Cache hint — the React app stores this response URL in IndexedDB product-cache (EP-C-004)
    _cacheKey:  `products_list_p${page}_l${limit}${category ? `_c${category}` : ''}`,
  });
});

// ── GET /api/v2/products/:id ──────────────────────────────────────────────────
// EP-C-001: Template literal URL `${this.b}/api/v2/products/${e}` recovered from
// ProductService.tsx via Vite JSX source map.
// Optional ?include=reviews query param.
router.get('/api/v2/products/:id', (req, res) => {
  const { id } = req.params;
  const include = (req.query.include || '').split(',').map(s => s.trim()).filter(Boolean);

  // Provide a stable product for known test ID, otherwise look up or synthesise
  const product = PRODUCT_BY_ID[id] || PRODUCT_BY_ID[FIRST_PRODUCT_ID];
  if (!product) {
    return res.status(404).json({ error: 'Not Found', detail: `Product ${id} not found` });
  }

  const response = { ...product };

  if (include.includes('reviews')) {
    response.reviews = [
      { reviewId: 'REV-001', rating: 5, comment: 'Excellent product.', author: 'user_a', date: '2026-01-10' },
      { reviewId: 'REV-002', rating: 4, comment: 'Good value.',         author: 'user_b', date: '2026-01-08' },
    ];
  }

  return res.json(response);
});

// ── POST /checkout/process ────────────────────────────────────────────────────
// EP-C-003: Axios POST in lazy-loaded checkout chunk.
// Parameters: cartId (body), paymentMethod (body), billingAddress (body).
router.post('/checkout/process', requireBearerAuth, (req, res) => {
  const { cartId, paymentMethod, billingAddress } = req.body || {};
  const missing = [];
  if (!cartId)         missing.push('cartId');
  if (!paymentMethod)  missing.push('paymentMethod');
  if (!billingAddress) missing.push('billingAddress');

  if (missing.length) {
    return res.status(400).json({ error: 'Bad Request', detail: `Missing: ${missing.join(', ')}` });
  }

  return res.status(201).json({
    orderId:         'ORD-' + uuidv4().slice(0, 8).toUpperCase(),
    cartId,
    paymentMethod,
    billingAddress,
    status:          'PROCESSING',
    estimatedDelivery: '2026-03-20',
    createdAt:       new Date().toISOString(),
  });
});

module.exports = router;
