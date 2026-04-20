// src/renderer/pages/BudgetOverview.tsx

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { BudgetOverview as BudgetOverviewType, BudgetCategoryRow } from '../../shared/types';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function progressColor(spent: number, allocated: number): string {
  if (allocated <= 0) return 'var(--color-text-muted)';
  const ratio = spent / allocated;
  if (ratio <= 0.7) return 'var(--color-positive)';
  if (ratio <= 0.9) return 'var(--color-warning, #f59e0b)';
  return 'var(--color-negative)';
}

function ProgressBar({ spent, allocated }: { spent: number; allocated: number }) {
  const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
  const color = progressColor(spent, allocated);

  return (
    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function CategoryCard({ cat, expanded, onToggle }: {
  cat: BudgetCategoryRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pctLabel = cat.allocated > 0 ? Math.round((cat.spent / cat.allocated) * 100) : 0;

  return (
    <div className="glass rounded-xl border border-[var(--color-border-glass)] p-4">
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{cat.categoryName}</span>
          </div>
          <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
            {pctLabel}%
          </span>
        </div>

        <ProgressBar spent={cat.spent} allocated={cat.allocated} />

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
          <span>Allocated: <span className="text-[var(--color-text-primary)] font-mono tabular-nums">{formatMoney(cat.allocated)}</span></span>
          <span>Rollover: <span className={`font-mono tabular-nums ${cat.rollover >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{cat.rollover >= 0 ? '+' : ''}{formatMoney(cat.rollover)}</span></span>
          <span>Spent: <span className="text-[var(--color-text-primary)] font-mono tabular-nums">{formatMoney(cat.spent)}</span></span>
          <span>Available: <span className={`font-mono tabular-nums font-semibold ${cat.available >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{formatMoney(cat.available)}</span></span>
        </div>
      </button>

      {expanded && cat.subcategories.length > 0 && (
        <div className="mt-3 ml-4 space-y-2 border-l border-[var(--color-border-glass)] pl-3">
          {cat.subcategories.map((sub) => {
            const subPct = sub.allocated > 0 ? Math.round((sub.spent / sub.allocated) * 100) : 0;
            return (
              <div key={sub.subcategoryId} className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[var(--color-text-secondary)]">{sub.subcategoryName}</span>
                  <span className="font-mono tabular-nums text-[var(--color-text-muted)]">
                    {formatMoney(sub.spent)} / {formatMoney(sub.allocated)}
                    {sub.allocated > 0 && <span className="ml-1">{subPct}%</span>}
                  </span>
                </div>
                <ProgressBar spent={sub.spent} allocated={sub.allocated} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BudgetOverview() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [overview, setOverview] = useState<BudgetOverviewType | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.polsa.budgets.overview({ year, month });
      setOverview(data);
    } catch {
      setOverview(null);
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

  const toggleCat = (catId: number) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] neon-text-subtle">Budgets</h1>
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
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-12">Loading…</div>
      ) : overview ? (
        <>
          {/* Summary bar */}
          <div className="glass rounded-xl border border-[var(--color-border-glass)] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-[var(--color-text-muted)]">
                Allocated: <span className="text-[var(--color-text-primary)] font-mono tabular-nums font-semibold">{formatMoney(overview.totalAllocated)}</span>
              </span>
              <span className="text-[var(--color-text-muted)]">
                Spent: <span className="text-[var(--color-text-primary)] font-mono tabular-nums font-semibold">{formatMoney(overview.totalSpent)}</span>
              </span>
              <span className="text-[var(--color-text-muted)]">
                Available: <span className={`font-mono tabular-nums font-semibold ${overview.totalAvailable >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{formatMoney(overview.totalAvailable)}</span>
              </span>
            </div>
            <Link
              to="/budgets/setup"
              className="rounded-lg bg-[var(--color-accent)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/30 transition-all neon-border"
            >
              Setup Budgets
            </Link>
          </div>

          {/* Category cards */}
          {overview.categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--color-text-muted)] mb-4">No budgets configured yet.</p>
              <Link
                to="/budgets/setup"
                className="rounded-lg bg-[var(--color-accent)]/20 px-4 py-2 text-sm font-semibold text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/30 transition-all"
              >
                Setup Budgets
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {overview.categories.map((cat) => (
                <CategoryCard
                  key={cat.categoryId}
                  cat={cat}
                  expanded={expandedCats.has(cat.categoryId)}
                  onToggle={() => toggleCat(cat.categoryId)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-sm text-[var(--color-negative)] py-12">Failed to load budget data.</div>
      )}
    </div>
  );
}
