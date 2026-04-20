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

function getLocalIP(): string {
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
