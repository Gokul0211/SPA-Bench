export const WS_NOTIFICATIONS = 'ws://localhost:3005/ws/notifications';

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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/notifications`;

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
