'use strict';

/**
 * App E — Next.js SaaS Dashboard routes
 *
 * Manifest coverage:
 *   EP-E-020  GET  /api/dashboard/metrics   (auth: bearer, ?period)
 *
 * Auth flow for App E (TOTP MFA — TC-AUTH-003):
 *   Step 1  POST /api/auth/login          → { requiresMFA: true, sessionToken }
 *   Step 2  POST /api/auth/mfa/verify     → { accessToken }
 *
 *   The base /api/auth/login route is defined in app-a.js and shared. For App E,
 *   the same endpoint detects the 'totp' flag and responds with the MFA challenge
 *   when the client sends x-app-id: nextjs-saas or the username is 'benchuser_e'.
 *
 *   Alternatively, this module overrides nothing — it adds only:
 *     POST /api/auth/mfa/verify   (TOTP step 2)
 *     GET  /api/dashboard/metrics
 *
 * TOTP secret: JBSWY3DPEHPK3PXP (from docker-compose BENCH_TOTP_SECRET)
 * Known token generation: speakeasy.totp({ secret, encoding: 'base32' })
 */

const { Router }             = require('express');
const jwt                    = require('jsonwebtoken');
const speakeasy              = require('speakeasy');
const { requireBearerAuth, AUTH_SECRET } = require('../middleware/auth');

const router = Router();

// In-memory MFA session store (benchmark only — not production-safe)
// Maps sessionToken → { username, role, expiresAt }
const MFA_SESSIONS = new Map();

// ── POST /api/auth/mfa/verify ─────────────────────────────────────────────────
// TC-AUTH-003: TOTP two-factor auth step 2.
// The client sends { token: <6-digit TOTP code>, sessionToken: <from step 1> }.
// On success returns { accessToken } (JWT) that satisfies bearer auth on all
// App E protected endpoints.
router.post('/api/auth/mfa/verify', (req, res) => {
  const { token: totpCode, sessionToken } = req.body || {};

  if (!totpCode || !sessionToken) {
    return res.status(400).json({ error: 'Bad Request', detail: 'token and sessionToken required' });
  }

  const session = MFA_SESSIONS.get(sessionToken);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or expired MFA session' });
  }

  if (Date.now() > session.expiresAt) {
    MFA_SESSIONS.delete(sessionToken);
    return res.status(401).json({ error: 'Unauthorized', detail: 'MFA session expired' });
  }

  const totpSecret = process.env.BENCH_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
  const valid = speakeasy.totp.verify({
    secret:   totpSecret,
    encoding: 'base32',
    token:    totpCode,
    window:   1,    // allow ±30 seconds clock skew
  });

  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid TOTP code' });
  }

  MFA_SESSIONS.delete(sessionToken);   // one-time use

  const accessToken = jwt.sign(
    { sub: session.username, role: session.role, mfa: true },
    AUTH_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({
    accessToken,
    tokenType:  'Bearer',
    expiresIn:  28800,
    user:       { username: session.username, role: session.role },
  });
});

// ── GET /api/dashboard/metrics ────────────────────────────────────────────────
// EP-E-020: React useEffect + fetch pattern.
// URL uses template literal with period state variable.
// ?period is required (e.g. 'last_7d', 'last_30d', 'last_90d').
router.get('/api/dashboard/metrics', requireBearerAuth, (req, res) => {
  const { period } = req.query;

  if (!period) {
    return res.status(400).json({ error: 'Bad Request', detail: 'period query param required' });
  }

  const validPeriods = ['last_7d', 'last_30d', 'last_90d', 'last_365d'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({
      error:  'Bad Request',
      detail: `period must be one of: ${validPeriods.join(', ')}`,
    });
  }

  const multiplier = { last_7d: 1, last_30d: 4, last_90d: 12, last_365d: 52 }[period];

  return res.json({
    period,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalRevenue:      parseFloat((12450.00 * multiplier).toFixed(2)),
      activeUsers:       142 * multiplier,
      newSignups:        18  * multiplier,
      churnRate:         0.034,
      mrr:               4980.00,
      conversionRate:    0.068,
    },
    timeSeries: Array.from({ length: multiplier }, (_, i) => ({
      bucket:  `bucket_${i + 1}`,
      revenue: parseFloat((1778.57 * (0.8 + Math.random() * 0.4)).toFixed(2)),
      users:   Math.floor(142 * (0.8 + Math.random() * 0.4)),
    })),
  });
});

// ── Export MFA_SESSIONS so app-a.js login can write into it ───────────────────
// When the login endpoint detects App E context (x-app-id header or username suffix _e),
// it creates a pending MFA session here instead of immediately returning a full JWT.
module.exports = router;
module.exports.MFA_SESSIONS = MFA_SESSIONS;
module.exports.AUTH_SECRET  = AUTH_SECRET;
