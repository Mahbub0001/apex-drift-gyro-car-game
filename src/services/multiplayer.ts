import Peer, { DataConnection } from 'peerjs';
import { RemotePlayerState } from '../types';
import { openLocalRelaySocket, LocalRelayHandle } from '../utils/wsRelay';

const MP_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

export type MultiplayerStatus = 'connecting' | 'waiting' | 'connected' | 'error';

export interface MultiplayerCallbacks {
  onPlayerJoined: (player: RemotePlayerState) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerUpdate: (player: RemotePlayerState) => void;
  onRoomReady: () => void;
  onStatusChange?: (status: MultiplayerStatus, detail?: string) => void;
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
  private relay: LocalRelayHandle | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private peerToPlayerId: Map<string, string> = new Map();
  private lastSeenMap: Map<string, number> = new Map();
  private callbacks: MultiplayerCallbacks | null = null;
  private retryJoinTimer: number | null = null;
  private heartbeatInterval: number | null = null;
  private isDestroyed: boolean = false;
  private relayConnected: boolean = false;
  private p2pOpenCount: number = 0;

  constructor(
    roomCode: string,
    username: string = 'Racer_' + Math.floor(Math.random() * 900 + 100),
    carId: string = 'raptor',
    color: string = '#00f2fe'
  ) {
    this.roomCode = roomCode.toUpperCase().trim() || 'APEX99';
    this.username = username;
    this.carId = carId;
    this.color = color;
    this.localPlayerId = `player-${Math.random().toString(36).slice(2, 7)}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  public init(isHost: boolean, callbacks: MultiplayerCallbacks) {
    this.isHost = isHost;
    this.callbacks = callbacks;
    this.callbacks?.onStatusChange?.('connecting', isHost ? 'Starting room...' : `Joining ${this.roomCode}...`);

    // 1. Local LAN / Multi-Tab WebSocket Relay (instant 2ms LAN sync!)
    this.relay = openLocalRelaySocket({
      channel: 'mp',
      room: this.roomCode,
      role: this.isHost ? 'host' : 'client',
      id: this.localPlayerId,
      onOpen: () => {
        this.relayConnected = true;
        this.callbacks?.onRoomReady();
        this.sendRelayHandshake(false);
        this.emitStatus();
      },
      onMessage: (data) => this.handleMessage(data),
      onClose: () => {
        this.relayConnected = false;
        this.emitStatus();
      }
    });

    // 2. PeerJS WebRTC Mesh/Relay (works across the internet too!)
    const peerId = this.isHost
      ? `apex-mp-host-${this.roomCode}`
      : `apex-mp-peer-${this.roomCode}-${this.localPlayerId}`;

    this.peer = new Peer(peerId, {
      debug: 1,
      config: { iceServers: MP_ICE_SERVERS }
    });

    this.peer.on('open', (id) => {
      console.log('[Multiplayer] Connected to Peer Server with ID:', id);
      this.callbacks?.onRoomReady();
      this.emitStatus();

      if (!this.isHost) {
        this.connectToPeerHost();
      }
    });

    this.peer.on('connection', (conn) => {
      console.log('[Multiplayer Host] Remote peer connected:', conn.peer);
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
      console.warn('[Multiplayer] Peer error:', err?.type || err);
      if (err?.type === 'unavailable-id' && this.isHost) {
        if (!this.relayConnected) {
          this.callbacks?.onStatusChange?.(
            'error',
            `Room "${this.roomCode}" already has a Host. Try Join Room instead!`
          );
        }
        return;
      }
      if (err?.type === 'peer-unavailable' && !this.isHost) {
        if (this.remotePlayers.size === 0 && !this.relayConnected) {
          this.callbacks?.onStatusChange?.('waiting', `Searching for Host "${this.roomCode}"...`);
        }
        this.scheduleJoinRetry();
        return;
      }
      if (this.remotePlayers.size === 0 && !this.relayConnected) {
        this.callbacks?.onStatusChange?.('waiting', 'Connecting via P2P / LAN...');
      }
    });

    // Periodic zombie cleanup & handshake keep-alive until racers sync cleanly
    this.heartbeatInterval = window.setInterval(() => {
      const now = Date.now();
      this.lastSeenMap.forEach((ts, playerId) => {
        if (now - ts > 10000) {
          this.lastSeenMap.delete(playerId);
          this.remotePlayers.delete(playerId);
          this.callbacks?.onPlayerLeft(playerId);
          this.emitStatus();
        }
      });

      // Re-announce presence if alone on LAN relay so late joiners catch immediately
      if (this.relayConnected && this.remotePlayers.size === 0) {
        this.sendRelayHandshake(false);
      }
    }, 2500);
  }

  private emitStatus() {
    if (this.isDestroyed) return;
    if (this.remotePlayers.size > 0) {
      this.callbacks?.onStatusChange?.(
        'connected',
        `${this.remotePlayers.size + 1} racers synced`
      );
    } else if (this.isHost && (this.relayConnected || this.peer?.open)) {
      this.callbacks?.onStatusChange?.('waiting', `Room ${this.roomCode} ready — waiting for racers`);
    } else if (!this.isHost && (this.p2pOpenCount > 0 || this.relayConnected)) {
      this.callbacks?.onStatusChange?.('waiting', `Joined ${this.roomCode} — syncing racers`);
    }
  }

  private connectToPeerHost() {
    if (this.isDestroyed || !this.peer || this.peer.destroyed || !this.peer.open) return;
    const hostPeerId = `apex-mp-host-${this.roomCode}`;
    const existing = this.connections.get(hostPeerId);
    if (existing?.open) return;

    try {
      // Reliable channel guarantees HANDSHAKE, ROSTER & PLAYER_LEFT never drop silently!
      const conn = this.peer.connect(hostPeerId, { reliable: true });
      this.setupConnection(conn);
    } catch {
      this.scheduleJoinRetry();
    }
  }

  private scheduleJoinRetry() {
    if (this.isDestroyed || this.isHost || this.retryJoinTimer !== null) return;
    this.retryJoinTimer = window.setTimeout(() => {
      this.retryJoinTimer = null;
      if (!this.isDestroyed && this.p2pOpenCount === 0) {
        this.connectToPeerHost();
      }
    }, 2400);
  }

  private buildHandshakePayload() {
    return {
      id: this.localPlayerId,
      username: this.username,
      carId: this.carId,
      color: this.color
    };
  }

  private sendRelayHandshake(isReply: boolean) {
    if (!this.relay?.isOpen()) return;
    this.relay.send({
      type: isReply ? 'HANDSHAKE_REPLY' : 'HANDSHAKE',
      payload: this.buildHandshakePayload()
    });
  }

  private sendHandshake(conn: DataConnection, isReply: boolean = false) {
    if (conn && conn.open) {
      conn.send({
        type: isReply ? 'HANDSHAKE_REPLY' : 'HANDSHAKE',
        payload: this.buildHandshakePayload()
      });
    }
  }

  private handleMessage(data: any, sourceConn?: DataConnection) {
    if (!data || !data.type) return;

    if (data.type === 'RELAY_PEER_JOINED') {
      // Someone new entered our LAN room — immediately introduce ourselves!
      this.sendRelayHandshake(false);
      return;
    }

    if (data.type === 'RELAY_PEER_LEFT' && data.payload?.id) {
      const leftId = data.payload.id as string;
      this.lastSeenMap.delete(leftId);
      if (this.remotePlayers.delete(leftId)) {
        this.callbacks?.onPlayerLeft(leftId);
        this.emitStatus();
      }
      return;
    }

    if (data.type === 'HANDSHAKE' || data.type === 'HANDSHAKE_REPLY') {
      const p = data.payload;
      if (!p || !p.id || p.id === this.localPlayerId) return;

      if (sourceConn) {
        this.peerToPlayerId.set(sourceConn.peer, p.id);
      }

      const existing = this.remotePlayers.get(p.id);
      const playerState: RemotePlayerState = {
        id: p.id,
        username: p.username || 'Racer',
        carId: p.carId || 'raptor',
        color: p.color || '#a855f7',
        position: existing?.position || p.position || [0, 0.42, 10],
        rotation: existing?.rotation || p.rotation || [0, 0, 0, 1],
        speedKmh: existing?.speedKmh ?? p.speedKmh ?? 0,
        isDrifting: existing?.isDrifting ?? false,
        isNitro: existing?.isNitro ?? false,
        ping: existing?.ping ?? 12
      };

      const isNew = !this.remotePlayers.has(p.id);
      this.remotePlayers.set(p.id, playerState);
      this.lastSeenMap.set(p.id, Date.now());
      this.callbacks?.onPlayerJoined(playerState);
      if (isNew) this.emitStatus();

      if (data.type === 'HANDSHAKE') {
        if (sourceConn) {
          this.sendHandshake(sourceConn, true);
          if (this.isHost) {
            const roster = Array.from(this.remotePlayers.values()).filter((pl) => pl.id !== p.id);
            if (roster.length > 0) {
              sourceConn.send({ type: 'ROSTER', payload: roster });
            }
            this.connections.forEach((c, peerId) => {
              if (peerId !== sourceConn.peer && c.open) {
                c.send({ type: 'HANDSHAKE', payload: p });
              }
            });
          }
        } else {
          this.sendRelayHandshake(true);
        }
      }
    } else if (data.type === 'ROSTER' && Array.isArray(data.payload)) {
      (data.payload as RemotePlayerState[]).forEach((player) => {
        if (!player || player.id === this.localPlayerId) return;
        this.remotePlayers.set(player.id, player);
        this.lastSeenMap.set(player.id, Date.now());
        this.callbacks?.onPlayerJoined(player);
      });
      this.emitStatus();
    } else if (data.type === 'STATE_UPDATE' && data.payload) {
      const update = data.payload as RemotePlayerState;
      if (!update.id || update.id === this.localPlayerId) return;

      const isNew = !this.remotePlayers.has(update.id);
      this.remotePlayers.set(update.id, update);
      this.lastSeenMap.set(update.id, Date.now());

      if (isNew) {
        this.callbacks?.onPlayerJoined(update);
        this.emitStatus();
      } else {
        this.callbacks?.onPlayerUpdate(update);
      }

      if (sourceConn && this.isHost) {
        this.connections.forEach((c, peerId) => {
          if (peerId !== sourceConn.peer && c.open) {
            c.send({ type: 'STATE_UPDATE', payload: update });
          }
        });
      }
    } else if (data.type === 'PLAYER_LEFT' && data.payload) {
      const leftId = data.payload as string;
      this.lastSeenMap.delete(leftId);
      if (this.remotePlayers.delete(leftId)) {
        this.callbacks?.onPlayerLeft(leftId);
        this.emitStatus();
      }
    }
  }

  private setupConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    if (conn.open) {
      this.p2pOpenCount++;
      this.sendHandshake(conn);
      this.emitStatus();
    }

    conn.on('open', () => {
      console.log('[Multiplayer] DataConnection open with:', conn.peer);
      this.p2pOpenCount++;
      this.sendHandshake(conn);
      this.emitStatus();
    });

    conn.on('data', (data: any) => {
      this.handleMessage(data, conn);
    });

    const handleClose = () => {
      if (this.connections.get(conn.peer) === conn) {
        this.connections.delete(conn.peer);
      }
      this.p2pOpenCount = Math.max(0, this.p2pOpenCount - 1);

      const mappedPlayerId = this.peerToPlayerId.get(conn.peer);
      this.peerToPlayerId.delete(conn.peer);

      const removePlayer = (id: string) => {
        if (!this.remotePlayers.has(id)) return;
        this.lastSeenMap.delete(id);
        this.remotePlayers.delete(id);
        this.callbacks?.onPlayerLeft(id);
        this.emitStatus();

        if (this.isHost) {
          this.connections.forEach((c) => {
            if (c.open) {
              c.send({ type: 'PLAYER_LEFT', payload: id });
            }
          });
        }
      };

      if (mappedPlayerId) {
        removePlayer(mappedPlayerId);
      } else {
        this.remotePlayers.forEach((_player, id) => {
          if (conn.peer.includes(id)) {
            removePlayer(id);
          }
        });
      }

      if (!this.isHost && !this.isDestroyed) {
        this.scheduleJoinRetry();
      }
    };

    conn.on('close', handleClose);
    conn.on('error', handleClose);
  }

  public updateLocalIdentity(carId: string, color: string, username?: string) {
    this.carId = carId;
    this.color = color;
    if (username) this.username = username;
    this.sendRelayHandshake(false);
    this.connections.forEach((c) => this.sendHandshake(c, false));
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
      ping: this.relayConnected ? 2 : 18
    };

    const msg = { type: 'STATE_UPDATE', payload: packet };

    if (this.relay?.isOpen()) {
      this.relay.send(msg);
    }

    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }

  public getOpponentsList(): RemotePlayerState[] {
    return Array.from(this.remotePlayers.values());
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.retryJoinTimer !== null) {
      clearTimeout(this.retryJoinTimer);
      this.retryJoinTimer = null;
    }
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.relay?.isOpen()) {
      this.relay.send({ type: 'PLAYER_LEFT', payload: this.localPlayerId });
    }
    this.relay?.close();
    this.relay = null;
    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.connections.clear();
    try {
      this.peer?.destroy();
    } catch {}
  }
}
