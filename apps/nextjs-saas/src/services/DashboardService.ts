/**
 * SPABench App E — DashboardService
 *
 * EP-E-019: wss://localhost:3005/ws/live-dashboard
 * technique: websocket_static (TC-P2-013 / TC-P3-013)
 * phase: 2 — discoverable by static AST analysis without running the browser
 *
 * The WS_URL constant is a hardcoded string literal. Any static AST scanner
 * that looks for WebSocket URL patterns will find this directly.
 *
 * EP-E-020: GET http://localhost:3005/api/dashboard/metrics
 * technique: react_useeffect_fetch (TC-P2-017)
 * phase: 2
 *
 * minified_location (EP-E-019): .next/static/chunks/main.js:1:18203
 * minified_location (EP-E-020): .next/static/chunks/pages/dashboard.js:1:4420
 */

// EP-E-019: hardcoded string constant — TC-P2-013 (websocket_static)
// Static AST tools find this without executing the browser
export const WS_URL = 'wss://localhost:3005/ws/live-dashboard';

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

  /**
   * EP-E-020: GET http://localhost:3005/api/dashboard/metrics
   * TC-P2-017 (react_useeffect_fetch): called inside a React useEffect.
   * The ?period query param is required — tool must recover it from the
   * URLSearchParams usage in MetricsDashboard.tsx.
   */
  async fetchMetrics(period: string, token: string): Promise<DashboardMetrics> {
    const url = new URL(`${API_BASE}/api/dashboard/metrics`);
    url.searchParams.set('period', period);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`metrics fetch failed: ${res.status}`);
    return res.json();
  }

  /**
   * EP-E-019: Connect to WebSocket live dashboard.
   * Uses the static WS_URL constant above.
   */
  connectLiveDashboard(token: string, onMetrics: (m: DashboardMetrics) => void): void {
    // EP-E-019: static string — discoverable at phase 2
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
