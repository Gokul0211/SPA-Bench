'use strict';

/**
 * nextjs-saas routes (reached same-origin through nginx on 3005).
 *
 * Login is two-step for this app:
 *   1. POST /api/auth/login with header X-App-Id: nextjs-saas
 *        → { requiresMFA: true, sessionToken }            (app-a.js)
 *   2. POST /api/auth/mfa/verify { token: <TOTP>, sessionToken }
 *        → { accessToken }                                 (here)
 * TOTP secret: BENCH_TOTP_SECRET (default JBSWY3DPEHPK3PXP), 30 s step, ±1 step.
 *
 * Ground-truth coverage (manifest IDs):
 *   POST   /api/auth/login, POST /api/auth/mfa/verify   (login flow)
 *   GET    /api/dashboard/metrics      ?period
 *   GET/POST/PUT/DELETE /api/users…    → app-d.js (shared)
 *   GET    /api/orders                 ?userId
 *   DELETE /api/orders/:id
 *   GET    /api/billing/invoices       ?from
 *   POST   /api/billing/invoices
 *   DELETE /api/billing/invoices/:id
 *   GET    /api/team/members
 *   POST   /api/team/members
 * GraphQL (/graphql) and WebSockets (/ws/*) are separate services.
 */

const { Router }  = require('express');
const jwt         = require('jsonwebtoken');
const speakeasy   = require('speakeasy');
const { requireAuth, AUTH_SECRET } = require('../middleware/auth');
const { takeChallenge } = require('../lib/mfa');

const router = Router();

const TOTP_SECRET = process.env.BENCH_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
const PERIODS = { last_7d: 1, last_30d: 4, last_90d: 12, last_365d: 52 };
const ORDERS = Array.from({ length: 15 }, (_, i) => ({
  id: `so-${String(i + 1).padStart(3, '0')}`, userId: String((i % 5) + 1),
  status: ['paid', 'pending', 'refunded'][i % 3], total: parseFloat(((i + 1) * 19.5).toFixed(2)),
}));
const INVOICES = Array.from({ length: 8 }, (_, i) => ({
  id: `inv-${String(i + 1).padStart(3, '0')}`, orderId: ORDERS[i].id,
  issuedAt: `2026-01-${String(3 + i * 3).padStart(2, '0')}`, amount: ORDERS[i].total,
}));
const MEMBERS = [
  { userId: '1', name: 'Ada', role: 'owner' },
  { userId: '2', name: 'Lin', role: 'admin' },
  { userId: '3', name: 'Sam', role: 'member' },
];

function badRequest(res, detail) {
  return res.status(400).json({ error: 'Bad Request', detail });
}

// ── POST /api/auth/mfa/verify (login step 2) ─────────────────────────────────
router.post('/api/auth/mfa/verify', (req, res) => {
  const { token: totpCode, sessionToken } = req.body || {};
  if (!totpCode || !sessionToken) return badRequest(res, 'token and sessionToken required');

  const challenge = takeChallenge(sessionToken);
  if (!challenge) {
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or expired MFA session' });
  }
  const valid = speakeasy.totp.verify({ secret: TOTP_SECRET, encoding: 'base32', token: String(totpCode), window: 1 });
  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid TOTP code' });
  }

  req.session.benchUser = { username: challenge.username, role: challenge.role };
  const accessToken = jwt.sign({ sub: challenge.username, role: challenge.role, mfa: true },
                               AUTH_SECRET, { expiresIn: '8h' });
  return res.json({ accessToken, tokenType: 'Bearer', expiresIn: 28800,
                    user: { username: challenge.username, role: challenge.role } });
});

// ── GET /api/dashboard/metrics ────────────────────────────────────────────────
router.get('/api/dashboard/metrics', requireAuth, (req, res) => {
  const period = req.query.period || 'last_7d';
  const k = PERIODS[period];
  if (!k) return badRequest(res, `period must be one of: ${Object.keys(PERIODS).join(', ')}`);
  res.json({
    period,
    metrics: {
      totalRevenue: parseFloat((12450.00 * k).toFixed(2)),
      activeUsers:  142 * k,
      newSignups:   18 * k,
      churnRate:    0.034,
    },
    timeSeries: Array.from({ length: k }, (_, i) => ({
      bucket: `bucket_${i + 1}`, revenue: parseFloat((1778.57 * (0.9 + (i % 5) * 0.05)).toFixed(2)),
    })),
  });
});

// ── Orders ────────────────────────────────────────────────────────────────────
router.get('/api/orders', requireAuth, (req, res) => {
  const uid = req.query.userId;
  const rows = uid ? ORDERS.filter(o => o.userId === uid) : ORDERS;
  res.json({ data: rows, total: rows.length });
});

router.delete('/api/orders/:id', requireAuth, (req, res) => {
  res.json({ id: req.params.id, deleted: true });
});

// ── Billing ───────────────────────────────────────────────────────────────────
router.get('/api/billing/invoices', requireAuth, (req, res) => {
  const from = req.query.from;
  const rows = from ? INVOICES.filter(v => v.issuedAt >= from) : INVOICES;
  res.json({ data: rows, total: rows.length });
});

router.post('/api/billing/invoices', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.orderId) return badRequest(res, 'orderId is required');
  res.status(201).json({ id: 'inv-009', orderId: b.orderId, issuedAt: '2026-02-01', amount: 0 });
});

router.delete('/api/billing/invoices/:id', requireAuth, (req, res) => {
  res.json({ id: req.params.id, voided: true });
});

// ── Team ──────────────────────────────────────────────────────────────────────
router.get('/api/team/members', requireAuth, (_req, res) => {
  res.json({ data: MEMBERS });
});

router.post('/api/team/members', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.userId) return badRequest(res, 'userId is required');
  res.status(201).json({ userId: b.userId, role: b.role || 'member', invited: true });
});

module.exports = router;
