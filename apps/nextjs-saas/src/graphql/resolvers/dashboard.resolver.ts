/**
 * EP-E-GQL-005: GRAPHQL /graphql#getDashboardMetrics — Query
 * EP-E-GQL-016: GRAPHQL /graphql#dashboardMetricsUpdated — Subscription (exclusive)
 */
import { requireAuth } from '../auth';

export const dashboardResolvers = {
  Query: {
    /** EP-E-GQL-005: getDashboardMetrics(period: String!, granularity: Granularity) */
    getDashboardMetrics: (_: unknown, args: { period: string; granularity?: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { period: args.period, totalRevenue: 0, activeUsers: 0, orderCount: 0 };
    },
  },
  Subscription: {
    /** EP-E-GQL-016: dashboardMetricsUpdated(workspaceId: ID!) — exclusive */
    dashboardMetricsUpdated: { subscribe: (_: unknown, args: { workspaceId: string }) => null },
  },
};
