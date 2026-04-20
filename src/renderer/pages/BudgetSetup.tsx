// src/renderer/pages/BudgetSetup.tsx

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { BudgetAllocation } from '../../shared/types';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function centsToDisplay(cents: number): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${whole}.${frac}`;
}

function parseCents(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, '');
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

// ------------- local state types

type BudgetMode = 'category' | 'subcategory' | 'none';

interface CatState {
  categoryId: number;
  categoryName: string;
  mode: BudgetMode;
  // category-level row
  catDisplayValue: string;
  catAmount: number;
  catDirty: boolean;
  // subcategory rows
  subs: {
    subcategoryId: number;
    subcategoryName: string;
    displayValue: string;
    amount: number;
    dirty: boolean;
  }[];
}

function detectMode(catAlloc: BudgetAllocation, subAllocs: BudgetAllocation[]): BudgetMode {
  if (catAlloc.amount > 0) return 'category';
  if (subAllocs.some(s => s.amount > 0)) return 'subcategory';
  return 'none';
}

export default function BudgetSetup() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [catStates, setCatStates] = useState<CatState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: BudgetAllocation[] = await window.polsa.budgets.getAllocations({ year, month });

      // Group by category
      const catMap = new Map<number, { cat: BudgetAllocation; subs: BudgetAllocation[] }>();
      for (const a of data) {
        if (!catMap.has(a.categoryId)) {
          catMap.set(a.categoryId, { cat: null as any, subs: [] });
        }
        if (a.subcategoryId === null) {
          catMap.get(a.categoryId)!.cat = a;
        } else {
          catMap.get(a.categoryId)!.subs.push(a);
        }
      }

      const states: CatState[] = [];
      for (const [, { cat, subs }] of catMap) {
        if (!cat) continue; // shouldn't happen
        states.push({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          mode: detectMode(cat, subs),
          catDisplayValue: centsToDisplay(cat.amount),
          catAmount: cat.amount,
          catDirty: false,
          subs: subs.map(s => ({
            subcategoryId: s.subcategoryId!,
            subcategoryName: s.subcategoryName!,
            displayValue: centsToDisplay(s.amount),
            amount: s.amount,
            dirty: false,
          })),
        });
      }

      setCatStates(states);
    } catch {
      setCatStates([]);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const setMode = (catIdx: number, mode: BudgetMode) => {
    setCatStates(prev => prev.map((c, i) => {
      if (i !== catIdx) return c;
      // When switching mode, reset the other level's values
      if (mode === 'category') {
        return { ...c, mode, catDirty: true, subs: c.subs.map(s => ({ ...s, amount: 0, displayValue: '0.00', dirty: true })) };
      }
      if (mode === 'subcategory') {
        return { ...c, mode, catAmount: 0, catDisplayValue: '0.00', catDirty: true };
      }
      return { ...c, mode, catAmount: 0, catDisplayValue: '0.00', catDirty: true, subs: c.subs.map(s => ({ ...s, amount: 0, displayValue: '0.00', dirty: true })) };
    }));
  };

  const setCatValue = (catIdx: number, value: string) => {
    setCatStates(prev => prev.map((c, i) =>
      i === catIdx ? { ...c, catDisplayValue: value, catDirty: true } : c
    ));
  };

  const setCatBlur = (catIdx: number) => {
    setCatStates(prev => prev.map((c, i) => {
      if (i !== catIdx) return c;
      const cents = parseCents(c.catDisplayValue);
      return cents !== null
        ? { ...c, catAmount: cents, catDisplayValue: centsToDisplay(cents) }
        : { ...c, catDisplayValue: centsToDisplay(c.catAmount) };
    }));
  };

  const setSubValue = (catIdx: number, subIdx: number, value: string) => {
    setCatStates(prev => prev.map((c, i) => {
      if (i !== catIdx) return c;
      return {
        ...c, subs: c.subs.map((s, j) =>
          j === subIdx ? { ...s, displayValue: value, dirty: true } : s
        ),
      };
    }));
  };

  const setSubBlur = (catIdx: number, subIdx: number) => {
    setCatStates(prev => prev.map((c, i) => {
      if (i !== catIdx) return c;
      return {
        ...c, subs: c.subs.map((s, j) => {
          if (j !== subIdx) return s;
          const cents = parseCents(s.displayValue);
          return cents !== null
            ? { ...s, amount: cents, displayValue: centsToDisplay(cents) }
            : { ...s, displayValue: centsToDisplay(s.amount) };
        }),
      };
    }));
  };

  const hasDirty = catStates.some(c =>
    c.catDirty || c.subs.some(s => s.dirty)
  );

  const onSaveClick = () => {
    if (!hasDirty) { navigate('/budgets'); return; }
    setShowPrompt(true);
  };

  const handleSave = async (applyToFutureMonths: boolean) => {
    setSaving(true);
    setError('');
    try {
      const allocations: { subcategoryId: number | null; categoryId: number; amount: number }[] = [];

      for (const cat of catStates) {
        if (cat.mode === 'category') {
          // Save category-level; zero out subcategories
          allocations.push({ subcategoryId: null, categoryId: cat.categoryId, amount: cat.catAmount });
          for (const sub of cat.subs) {
            allocations.push({ subcategoryId: sub.subcategoryId, categoryId: cat.categoryId, amount: 0 });
          }
        } else if (cat.mode === 'subcategory') {
          // Zero out category-level; save subcategories
          allocations.push({ subcategoryId: null, categoryId: cat.categoryId, amount: 0 });
          for (const sub of cat.subs) {
            allocations.push({ subcategoryId: sub.subcategoryId, categoryId: cat.categoryId, amount: sub.amount });
          }
        } else {
          // 'none' mode — zero everything that was dirty
          if (cat.catDirty) {
            allocations.push({ subcategoryId: null, categoryId: cat.categoryId, amount: 0 });
          }
          for (const sub of cat.subs) {
            if (sub.dirty) {
              allocations.push({ subcategoryId: sub.subcategoryId, categoryId: cat.categoryId, amount: 0 });
            }
          }
        }
      }

      await window.polsa.budgets.setAllocations({ year, month, allocations, applyToFutureMonths });
      navigate('/budgets');
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    }
    setSaving(false);
  };

  const inputClass = 'w-28 rounded-md border border-[var(--color-border-glass)] bg-[var(--color-bg-base)] px-2 py-1 text-right font-mono tabular-nums text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors';
  const modeBtn = (active: boolean) =>
    `rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
      active
        ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent-light)]'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5'
    }`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] neon-text-subtle">Budget Setup</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/10 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-[var(--color-text-primary)] min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/10 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={onSaveClick}
            disabled={saving}
            className="rounded-lg bg-[var(--color-accent)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/30 transition-all neon-border disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-negative)] bg-[var(--color-negative)]/10 px-4 py-2 text-sm text-[var(--color-negative)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-12">Loading…</div>
      ) : catStates.length === 0 ? (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-12">
          No categories found. Add categories first.
        </div>
      ) : (
        <div className="space-y-3">
          {catStates.map((cat, catIdx) => (
            <div key={cat.categoryId} className="glass rounded-xl border border-[var(--color-border-glass)] overflow-hidden">
              {/* Category header row */}
              <div className="flex items-center justify-between border-b border-[var(--color-border-glass)]/50 bg-white/2 px-4 py-2.5">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{cat.categoryName}</span>
                <div className="flex items-center gap-1">
                  <span className="mr-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Budget by:</span>
                  <button className={modeBtn(cat.mode === 'category')} onClick={() => setMode(catIdx, 'category')}>
                    Category
                  </button>
                  {cat.subs.length > 0 && (
                    <button className={modeBtn(cat.mode === 'subcategory')} onClick={() => setMode(catIdx, 'subcategory')}>
                      Subcategory
                    </button>
                  )}
                  <button className={modeBtn(cat.mode === 'none')} onClick={() => setMode(catIdx, 'none')}>
                    None
                  </button>
                </div>
              </div>

              {/* Category-level input */}
              {cat.mode === 'category' && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-[var(--color-text-secondary)]">{cat.categoryName} total</span>
                  <input
                    type="text"
                    value={cat.catDisplayValue}
                    onChange={e => setCatValue(catIdx, e.target.value)}
                    onBlur={() => setCatBlur(catIdx)}
                    className={inputClass}
                  />
                </div>
              )}

              {/* Subcategory inputs */}
              {cat.mode === 'subcategory' && cat.subs.length > 0 && (
                <div>
                  {cat.subs.map((sub, subIdx) => (
                    <div key={sub.subcategoryId} className="flex items-center justify-between border-b border-[var(--color-border-glass)]/20 px-4 py-2 last:border-0">
                      <span className="pl-4 text-sm text-[var(--color-text-secondary)]">{sub.subcategoryName}</span>
                      <input
                        type="text"
                        value={sub.displayValue}
                        onChange={e => setSubValue(catIdx, subIdx, e.target.value)}
                        onBlur={() => setSubBlur(catIdx, subIdx)}
                        className={inputClass}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-[var(--color-border-glass)]/40 bg-white/2 px-4 py-2">
                    <span className="pl-4 text-xs font-semibold text-[var(--color-text-muted)]">Total</span>
                    <span className="w-28 text-right font-mono tabular-nums text-sm text-[var(--color-text-muted)]">
                      {formatMoney(cat.subs.reduce((sum, s) => sum + s.amount, 0))}
                    </span>
                  </div>
                </div>
              )}

              {cat.mode === 'none' && (
                <div className="px-4 py-2.5 text-sm italic text-[var(--color-text-muted)]">
                  No budget set for this category.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Future months prompt modal */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-xl border border-[var(--color-border-glass)] p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Update scope</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Update just <strong className="text-[var(--color-text-primary)]">{MONTH_NAMES[month]} {year}</strong>, or this month and all future months?
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => { setShowPrompt(false); handleSave(false); }} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border-glass)] hover:bg-white/5 transition-all disabled:opacity-50">
                This month only
              </button>
              <button onClick={() => { setShowPrompt(false); handleSave(true); }} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-accent-light)] bg-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/30 transition-all neon-border disabled:opacity-50">
                This &amp; future months
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
