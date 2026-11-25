import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Duplex } from 'stream';

function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const wifiIps: string[] = [];
  const otherIps: string[] = [];

  for (const name of Object.keys(interfaces)) {
    if (/vethernet|wsl|vmware|virtualbox|hyper-v|loopback/i.test(name)) continue;

    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (/wi-?fi|wlan/i.test(name)) {
          wifiIps.unshift(iface.address);
        } else if (iface.address.startsWith('192.168.') && !iface.address.startsWith('192.168.56.')) {
          wifiIps.push(iface.address);
        } else {
          otherIps.push(iface.address);
        }
      }
    }
  }
  return [...wifiIps, ...otherIps];
}

function findOpenSslBinary(): string | null {
  const candidates = [
    'openssl',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'
  ];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['version'], { stdio: 'ignore' });
      return bin;
    } catch {
      // Try next candidate
    }
  }
  return null;
}

function ensureDevHttpsCreds(lanIps: string[]): { key: Buffer; cert: Buffer } | null {
  try {
    const cacheDir = path.resolve(process.cwd(), 'node_modules/.cache/apex-ssl');
    const keyPath = path.join(cacheDir, 'key.pem');
    const certPath = path.join(cacheDir, 'cert.pem');
    const sanTagPath = path.join(cacheDir, 'sans.txt');
    const cnfPath = path.join(cacheDir, 'openssl.cnf');

    const uniqueIps = Array.from(new Set(['127.0.0.1', ...lanIps]));
    const sanSignature = uniqueIps.join(',');

    if (
      fs.existsSync(keyPath) &&
      fs.existsSync(certPath) &&
      fs.existsSync(sanTagPath) &&
      fs.readFileSync(sanTagPath, 'utf8').trim() === sanSignature
    ) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
    }

    const opensslBin = findOpenSslBinary();
    if (!opensslBin) return null;

    fs.mkdirSync(cacheDir, { recursive: true });

    const altLines = ['DNS.1 = localhost', ...uniqueIps.map((ip, i) => `IP.${i + 1} = ${ip}`)];
    const cnfContent = `[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
CN = ApexDriftLAN

[v3_req]
subjectAltName = @alt_names

[alt_names]
${altLines.join('\n')}
`;
    fs.writeFileSync(cnfPath, cnfContent, 'utf8');

    execFileSync(
      opensslBin,
      [
        'req',
        '-x509',
        '-nodes',
        '-days',
        '365',
        '-newkey',
        'rsa:2048',
        '-keyout',
        keyPath,
        '-out',
        certPath,
        '-config',
        cnfPath,
        '-extensions',
        'v3_req'
      ],
      { stdio: 'ignore' }
    );
    fs.writeFileSync(sanTagPath, sanSignature, 'utf8');

    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  } catch (err) {
    console.warn('[ApexDev] Could not generate local HTTPS cert:', err);
    return null;
  }
}

interface RelayClient {
  id: string;
  role: string;
  roomKey: string;
  socket: Duplex;
  send: (data: any) => void;
}

const relayRooms = new Map<string, Set<RelayClient>>();

