import Peer, { DataConnection } from 'peerjs';
import { RemotePlayerState, RaceFinishEntry } from '../types';
import { openLocalRelaySocket, LocalRelayHandle } from '../utils/wsRelay';

const MP_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

export type MultiplayerStatus = 'connecting' | 'waiting' | 'connected' | 'error';

/**
 * Deterministic side-by-side starting grid positions across the 18.4m wide 4-lane highway
 * so players never spawn stacked on top of the exact same coordinate.
 */
export function getMultiplayerGridSlot(slotIndex: number): [number, number, number] {
  const laneOffsets = [-2.8, 2.8, -5.8, 5.8];
  const row = Math.floor(Math.max(0, slotIndex) / 4);
  const laneX = laneOffsets[Math.max(0, slotIndex) % 4];
  const posZ = 10 - row * 7.5;
  return [laneX, 0.64, posZ];
}

export interface MultiplayerCallbacks {
  onPlayerJoined: (player: RemotePlayerState) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerUpdate: (player: RemotePlayerState) => void;
  onRoomReady: () => void;
  onStatusChange?: (status: MultiplayerStatus, detail?: string) => void;
  onRaceConfig?: (targetLaps: number, raceEpoch: number, hasRaceStarted?: boolean) => void;
  onRaceStartCountdown?: (durationSec: number, targetLaps: number, raceEpoch: number) => void;
  onRaceFinishUpdate?: (results: RaceFinishEntry[]) => void;
  onRaceRestart?: (targetLaps: number, raceEpoch: number) => void;
}

