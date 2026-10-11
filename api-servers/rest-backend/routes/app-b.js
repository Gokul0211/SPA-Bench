'use strict';

/**
 * angular-erp routes (reached same-origin through the shell's nginx on 3002).
 *
 * Ground-truth coverage (manifest IDs):
 *   EP-B-003  GET    /api/inventory/items            OData $filter $top $skip
 *   EP-B-005  POST   /api/auth/login                 → app-a.js (shared)
 *   EP-B-006  GET    /actuator/mappings              public; found by probing
 *   EP-B-007  GET    /api/inventory/items/:id
 *   EP-B-008  POST   /api/inventory/items
 *   EP-B-009  PUT    /api/inventory/items/:id
 *   EP-B-010  DELETE /api/inventory/items/:id
 *   EP-B-011  GET    /api/inventory/categories
 *   EP-B-012  GET    /api/employees                  ?department
 *   EP-B-013  GET    /api/employees/:id
 *   EP-B-014  POST   /api/employees
 *   EP-B-015  PUT    /api/employees/:id
 *   EP-B-016  PATCH  /api/admin/users/:id/role       admin
 *   EP-B-017  GET    /api/reports/monthly            ?month
 *   EP-B-018  POST   /api/reports/generate
 *   EP-B-019  GET    /api/admin/settings             admin
 *   EP-B-020  PUT    /api/admin/settings             admin
 * Also called by the client (complete surface):
 *   GET /api/sync/status, POST /api/sync/retry-queue        (shell background worker)
 *   GET /api/v2/users | /api/v2/finance/summary | /api/v2/hr/employees |
 *       /api/v2/crm/contacts | /api/v2/analytics/metrics | /api/v2/reports   (remotes)
 *   (GET /api/v2/orders, used by the orders remote, is in app-a.js)
 * remoteEntry.js files are static assets on the remote containers.
 * EP-B-004 is on a private IP (10.0.1.45) and intentionally not served.
 */

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// Lookups never 404 for an unknown id (a synthesised record is returned), so a
// well-formed authenticated request to any ground-truth route is a 2xx.

const ITEMS = Array.from({ length: 120 }, (_, i) => ({
  itemId:      `ITEM-${String(i + 1).padStart(4, '0')}`,
  sku:         `SKU-${(i + 1) * 7}`,
  description: `Inventory item #${i + 1}`,
  stockLevel:  (i * 37) % 500,
  unitCost:    parseFloat(((i + 1) * 12.99).toFixed(2)),
  warehouseId: `WH-${(i % 4) + 1}`,
  categoryId:  `CAT-${(i % 6) + 1}`,
}));
const CATEGORIES = ['Raw materials', 'Components', 'Tools', 'Consumables', 'Spares', 'Packaging']
  .map((name, i) => ({ categoryId: `CAT-${i + 1}`, name }));
const EMPLOYEES = Array.from({ length: 25 }, (_, i) => ({
  id:         String(i + 1),
  name:       `Employee ${i + 1}`,
  department: ['Operations', 'Finance', 'HR', 'Sales', 'IT'][i % 5],
  role:       ['analyst', 'manager', 'engineer'][i % 3],
}));
let SETTINGS = { smtpHost: 'smtp.erp.local', maxUploadSize: 10485760, auditRetentionDays: 365 };

function badRequest(res, detail) {
  return res.status(400).json({ error: 'Bad Request', detail });
}

// ── Inventory (EP-B-003, 007 … 011) ───────────────────────────────────────────

router.get('/api/inventory/items', requireAuth, (req, res) => {
  const top    = parseInt(req.query['$top']  || '20', 10);
  const skip   = parseInt(req.query['$skip'] || '0',  10);
  const filter = req.query['$filter'] || null;
  const rows = filter
    ? ITEMS.filter(it => it.description.toLowerCase().includes(String(filter).toLowerCase()))
    : ITEMS;
  res.json({
    '@odata.context': '$metadata#inventory/items',
    '@odata.count':   rows.length,
    value:            rows.slice(skip, skip + top),
  });
});

router.get('/api/inventory/categories', requireAuth, (_req, res) => {
  res.json({ value: CATEGORIES });
});

router.get('/api/inventory/items/:id', requireAuth, (req, res) => {
  const item = ITEMS.find(it => it.itemId === req.params.id) || { ...ITEMS[0], itemId: req.params.id };
  return res.json(item);
});

router.post('/api/inventory/items', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.sku) return badRequest(res, 'name and sku are required');
  res.status(201).json({ itemId: 'ITEM-0121', description: b.name, sku: b.sku,
                         stockLevel: Number(b.quantity) || 0, warehouseId: b.warehouseId || 'WH-1' });
});

router.put('/api/inventory/items/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  if (b.quantity === undefined) return badRequest(res, 'quantity is required');
  res.json({ itemId: req.params.id, stockLevel: Number(b.quantity) });
});

router.delete('/api/inventory/items/:id', requireAuth, (req, res) => {
  res.json({ itemId: req.params.id, deleted: true });
});

