import { useState, useEffect } from 'react';
import { todayISO } from '../lib/format';
import type { CategoryWithSubs, TransactionDisplay } from '../lib/types';

interface Props {
  accountId: number;
  categories: CategoryWithSubs[];
  transaction?: TransactionDisplay | null;
  onSave: (tx: { id?: number; date: string; amount: number; subcategoryId: number | null; description: string }) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onClose: () => void;
}

export default function TransactionForm({ accountId, categories, transaction, onSave, onDelete, onClose }: Props) {
  const isEdit = !!transaction;
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [amountStr, setAmountStr] = useState(
    transaction ? (transaction.amount / 100).toFixed(2) : ''
  );
  const [subcategoryId, setSubcategoryId] = useState<number | null>(
    transaction?.subcategoryId ?? null
  );
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
        subcategoryId,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          {isEdit ? 'Edit Transaction' : 'New Transaction'}
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Positive for income, negative for expense"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Category</label>
            <select
              value={subcategoryId ?? ''}
              onChange={(e) => setSubcategoryId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none [color-scheme:dark]"
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <optgroup key={cat.id} label={cat.name}>
                  {cat.subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="flex justify-between pt-2">
            <div>
              {isEdit && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
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
