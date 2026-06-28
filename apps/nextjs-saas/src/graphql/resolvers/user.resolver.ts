/**
 * EP-E-GQL-001: GRAPHQL /graphql#getUser    — Query
 * EP-E-GQL-009: GRAPHQL /graphql#createUser — Mutation (exclusive)
 * technique: graphql_query_resolver / graphql_mutation_resolver
 * phase: 4 — only via introspection
 */
import { requireAuth } from '../auth';

export const userResolvers = {
  Query: {
    /** EP-E-GQL-001: getUser(id: ID!): User */
    getUser: (_: unknown, { id }: { id: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { id, username: 'benchuser', email: `user-${id}@spabench.dev`, role: 'operator' };
    },
  },
  Mutation: {
    /** EP-E-GQL-009: createUser(input: CreateUserInput!): User — exclusive */
    createUser: (_: unknown, { input }: { input: Record<string, unknown> }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { id: `usr-${Date.now()}`, ...input };
    },
  },
};
