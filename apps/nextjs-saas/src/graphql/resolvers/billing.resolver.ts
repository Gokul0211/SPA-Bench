import { requireAuth } from '../auth';

export const billingResolvers = {
  Query: {

    getBillingInfo: (_: unknown, { workspaceId }: { workspaceId: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { workspaceId, plan: 'pro', seats: 5, nextBillingDate: '2026-04-01' };
    },
  },
  Mutation: {

    updateBilling: (_: unknown, args: { workspaceId: string; plan: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { workspaceId: args.workspaceId, plan: args.plan };
    },
  },
};
