'use strict';

/**
 * SPABench auth middleware — one policy for every route bundle.
 *
 * A request is authenticated by the first of:
 *   1. Authorization: Bearer <JWT>   issued by POST /api/auth/login
 *                                    or POST /api/auth/mfa/verify
 *   2. the express-session cookie    set by the same login endpoint
 *   3. Authorization: Bearer <BENCH_BEARER_TOKEN>
 *        only when BENCH_ALLOW_STATIC_TOKEN=1 (debugging aid, off by default,
 *        so a benchmark run always has to log in)
 *
 * How a client authenticates (bearer header vs cookie) is a property of the
 * client, not of the route, so several apps can share one API path.
 * On success req.benchUser = { username, role }.
 */

const jwt = require('jsonwebtoken');

const AUTH_SECRET        = process.env.BENCH_AUTH_SECRET  || 'dev-secret-do-not-use-in-production';
const BEARER_TOKEN       = process.env.BENCH_BEARER_TOKEN || 'spabench-bearer-token-dev';
const ALLOW_STATIC_TOKEN = process.env.BENCH_ALLOW_STATIC_TOKEN === '1';

function extractBearer(req) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function verifyJwt(token) {
  try {
    return jwt.verify(token, AUTH_SECRET);
  } catch {
    return null;
  }
}

/** Resolve the caller to { username, role } or null. */
function identify(req) {
  const token = extractBearer(req);
  if (token) {
    if (ALLOW_STATIC_TOKEN && token === BEARER_TOKEN) {
      return { username: 'benchadmin', role: 'admin' };
    }
    const payload = verifyJwt(token);
    if (payload) return { username: payload.sub, role: payload.role };
  }
  if (req.session && req.session.benchUser) return req.session.benchUser;
  return null;
}

function requireAuth(req, res, next) {
  const user = identify(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', detail: 'Login required' });
  }
  req.benchUser = user;
  return next();
}

/** requireAuth plus a role check (403 for a logged-in user without the role). */
function requireRole(role) {
  return (req, res, next) => requireAuth(req, res, () => {
    if (req.benchUser.role !== role) {
      return res.status(403).json({ error: 'Forbidden', detail: `${role} role required` });
    }
    return next();
  });
}

module.exports = { requireAuth, requireRole, identify, verifyJwt, AUTH_SECRET };
