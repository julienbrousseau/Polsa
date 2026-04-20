import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Account } from '../lib/types';

export default function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const list = await window.polsa.accounts.list();
        setAccounts(list);
        // Redirect to first account if any exist
        if (list.length > 0) {
          navigate(`/accounts/${list[0].id}`, { replace: true });
        }
      } catch {
        // API not available
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Loading…</div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-2xl font-light text-[var(--color-text-secondary)]">
          Welcome to Polsa
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Create your first account to get started
        </p>
        <button
          onClick={() => navigate('/accounts/new')}
          className="rounded-lg bg-[var(--color-accent)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-light)]"
        >
          Create Account
        </button>
      </div>
    );
  }

  return null;
}
