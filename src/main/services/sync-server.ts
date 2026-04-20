// src/main/services/sync-server.ts
// Temporary HTTP server for local network sync with mobile companion

import http from 'http';
import { networkInterfaces } from 'os';
import {
  importMobileTransactions,
  generateDesktopPayload,
  type MobileSyncPayload,
} from './sync-service';

let server: http.Server | null = null;
const SYNC_PORT = 9876;

export function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

export function createSyncServer(): { url: string; port: number } {
  if (server) {
    stopSyncServer();
  }

  server = http.createServer((req, res) => {
    // CORS headers for PWA access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/sync') {
      let body = '';
      req.on('data', chunk => {
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
          const responsePayload = generateDesktopPayload(syncedIds);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responsePayload));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid sync payload' }));
        }
      });
      return;
    }

    // GET /sync — return reference data (for initial sync without sending transactions)
    if (req.method === 'GET' && req.url === '/sync') {
      try {
        const payload = generateDesktopPayload([]);
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
      try {
        const payload = generateDesktopPayload([]);
        const json = JSON.stringify(payload);
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
    .data-box{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:.75rem;
      padding:.75rem;margin-top:1rem;text-align:left;max-height:12rem;overflow:auto}
    .data-box pre{font-size:.625rem;color:#8a8494;white-space:pre-wrap;word-break:break-all}
    button{background:linear-gradient(135deg,#7df9ff22,#b57affcc);border:1px solid #7df9ff44;
      color:#fff;font-size:.8125rem;font-weight:600;padding:.625rem 1.5rem;border-radius:.5rem;
      cursor:pointer;margin-top:1rem}
    button:active{transform:scale(.97)}
  </style>
</head>
<body>
  <div class="card">
    <h1>✓ <span class="accent">Polsa</span> Sync Server</h1>
    <p>This computer is ready to sync. Open the <strong>Polsa companion app</strong> on this phone to continue.</p>
    <ol class="steps">
      <li>Open the Polsa companion app on your phone</li>
      <li>Tap <strong>Sync</strong> → <strong>Local Network</strong></li>
      <li>Enter this URL:<br/><code>${`http://${getLocalIP()}:${SYNC_PORT}`}</code></li>
      <li>Tap <strong>Connect & Sync</strong></li>
    </ol>
    <p style="font-size:.75rem;color:#8a8494">If you haven't installed the companion app yet, check the <em>Mobile Sync</em> page in Polsa on your desktop for setup instructions.</p>
    <details>
      <summary style="font-size:.75rem;color:#7df9ff;cursor:pointer;margin-top:1rem">Preview sync data</summary>
      <div class="data-box"><pre>${json.replace(/</g, '&lt;')}</pre></div>
    </details>
  </div>
</body>
</html>`);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal error');
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(SYNC_PORT);

  const ip = getLocalIP();
  return { url: `http://${ip}:${SYNC_PORT}`, port: SYNC_PORT };
}

export function stopSyncServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
