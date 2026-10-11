'use strict';

/**
 * react-ecommerce routes (reached same-origin through nginx on 3003).
 *
 * Ground-truth coverage (manifest IDs):
 *   EP-C-001  GET    /api/v2/products/:id            ?include=reviews
 *   EP-C-002  GET    /api/v2/products/list           ?page ?limit ?category
 *   EP-C-003  POST   /checkout/process
 *   EP-C-004  GET    /api/v2/recommendations         (called from a Web Worker)
 *   EP-C-005  GET    /api/v2/products                ?search   public
 *   EP-C-006  POST   /api/v2/products
 *   EP-C-007  PUT    /api/v2/products/:id
 *   EP-C-008  DELETE /api/v2/products/:id
 *   EP-C-009  GET    /api/v2/orders                  → app-a.js (shared handler)
 *   EP-C-010  GET    /api/v2/orders/:id
 *   EP-C-011  POST   /api/v2/orders
 *   EP-C-012  PATCH  /api/v2/orders/:id/status
 *   EP-C-013  GET    /api/v2/users/me
 *   EP-C-014  PUT    /api/v2/users/me
 *   EP-C-015  DELETE /api/v2/cart/:id
 *             GET    /api/v2/cart/:id                (checkout chunk)
 *   EP-C-016  GET    /api/v2/reviews                 ?productId   public
 *   EP-C-017  POST   /api/v2/reviews
 *   EP-C-018  GET    /api/v2/admin/products          admin
 *   EP-C-019  POST   /api/v2/admin/products          admin
 *   EP-C-020  DELETE /api/v2/admin/products/:id      admin
 *
 * Ordering: /api/v2/products/list is registered before /api/v2/products/:id.
 */

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

const CATEGORIES = ['electronics', 'clothing', 'homeware', 'books', 'sports'];
const PRODUCTS = Array.from({ length: 80 }, (_, i) => ({
  id:          `prod-${String(i + 1).padStart(3, '0')}`,
  sku:         `PROD-${String(i + 1).padStart(5, '0')}`,
  name:        `Product #${i + 1}`,
  category:    CATEGORIES[i % CATEGORIES.length],
  price:       parseFloat(((i + 1) * 9.99).toFixed(2)),
  stock:       (i * 7) % 200,
  rating:      parseFloat((3 + (i % 3) * 0.5).toFixed(1)),
  reviewCount: i * 3,
  featured:    i % 10 === 0,
}));
const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
const REVIEWS = [
  { reviewId: 'rev-001', productId: 'prod-001', rating: 5, comment: 'Excellent product.' },
  { reviewId: 'rev-002', productId: 'prod-001', rating: 4, comment: 'Good value.' },
  { reviewId: 'rev-003', productId: 'prod-002', rating: 3, comment: 'Average.' },
];

function badRequest(res, detail) {
  return res.status(400).json({ error: 'Bad Request', detail });
}

// ── Catalogue (EP-C-001, 002, 005 … 008) ──────────────────────────────────────

router.get('/api/v2/products', (req, res) => {
  const q = String(req.query.search || '').toLowerCase();
  const rows = q ? PRODUCTS.filter(p => p.name.toLowerCase().includes(q)) : PRODUCTS;
  res.json({ data: rows.slice(0, 20), total: rows.length });
});

router.get('/api/v2/products/list', (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const limit    = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10) || 20));
  const category = req.query.category || null;
  const rows     = category ? PRODUCTS.filter(p => p.category === category) : PRODUCTS;
  res.json({
    data:       rows.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total: rows.length, pages: Math.ceil(rows.length / limit) },
  });
});

router.get('/api/v2/products/:id', (req, res) => {
  // Unknown ids get a synthesised record so any well-formed id is a 200.
  const product = PRODUCT_BY_ID[req.params.id] || { ...PRODUCTS[0], id: req.params.id };
  const include = String(req.query.include || '').split(',').map(s => s.trim());
  const body = { ...product };
  if (include.includes('reviews')) body.reviews = REVIEWS.filter(r => r.productId === product.id);
  return res.json(body);
});

