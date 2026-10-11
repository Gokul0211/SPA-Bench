'use strict';

/**
 * angular-permit feature modules: the lazily loaded admin and reports chunks,
 * the disabled mobile-legacy chunk, and two calls that exist only in the
 * TypeScript sources shipped in the source maps. Every path below is called by
 * the permit client (base http://localhost:4001); none is a catch-all.
 */

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();
const admin = requireRole('admin');

const PERMITS = Array.from({ length: 12 }, (_, i) => ({
  permitId: `PTW-${1000 + i}`, status: ['OPEN', 'APPROVED', 'CLOSED'][i % 3], workSiteId: `WS-${40 + (i % 4)}`,
}));
const HAZARDS = Array.from({ length: 6 }, (_, i) => ({
  assessmentId: `HZ-${100 + i}`, hazardType: ['fire', 'fall', 'electrical'][i % 3], severity: 1 + (i % 5),
}));
const CHECKS = Array.from({ length: 5 }, (_, i) => ({ checkId: `CC-${i + 1}`, result: i % 2 ? 'PASS' : 'FAIL' }));

function created(res, body) {
  return res.status(201).json(body);
}

// ── permit details by path (permit.service.ts, source map only) ──────────────
router.get('/api/rc_permit/getPermitDetails/:id', requireAuth, (req, res) => {
  res.json({ ...PERMITS[0], permitId: req.params.id });
});

// ── emergency stop (HTML formaction) ─────────────────────────────────────────
router.post('/api/rc_permit/submitEmergencyStop', requireAuth, (_req, res) => {
  res.status(202).json({ suspended: PERMITS.filter(p => p.status === 'OPEN').length });
});

// ── admin dashboard stats (admin.service.ts, source map only) ────────────────
router.get('/api/admin/dashboard-stats', admin, (_req, res) => {
  res.json({ openPermits: 4, pendingApprovals: 2, hazardsOpen: 3 });
});

// ── admin module: permits ────────────────────────────────────────────────────
router.get('/api/admin/permits', admin, (req, res) => {
  res.json({ data: PERMITS.filter(p => !req.query.status || p.status === req.query.status), page: Number(req.query.page || 1) });
});
router.post('/api/admin/permits', admin, (req, res) => created(res, { permitId: 'PTW-2001', ...(req.body || {}) }));
router.get('/api/admin/permits/:id', admin, (req, res) => res.json({ ...PERMITS[0], permitId: req.params.id }));
router.patch('/api/admin/permits/:id', admin, (req, res) => res.json({ permitId: req.params.id, ...(req.body || {}) }));
router.delete('/api/admin/permits/:id', admin, (req, res) => res.json({ permitId: req.params.id, deleted: true }));
router.put('/api/admin/permits/:id/status', admin, (req, res) => {
  res.json({ permitId: req.params.id, status: (req.body && req.body.status) || 'OPEN' });
});

// ── admin module: hazard assessments ─────────────────────────────────────────
router.get('/api/admin/hazards', admin, (_req, res) => res.json({ data: HAZARDS, total: HAZARDS.length }));
router.post('/api/admin/hazards', admin, (req, res) => created(res, { assessmentId: 'HZ-200', ...(req.body || {}) }));
router.get('/api/admin/hazards/:id', admin, (req, res) => res.json({ ...HAZARDS[0], assessmentId: req.params.id }));
router.patch('/api/admin/hazards/:id', admin, (req, res) => res.json({ assessmentId: req.params.id, ...(req.body || {}) }));
router.delete('/api/admin/hazards/:id', admin, (req, res) => res.json({ assessmentId: req.params.id, deleted: true }));
router.get('/api/admin/hazards/:id/risk-matrix', admin, (req, res) => {
  res.json({ assessmentId: req.params.id, likelihood: 3, impact: 4, rating: 'HIGH' });
});

// ── admin module: audit log ──────────────────────────────────────────────────
router.get('/api/admin/audit/log', admin, (_req, res) => {
  res.json({ entries: [{ id: 'AL-1', action: 'APPROVE', entityType: 'permit' }], total: 1 });
});
router.get('/api/admin/audit/export', admin, (req, res) => {
  res.json({ format: req.query.format || 'csv', status: 'QUEUED' });
});
router.options('/api/admin/audit/capabilities', admin, (_req, res) => {
  res.json({ canExport: true, allowedExportFormats: ['csv', 'pdf'] });
});
router.get('/api/admin/audit/log/:id', admin, (req, res) => res.json({ id: req.params.id, action: 'APPROVE' }));
router.put('/api/admin/audit/log/:id', admin, (req, res) => res.json({ id: req.params.id, amended: true }));

// ── admin module: user management ────────────────────────────────────────────
router.get('/api/admin/users/:id/profile', admin, (req, res) => {
  res.json({ id: req.params.id, displayName: `User ${req.params.id}`, lastLogin: '2026-02-01T08:00:00Z' });
});

// ── reports module ───────────────────────────────────────────────────────────
router.get('/api/reports/history', requireAuth, (req, res) => {
  res.json({ userId: req.query.userId || null, items: [{ reportId: 'R-1', type: 'monthly' }] });
});
router.get('/api/reports/templates', requireAuth, (_req, res) => {
  res.json([{ id: 'T-1', name: 'Permit summary' }, { id: 'T-2', name: 'Incident log' }]);
});
router.post('/api/reports/schedule', requireAuth, (req, res) => created(res, { scheduleId: 'S-1', ...(req.body || {}) }));
router.get('/api/reports/generate/:type', requireAuth, (req, res) => {
  res.json({ type: req.params.type, format: req.query.format || 'PDF', status: 'READY' });
});
router.get('/api/reports/compliance-checks', requireAuth, (_req, res) => res.json({ data: CHECKS }));
router.post('/api/reports/compliance-checks', requireAuth, (req, res) => created(res, { checkId: 'CC-6', ...(req.body || {}) }));
router.get('/api/reports/compliance-checks/summary', requireAuth, (_req, res) => {
  res.json({ pass: CHECKS.filter(c => c.result === 'PASS').length, fail: CHECKS.filter(c => c.result === 'FAIL').length });
});
router.get('/api/reports/compliance-checks/:id', requireAuth, (req, res) => res.json({ checkId: req.params.id, result: 'PASS' }));
router.get('/api/reports/export/status/:id', requireAuth, (req, res) => res.json({ jobId: req.params.id, status: 'DONE' }));
router.get('/api/reports/export/:type', requireAuth, (req, res) => {
  res.json({ type: req.params.type, reportId: req.query.reportId || null, status: 'QUEUED' });
});

// ── mobile-legacy chunk ──────────────────────────────────────────────────────
router.get('/api/mobile/v1/permits', requireAuth, (_req, res) => res.json({ permits: PERMITS.slice(0, 3) }));
router.post('/api/mobile/v1/permits/quick-submit', requireAuth, (req, res) => created(res, { permitId: 'PTW-3001', ...(req.body || {}) }));
router.get('/api/mobile/v1/work-orders', requireAuth, (_req, res) => res.json({ workOrders: [{ id: 'WO-1001' }] }));
router.post('/api/mobile/v1/location/checkin', requireAuth, (_req, res) => created(res, { checkinId: 'CI-1' }));
router.get('/api/mobile/v1/offline-sync', requireAuth, (req, res) => {
  res.json({ since: req.query.since || null, permits: [], workOrders: [] });
});

module.exports = router;
