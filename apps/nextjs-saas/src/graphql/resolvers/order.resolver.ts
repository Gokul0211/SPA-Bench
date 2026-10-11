import { requireAuth } from '../auth';

export const orderResolvers = {
  Query: {

    listOrders: (_: unknown, args: { userId: string; status?: string; limit?: number }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return [];
    },
  },
  Mutation: {

    updateOrder: (_: unknown, args: { id: string; input: Record<string, unknown> }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { id: args.id, status: 'updated', ...args.input };
    },
  },
  Subscription: {

    orderStatusChanged: { subscribe: (_: unknown, args: { orderId: string }) => null },
  },
};
