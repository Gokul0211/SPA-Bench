import { requireAuth } from '../auth';

export const checkoutResolvers = {
  Mutation: {

    processCheckout: (_: unknown, args: { cartId: string; paymentMethod: Record<string, unknown> }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { orderId: `ord-${Date.now()}`, status: 'processing', total: 0 };
    },
  },
};
