'use strict';

/**
 * vue-portal routes (reached same-origin through nginx on 3004). The /api/users
 * family is also used by nextjs-saas (EP-E-017 … 021).
 *
 * Ground-truth coverage (manifest IDs):
 *   EP-D-001  GET    /api/users/:id
 *   EP-D-005  GET    /api/users
 *   EP-D-006  POST   /api/users
 *   EP-D-007  PUT    /api/users/:id
 *   EP-D-008  DELETE /api/users/:id                admin
 *   EP-D-009  PATCH  /api/users/:id/status
 *   EP-D-010  GET    /api/departments
 *   EP-D-011  POST   /api/departments
 *   EP-D-012  GET    /api/permits                  ?status
 *   EP-D-013  POST   /api/permits
 *   EP-D-014  DELETE /api/permits/:id
 *   EP-D-015  GET    /api/documents/:id
 *   EP-D-016  POST   /api/documents/upload
 *   EP-D-017  GET    /api/audit-log                ?from
 *   EP-D-018  GET    /api/legacy/reports
 * EP-D-002 … 004 (/api/legacy/bridge/*) are served by the soap-bridge service.
 */

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

const USERS = Array.from({ length: 40 }, (_, i) => ({
  id:         String(i + 1),
  username:   `gov_user_${i + 1}`,
  fullName:   `Government Employee ${i + 1}`,
  department: ['HR', 'Finance', 'Operations', 'IT', 'Compliance'][i % 5],
  email:      `employee${i + 1}@gov.example`,
  active:     i % 7 !== 0,
}));
const DEPARTMENTS = ['HR', 'Finance', 'Operations', 'IT', 'Compliance']
  .map((name, i) => ({ id: `dept-${i + 1}`, name, managerId: String(i + 1) }));
const PERMITS = Array.from({ length: 12 }, (_, i) => ({
  id:        `gp-${i + 1}`,
  type:      ['parking', 'building-access', 'records'][i % 3],
  userId:    String((i % 40) + 1),
  status:    ['active', 'expired', 'pending'][i % 3],
  validFrom: '2026-01-01',
}));

function badRequest(res, detail) {
  return res.status(400).json({ error: 'Bad Request', detail });
}

// ── Users (EP-D-001, 005 … 009; shared with nextjs-saas) ─────────────────────

router.get('/api/users', requireAuth, (_req, res) => {
  res.json({ data: USERS.slice(0, 20), total: USERS.length, page: 1, limit: 20 });
});

router.post('/api/users', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.username && !b.name) return badRequest(res, 'username (or name) is required');
  res.status(201).json({ id: '41', username: b.username || b.name, email: b.email || null,
                         department: b.department || null, role: b.role || 'member' });
});

router.get('/api/users/:id', requireAuth, (req, res) => {
  // Unknown ids get a synthesised record so any well-formed id is a 200.
  res.json(USERS.find(u => u.id === req.params.id) || { ...USERS[0], id: req.params.id });
});

router.put('/api/users/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  res.json({ id: req.params.id, ...b, updated: true });
});

router.delete('/api/users/:id', requireRole('admin'), (req, res) => {
  res.json({ id: req.params.id, deleted: true });
});

router.patch('/api/users/:id/status', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.status) return badRequest(res, 'status is required');
  res.json({ id: req.params.id, status: b.status });
});

// ── Departments (EP-D-010, 011) ───────────────────────────────────────────────

router.get('/api/departments', requireAuth, (_req, res) => {
  res.json({ data: DEPARTMENTS });
});

router.post('/api/departments', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.name) return badRequest(res, 'name is required');
  res.status(201).json({ id: 'dept-6', name: b.name, managerId: b.managerId || null });
});

// ── Permits (EP-D-012 … 014) ──────────────────────────────────────────────────

router.get('/api/permits', requireAuth, (req, res) => {
  const status = req.query.status;
  const rows = status ? PERMITS.filter(p => p.status === status) : PERMITS;
  res.json({ data: rows, total: rows.length });
});

router.post('/api/permits', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.type || !b.userId) return badRequest(res, 'type and userId are required');
  res.status(201).json({ id: 'gp-13', type: b.type, userId: b.userId, validFrom: b.validFrom || null, status: 'pending' });
});

router.delete('/api/permits/:id', requireAuth, (req, res) => {
  res.json({ id: req.params.id, deleted: true });
});

// ── Documents (EP-D-015, 016) ─────────────────────────────────────────────────

router.post('/api/documents/upload', requireAuth, (req, res) => {
  // Multipart bodies are not parsed; the endpoint only has to exist and accept the call.
  res.status(201).json({ documentId: 'doc-0001', permitId: (req.body && req.body.permitId) || null });
});

router.get('/api/documents/:id', requireAuth, (req, res) => {
  res.json({ id: req.params.id, title: `Document ${req.params.id}`, mimeType: 'application/pdf', sizeBytes: 48213 });
});

// ── Audit and legacy reporting (EP-D-017, 018) ────────────────────────────────

router.get('/api/audit-log', requireAuth, (req, res) => {
  res.json({
    from: req.query.from || null,
    entries: [
      { at: '2026-02-01T08:00:00Z', actor: 'gov_user_1', action: 'LOGIN' },
      { at: '2026-02-01T08:05:12Z', actor: 'gov_user_1', action: 'VIEW_RECORD', target: 'employee/7' },
    ],
  });
});

router.get('/api/legacy/reports', requireAuth, (_req, res) => {
  res.json({ reports: [{ id: 'LR-01', name: 'Headcount by grade' }, { id: 'LR-02', name: 'Payroll summary' }] });
});

// Called by the <noscript> fallback script (fallback-legacy.js).
router.post('/api/legacy/session/keepalive', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

module.exports = router;
