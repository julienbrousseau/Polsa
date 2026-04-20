// src/main/services/companion-server.ts
// Serves the built companion PWA on the local network, only while Mobile Sync is open

import http from 'http';
import fs from 'fs';
import path from 'path';
import { getLocalIP } from './sync-server';

let server: http.Server | null = null;
const COMPANION_PORT = 5174;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getCompanionDistPath(): string {
  // In dev: companion/dist relative to project root
  // In production: resources/companion alongside the asar
  const devPath = path.join(__dirname, '..', '..', '..', 'companion', 'dist');
  if (fs.existsSync(devPath)) return devPath;

  const prodPath = path.join(process.resourcesPath || '', 'companion');
  if (fs.existsSync(prodPath)) return prodPath;

  return devPath; // fallback — will error at serve time
}

export function startCompanionServer(): Promise<{ url: string; port: number } | null> {
  if (server) return Promise.resolve({ url: `http://${getLocalIP()}:${COMPANION_PORT}`, port: COMPANION_PORT });

  const distPath = getCompanionDistPath();
  if (!fs.existsSync(path.join(distPath, 'index.html'))) {
    return Promise.resolve(null); // companion not built
  }

  const s = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    let filePath = path.join(distPath, urlPath === '/' ? 'index.html' : urlPath);

    // Prevent directory traversal
    if (!filePath.startsWith(distPath)) {
      res.writeHead(403);
      res.end();
      return;
    }

    // Try to serve the file; if not found, serve index.html (SPA fallback)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });

  return new Promise((resolve, reject) => {
    s.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port already in use — assume companion is already accessible
        const ip = getLocalIP();
        resolve({ url: `http://${ip}:${COMPANION_PORT}`, port: COMPANION_PORT });
      } else {
        reject(err);
      }
    });

    s.listen(COMPANION_PORT, () => {
      server = s;
      const ip = getLocalIP();
      resolve({ url: `http://${ip}:${COMPANION_PORT}`, port: COMPANION_PORT });
    });
  });
}

export function stopCompanionServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
