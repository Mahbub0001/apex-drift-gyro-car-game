import Peer, { DataConnection } from 'peerjs';
import { RemotePlayerState } from '../types';

export interface MultiplayerCallbacks {
  onPlayerJoined: (player: RemotePlayerState) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerUpdate: (player: RemotePlayerState) => void;
  onRoomReady: () => void;
}

export class MultiplayerRoomManager {
  public roomCode: string;
  public localPlayerId: string;
  public username: string;
  public isHost: boolean = false;
  public remotePlayers: Map<string, RemotePlayerState> = new Map();

  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private callbacks: MultiplayerCallbacks | null = null;
  private broadcastInterval: number | null = null;

  constructor(roomCode: string, username: string = 'Racer_' + Math.floor(Math.random() * 900 + 100)) {
    this.roomCode = roomCode.toUpperCase();
    this.username = username;
    this.localPlayerId = `player-${Math.floor(Math.random() * 100000)}`;
  }

  public init(isHost: boolean, callbacks: MultiplayerCallbacks) {
    this.isHost = isHost;
    this.callbacks = callbacks;

    const peerId = this.isHost
      ? `apex-mp-host-${this.roomCode}`
      : `apex-mp-peer-${this.roomCode}-${this.localPlayerId}`;

    this.peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log('[Multiplayer] Connected to Peer Server with ID:', id);

      if (!this.isHost) {
        // Connect to the room host
        const hostPeerId = `apex-mp-host-${this.roomCode}`;
        const conn = this.peer!.connect(hostPeerId, { reliable: false });
        this.setupConnection(conn);
      }
    });

    this.peer.on('connection', (conn) => {
      console.log('[Multiplayer Host] Remote peer connected:', conn.peer);
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('[Multiplayer] Peer error:', err);
    });
  }

  private setupConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    conn.on('open', () => {
      console.log('[Multiplayer] DataConnection open with:', conn.peer);
      // Send handshake
      conn.send({
        type: 'HANDSHAKE',
        payload: {
          id: this.localPlayerId,
          username: this.username,
          carId: 'supra_mk4',
          color: this.isHost ? '#00f2fe' : '#a855f7'
        }
      });
    });

    conn.on('data', (data: any) => {
      if (!data || !data.type) return;

      if (data.type === 'HANDSHAKE') {
        const p = data.payload;
        const playerState: RemotePlayerState = {
          id: p.id,
          username: p.username,
          carId: p.carId,
          color: p.color,
          position: [0, 0.4, 0],
          rotation: [0, 0, 0, 1],
          speedKmh: 0,
          isDrifting: false,
          isNitro: false,
          ping: 15
        };
        this.remotePlayers.set(p.id, playerState);
        this.callbacks?.onPlayerJoined(playerState);
      } else if (data.type === 'STATE_UPDATE') {
        const update = data.payload as RemotePlayerState;
        this.remotePlayers.set(update.id, update);
        this.callbacks?.onPlayerUpdate(update);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      // Remove player
      this.remotePlayers.forEach((player, id) => {
        if (conn.peer.includes(id)) {
          this.remotePlayers.delete(id);
          this.callbacks?.onPlayerLeft(id);
        }
      });
    });
  }

  // Broadcast local car position to all opponents (20 Hz snapshot)
  public broadcastLocalState(state: {
    position: [number, number, number];
    rotation: [number, number, number, number];
    speedKmh: number;
    isDrifting: boolean;
    isNitro: boolean;
  }) {
    const packet: RemotePlayerState = {
      id: this.localPlayerId,
      username: this.username,
      carId: 'supra_mk4',
      color: this.isHost ? '#00f2fe' : '#a855f7',
      position: state.position,
      rotation: state.rotation,
      speedKmh: state.speedKmh,
      isDrifting: state.isDrifting,
      isNitro: state.isNitro,
      ping: 15
    };

    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send({
          type: 'STATE_UPDATE',
          payload: packet
        });
      }
    });
  }

  public getOpponentsList(): RemotePlayerState[] {
    return Array.from(this.remotePlayers.values());
  }

  public destroy() {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    this.connections.forEach((conn) => conn.close());
    this.peer?.destroy();
  }
}
