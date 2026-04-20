import { useState, useRef, useEffect } from 'react';
import { todayISO } from '../lib/format';
import type { CategoryWithSubs } from '../lib/types';
import CategoryAutocomplete, { type CategoryValue } from './CategoryAutocomplete';

interface Props {
  accountId: number;
  categories: CategoryWithSubs[];
  onSave: (tx: { date: string; amount: number; categoryId: number | null; subcategoryId: number | null; description: string }) => Promise<void>;
}

export default function InlineTransactionInput({ accountId, categories, onSave }: Props) {
  const [date, setDate] = useState(todayISO());
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<CategoryValue>({ categoryId: null, subcategoryId: null });
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const amt = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amt) || amt === 0) return;

    setSaving(true);
    try {
      await onSave({
        date,
        amount: amt,
        categoryId: category.categoryId,
        subcategoryId: category.subcategoryId,
        description,
      });
      // Reset for next entry
      setAmountStr('');
      setCategory({ categoryId: null, subcategoryId: null });
      setDescription('');
      setDate(todayISO());
      dateRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <tr className="border-b border-[var(--color-accent)]/10 bg-[var(--color-accent)]/[0.03]">
      {/* Reconcile column placeholder */}
      <td />
      <td className="px-3 py-2">
        <input
          ref={dateRef}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input-cyber w-full rounded-lg px-2 py-1.5 text-xs [color-scheme:dark]"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Description"
          className="input-cyber w-full rounded-lg px-2 py-1.5 text-xs"
        />
      </td>
      <td className="px-3 py-2">
        <CategoryAutocomplete
          categories={categories}
          value={category}
          onChange={setCategory}
          onKeyDown={handleKeyDown}
          placeholder="Category"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          className="input-cyber w-full rounded-lg px-2 py-1.5 text-right text-xs font-mono"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={handleSubmit}
          disabled={saving || !amountStr}
          className="btn-neon rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide"
        >
          {saving ? '…' : 'Add'}
        </button>
      </td>
    </tr>
  );
}
