import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllPendingTransactions, deletePendingTransaction, getAllAccounts } from '../db';
import { formatMoney, formatDate } from '../lib/format';
import type { PendingTransaction, MobileAccount } from '../lib/types';

export default function PendingList() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [accounts, setAccounts] = useState<Map<number, string>>(new Map());

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

  const handleDelete = async (id: string) => {
    await deletePendingTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const unsynced = transactions.filter(t => !t.synced);
  const synced = transactions.filter(t => t.synced);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Header */}
      <header className="glass border-b border-[var(--color-border-glass)] px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--color-accent-light)] text-sm"
        >
          ← Back
        </button>
        <h1 className="text-base font-bold text-[var(--color-text-primary)]">
          Pending ({unsynced.length})
        </h1>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            No pending transactions
          </div>
        ) : (
          <>
            {unsynced.map(tx => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                accountName={accounts.get(tx.accountId) ?? `Account #${tx.accountId}`}
                onDelete={() => handleDelete(tx.id)}
              />
            ))}

            {synced.length > 0 && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mt-4 mb-2 px-1">
                  Synced
                </div>
                {synced.map(tx => (
                  <TransactionCard
                    key={tx.id}
                    tx={tx}
                    accountName={accounts.get(tx.accountId) ?? `Account #${tx.accountId}`}
                    onDelete={() => handleDelete(tx.id)}
                    dimmed
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Sync button */}
      {unsynced.length > 0 && (
        <div className="px-4 py-4 safe-area-bottom">
          <Link
            to="/sync"
            className="btn-neon block w-full py-3.5 rounded-xl text-center text-sm font-medium"
          >
            Sync All
          </Link>
        </div>
      )}
    </div>
  );
}

function TransactionCard({
  tx,
  accountName,
  onDelete,
  dimmed,
}: {
  tx: PendingTransaction;
  accountName: string;
  onDelete: () => void;
  dimmed?: boolean;
}) {
  return (
    <div className={`glass-card rounded-xl p-3 flex items-center justify-between ${dimmed ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {tx.description || 'No description'}
          </span>
          <span
            className={`text-sm font-mono tabular-nums font-medium ml-2 shrink-0 ${
              tx.amount >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
            }`}
          >
            {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{formatDate(tx.date)}</span>
          <span>·</span>
          <span className="truncate">{accountName}</span>
        </div>
      </div>
      {!tx.synced && (
        <button
          onClick={onDelete}
          className="ml-3 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] transition-colors p-1"
          title="Delete"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
