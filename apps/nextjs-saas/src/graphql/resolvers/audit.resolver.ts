/**
 * EP-E-GQL-006: GRAPHQL /graphql#getAuditLog — Query
 */
import { requireAuth } from '../auth';

export const auditResolvers = {
  Query: {
    /** EP-E-GQL-006: getAuditLog(resourceId: ID!, from: DateTime, to: DateTime) */
    getAuditLog: (_: unknown, args: { resourceId: string; from?: string; to?: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return [];
    },
  },
};
