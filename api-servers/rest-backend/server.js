'use strict';

/**
 * SPABench REST Backend — Express entry point
 *
 * Shared API server for all five benchmark apps.
 * Runs on port 4001. All five app route bundles are mounted here.
 *
 * TC-P4-007 (openapi_discovery):   GET /api-docs   → Swagger UI
 * TC-P4-008 (openapi_path_enumeration): GET /openapi.json → raw spec
 * TC-P4-009 (spring_actuator_mappings): GET /actuator/mappings → Spring-style JSON
 * TC-AUTH-001 (auth_form_login):    POST /api/auth/login (via app-a.js)
 * TC-AUTH-003 (auth_totp_mfa):      POST /api/auth/mfa/verify (via app-e.js)
 */

const express        = require('express');
const cors           = require('cors');
const session        = require('express-session');
const swaggerUi      = require('swagger-ui-express');
const path           = require('path');

const app  = express();
const PORT = process.env.PORT || 4001;

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow all localhost ports (3001-3005 for apps, 4001-4004 for api-servers)
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Session (for form-auth apps A and D) ─────────────────────────────────────
app.use(session({
  secret:            process.env.BENCH_AUTH_SECRET || 'spabench-dev-secret-do-not-use-in-production',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000, // 8 hours — fixed for benchmark determinism
  },
}));

// ── Health endpoint ───────────────────────────────────────────────────────────
// Required by Docker Compose `healthcheck` and depends_on: condition: service_healthy
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── OpenAPI spec ─────────────────────────────────────────────────────────────
// TC-P4-007: /api-docs → Swagger UI (tool probes and gets 200)
// TC-P4-008: /openapi.json → raw JSON (tool parses all paths)
const openapiSpec = require('./openapi-spec.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get('/openapi.json', (_req, res) => res.json(openapiSpec));

// ── Route bundles ─────────────────────────────────────────────────────────────
// app-a.js registers POST /api/auth/login first — shared across all apps.
// Order matters: /api/v2/products/list must be registered before /api/v2/products/:id
// (handled inside app-c.js already).
app.use(require('./routes/app-a'));
app.use(require('./routes/app-b'));
app.use(require('./routes/app-c'));
app.use(require('./routes/app-d'));
app.use(require('./routes/app-e'));

// ── 404 handler ───────────────────────────────────────────────────────────────
// Returns JSON — prevents HTML error pages from confusing tool parsers.
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`SPABench REST backend listening on port ${PORT}`);
});

module.exports = app;
