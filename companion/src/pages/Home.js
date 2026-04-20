import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllAccounts, getUnsyncedCount } from '../db';
import { formatMoney } from '../lib/format';
const TYPE_COLOR = {
    cash: '#f472b6',
    checking: '#22d3ee',
    savings: '#818cf8',
    investments: '#4ade80',
};
const TYPE_LABEL = {
    cash: 'Cash',
    checking: 'Checking',
    savings: 'Savings',
    investments: 'Investments',
};
export default function Home() {
    const [accounts, setAccounts] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    useEffect(() => {
        getAllAccounts().then(setAccounts);
        getUnsyncedCount().then(setPendingCount);
    }, []);
    return (_jsxs("div", { className: "flex flex-col min-h-[100dvh]", children: [_jsx("header", { className: "glass border-b border-[var(--color-border-glass)] px-4 py-4 safe-area-top", children: _jsx("h1", { className: "text-lg font-bold tracking-[0.2em] uppercase neon-text-subtle text-[var(--color-accent-light)]", children: "Polsa" }) }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-3", children: [accounts.length === 0 ? (_jsxs("div", { className: "glass-card rounded-xl p-6 text-center", children: [_jsx("p", { className: "text-[var(--color-text-muted)] mb-3", children: "No accounts yet" }), _jsx("p", { className: "text-sm text-[var(--color-text-secondary)]", children: "Sync with your desktop app to get started" }), _jsx(Link, { to: "/sync", className: "btn-neon inline-block mt-4 px-6 py-2.5 rounded-xl text-sm font-medium", children: "Sync Now" })] })) : (accounts.map(account => (_jsx(Link, { to: `/add/${account.id}`, className: "glass-card block rounded-xl p-4 active:scale-[0.98] transition-transform", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-full", style: {
                                                        backgroundColor: TYPE_COLOR[account.type],
                                                        boxShadow: `0 0 6px ${TYPE_COLOR[account.type]}`,
                                                    } }), _jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]", children: TYPE_LABEL[account.type] })] }), _jsx("span", { className: "text-base font-medium text-[var(--color-text-primary)]", children: account.name })] }), _jsx("span", { className: `text-lg font-mono tabular-nums font-medium ${account.currentBalance >= 0
                                        ? 'text-[var(--color-positive)]'
                                        : 'text-[var(--color-negative)]'}`, children: formatMoney(account.currentBalance) })] }) }, account.id)))), pendingCount > 0 && (_jsx(Link, { to: "/pending", className: "block", children: _jsx("div", { className: "glass-card rounded-xl p-3 text-center", children: _jsxs("span", { className: "text-sm text-[var(--color-text-secondary)]", children: [pendingCount, " pending transaction", pendingCount !== 1 ? 's' : ''] }) }) }))] }), _jsxs("nav", { className: "glass border-t border-[var(--color-border-glass)] px-4 py-3 flex gap-3 safe-area-bottom", children: [_jsx(Link, { to: "/add", className: "btn-neon flex-1 py-3 rounded-xl text-center text-sm font-medium", children: "+ Add" }), _jsx(Link, { to: "/sync", className: "btn-ghost flex-1 py-3 rounded-xl text-center text-sm font-medium", children: "Sync" })] })] }));
}
//# sourceMappingURL=Home.js.map