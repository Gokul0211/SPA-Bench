import React, { useState, useEffect } from 'react';
import { DashboardService, DashboardMetrics } from '../services/DashboardService';

const svc = new DashboardService();

type Period = 'last_7d' | 'last_30d' | 'last_90d' | 'last_365d';

const MetricsDashboard: React.FC = () => {
  const [period, setPeriod] = useState<Period>('last_30d');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('saas_token') || '';
    setLoading(true);

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
