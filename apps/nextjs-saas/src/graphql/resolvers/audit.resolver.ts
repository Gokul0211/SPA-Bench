import { requireAuth } from '../auth';

export const auditResolvers = {
  Query: {

    getAuditLog: (_: unknown, args: { resourceId: string; from?: string; to?: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return [];
    },
  },
};
