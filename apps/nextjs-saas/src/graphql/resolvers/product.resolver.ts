import { requireAuth } from '../auth';

export const productResolvers = {
  Query: {

    getProduct: (_: unknown, { id, includeReviews }: { id: string; includeReviews?: boolean }) => ({
      id, name: `Product ${id}`, price: 99.99, reviews: includeReviews ? [] : undefined,
    }),

    searchProducts: (_: unknown, { query }: { query: string }) => [],
  },
  Mutation: {

    deleteProduct: (_: unknown, { id }: { id: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return true;
    },
  },
};
