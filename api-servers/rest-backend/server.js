'use strict';

/**
 * SPABench REST backend — the shared API server for all five apps (port 4001).
 *
 *   GET  /health          liveness (docker healthcheck)
 *   GET  /api-docs        Swagger UI over openapi-spec.json
 *   GET  /openapi.json    the raw OpenAPI document
 *   routes/app-a.js … app-e.js   per-app API routes (+ shared login in app-a.js)
 *   routes/app-a-features.js     angular-permit admin/reports/mobile modules
 *
 * Apps reach this server same-origin through their nginx (/api/ → here), and
 * angular-permit calls it cross-origin on :4001 directly. Unknown paths get a
 * JSON 404 so tools never see an HTML error page.
 */

const express = require('express');
const cors    = require('cors');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');

const app  = express();
const PORT = process.env.PORT || 4001;

app.use(cors({ origin: (_origin, cb) => cb(null, true), credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session cookie for clients that authenticate with a cookie instead of a bearer header.
app.use(session({
  secret:            process.env.BENCH_AUTH_SECRET || 'dev-secret-do-not-use-in-production',
  resave:            false,
  saveUninitialized: false,
  cookie:            { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 },
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const openapiSpec = require('./openapi-spec.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get('/openapi.json', (_req, res) => res.json(openapiSpec));

app.use(require('./routes/app-a'));
app.use(require('./routes/app-a-features'));
app.use(require('./routes/app-b'));
app.use(require('./routes/app-c'));
app.use(require('./routes/app-d'));
app.use(require('./routes/app-e'));

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`REST backend listening on port ${PORT}`);
  });
}

module.exports = app;
