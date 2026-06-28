/**
 * SPABench App E — NotificationService
 *
 * EP-E-018: wss://localhost:3005/ws/notifications
 * technique: websocket_connection_url (TC-P3-011)
 * phase: 3
 *
 * The WebSocket URL is assembled at runtime from the window.location.host,
 * making it a dynamic connection — discoverable by wrapping the native
 * WebSocket constructor before navigation (Phase 3), NOT by static string search.
 *
 * It is ALSO present as a string constant here (see WS_NOTIFICATIONS below),
 * so it is additionally discoverable via Phase 2 AST — but its primary
 * classification is phase 3 fetch_interception / websocket_connection_url
 * because the constructor wrapping is what the paper's tool uses.
 *
 * minified_location: .next/static/chunks/main.js:1:12088
 */

// Static fallback constant — visible to AST tools
export const WS_NOTIFICATIONS = 'wss://localhost:3005/ws/notifications';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'alert';
  message: string;
  timestamp: string;
  read: boolean;
}

export class NotificationService {
  private ws: WebSocket | null = null;
  private listeners: ((n: Notification) => void)[] = [];

  connect(token: string): void {
    // EP-E-018: runtime WebSocket constructor — TC-P3-011 captures this URL
    // when the WS constructor is wrapped before navigation
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'wss:';
    const host = window.location.hostname;
    const url = `${protocol}//${host}:3005/ws/notifications`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'SUBSCRIBE', token }));
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'PUBLISH') {
        this.listeners.forEach(fn => fn(msg.payload as Notification));
      }
    };
  }

  onNotification(fn: (n: Notification) => void): void {
    this.listeners.push(fn);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
