'use strict';

/**
 * SPABench auth middleware
 *
 * Two strategies used across the benchmark apps:
 *
 *   requireFormAuth  — Apps A and D (form-based login)
 *     Accepts:
 *       1. Authorization: Bearer <JWT>  (JWT issued by POST /api/auth/login)
 *       2. express-session cookie       (set by same login endpoint)
 *     Returns 401 if neither is valid.
 *
 *   requireBearerAuth — Apps B, C, E (bearer token)
 *     Accepts:
 *       1. Authorization: Bearer spabench-bearer-token-dev  (static dev token)
 *       2. Authorization: Bearer <JWT>  (JWT from any login endpoint)
 *     Returns 401 if header is missing or token is invalid.
 *
 * Both middlewares attach req.benchUser = { username, role } on success.
 */

const jwt = require('jsonwebtoken');

const AUTH_SECRET    = process.env.BENCH_AUTH_SECRET || 'spabench-dev-secret-do-not-use-in-production';
const BEARER_TOKEN   = process.env.BENCH_BEARER_TOKEN || 'spabench-bearer-token-dev';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the raw token string from an Authorization header.
 * Returns null if the header is absent or malformed.
 */
function extractBearer(req) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Validate a JWT issued by this server.
 * Returns the decoded payload or null.
 */
function verifyJwt(token) {
  try {
    return jwt.verify(token, AUTH_SECRET);
  } catch {
    return null;
  }
}

// ── Form auth (Apps A, D) ──────────────────────────────────────────────────────
function requireFormAuth(req, res, next) {
  // 1. Check Authorization: Bearer <JWT>
  const token = extractBearer(req);
  if (token) {
    const payload = verifyJwt(token);
    if (payload) {
      req.benchUser = { username: payload.sub, role: payload.role };
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or expired JWT' });
  }

  // 2. Check session cookie
  if (req.session && req.session.benchUser) {
    req.benchUser = req.session.benchUser;
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized', detail: 'Login required' });
}

// ── Bearer auth (Apps B, C, E) ────────────────────────────────────────────────
function requireBearerAuth(req, res, next) {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', detail: 'Missing Authorization header' });
  }

  // 1. Accept static dev token (for automated benchmark runs that inject it directly)
  if (token === BEARER_TOKEN) {
    req.benchUser = { username: 'benchuser', role: 'admin' };
    return next();
  }

  // 2. Accept JWT (issued by POST /api/auth/login or /api/auth/mfa/verify)
  const payload = verifyJwt(token);
  if (payload) {
    req.benchUser = { username: payload.sub, role: payload.role };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or expired token' });
}

module.exports = { requireFormAuth, requireBearerAuth, verifyJwt, AUTH_SECRET };