export class MultiplayerRoomManager {
  public roomCode: string;
  public localPlayerId: string;
  public username: string;
  public carId: string;
  public color: string;
  public isHost: boolean = false;
  public hostPlayerId: string | null = null;
  public hasRaceStarted: boolean = false;
  public targetLaps: number = 1;
  public raceEpoch: number = 1;
  public raceResults: RaceFinishEntry[] = [];
  public localFinishedAtMs: number | null = null;
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
    color: string = '#00f2fe',
    targetLaps: number = 1
  ) {
    this.roomCode = roomCode.toUpperCase().trim() || 'APEX99';
    this.username = username;
    this.carId = carId;
    this.color = color;
    this.targetLaps = Math.max(1, Math.min(5, targetLaps));
    this.localPlayerId = `player-${Math.random().toString(36).slice(2, 7)}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  public init(isHost: boolean, callbacks: MultiplayerCallbacks) {
    this.isHost = isHost;
    if (isHost) this.hostPlayerId = this.localPlayerId;
    this.callbacks = callbacks;
    this.callbacks?.onStatusChange?.('connecting', isHost ? 'Starting room...' : `Joining ${this.roomCode}...`);

    // 1. Local LAN / Multi-Tab WebSocket Relay (2ms in local Vite dev; silently skipped on Vercel static deploy)
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

    // 2. Global PeerJS WebRTC Mesh/Relay (runs online across Vercel networks worldwide!)
    const peerId = this.isHost
      ? `apex-mp-host-${this.roomCode}`
      : `apex-mp-peer-${this.roomCode}-${this.localPlayerId}`;

    this.peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: MP_ICE_SERVERS,
        iceCandidatePoolSize: 8
      }
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
        this.callbacks?.onStatusChange?.('waiting', 'Connecting online via P2P...');
      }
    });

    // Periodic zombie cleanup & presence announce until racers sync cleanly
    this.heartbeatInterval = window.setInterval(() => {
      const now = Date.now();
      this.lastSeenMap.forEach((ts, playerId) => {
        if (now - ts > 12000) {
          this.lastSeenMap.delete(playerId);
          this.remotePlayers.delete(playerId);
          this.callbacks?.onPlayerLeft(playerId);
          this.emitStatus();
        }
      });

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
        `${this.remotePlayers.size + 1} racers online`
      );
    } else if (this.isHost && (this.relayConnected || this.peer?.open)) {
      this.callbacks?.onStatusChange?.(
        'waiting',
        `Room ${this.roomCode} (${this.targetLaps} Lap${this.targetLaps > 1 ? 's' : ''}) — waiting for friends`
      );
    } else if (!this.isHost && (this.p2pOpenCount > 0 || this.relayConnected)) {
      this.callbacks?.onStatusChange?.('waiting', `Joined ${this.roomCode} — syncing racers`);
    }
  }

  private connectToPeerHost() {
    if (this.isDestroyed || !this.peer || this.peer.destroyed || !this.peer.open) return;
    const hostPeerId = `apex-mp-host-${this.roomCode}`;
    const existing = this.connections.get(hostPeerId);
    if (existing?.open) return;
    if (existing) {
      try {
        existing.close();
      } catch {}
      this.connections.delete(hostPeerId);
    }

    try {
      const conn = this.peer.connect(hostPeerId, { reliable: true, serialization: 'json' });
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
    }, 2200);
  }

  public getLocalGridPosition(): [number, number, number] {
    if (this.isHost) {
      return getMultiplayerGridSlot(0);
    }
    const nonHostIds = [
      this.localPlayerId,
      ...Array.from(this.remotePlayers.keys()).filter((id) => id !== this.hostPlayerId)
    ].sort();
    const slotIdx = Math.max(1, nonHostIds.indexOf(this.localPlayerId) + 1);
    return getMultiplayerGridSlot(slotIdx);
  }

  private buildHandshakePayload() {
    return {
      id: this.localPlayerId,
      username: this.username,
      carId: this.carId,
      color: this.color,
      isHost: this.isHost,
      position: this.getLocalGridPosition(),
      targetLaps: this.isHost ? this.targetLaps : undefined,
      raceEpoch: this.isHost ? this.raceEpoch : undefined,
      hasRaceStarted: this.isHost ? this.hasRaceStarted : undefined,
      raceResults: this.isHost ? this.raceResults : undefined,
      finishedAtMs: this.localFinishedAtMs
    };
  }

  private sendAll(msg: any) {
    if (this.relay?.isOpen()) {
      this.relay.send(msg);
    }
    this.connections.forEach((c) => {
      if (c.open) {
        c.send(msg);
      }
    });
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

  private recordFinishEntry(entry: Omit<RaceFinishEntry, 'rank'>, epoch?: number) {
    if (typeof epoch === 'number' && epoch !== this.raceEpoch) return false;

    const alreadyIdx = this.raceResults.findIndex((r) => r.id === entry.id);
    if (alreadyIdx >= 0) return false;

    const merged = [...this.raceResults, { ...entry, rank: 0 }];
    merged.sort((a, b) => a.finishTimeMs - b.finishTimeMs);
    this.raceResults = merged.map((r, idx) => ({ ...r, rank: idx + 1 }));
    this.callbacks?.onRaceFinishUpdate?.([...this.raceResults]);
    return true;
  }

  public reportLocalFinish(finishTimeMs: number) {
    if (this.localFinishedAtMs !== null) return;
    const rounded = Math.max(100, Math.round(finishTimeMs));
    this.localFinishedAtMs = rounded;

    const finishEntry = {
      id: this.localPlayerId,
      username: this.username,
      carId: this.carId,
      color: this.color,
      finishTimeMs: rounded
    };

    this.recordFinishEntry(finishEntry, this.raceEpoch);

    const msg = {
      type: 'PLAYER_FINISHED',
      payload: { ...finishEntry, raceEpoch: this.raceEpoch }
    };
    this.sendAll(msg);

    if (this.isHost) {
      this.sendAll({
        type: 'RACE_RESULTS',
        payload: { raceEpoch: this.raceEpoch, results: this.raceResults }
      });
    }
  }

  public startRaceWithCountdown(durationSec: number = 10) {
    this.raceEpoch += 1;
    this.hasRaceStarted = true;
    this.raceResults = [];
    this.localFinishedAtMs = null;

    this.remotePlayers.forEach((p, id) => {
      this.remotePlayers.set(id, { ...p, lap: 1, trackProgress: 0, finishedAtMs: null });
    });

    const msg = {
      type: 'RACE_START_COUNTDOWN',
      payload: {
        durationSec,
        targetLaps: this.targetLaps,
        raceEpoch: this.raceEpoch
      }
    };
    this.sendAll(msg);
    this.callbacks?.onRaceFinishUpdate?.([]);
    this.callbacks?.onRaceStartCountdown?.(durationSec, this.targetLaps, this.raceEpoch);
    this.emitStatus();
  }

  public requestRaceRestart(newTargetLaps?: number) {
    if (typeof newTargetLaps === 'number') {
      this.targetLaps = Math.max(1, Math.min(5, newTargetLaps));
    }
    this.raceEpoch += 1;
    this.hasRaceStarted = true;
    this.raceResults = [];
    this.localFinishedAtMs = null;

    this.remotePlayers.forEach((p, id) => {
      this.remotePlayers.set(id, { ...p, lap: 1, trackProgress: 0, finishedAtMs: null });
    });

    const msg = {
      type: 'RACE_RESTART',
      payload: { targetLaps: this.targetLaps, raceEpoch: this.raceEpoch, durationSec: 10 }
    };
    this.sendAll(msg);
    this.callbacks?.onRaceFinishUpdate?.([]);
    this.callbacks?.onRaceRestart?.(this.targetLaps, this.raceEpoch);
    this.emitStatus();
  }

  private handleMessage(data: any, sourceConn?: DataConnection) {
    if (!data || !data.type) return;

    if (data.type === 'RELAY_PEER_JOINED') {
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

      if (p.isHost) {
        this.hostPlayerId = p.id;
      }

      // Sync targetLaps, epoch & started status from Host cleanly when joining
      if (!this.isHost && typeof p.targetLaps === 'number') {
        this.targetLaps = p.targetLaps;
        if (typeof p.raceEpoch === 'number') {
          this.raceEpoch = Math.max(this.raceEpoch, p.raceEpoch);
        }
        if (typeof p.hasRaceStarted === 'boolean') {
          this.hasRaceStarted = p.hasRaceStarted;
        }
        this.callbacks?.onRaceConfig?.(this.targetLaps, this.raceEpoch, this.hasRaceStarted);
        if (Array.isArray(p.raceResults) && p.raceResults.length > 0) {
          p.raceResults.forEach((r: RaceFinishEntry) => this.recordFinishEntry(r, this.raceEpoch));
        }
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
        ping: existing?.ping ?? 18,
        lap: existing?.lap ?? 1,
        trackProgress: existing?.trackProgress ?? 0,
        finishedAtMs: p.finishedAtMs ?? existing?.finishedAtMs ?? null
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
            if (this.raceResults.length > 0) {
              sourceConn.send({
                type: 'RACE_RESULTS',
                payload: { raceEpoch: this.raceEpoch, results: this.raceResults }
              });
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
    } else if (data.type === 'PLAYER_FINISHED' && data.payload) {
      const f = data.payload;
      if (!f || !f.id) return;
      const changed = this.recordFinishEntry(
        {
          id: f.id,
          username: f.username || 'Racer',
          carId: f.carId || 'raptor',
          color: f.color || '#a855f7',
          finishTimeMs: Number(f.finishTimeMs) || 1000
        },
        f.raceEpoch
      );
      if (this.isHost && changed) {
        const canonical = {
          type: 'RACE_RESULTS',
          payload: { raceEpoch: this.raceEpoch, results: this.raceResults }
        };
        this.connections.forEach((c) => {
          if (c.open) c.send(canonical);
        });
        if (this.relay?.isOpen()) {
          this.relay.send(canonical);
        }
      }
    } else if (data.type === 'RACE_RESULTS' && data.payload?.results) {
      if (typeof data.payload.raceEpoch === 'number' && data.payload.raceEpoch !== this.raceEpoch) return;
      (data.payload.results as RaceFinishEntry[]).forEach((r) =>
        this.recordFinishEntry(r, this.raceEpoch)
      );
    } else if (data.type === 'RACE_START_COUNTDOWN' && data.payload) {
      const nextEpoch = Number(data.payload.raceEpoch) || this.raceEpoch + 1;
      if (nextEpoch <= this.raceEpoch) return;
      this.raceEpoch = nextEpoch;
      this.hasRaceStarted = true;
      if (typeof data.payload.targetLaps === 'number') {
        this.targetLaps = data.payload.targetLaps;
      }
      const durationSec = Number(data.payload.durationSec) || 10;
      this.raceResults = [];
      this.localFinishedAtMs = null;
      this.remotePlayers.forEach((p, id) => {
        this.remotePlayers.set(id, { ...p, lap: 1, trackProgress: 0, finishedAtMs: null });
      });
      this.callbacks?.onRaceFinishUpdate?.([]);
      this.callbacks?.onRaceStartCountdown?.(durationSec, this.targetLaps, this.raceEpoch);
      this.emitStatus();
      if (sourceConn && this.isHost) {
        this.connections.forEach((c, peerId) => {
          if (peerId !== sourceConn.peer && c.open) c.send(data);
        });
      }
    } else if (data.type === 'RACE_RESTART' && data.payload) {
      const nextEpoch = Number(data.payload.raceEpoch) || this.raceEpoch + 1;
      if (nextEpoch <= this.raceEpoch) return;
      this.raceEpoch = nextEpoch;
      if (typeof data.payload.targetLaps === 'number') {
        this.targetLaps = data.payload.targetLaps;
      }
      this.raceResults = [];
      this.localFinishedAtMs = null;
      this.remotePlayers.forEach((p, id) => {
        this.remotePlayers.set(id, { ...p, lap: 1, trackProgress: 0, finishedAtMs: null });
      });
      this.callbacks?.onRaceFinishUpdate?.([]);
      this.callbacks?.onRaceRestart?.(this.targetLaps, this.raceEpoch);
      this.emitStatus();
      if (sourceConn && this.isHost) {
        this.connections.forEach((c, peerId) => {
          if (peerId !== sourceConn.peer && c.open) {
            c.send(data);
          }
        });
      }
    } else if (data.type === 'STATE_UPDATE' && data.payload) {
      const update = data.payload as RemotePlayerState;
      if (!update.id || update.id === this.localPlayerId) return;

      const isNew = !this.remotePlayers.has(update.id);
      this.remotePlayers.set(update.id, update);
      this.lastSeenMap.set(update.id, Date.now());

      // Backup trigger: if a peer finished before finish packet arrived, record immediately!
      if (typeof update.finishedAtMs === 'number' && update.finishedAtMs > 0) {
        this.recordFinishEntry(
          {
            id: update.id,
            username: update.username || 'Racer',
            carId: update.carId || 'raptor',
            color: update.color || '#a855f7',
            finishTimeMs: update.finishedAtMs
          },
          this.raceEpoch
        );
      }

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
    const prev = this.connections.get(conn.peer);
    if (prev && prev !== conn) {
      try {
        prev.close();
      } catch {}
    }
    this.connections.set(conn.peer, conn);

    // Watchdog prevents silent WebRTC DataChannel stalls when joining across NAT/timing races
    const openWatchdog = window.setTimeout(() => {
      if (!conn.open && this.connections.get(conn.peer) === conn && !this.isDestroyed) {
        console.warn('[Multiplayer] Stalled DataConnection reset for:', conn.peer);
        try {
          conn.close();
        } catch {}
        this.connections.delete(conn.peer);
        if (!this.isHost) {
          this.scheduleJoinRetry();
        }
      }
    }, 4500);

    if (conn.open) {
      clearTimeout(openWatchdog);
      this.p2pOpenCount++;
      this.sendHandshake(conn);
      this.emitStatus();
    }

    conn.on('open', () => {
      clearTimeout(openWatchdog);
      if (this.connections.get(conn.peer) !== conn) return;
      console.log('[Multiplayer] DataConnection open with:', conn.peer);
      this.p2pOpenCount++;
      this.sendHandshake(conn);
      this.emitStatus();
    });

    conn.on('data', (data: any) => {
      this.handleMessage(data, conn);
    });

    const handleClose = () => {
      clearTimeout(openWatchdog);
      if (this.connections.get(conn.peer) !== conn) return;
      this.connections.delete(conn.peer);
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

  // Broadcast local car position + race progress to all opponents (20 Hz snapshot)
  public broadcastLocalState(state: {
    position: [number, number, number];
    rotation: [number, number, number, number];
    speedKmh: number;
    isDrifting: boolean;
    isNitro: boolean;
    lap: number;
    trackProgress: number;
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
      ping: this.relayConnected ? 2 : 18,
      lap: state.lap,
      trackProgress: state.trackProgress,
      finishedAtMs: this.localFinishedAtMs
    };

    this.sendAll({ type: 'STATE_UPDATE', payload: packet });
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
