/**
 * EP-E-GQL-012: GRAPHQL /graphql#processCheckout — Mutation (exclusive)
 */
import { requireAuth } from '../auth';

export const checkoutResolvers = {
  Mutation: {
    /** EP-E-GQL-012: processCheckout(cartId: ID!, paymentMethod: PaymentInput!) — exclusive */
    processCheckout: (_: unknown, args: { cartId: string; paymentMethod: Record<string, unknown> }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { orderId: `ord-${Date.now()}`, status: 'processing', total: 0 };
    },
  },
};
