import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Account, CategoryWithSubs, RecurrenceFrequency, RecurringTransactionType } from '../lib/types';
import { todayISO } from '../lib/format';
import { RECURRENCE_FREQUENCIES } from '@shared/constants';

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export default function RecurringForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);

  const [accountId, setAccountId] = useState<number | ''>('');
  const [transactionType, setTransactionType] = useState<RecurringTransactionType>('standard');
  const [transferAccountId, setTransferAccountId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [nextDate, setNextDate] = useState(todayISO());
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | ''>('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);

  useEffect(() => {
    (async () => {
      try {
        const [accts, cats] = await Promise.all([
          window.polsa.accounts.list(),
          window.polsa.categories.list(),
        ]);
        setAccounts(accts);
        setCategories(cats);

        if (!isEdit && accts.length > 0) {
          setAccountId(accts[0].id);
        }
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [isEdit]);

  useEffect(() => {
    if (isEdit && id && categories.length > 0) {
      (async () => {
        try {
          const rec = await window.polsa.recurring.get(Number(id));
          setDescription(rec.description);
          setAmountStr((Math.abs(rec.amount) / 100).toFixed(2));
          setIsExpense(rec.amount < 0);
          setAccountId(rec.accountId);
          setTransactionType(rec.transactionType);
          setTransferAccountId(rec.transferAccountId ?? '');
          setFrequency(rec.frequency);
          setNextDate(rec.nextDate);
          if (rec.transactionType === 'standard' && rec.subcategoryId) {
            // Find which category this subcategory belongs to
            for (const cat of categories) {
              const sub = cat.subcategories.find((s) => s.id === rec.subcategoryId);
              if (sub) {
                setSelectedCategoryId(cat.id);
                setSelectedSubcategoryId(sub.id);
                break;
              }
            }
          }
        } catch (e: any) {
          setError(e.message);
        } finally {
          setInitialLoading(false);
        }
      })();
    }
  }, [id, isEdit, categories]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!accountId) {
      setError('Account is required');
      return;
    }
    if (transactionType === 'transfer') {
      if (!transferAccountId) {
        setError('Target account is required for transfers');
        return;
      }
      if (Number(transferAccountId) === Number(accountId)) {
        setError('Source and target accounts must be different');
        return;
      }
    }
    const parsed = parseFloat(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Amount must be a positive number');
      return;
    }

    const amountCents = transactionType === 'transfer'
      ? Math.round(parsed * 100)
      : Math.round(parsed * 100) * (isExpense ? -1 : 1);
    const subcategoryId = transactionType === 'transfer' ? undefined : (selectedSubcategoryId || undefined);

    setLoading(true);
    try {
      if (isEdit) {
        await window.polsa.recurring.update({
          id: Number(id),
          accountId: Number(accountId),
          transactionType,
          transferAccountId: transactionType === 'transfer' ? Number(transferAccountId) : null,
          description: description.trim(),
          amount: amountCents,
          subcategoryId: subcategoryId ?? null,
          frequency,
          nextDate,
        });
      } else {
        await window.polsa.recurring.create({
          accountId: Number(accountId),
          transactionType,
          transferAccountId: transactionType === 'transfer' ? Number(transferAccountId) : undefined,
          description: description.trim(),
          amount: amountCents,
          subcategoryId,
          frequency,
          nextDate,
        });
      }
      navigate('/recurring');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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
        {isEdit ? 'Edit Recurring Payment' : 'New Recurring Payment'}
      </h1>
      <form onSubmit={handleSubmit} className="glass-strong max-w-md rounded-2xl p-5">
        {error && (
          <div className="mb-4 rounded-lg bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 px-3 py-2 text-xs text-[var(--color-negative)]">
            {error}
          </div>
        )}

        {/* Description */}
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Description
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
            maxLength={200}
            className="input-cyber w-full rounded-lg px-3 py-2 text-xs"
            placeholder="e.g. Rent, Netflix, Salary"
          />
        </label>

        {/* Amount + sign toggle */}
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Amount
          </span>
          <div className="flex gap-2">
            {transactionType === 'standard' && (
              <button
                type="button"
                onClick={() => setIsExpense(!isExpense)}
                className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  isExpense
                    ? 'bg-[var(--color-negative)]/15 text-[var(--color-negative)] border border-[var(--color-negative)]/30'
                    : 'bg-[var(--color-positive)]/15 text-[var(--color-positive)] border border-[var(--color-positive)]/30'
                }`}
              >
                {isExpense ? '−' : '+'}
              </button>
            )}
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--color-accent-light)] opacity-60">
                £
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="input-cyber w-full rounded-lg py-2 pl-7 pr-3 text-xs font-mono"
                placeholder="0.00"
              />
            </div>
          </div>
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Type
          </span>
          <select
            value={transactionType}
            onChange={(e) => {
              const nextType = e.target.value as RecurringTransactionType;
              setTransactionType(nextType);
              if (nextType === 'transfer') {
                setSelectedCategoryId('');
                setSelectedSubcategoryId('');
                setIsExpense(true);
              } else {
                setTransferAccountId('');
              }
            }}
            className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
          >
            <option value="standard">Payment / Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </label>

        {/* Account */}
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {transactionType === 'transfer' ? 'Source Account' : 'Account'}
          </span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : '')}
            className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
          >
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>

        {transactionType === 'transfer' && (
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Target Account
            </span>
            <select
              value={transferAccountId}
              onChange={(e) => setTransferAccountId(e.target.value ? Number(e.target.value) : '')}
              className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
            >
              <option value="">Select account…</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
          </label>
        )}

        {/* Category / Subcategory */}
        {transactionType === 'standard' && (
          <div className="mb-4 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Category
            </span>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value ? Number(e.target.value) : '');
                setSelectedSubcategoryId('');
              }}
              className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Subcategory
            </span>
            <select
              value={selectedSubcategoryId}
              onChange={(e) => setSelectedSubcategoryId(e.target.value ? Number(e.target.value) : '')}
              className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
              disabled={!selectedCategoryId}
            >
              <option value="">None</option>
              {selectedCategory?.subcategories.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          </div>
        )}

        {/* Frequency */}
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Frequency
          </span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
            className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
          >
            {RECURRENCE_FREQUENCIES.map((f) => (
              <option key={f} value={f}>{FREQ_LABELS[f]}</option>
            ))}
          </select>
        </label>

        {/* Next date */}
        <label className="mb-6 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Next Date
          </span>
          <input
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
          />
        </label>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-neon rounded-xl px-5 py-2 text-xs font-semibold tracking-wide"
          >
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/recurring')}
            className="btn-ghost rounded-xl px-4 py-2 text-xs"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
