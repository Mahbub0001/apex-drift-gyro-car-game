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
  public carId: string;
  public color: string;
  public isHost: boolean = false;
  public remotePlayers: Map<string, RemotePlayerState> = new Map();

  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private callbacks: MultiplayerCallbacks | null = null;
  private broadcastInterval: number | null = null;

  constructor(
    roomCode: string,
    username: string = 'Racer_' + Math.floor(Math.random() * 900 + 100),
    carId: string = 'raptor',
    color: string = '#00f2fe'
  ) {
    this.roomCode = roomCode.toUpperCase().trim();
    this.username = username;
    this.carId = carId;
    this.color = color;
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
      this.callbacks?.onRoomReady();

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

  private sendHandshake(conn: DataConnection, isReply: boolean = false) {
    if (conn && conn.open) {
      conn.send({
        type: isReply ? 'HANDSHAKE_REPLY' : 'HANDSHAKE',
        payload: {
          id: this.localPlayerId,
          username: this.username,
          carId: this.carId,
          color: this.color
        }
      });
    }
  }

  private setupConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    if (conn.open) {
      this.sendHandshake(conn);
    }

    conn.on('open', () => {
      console.log('[Multiplayer] DataConnection open with:', conn.peer);
      this.sendHandshake(conn);
    });

    conn.on('data', (data: any) => {
      if (!data || !data.type) return;

      if (data.type === 'HANDSHAKE' || data.type === 'HANDSHAKE_REPLY') {
        const p = data.payload;
        const playerState: RemotePlayerState = {
          id: p.id,
          username: p.username || 'Racer',
          carId: p.carId || 'raptor',
          color: p.color || '#a855f7',
          position: p.position || [0, 0.4, 0],
          rotation: p.rotation || [0, 0, 0, 1],
          speedKmh: p.speedKmh || 0,
          isDrifting: false,
          isNitro: false,
          ping: 15
        };
        this.remotePlayers.set(p.id, playerState);
        this.callbacks?.onPlayerJoined(playerState);

        // If this was an initial HANDSHAKE, reply with our info so the sender knows us
        if (data.type === 'HANDSHAKE') {
          this.sendHandshake(conn, true);

          // If we are Host, send existing roster and notify other peers
          if (this.isHost) {
            const roster = Array.from(this.remotePlayers.values()).filter((pl) => pl.id !== p.id);
            if (roster.length > 0) {
              conn.send({
                type: 'ROSTER',
                payload: roster
              });
            }

            // Broadcast new player joined to all other connections
            this.connections.forEach((c, peerId) => {
              if (peerId !== conn.peer && c.open) {
                c.send({
                  type: 'HANDSHAKE',
                  payload: p
                });
              }
            });
          }
        }
      } else if (data.type === 'ROSTER') {
        const roster = data.payload as RemotePlayerState[];
        roster.forEach((player) => {
          this.remotePlayers.set(player.id, player);
          this.callbacks?.onPlayerJoined(player);
        });
      } else if (data.type === 'STATE_UPDATE') {
        const update = data.payload as RemotePlayerState;
        this.remotePlayers.set(update.id, update);
        this.callbacks?.onPlayerUpdate(update);

        // Host relays client position update to all other connected peers
        if (this.isHost) {
          this.connections.forEach((c, peerId) => {
            if (peerId !== conn.peer && c.open) {
              c.send({ type: 'STATE_UPDATE', payload: update });
            }
          });
        }
      } else if (data.type === 'PLAYER_LEFT') {
        const leftId = data.payload as string;
        this.remotePlayers.delete(leftId);
        this.callbacks?.onPlayerLeft(leftId);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.remotePlayers.forEach((player, id) => {
        if (conn.peer.includes(id)) {
          this.remotePlayers.delete(id);
          this.callbacks?.onPlayerLeft(id);

          // If host, notify all other peers
          if (this.isHost) {
            this.connections.forEach((c) => {
              if (c.open) {
                c.send({ type: 'PLAYER_LEFT', payload: id });
              }
            });
          }
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
      carId: this.carId,
      color: this.color,
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
