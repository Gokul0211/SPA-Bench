'use strict';

/**
 * App A — Angular Permit-to-Work SPA routes
 *
 * All endpoints run under the base path /api/ and match the manifest entries
 * for the angular-permit app (port 3001).
 *
 * Manifest coverage:
 *   EP-A-001  GET  /api/rc_permit/getPermitType       (auth: form)
 *   EP-A-002  GET  /api/rc_permit/getWorkOrder         (auth: form, ?workOrderId)
 *   EP-A-003  POST /api/rc_permit/createPermit         (auth: form, body: CreatePermitRequest)
 *   EP-A-004  GET  /api/rc_permit/getPermitDetails     (auth: form, ?id)
 *   EP-A-007  GET  /api/admin/legacy-reports           (auth: form, admin-only)
 *   EP-A-008  GET  /api/v1/orders                      (auth: form, legacy branch)
 *   EP-A-009  GET  /api/v2/orders                      (auth: form, new branch)
 *   EP-A-010  POST /api/auth/login                     (public, returns JWT)
 *
 * EP-A-005 (staging URL) and EP-A-006 (OAuth endpoint) are recovered from
 * environment.ts via source map — they live on external hosts, not this server.
 *
 * Auth note: form auth accepts both JWT Bearer and express-session cookie.
 */

const { Router }         = require('express');
const jwt                = require('jsonwebtoken');
const { requireFormAuth, AUTH_SECRET } = require('../middleware/auth');
const { v4: uuidv4 }     = require('uuid');

const router = Router();

// ── Credential store (fixed benchmark credentials) ───────────────────────────
const BENCH_USERS = {
  benchuser: { password: 'benchpass', role: 'operator' },
  benchadmin: { password: 'benchpass', role: 'admin' },
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// EP-A-010: recovered from auth.service.ts via source map.
// Accepts { username, password, rememberMe }.
// Returns a signed JWT; also sets an express-session for cookie-based clients.
router.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Bad Request', detail: 'username and password required' });
  }

  const user = BENCH_USERS[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid credentials' });
  }

  // Persist to session for cookie-based flow (Apps A, D form auth)
  req.session.benchUser = { username, role: user.role };

  const token = jwt.sign(
    { sub: username, role: user.role },
    AUTH_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    expiresIn: 28800,
    tokenType: 'Bearer',
    user: { username, role: user.role },
  });
});

// ── GET /api/rc_permit/getPermitType ─────────────────────────────────────────
// EP-A-001: Base URL stored in environment.apiUrl → this.o (minified).
// Returns the list of permit type codes used across sub-applications.
router.get('/api/rc_permit/getPermitType', requireFormAuth, (_req, res) => {
  res.json({
    permitTypes: [
      { code: 'HOT_WORK',      label: 'Hot Work Permit' },
      { code: 'CONFINED_SPACE', label: 'Confined Space Entry' },
      { code: 'ELECTRICAL',    label: 'Electrical Isolation' },
      { code: 'HEIGHT',        label: 'Work at Height' },
      { code: 'EXCAVATION',    label: 'Excavation' },
      { code: 'CHEMICAL',      label: 'Chemical Handling' },
    ],
  });
});

// ── GET /api/rc_permit/getWorkOrder ──────────────────────────────────────────
// EP-A-002: Base URL flows through 3-file constructor injection chain.
// Requires ?workOrderId query param.
router.get('/api/rc_permit/getWorkOrder', requireFormAuth, (req, res) => {
  const { workOrderId } = req.query;
  if (!workOrderId) {
    return res.status(400).json({ error: 'Bad Request', detail: 'workOrderId is required' });
  }

  return res.json({
    workOrderId,
    workSiteId: 'WS-' + workOrderId.slice(-4),
    status: 'OPEN',
    supervisorId: 1042,
    hazardLevel: 'MEDIUM',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-01-15T09:30:00Z',
  });
});

