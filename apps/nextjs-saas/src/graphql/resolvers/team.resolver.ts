/**
 * EP-E-GQL-007: GRAPHQL /graphql#listTeamMembers  — Query
 * EP-E-GQL-013: GRAPHQL /graphql#inviteTeamMember — Mutation (exclusive)
 * EP-E-GQL-017: GRAPHQL /graphql#teamActivityFeed — Subscription (exclusive)
 */
import { requireAuth } from '../auth';

export const teamResolvers = {
  Query: {
    /** EP-E-GQL-007: listTeamMembers(workspaceId: ID!, role: Role) */
    listTeamMembers: (_: unknown, args: { workspaceId: string; role?: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return [];
    },
  },
  Mutation: {
    /** EP-E-GQL-013: inviteTeamMember(workspaceId: ID!, email: String!, role: Role!) — exclusive */
    inviteTeamMember: (_: unknown, args: { workspaceId: string; email: string; role: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { id: `tm-${Date.now()}`, email: args.email, role: args.role };
    },
  },
  Subscription: {
    /** EP-E-GQL-017: teamActivityFeed(workspaceId: ID!) — exclusive */
    teamActivityFeed: { subscribe: (_: unknown, args: { workspaceId: string }) => null },
  },
};
