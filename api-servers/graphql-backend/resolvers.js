'use strict';

/**
 * SPABench GraphQL resolvers
 *
 * Auth enforcement per manifest:
 *   getProduct, searchProducts          — public (auth_required: false)
 *   all other queries + all mutations   — bearer required (auth_required: true)
 *   all subscriptions                   — bearer required
 *
 * Auth is injected via Apollo context (see server.js buildContext).
 * Resolvers that require auth call requireAuth(context) which throws
 * AuthenticationError if the token is missing or invalid.
 *
 * Subscription auth is enforced at the graphql-ws onConnect hook in server.js,
 * so subscription resolvers don't repeat the check.
 */

const { GraphQLError } = require('graphql');
const { PubSub }       = require('graphql-subscriptions');

const pubsub = new PubSub();

// ── PubSub event channel names ────────────────────────────────────────────────
const ORDER_STATUS_CHANGED       = 'ORDER_STATUS_CHANGED';
const DASHBOARD_METRICS_UPDATED  = 'DASHBOARD_METRICS_UPDATED';
const TEAM_ACTIVITY_FEED         = 'TEAM_ACTIVITY_FEED';

// ── Subscription simulators ───────────────────────────────────────────────────
// Publish synthetic events so a connected subscriber sees live data.
// Each simulator fires on a fixed interval — kept short (10s) for benchmark
// testing so automated tools don't have to wait long.

// orderStatusChanged — cycles through order statuses every 10s
const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
let _orderStatusIdx = 0;
setInterval(() => {
  _orderStatusIdx = (_orderStatusIdx + 1) % ORDER_STATUSES.length;
  pubsub.publish(ORDER_STATUS_CHANGED, {
    orderStatusChanged: {
      id:         'ORD-BENCH-001',
      userId:     'user-001',
      status:     ORDER_STATUSES[_orderStatusIdx],
      lineItems:  [{ sku: 'PROD-00001', quantity: 2, unitPrice: 49.99, total: 99.98 }],
      total:      99.98,
      createdAt:  new Date(Date.now() - 3600000).toISOString(),
      updatedAt:  new Date().toISOString(),
    },
  });
}, 10000);

// dashboardMetricsUpdated — refreshes every 30s
setInterval(() => {
  pubsub.publish(DASHBOARD_METRICS_UPDATED, {
    dashboardMetricsUpdated: {
      period:          'last_7d',
      granularity:     'DAILY',
      totalRevenue:    parseFloat((12450 + Math.random() * 1000).toFixed(2)),
      activeUsers:     Math.floor(140 + Math.random() * 20),
      newSignups:      Math.floor(15 + Math.random() * 10),
      churnRate:       0.034,
      mrr:             4980.00,
      conversionRate:  0.068,
      timeSeries:      Array.from({ length: 7 }, (_, i) => ({
        bucket:  `day_${i + 1}`,
        revenue: parseFloat((1778 + Math.random() * 400).toFixed(2)),
        users:   Math.floor(140 + Math.random() * 20),
      })),
      generatedAt:     new Date().toISOString(),
    },
  });
}, 30000);

// teamActivityFeed — publishes a synthetic event every 15s
const ACTIVITY_ACTIONS = ['created_document', 'updated_settings', 'invited_member', 'removed_member', 'changed_role'];
let _activityIdx = 0;
setInterval(() => {
  _activityIdx = (_activityIdx + 1) % ACTIVITY_ACTIONS.length;
  pubsub.publish(TEAM_ACTIVITY_FEED, {
    teamActivityFeed: {
      workspaceId:  'ws-bench-001',
      userId:       `user-${String((_activityIdx % 5) + 1).padStart(3, '0')}`,
      action:       ACTIVITY_ACTIONS[_activityIdx],
      resourceType: ['document', 'settings', 'member', 'member', 'member'][_activityIdx],
      resourceId:   `res-${_activityIdx + 1}`,
      timestamp:    new Date().toISOString(),
    },
  });
}, 15000);

