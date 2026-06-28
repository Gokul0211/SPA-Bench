/**
 * SPABench App E — MetricsDashboard component
 *
 * EP-E-020: GET http://localhost:3005/api/dashboard/metrics
 * technique: react_useeffect_fetch (TC-P2-017)
 * phase: 2
 *
 * The useEffect fires when the `period` state changes.
 * The fetch call uses a template literal with the period variable.
 * AST tools must trace the variable to reconstruct the full URL with
 * the ?period query param.
 *
 * source_file: src/components/MetricsDashboard.tsx
 * minified_location: .next/static/chunks/pages/dashboard.js:1:4420
 */
import React, { useState, useEffect } from 'react';
import { DashboardService, DashboardMetrics } from '../services/DashboardService';

const svc = new DashboardService();

type Period = 'last_7d' | 'last_30d' | 'last_90d' | 'last_365d';

const MetricsDashboard: React.FC = () => {
  const [period, setPeriod] = useState<Period>('last_30d');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('bench_bearer_token') || '';
    setLoading(true);

    // EP-E-020: GET http://localhost:3005/api/dashboard/metrics?period=<period>
    // TC-P2-017: useEffect + fetch pattern — tool must trace `period` state variable
    svc.fetchMetrics(period, token)
      .then(data => { setMetrics(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  return (
    <div className="metrics-dashboard">
      <select value={period} onChange={e => setPeriod(e.target.value as Period)}>
        <option value="last_7d">Last 7 days</option>
        <option value="last_30d">Last 30 days</option>
        <option value="last_90d">Last 90 days</option>
        <option value="last_365d">Last year</option>
      </select>
      {loading && <p>Loading…</p>}
      {metrics && (
        <div className="metric-cards">
          <div className="metric">Revenue: ${metrics.totalRevenue.toLocaleString()}</div>
          <div className="metric">Users: {metrics.activeUsers}</div>
          <div className="metric">Orders: {metrics.orderCount}</div>
        </div>
      )}
    </div>
  );
};

export default MetricsDashboard;
