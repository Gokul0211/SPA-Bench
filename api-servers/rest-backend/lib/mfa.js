'use strict';

/**
 * Pending TOTP challenges shared by the login route (step 1) and
 * POST /api/auth/mfa/verify (step 2). In-memory; a challenge expires after
 * five minutes and can be used once.
 */

const crypto = require('crypto');

const TTL_MS = 5 * 60 * 1000;
const PENDING = new Map();   // sessionToken -> { username, role, expiresAt }

function startChallenge(username, role) {
  const sessionToken = crypto.randomBytes(24).toString('hex');
  PENDING.set(sessionToken, { username, role, expiresAt: Date.now() + TTL_MS });
  return sessionToken;
}

/** Remove and return the challenge, or null if unknown/expired. */
function takeChallenge(sessionToken) {
  const c = PENDING.get(sessionToken);
  if (!c) return null;
  PENDING.delete(sessionToken);
  return Date.now() > c.expiresAt ? null : c;
}

module.exports = { startChallenge, takeChallenge };
