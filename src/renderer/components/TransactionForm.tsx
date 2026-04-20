import { useState, useEffect } from 'react';
import { todayISO } from '../lib/format';
import type { CategoryWithSubs, TransactionDisplay } from '../lib/types';
import CategoryAutocomplete, { type CategoryValue } from './CategoryAutocomplete';

interface Props {
  accountId: number;
  categories: CategoryWithSubs[];
  transaction?: TransactionDisplay | null;
  onSave: (tx: { id?: number; date: string; amount: number; categoryId: number | null; subcategoryId: number | null; description: string }) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onClose: () => void;
}

export default function TransactionForm({ accountId, categories, transaction, onSave, onDelete, onClose }: Props) {
  const isEdit = !!transaction;
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [amountStr, setAmountStr] = useState(
    transaction ? (transaction.amount / 100).toFixed(2) : ''
  );
  const [category, setCategory] = useState<CategoryValue>({
    categoryId: transaction?.categoryId ?? null,
    subcategoryId: transaction?.subcategoryId ?? null,
  });
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amt) || amt === 0) {
      setError('Amount is required');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        id: transaction?.id,
        date,
        amount: amt,
        categoryId: category.categoryId,
        subcategoryId: category.subcategoryId,
        description,
      });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction || !onDelete) return;
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await onDelete(transaction.id);
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] neon-text-subtle text-[var(--color-accent-light)]">
          {isEdit ? 'Edit Transaction' : 'New Transaction'}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 px-3 py-2 text-xs text-[var(--color-negative)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-cyber w-full rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Positive for income, negative for expense"
              className="input-cyber w-full rounded-lg px-3 py-2 text-xs font-mono"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Category</label>
            <CategoryAutocomplete
              categories={categories}
              value={category}
              onChange={setCategory}
              placeholder="Search category…"
              className="[&_input]:px-3 [&_input]:py-2"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="input-cyber w-full rounded-lg px-3 py-2 text-xs"
            />
          </div>

          <div className="flex justify-between pt-2">
            <div>
              {isEdit && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-xl bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 px-3 py-2 text-xs text-[var(--color-negative)] hover:bg-[var(--color-negative)]/20 hover:shadow-[0_0_15px_rgba(255,51,102,0.15)] transition-all"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost rounded-xl px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-neon rounded-xl px-5 py-2 text-xs font-semibold tracking-wide"
              >
                {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
