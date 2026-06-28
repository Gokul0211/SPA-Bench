/**
 * EP-E-GQL-008: GRAPHQL /graphql#getBillingInfo — Query
 * EP-E-GQL-014: GRAPHQL /graphql#updateBilling  — Mutation (exclusive)
 */
import { requireAuth } from '../auth';

export const billingResolvers = {
  Query: {
    /** EP-E-GQL-008: getBillingInfo(workspaceId: ID!) */
    getBillingInfo: (_: unknown, { workspaceId }: { workspaceId: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { workspaceId, plan: 'pro', seats: 5, nextBillingDate: '2026-04-01' };
    },
  },
  Mutation: {
    /** EP-E-GQL-014: updateBilling(workspaceId: ID!, plan: BillingPlan!) — exclusive */
    updateBilling: (_: unknown, args: { workspaceId: string; plan: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { workspaceId: args.workspaceId, plan: args.plan };
    },
  },
};
