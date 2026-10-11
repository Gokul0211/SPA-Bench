'use strict';

/**
 * angular-permit routes + the shared login endpoint.
 *
 * Ground-truth coverage (manifest IDs):
 *   EP-A-001  GET    /api/rc_permit/getPermitType
 *   EP-A-002  GET    /api/rc_permit/getWorkOrder          ?workOrderId
 *   EP-A-003  POST   /api/rc_permit/createPermit
 *   EP-A-004  GET    /api/rc_permit/getPermitDetails      ?id
 *   EP-A-007  GET    /api/admin/legacy-reports            admin
 *   EP-A-008  GET    /api/v1/orders
 *   EP-A-009  GET    /api/v2/orders
 *   EP-A-010  POST   /api/auth/login                      public (shared by all apps)
 *   EP-A-011  GET    /api/rc_permit/listPermits           ?status ?page
 *   EP-A-012  PUT    /api/rc_permit/updatePermit
 *   EP-A-013  DELETE /api/rc_permit/cancelPermit          ?id
 *   EP-A-014  PATCH  /api/rc_permit/approvePermit
 *   EP-A-015  GET    /api/rc_permit/getAuditTrail         ?permitId ?from
 *   EP-A-016  POST   /api/rc_permit/uploadAttachment
 *   EP-A-017  GET    /api/admin/users                     admin
 *   EP-A-018  POST   /api/admin/users                     admin
 *   EP-A-019  DELETE /api/admin/users/:id                 admin
 *   EP-A-020  GET    /api/v2/permits/:id/approvals
 *   EP-A-021  GET    /api/v2/permits/search               ?q ?hazardLevel
 *   EP-A-022  PATCH  /api/rc_permit/updateStatus
 * Also called by the client: GET /api/auth/me, GET /api/rc_permit/appConfig.
 * EP-A-005/006 live on non-routable hosts (*.internal) and are intentionally not served.
 */

const { Router } = require('express');
const jwt        = require('jsonwebtoken');
const { requireAuth, requireRole, AUTH_SECRET } = require('../middleware/auth');
const { startChallenge } = require('../lib/mfa');

const router = Router();

// Fixed benchmark credentials.
const BENCH_USERS = {
  benchuser:  { password: 'benchpass', role: 'operator' },
  benchadmin: { password: 'benchpass', role: 'admin' },
};

// Apps whose login requires a second (TOTP) factor. The client says which app
// it is (X-App-Id); the same accounts are used everywhere.
const MFA_APPS = new Set(['nextjs-saas']);

const HAZARD_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
const PERMITS = Array.from({ length: 30 }, (_, i) => ({
  permitId:    `PTW-${String(1000 + i)}`,
  permitType:  ['HOT_WORK', 'CONFINED_SPACE', 'ELECTRICAL', 'HEIGHT', 'EXCAVATION'][i % 5],
  workSiteId:  `WS-${String(40 + (i % 7)).padStart(4, '0')}`,
  status:      ['OPEN', 'PENDING_APPROVAL', 'APPROVED', 'CLOSED'][i % 4],
  hazardLevel: HAZARD_LEVELS[i % 3],
  startDate:   `2026-02-${String(1 + (i % 27)).padStart(2, '0')}`,
}));
const ADMIN_USERS = [
  { id: '1', username: 'benchadmin', role: 'admin' },
  { id: '2', username: 'benchuser',  role: 'operator' },
  { id: '3', username: 'site.lead',  role: 'supervisor' },
];

function missing(body, fields) {
  return fields.filter(f => body[f] === undefined || body[f] === '');
}

// ── POST /api/auth/login (EP-A-010; shared) ──────────────────────────────────
// Body { username, password }. Returns a JWT and sets a session cookie, or —
// for apps in MFA_APPS — a TOTP challenge to finish at POST /api/auth/mfa/verify.
router.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Bad Request', detail: 'username and password required' });
  }
  const user = BENCH_USERS[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid credentials' });
  }

  if (MFA_APPS.has(req.get('X-App-Id'))) {
    return res.json({ requiresMFA: true, sessionToken: startChallenge(username, user.role) });
  }

  req.session.benchUser = { username, role: user.role };
  const token = jwt.sign({ sub: username, role: user.role }, AUTH_SECRET, { expiresIn: '8h' });
  return res.json({
    token,
    accessToken: token,
    expiresIn:   28800,
    tokenType:   'Bearer',
    user:        { username, role: user.role },
  });
});

