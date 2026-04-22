import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { Account, TransactionDisplay } from '../lib/types';
import { TRANSACTIONS_PAGE_SIZE } from '@shared/constants';

declare global {
  interface Window {
    polsa: any;
  }
}

interface SearchFilters {
  searchText: string;
  accountIds: number[];
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  searchText: '',
  accountIds: [],
  dateFrom: '',
  dateTo: '',
};

function getCategoryLabel(transaction: TransactionDisplay): string {
  if (transaction.subcategoryName && transaction.categoryName) {
    return `${transaction.categoryName} / ${transaction.subcategoryName}`;
  }

  if (transaction.categoryName) {
    return transaction.categoryName;
  }

  if (transaction.transactionType === 'transfer' && transaction.transferAccountName) {
    return `Transfer / ${transaction.transferAccountName}`;
  }

  return 'Uncategorised';
}

export default function Search() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [transactions, setTransactions] = useState<TransactionDisplay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    try {
      const accountList = await window.polsa.accounts.list();
      setAccounts(accountList);
    } catch {
      setAccounts([]);
    }
  };

  const runSearch = async (options?: {
    offset?: number;
    append?: boolean;
    filtersOverride?: SearchFilters;
  }) => {
    const activeFilters = options?.filtersOverride ?? filters;
    const offset = options?.offset ?? 0;
    const append = options?.append === true;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    if (!window.polsa?.transactions?.search) {
      setTransactions([]);
      setTotal(0);
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
      return;
    }

    try {
      const result = await window.polsa.transactions.search({
        searchText: activeFilters.searchText.trim() || undefined,
        accountIds: activeFilters.accountIds.length > 0 ? activeFilters.accountIds : undefined,
        dateFrom: activeFilters.dateFrom || undefined,
        dateTo: activeFilters.dateTo || undefined,
        offset,
        limit: TRANSACTIONS_PAGE_SIZE,
      });

      setTransactions((prev) => append ? [...prev, ...result.transactions] : result.transactions);
      setTotal(result.total);
    } catch (searchError: any) {
      setError(searchError?.message ?? 'Unable to search transactions');
      if (!append) {
        setTransactions([]);
        setTotal(0);
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadAccounts();
    void runSearch({ filtersOverride: DEFAULT_FILTERS });
  }, []);

  const toggleAccount = (accountId: number) => {
    setFilters((current) => ({
      ...current,
      accountIds: current.accountIds.includes(accountId)
        ? current.accountIds.filter((id) => id !== accountId)
        : [...current.accountIds, accountId],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runSearch({ filtersOverride: filters });
  };

  const handleClear = async () => {
    setFilters(DEFAULT_FILTERS);
    await runSearch({ filtersOverride: DEFAULT_FILTERS });
  };

  const loadMore = async () => {
    if (loading || loadingMore || transactions.length >= total) return;
    await runSearch({ offset: transactions.length, append: true });
  };

  const getAccountName = (accountId: number) => {
    return accounts.find((account) => account.id === accountId)?.name ?? `Account #${accountId}`;
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-bold tracking-wide uppercase neon-text-subtle text-[var(--color-accent-light)]">
            Search Transactions
          </h1>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Search descriptions and narrow results by account and date range.
          </p>
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {loading ? 'Searching…' : `${total} matching transaction${total === 1 ? '' : 's'}`}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-strong rounded-2xl p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
          <label className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted)]">
            Description
            <input
              type="text"
              value={filters.searchText}
              onChange={(event) => setFilters((current) => ({ ...current, searchText: event.target.value }))}
              placeholder="Search plain text in descriptions"
              className="rounded-xl border border-[var(--color-border-glass)] bg-white/5 px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]/60"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted)]">
            From
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              className="rounded-xl border border-[var(--color-border-glass)] bg-white/5 px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]/60"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted)]">
            To
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              className="rounded-xl border border-[var(--color-border-glass)] bg-white/5 px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]/60"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <div className="mb-2 text-xs text-[var(--color-text-muted)]">Accounts</div>
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => {
                const selected = filters.accountIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleAccount(account.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-all duration-150 ${
                      selected
                        ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 text-[var(--color-accent-light)]'
                        : 'border-[var(--color-border-glass)] bg-white/5 text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {account.name}
                  </button>
                );
              })}
              {accounts.length === 0 && (
                <div className="text-xs italic text-[var(--color-text-muted)]">No accounts available</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-neon rounded-lg px-4 py-2 text-xs font-semibold tracking-wide">
              Search
            </button>
            <button type="button" onClick={handleClear} className="btn-ghost rounded-lg px-4 py-2 text-xs">
              Clear filters
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-[var(--color-negative)]/20 bg-[var(--color-negative)]/10 px-4 py-3 text-sm text-[var(--color-negative)]">
          {error}
        </div>
      )}

      <div className="glass-strong flex-1 overflow-auto rounded-2xl">
        <table className="w-full min-w-[760px]">
          <thead className="sticky top-0 z-10 bg-[var(--color-bg-deep)]/90 backdrop-blur-md">
            <tr className="border-b border-[var(--color-accent)]/10 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              <th className="px-3 py-2.5 w-24">Date</th>
              <th className="px-3 py-2.5 w-40">Account</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5 w-44">Category</th>
              <th className="px-3 py-2.5 w-24 text-right">Amount</th>
              <th className="px-3 py-2.5 w-24 text-right">Balance</th>
              <th className="px-3 py-2.5 w-20 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-[var(--color-text-muted)]">
                  No transactions match the current filters.
                </td>
              </tr>
            )}

            {transactions.map((transaction) => (
              <tr
                key={`${transaction.accountId}-${transaction.id}`}
                className="border-b border-white/5 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-white/5"
              >
                <td className="px-3 py-2.5 align-top text-[var(--color-text-secondary)]">{transaction.date}</td>
                <td className="px-3 py-2.5 align-top">{getAccountName(transaction.accountId)}</td>
                <td className="px-3 py-2.5 align-top">
                  <div className="font-medium">{transaction.description || 'No description'}</div>
                  {transaction.reconciled && (
                    <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Reconciled</div>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top text-[var(--color-text-secondary)]">{getCategoryLabel(transaction)}</td>
                <td className={`px-3 py-2.5 align-top text-right font-mono ${transaction.amount >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                  {formatMoney(transaction.amount)}
                </td>
                <td className="px-3 py-2.5 align-top text-right font-mono text-[var(--color-text-secondary)]">
                  {formatMoney(transaction.runningBalance)}
                </td>
                <td className="px-3 py-2.5 align-top text-right">
                  <button
                    type="button"
                    onClick={() => navigate(`/accounts/${transaction.accountId}`)}
                    className="text-xs text-[var(--color-accent-light)] transition-colors hover:text-[var(--color-text-primary)]"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length < total && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-ghost rounded-lg px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}