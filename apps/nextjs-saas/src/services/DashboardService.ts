export const WS_URL = 'ws://localhost:3005/ws/live-dashboard';

const API_BASE = 'http://localhost:3005';

export interface DashboardMetrics {
  period: string;
  totalRevenue: number;
  activeUsers: number;
  orderCount: number;
  avgOrderValue: number;
  timeSeries: { date: string; value: number }[];
}

export class DashboardService {
  private ws: WebSocket | null = null;

  async fetchMetrics(period: string, token: string): Promise<DashboardMetrics> {
    const url = new URL(`${API_BASE}/api/dashboard/metrics`);
    url.searchParams.set('period', period);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`metrics fetch failed: ${res.status}`);
    return res.json();
  }

  connectLiveDashboard(token: string, onMetrics: (m: DashboardMetrics) => void): void {

    this.ws = new WebSocket(WS_URL);
    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'SUBSCRIBE', token }));
    };
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'PUBLISH') onMetrics(msg.payload);
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
