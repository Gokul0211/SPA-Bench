/**
 * EP-E-GQL-003: GRAPHQL /graphql#getProduct     — Query (public)
 * EP-E-GQL-004: GRAPHQL /graphql#searchProducts — Query (public)
 * EP-E-GQL-011: GRAPHQL /graphql#deleteProduct  — Mutation (exclusive)
 */
import { requireAuth } from '../auth';

export const productResolvers = {
  Query: {
    /** EP-E-GQL-003: getProduct(id: ID!, includeReviews: Boolean) — public */
    getProduct: (_: unknown, { id, includeReviews }: { id: string; includeReviews?: boolean }) => ({
      id, name: `Product ${id}`, price: 99.99, reviews: includeReviews ? [] : undefined,
    }),
    /** EP-E-GQL-004: searchProducts(query: String!, filters: ProductFilter) — public */
    searchProducts: (_: unknown, { query }: { query: string }) => [],
  },
  Mutation: {
    /** EP-E-GQL-011: deleteProduct(id: ID!) — exclusive */
    deleteProduct: (_: unknown, { id }: { id: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return true;
    },
  },
};