router.post('/api/v2/products', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.name || b.price === undefined) return badRequest(res, 'name and price are required');
  res.status(201).json({ id: 'prod-081', name: b.name, price: Number(b.price),
                         category: b.categoryId || 'electronics', stock: Number(b.stock) || 0 });
});

router.put('/api/v2/products/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  if (b.price === undefined) return badRequest(res, 'price is required');
  res.json({ id: req.params.id, price: Number(b.price) });
});

router.delete('/api/v2/products/:id', requireAuth, (req, res) => {
  res.json({ id: req.params.id, deleted: true });
});

// ── Recommendations (EP-C-004) ────────────────────────────────────────────────

router.get('/api/v2/recommendations', requireAuth, (req, res) => {
  res.json({ user: req.benchUser.username, items: PRODUCTS.filter(p => p.featured).map(p => p.id) });
});

// ── Orders and cart (EP-C-003, 010 … 012, 015) ────────────────────────────────

router.get('/api/v2/orders/:id', requireAuth, (req, res) => {
  res.json({ orderId: req.params.id, status: 'PROCESSING', total: 99.98,
             lineItems: [{ productId: 'prod-001', quantity: 2, unitPrice: 49.99 }] });
});

router.post('/api/v2/orders', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.items) || !b.items.length) return badRequest(res, 'items must be a non-empty array');
  res.status(201).json({ orderId: 'ORD-3001', items: b.items, shippingAddress: b.shippingAddress || null, status: 'CREATED' });
});

router.patch('/api/v2/orders/:id/status', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.status) return badRequest(res, 'status is required');
  res.json({ orderId: req.params.id, status: b.status });
});

router.get('/api/v2/cart/:id', requireAuth, (req, res) => {
  res.json({ cartId: req.params.id, items: [{ productId: 'prod-001', quantity: 2 }], total: 19.98 });
});

router.delete('/api/v2/cart/:id', requireAuth, (req, res) => {
  res.json({ cartItemId: req.params.id, removed: true });
});

router.post('/checkout/process', requireAuth, (req, res) => {
  const b = req.body || {};
  const miss = ['cartId', 'paymentMethod', 'billingAddress'].filter(f => !b[f]);
  if (miss.length) return badRequest(res, `Missing: ${miss.join(', ')}`);
  res.status(201).json({ orderId: 'ORD-3002', cartId: b.cartId, status: 'PROCESSING', estimatedDelivery: '2026-03-20' });
});

// ── Account (EP-C-013, 014) ───────────────────────────────────────────────────

router.get('/api/v2/users/me', requireAuth, (req, res) => {
  res.json({ username: req.benchUser.username, role: req.benchUser.role,
             displayName: req.benchUser.username, email: `${req.benchUser.username}@shop.example` });
});

router.put('/api/v2/users/me', requireAuth, (req, res) => {
  const b = req.body || {};
  res.json({ username: req.benchUser.username, displayName: b.displayName || req.benchUser.username,
             email: b.email || `${req.benchUser.username}@shop.example` });
});

// ── Reviews (EP-C-016, 017) ───────────────────────────────────────────────────

router.get('/api/v2/reviews', (req, res) => {
  const pid = req.query.productId;
  res.json({ data: pid ? REVIEWS.filter(r => r.productId === pid) : REVIEWS });
});

router.post('/api/v2/reviews', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.productId || b.rating === undefined) return badRequest(res, 'productId and rating are required');
  res.status(201).json({ reviewId: 'rev-004', productId: b.productId, rating: Number(b.rating), comment: b.comment || '' });
});

// ── Admin catalogue (EP-C-018 … 020) ──────────────────────────────────────────

router.get('/api/v2/admin/products', requireRole('admin'), (_req, res) => {
  res.json({ data: PRODUCTS, total: PRODUCTS.length });
});

router.post('/api/v2/admin/products', requireRole('admin'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return badRequest(res, 'name is required');
  res.status(201).json({ id: 'prod-082', name: b.name, featured: Boolean(b.featured) });
});

router.delete('/api/v2/admin/products/:id', requireRole('admin'), (req, res) => {
  res.json({ id: req.params.id, deleted: true });
});

module.exports = router;
