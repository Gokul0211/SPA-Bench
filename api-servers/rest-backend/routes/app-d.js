'use strict';

/**
 * App D — Vue Government Portal (No Source Maps) routes
 *
 * Manifest coverage:
 *   EP-D-001  GET  /api/users/:id                       (auth: form)
 *
 * EP-D-002 / EP-D-003 / EP-D-004 — SOAP bridge endpoints:
 *   POST /api/legacy/bridge/getEmployeeRecord
 *   POST /api/legacy/bridge/updatePayroll
 *   POST /api/legacy/bridge/generateReport
 *
 *   These are served by the soap-bridge container (port 4004), NOT this server.
 *   The vue-portal app uses NUXT_SOAP_BRIDGE=http://soap-bridge:4004 and
 *   NUXT_API_BASE=http://rest-backend:4001 as separate env vars.
 *   The bridge endpoints are exclusively discoverable via dynamic interception
 *   because their URL is runtime-computed from a WSDL lookup — static analysis
 *   cannot reconstruct them. That constraint only holds if this server does NOT
 *   expose them as static routes.
 *
 * Auth: form (JWT or session cookie)
 */

const { Router }        = require('express');
const { requireFormAuth } = require('../middleware/auth');

const router = Router();

// ── Seed data ─────────────────────────────────────────────────────────────────
const USERS = Array.from({ length: 40 }, (_, i) => ({
  id:         String(i + 1),
  username:   `gov_user_${i + 1}`,
  fullName:   `Government Employee ${i + 1}`,
  department: ['HR', 'Finance', 'Operations', 'IT', 'Compliance'][i % 5],
  grade:      ['A1', 'A2', 'B1', 'B2', 'C1'][i % 5],
  email:      `employee${i + 1}@gov.example`,
  active:     i % 7 !== 0,  // every 7th user is inactive — realistic churn
}));

const USER_BY_ID = Object.fromEntries(USERS.map(u => [u.id, u]));

// ── GET /api/users/:id ────────────────────────────────────────────────────────
// EP-D-001: Vue 3 Composition API with useAsyncData + axios.get pattern.
// Source maps intentionally restricted (NUXT_SOURCEMAP=false).
// Reconstructable via AST analysis of the minified bundle.
router.get('/api/users/:id', requireFormAuth, (req, res) => {
  const { id } = req.params;
  const user = USER_BY_ID[id];

  if (!user) {
    return res.status(404).json({ error: 'Not Found', detail: `User ${id} not found` });
  }

  return res.json(user);
});

// ── GET /api/users ────────────────────────────────────────────────────────────
// Not in the 45-entry starter manifest but realistic companion — the Vue portal
// navigation bar calls this on load to render the user list.
router.get('/api/users', requireFormAuth, (_req, res) => {
  return res.json({
    data:  USERS.slice(0, 20),
    total: USERS.length,
    page:  1,
    limit: 20,
  });
});

module.exports = router;
