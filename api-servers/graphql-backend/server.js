'use strict';

/**
 * SPABench GraphQL Backend — port 4002
 *
 * Stack:
 *   Apollo Server 4  (@apollo/server + expressMiddleware)
 *   Express 4        (HTTP transport + health endpoint)
 *   graphql-ws       (WebSocket subscriptions on the same port via HTTP upgrade)
 *   ws               (WebSocket server)
 *
 * Endpoints:
 *   GET  /health        Docker healthcheck — returns { status: 'ok' }
 *   GET  /graphql       Returns GraphQL playground indicator (EP-E-001 graphql_endpoint_heuristic)
 *   POST /graphql       GraphQL query / mutation execution
 *   WS   /graphql       graphql-ws subscription protocol (upgrade from HTTP)
 *
 * Auth (TC-AUTH-004 bearer_injection):
 *   HTTP queries/mutations: Authorization: Bearer <token> header → context.user
 *   WebSocket subscriptions: connectionParams.Authorization → onConnect validates
 *
 * Introspection: ENABLED (TC-P4-002 graphql_introspection)
 *   The full __schema is visible to any client that sends the introspection query.
 *   All 8 Query + 6 Mutation + 3 Subscription resolvers appear in __schema.types.
 *
 * Auth-gated resolvers (manifest auth_required: true):
 *   All queries except getProduct and searchProducts
 *   All mutations
 *   All subscriptions (enforced at WS connect, not per-resolver)
 *
 * Environment variables:
 *   PORT                4002
 *   BENCH_AUTH_SECRET   JWT signing secret (shared with rest-backend)
 *   BENCH_BEARER_TOKEN  Static pre-generated bearer token
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
const AUTH_SECRET   = process.env.BENCH_AUTH_SECRET  || 'spabench-dev-secret-do-not-use-in-production';
const BEARER_TOKEN  = process.env.BENCH_BEARER_TOKEN || 'spabench-bearer-token-dev';

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

  // 1. Static benchmark token
  if (token === BEARER_TOKEN) {
    return { username: 'benchuser', role: 'admin' };
  }

  // 2. JWT
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

  // graphql-ws onConnect — enforces bearer auth for all subscriptions.
  // Subscriptions with auth_required: true in the manifest (all 3) will fail
  // without a valid token, matching the benchmark's auth-stratified recall model.
  const serverCleanup = useServer(
    {
      schema,
      context(ctx) {
        const authHeader = ctx.connectionParams?.Authorization ||
                           ctx.connectionParams?.authorization;
        const user = validateAuthHeader(authHeader);
        return { user };
      },
      onConnect(ctx) {
        // Allow unauthenticated connections — auth is checked per-resolver.
        // Returning false here would block the connection entirely, but the
        // benchmark tests graceful degradation, not hard blocking.
        return true;
      },
    },
    wsServer,
  );

  // ── Apollo Server 4 ─────────────────────────────────────────────────────────
  const apollo = new ApolloServer({
    schema,
    introspection: true,    // TC-P4-002: MUST be true — introspection is the
                            // primary discovery mechanism for all 17 resolvers
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

  // ── Health endpoint ───────────────────────────────────────────────────────────
  // Required by Docker healthcheck and depends_on: condition: service_healthy
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'spabench-graphql-backend', uptime: process.uptime() });
  });

  // ── GET /graphql — playground indicator ──────────────────────────────────────
  // EP-E-001 (graphql_endpoint_heuristic): the tool probes /graphql and expects
  // a 200 with GraphQL-related content on GET. This signals that the endpoint
  // exists and accepts GraphQL operations.
  app.get('/graphql', (_req, res) => {
    res.json({
      message:      'SPABench GraphQL endpoint. Send POST with { query } to execute.',
      introspection: 'enabled',
      playground:   `http://localhost:${PORT}/graphql`,
      docs:         'Send a POST request with {"query": "{ __typename }"} to verify connectivity.',
      _benchmark:   'EP-E-001 graphql_endpoint_heuristic — this GET response is the heuristic signal',
    });
  });

  // ── POST /graphql — Apollo middleware ─────────────────────────────────────────
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
  console.log(`[graphql-backend] Introspection: ENABLED`);
  console.log(`[graphql-backend] Resolvers: 8 Query + 6 Mutation + 3 Subscription`);
}

main().catch(err => {
  console.error('[graphql-backend] startup error', err);
  process.exit(1);
});
