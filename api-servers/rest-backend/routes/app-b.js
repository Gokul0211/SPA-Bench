'use strict';

/**
 * App B — Angular ERP (Module Federation) routes
 *
 * Manifest coverage:
 *   EP-B-003  GET  /api/inventory/items     (auth: bearer, OData params)
 *   EP-B-004  GET  /internal/api            → lives at 10.0.1.45:8080, NOT this server.
 *                                             Included here as a stub so sanity_check.py
 *                                             can verify the internal-IP finding is a real URL.
 *   EP-B-005  POST /api/auth/login          → handled by app-a.js (shared login endpoint)
 *   EP-B-006  GET  /actuator/mappings       (public, TC-P4-009 spring_actuator_mappings)
 *
 * Note on EP-B-001 / EP-B-002 (remoteEntry.js):
 *   These are static JS files served by the angular-erp MFE containers (ports 3011, 3012).
 *   The REST backend does not serve them.
 *
 * Note on EP-B-004:
 *   The internal IP 10.0.1.45:8080 is embedded in the mfe-admin webpack bundle.
 *   This server does NOT expose that endpoint — it is intentionally unreachable.
 *   The benchmark measures whether the tool *finds* the URL, not whether it can *call* it.
 */

const { Router }             = require('express');
const { requireBearerAuth }  = require('../middleware/auth');

const router = Router();

// ── GET /api/inventory/items ──────────────────────────────────────────────────
// EP-B-003: Exists in __webpack_modules__[847] — never triggered by navigation.
// OData parameters: $filter, $top, $skip, $expand
router.get('/api/inventory/items', requireBearerAuth, (req, res) => {
  const top    = parseInt(req.query['$top']  || '20', 10);
  const skip   = parseInt(req.query['$skip'] || '0',  10);
  const filter = req.query['$filter'] || null;

  // Simulate a small inventory dataset
  const allItems = Array.from({ length: 120 }, (_, i) => ({
    itemId:       `ITEM-${String(i + 1).padStart(4, '0')}`,
    sku:          `SKU-${(i + 1) * 7}`,
    description:  `Inventory item #${i + 1}`,
    stockLevel:   Math.floor(Math.random() * 500),
    unitCost:     parseFloat(((i + 1) * 12.99).toFixed(2)),
    warehouseId:  `WH-${(i % 4) + 1}`,
  }));

  // Very basic $filter simulation (name contains)
  const filtered = filter
    ? allItems.filter(it => it.description.toLowerCase().includes(filter.toLowerCase()))
    : allItems;

  const page = filtered.slice(skip, skip + top);

  return res.json({
    '@odata.context': `$metadata#inventory/items`,
    '@odata.count':   filtered.length,
    value:            page,
  });
});

// ── GET /actuator/mappings ────────────────────────────────────────────────────
// EP-B-006: TC-P4-009 spring_actuator_mappings
// Returns a realistic Spring Boot Actuator /actuator/mappings JSON response.
// Not referenced anywhere in the frontend bundle — only found by probing.
// Security-relevant: exposes internal admin endpoints not visible in the frontend.
router.get('/actuator/mappings', (_req, res) => {
  res.json({
    contexts: {
      'spabench-erp': {
        mappings: {
          dispatcherServlets: {
            dispatcherServlet: [
              // Public endpoints (visible in the frontend)
              { handler: 'com.spabench.erp.controller.AuthController#login()',            predicate: '{POST [/api/auth/login]}' },
              { handler: 'com.spabench.erp.controller.InventoryController#listItems()',   predicate: '{GET [/api/inventory/items]}' },
              { handler: 'com.spabench.erp.controller.OrderController#listOrders()',      predicate: '{GET [/api/orders]}' },
              { handler: 'com.spabench.erp.controller.UserController#getUser()',          predicate: '{GET [/api/users/{id}]}' },
              { handler: 'com.spabench.erp.controller.ReportController#generate()',       predicate: '{POST [/api/reports/generate]}' },

              // Internal admin endpoints NOT referenced in the frontend bundle
              // These are the high-value findings from the actuator probe
              { handler: 'com.spabench.erp.admin.AdminController#purgeCache()',           predicate: '{DELETE [/api/admin/cache]}' },
              { handler: 'com.spabench.erp.admin.AdminController#listUsers()',            predicate: '{GET [/api/admin/users]}' },
              { handler: 'com.spabench.erp.admin.AdminController#resetUserPassword()',    predicate: '{POST [/api/admin/users/{id}/reset-password]}' },
              { handler: 'com.spabench.erp.admin.AdminController#getSystemConfig()',      predicate: '{GET [/api/admin/system/config]}' },
              { handler: 'com.spabench.erp.admin.AdminController#updateSystemConfig()',   predicate: '{PUT [/api/admin/system/config]}' },
              { handler: 'com.spabench.erp.admin.AuditController#exportAuditLog()',       predicate: '{GET [/api/admin/audit/export]}' },
              { handler: 'com.spabench.erp.internal.InternalController#syncLegacy()',     predicate: '{POST [/api/internal/sync/legacy]}' },
              { handler: 'com.spabench.erp.internal.InternalController#flushQueue()',     predicate: '{DELETE [/api/internal/queue/flush]}' },
            ],
          },
        },
      },
    },
  });
});

// ── GET /actuator/health ──────────────────────────────────────────────────────
// Secondary actuator endpoint — realistic companion to /actuator/mappings
router.get('/actuator/health', (_req, res) => {
  res.json({ status: 'UP', components: { db: { status: 'UP' }, redis: { status: 'UP' } } });
});

// ── GET /actuator ─────────────────────────────────────────────────────────────
// Discovery index — tools that probe /actuator first discover links to sub-endpoints
router.get('/actuator', (_req, res) => {
  res.json({
    _links: {
      self:     { href: '/actuator',           templated: false },
      health:   { href: '/actuator/health',    templated: false },
      mappings: { href: '/actuator/mappings',  templated: false },
      metrics:  { href: '/actuator/metrics',   templated: false },
      info:     { href: '/actuator/info',      templated: false },
    },
  });
});

module.exports = router;
