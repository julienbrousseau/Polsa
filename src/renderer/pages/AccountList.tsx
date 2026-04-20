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
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="text-center">
          <div className="text-xl font-bold tracking-[0.2em] uppercase neon-text-subtle text-[var(--color-accent-light)] mb-2">
            Polsa
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Your personal finance command centre
          </p>
        </div>
        <button
          onClick={() => navigate('/accounts/new')}
          className="btn-neon rounded-xl px-6 py-2.5 text-xs font-semibold tracking-wide uppercase"
        >
          Create Account
        </button>
      </div>
    );
  }

  return null;
}
