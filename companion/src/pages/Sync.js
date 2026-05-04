import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { getUnsyncedTransactions } from '../db';
import { buildSyncPayloads, syncViaNetwork, parseSetupPayload, parseDesktopPayload, processSetupPayload, processDesktopPayload, } from '../sync';
export default function Sync() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('menu');
    const [unsynced, setUnsynced] = useState([]);
    const [payloads, setPayloads] = useState([]);
    const [currentQrIndex, setCurrentQrIndex] = useState(0);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [networkUrl, setNetworkUrl] = useState('');
    const [networkStatus, setNetworkStatus] = useState('idle');
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
        }
        else {
            // All QRs shown, now scan desktop confirmation
            setMode('qr-scan');
        }
    };
    const handleScanConfirmation = async () => {
        // Try setup payload first (Desktop → Mobile, no syncedIds)
        const setup = parseSetupPayload(scanInput);
        if (setup) {
            try {
                const result = await processSetupPayload(setup);
                setStatusMessage(`Updated ${result.accountsUpdated} accounts and ${result.categoriesUpdated} categories.`);
                setMode('done');
            }
            catch {
                setStatusMessage('Error processing setup data.');
            }
            return;
        }
        // Fall back to full sync payload (Desktop confirmation after sending transactions)
        const parsed = parseDesktopPayload(scanInput);
        if (!parsed) {
            setStatusMessage('Invalid QR data. Please try again.');
            return;
        }
        try {
            const result = await processDesktopPayload(parsed);
            setStatusMessage(`Synced ${result.syncedCount} transaction${result.syncedCount !== 1 ? 's' : ''}. ` +
                `Updated ${result.accountsUpdated} accounts, ${result.categoriesUpdated} categories.`);
            setMode('done');
        }
        catch {
            setStatusMessage('Error processing sync data.');
        }
    };
    const handleNetworkSync = async () => {
        if (!networkUrl.trim())
            return;
        setNetworkStatus('syncing');
        try {
            const result = await syncViaNetwork(networkUrl.trim().replace(/\/$/, ''));
            if (result.syncedCount === 0) {
                setStatusMessage(`Setup complete. Updated ${result.accountsUpdated} accounts and ${result.categoriesUpdated} categories.`);
            }
            else {
                setStatusMessage(`Synced ${result.syncedCount} transaction${result.syncedCount !== 1 ? 's' : ''}. ` +
                    `Updated ${result.accountsUpdated} accounts, ${result.categoriesUpdated} categories.`);
            }
            setNetworkStatus('success');
            setMode('done');
        }
        catch (err) {
            setStatusMessage(err instanceof Error ? err.message : 'Network sync failed');
            setNetworkStatus('error');
        }
    };
    return (_jsxs("div", { className: "flex flex-col min-h-[100dvh]", children: [_jsxs("header", { className: "glass border-b border-[var(--color-border-glass)] px-4 py-4 flex items-center gap-3", children: [_jsx("button", { onClick: () => mode === 'menu' || mode === 'done' ? navigate('/') : setMode('menu'), className: "text-[var(--color-accent-light)] text-sm", children: "\u2190 Back" }), _jsx("h1", { className: "text-base font-bold text-[var(--color-text-primary)]", children: "Sync" })] }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-6 space-y-4", children: [mode === 'menu' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-center mb-4", children: _jsxs("p", { className: "text-sm text-[var(--color-text-secondary)]", children: [unsynced.length, " transaction", unsynced.length !== 1 ? 's' : '', " to send"] }) }), _jsx("button", { onClick: handleShowQR, disabled: unsynced.length === 0, className: "glass-card w-full rounded-xl p-4 text-left active:scale-[0.98] transition-transform disabled:opacity-40", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0", children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5 text-[var(--color-accent-light)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" }) }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-[var(--color-text-primary)]", children: "QR Code Sync" }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)]", children: "Show QR to desktop app" })] })] }) }), _jsx("button", { onClick: () => setMode('network'), className: "glass-card w-full rounded-xl p-4 text-left active:scale-[0.98] transition-transform", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0", children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5 text-[var(--color-accent-light)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" }) }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-[var(--color-text-primary)]", children: "Local Network" }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)]", children: "Sync over WiFi" })] })] }) }), _jsx("button", { onClick: () => setMode('qr-scan'), className: "glass-card w-full rounded-xl p-4 text-left active:scale-[0.98] transition-transform", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center shrink-0", children: _jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5 text-[var(--color-accent-light)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: [_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }), _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })] }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-[var(--color-text-primary)]", children: "Receive from Desktop" }), _jsx("p", { className: "text-xs text-[var(--color-text-muted)]", children: "Scan QR to update accounts & categories" })] })] }) })] })), mode === 'qr-show' && (_jsxs("div", { className: "text-center space-y-4", children: [_jsx("p", { className: "text-sm text-[var(--color-text-secondary)]", children: "Show this QR code to your desktop app" }), payloads.length > 1 && (_jsxs("p", { className: "text-xs text-[var(--color-accent-light)]", children: ["QR ", currentQrIndex + 1, " of ", payloads.length] })), _jsx("div", { className: "glass-card rounded-xl p-4 inline-block mx-auto", children: qrDataUrl && (_jsx("img", { src: qrDataUrl, alt: "Sync QR Code", className: "w-64 h-64 mx-auto" })) }), _jsxs("p", { className: "text-xs text-[var(--color-text-muted)]", children: [unsynced.length, " transaction", unsynced.length !== 1 ? 's' : ''] }), _jsx("button", { onClick: handleNextQR, className: "btn-neon w-full py-3 rounded-xl text-sm font-medium", children: currentQrIndex < payloads.length - 1 ? 'Next QR' : 'Done — Scan Confirmation' })] })), mode === 'qr-scan' && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-[var(--color-text-secondary)] text-center", children: "Paste the desktop confirmation data below" }), _jsx("textarea", { value: scanInput, onChange: e => setScanInput(e.target.value), placeholder: 'Paste JSON from desktop QR...', className: "input-cyber w-full rounded-xl px-4 py-3 text-sm h-32 resize-none font-mono" }), statusMessage && (_jsx("p", { className: "text-xs text-[var(--color-negative)] text-center", children: statusMessage })), _jsx("button", { onClick: handleScanConfirmation, disabled: !scanInput.trim(), className: "btn-neon w-full py-3 rounded-xl text-sm font-medium", children: "Process" })] })), mode === 'network' && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-[var(--color-text-secondary)] text-center", children: "Enter the sync URL shown on your desktop" }), _jsx("input", { type: "url", value: networkUrl, onChange: e => setNetworkUrl(e.target.value), placeholder: "http://192.168.x.x:9876", className: "input-cyber w-full rounded-xl px-4 py-3 text-sm font-mono" }), networkStatus === 'error' && statusMessage && (_jsx("p", { className: "text-xs text-[var(--color-negative)] text-center", children: statusMessage })), _jsx("button", { onClick: handleNetworkSync, disabled: !networkUrl.trim() || networkStatus === 'syncing', className: "btn-neon w-full py-3 rounded-xl text-sm font-medium", children: networkStatus === 'syncing' ? 'Syncing...' : 'Connect & Sync' })] })), mode === 'done' && (_jsxs("div", { className: "text-center space-y-4 py-8", children: [_jsx("div", { className: "w-16 h-16 mx-auto rounded-full bg-[var(--color-positive)]/15 flex items-center justify-center", children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-8 w-8 text-[var(--color-positive)]", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M5 13l4 4L19 7" }) }) }), _jsx("p", { className: "text-base font-medium text-[var(--color-text-primary)]", children: "Sync Complete" }), _jsx("p", { className: "text-sm text-[var(--color-text-secondary)]", children: statusMessage }), _jsx("button", { onClick: () => navigate('/'), className: "btn-neon px-8 py-3 rounded-xl text-sm font-medium", children: "Done" })] }))] })] }));
}
//# sourceMappingURL=Sync.js.map