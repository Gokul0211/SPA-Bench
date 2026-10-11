import { requireAuth } from '../auth';

export const teamResolvers = {
  Query: {

    listTeamMembers: (_: unknown, args: { workspaceId: string; role?: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return [];
    },
  },
  Mutation: {

    inviteTeamMember: (_: unknown, args: { workspaceId: string; email: string; role: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { id: `tm-${Date.now()}`, email: args.email, role: args.role };
    },
  },
  Subscription: {

    teamActivityFeed: { subscribe: (_: unknown, args: { workspaceId: string }) => null },
  },
};
