import { useState, useEffect } from 'react';
import { todayISO } from '../lib/format';
import type { Account, CategoryWithSubs, TransactionDisplay } from '../lib/types';
import CategoryAutocomplete, { type CategoryValue } from './CategoryAutocomplete';

interface Props {
  accountId: number;
  accounts: Account[];
  categories: CategoryWithSubs[];
  transaction?: TransactionDisplay | null;
  onSave: (tx:
    | { id?: number; type: 'standard'; date: string; amount: number; categoryId: number | null; subcategoryId: number | null; description: string }
    | { type: 'transfer'; date: string; amount: number; toAccountId: number; description: string }
  ) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onClose: () => void;
}

export default function TransactionForm({ accountId, accounts, categories, transaction, onSave, onDelete, onClose }: Props) {
  const isEdit = !!transaction;
  const isTransferEdit = transaction?.transactionType === 'transfer';
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [amountStr, setAmountStr] = useState(
    transaction ? (transaction.amount / 100).toFixed(2) : ''
  );
  const [type, setType] = useState<'standard' | 'transfer'>(isTransferEdit ? 'transfer' : 'standard');
  const [toAccountId, setToAccountId] = useState<number | ''>(transaction?.transferAccountId ?? '');
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

    if (type === 'transfer') {
      if (!toAccountId || toAccountId === accountId) {
        setError('Select a different destination account');
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      if (type === 'transfer') {
        await onSave({
          type: 'transfer',
          date,
          amount: Math.abs(amt),
          toAccountId,
          description,
        });
      } else {
        await onSave({
          id: transaction?.id,
          type: 'standard',
          date,
          amount: amt,
          categoryId: category.categoryId,
          subcategoryId: category.subcategoryId,
          description,
        });
      }
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

  const availableDestinationAccounts = accounts.filter((a) => a.id !== accountId);

  if (isTransferEdit && transaction) {
    // Allow editing/deleting the transfer pair
    const [editDate, setEditDate] = useState(transaction.date);
    const [editAmount, setEditAmount] = useState((Math.abs(transaction.amount) / 100).toFixed(2));
    const [editDescription, setEditDescription] = useState(transaction.description);
    const [savingEdit, setSavingEdit] = useState(false);
    const [errorEdit, setErrorEdit] = useState<string | null>(null);

    const handleEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingEdit(true);
      setErrorEdit(null);
      try {
        await window.polsa.transactions.updateTransfer({
          groupId: transaction.transferGroupId,
          date: editDate,
          amount: Math.round(parseFloat(editAmount) * 100),
          description: editDescription,
        });
        onClose();
      } catch (e: any) {
        setErrorEdit(e.message);
      } finally {
        setSavingEdit(false);
      }
    };

    const handleDelete = async () => {
      if (!window.confirm('Delete this transfer (both accounts)?')) return;
      setSavingEdit(true);
      setErrorEdit(null);
      try {
        await window.polsa.transactions.deleteTransfer(transaction.transferGroupId);
        onClose();
      } catch (e: any) {
        setErrorEdit(e.message);
      } finally {
        setSavingEdit(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose}>
        <div className="glass-strong w-full max-w-md rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.15em] neon-text-subtle text-[var(--color-accent-light)]">
            Edit Transfer
          </h2>
          {errorEdit && (
            <div className="mb-4 rounded-lg bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 px-3 py-2 text-xs text-[var(--color-negative)]">
              {errorEdit}
            </div>
          )}
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Date</label>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="input-cyber w-full rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Amount</label>
              <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="input-cyber w-full rounded-lg px-3 py-2 text-xs font-mono" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Description</label>
              <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="input-cyber w-full rounded-lg px-3 py-2 text-xs" />
            </div>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={handleDelete} className="rounded-xl bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 px-3 py-2 text-xs text-[var(--color-negative)] hover:bg-[var(--color-negative)]/20 transition-all" disabled={savingEdit}>Delete</button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-ghost rounded-xl px-4 py-2 text-xs">Cancel</button>
                <button type="submit" disabled={savingEdit} className="btn-neon rounded-xl px-5 py-2 text-xs font-semibold tracking-wide">{savingEdit ? 'Saving…' : 'Update'}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

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
          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('standard')}
                  className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                    type === 'standard'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent-light)]'
                      : 'border-[var(--color-border-glass)] bg-[var(--color-bg-panel)] text-[var(--color-text-muted)]'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setType('transfer')}
                  className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                    type === 'transfer'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent-light)]'
                      : 'border-[var(--color-border-glass)] bg-[var(--color-bg-panel)] text-[var(--color-text-muted)]'
                  }`}
                >
                  Transfer
                </button>
              </div>
            </div>
          )}

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
              placeholder={type === 'transfer' ? 'Transfer amount' : 'Positive for income, negative for expense'}
              className="input-cyber w-full rounded-lg px-3 py-2 text-xs font-mono"
              autoFocus
            />
          </div>

          {type === 'standard' ? (
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
          ) : (
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Transfer To</label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value ? Number(e.target.value) : '')}
                className="input-cyber w-full rounded-lg px-3 py-2 text-xs"
              >
                <option value="">Select destination account</option>
                {availableDestinationAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
