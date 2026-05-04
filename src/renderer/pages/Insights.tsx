import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { InsightsCategoryAmount, InsightsMonth } from '../../shared/types';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const BAR_COLORS = [
  '#ff2d95',
  '#00f0ff',
  '#4d6bff',
  '#f97316',
  '#34d399',
  '#facc15',
  '#22d3ee',
  '#818cf8',
  '#fb7185',
  '#a3e635',
];

type Mode = 'expense' | 'income' | 'all';

function categoryColor(index: number): string {
  return BAR_COLORS[index % BAR_COLORS.length];
}

function StackedColumn({ rows }: { rows: InsightsCategoryAmount[] }) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  if (rows.length === 0 || total <= 0) {
    return (
      <div className="h-72 w-16 rounded-xl border border-[var(--color-border-glass)] bg-black/20 flex items-center justify-center">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] rotate-90">No Data</span>
      </div>
    );
  }

  return (
    <div
      className="h-72 w-16 overflow-hidden rounded-xl border border-[var(--color-border-glass)] bg-black/20 flex flex-col-reverse"
      style={{ boxShadow: '0 0 16px rgba(168, 85, 247, 0.12), inset 0 0 14px rgba(255, 255, 255, 0.03)' }}
    >
      {rows.map((row, index) => {
        const pct = (row.amount / total) * 100;
        return (
          <div
            key={row.categoryName}
            title={`${row.categoryName}: ${formatMoney(row.amount)}`}
            style={{
              height: `${pct}%`,
              backgroundColor: categoryColor(index),
              boxShadow: `inset 0 0 12px ${categoryColor(index)}55`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Insights() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mode, setMode] = useState<Mode>('expense');
  const [data, setData] = useState<InsightsMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.polsa.insights.month({ year, month });
      setData(result);
    } catch {
      setData(null);
      setError('Failed to load insights for this month.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = () => {
    if (month === 1) {
      setYear((current) => current - 1);
      setMonth(12);
      return;
    }
    setMonth((current) => current - 1);
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((current) => current + 1);
      setMonth(1);
      return;
    }
    setMonth((current) => current + 1);
  };

  const rows = useMemo(() => {
    if (!data) return [];
    if (mode === 'expense') return data.expenseCategories;
    if (mode === 'income') return data.incomeCategories;

    const map = new Map<number, InsightsCategoryAmount>();
    for (const row of data.expenseCategories) {
      map.set(row.categoryId, { ...row });
    }
    for (const row of data.incomeCategories) {
      const existing = map.get(row.categoryId);
      if (existing) {
        existing.amount += row.amount;
      } else {
        map.set(row.categoryId, { ...row });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'en-GB', { sensitivity: 'base' }));
  }, [data, mode]);

  const modeTotal = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] neon-text-subtle">Insights</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/10 transition-all"
            aria-label="Previous month"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-[var(--color-text-primary)] min-w-[150px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/10 transition-all"
            aria-label="Next month"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-12">Loading…</div>
      ) : error || !data ? (
        <div className="text-center text-sm text-[var(--color-negative)] py-12">{error ?? 'Failed to load insights.'}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="glass rounded-xl border border-[var(--color-border-glass)] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1">Total Earned</div>
              <div className="font-mono tabular-nums text-xl font-semibold text-[var(--color-positive)]">
                {formatMoney(data.totalEarned)}
              </div>
            </div>
            <div className="glass rounded-xl border border-[var(--color-border-glass)] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1">Total Spent</div>
              <div className="font-mono tabular-nums text-xl font-semibold text-[var(--color-negative)]">
                {formatMoney(data.totalSpent)}
              </div>
            </div>
            <div className="glass rounded-xl border border-[var(--color-border-glass)] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1">Balance</div>
              <div className={`font-mono tabular-nums text-xl font-semibold ${data.balance >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                {formatMoney(data.balance)}
              </div>
            </div>
          </div>

          <div className="glass rounded-xl border border-[var(--color-border-glass)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Category Breakdown</h2>
              <div className="inline-flex rounded-lg border border-[var(--color-border-glass)] bg-black/20 p-1">
                <button
                  onClick={() => setMode('expense')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    mode === 'expense'
                      ? 'bg-[var(--color-negative)]/20 text-[var(--color-negative)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Expenses
                </button>
                <button
                  onClick={() => setMode('all')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    mode === 'all'
                      ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent-light)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setMode('income')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    mode === 'income'
                      ? 'bg-[var(--color-positive)]/20 text-[var(--color-positive)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Income
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <div className="space-y-2">
                {rows.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
                    No categorized {mode === 'expense' ? 'expenses' : mode === 'income' ? 'income' : 'activity'} for this month.
                  </p>
                ) : (
                  rows.map((row, index) => {
                    const pct = modeTotal > 0 ? Math.round((row.amount / modeTotal) * 100) : 0;
                    return (
                      <button
                        key={`${mode}-${row.categoryName}`}
                        onClick={() => navigate(`/categories/${row.categoryId}?year=${year}&month=${month.toString().padStart(2, '0')}`)}
                        className="w-full rounded-lg border border-[var(--color-border-glass)] bg-white/[0.02] px-3 py-2 text-left transition-all hover:bg-white/[0.04]"
                        title="Open category details"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: categoryColor(index), boxShadow: `0 0 8px ${categoryColor(index)}` }}
                            />
                            <span className="truncate text-sm text-[var(--color-text-primary)]">{row.categoryName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-mono tabular-nums text-[var(--color-text-muted)]">{pct}%</span>
                            <span className={`font-mono tabular-nums font-semibold ${
                              mode === 'expense'
                                ? 'text-[var(--color-negative)]'
                                : mode === 'income'
                                  ? 'text-[var(--color-positive)]'
                                  : 'text-[var(--color-text-primary)]'
                            }`}>
                              {formatMoney(row.amount)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex justify-center md:justify-end">
                <StackedColumn rows={rows} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}