'use strict';

/**
 * SPABench GraphQL backend (port 4002; nextjs-saas reaches it same-origin at /graphql).
 *
 *   GET  /health     liveness
 *   GET  /graphql    small JSON description (without ?query=); with ?query= Apollo runs it
 *   POST /graphql    queries and mutations
 *   WS   /graphql    graphql-ws subscriptions
 *
 * Introspection is enabled. Auth: Authorization: Bearer <JWT from the REST
 * backend's login> (HTTP header, or connectionParams.Authorization on WS).
 * BENCH_BEARER_TOKEN is accepted only when BENCH_ALLOW_STATIC_TOKEN=1.
 * Resolvers enforce auth (all except getProduct and searchProducts).
 */

const http              = require('http');
const express           = require('express');
const cors              = require('cors');
const bodyParser        = require('body-parser');
const { readFileSync }  = require('fs');
const path              = require('path');
const jwt               = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const { useServer }     = require('graphql-ws/lib/use/ws');

const { ApolloServer }                       = require('@apollo/server');
const { expressMiddleware }                  = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer }  = require('@apollo/server/plugin/drainHttpServer');
const { makeExecutableSchema }               = require('@graphql-tools/schema');

const { resolvers }  = require('./resolvers');

const PORT          = parseInt(process.env.PORT || '4002', 10);
const AUTH_SECRET   = process.env.BENCH_AUTH_SECRET  || 'dev-secret-do-not-use-in-production';
const BEARER_TOKEN  = process.env.BENCH_BEARER_TOKEN || 'spabench-bearer-token-dev';
const ALLOW_STATIC_TOKEN = process.env.BENCH_ALLOW_STATIC_TOKEN === '1';

// ── Schema ────────────────────────────────────────────────────────────────────
const typeDefs = readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');

const schema = makeExecutableSchema({ typeDefs, resolvers });

// ── Auth helper ───────────────────────────────────────────────────────────────
/**
 * Validate an Authorization header value.
 * Returns { username, role } on success or null on failure.
 */
function validateAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  if (ALLOW_STATIC_TOKEN && token === BEARER_TOKEN) {
    return { username: 'benchadmin', role: 'admin' };
  }

  try {
    const payload = jwt.verify(token, AUTH_SECRET);
    return { username: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function main() {
  const app        = express();
  const httpServer = http.createServer(app);

  // ── WebSocket server for subscriptions ─────────────────────────────────────
  // graphql-ws uses the same port as HTTP via the 'upgrade' event.
  // The WS server only handles the /graphql path.
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });

  // Connections are accepted without a token; resolvers enforce auth.
  const serverCleanup = useServer(
    {
      schema,
      context(ctx) {
        const authHeader = ctx.connectionParams?.Authorization ||
                           ctx.connectionParams?.authorization;
        const user = validateAuthHeader(authHeader);
        return { user };
      },
      onConnect() {
        return true;
      },
    },
    wsServer,
  );

  // ── Apollo Server 4 ─────────────────────────────────────────────────────────
  const apollo = new ApolloServer({
    schema,
    introspection: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Clean up graphql-ws server on Apollo shutdown
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apollo.start();

  // ── Express middleware ───────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // GET /graphql without a query: a short JSON description (what a browser or a
  // probe sees). GET with ?query= falls through to Apollo.
  app.get('/graphql', (req, res, next) => {
    if (req.query.query) return next();
    return res.json({
      message: 'GraphQL endpoint. Send POST with {"query": "..."} to execute.',
      introspection: 'enabled',
    });
  });

  // ── /graphql — Apollo ─────────────────────────────────────────────────────────
  app.use(
    '/graphql',
    bodyParser.json(),
    expressMiddleware(apollo, {
      // Build context from HTTP request — injects user for auth-gated resolvers
      context: async ({ req }) => {
        const user = validateAuthHeader(req.headers['authorization']);
        return { user };
      },
    }),
  );

  // ── Start server ──────────────────────────────────────────────────────────────
  await new Promise(resolve => httpServer.listen({ port: PORT, host: '0.0.0.0' }, resolve));

  console.log(`[graphql-backend] HTTP  → http://localhost:${PORT}/graphql`);
  console.log(`[graphql-backend] WS    → ws://localhost:${PORT}/graphql`);
  console.log(`[graphql-backend] Health → http://localhost:${PORT}/health`);
}

main().catch(err => {
  console.error('[graphql-backend] startup error', err);
  process.exit(1);
});
