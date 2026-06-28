/**
 * EP-E-GQL-002: GRAPHQL /graphql#listOrders  — Query
 * EP-E-GQL-010: GRAPHQL /graphql#updateOrder — Mutation (exclusive)
 * EP-E-GQL-015: GRAPHQL /graphql#orderStatusChanged — Subscription (exclusive)
 */
import { requireAuth } from '../auth';

export const orderResolvers = {
  Query: {
    /** EP-E-GQL-002: listOrders(userId: ID!, status: OrderStatus, limit: Int) */
    listOrders: (_: unknown, args: { userId: string; status?: string; limit?: number }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return [];
    },
  },
  Mutation: {
    /** EP-E-GQL-010: updateOrder(id: ID!, input: UpdateOrderInput!) — exclusive */
    updateOrder: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { id: args.id, status: 'updated', ...args.input };
    },
  },
  Subscription: {
    /** EP-E-GQL-015: orderStatusChanged(orderId: ID!) — exclusive */
    orderStatusChanged: { subscribe: (_: unknown, args: { orderId: string }) => null },
  },
};