// ── Employees (EP-B-012 … 015) ────────────────────────────────────────────────

router.get('/api/employees', requireAuth, (req, res) => {
  const dept = req.query.department;
  const rows = dept ? EMPLOYEES.filter(e => e.department === dept) : EMPLOYEES;
  res.json({ data: rows, total: rows.length });
});

router.get('/api/employees/:id', requireAuth, (req, res) => {
  const e = EMPLOYEES.find(x => x.id === req.params.id) || { ...EMPLOYEES[0], id: req.params.id };
  return res.json(e);
});

router.post('/api/employees', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.department) return badRequest(res, 'name and department are required');
  res.status(201).json({ id: '26', name: b.name, department: b.department, role: b.role || 'analyst' });
});

router.put('/api/employees/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.department) return badRequest(res, 'department is required');
  res.json({ id: req.params.id, department: b.department });
});

// ── Reports (EP-B-017, 018) ───────────────────────────────────────────────────

router.get('/api/reports/monthly', requireAuth, (req, res) => {
  const month = req.query.month || '2026-01';
  res.json({ month, revenue: 182340.55, orders: 1204, returns: 31 });
});

router.post('/api/reports/generate', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.type) return badRequest(res, 'type is required');
  res.status(202).json({ reportId: 'REP-0001', type: b.type, dateRange: b.dateRange || null, status: 'QUEUED' });
});

// ── Admin (EP-B-016, 019, 020) ────────────────────────────────────────────────

router.patch('/api/admin/users/:id/role', requireRole('admin'), (req, res) => {
  const b = req.body || {};
  if (!b.role) return badRequest(res, 'role is required');
  res.json({ id: req.params.id, role: b.role });
});

router.get('/api/admin/settings', requireRole('admin'), (_req, res) => {
  res.json(SETTINGS);
});

router.put('/api/admin/settings', requireRole('admin'), (req, res) => {
  SETTINGS = { ...SETTINGS, ...(req.body || {}) };
  res.json(SETTINGS);
});

// ── Background sync worker ────────────────────────────────────────────────────

router.get('/api/sync/status', requireAuth, (_req, res) => {
  res.json({ lastSync: '2026-02-01T08:00:00Z', pendingRetries: 0 });
});

router.post('/api/sync/retry-queue', requireAuth, (_req, res) => {
  res.json({ count: 0 });
});

// ── Micro-frontend landing calls ──────────────────────────────────────────────

router.get('/api/v2/users', requireAuth, (_req, res) => res.json({ data: EMPLOYEES.slice(0, 10) }));
router.get('/api/v2/finance/summary', requireAuth, (_req, res) => res.json({ revenue: 182340.55, costs: 120004.10 }));
router.get('/api/v2/hr/employees', requireAuth, (_req, res) => res.json({ data: EMPLOYEES }));
router.get('/api/v2/crm/contacts', requireAuth, (_req, res) => res.json({ data: [{ id: 'C-1', name: 'Acme Ltd' }] }));
router.get('/api/v2/analytics/metrics', requireAuth, (_req, res) => res.json({ dau: 412, wau: 1980 }));
router.get('/api/v2/reports', requireAuth, (_req, res) => res.json({ data: [{ id: 'REP-0001', type: 'monthly' }] }));

// ── Spring-style actuator (EP-B-006) ──────────────────────────────────────────
// Not referenced by any client code; a tool finds it only by probing.

router.get('/actuator', (_req, res) => {
  res.json({
    _links: {
      self:     { href: '/actuator',          templated: false },
      health:   { href: '/actuator/health',   templated: false },
      mappings: { href: '/actuator/mappings', templated: false },
    },
  });
});

router.get('/actuator/health', (_req, res) => {
  res.json({ status: 'UP', components: { db: { status: 'UP' }, redis: { status: 'UP' } } });
});

router.get('/actuator/mappings', (_req, res) => {
  const m = (handler, predicate) => ({ handler, predicate });
  res.json({
    contexts: {
      'erp-api': {
        mappings: {
          dispatcherServlets: {
            dispatcherServlet: [
              m('com.example.erp.AuthController#login()',               '{POST [/api/auth/login]}'),
              m('com.example.erp.InventoryController#listItems()',      '{GET [/api/inventory/items]}'),
              m('com.example.erp.InventoryController#getItem()',        '{GET [/api/inventory/items/{id}]}'),
              m('com.example.erp.EmployeeController#list()',            '{GET [/api/employees]}'),
              m('com.example.erp.ReportController#generate()',          '{POST [/api/reports/generate]}'),
              m('com.example.erp.admin.AdminController#getSettings()',  '{GET [/api/admin/settings]}'),
              m('com.example.erp.admin.AdminController#putSettings()',  '{PUT [/api/admin/settings]}'),
              m('com.example.erp.admin.AdminController#setRole()',      '{PATCH [/api/admin/users/{id}/role]}'),
            ],
          },
        },
      },
    },
  });
});

module.exports = router;