// ── POST /api/rc_permit/createPermit ─────────────────────────────────────────
// EP-A-003: Typed request body — CreatePermitRequest interface.
// Parameters: workSiteId, startDate, endDate, hazardLevel, supervisorId.
router.post('/api/rc_permit/createPermit', requireFormAuth, (req, res) => {
  const { workSiteId, startDate, endDate, hazardLevel, supervisorId } = req.body || {};
  const missing = [];
  if (!workSiteId)   missing.push('workSiteId');
  if (!startDate)    missing.push('startDate');
  if (!endDate)      missing.push('endDate');
  if (!hazardLevel)  missing.push('hazardLevel');
  if (supervisorId === undefined) missing.push('supervisorId');

  if (missing.length) {
    return res.status(400).json({ error: 'Bad Request', detail: `Missing: ${missing.join(', ')}` });
  }

  const validLevels = ['LOW', 'MEDIUM', 'HIGH'];
  if (!validLevels.includes(hazardLevel)) {
    return res.status(400).json({ error: 'Bad Request', detail: 'hazardLevel must be LOW | MEDIUM | HIGH' });
  }

  return res.status(201).json({
    permitId: 'PTW-' + uuidv4().slice(0, 8).toUpperCase(),
    workSiteId,
    startDate,
    endDate,
    hazardLevel,
    supervisorId,
    status: 'PENDING_APPROVAL',
    createdAt: new Date().toISOString(),
  });
});

// ── GET /api/rc_permit/getPermitDetails ──────────────────────────────────────
// EP-A-004: Exclusive Phase 1.5 — only found via source map decompilation.
// Requires ?id query param.
router.get('/api/rc_permit/getPermitDetails', requireFormAuth, (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Bad Request', detail: 'id is required' });
  }

  return res.json({
    permitId: id,
    permitType: 'HOT_WORK',
    workSiteId: 'WS-0042',
    status: 'APPROVED',
    hazardLevel: 'HIGH',
    supervisorId: 1042,
    startDate: '2026-02-01',
    endDate: '2026-02-03',
    approvedBy: 'benchadmin',
    approvedAt: '2026-01-30T14:22:00Z',
    conditions: [
      'Fire extinguisher on site',
      'Hot work log maintained',
      'Area cleared of flammables within 10m',
    ],
  });
});

// ── GET /api/admin/legacy-reports ────────────────────────────────────────────
// EP-A-007: URL assembled from obfuscated string array in minified bundle.
// Security-relevant: admin CRUD endpoint.
router.get('/api/admin/legacy-reports', requireFormAuth, (req, res) => {
  // Simulate admin-role enforcement on top of form auth
  if (req.benchUser && req.benchUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', detail: 'Admin role required' });
  }

  return res.json({
    reports: [
      { id: 'RPT-001', name: 'Q1 Permit Summary',    generatedAt: '2026-01-31T23:59:00Z' },
      { id: 'RPT-002', name: 'Incident Log 2025',    generatedAt: '2025-12-31T23:59:00Z' },
      { id: 'RPT-003', name: 'Compliance Audit H2',  generatedAt: '2025-07-01T00:00:00Z' },
    ],
    _note: 'Legacy report store — scheduled for migration to /api/v2/reports',
  });
});

// ── GET /api/v1/orders ───────────────────────────────────────────────────────
// EP-A-008: False branch of feature-flag ternary.
// featureFlags.newOrdersApi ? '/api/v2/orders' : '/api/v1/orders'
router.get('/api/v1/orders', requireFormAuth, (_req, res) => {
  res.json({
    _version: 'v1',
    _note: 'Legacy order endpoint — still callable even when feature flag enables v2',
    orders: [
      { orderId: 'ORD-1001', status: 'DELIVERED', total: 4200.00 },
      { orderId: 'ORD-1002', status: 'PENDING',   total: 850.50  },
    ],
  });
});

// ── GET /api/v2/orders ───────────────────────────────────────────────────────
// EP-A-009: True branch of the same feature-flag ternary.
// Both branches must appear in tool output.
router.get('/api/v2/orders', requireFormAuth, (_req, res) => {
  res.json({
    _version: 'v2',
    data: [
      {
        orderId: 'ORD-1001',
        status: 'DELIVERED',
        total: 4200.00,
        lineItems: [{ sku: 'ITEM-001', qty: 2, unitPrice: 2100.00 }],
      },
      {
        orderId: 'ORD-1002',
        status: 'PENDING',
        total: 850.50,
        lineItems: [{ sku: 'ITEM-042', qty: 1, unitPrice: 850.50 }],
      },
    ],
    pagination: { page: 1, limit: 20, total: 2 },
  });
});

module.exports = router;
