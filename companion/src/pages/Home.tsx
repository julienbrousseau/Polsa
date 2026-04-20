import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllAccounts, getUnsyncedCount } from '../db';
import { formatMoney } from '../lib/format';
import type { MobileAccount } from '../lib/types';

const TYPE_COLOR: Record<string, string> = {
  cash: '#f472b6',
  checking: '#22d3ee',
  savings: '#818cf8',
  investments: '#4ade80',
};

const TYPE_LABEL: Record<string, string> = {
  cash: 'Cash',
  checking: 'Checking',
  savings: 'Savings',
  investments: 'Investments',
};

export default function Home() {
  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    getAllAccounts().then(setAccounts);
    getUnsyncedCount().then(setPendingCount);
  }, []);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Header */}
      <header className="glass border-b border-[var(--color-border-glass)] px-4 py-4 safe-area-top">
        <h1 className="text-lg font-bold tracking-[0.2em] uppercase neon-text-subtle text-[var(--color-accent-light)]">
          Polsa
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {accounts.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <p className="text-[var(--color-text-muted)] mb-3">No accounts yet</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Sync with your desktop app to get started
            </p>
            <Link
              to="/sync"
              className="btn-neon inline-block mt-4 px-6 py-2.5 rounded-xl text-sm font-medium"
            >
              Sync Now
            </Link>
          </div>
        ) : (
          accounts.map(account => (
            <Link
              key={account.id}
              to={`/add/${account.id}`}
              className="glass-card block rounded-xl p-4 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: TYPE_COLOR[account.type],
                        boxShadow: `0 0 6px ${TYPE_COLOR[account.type]}`,
                      }}
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      {TYPE_LABEL[account.type]}
                    </span>
                  </div>
                  <span className="text-base font-medium text-[var(--color-text-primary)]">
                    {account.name}
                  </span>
                </div>
                <span
                  className={`text-lg font-mono tabular-nums font-medium ${
                    account.currentBalance >= 0
                      ? 'text-[var(--color-positive)]'
                      : 'text-[var(--color-negative)]'
                  }`}
                >
                  {formatMoney(account.currentBalance)}
                </span>
              </div>
            </Link>
          ))
        )}

        {/* Pending transactions summary */}
        {pendingCount > 0 && (
          <Link to="/pending" className="block">
            <div className="glass-card rounded-xl p-3 text-center">
              <span className="text-sm text-[var(--color-text-secondary)]">
                {pendingCount} pending transaction{pendingCount !== 1 ? 's' : ''}
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* Bottom bar */}
      <nav className="glass border-t border-[var(--color-border-glass)] px-4 py-3 flex gap-3 safe-area-bottom">
        <Link
          to="/add"
          className="btn-neon flex-1 py-3 rounded-xl text-center text-sm font-medium"
        >
          + Add
        </Link>
        <Link
          to="/sync"
          className="btn-ghost flex-1 py-3 rounded-xl text-center text-sm font-medium"
        >
          Sync
        </Link>
      </nav>
    </div>
  );
}
