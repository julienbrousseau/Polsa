import { useState, useRef, useEffect } from 'react';
import { todayISO } from '../lib/format';
import type { CategoryWithSubs } from '../lib/types';

interface Props {
  accountId: number;
  categories: CategoryWithSubs[];
  onSave: (tx: { date: string; amount: number; subcategoryId: number | null; description: string }) => Promise<void>;
}

export default function InlineTransactionInput({ accountId, categories, onSave }: Props) {
  const [date, setDate] = useState(todayISO());
  const [amountStr, setAmountStr] = useState('');
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
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
        subcategoryId,
        description,
      });
      // Reset for next entry
      setAmountStr('');
      setSubcategoryId(null);
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
    <tr className="border-b border-white/10 bg-white/[0.03]">
      <td className="px-3 py-2">
        <input
          ref={dateRef}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none [color-scheme:dark]"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Description"
          className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={subcategoryId ?? ''}
          onChange={(e) => setSubcategoryId(e.target.value ? Number(e.target.value) : null)}
          onKeyDown={handleKeyDown}
          className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none [color-scheme:dark]"
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
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-right text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={handleSubmit}
          disabled={saving || !amountStr}
          className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 transition-colors"
        >
          {saving ? '…' : 'Add'}
        </button>
      </td>
    </tr>
  );
}
