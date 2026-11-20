import Peer, { DataConnection } from 'peerjs';
import { ControllerInput, PeerMessage } from '../types';

export class WebRTCHost {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  public roomId: string = '';
  public isConnected: boolean = false;
  public pingMs: number = 0;

  private onInputCallback: ((input: ControllerInput) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;
  private pingInterval: number | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  public init(
    onInput: (input: ControllerInput) => void,
    onConnectionChange: (connected: boolean) => void
  ) {
    this.onInputCallback = onInput;
    this.onConnectionChangeCallback = onConnectionChange;

    const hostPeerId = `apex-host-${this.roomId}`;
    this.peer = new Peer(hostPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log('[WebRTC Host] Ready on Peer ID:', id);
    });

    this.peer.on('connection', (conn) => {
      console.log('[WebRTC Host] Mobile controller connected:', conn.peer);
      this.connection = conn;
      this.setupConnection();
    });

    this.peer.on('error', (err) => {
      console.warn('[WebRTC Host] Error:', err);
    });
  }

  private setupConnection() {
    if (!this.connection) return;

    this.connection.on('open', () => {
      this.isConnected = true;
      this.onConnectionChangeCallback?.(true);
      this.startPingMonitor();
    });

    this.connection.on('data', (data: any) => {
      const msg = data as PeerMessage;
      if (!msg) return;

      if (msg.type === 'INPUT') {
        this.onInputCallback?.(msg.payload as ControllerInput);
      } else if (msg.type === 'PONG') {
        const roundtrip = Date.now() - msg.payload.sentAt;
        this.pingMs = Math.round(roundtrip);
      }
    });

    this.connection.on('close', () => {
      this.isConnected = false;
      this.onConnectionChangeCallback?.(false);
      this.stopPingMonitor();
    });
  }

  private startPingMonitor() {
    this.stopPingMonitor();
    this.pingInterval = window.setInterval(() => {
      if (this.connection?.open) {
        this.connection.send({
          type: 'PING',
          payload: { sentAt: Date.now() }
        });
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
    if (this.connection?.open) {
      this.connection.send({
        type: 'FEEDBACK',
        payload: telemetry
      });
    }
  }

  public destroy() {
    this.stopPingMonitor();
    this.connection?.close();
    this.peer?.destroy();
  }
}

export class WebRTCController {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  public roomId: string = '';
  public isConnected: boolean = false;
  public pingMs: number = 0;

  private onFeedbackCallback: ((data: any) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  public connect(
    onFeedback: (data: any) => void,
    onConnectionChange: (connected: boolean) => void
  ) {
    this.onFeedbackCallback = onFeedback;
    this.onConnectionChangeCallback = onConnectionChange;

    const controllerPeerId = `apex-ctrl-${this.roomId}-${Math.floor(Math.random() * 10000)}`;
    this.peer = new Peer(controllerPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    this.peer.on('open', () => {
      const hostPeerId = `apex-host-${this.roomId}`;
      console.log('[WebRTC Controller] Connecting to host:', hostPeerId);
      
      const conn = this.peer!.connect(hostPeerId, {
        reliable: false // Unreliable/unordered for ultra-low latency UDP mode
      });
      this.connection = conn;
      this.setupConnection();
    });

    this.peer.on('error', (err) => {
      console.warn('[WebRTC Controller] Peer error:', err);
    });
  }

  private setupConnection() {
    if (!this.connection) return;

    this.connection.on('open', () => {
      this.isConnected = true;
      this.onConnectionChangeCallback?.(true);
    });

    this.connection.on('data', (data: any) => {
      const msg = data as PeerMessage;
      if (!msg) return;

      if (msg.type === 'PING') {
        this.connection?.send({
          type: 'PONG',
          payload: { sentAt: msg.payload.sentAt }
        });
        this.pingMs = Math.round(Date.now() - msg.payload.sentAt);
      } else if (msg.type === 'FEEDBACK') {
        this.onFeedbackCallback?.(msg.payload);
      }
    });

    this.connection.on('close', () => {
      this.isConnected = false;
      this.onConnectionChangeCallback?.(false);
    });
  }

  public sendInput(input: ControllerInput) {
    if (this.connection?.open) {
      this.connection.send({
        type: 'INPUT',
        payload: input
      });
    }
  }

  public destroy() {
    this.connection?.close();
    this.peer?.destroy();
  }
}