// ── Auth helper ───────────────────────────────────────────────────────────────
function requireAuth(context) {
  if (!context.user) {
    throw new GraphQLError('Unauthorized — bearer token required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
}

// ── Seed data ─────────────────────────────────────────────────────────────────
const USERS = {
  'user-001': { id: 'user-001', email: 'alice@saas.example', username: 'alice', fullName: 'Alice Admin',   role: 'ADMIN',  workspaceId: 'ws-bench-001', createdAt: '2025-01-01T00:00:00Z', lastLoginAt: '2026-03-10T09:00:00Z' },
  'user-002': { id: 'user-002', email: 'bob@saas.example',   username: 'bob',   fullName: 'Bob Member',   role: 'MEMBER', workspaceId: 'ws-bench-001', createdAt: '2025-02-01T00:00:00Z', lastLoginAt: '2026-03-11T14:00:00Z' },
  'user-003': { id: 'user-003', email: 'carol@saas.example', username: 'carol', fullName: 'Carol Viewer', role: 'VIEWER', workspaceId: 'ws-bench-001', createdAt: '2025-03-01T00:00:00Z', lastLoginAt: null },
};

const ORDERS = {
  'ORD-001': { id: 'ORD-001', userId: 'user-001', status: 'DELIVERED', lineItems: [{ sku: 'PROD-00001', quantity: 1, unitPrice: 99.99, total: 99.99 }], total: 99.99, createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-12T16:00:00Z' },
  'ORD-002': { id: 'ORD-002', userId: 'user-001', status: 'PENDING',   lineItems: [{ sku: 'PROD-00002', quantity: 2, unitPrice: 49.50, total: 99.00 }], total: 99.00, createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z' },
  'ORD-003': { id: 'ORD-003', userId: 'user-002', status: 'SHIPPED',   lineItems: [{ sku: 'PROD-00003', quantity: 1, unitPrice: 299.00, total: 299.00 }], total: 299.00, createdAt: '2026-02-20T12:00:00Z', updatedAt: '2026-02-22T09:00:00Z' },
};

const PRODUCTS = Array.from({ length: 30 }, (_, i) => ({
  id:          `prod-${String(i + 1).padStart(3, '0')}`,
  sku:         `PROD-${String(i + 1).padStart(5, '0')}`,
  name:        `SaaS Product #${i + 1}`,
  category:    ['software', 'analytics', 'security', 'devtools', 'productivity'][i % 5],
  price:       parseFloat(((i + 1) * 29.99).toFixed(2)),
  stock:       (i * 13) % 100,
  rating:      parseFloat((3.5 + (i % 3) * 0.5).toFixed(1)),
  reviewCount: i * 4,
  description: `Enterprise-grade product #${i + 1} for modern SaaS workflows.`,
}));
const PRODUCT_BY_ID  = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
const PRODUCT_BY_SKU = Object.fromEntries(PRODUCTS.map(p => [p.sku, p]));

const TEAM_MEMBERS = [
  { id: 'tm-001', workspaceId: 'ws-bench-001', userId: 'user-001', email: 'alice@saas.example', fullName: 'Alice Admin',   role: 'ADMIN',  joinedAt: '2025-01-01T00:00:00Z' },
  { id: 'tm-002', workspaceId: 'ws-bench-001', userId: 'user-002', email: 'bob@saas.example',   fullName: 'Bob Member',   role: 'MEMBER', joinedAt: '2025-02-01T00:00:00Z' },
  { id: 'tm-003', workspaceId: 'ws-bench-001', userId: 'user-003', email: 'carol@saas.example', fullName: 'Carol Viewer', role: 'VIEWER', joinedAt: '2025-03-01T00:00:00Z' },
];

const BILLING = {
  'ws-bench-001': { workspaceId: 'ws-bench-001', plan: 'PRO', status: 'ACTIVE', currentPeriodStart: '2026-03-01T00:00:00Z', currentPeriodEnd: '2026-04-01T00:00:00Z', monthlyAmount: 99.00, seats: 10, usedSeats: 3 },
};

const AUDIT_LOG = [
  { id: 'audit-001', resourceId: 'user-001', action: 'USER_LOGIN',          performedBy: 'alice', details: 'Login from 192.168.1.1', timestamp: '2026-03-10T09:00:00Z' },
  { id: 'audit-002', resourceId: 'user-001', action: 'SETTINGS_UPDATE',     performedBy: 'alice', details: 'Changed notification preferences', timestamp: '2026-03-10T09:15:00Z' },
  { id: 'audit-003', resourceId: 'ORD-001',  action: 'ORDER_STATUS_CHANGE', performedBy: 'system', details: 'Status changed to DELIVERED', timestamp: '2026-01-12T16:00:00Z' },
];

// ── Resolvers ─────────────────────────────────────────────────────────────────

const resolvers = {

  // ── Queries ─────────────────────────────────────────────────────────────────

  Query: {

    // EP-E-GQL-001: getUser(id: ID!): User — bearer required
    getUser(_parent, { id }, context) {
      requireAuth(context);
      const user = USERS[id];
      if (!user) throw new GraphQLError(`User ${id} not found`, { extensions: { code: 'NOT_FOUND', http: { status: 404 } } });
      return user;
    },

    // EP-E-GQL-002: listOrders(userId, status, limit) — bearer required
    listOrders(_parent, { userId, status, limit }, context) {
      requireAuth(context);
      let orders = Object.values(ORDERS).filter(o => o.userId === userId);
      if (status) orders = orders.filter(o => o.status === status);
      if (limit)  orders = orders.slice(0, limit);
      return orders;
    },

    // EP-E-GQL-003: getProduct(id, includeReviews) — PUBLIC (no auth)
    getProduct(_parent, { id, includeReviews }) {
      const product = PRODUCT_BY_ID[id] || PRODUCT_BY_ID['prod-001'];
      if (!product) throw new GraphQLError(`Product ${id} not found`, { extensions: { code: 'NOT_FOUND', http: { status: 404 } } });
      if (includeReviews) {
        return {
          ...product,
          reviews: [
            { reviewId: 'rev-001', rating: 5, comment: 'Excellent.', author: 'user_a', date: '2026-01-10' },
            { reviewId: 'rev-002', rating: 4, comment: 'Good value.', author: 'user_b', date: '2026-01-08' },
          ],
        };
      }
      return { ...product, reviews: null };
    },

    // EP-E-GQL-004: searchProducts(query, filters) — PUBLIC (no auth)
    searchProducts(_parent, { query: q, filters }) {
      let results = PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.description.toLowerCase().includes(q.toLowerCase())
      );
      if (filters) {
        if (filters.category)  results = results.filter(p => p.category === filters.category);
        if (filters.minPrice != null) results = results.filter(p => p.price >= filters.minPrice);
        if (filters.maxPrice != null) results = results.filter(p => p.price <= filters.maxPrice);
        if (filters.inStock != null)  results = results.filter(p => filters.inStock ? p.stock > 0 : p.stock === 0);
      }
      return results;
    },

    // EP-E-GQL-005: getDashboardMetrics(period, granularity) — bearer required
    getDashboardMetrics(_parent, { period, granularity }, context) {
      requireAuth(context);
      const mult = { last_7d: 1, last_30d: 4, last_90d: 12, last_365d: 52 }[period] || 1;
      const buckets = mult;
      return {
        period,
        granularity:     granularity || 'DAILY',
        totalRevenue:    parseFloat((12450 * mult).toFixed(2)),
        activeUsers:     142 * mult,
        newSignups:      18  * mult,
        churnRate:       0.034,
        mrr:             4980.00,
        conversionRate:  0.068,
        timeSeries:      Array.from({ length: buckets }, (_, i) => ({
          bucket:  `bucket_${i + 1}`,
          revenue: parseFloat((1778.57 + Math.random() * 200).toFixed(2)),
          users:   Math.floor(142 + Math.random() * 20),
        })),
        generatedAt:     new Date().toISOString(),
      };
    },

    // EP-E-GQL-006: getAuditLog(resourceId, from, to) — bearer required
    getAuditLog(_parent, { resourceId, from, to }, context) {
      requireAuth(context);
      let entries = AUDIT_LOG.filter(e => e.resourceId === resourceId);
      if (from) entries = entries.filter(e => e.timestamp >= from);
      if (to)   entries = entries.filter(e => e.timestamp <= to);
      return entries;
    },

    // EP-E-GQL-007: listTeamMembers(workspaceId, role) — bearer required
    listTeamMembers(_parent, { workspaceId, role }, context) {
      requireAuth(context);
      let members = TEAM_MEMBERS.filter(m => m.workspaceId === workspaceId);
      if (role) members = members.filter(m => m.role === role);
      return members;
    },

    // EP-E-GQL-008: getBillingInfo(workspaceId) — bearer required
    getBillingInfo(_parent, { workspaceId }, context) {
      requireAuth(context);
      const billing = BILLING[workspaceId];
      if (!billing) throw new GraphQLError(`No billing info for workspace ${workspaceId}`, { extensions: { code: 'NOT_FOUND', http: { status: 404 } } });
      return billing;
    },
  },

  // ── Mutations ────────────────────────────────────────────────────────────────

  Mutation: {

    // EP-E-GQL-009: createUser(input) — bearer required, exclusive (introspection only)
    createUser(_parent, { input }, context) {
      requireAuth(context);
      const id = `user-${Date.now()}`;
      const user = { id, ...input, createdAt: new Date().toISOString(), lastLoginAt: null };
      USERS[id] = user;
      return user;
    },

    // EP-E-GQL-010: updateOrder(id, input) — bearer required, exclusive
    updateOrder(_parent, { id, input }, context) {
      requireAuth(context);
      const order = ORDERS[id];
      if (!order) throw new GraphQLError(`Order ${id} not found`, { extensions: { code: 'NOT_FOUND', http: { status: 404 } } });
      const updated = {
        ...order,
        ...(input.status    && { status: input.status }),
        ...(input.lineItems && { lineItems: input.lineItems.map(li => ({ ...li, total: li.quantity * li.unitPrice })) }),
        updatedAt: new Date().toISOString(),
      };
      ORDERS[id] = updated;
      // Publish order status change if status was updated
      if (input.status) {
        pubsub.publish(ORDER_STATUS_CHANGED, { orderStatusChanged: updated });
      }
      return updated;
    },

    // EP-E-GQL-011: deleteProduct(id) — bearer required, exclusive
    deleteProduct(_parent, { id }, context) {
      requireAuth(context);
      if (!PRODUCT_BY_ID[id]) throw new GraphQLError(`Product ${id} not found`, { extensions: { code: 'NOT_FOUND', http: { status: 404 } } });
      delete PRODUCT_BY_ID[id];
      return true;
    },

    // EP-E-GQL-012: processCheckout(cartId, paymentMethod) — bearer required, exclusive
    processCheckout(_parent, { cartId, paymentMethod }, context) {
      requireAuth(context);
      if (!paymentMethod.type) throw new GraphQLError('paymentMethod.type is required', { extensions: { code: 'BAD_USER_INPUT' } });
      const order = {
        id:         `ORD-${Date.now()}`,
        userId:     context.user.username,
        status:     'PROCESSING',
        lineItems:  [{ sku: 'CART-ITEM', quantity: 1, unitPrice: 0, total: 0 }],
        total:      0,
        createdAt:  new Date().toISOString(),
        updatedAt:  new Date().toISOString(),
        _cartId:    cartId,
      };
      ORDERS[order.id] = order;
      return order;
    },

    // EP-E-GQL-013: inviteTeamMember(workspaceId, email, role) — bearer required, exclusive
    inviteTeamMember(_parent, { workspaceId, email, role }, context) {
      requireAuth(context);
      const member = {
        id:          `tm-${Date.now()}`,
        workspaceId,
        userId:      `invited-${Date.now()}`,
        email,
        fullName:    email.split('@')[0],
        role,
        joinedAt:    new Date().toISOString(),
      };
      TEAM_MEMBERS.push(member);
      pubsub.publish(TEAM_ACTIVITY_FEED, {
        teamActivityFeed: {
          workspaceId,
          userId:       context.user.username,
          action:       'invited_member',
          resourceType: 'member',
          resourceId:   member.id,
          timestamp:    new Date().toISOString(),
        },
      });
      return member;
    },

    // EP-E-GQL-014: updateBilling(workspaceId, plan) — bearer required, exclusive
    updateBilling(_parent, { workspaceId, plan }, context) {
      requireAuth(context);
      const planAmounts = { FREE: 0, STARTER: 29, PRO: 99, ENTERPRISE: 499 };
      const billing = BILLING[workspaceId] || {
        workspaceId,
        status:             'ACTIVE',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd:   new Date(Date.now() + 30 * 86400000).toISOString(),
        seats:              10,
        usedSeats:          1,
      };
      const updated = { ...billing, plan, monthlyAmount: planAmounts[plan] };
      BILLING[workspaceId] = updated;
      return updated;
    },
  },

  // ── Subscriptions ─────────────────────────────────────────────────────────

  Subscription: {

    // EP-E-GQL-015: orderStatusChanged(orderId) — bearer enforced at WS connect
    orderStatusChanged: {
      subscribe(_parent, { orderId }) {
        // Filter to only events matching the requested orderId
        // Using asyncIterator with a simple wrapper that checks the event
        const iterator = pubsub.asyncIterator([ORDER_STATUS_CHANGED]);
        return {
          [Symbol.asyncIterator]() { return this; },
          async next() {
            while (true) {
              const result = await iterator.next();
              if (result.done) return result;
              const order = result.value.orderStatusChanged;
              if (!orderId || order.id === orderId || orderId === 'ORD-BENCH-001') {
                return result;
              }
            }
          },
          return() { return iterator.return ? iterator.return() : Promise.resolve({ done: true }); },
        };
      },
      resolve(payload) { return payload.orderStatusChanged; },
    },

    // EP-E-GQL-016: dashboardMetricsUpdated(workspaceId) — bearer enforced at WS connect
    dashboardMetricsUpdated: {
      subscribe: () => pubsub.asyncIterator([DASHBOARD_METRICS_UPDATED]),
      resolve(payload) { return payload.dashboardMetricsUpdated; },
    },

    // EP-E-GQL-017: teamActivityFeed(workspaceId) — bearer enforced at WS connect
    teamActivityFeed: {
      subscribe(_parent, { workspaceId }) {
        const iterator = pubsub.asyncIterator([TEAM_ACTIVITY_FEED]);
        return {
          [Symbol.asyncIterator]() { return this; },
          async next() {
            while (true) {
              const result = await iterator.next();
              if (result.done) return result;
              const event = result.value.teamActivityFeed;
              if (!workspaceId || event.workspaceId === workspaceId) {
                return result;
              }
            }
          },
          return() { return iterator.return ? iterator.return() : Promise.resolve({ done: true }); },
        };
      },
      resolve(payload) { return payload.teamActivityFeed; },
    },
  },

  // ── Scalar: DateTime (ISO 8601 string passthrough) ─────────────────────────
  // graphql-scalars is not a dep — DateTime is a simple string scalar here.
  // Returned as ISO strings from all resolvers.
};

module.exports = { resolvers, pubsub };
