import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney, formatDate } from '../lib/format';
import type { RecurringTransaction } from '../lib/types';
import { RECURRENCE_FREQUENCIES } from '@shared/constants';

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export default function RecurringList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await window.polsa.recurring.list();
      setItems(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = items.filter((r) => r.active);
  const cancelled = items.filter((r) => !r.active);

  const handleCancel = async (id: number, description: string) => {
    if (!window.confirm(`Cancel recurring payment "${description}"?`)) return;
    try {
      setError(null);
      await window.polsa.recurring.cancel(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      setError(null);
      await window.polsa.recurring.reactivate(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: number, description: string) => {
    if (!window.confirm(`Permanently delete "${description}"? This cannot be undone.`)) return;
    try {
      setError(null);
      await window.polsa.recurring.delete(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-sm font-bold uppercase tracking-[0.15em] neon-text-subtle text-[var(--color-accent-light)]">
          Recurring Payments
        </h1>
        <button
          onClick={() => navigate('/recurring/new')}
          className="btn-neon rounded-xl px-4 py-2 text-xs font-semibold tracking-wide"
        >
          + New
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 px-4 py-2 text-xs text-[var(--color-negative)]">
          {error}
        </div>
      )}

      {/* Active */}
      {active.length === 0 && cancelled.length === 0 ? (
        <div className="glass-strong rounded-xl p-8 text-center">
          <p className="text-xs text-[var(--color-text-muted)]">
            No recurring payments yet. Create one to automate regular transactions.
          </p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Active
              </div>
              <div className="space-y-1">
                {active.map((r) => (
                  <div key={r.id} className="glass-strong rounded-xl px-4 py-3 group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                            {r.description || '(no description)'}
                          </span>
                          {r.transactionType === 'transfer' && (
                            <span className="rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-light)]">
                              Transfer
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                            {FREQ_LABELS[r.frequency] || r.frequency}
                          </span>
                          {r.transactionType === 'transfer' ? (
                            <span className="text-xs font-mono tabular-nums text-[var(--color-accent-light)]">
                              {formatMoney(Math.abs(r.amount))}
                            </span>
                          ) : (
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                r.amount >= 0
                                  ? 'text-[var(--color-positive)]'
                                  : 'text-[var(--color-negative)]'
                              }`}
                            >
                              {r.amount >= 0 ? '+' : ''}{formatMoney(r.amount)}
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {r.transactionType === 'transfer'
                              ? `${r.accountName} → ${r.transferAccountName ?? 'Unknown account'}`
                              : `→ ${r.accountName}`}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                          Next: {formatDate(r.nextDate)}
                          {r.transactionType === 'standard' && r.subcategoryName && (
                            <span className="ml-3">
                              {r.categoryName && `${r.categoryName} › `}{r.subcategoryName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                        <button
                          onClick={() => navigate(`/recurring/${r.id}/edit`)}
                          className="rounded p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/5 transition-colors"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleCancel(r.id, r.description)}
                          className="rounded p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors"
                          title="Cancel recurring"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <div>
              <button
                onClick={() => setShowCancelled(!showCancelled)}
                className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                <span className={`inline-block transition-transform ${showCancelled ? 'rotate-90' : ''}`}>▸</span>
                Cancelled ({cancelled.length})
              </button>
              {showCancelled && (
                <div className="space-y-1">
                  {cancelled.map((r) => (
                    <div key={r.id} className="glass-strong rounded-xl px-4 py-3 opacity-60 group">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate line-through">
                              {r.description || '(no description)'}
                            </span>
                            {r.transactionType === 'transfer' && (
                              <span className="rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-light)]">
                                Transfer
                              </span>
                            )}
                            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                              {FREQ_LABELS[r.frequency] || r.frequency}
                            </span>
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                r.transactionType === 'transfer'
                                  ? 'text-[var(--color-accent-light)]'
                                  : r.amount >= 0
                                    ? 'text-[var(--color-positive)]'
                                    : 'text-[var(--color-negative)]'
                              }`}
                            >
                              {r.transactionType === 'transfer'
                                ? formatMoney(Math.abs(r.amount))
                                : `${r.amount >= 0 ? '+' : ''}${formatMoney(r.amount)}`}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                                {r.transactionType === 'transfer'
                                  ? `${r.accountName} → ${r.transferAccountName ?? 'Unknown account'}`
                                  : `→ ${r.accountName}`}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                            Cancelled
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                          <button
                            onClick={() => handleReactivate(r.id)}
                            className="rounded px-2 py-1 text-[10px] text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/10 transition-colors"
                            title="Reactivate"
                          >
                            Reactivate
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.description)}
                            className="rounded p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors"
                            title="Delete permanently"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
