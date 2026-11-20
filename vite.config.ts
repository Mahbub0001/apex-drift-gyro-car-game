import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';

function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const wifiIps: string[] = [];
  const otherIps: string[] = [];

  for (const name of Object.keys(interfaces)) {
    // Skip virtual/WSL/VMware bridges
    if (/vethernet|wsl|vmware|virtualbox|hyper-v|loopback/i.test(name)) continue;

    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (/wi-?fi|wlan/i.test(name)) {
          wifiIps.unshift(iface.address); // Physical Wi-Fi always first!
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'lan-ip-service',
      configureServer(server) {
        server.middlewares.use('/api/lan-ip', (_req, res) => {
          const ips = getLanIps();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ primary: ips[0] || 'localhost', all: ips }));
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  },
  server: {
    host: true, // Listen on all local IPs so mobile phones can connect
    port: 5173
  }
});
