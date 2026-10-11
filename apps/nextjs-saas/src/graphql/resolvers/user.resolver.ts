import { requireAuth } from '../auth';

export const userResolvers = {
  Query: {

    getUser: (_: unknown, { id }: { id: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { id, username: 'benchuser', email: `user-${id}@example.com`, role: 'operator' };
    },
  },
  Mutation: {

    createUser: (_: unknown, { input }: { input: Record<string, unknown> }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { id: `usr-${Date.now()}`, ...input };
    },
  },
};
