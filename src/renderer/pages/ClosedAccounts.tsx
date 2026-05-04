import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { Account } from '../lib/types';

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  cash: 'Cash', checking: 'Checking', savings: 'Savings', investments: 'Investments',
};

export default function ClosedAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      const all: Account[] = await window.polsa.accounts.list();
      setAccounts(all.filter((a) => a.isClosed));
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleReopen = async (account: Account) => {
    const confirmed = window.confirm(`Reopen "${account.name}"? It will appear in your accounts list again.`);
    if (!confirmed) return;
    try {
      await window.polsa.accounts.reopen(account.id);
      setStatusMessage(`"${account.name}" has been reopened.`);
      await loadAccounts();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-sm font-bold tracking-[0.15em] uppercase neon-text-subtle text-[var(--color-accent-light)]">
        Closed Accounts
      </h1>

      {statusMessage && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-xs ${
          statusMessage.startsWith('Error')
            ? 'bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 text-[var(--color-negative)]'
            : 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent-light)]'
        }`}>
          {statusMessage}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="glass-strong rounded-2xl p-8 text-center text-sm text-[var(--color-text-muted)]">
          No closed accounts.
        </div>
      ) : (
        <div className="glass-strong rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-accent)]/10 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-[var(--color-accent)]/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/accounts/${account.id}`)}
                      className="text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent-light)] transition-colors"
                    >
                      {account.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {ACCOUNT_TYPE_LABEL[account.type] ?? account.type}
                  </td>
                  <td className={`px-4 py-3 text-xs font-mono text-right ${
                    account.currentBalance >= 0
                      ? 'text-[var(--color-positive)]'
                      : 'text-[var(--color-negative)]'
                  }`}>
                    {formatMoney(account.currentBalance)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleReopen(account)}
                      className="rounded-lg px-3 py-1.5 text-xs text-[var(--color-accent-light)] border border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/10 transition-all"
                    >
                      Reopen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