router.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ username: req.benchUser.username, role: req.benchUser.role });
});

router.get('/api/rc_permit/appConfig', (_req, res) => {
  res.json({ featureFlags: { useV2Orders: false, enableLegacyReports: true }, sessionTimeout: 28800 });
});

// ── Permits (EP-A-001 … 004, 011 … 016, 020 … 022) ───────────────────────────

router.get('/api/rc_permit/getPermitType', requireAuth, (_req, res) => {
  res.json({
    permitTypes: [
      { code: 'HOT_WORK',       label: 'Hot Work Permit' },
      { code: 'CONFINED_SPACE', label: 'Confined Space Entry' },
      { code: 'ELECTRICAL',     label: 'Electrical Isolation' },
      { code: 'HEIGHT',         label: 'Work at Height' },
      { code: 'EXCAVATION',     label: 'Excavation' },
      { code: 'CHEMICAL',       label: 'Chemical Handling' },
    ],
  });
});

router.get('/api/rc_permit/getWorkOrder', requireAuth, (req, res) => {
  const { workOrderId } = req.query;
  if (!workOrderId) {
    return res.status(400).json({ error: 'Bad Request', detail: 'workOrderId is required' });
  }
  return res.json({
    workOrderId,
    workSiteId:   'WS-' + String(workOrderId).slice(-4),
    status:       'OPEN',
    supervisorId: 1042,
    hazardLevel:  'MEDIUM',
    createdAt:    '2026-01-15T08:00:00Z',
  });
});

router.post('/api/rc_permit/createPermit', requireAuth, (req, res) => {
  const body = req.body || {};
  const miss = missing(body, ['workSiteId', 'startDate', 'endDate', 'hazardLevel', 'supervisorId']);
  if (miss.length) {
    return res.status(400).json({ error: 'Bad Request', detail: `Missing: ${miss.join(', ')}` });
  }
  if (!HAZARD_LEVELS.includes(body.hazardLevel)) {
    return res.status(400).json({ error: 'Bad Request', detail: 'hazardLevel must be LOW | MEDIUM | HIGH' });
  }
  return res.status(201).json({ permitId: 'PTW-2001', ...body, status: 'PENDING_APPROVAL' });
});

router.get('/api/rc_permit/getPermitDetails', requireAuth, (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Bad Request', detail: 'id is required' });
  const p = PERMITS.find(x => x.permitId === id) || PERMITS[0];
  return res.json({ ...p, permitId: id, approvedBy: 'benchadmin', conditions: ['Fire extinguisher on site'] });
});

router.get('/api/rc_permit/listPermits', requireAuth, (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const status = req.query.status;
  const rows   = status ? PERMITS.filter(p => p.status === status) : PERMITS;
  res.json({ data: rows.slice((page - 1) * 10, page * 10), page, total: rows.length });
});

router.put('/api/rc_permit/updatePermit', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!body.id) return res.status(400).json({ error: 'Bad Request', detail: 'id is required' });
  res.json({ ...body, permitId: body.id, updated: true });
});

router.delete('/api/rc_permit/cancelPermit', requireAuth, (req, res) => {
  if (!req.query.id) return res.status(400).json({ error: 'Bad Request', detail: 'id is required' });
  res.json({ permitId: req.query.id, status: 'CANCELLED' });
});

router.patch('/api/rc_permit/approvePermit', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!body.id) return res.status(400).json({ error: 'Bad Request', detail: 'id is required' });
  res.json({ permitId: body.id, status: 'APPROVED', approverNote: body.approverNote || null, approvedBy: req.benchUser.username });
});

