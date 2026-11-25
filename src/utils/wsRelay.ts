export interface LanInfo {
  primary: string;
  all: string[];
  httpsPort?: number | null;
  httpPort?: number | null;
}

let lanInfoPromise: Promise<LanInfo | null> | null = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeUtf8(str: string): Uint8Array {
  const bytes = textEncoder.encode(str);
  const len = bytes.length;
  const out = new Uint8Array(2 + len);
  out[0] = (len >> 8) & 0xff;
  out[1] = len & 0xff;
  out.set(bytes, 2);
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function makeConnectPacket(clientId: string): Uint8Array {
  const protoName = encodeUtf8('MQTT');
  const protoLevel = new Uint8Array([4]); // MQTT 3.1.1
  const flags = new Uint8Array([2]); // Clean session
  const keepAlive = new Uint8Array([0, 45]); // 45s keep-alive
  const payload = encodeUtf8(clientId);
  const body = concatBytes(protoName, protoLevel, flags, keepAlive, payload);
  return concatBytes(new Uint8Array([0x10, body.length]), body);
}

function makeSubscribePacket(packetId: number, topic: string): Uint8Array {
  const pId = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
  const t = encodeUtf8(topic);
  const qos = new Uint8Array([0]);
  const body = concatBytes(pId, t, qos);
  return concatBytes(new Uint8Array([0x82, body.length]), body);
}

function makePublishPacket(topic: string, payloadStr: string): Uint8Array {
  const t = encodeUtf8(topic);
  const p = textEncoder.encode(payloadStr);
  const body = concatBytes(t, p);
  let len = body.length;
  const lenBytes: number[] = [];
  do {
    let digit = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) digit |= 0x80;
    lenBytes.push(digit);
  } while (len > 0);
  return concatBytes(new Uint8Array([0x30, ...lenBytes]), body);
}

function parseMqttPacket(data: ArrayBuffer | Uint8Array): { type: string; topic?: string; message?: string } | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 2) return null;
  const packetType = bytes[0] >> 4;
  if (packetType === 3) { // PUBLISH
    let idx = 1;
    let multiplier = 1;
    let remLen = 0;
    let byte: number;
    do {
      byte = bytes[idx++];
      remLen += (byte & 0x7f) * multiplier;
      multiplier *= 128;
    } while ((byte & 0x80) !== 0 && idx < bytes.length);

    if (idx + 2 > bytes.length) return null;
    const topicLen = (bytes[idx] << 8) | bytes[idx + 1];
    idx += 2;
    if (idx + topicLen > bytes.length) return null;
    const topic = textDecoder.decode(bytes.subarray(idx, idx + topicLen));
    idx += topicLen;
    const message = textDecoder.decode(bytes.subarray(idx));
    return { type: 'PUBLISH', topic, message };
  }
  return {
    type: packetType === 2 ? 'CONNACK' : packetType === 9 ? 'SUBACK' : packetType === 13 ? 'PINGRESP' : 'OTHER'
  };
}

/**
 * Probes whether the app is running against the Vite dev backend that provides
 * `/api/lan-ip` and `/ws-apex` LAN WebSocket relay. Returns null cleanly on
 * external static hosting (Vercel, etc.) so Cloud WSS Relay takes over seamlessly.
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

/**
 * Universal dual-path WebSocket relay:
 * - Uses LAN WebSocket (/ws-apex) when running on local Vite dev server
 * - Automatically falls back to high-speed public Cloud WSS MQTT broker when on Vercel/online
 */
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
  let pingTimer: number | null = null;
  let isCloudRelay = false;
  let cloudSubscribed = false;

  const cleanRoom = opts.room.toUpperCase().trim() || 'APEX99';
  const cloudTopic = `apex-drift/${opts.channel}/${cleanRoom}`;

  const connect = async () => {
    if (closedByCaller) return;
    const info = await getLanRelayCapabilities();
    if (closedByCaller) return;

    if (info) {
      // 1. Local Vite dev backend LAN WebSocket
      isCloudRelay = false;
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = new URLSearchParams({
        channel: opts.channel,
        room: cleanRoom,
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
          } catch {}
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
    } else {
      // 2. Production Vercel / Cloud Static Deployment — Global Cloud WSS Relay!
      isCloudRelay = true;
      cloudSubscribed = false;
      const clientId = `apex-${opts.role}-${Math.random().toString(36).slice(2, 7)}`;
      const cloudUrl = 'wss://broker.emqx.io:8084/mqtt';

      try {
        const socket = new WebSocket(cloudUrl, 'mqtt');
        socket.binaryType = 'arraybuffer';
        ws = socket;

        socket.onopen = () => {
          if (closedByCaller || ws !== socket) return;
          socket.send(makeConnectPacket(clientId));
        };

        socket.onmessage = (ev) => {
          if (closedByCaller || ws !== socket) return;
          const packet = parseMqttPacket(ev.data);
          if (!packet) return;

          if (packet.type === 'CONNACK') {
            socket.send(makeSubscribePacket(1, cloudTopic));
            if (pingTimer !== null) clearInterval(pingTimer);
            pingTimer = window.setInterval(() => {
              if (ws === socket && socket.readyState === WebSocket.OPEN) {
                socket.send(new Uint8Array([0xc0, 0x00])); // MQTT PINGREQ
              }
            }, 25000);
          } else if (packet.type === 'SUBACK') {
            cloudSubscribed = true;
            opts.onOpen?.();
          } else if (packet.type === 'PUBLISH' && packet.message) {
            try {
              const parsed = JSON.parse(packet.message);
              // Ignore echoed messages published by our own ID
              if (parsed._senderId === opts.id || (parsed.payload && parsed.payload.id === opts.id)) {
                return;
              }
              opts.onMessage(parsed);
            } catch {}
          }
        };

        socket.onclose = () => {
          cloudSubscribed = false;
          if (pingTimer !== null) {
            clearInterval(pingTimer);
            pingTimer = null;
          }
          if (ws === socket) ws = null;
          if (closedByCaller) return;
          opts.onClose?.();
          reconnectTimer = window.setTimeout(connect, 2000);
        };

        socket.onerror = () => {
          try {
            socket.close();
          } catch {}
        };
      } catch {
        if (!closedByCaller) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      }
    }
  };

  connect();

  return {
    send: (msg: any) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        if (isCloudRelay) {
          if (!cloudSubscribed) return false;
          const envelope = { ...msg, _senderId: opts.id };
          ws.send(makePublishPacket(cloudTopic, JSON.stringify(envelope)));
          return true;
        } else {
          ws.send(JSON.stringify(msg));
          return true;
        }
      } catch {
        return false;
      }
    },
    isOpen: () => !!(ws && ws.readyState === WebSocket.OPEN && (!isCloudRelay || cloudSubscribed)),
    close: () => {
      closedByCaller = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (pingTimer !== null) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      try {
        ws?.close();
      } catch {}
      ws = null;
    }
  };
}
