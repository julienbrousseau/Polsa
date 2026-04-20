import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllAccounts, getAllCategories, getAllSubcategories, addPendingTransaction } from '../db';
import { todayISO } from '../lib/format';
import type { MobileAccount, MobileCategory, MobileSubcategory } from '../lib/types';

export default function AddTransaction() {
  const { accountId: paramAccountId } = useParams<{ accountId?: string }>();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<MobileAccount[]>([]);
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [subcategories, setSubcategories] = useState<MobileSubcategory[]>([]);

  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [date, setDate] = useState(todayISO());
  const [amountStr, setAmountStr] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getAllAccounts(), getAllCategories(), getAllSubcategories()]).then(
      ([accs, cats, subs]) => {
        setAccounts(accs);
        setCategories(cats);
        setSubcategories(subs);
        if (paramAccountId) {
          const id = parseInt(paramAccountId, 10);
          if (accs.some(a => a.id === id)) {
            setSelectedAccountId(id);
          }
        } else if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }
      },
    );
  }, [paramAccountId]);

  const filteredSubs = selectedCategoryId
    ? subcategories.filter(s => s.categoryId === selectedCategoryId)
    : [];

  const handleSave = async () => {
    if (!selectedAccountId || !amountStr || !date) return;

    const parsedAmount = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(parsedAmount) || parsedAmount === 0) return;

    const finalAmount = isExpense ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    setSaving(true);
    try {
      await addPendingTransaction({
        id: crypto.randomUUID(),
        accountId: selectedAccountId as number,
        date,
        amount: finalAmount,
        subcategoryId: selectedSubcategoryId ? (selectedSubcategoryId as number) : null,
        description: description.trim(),
        createdAt: new Date().toISOString(),
        synced: false,
      });
      navigate('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Header */}
      <header className="glass border-b border-[var(--color-border-glass)] px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--color-accent-light)] text-sm"
        >
          ← Back
        </button>
        <h1 className="text-base font-bold text-[var(--color-text-primary)]">New Transaction</h1>
      </header>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Account */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
            Account
          </label>
          <select
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value ? parseInt(e.target.value, 10) : '')}
            className="input-cyber w-full rounded-xl px-4 py-3 text-sm"
          >
            <option value="">Select account...</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input-cyber w-full rounded-xl px-4 py-3 text-sm"
          />
        </div>

        {/* Amount + type toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
            Amount
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsExpense(!isExpense)}
              className={`rounded-xl px-4 py-3 text-sm font-bold shrink-0 transition-colors ${
                isExpense
                  ? 'bg-[var(--color-negative)]/20 text-[var(--color-negative)] border border-[var(--color-negative)]/30'
                  : 'bg-[var(--color-positive)]/20 text-[var(--color-positive)] border border-[var(--color-positive)]/30'
              }`}
            >
              {isExpense ? '−' : '+'}
            </button>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              className="input-cyber flex-1 rounded-xl px-4 py-3 text-lg font-mono tabular-nums"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
            Category
          </label>
          <select
            value={selectedCategoryId}
            onChange={e => {
              const val = e.target.value ? parseInt(e.target.value, 10) : '';
              setSelectedCategoryId(val);
              setSelectedSubcategoryId('');
            }}
            className="input-cyber w-full rounded-xl px-4 py-3 text-sm"
          >
            <option value="">None</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Subcategory (if category selected and subs exist) */}
        {filteredSubs.length > 0 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
              Subcategory
            </label>
            <select
              value={selectedSubcategoryId}
              onChange={e => setSelectedSubcategoryId(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="input-cyber w-full rounded-xl px-4 py-3 text-sm"
            >
              <option value="">None</option>
              {filteredSubs.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
            Note
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Coffee at Starbucks"
            className="input-cyber w-full rounded-xl px-4 py-3 text-sm"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="px-4 py-4 safe-area-bottom">
        <button
          onClick={handleSave}
          disabled={!selectedAccountId || !amountStr || saving}
          className="btn-neon w-full py-3.5 rounded-xl text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Transaction'}
        </button>
      </div>
    </div>
  );
}
