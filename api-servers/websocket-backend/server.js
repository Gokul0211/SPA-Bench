'use strict';

/**
 * SPABench WebSocket Backend — port 4003
 *
 * Serves Apps B (Angular ERP) and E (Next.js SaaS Dashboard).
 *
 * ── Four WebSocket endpoints ──────────────────────────────────────────────────
 *
 *   ws://localhost:4003/ws/notifications
 *     EP-E-018 (websocket_connection_url, phase 3)
 *     Discovered by wrapping the native WebSocket constructor in Phase 3
 *     dynamic browsing — the connection URL is captured at instantiation.
 *     Also discoverable as a string literal in NotificationService (websocket_static).
 *     Auth: bearer required.
 *     Pushes: user notification events (new_order, alert, system_message).
 *
 *   ws://localhost:4003/ws/live-dashboard
 *     EP-E-019 (websocket_static, phase 2)
 *     Hardcoded as WS_URL constant in DashboardService.ts — discoverable via
 *     static AST analysis without running the browser.
 *     Auth: bearer required.
 *     Pushes: real-time metric snapshots every 5 seconds.
 *
 *   ws://localhost:4003/ws/orders
 *     App B (Angular ERP) real-time order feed.
 *     Not in the 45-entry starter manifest but required for App B to function.
 *     Auth: bearer required.
 *     Pushes: order lifecycle events (created, updated, status_changed).
 *
 *   ws://localhost:4003/ws/metrics
 *     App B (Angular ERP) system metrics feed.
 *     Not in the starter manifest.
 *     Auth: bearer required.
 *     Pushes: CPU/memory/request-rate telemetry every 8 seconds.
 *
 * ── Message protocol ─────────────────────────────────────────────────────────
 *
 *   All messages are JSON-encoded strings.
 *
 *   Client → Server:
 *     { "type": "SUBSCRIBE",   "channel": "<channel_name>", "token": "<optional_bearer>" }
 *     { "type": "UNSUBSCRIBE", "channel": "<channel_name>" }
 *     { "type": "PING" }
 *
 *   Server → Client (pushed events):
 *     { "type": "CONNECTED",   "endpoint": "/ws/<name>", "channels": [...], "requiresAuth": true }
 *     { "type": "SUBSCRIBED",  "channel": "<channel_name>", "message": "Subscription active" }
 *     { "type": "UNSUBSCRIBED","channel": "<channel_name>" }
 *     { "type": "PUBLISH",     "channel": "<channel_name>", "payload": { ... }, "timestamp": "..." }
 *     { "type": "PONG",        "timestamp": "..." }
 *     { "type": "ERROR",       "code": "<CODE>", "message": "..." }
 *     { "type": "AUTH_REQUIRED","message": "Bearer token required" }
 *
 *   The CONNECTED message (TC-P3-012 websocket_payload_sample) is sent immediately
 *   after the WebSocket handshake completes — before any SUBSCRIBE from the client.
 *   This is the "first message after WS connection" that the benchmark measures.
 *
 * ── Auth ──────────────────────────────────────────────────────────────────────
 *
 *   Bearer token passed in one of:
 *     1. Query string:       ws://host:4003/ws/notifications?token=<bearer>
 *     2. SUBSCRIBE message:  { "type": "SUBSCRIBE", "token": "<bearer>" }
 *
 *   The WS protocol does not support custom headers from browser clients, so
 *   the query-string method is the standard approach for SPA WebSocket auth.
 *   TC-AUTH-004 (auth_bearer_injection) injects BENCH_BEARER_TOKEN as a query param.
 *
 * ── HTTP health endpoint ──────────────────────────────────────────────────────
 *
 *   GET http://localhost:4003/health → { status: 'ok', ... }
 *
 *   The docker-compose uses `condition: service_started` (not service_healthy) for
 *   websocket-backend, so healthcheck is advisory. sanity_check.py still probes it.
 *   Implemented by handling the HTTP 'request' event on the underlying http.Server
 *   before upgrading WS connections — the same port handles both protocols.
 *
 * ── Environment variables ─────────────────────────────────────────────────────
 *
 *   PORT                4003
 *   BENCH_AUTH_SECRET   JWT signing secret (shared with rest-backend + graphql-backend)
 *   BENCH_BEARER_TOKEN  Static pre-generated bearer token
 */

const http  = require('http');
const { WebSocketServer, OPEN } = require('ws');
const jwt   = require('jsonwebtoken');
const { URL } = require('url');

