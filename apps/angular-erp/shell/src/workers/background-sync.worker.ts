/**
 * SPABench App B — Background Sync Worker
 *
 * TC-P1-008 (web_worker_constructor):
 *   This worker file is instantiated in the shell via:
 *     new Worker('/background-sync.worker.js')
 *   The worker runs in a separate thread. API calls made from inside the worker
 *   are invisible to main-thread traffic interceptors — a tool that only hooks
 *   XMLHttpRequest and fetch() in the main thread will miss these.
 *
 *   The worker itself is discoverable via the Worker constructor URL in main.js.
 *   TC-P1-008 scores the discovery of the worker URL, not the endpoints inside it.
 *   The worker's API calls become visible only if the tool also instruments
 *   the worker thread (e.g. by injecting the intercept script into worker scope).
 *
 * Worker responsibilities:
 *   - Poll the sync-status endpoint every 30 seconds
 *   - Buffer failed requests for retry
 *   - Notify the main thread of connectivity changes
 */

/// <reference lib="webworker" />

const SYNC_ENDPOINT = '/api/sync/status';
const RETRY_QUEUE_ENDPOINT = '/api/sync/retry-queue';
const POLL_INTERVAL_MS = 30000;

let authToken: string | null = null;

self.addEventListener('message', (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INIT':
      // Receive bearer token from main thread at startup
      authToken = payload.token;
      startPolling();
      break;
    case 'UPDATE_TOKEN':
      authToken = payload.token;
      break;
    case 'STOP':
      stopPolling();
      break;
  }
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(syncStatus, POLL_INTERVAL_MS);
  syncStatus(); // immediate first poll
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function syncStatus(): Promise<void> {
  if (!authToken) return;
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      self.postMessage({ type: 'SYNC_ERROR', status: res.status });
      return;
    }
    const data = await res.json();
    self.postMessage({ type: 'SYNC_OK', payload: data });

    // If there are queued retries, flush them
    if (data.pendingRetries > 0) {
      await flushRetryQueue();
    }
  } catch (err) {
    self.postMessage({ type: 'SYNC_NETWORK_ERROR', message: (err as Error).message });
  }
}

async function flushRetryQueue(): Promise<void> {
  try {
    const res = await fetch(RETRY_QUEUE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ flush: true }),
    });
    const result = await res.json();
    self.postMessage({ type: 'RETRY_FLUSHED', flushed: result.count });
  } catch {
    // Retry queue flush failure is non-fatal
  }
}
