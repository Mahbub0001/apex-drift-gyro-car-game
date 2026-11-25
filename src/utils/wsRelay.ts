export interface LanInfo {
  primary: string;
  all: string[];
  httpsPort?: number | null;
  httpPort?: number | null;
}

let lanInfoPromise: Promise<LanInfo | null> | null = null;

/**
 * Probes whether the app is running against the Vite dev backend that provides
 * `/api/lan-ip` and `/ws-apex` LAN WebSocket relay. Returns null cleanly on
 * external static hosting so zero doomed WebSocket errors are logged.
 */
export function getLanRelayCapabilities(): Promise<LanInfo | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (lanInfoPromise) return lanInfoPromise;

  lanInfoPromise = fetch('/api/lan-ip', { cache: 'no-store' })
    .then(async (res) => {
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return null;
      const data = await res.json();
      if (!data || typeof data.primary !== 'string') return null;
      return data as LanInfo;
    })
    .catch(() => null);

  return lanInfoPromise;
}

export interface LocalRelayHandle {
  send: (msg: any) => boolean;
  close: () => void;
  isOpen: () => boolean;
}

export function openLocalRelaySocket(opts: {
  channel: 'gyro' | 'mp';
  room: string;
  role: 'host' | 'client';
  id: string;
  onMessage: (msg: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
}): LocalRelayHandle {
  let ws: WebSocket | null = null;
  let closedByCaller = false;
  let reconnectTimer: number | null = null;

  const connect = async () => {
    const info = await getLanRelayCapabilities();
    if (!info || closedByCaller) return;

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const qs = new URLSearchParams({
      channel: opts.channel,
      room: opts.room.toUpperCase().trim(),
      role: opts.role,
      id: opts.id
    });
    const url = `${wsProto}//${window.location.host}/ws-apex?${qs.toString()}`;

    try {
      const socket = new WebSocket(url);
      ws = socket;

      socket.onopen = () => {
        if (closedByCaller || ws !== socket) return;
        opts.onOpen?.();
      };

      socket.onmessage = (ev) => {
        if (closedByCaller || ws !== socket) return;
        try {
          const parsed = JSON.parse(ev.data);
          opts.onMessage(parsed);
        } catch {
          // Ignore invalid payloads
        }
      };

      socket.onclose = () => {
        if (ws === socket) ws = null;
        if (closedByCaller) return;
        opts.onClose?.();
        reconnectTimer = window.setTimeout(connect, 1800);
      };

      socket.onerror = () => {
        try {
          socket.close();
        } catch {}
      };
    } catch {
      if (!closedByCaller) {
        reconnectTimer = window.setTimeout(connect, 2200);
      }
    }
  };

  connect();

  return {
    send: (msg: any) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        return true;
      }
      return false;
    },
    isOpen: () => !!(ws && ws.readyState === WebSocket.OPEN),
    close: () => {
      closedByCaller = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        ws?.close();
      } catch {}
      ws = null;
    }
  };
}
