// src/renderer/pages/Dashboard.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { Account, BudgetOverview, BudgetCategoryRow } from '../../shared/types';

// ─── Account-type colours (neon / cyberpunk) ────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  cash:        '#f472b6',  // neon pink
  checking:    '#22d3ee',  // electric cyan
  savings:     '#818cf8',  // neon violet
  investments: '#4ade80',  // neon green
};
const LIQUID_TYPE_ORDER: string[] = ['cash', 'checking', 'savings'];

// ─── Net-Worth Bar ────────────────────────────────────────────────────────────
function NetWorthBar({ accounts }: { accounts: Account[] }) {
  const liquidAccounts = [...accounts.filter(a => a.type !== 'investments')]
    .sort((a, b) => LIQUID_TYPE_ORDER.indexOf(a.type) - LIQUID_TYPE_ORDER.indexOf(b.type));
  const investmentAccounts = accounts.filter(a => a.type === 'investments');
  const investmentsTotal = investmentAccounts.reduce((s, a) => s + a.currentBalance, 0);

  const posAccounts = liquidAccounts.filter(a => a.currentBalance > 0);
  const negAccounts = liquidAccounts.filter(a => a.currentBalance < 0);

  const totalPos   = posAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const totalNeg   = negAccounts.reduce((s, a) => s + Math.abs(a.currentBalance), 0);
  const totalRange = totalPos + totalNeg;
  const liquidNet  = totalPos - totalNeg;

  // Zero line is always rendered; its % position = negative share of total range
  const zeroLinePct = totalRange > 0 ? (totalNeg / totalRange) * 100 : 0;

  const hasAnyLiquid   = liquidAccounts.length > 0;
  const hasInvestments = investmentAccounts.length > 0;

  if (!hasAnyLiquid && !hasInvestments) return null;

  return (
    <div className="glass rounded-xl border border-[var(--color-border-glass)] overflow-hidden">
      {/* ── Liquid assets ── */}
      {hasAnyLiquid && (
        <div className="px-4 pt-4 pb-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              Liquid Assets
            </span>
            <span
              className={`text-sm font-mono font-bold tabular-nums ${
                liquidNet >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
              }`}
            >
              {formatMoney(liquidNet)}
            </span>
          </div>

          {/* Stacked bar – negatives left of zero, positives right */}
          <div className="relative h-3">
            {/* Track */}
            <div className="absolute inset-0 rounded-full bg-white/5" />

            {/* Coloured account segments */}
            <div className="absolute inset-0 rounded-full overflow-hidden flex">
              {negAccounts.map(acc => (
                <div
                  key={acc.id}
                  style={{
                    flex: Math.abs(acc.currentBalance),
                    backgroundColor: TYPE_COLOR[acc.type],
                    opacity: 0.4,
                  }}
                />
              ))}
              {posAccounts.map(acc => (
                <div
                  key={acc.id}
                  style={{
                    flex: acc.currentBalance,
                    backgroundColor: TYPE_COLOR[acc.type],
                    boxShadow: `inset 0 0 12px ${TYPE_COLOR[acc.type]}55`,
                  }}
                />
              ))}
            </div>

            {/* Zero line — always visible */}
            <div
              className="absolute inset-y-0 z-10"
              style={{
                left: `${zeroLinePct}%`,
                width: '2px',
                marginLeft: '-1px',
                background: 'rgba(255,255,255,0.65)',
                boxShadow: '0 0 6px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,1)',
              }}
            />
          </div>

          {/* Per-account legend */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-0.5">
            {liquidAccounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-1.5 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: TYPE_COLOR[acc.type],
                    opacity: acc.currentBalance < 0 ? 0.45 : 1,
                    boxShadow: acc.currentBalance >= 0
                      ? `0 0 5px ${TYPE_COLOR[acc.type]}`
                      : 'none',
                  }}
                />
                <span className="text-xs text-[var(--color-text-muted)] truncate flex-1 min-w-0">
                  {acc.name}
                </span>
                <span
                  className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                    acc.currentBalance >= 0
                      ? 'text-[var(--color-text-secondary)]'
                      : 'text-[var(--color-negative)]'
                  }`}
                >
                  {formatMoney(acc.currentBalance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Divider ── */}
      {hasAnyLiquid && hasInvestments && (
        <div className="border-t border-[var(--color-border-glass)]" />
      )}

      {/* ── Investments ── */}
      {hasInvestments && (
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: TYPE_COLOR.investments,
                boxShadow: `0 0 5px ${TYPE_COLOR.investments}`,
              }}
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              Investments
            </span>
          </div>
          <span
            className={`text-sm font-mono font-bold tabular-nums ${
              investmentsTotal >= 0 ? 'text-[#4ade80]' : 'text-[var(--color-negative)]'
            }`}
          >
            {formatMoney(investmentsTotal)}
          </span>
        </div>
      )}

      {/* ── Net total ── */}
      {(hasAnyLiquid || hasInvestments) && (
        <>
          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/30 to-transparent" />
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              Net Worth
            </span>
            {(() => {
              const total = liquidNet + investmentsTotal;
              return (
                <span
                  className={`text-base font-mono font-bold tabular-nums ${
                    total >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                  }`}
                  style={total >= 0 ? { textShadow: '0 0 12px var(--color-positive)' } : undefined}
                >
                  {formatMoney(total)}
                </span>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}

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
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function CategoryRow({ cat }: { cat: BudgetCategoryRow }) {
  const [expanded, setExpanded] = useState(false);
  const pct = cat.allocated > 0 ? Math.round((cat.spent / cat.allocated) * 100) : 0;
  const hasSubcats = cat.subcategories.length > 0;

  return (
    <div>
      <button
        onClick={() => hasSubcats && setExpanded(e => !e)}
        className={`w-full text-left py-2.5 px-3 rounded-lg transition-all duration-150 ${hasSubcats ? 'hover:bg-white/3 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          {hasSubcats && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 shrink-0 text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
          {!hasSubcats && <div className="w-3 shrink-0" />}
          <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] truncate">{cat.categoryName}</span>
          <div className="flex items-center gap-3 text-xs tabular-nums shrink-0">
            <span className="text-[var(--color-text-muted)]">{formatMoney(cat.spent)} / {formatMoney(cat.allocated)}</span>
            <span
              className="w-8 text-right font-semibold"
              style={{ color: progressColor(cat.spent, cat.allocated) }}
            >
              {cat.allocated > 0 ? `${pct}%` : '—'}
            </span>
            <span
              className={`w-16 text-right font-mono font-semibold ${cat.available >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}
            >
              {formatMoney(cat.available)}
            </span>
          </div>
        </div>
        <div className="ml-5">
          <ProgressBar spent={cat.spent} allocated={cat.allocated} />
        </div>
      </button>

      {expanded && hasSubcats && (
        <div className="ml-8 mb-1 space-y-1 border-l border-[var(--color-border-glass)] pl-3">
          {cat.subcategories.map((sub) => {
            const subPct = sub.allocated > 0 ? Math.round((sub.spent / sub.allocated) * 100) : 0;
            return (
              <div key={sub.subcategoryId} className="py-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex-1 text-xs text-[var(--color-text-secondary)] truncate">{sub.subcategoryName}</span>
                  <div className="flex items-center gap-3 text-xs tabular-nums shrink-0">
                    <span className="text-[var(--color-text-muted)]">{formatMoney(sub.spent)} / {formatMoney(sub.allocated)}</span>
                    <span
                      className="w-8 text-right"
                      style={{ color: progressColor(sub.spent, sub.allocated) }}
                    >
                      {sub.allocated > 0 ? `${subPct}%` : '—'}
                    </span>
                    <span
                      className={`w-16 text-right font-mono ${sub.available >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}
                    >
                      {formatMoney(sub.available)}
                    </span>
                  </div>
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

export default function Dashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      window.polsa.budgets.overview({ year, month }),
      window.polsa.accounts.list(),
    ])
      .then(([budgetData, accountData]: [BudgetOverview, Account[]]) => {
        setOverview(budgetData);
        setAccounts(accountData);
      })
      .catch(() => {
        setOverview(null);
        setAccounts([]);
      })
      .finally(() => setLoading(false));
  }, [year, month]);

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const hasCategories = (overview?.categories.length ?? 0) > 0;
  const [budgetExpanded, setBudgetExpanded] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] neon-text-subtle">Dashboard</h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{monthLabel}</p>
      </div>

      {/* Account net-worth overview */}
      {!loading && <NetWorthBar accounts={accounts} />}

      {loading ? (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-12">Loading…</div>
      ) : !overview || !hasCategories ? (
        <div className="glass rounded-xl border border-[var(--color-border-glass)] p-10 text-center space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">No budget set up for {monthLabel}.</p>
          <Link
            to="/budgets/setup"
            className="inline-block rounded-lg bg-[var(--color-accent)]/20 px-4 py-2 text-sm font-semibold text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/30 transition-all neon-border"
          >
            Set up budgets
          </Link>
        </div>
      ) : (
        <>
          {/* Summary strip — click to expand/collapse budget details */}
          <button
            onClick={() => setBudgetExpanded(e => !e)}
            className="w-full glass rounded-xl border border-[var(--color-border-glass)] px-4 py-3 flex items-center gap-x-6 text-sm hover:bg-white/[0.02] transition-colors text-left"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${budgetExpanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[var(--color-text-muted)]">
              Allocated: <span className="text-[var(--color-text-primary)] font-mono tabular-nums font-semibold">{formatMoney(overview.totalAllocated)}</span>
            </span>
            <span className="text-[var(--color-text-muted)]">
              Spent: <span className="text-[var(--color-text-primary)] font-mono tabular-nums font-semibold">{formatMoney(overview.totalSpent)}</span>
            </span>
            <span className="text-[var(--color-text-muted)]">
              Available: <span className={`font-mono tabular-nums font-semibold ${overview.totalAvailable >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{formatMoney(overview.totalAvailable)}</span>
            </span>
          </button>

          {/* Collapsible budget details */}
          {budgetExpanded && (
            <>
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                <div className="flex-1 ml-5">Category</div>
                <div className="flex gap-3 shrink-0 text-right">
                  <span className="w-[calc(2*4.5rem+0.75rem)]">Spent / Allocated</span>
                  <span className="w-8 text-right">%</span>
                  <span className="w-16 text-right">Left</span>
                </div>
              </div>

              {/* Category rows */}
              <div className="glass rounded-xl border border-[var(--color-border-glass)] divide-y divide-[var(--color-border-glass)]">
                {overview.categories.map((cat) => (
                  <CategoryRow key={cat.categoryId} cat={cat} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
