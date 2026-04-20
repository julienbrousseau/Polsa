import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';

type SyncMode = 'menu' | 'scan' | 'server' | 'result';

declare global {
  interface Window {
    polsa: any;
  }
}

/** Renders a QR code onto a <canvas> element */
function QrCanvas({ data, size = 256 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    QRCode.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 2,
      color: { dark: '#e8e0f0', light: '#080b18' },
      errorCorrectionLevel: 'L',
    }).catch(() => {
      // If data too large for QR, clear the canvas
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#e8e0f0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Data too large for QR', size / 2, size / 2);
      }
    });
  }, [data, size]);

  return <canvas ref={canvasRef} className="mx-auto" />;
}

export default function MobileSync() {
  const [mode, setMode] = useState<SyncMode>('menu');
  const [qrData, setQrData] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [serverInfo, setServerInfo] = useState<{ url: string; port: number } | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [companionUrl, setCompanionUrl] = useState('');
  const [companionError, setCompanionError] = useState('');

  // Start companion server on mount, stop on unmount
  useEffect(() => {
    let mounted = true;
    window.polsa.sync.startCompanion().then((info: { url: string; port: number } | null) => {
      if (!mounted) return;
      if (info) {
        setCompanionUrl(info.url);
      } else {
        setCompanionError('Companion app not built. Run "npm run build" in the companion/ folder first.');
      }
    }).catch(() => {
      if (mounted) setCompanionError('Failed to start companion server');
    });

    return () => {
      mounted = false;
      window.polsa.sync.stopCompanion();
    };
  }, []);

  // Generate QR with desktop reference data for mobile to scan
  const handleShowRefData = async () => {
    try {
      const payload = await window.polsa.sync.generatePayload();
      setQrData(JSON.stringify(payload));
      setMode('scan');
    } catch (err) {
      setResultMessage('Failed to generate sync data');
      setMode('result');
    }
  };

  // Process pasted mobile QR payload
  const handleImport = async () => {
    try {
      const payload = JSON.parse(scanInput);
      const result = await window.polsa.sync.importMobile(payload);

      // Generate confirmation payload with synced IDs
      const syncedIds = payload.transactions?.map((t: any) => t.id) ?? [];
      const confirmPayload = await window.polsa.sync.generatePayload();
      confirmPayload.syncedIds = syncedIds;
      setQrData(JSON.stringify(confirmPayload));

      setResultMessage(
        `Imported ${result.imported} transaction${result.imported !== 1 ? 's' : ''}` +
        (result.duplicates > 0 ? ` (${result.duplicates} duplicate${result.duplicates !== 1 ? 's' : ''} skipped)` : '') +
        '. Show the confirmation QR to your phone.'
      );
      setMode('result');
    } catch {
      setResultMessage('Invalid mobile sync data. Please check and try again.');
    }
  };

  // Start local network server
  const handleStartServer = async () => {
    try {
      const info = await window.polsa.sync.startServer();
      setServerInfo(info);
      setServerUrl(info.url);
      setMode('server');
    } catch {
      setResultMessage('Failed to start sync server');
      setMode('result');
    }
  };

  const handleStopServer = async () => {
    await window.polsa.sync.stopServer();
    setServerInfo(null);
    setMode('menu');
  };

  // Clean up server on unmount
  useEffect(() => {
    return () => {
      if (serverInfo) {
        window.polsa.sync.stopServer();
      }
    };
  }, [serverInfo]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-6 space-y-6">
      <h1 className="text-xl font-bold text-[var(--color-text-primary)] neon-text-subtle">
        Mobile Sync
      </h1>

      {mode === 'menu' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Sync transactions between your phone and desktop
          </p>

          {/* Install companion app */}
          <details className="glass-card rounded-xl overflow-hidden" open={!!companionUrl}>
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-[var(--color-accent-light)] hover:bg-[var(--color-bg-surface-hover)] transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Install the companion app on your phone
            </summary>
            <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border)]">
              {companionUrl && (
                <div className="pt-4 text-center space-y-2">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Scan this QR code on your phone to open the companion app:
                  </p>
                  <QrCanvas data={companionUrl} size={200} />
                  <p className="text-xs font-mono text-[var(--color-accent-light)]">{companionUrl}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    Your phone must be on the same WiFi network. The server is active while this page is open.
                  </p>
                </div>
              )}
              {companionError && (
                <div className="pt-4 text-center">
                  <p className="text-xs text-[var(--color-negative)]">{companionError}</p>
                  <pre className="mt-2 bg-[var(--color-bg-surface)] rounded-lg p-2.5 font-mono text-xs text-[var(--color-accent-light)] overflow-x-auto">cd companion{'\n'}npm run build</pre>
                </div>
              )}
              <div className="pt-2 space-y-3 text-xs text-[var(--color-text-secondary)]">
                <div className="space-y-2">
                  <p className="font-semibold text-[var(--color-text-primary)]">Install as an app</p>
                  <p>After scanning the QR, install it as a home-screen app:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li><strong>iPhone (Safari):</strong> Tap the Share button → <em>Add to Home Screen</em></li>
                    <li><strong>Android (Chrome):</strong> Tap the menu (⋮) → <em>Install app</em> or <em>Add to Home Screen</em></li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-[var(--color-text-primary)]">First sync</p>
                  <p>Use <strong>Network Sync</strong> below to send your accounts and categories to the phone, then you can add transactions on the go.</p>
                </div>
              </div>
            </div>
          </details>

          {/* Import from mobile QR */}
          <button
            onClick={() => setMode('scan')}
            className="glass-card w-full rounded-xl p-4 text-left hover:bg-[var(--color-bg-surface-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-accent-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Import from Mobile</p>
                <p className="text-xs text-[var(--color-text-muted)]">Paste mobile QR data to import transactions</p>
              </div>
            </div>
          </button>

          {/* Send data to mobile */}
          <button
            onClick={handleShowRefData}
            className="glass-card w-full rounded-xl p-4 text-left hover:bg-[var(--color-bg-surface-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-accent-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Send to Mobile</p>
                <p className="text-xs text-[var(--color-text-muted)]">Show QR with accounts & categories for mobile</p>
              </div>
            </div>
          </button>

          {/* Network sync */}
          <button
            onClick={handleStartServer}
            className="glass-card w-full rounded-xl p-4 text-left hover:bg-[var(--color-bg-surface-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-accent-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Network Sync</p>
                <p className="text-xs text-[var(--color-text-muted)]">Start local server for WiFi sync</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {mode === 'scan' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setMode('menu')} className="text-sm text-[var(--color-accent-light)]">← Back</button>
            <span className="text-sm font-medium">Import Mobile Transactions</span>
          </div>

          {qrData && (
            <div className="glass-card rounded-xl p-4 text-center">
              <p className="text-xs text-[var(--color-text-muted)] mb-3">Reference data QR for mobile</p>
              <QrCanvas data={qrData} size={256} />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Paste mobile QR payload
            </label>
            <textarea
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder='{"version":1,"transactions":[...]}'
              className="input-cyber w-full rounded-xl px-4 py-3 text-xs h-32 resize-none font-mono"
            />
          </div>

          {resultMessage && (
            <p className="text-xs text-[var(--color-negative)]">{resultMessage}</p>
          )}

          <button
            onClick={handleImport}
            disabled={!scanInput.trim()}
            className="btn-neon px-6 py-2.5 rounded-xl text-sm font-medium"
          >
            Import
          </button>
        </div>
      )}

      {mode === 'server' && serverInfo && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={handleStopServer} className="text-sm text-[var(--color-accent-light)]">← Stop & Back</button>
            <span className="text-sm font-medium">Network Sync Server</span>
          </div>

          <div className="glass-card rounded-xl p-6 text-center space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Sync server running at:
            </p>
            <p className="text-lg font-mono text-[var(--color-accent-light)]">{serverInfo.url}</p>
            {serverUrl && <QrCanvas data={serverUrl} size={200} />}
            <p className="text-xs text-[var(--color-text-muted)]">
              Scan this QR or enter the URL on your phone to sync
            </p>
          </div>

          <button
            onClick={handleStopServer}
            className="btn-ghost w-full py-2.5 rounded-xl text-sm font-medium"
          >
            Stop Server
          </button>
        </div>
      )}

      {mode === 'result' && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-positive)]/15 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[var(--color-positive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{resultMessage}</p>
            {qrData && (
              <>
                <p className="text-xs text-[var(--color-text-muted)]">Confirmation QR for mobile:</p>
                <QrCanvas data={qrData} size={256} />
              </>
            )}
          </div>

          <button
            onClick={() => { setMode('menu'); setQrData(''); setScanInput(''); setResultMessage(''); }}
            className="btn-neon px-6 py-2.5 rounded-xl text-sm font-medium"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
