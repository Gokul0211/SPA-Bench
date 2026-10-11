import { requireAuth } from '../auth';

export const dashboardResolvers = {
  Query: {

    getDashboardMetrics: (_: unknown, args: { period: string; granularity?: string }, ctx: { token?: string }) => {
      requireAuth(ctx);
      return { period: args.period, totalRevenue: 0, activeUsers: 0, orderCount: 0 };
    },
  },
  Subscription: {

    dashboardMetricsUpdated: { subscribe: (_: unknown, args: { workspaceId: string }) => null },
  },
};
