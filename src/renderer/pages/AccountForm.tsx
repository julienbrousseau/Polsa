import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AccountType } from '../lib/types';
import { ACCOUNT_TYPES } from '@shared/constants';

const TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash',
  checking: 'Current / Checking',
  savings: 'Savings',
  investments: 'Investments',
};

export default function AccountForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [startingBalanceStr, setStartingBalanceStr] = useState('0.00');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit && id) {
      (async () => {
        try {
          const account = await window.polsa.accounts.get(Number(id));
          setName(account.name);
          setType(account.type);
          setStartingBalanceStr((account.startingBalance / 100).toFixed(2));
        } catch (err: any) {
          setError(err.message || 'Failed to load account');
        } finally {
          setInitialLoading(false);
        }
      })();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Account name is required');
      return;
    }

    const balanceParsed = parseFloat(startingBalanceStr);
    if (isNaN(balanceParsed)) {
      setError('Starting balance must be a valid number');
      return;
    }
    const startingBalance = Math.round(balanceParsed * 100);

    setLoading(true);
    try {
      if (isEdit) {
        await window.polsa.accounts.update({
          id: Number(id),
          name: trimmedName,
          type,
          startingBalance,
        });
        navigate(`/accounts/${id}`);
      } else {
        const created = await window.polsa.accounts.create({
          name: trimmedName,
          type,
          startingBalance,
        });
        navigate(`/accounts/${created.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = window.confirm('Delete this account? All transactions will be removed.');
    if (!confirmed) return;

    try {
      await window.polsa.accounts.delete(Number(id));
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
    }
  };

  if (initialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-sm font-bold tracking-[0.15em] uppercase neon-text-subtle text-[var(--color-accent-light)]">
        {isEdit ? 'Edit Account' : 'New Account'}
      </h1>
      <form onSubmit={handleSubmit} className="glass-strong max-w-md rounded-2xl p-5">
        {error && (
          <div className="mb-4 rounded-lg bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 px-3 py-2 text-xs text-[var(--color-negative)]">
            {error}
          </div>
        )}

        {/* Name */}
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={100}
            className="input-cyber w-full rounded-lg px-3 py-2 text-xs"
            placeholder="e.g. Current Account"
          />
        </label>

        {/* Type */}
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Type
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        {/* Starting Balance */}
        <label className="mb-6 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Starting Balance
          </span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--color-accent-light)] opacity-60">
              £
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={startingBalanceStr}
              onChange={(e) => setStartingBalanceStr(e.target.value)}
              className="input-cyber w-full rounded-lg py-2 pl-7 pr-3 text-xs font-mono"
              placeholder="0.00"
            />
          </div>
        </label>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-neon rounded-xl px-5 py-2 text-xs font-semibold tracking-wide"
          >
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-ghost rounded-xl px-4 py-2 text-xs"
          >
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              className="ml-auto rounded-xl px-4 py-2 text-xs text-[var(--color-negative)] transition-all hover:bg-[var(--color-negative)]/10 hover:shadow-[0_0_15px_rgba(255,51,102,0.15)]"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
