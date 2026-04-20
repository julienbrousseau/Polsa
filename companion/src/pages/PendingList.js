import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllPendingTransactions, deletePendingTransaction, getAllAccounts } from '../db';
import { formatMoney, formatDate } from '../lib/format';
export default function PendingList() {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [accounts, setAccounts] = useState(new Map());
    const load = async () => {
        const [txs, accs] = await Promise.all([
            getAllPendingTransactions(),
            getAllAccounts(),
        ]);
        // Sort newest first
        txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setTransactions(txs);
        setAccounts(new Map(accs.map(a => [a.id, a.name])));
    };
    useEffect(() => { load(); }, []);
    const handleDelete = async (id) => {
        await deletePendingTransaction(id);
        setTransactions(prev => prev.filter(t => t.id !== id));
    };
    const unsynced = transactions.filter(t => !t.synced);
    const synced = transactions.filter(t => t.synced);
    return (_jsxs("div", { className: "flex flex-col min-h-[100dvh]", children: [_jsxs("header", { className: "glass border-b border-[var(--color-border-glass)] px-4 py-4 flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "text-[var(--color-accent-light)] text-sm", children: "\u2190 Back" }), _jsxs("h1", { className: "text-base font-bold text-[var(--color-text-primary)]", children: ["Pending (", unsynced.length, ")"] })] }), _jsx("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-2", children: transactions.length === 0 ? (_jsx("div", { className: "text-center py-8 text-[var(--color-text-muted)]", children: "No pending transactions" })) : (_jsxs(_Fragment, { children: [unsynced.map(tx => (_jsx(TransactionCard, { tx: tx, accountName: accounts.get(tx.accountId) ?? `Account #${tx.accountId}`, onDelete: () => handleDelete(tx.id) }, tx.id))), synced.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mt-4 mb-2 px-1", children: "Synced" }), synced.map(tx => (_jsx(TransactionCard, { tx: tx, accountName: accounts.get(tx.accountId) ?? `Account #${tx.accountId}`, onDelete: () => handleDelete(tx.id), dimmed: true }, tx.id)))] }))] })) }), unsynced.length > 0 && (_jsx("div", { className: "px-4 py-4 safe-area-bottom", children: _jsx(Link, { to: "/sync", className: "btn-neon block w-full py-3.5 rounded-xl text-center text-sm font-medium", children: "Sync All" }) }))] }));
}
function TransactionCard({ tx, accountName, onDelete, dimmed, }) {
    return (_jsxs("div", { className: `glass-card rounded-xl p-3 flex items-center justify-between ${dimmed ? 'opacity-50' : ''}`, children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between mb-0.5", children: [_jsx("span", { className: "text-sm font-medium text-[var(--color-text-primary)] truncate", children: tx.description || 'No description' }), _jsxs("span", { className: `text-sm font-mono tabular-nums font-medium ml-2 shrink-0 ${tx.amount >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`, children: [tx.amount >= 0 ? '+' : '', formatMoney(tx.amount)] })] }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-[var(--color-text-muted)]", children: [_jsx("span", { children: formatDate(tx.date) }), _jsx("span", { children: "\u00B7" }), _jsx("span", { className: "truncate", children: accountName })] })] }), !tx.synced && (_jsx("button", { onClick: onDelete, className: "ml-3 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] transition-colors p-1", title: "Delete", children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }) }) }))] }));
}
//# sourceMappingURL=PendingList.js.map