router.patch('/api/rc_permit/updateStatus', requireAuth, (req, res) => {
  const body = req.body || {};
  const miss = missing(body, ['id', 'status']);
  if (miss.length) return res.status(400).json({ error: 'Bad Request', detail: `Missing: ${miss.join(', ')}` });
  res.json({ permitId: body.id, status: body.status });
});

router.get('/api/rc_permit/getAuditTrail', requireAuth, (req, res) => {
  const { permitId, from } = req.query;
  if (!permitId) return res.status(400).json({ error: 'Bad Request', detail: 'permitId is required' });
  res.json({
    permitId,
    from: from || null,
    events: [
      { at: '2026-02-01T08:00:00Z', action: 'CREATED',  by: 'benchuser' },
      { at: '2026-02-01T09:15:00Z', action: 'APPROVED', by: 'benchadmin' },
    ],
  });
});

router.post('/api/rc_permit/uploadAttachment', requireAuth, (req, res) => {
  // Multipart bodies are not parsed; the endpoint only has to exist and accept the call.
  res.status(201).json({ attachmentId: 'ATT-0001', permitId: (req.body && req.body.permitId) || null });
});

router.get('/api/v2/permits/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const level = req.query.hazardLevel;
  const rows = PERMITS.filter(p => (!q || p.permitId.toLowerCase().includes(q) || p.permitType.toLowerCase().includes(q))
                                 && (!level || p.hazardLevel === level));
  res.json({ data: rows, total: rows.length });
});

router.get('/api/v2/permits/:id/approvals', requireAuth, (req, res) => {
  res.json({
    permitId: req.params.id,
    approvals: [
      { step: 1, role: 'supervisor', decision: 'APPROVED', at: '2026-02-01T09:00:00Z' },
      { step: 2, role: 'safety',     decision: 'PENDING',  at: null },
    ],
  });
});

// ── Admin (EP-A-007, 017 … 019) ───────────────────────────────────────────────

router.get('/api/admin/legacy-reports', requireRole('admin'), (_req, res) => {
  res.json({
    reports: [
      { id: 'RPT-001', name: 'Q1 Permit Summary',   generatedAt: '2026-01-31T23:59:00Z' },
      { id: 'RPT-002', name: 'Incident Log 2025',   generatedAt: '2025-12-31T23:59:00Z' },
      { id: 'RPT-003', name: 'Compliance Audit H2', generatedAt: '2025-07-01T00:00:00Z' },
    ],
  });
});

router.get('/api/admin/users', requireRole('admin'), (_req, res) => {
  res.json({ data: ADMIN_USERS, total: ADMIN_USERS.length });
});

router.post('/api/admin/users', requireRole('admin'), (req, res) => {
  const body = req.body || {};
  const miss = missing(body, ['username', 'role']);
  if (miss.length) return res.status(400).json({ error: 'Bad Request', detail: `Missing: ${miss.join(', ')}` });
  res.status(201).json({ id: '4', username: body.username, role: body.role });
});

router.delete('/api/admin/users/:id', requireRole('admin'), (req, res) => {
  res.json({ id: req.params.id, deleted: true });
});

// ── Orders (EP-A-008/009; GET /api/v2/orders is shared with react-ecommerce) ─

router.get('/api/v1/orders', requireAuth, (_req, res) => {
  res.json({
    orders: [
      { orderId: 'ORD-1001', status: 'DELIVERED', total: 4200.00 },
      { orderId: 'ORD-1002', status: 'PENDING',   total: 850.50 },
    ],
  });
});

router.get('/api/v2/orders', requireAuth, (_req, res) => {
  res.json({
    data: [
      { orderId: 'ORD-1001', status: 'DELIVERED', total: 4200.00, lineItems: [{ sku: 'ITEM-001', qty: 2, unitPrice: 2100.00 }] },
      { orderId: 'ORD-1002', status: 'PENDING',   total: 850.50,  lineItems: [{ sku: 'ITEM-042', qty: 1, unitPrice: 850.50 }] },
    ],
    pagination: { page: 1, limit: 20, total: 2 },
  });
});

module.exports = router;
