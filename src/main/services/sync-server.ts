// src/main/services/sync-server.ts
// Temporary HTTP server for local network sync with mobile companion

import http from 'http';
import { networkInterfaces } from 'os';
import {
  importMobileTransactions,
  generateDesktopPayload,
  generateSetupPayload,
  type MobileSyncPayload,
} from './sync-service';

let server: http.Server | null = null;
const SYNC_PORT = 9876;
const SYNC_HOST = '0.0.0.0';

// Skip virtual/VPN/container interfaces; prefer physical WiFi/Ethernet (en*, eth*)
export function getLocalIP(): string {
  const nets = networkInterfaces();
  const preferred: string[] = [];
  const fallback: string[] = [];

  for (const [name, addrs] of Object.entries(nets)) {
    if (/^(utun|bridge|vmnet|docker|veth|virbr|tun|tap|lo)/.test(name)) continue;
    for (const net of addrs || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (/^(en|eth|wlan)/.test(name)) {
          preferred.push(net.address);
        } else {
          fallback.push(net.address);
        }
      }
    }
  }

  return preferred[0] ?? fallback[0] ?? '127.0.0.1';
}

export function createSyncServer(accountIds: number[] = []): Promise<{ url: string; port: number }> {
  if (server) {
    stopSyncServer();
  }

  let currentPort = SYNC_PORT;

  const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    // CORS headers for PWA access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // GET /setup — slim setup payload (accounts + categories, no balances)
    if (req.method === 'GET' && req.url === '/setup') {
      try {
        const payload = generateSetupPayload(accountIds);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
      return;
    }

    // GET /health — lightweight connectivity check for companion
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && req.url === '/sync') {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        // Limit body size to 1MB
        if (body.length > 1_048_576) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });

      req.on('end', () => {
        try {
          const payload: MobileSyncPayload = JSON.parse(body);

          if (payload.version !== 1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unsupported version' }));
            return;
          }

          const result = importMobileTransactions(payload);
          const syncedIds = payload.transactions.map(t => t.id);
          const responsePayload = generateDesktopPayload(syncedIds, accountIds);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responsePayload));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid sync payload' }));
        }
      });
      return;
    }

    // GET /sync — return reference data (legacy endpoint kept for compatibility)
    if (req.method === 'GET' && req.url === '/sync') {
      try {
        const payload = generateDesktopPayload([], accountIds);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
      return;
    }

    // GET / — landing page for when users scan the QR in their phone browser
    if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
      const ip = getLocalIP();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Polsa Sync</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#080b18;color:#e8e0f0;font-family:system-ui,-apple-system,sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:1.5rem}
    .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
          border-radius:1rem;padding:2rem;max-width:26rem;width:100%;text-align:center}
    h1{font-size:1.25rem;margin-bottom:.5rem}
    .accent{color:#7df9ff}
    p{font-size:.875rem;color:#b0aab8;margin:.75rem 0}
    .steps{text-align:left;margin:1.25rem 0;padding:0;list-style:none;counter-reset:step}
    .steps li{position:relative;padding:.5rem 0 .5rem 2.25rem;font-size:.8125rem;color:#d0cad8;counter-increment:step}
    .steps li::before{content:counter(step);position:absolute;left:0;top:.4rem;width:1.5rem;height:1.5rem;
      border-radius:50%;background:rgba(125,249,255,.15);color:#7df9ff;font-size:.75rem;font-weight:700;
      display:flex;align-items:center;justify-content:center}
    code{background:rgba(255,255,255,.08);padding:.15rem .4rem;border-radius:.25rem;font-size:.75rem;color:#7df9ff}
  </style>
</head>
<body>
  <div class="card">
    <h1>✓ <span class="accent">Polsa</span> Sync Server</h1>
    <p>This computer is ready to sync. Open the <strong>Polsa companion app</strong> on your phone to continue.</p>
    <ol class="steps">
      <li>Open the Polsa companion app on your phone</li>
      <li>Tap <strong>Sync</strong> → <strong>Local Network</strong></li>
      <li>Enter this URL:<br/><code>http://${ip}:${currentPort}</code></li>
      <li>Tap <strong>Connect &amp; Sync</strong></li>
    </ol>
  </div>
</body>
</html>`);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  };

  return new Promise((resolve, reject) => {
    const s = http.createServer(handler);
    const resolveWithAddress = () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : SYNC_PORT;
      server = s;
      resolve({ url: `http://${getLocalIP()}:${port}`, port });
    };

    s.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Sync server port ${SYNC_PORT} is already in use.`));
      } else {
        reject(err);
      }
    });

    s.listen(SYNC_PORT, SYNC_HOST, () => {
      resolveWithAddress();
    });
  });
}

export function stopSyncServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