const PORT          = parseInt(process.env.PORT || '4003', 10);
const AUTH_SECRET   = process.env.BENCH_AUTH_SECRET  || 'spabench-dev-secret-do-not-use-in-production';
const BEARER_TOKEN  = process.env.BENCH_BEARER_TOKEN || 'spabench-bearer-token-dev';

// ── Auth helper ───────────────────────────────────────────────────────────────
/**
 * Validate a raw token string (no "Bearer " prefix).
 * Returns { username, role } or null.
 */
function validateToken(token) {
  if (!token) return null;
  if (token === BEARER_TOKEN) return { username: 'benchuser', role: 'admin' };
  try {
    const payload = jwt.verify(token, AUTH_SECRET);
    return { username: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

/**
 * Extract bearer token from a WebSocket request URL query string.
 * ws://host:4003/ws/notifications?token=<bearer>
 */
function tokenFromRequest(req) {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    return u.searchParams.get('token') || null;
  } catch {
    return null;
  }
}

// ── Message helpers ───────────────────────────────────────────────────────────
function send(ws, obj) {
  if (ws.readyState === OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function sendError(ws, code, message) {
  send(ws, { type: 'ERROR', code, message });
}

// ── Channel definitions ───────────────────────────────────────────────────────
// Each WS path exposes a fixed set of subscribable channels.
// This is the information a tool recovers from TC-P3-012 (websocket_payload_sample)
// — the CONNECTED message lists all available channels.

const ENDPOINT_CHANNELS = {
  '/ws/notifications':  ['notifications.user', 'notifications.system', 'notifications.alerts'],
  '/ws/live-dashboard': ['dashboard.metrics', 'dashboard.activity'],
  '/ws/orders':         ['orders.created', 'orders.updated', 'orders.status_changed'],
  '/ws/metrics':        ['metrics.cpu', 'metrics.memory', 'metrics.requests'],
};

// ── Per-connection state ──────────────────────────────────────────────────────
// ws → { path, user, subscriptions: Set<channel>, intervalIds: [] }
const connState = new WeakMap();

// ── Publisher registry ────────────────────────────────────────────────────────
// path → Set<ws> — all open connections on a given endpoint path
const pathClients = {
  '/ws/notifications':  new Set(),
  '/ws/live-dashboard': new Set(),
  '/ws/orders':         new Set(),
  '/ws/metrics':        new Set(),
};

/**
 * Broadcast a PUBLISH event to all subscribers of a given channel on a path.
 */
function broadcast(path, channel, payload) {
  const clients = pathClients[path];
  if (!clients) return;
  const message = JSON.stringify({
    type:      'PUBLISH',
    channel,
    payload,
    timestamp: new Date().toISOString(),
  });
  clients.forEach(ws => {
    const state = connState.get(ws);
    if (state && state.subscriptions.has(channel) && ws.readyState === OPEN) {
      ws.send(message);
    }
  });
}

// ── Data simulators ───────────────────────────────────────────────────────────
// Push synthetic events on fixed intervals so connected tools see live data.
// These run globally — they broadcast to all subscribers on each path.

// /ws/notifications — user notifications every 8s
const NOTIFICATION_TYPES = ['new_order', 'alert', 'system_message', 'mention', 'task_assigned'];
let _notifIdx = 0;
setInterval(() => {
  _notifIdx = (_notifIdx + 1) % NOTIFICATION_TYPES.length;
  broadcast('/ws/notifications', 'notifications.user', {
    notificationId: `notif-${Date.now()}`,
    type:           NOTIFICATION_TYPES[_notifIdx],
    title:          `Notification: ${NOTIFICATION_TYPES[_notifIdx]}`,
    body:           `Auto-generated benchmark notification #${_notifIdx + 1}`,
    read:           false,
    userId:         'user-001',
  });
}, 8000);

// /ws/notifications — system alert every 20s
setInterval(() => {
  broadcast('/ws/notifications', 'notifications.alerts', {
    alertId:   `alert-${Date.now()}`,
    severity:  ['INFO', 'WARNING', 'ERROR'][Math.floor(Math.random() * 3)],
    message:   'Benchmark system health check alert',
    source:    'spabench-monitor',
    timestamp: new Date().toISOString(),
  });
}, 20000);

// /ws/live-dashboard — metric snapshot every 5s
setInterval(() => {
  broadcast('/ws/live-dashboard', 'dashboard.metrics', {
    activeUsers:     Math.floor(120 + Math.random() * 40),
    requestsPerSec:  parseFloat((85 + Math.random() * 30).toFixed(1)),
    errorRate:       parseFloat((0.01 + Math.random() * 0.02).toFixed(4)),
    avgResponseMs:   Math.floor(42 + Math.random() * 20),
    revenue24h:      parseFloat((4820 + Math.random() * 500).toFixed(2)),
    snapshot:        new Date().toISOString(),
  });
}, 5000);

// /ws/live-dashboard — activity event every 12s
const ACTIVITY_TYPES = ['page_view', 'api_call', 'user_signup', 'checkout_started', 'checkout_completed'];
let _activityIdx = 0;
setInterval(() => {
  _activityIdx = (_activityIdx + 1) % ACTIVITY_TYPES.length;
  broadcast('/ws/live-dashboard', 'dashboard.activity', {
    eventType: ACTIVITY_TYPES[_activityIdx],
    userId:    `user-${Math.floor(Math.random() * 100) + 1}`,
    path:      ['/dashboard', '/orders', '/products', '/settings'][_activityIdx % 4],
    timestamp: new Date().toISOString(),
  });
}, 12000);

// /ws/orders — order event every 10s
const ORDER_EVENTS = [
  { event: 'created',        orderId: 'ORD-BENCH-NEW', status: 'PENDING' },
  { event: 'status_changed', orderId: 'ORD-BENCH-001', status: 'PROCESSING' },
  { event: 'status_changed', orderId: 'ORD-BENCH-001', status: 'SHIPPED' },
  { event: 'updated',        orderId: 'ORD-BENCH-002', status: 'DELIVERED' },
];
let _orderIdx = 0;
setInterval(() => {
  const ev = ORDER_EVENTS[_orderIdx % ORDER_EVENTS.length];
  _orderIdx++;
  const channel = ev.event === 'created' ? 'orders.created'
    : ev.event === 'updated'             ? 'orders.updated'
    : 'orders.status_changed';
  broadcast('/ws/orders', channel, {
    ...ev,
    total:     parseFloat((99 + Math.random() * 400).toFixed(2)),
    updatedAt: new Date().toISOString(),
  });
}, 10000);

// /ws/metrics — system telemetry every 8s
setInterval(() => {
  broadcast('/ws/metrics', 'metrics.cpu', {
    usage:       parseFloat((20 + Math.random() * 60).toFixed(1)),
    loadAvg1m:   parseFloat((0.5 + Math.random() * 1.5).toFixed(2)),
    loadAvg5m:   parseFloat((0.4 + Math.random() * 1.0).toFixed(2)),
    timestamp:   new Date().toISOString(),
  });
  broadcast('/ws/metrics', 'metrics.memory', {
    usedMb:      Math.floor(512 + Math.random() * 256),
    totalMb:     2048,
    heapUsedMb:  Math.floor(128 + Math.random() * 64),
    timestamp:   new Date().toISOString(),
  });
  broadcast('/ws/metrics', 'metrics.requests', {
    rps:         parseFloat((80 + Math.random() * 40).toFixed(1)),
    p50Ms:       Math.floor(35 + Math.random() * 15),
    p95Ms:       Math.floor(120 + Math.random() * 60),
    p99Ms:       Math.floor(250 + Math.random() * 100),
    timestamp:   new Date().toISOString(),
  });
}, 8000);

// ── WebSocket connection handler ──────────────────────────────────────────────

function handleConnection(ws, req) {
  // Parse the endpoint path — strip query string
  let pathname;
  try {
    pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  } catch {
    ws.close(1008, 'Bad request URL');
    return;
  }

  // Reject unknown paths immediately
  if (!ENDPOINT_CHANNELS[pathname]) {
    ws.close(1008, `Unknown WebSocket endpoint: ${pathname}`);
    return;
  }

  // Extract token from query string (primary browser auth method)
  const rawToken = tokenFromRequest(req);
  const user     = validateToken(rawToken);

  // Initialise per-connection state
  connState.set(ws, {
    path:          pathname,
    user,
    subscriptions: new Set(),
    authenticated: !!user,
  });

  // Register in path-level client set
  pathClients[pathname].add(ws);

  // ── TC-P3-012: websocket_payload_sample ───────────────────────────────────
  // Send CONNECTED as the first message immediately after handshake.
  // This is "the first message after WS connection" that the benchmark captures.
  // It reveals: endpoint path, available channels, and whether auth is required.
  // A tool that receives this message can enumerate all channels without subscribing.
  send(ws, {
    type:         'CONNECTED',
    endpoint:     pathname,
    channels:     ENDPOINT_CHANNELS[pathname],
    requiresAuth: true,
    authenticated: !!user,
    protocol:     'spabench-ws/1.0',
    message:      user
      ? `Connected to ${pathname} as ${user.username}`
      : `Connected to ${pathname} — send SUBSCRIBE with token to receive events`,
    timestamp:    new Date().toISOString(),
  });

  // ── Message handler ───────────────────────────────────────────────────────
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendError(ws, 'INVALID_JSON', 'Message must be a JSON object');
      return;
    }

    const state = connState.get(ws);
    if (!state) return;

    switch (msg.type) {

      // ── SUBSCRIBE ──────────────────────────────────────────────────────────
      // Client requests to receive PUBLISH events on a channel.
      // Auth can be provided here as msg.token (alternative to query-string).
      case 'SUBSCRIBE': {
        // Accept token from SUBSCRIBE message if not already authenticated
        if (!state.authenticated && msg.token) {
          const u = validateToken(msg.token);
          if (u) {
            state.user          = u;
            state.authenticated = true;
          }
        }

        if (!state.authenticated) {
          send(ws, { type: 'AUTH_REQUIRED', message: 'Bearer token required — pass as ?token= or in SUBSCRIBE.token' });
          return;
        }

        const { channel } = msg;
        const validChannels = ENDPOINT_CHANNELS[state.path];
        if (!channel || !validChannels.includes(channel)) {
          sendError(ws, 'INVALID_CHANNEL', `Valid channels for ${state.path}: ${validChannels.join(', ')}`);
          return;
        }

        state.subscriptions.add(channel);
        send(ws, {
          type:    'SUBSCRIBED',
          channel,
          message: `Subscription active on ${channel}`,
        });
        break;
      }

      // ── UNSUBSCRIBE ────────────────────────────────────────────────────────
      case 'UNSUBSCRIBE': {
        const { channel } = msg;
        if (state.subscriptions.has(channel)) {
          state.subscriptions.delete(channel);
          send(ws, { type: 'UNSUBSCRIBED', channel });
        } else {
          sendError(ws, 'NOT_SUBSCRIBED', `Not subscribed to ${channel}`);
        }
        break;
      }

      // ── PING ───────────────────────────────────────────────────────────────
      // Keep-alive ping. Tools can use this to confirm the connection is live
      // and to measure round-trip latency.
      case 'PING': {
        send(ws, { type: 'PONG', timestamp: new Date().toISOString() });
        break;
      }

      default: {
        sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown type: ${msg.type}. Valid types: SUBSCRIBE, UNSUBSCRIBE, PING`);
      }
    }
  });

  // ── Cleanup on close ──────────────────────────────────────────────────────
  ws.on('close', () => {
    const state = connState.get(ws);
    if (state) {
      pathClients[state.path].delete(ws);
      connState.delete(ws);
    }
  });

  ws.on('error', (err) => {
    console.error(`[websocket-backend] connection error on ${pathname}:`, err.message);
  });
}

// ── HTTP server — health endpoint + WS upgrade ────────────────────────────────
// A single http.Server handles both protocols on port 4003:
//   GET /health → JSON health response
//   WebSocket upgrade → routed to handleConnection

const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const totalConnections = Object.values(pathClients).reduce((sum, s) => sum + s.size, 0);
    const connectionsByEndpoint = Object.fromEntries(
      Object.entries(pathClients).map(([path, set]) => [path, set.size])
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:               'ok',
      service:              'spabench-websocket-backend',
      endpoints:            Object.keys(ENDPOINT_CHANNELS),
      totalConnections,
      connectionsByEndpoint,
      uptime:               process.uptime(),
    }));
    return;
  }

  // Non-health HTTP requests get a minimal JSON 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error:    'Not Found',
    hint:     'This is a WebSocket server. Connect via ws:// protocol.',
    endpoints: Object.keys(ENDPOINT_CHANNELS).map(p => `ws://localhost:${PORT}${p}`),
  }));
});

// ── WebSocket server — handles upgrade from the http.Server ──────────────────
// noServer: true means ws does NOT create its own HTTP server.
// The http.Server's 'upgrade' event routes WS handshakes here.
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', handleConnection);

httpServer.on('upgrade', (req, socket, head) => {
  let pathname;
  try {
    pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (!ENDPOINT_CHANNELS[pathname]) {
    // Unknown path — reject the upgrade
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[websocket-backend] listening on port ${PORT}`);
  console.log('[websocket-backend] Endpoints:');
  Object.keys(ENDPOINT_CHANNELS).forEach(path => {
    console.log(`  ws://localhost:${PORT}${path}  (${ENDPOINT_CHANNELS[path].join(', ')})`);
  });
  console.log(`[websocket-backend] Health: http://localhost:${PORT}/health`);
});

httpServer.on('error', (err) => {
  console.error('[websocket-backend] server error:', err);
  process.exit(1);
});
