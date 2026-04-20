import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { getUnsyncedTransactions } from '../db';
import { buildSyncPayloads, syncViaNetwork, parseDesktopPayload, processDesktopPayload } from '../sync';
import type { PendingTransaction, MobileSyncPayload } from '../lib/types';

type SyncMode = 'menu' | 'qr-show' | 'qr-scan' | 'network' | 'done';

export default function Sync() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SyncMode>('menu');
  const [unsynced, setUnsynced] = useState<PendingTransaction[]>([]);
  const [payloads, setPayloads] = useState<MobileSyncPayload[]>([]);
  const [currentQrIndex, setCurrentQrIndex] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [networkUrl, setNetworkUrl] = useState('');
  const [networkStatus, setNetworkStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [scanInput, setScanInput] = useState('');

  useEffect(() => {
    getUnsyncedTransactions().then(txs => {
      setUnsynced(txs);
      const p = buildSyncPayloads(txs);
      setPayloads(p);
    });
  }, []);

  // Generate QR code image when showing QR
  useEffect(() => {
    if (mode === 'qr-show' && payloads.length > 0 && currentQrIndex < payloads.length) {
      const data = JSON.stringify(payloads[currentQrIndex]);
      QRCode.toDataURL(data, {
        width: 280,
        margin: 2,
        color: { dark: '#e8e0f0', light: '#080b18' },
        errorCorrectionLevel: 'M',
      }).then(setQrDataUrl);
    }
  }, [mode, payloads, currentQrIndex]);

  const handleShowQR = () => {
    setCurrentQrIndex(0);
    setMode('qr-show');
  };

  const handleNextQR = () => {
    if (currentQrIndex < payloads.length - 1) {
      setCurrentQrIndex(prev => prev + 1);
    } else {
      // All QRs shown, now scan desktop confirmation
      setMode('qr-scan');
    }
  };

  const handleScanConfirmation = async () => {
    const parsed = parseDesktopPayload(scanInput);
    if (!parsed) {
      setStatusMessage('Invalid QR data. Please try again.');
      return;
    }

    try {
      const result = await processDesktopPayload(parsed);
      setStatusMessage(
        `Synced ${result.syncedCount} transaction${result.syncedCount !== 1 ? 's' : ''}. ` +
        `Updated ${result.accountsUpdated} accounts, ${result.categoriesUpdated} categories.`
      );
      setMode('done');
    } catch {
      setStatusMessage('Error processing sync data.');
    }
  };

  const handleNetworkSync = async () => {
    if (!networkUrl.trim()) return;
    setNetworkStatus('syncing');
    try {
      const result = await syncViaNetwork(networkUrl.trim().replace(/\/$/, ''));
      setStatusMessage(
        `Synced ${result.syncedCount} transaction${result.syncedCount !== 1 ? 's' : ''}. ` +
        `Updated ${result.accountsUpdated} accounts, ${result.categoriesUpdated} categories.`
      );
      setNetworkStatus('success');
      setMode('done');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Network sync failed');
      setNetworkStatus('error');
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Header */}
      <header className="glass border-b border-[var(--color-border-glass)] px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => mode === 'menu' || mode === 'done' ? navigate('/') : setMode('menu')}
          className="text-[var(--color-accent-light)] text-sm"
        >
          ← Back
        </button>
        <h1 className="text-base font-bold text-[var(--color-text-primary)]">Sync</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {mode === 'menu' && (
          <>
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {unsynced.length} transaction{unsynced.length !== 1 ? 's' : ''} to send
              </p>
            </div>

            {/* QR Code sync */}
            <button
              onClick={handleShowQR}
              disabled={unsynced.length === 0}
              className="glass-card w-full rounded-xl p-4 text-left active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-accent-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">QR Code Sync</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Show QR to desktop app</p>
                </div>
              </div>
            </button>

            {/* Network sync */}
            <button
              onClick={() => setMode('network')}
              className="glass-card w-full rounded-xl p-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-accent-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">Local Network</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Sync over WiFi</p>
                </div>
              </div>
            </button>

            {/* Scan desktop QR (for receiving data without sending) */}
            <button
              onClick={() => setMode('qr-scan')}
              className="glass-card w-full rounded-xl p-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-accent-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">Receive from Desktop</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Scan QR to update accounts & categories</p>
                </div>
              </div>
            </button>
          </>
        )}

        {mode === 'qr-show' && (
          <div className="text-center space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Show this QR code to your desktop app
            </p>
            {payloads.length > 1 && (
              <p className="text-xs text-[var(--color-accent-light)]">
                QR {currentQrIndex + 1} of {payloads.length}
              </p>
            )}
            <div className="glass-card rounded-xl p-4 inline-block mx-auto">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="Sync QR Code" className="w-64 h-64 mx-auto" />
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {unsynced.length} transaction{unsynced.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={handleNextQR}
              className="btn-neon w-full py-3 rounded-xl text-sm font-medium"
            >
              {currentQrIndex < payloads.length - 1 ? 'Next QR' : 'Done — Scan Confirmation'}
            </button>
          </div>
        )}

        {mode === 'qr-scan' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)] text-center">
              Paste the desktop confirmation data below
            </p>
            <textarea
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              placeholder='Paste JSON from desktop QR...'
              className="input-cyber w-full rounded-xl px-4 py-3 text-sm h-32 resize-none font-mono"
            />
            {statusMessage && (
              <p className="text-xs text-[var(--color-negative)] text-center">{statusMessage}</p>
            )}
            <button
              onClick={handleScanConfirmation}
              disabled={!scanInput.trim()}
              className="btn-neon w-full py-3 rounded-xl text-sm font-medium"
            >
              Process
            </button>
          </div>
        )}

        {mode === 'network' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)] text-center">
              Enter the sync URL shown on your desktop
            </p>
            <input
              type="url"
              value={networkUrl}
              onChange={e => setNetworkUrl(e.target.value)}
              placeholder="http://192.168.x.x:9876"
              className="input-cyber w-full rounded-xl px-4 py-3 text-sm font-mono"
            />
            {networkStatus === 'error' && statusMessage && (
              <p className="text-xs text-[var(--color-negative)] text-center">{statusMessage}</p>
            )}
            <button
              onClick={handleNetworkSync}
              disabled={!networkUrl.trim() || networkStatus === 'syncing'}
              className="btn-neon w-full py-3 rounded-xl text-sm font-medium"
            >
              {networkStatus === 'syncing' ? 'Syncing...' : 'Connect & Sync'}
            </button>
          </div>
        )}

        {mode === 'done' && (
          <div className="text-center space-y-4 py-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-positive)]/15 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--color-positive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-medium text-[var(--color-text-primary)]">Sync Complete</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{statusMessage}</p>
            <button
              onClick={() => navigate('/')}
              className="btn-neon px-8 py-3 rounded-xl text-sm font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
