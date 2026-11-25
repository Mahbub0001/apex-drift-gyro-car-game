import Peer, { DataConnection } from 'peerjs';
import { ControllerInput, PeerMessage } from '../types';
import { openLocalRelaySocket, LocalRelayHandle } from '../utils/wsRelay';

const RTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

export class WebRTCHost {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private relay: LocalRelayHandle | null = null;
  private relayClientPresent: boolean = false;
  private webrtcOpen: boolean = false;

  public roomId: string = '';
  public isConnected: boolean = false;
  public pingMs: number = 0;

  private onInputCallback: ((input: ControllerInput) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;
  private pingInterval: number | null = null;
  private lastInputTimestamp: number = 0;
  private isDestroyed: boolean = false;

  constructor(roomId: string) {
    this.roomId = roomId.toUpperCase().trim();
  }

  public setInputCallback(cb: (input: ControllerInput) => void) {
    this.onInputCallback = cb;
  }

  public setConnectionChangeCallback(cb: (connected: boolean) => void) {
    this.onConnectionChangeCallback = cb;
  }

  private updateConnectionState() {
    const next = this.webrtcOpen || this.relayClientPresent;
    if (next !== this.isConnected) {
      this.isConnected = next;
      this.onConnectionChangeCallback?.(next);
    }
    if (next && !this.pingInterval) {
      this.startPingMonitor();
    } else if (!next && this.pingInterval) {
      this.stopPingMonitor();
    }
  }

  private handleIncomingMessage(msg: any) {
    if (!msg || !msg.type) return;

    if (msg.type === 'INPUT' && msg.payload) {
      const payload = msg.payload as ControllerInput;
      // Drop delayed out-of-order unreliable packets (allow backwards reset if clock shifted >2s)
      if (
        typeof payload.timestamp === 'number' &&
        payload.timestamp < this.lastInputTimestamp &&
        this.lastInputTimestamp - payload.timestamp < 2000
      ) {
        return;
      }
      if (typeof payload.timestamp === 'number') {
        this.lastInputTimestamp = payload.timestamp;
      }
      this.onInputCallback?.(payload);
    } else if (msg.type === 'PONG' && msg.payload?.sentAt) {
      this.pingMs = Math.max(1, Math.round(Date.now() - msg.payload.sentAt));
    } else if (msg.type === 'RELAY_PEERS' && Array.isArray(msg.payload)) {
      const hasClient = msg.payload.some((p: any) => p.role === 'client');
      if (hasClient !== this.relayClientPresent) {
        this.relayClientPresent = hasClient;
        this.updateConnectionState();
      }
    } else if (msg.type === 'RELAY_PEER_JOINED' && msg.payload?.role === 'client') {
      this.relayClientPresent = true;
      this.updateConnectionState();
    } else if (msg.type === 'RELAY_PEER_LEFT' && msg.payload?.role === 'client') {
      this.relayClientPresent = false;
      this.updateConnectionState();
    }
  }

  public init(
    onInput: (input: ControllerInput) => void,
    onConnectionChange: (connected: boolean) => void
  ) {
    this.onInputCallback = onInput;
    this.onConnectionChangeCallback = onConnectionChange;

    // 1. Local LAN WebSocket Fast-Path (<2ms latency on same Wi-Fi, bypasses NAT/PeerJS issues)
    this.relay = openLocalRelaySocket({
      channel: 'gyro',
      room: this.roomId,
      role: 'host',
      id: `apex-host-${this.roomId}`,
      onMessage: (msg) => {
        if (msg.type === 'INPUT' && !this.relayClientPresent) {
          this.relayClientPresent = true;
          this.updateConnectionState();
        }
        this.handleIncomingMessage(msg);
      },
      onClose: () => {
        this.relayClientPresent = false;
        this.updateConnectionState();
      }
    });

    // 2. Global PeerJS WebRTC P2P Channel (works across internet & production hosting)
    const hostPeerId = `apex-host-${this.roomId}`;
    this.peer = new Peer(hostPeerId, {
      debug: 1,
      config: { iceServers: RTC_ICE_SERVERS }
    });

    this.peer.on('open', (id) => {
      console.log('[WebRTC Host] Ready on Peer ID:', id);
    });

    this.peer.on('connection', (conn) => {
      console.log('[WebRTC Host] Mobile controller connected:', conn.peer);
      if (this.connection && this.connection !== conn) {
        try {
          this.connection.close();
        } catch {}
      }
      this.connection = conn;
      this.setupConnection(conn);
    });

    this.peer.on('disconnected', () => {
      if (!this.isDestroyed && this.peer && !this.peer.destroyed) {
        setTimeout(() => {
          try {
            if (!this.isDestroyed && this.peer && !this.peer.destroyed && this.peer.disconnected) {
              this.peer.reconnect();
            }
          } catch {}
        }, 1500);
      }
    });

    this.peer.on('error', (err) => {
      console.warn('[WebRTC Host] Error:', err);
    });
  }

  private setupConnection(conn: DataConnection) {
    if (conn.open) {
      if (this.connection === conn) {
        this.webrtcOpen = true;
        this.updateConnectionState();
      }
    }

    conn.on('open', () => {
      if (this.connection !== conn) return;
      this.webrtcOpen = true;
      this.updateConnectionState();
    });

    conn.on('data', (data: any) => {
      this.handleIncomingMessage(data as PeerMessage);
    });

    conn.on('close', () => {
      // Only clear active flag if this is still the current connection (ignore stale close events!)
      if (this.connection !== conn) return;
      this.webrtcOpen = false;
      this.connection = null;
      this.updateConnectionState();
    });

    conn.on('error', () => {
      if (this.connection !== conn) return;
      this.webrtcOpen = false;
      this.connection = null;
      this.updateConnectionState();
    });
  }

  private startPingMonitor() {
    this.stopPingMonitor();
    this.pingInterval = window.setInterval(() => {
      const pingMsg = { type: 'PING', payload: { sentAt: Date.now() } };
      if (this.connection?.open) {
        this.connection.send(pingMsg);
      }
      if (this.relayClientPresent && this.relay?.isOpen()) {
        this.relay.send(pingMsg);
      }
    }, 1000);
  }

  private stopPingMonitor() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public sendFeedback(telemetry: { speedKmh: number; gear: number | string; rpm: number }) {
    const msg = { type: 'FEEDBACK', payload: telemetry };
    if (this.connection?.open) {
      this.connection.send(msg);
    } else if (this.relayClientPresent && this.relay?.isOpen()) {
      this.relay.send(msg);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopPingMonitor();
    this.relay?.close();
    this.relay = null;
    try {
      this.connection?.close();
    } catch {}
    try {
      this.peer?.destroy();
    } catch {}
  }
}

export class WebRTCController {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private relay: LocalRelayHandle | null = null;
  private relayHostPresent: boolean = false;
  private webrtcOpen: boolean = false;
  private isDestroyed: boolean = false;
  private retryTimer: number | null = null;

  public roomId: string = '';
  public isConnected: boolean = false;
  public pingMs: number = 0;

  private onFeedbackCallback: ((data: any) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;

  constructor(roomId: string) {
    this.roomId = roomId.toUpperCase().trim();
  }

  private updateConnectionState() {
    const next = this.webrtcOpen || this.relayHostPresent;
    if (next !== this.isConnected) {
      this.isConnected = next;
      this.onConnectionChangeCallback?.(next);
    }
  }

  private handleIncomingMessage(msg: any) {
    if (!msg || !msg.type) return;

    if (msg.type === 'PING' && msg.payload?.sentAt) {
      const pong = { type: 'PONG', payload: { sentAt: msg.payload.sentAt } };
      if (this.connection?.open) this.connection.send(pong);
      if (this.relay?.isOpen()) this.relay.send(pong);
      this.pingMs = Math.max(1, Math.round(Date.now() - msg.payload.sentAt));
    } else if (msg.type === 'FEEDBACK') {
      if (!this.relayHostPresent && this.relay?.isOpen()) {
        this.relayHostPresent = true;
        this.updateConnectionState();
      }
      this.onFeedbackCallback?.(msg.payload);
    } else if (msg.type === 'RELAY_PEERS' && Array.isArray(msg.payload)) {
      const hasHost = msg.payload.some((p: any) => p.role === 'host');
      if (hasHost !== this.relayHostPresent) {
        this.relayHostPresent = hasHost;
        this.updateConnectionState();
      }
    } else if (msg.type === 'RELAY_PEER_JOINED' && msg.payload?.role === 'host') {
      this.relayHostPresent = true;
      this.updateConnectionState();
    } else if (msg.type === 'RELAY_PEER_LEFT' && msg.payload?.role === 'host') {
      this.relayHostPresent = false;
      this.updateConnectionState();
    }
  }

  private scheduleWebRTCRetry() {
    if (this.isDestroyed || this.webrtcOpen || this.retryTimer !== null) return;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      if (this.isDestroyed || this.webrtcOpen || !this.peer || this.peer.destroyed || !this.peer.open) {
        return;
      }
      const hostPeerId = `apex-host-${this.roomId}`;
      try {
        if (this.connection) {
          try {
            this.connection.close();
          } catch {}
        }
        const conn = this.peer.connect(hostPeerId, { reliable: false });
        this.connection = conn;
        this.setupConnection(conn);
      } catch (e) {
        console.warn('[WebRTC Controller] Retry connect error:', e);
        this.scheduleWebRTCRetry();
      }
    }, 2200);
  }

  public connect(
    onFeedback: (data: any) => void,
    onConnectionChange: (connected: boolean) => void
  ) {
    this.onFeedbackCallback = onFeedback;
    this.onConnectionChangeCallback = onConnectionChange;

    const controllerPeerId = `apex-ctrl-${this.roomId}-${Math.floor(Math.random() * 10000)}`;

    // 1. Local LAN WebSocket Fast-Path (<2ms latency on same Wi-Fi!)
    this.relay = openLocalRelaySocket({
      channel: 'gyro',
      room: this.roomId,
      role: 'client',
      id: controllerPeerId,
      onMessage: (msg) => this.handleIncomingMessage(msg),
      onClose: () => {
        this.relayHostPresent = false;
        this.updateConnectionState();
      }
    });

    // 2. PeerJS WebRTC P2P Fallback
    this.peer = new Peer(controllerPeerId, {
      debug: 1,
      config: { iceServers: RTC_ICE_SERVERS }
    });

    this.peer.on('open', () => {
      if (this.isDestroyed || !this.peer) return;
      const hostPeerId = `apex-host-${this.roomId}`;
      console.log('[WebRTC Controller] Connecting to host:', hostPeerId);
      const conn = this.peer.connect(hostPeerId, { reliable: false });
      this.connection = conn;
      this.setupConnection(conn);
    });

    this.peer.on('disconnected', () => {
      if (!this.isDestroyed && this.peer && !this.peer.destroyed) {
        setTimeout(() => {
          try {
            if (!this.isDestroyed && this.peer && !this.peer.destroyed && this.peer.disconnected) {
              this.peer.reconnect();
            }
          } catch {}
        }, 1500);
      }
    });

    this.peer.on('error', (err: any) => {
      console.warn('[WebRTC Controller] Peer error:', err);
      this.scheduleWebRTCRetry();
    });
  }

  private setupConnection(conn: DataConnection) {
    // Watchdog in case ICE stalls silently without open or error
    const stallCheck = window.setTimeout(() => {
      if (!conn.open && this.connection === conn && !this.isDestroyed) {
        this.scheduleWebRTCRetry();
      }
    }, 3500);

    conn.on('open', () => {
      clearTimeout(stallCheck);
      if (this.connection !== conn) return;
      this.webrtcOpen = true;
      this.updateConnectionState();
    });

    conn.on('data', (data: any) => {
      this.handleIncomingMessage(data as PeerMessage);
    });

    conn.on('close', () => {
      clearTimeout(stallCheck);
      if (this.connection !== conn) return;
      this.webrtcOpen = false;
      this.updateConnectionState();
      this.scheduleWebRTCRetry();
    });

    conn.on('error', () => {
      clearTimeout(stallCheck);
      if (this.connection !== conn) return;
      this.webrtcOpen = false;
      this.updateConnectionState();
      this.scheduleWebRTCRetry();
    });
  }

  public sendInput(input: ControllerInput) {
    const msg = { type: 'INPUT', payload: input };
    // Prefer low-latency LAN WS relay when connected on Wi-Fi, else WebRTC DataChannel
    if (this.relayHostPresent && this.relay?.isOpen()) {
      this.relay.send(msg);
    } else if (this.connection?.open) {
      this.connection.send(msg);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.relay?.close();
    this.relay = null;
    try {
      this.connection?.close();
    } catch {}
    try {
      this.peer?.destroy();
    } catch {}
  }
}