function encodeWsFrame(opcode: number, payload: Buffer): Buffer {
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function attachApexRelayUpgrade(httpLikeServer: HttpServer | https.Server) {
  httpLikeServer.on('upgrade', (req: IncomingMessage, socket: Duplex) => {
    const reqUrl = req.url || '';
    if (!reqUrl.startsWith('/ws-apex')) return;

    const wsKey = req.headers['sec-websocket-key'];
    if (!wsKey || Array.isArray(wsKey)) {
      socket.destroy();
      return;
    }

    const accept = crypto
      .createHash('sha1')
      .update(wsKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '\r\n'
      ].join('\r\n')
    );

    if ('setNoDelay' in socket && typeof (socket as any).setNoDelay === 'function') {
      (socket as any).setNoDelay(true);
    }

    const parsed = new URL(reqUrl, 'http://localhost');
    const channel = (parsed.searchParams.get('channel') || 'mp').toLowerCase();
    const room = (parsed.searchParams.get('room') || 'DEFAULT').toUpperCase();
    const role = parsed.searchParams.get('role') || 'client';
    const id = parsed.searchParams.get('id') || `${role}-${Math.random().toString(36).slice(2, 8)}`;
    const roomKey = `${channel}:${room}`;

    let closed = false;
    const send = (obj: any) => {
      if (closed || socket.destroyed || !socket.writable) return;
      try {
        const payload = Buffer.from(JSON.stringify(obj), 'utf8');
        socket.write(encodeWsFrame(0x1, payload));
      } catch {
        // Ignore broken pipe
      }
    };

    const client: RelayClient = { id, role, roomKey, socket, send };

    let set = relayRooms.get(roomKey);
    if (!set) {
      set = new Set();
      relayRooms.set(roomKey, set);
    }

    // Evict stale duplicate connection with same peer id
    for (const existing of set) {
      if (existing.id === id) {
        set.delete(existing);
        try {
          existing.socket.destroy();
        } catch {}
      }
    }

    const currentPeers = Array.from(set).map((c) => ({ id: c.id, role: c.role }));
    set.add(client);

    send({ type: 'RELAY_PEERS', payload: currentPeers });
    for (const other of set) {
      if (other !== client) {
        other.send({ type: 'RELAY_PEER_JOINED', payload: { id: client.id, role: client.role } });
      }
    }

    const cleanup = () => {
      if (closed) return;
      closed = true;
      const roomSet = relayRooms.get(roomKey);
      if (roomSet) {
        roomSet.delete(client);
        for (const other of roomSet) {
          other.send({ type: 'RELAY_PEER_LEFT', payload: { id: client.id, role: client.role } });
        }
        if (roomSet.size === 0) {
          relayRooms.delete(roomKey);
        }
      }
    };

    let rxBuffer = Buffer.alloc(0);
    let fragChunks: Buffer[] = [];

    socket.on('data', (chunk: Buffer) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);

      while (rxBuffer.length >= 2) {
        const b0 = rxBuffer[0];
        const b1 = rxBuffer[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (rxBuffer.length < 4) return;
          payloadLen = rxBuffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (rxBuffer.length < 10) return;
          payloadLen = Number(rxBuffer.readBigUInt64BE(2));
          offset = 10;
        }

        const maskLen = masked ? 4 : 0;
        if (rxBuffer.length < offset + maskLen + payloadLen) return;

        let payload = rxBuffer.subarray(offset + maskLen, offset + maskLen + payloadLen);
        if (masked) {
          const mask = rxBuffer.subarray(offset, offset + 4);
          const unmasked = Buffer.allocUnsafe(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            unmasked[i] = payload[i] ^ mask[i & 3];
          }
          payload = unmasked;
        }

        rxBuffer = rxBuffer.subarray(offset + maskLen + payloadLen);

        if (opcode === 0x8) {
          try {
            socket.write(encodeWsFrame(0x8, Buffer.alloc(0)));
          } catch {}
          socket.end();
          cleanup();
          return;
        } else if (opcode === 0x9) {
          try {
            socket.write(encodeWsFrame(0xa, payload));
          } catch {}
          continue;
        } else if (opcode === 0xa) {
          continue;
        }

        if (opcode === 0x1 || opcode === 0x0) {
          fragChunks.push(payload);
          if (fin) {
            const fullText = Buffer.concat(fragChunks).toString('utf8');
            fragChunks = [];
            try {
              const msg = JSON.parse(fullText);
              const roomSet = relayRooms.get(roomKey);
              if (roomSet) {
                for (const other of roomSet) {
                  if (other !== client) {
                    other.send(msg);
                  }
                }
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }
    });

    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'apex-lan-https-and-relay',
      configureServer(server) {
        let activeHttpsPort: number | null = null;
        let httpsServer: https.Server | null = null;

        server.middlewares.use('/api/lan-ip', (_req, res) => {
          const ips = getLanIps();
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              primary: ips[0] || 'localhost',
              all: ips,
              httpsPort: activeHttpsPort,
              httpPort: server.config.server.port || 5173
            })
          );
        });

        if (server.httpServer) {
          attachApexRelayUpgrade(server.httpServer as HttpServer);

          const ips = getLanIps();
          const creds = ensureDevHttpsCreds(ips);
          const candidateHttpsPort = (server.config.server.port || 5173) + 1;

          if (creds) {
            httpsServer = https.createServer(creds, server.middlewares as any);
            attachApexRelayUpgrade(httpsServer);

            httpsServer.on('error', (err: any) => {
              if (err?.code === 'EADDRINUSE') {
                activeHttpsPort = candidateHttpsPort;
              } else {
                console.warn('[ApexDev] Companion HTTPS server error:', err?.message || err);
              }
            });

            httpsServer.listen(candidateHttpsPort, '0.0.0.0', () => {
              activeHttpsPort = candidateHttpsPort;
              const primaryIp = ips[0] || 'localhost';
              console.log(
                `[ApexDev] Mobile HTTPS Gyro & LAN Relay ready on https://${primaryIp}:${candidateHttpsPort}`
              );
            });
          }

          server.httpServer.on('close', () => {
            httpsServer?.close();
          });
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  },
  server: {
    host: true,
    port: 5173
  }
});
