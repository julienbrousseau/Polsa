import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { formatMoney, formatDate } from '../lib/format';
import type { TransactionDisplay, CategoryWithSubs } from '../lib/types';
import { TRANSACTIONS_PAGE_SIZE } from '@shared/constants';

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const categoryId = Number(id);
  const subIdParam = searchParams.get('sub');
  const subcategoryId = subIdParam ? Number(subIdParam) : null;

  const [transactions, setTransactions] = useState<TransactionDisplay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadLabel = useCallback(async () => {
    try {
      const cats: CategoryWithSubs[] = await window.polsa.categories.list();
      const cat = cats.find((c) => c.id === categoryId);
      if (cat) {
        setCategoryName(cat.name);
        if (subcategoryId) {
          const sub = cat.subcategories.find((s) => s.id === subcategoryId);
          if (sub) setSubcategoryName(sub.name);
        }
      }
    } catch {
      // ignore
    }
  }, [categoryId, subcategoryId]);

  const loadTransactions = useCallback(async (offset = 0, append = false) => {
    try {
      const input = subcategoryId
        ? { subcategoryId, offset, limit: TRANSACTIONS_PAGE_SIZE }
        : { categoryId, offset, limit: TRANSACTIONS_PAGE_SIZE };
      const result = await window.polsa.categories.transactions(input);
      if (append) {
        setTransactions((prev) => [...prev, ...result.transactions]);
      } else {
        setTransactions(result.transactions);
      }
      setTotal(result.total);
    } catch {
      // ignore
    }
  }, [categoryId, subcategoryId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLabel(), loadTransactions()]).finally(() => setLoading(false));
  }, [loadLabel, loadTransactions]);

  const loadMore = async () => {
    if (loadingMore || transactions.length >= total) return;
    setLoadingMore(true);
    await loadTransactions(transactions.length, true);
    setLoadingMore(false);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      loadMore();
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Loading…</div>
      </div>
    );
  }

  const title = subcategoryId
    ? `${categoryName} › ${subcategoryName}`
    : categoryName;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {total} transaction{total !== 1 ? 's' : ''} across all accounts
          </p>
        </div>
        <button
          onClick={() => navigate('/categories')}
          className="rounded-lg bg-[var(--color-bg-surface-hover)] px-4 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border-glass)]"
        >
          Back
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="glass-strong flex-1 overflow-auto rounded-xl"
      >
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-[var(--color-bg-surface)]/90 backdrop-blur-sm">
            <tr className="border-b border-white/10 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
              <th className="px-3 py-3 w-28">Date</th>
              <th className="px-3 py-3">Description</th>
              <th className="px-3 py-3 w-32">Account</th>
              <th className="px-3 py-3 w-28 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                onClick={() => navigate(`/accounts/${tx.accountId}`)}
                className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                  {formatDate(tx.date)}
                </td>
                <td className="px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
                  {tx.description || <span className="italic text-[var(--color-text-secondary)]">—</span>}
                </td>
                <td className="px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
                  {/* Account name would need to be in the data — for now show account ID */}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium ${
                    tx.amount >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                  }`}
                >
                  {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  No transactions in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {loadingMore && (
          <div className="py-4 text-center text-sm text-[var(--color-text-secondary)]">
            Loading more…
          </div>
        )}
      </div>
    </div>
  );
}
