import { useEffect, useState, useCallback, useRef } from 'react';
import { formatMoney, formatDate, todayISO } from '../lib/format';
import type { Account, TransactionDisplay, CategoryWithSubs } from '../lib/types';
import { TRANSACTIONS_PAGE_SIZE } from '@shared/constants';
import TransactionForm from '../components/TransactionForm';

export default function Reconcile() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [reconciledBalance, setReconciledBalance] = useState(0);
  const [targetStr, setTargetStr] = useState('');
  const [transactions, setTransactions] = useState<TransactionDisplay[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionDisplay | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load accounts
  useEffect(() => {
    window.polsa.accounts.list().then(setAccounts).catch(() => {});
    window.polsa.categories.list().then(setCategories).catch(() => {});
  }, []);

  const loadBalance = useCallback(async (accId: number) => {
    try {
      const result = await window.polsa.reconcile.getBalance(accId);
      setReconciledBalance(result.reconciledBalance);
    } catch {
      setReconciledBalance(0);
    }
  }, []);

  const loadTransactions = useCallback(async (accId: number, offset = 0, append = false) => {
    try {
      const result = await window.polsa.reconcile.getUnreconciled({
        accountId: accId,
        offset,
        limit: TRANSACTIONS_PAGE_SIZE,
      });
      if (append) {
        setTransactions((prev) => [...prev, ...result.transactions]);
      } else {
        setTransactions(result.transactions);
      }
      setTotal(result.total);
    } catch {
      // ignore
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!accountId) return;
    await Promise.all([loadBalance(accountId), loadTransactions(accountId)]);
    setSelected(new Set());
  }, [accountId, loadBalance, loadTransactions]);

  // When account changes
  useEffect(() => {
    if (!accountId) {
      setTransactions([]);
      setTotal(0);
      setReconciledBalance(0);
      setSelected(new Set());
      setTargetStr('');
      return;
    }
    setLoading(true);
    setSelected(new Set());
    setTargetStr('');
    Promise.all([loadBalance(accountId), loadTransactions(accountId)]).finally(() =>
      setLoading(false)
    );
  }, [accountId, loadBalance, loadTransactions]);

  // Infinite scroll
  const loadMore = async () => {
    if (!accountId || loadingMore || transactions.length >= total) return;
    setLoadingMore(true);
    await loadTransactions(accountId, transactions.length, true);
    setLoadingMore(false);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      loadMore();
    }
  };

  // Target balance in cents
  const targetCents = Math.round(parseFloat(targetStr) * 100);
  const hasTarget = !isNaN(targetCents) && targetStr.trim() !== '';

  // Working balance = reconciled + selected amounts
  const selectedAmount = transactions
    .filter((tx) => selected.has(tx.id))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const workingBalance = reconciledBalance + selectedAmount;

  // Difference
  const difference = hasTarget ? targetCents - workingBalance : null;
  const isBalanced = difference === 0;

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((tx) => tx.id)));
    }
  };

  const handleConfirm = async () => {
    if (!isBalanced || selected.size === 0) return;
    const count = selected.size;
    if (!window.confirm(`You are about to reconcile ${count} transaction${count !== 1 ? 's' : ''}. This cannot be undone. Continue?`)) return;

    setConfirming(true);
    try {
      await window.polsa.reconcile.confirm({ transactionIds: Array.from(selected) });
      setStatus(`Reconciled ${count} transaction${count !== 1 ? 's' : ''}`);
      setTimeout(() => setStatus(null), 3000);
      await refreshAll();
      setTargetStr('');
      // Reload accounts (balances may have changed)
      const accs = await window.polsa.accounts.list();
      setAccounts(accs);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
      setTimeout(() => setStatus(null), 5000);
    } finally {
      setConfirming(false);
    }
  };

  // Transaction form handlers (add / edit / delete during reconciliation)
  const handleFormSave = async (tx: { id?: number; date: string; amount: number; subcategoryId: number | null; description: string }) => {
    if (!accountId) return;
    if (tx.id) {
      await window.polsa.transactions.update(tx);
    } else {
      await window.polsa.transactions.create({ accountId, ...tx });
    }
    await refreshAll();
    // Reload accounts list in case balance changed
    window.polsa.accounts.list().then(setAccounts).catch(() => {});
  };

  const handleFormDelete = async (txId: number) => {
    await window.polsa.transactions.delete(txId);
    await refreshAll();
    window.polsa.accounts.list().then(setAccounts).catch(() => {});
  };

  // Keyboard handler: Space to toggle, Enter to confirm
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isBalanced && selected.size > 0 && !confirming) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="flex h-full flex-col" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-base font-bold tracking-wide uppercase neon-text-subtle text-[var(--color-accent-light)]">
          Reconcile
        </h1>
      </div>

      {/* Status message */}
      {status && (
        <div className={`mb-3 rounded-lg px-4 py-2 text-xs flex-shrink-0 ${
          status.startsWith('Error') 
            ? 'bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 text-[var(--color-negative)]'
            : 'bg-[var(--color-positive)]/10 border border-[var(--color-positive)]/20 text-[var(--color-positive)]'
        }`}>
          {status}
        </div>
      )}

      {/* Account picker */}
      <div className="mb-4 flex-shrink-0">
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
          Account
        </label>
        <select
          value={accountId ?? ''}
          onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
          className="input-cyber w-full max-w-xs rounded-lg px-3 py-2 text-xs [color-scheme:dark]"
        >
          <option value="">Select an account…</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({formatMoney(acc.currentBalance)})
            </option>
          ))}
        </select>
      </div>

      {accountId && (
        <>
          {/* Balance summary panel */}
          <div className="glass-card mb-4 flex-shrink-0 rounded-2xl p-4">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                  Reconciled balance
                </div>
                <div className="font-mono font-medium text-[var(--color-text-primary)]">
                  {formatMoney(reconciledBalance)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                  Target balance
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={targetStr}
                  onChange={(e) => setTargetStr(e.target.value)}
                  placeholder="Enter statement balance"
                  className="input-cyber w-full rounded-lg px-2 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                  Difference
                </div>
                <div className={`font-mono font-medium ${
                  !hasTarget
                    ? 'text-[var(--color-text-muted)]'
                    : isBalanced
                    ? 'text-[var(--color-positive)]'
                    : 'text-[var(--color-negative)]'
                }`}>
                  {hasTarget ? (
                    <>
                      {formatMoney(difference!)}
                      {isBalanced && <span className="ml-1">✓</span>}
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            </div>

            {/* Working balance & Reconcile button */}
            <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border-glass)] pt-3">
              <div className="text-xs">
                <span className="text-[var(--color-text-muted)]">Working balance: </span>
                <span className="font-mono font-medium text-[var(--color-text-primary)]">
                  {formatMoney(workingBalance)}
                </span>
                {selected.size > 0 && (
                  <span className="ml-2 text-[var(--color-text-muted)]">
                    ({selected.size} selected)
                  </span>
                )}
              </div>
              <button
                onClick={handleConfirm}
                disabled={!isBalanced || selected.size === 0 || confirming}
                className="btn-neon rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide"
              >
                {confirming ? 'Reconciling…' : 'Reconcile Selected'}
              </button>
            </div>
          </div>

          {/* Transaction list header */}
          <div className="mb-2 flex items-center justify-between flex-shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              Unreconciled Transactions ({total})
            </div>
            <button
              onClick={() => { setEditingTx(null); setShowForm(true); }}
              className="btn-neon rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide"
            >
              + Add transaction
            </button>
          </div>

          {/* Transaction table */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-[var(--color-text-secondary)] text-xs">Loading…</div>
            </div>
          ) : (
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="glass-strong flex-1 overflow-auto rounded-2xl"
            >
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-[var(--color-bg-deep)]/90 backdrop-blur-md">
                  <tr className="border-b border-[var(--color-accent)]/10 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                    <th className="px-3 py-2.5 w-10">
                      <input
                        type="checkbox"
                        checked={transactions.length > 0 && selected.size === transactions.length}
                        onChange={handleSelectAll}
                        className="accent-[var(--color-accent)]"
                        title="Select all"
                      />
                    </th>
                    <th className="px-3 py-2.5 w-24">Date</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5 w-40">Category</th>
                    <th className="px-3 py-2.5 w-24 text-right">Amount</th>
                    <th className="px-3 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`border-b border-[var(--color-border-glass)] transition-all duration-200 ${
                        selected.has(tx.id)
                          ? 'bg-[var(--color-accent)]/10'
                          : 'hover:bg-[var(--color-accent)]/5'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(tx.id)}
                          onChange={() => toggleSelect(tx.id)}
                          className="accent-[var(--color-accent)]"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs font-mono text-[var(--color-text-muted)]">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-text-primary)]">
                        {tx.description || <span className="italic text-[var(--color-text-muted)]">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                        {tx.categoryName && tx.subcategoryName
                          ? <>{tx.categoryName} <span className="text-[var(--color-accent)]/40">›</span> {tx.subcategoryName}</>
                          : tx.categoryName || tx.subcategoryName || ''}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2 text-right text-xs font-mono font-medium ${
                        tx.amount >= 0
                          ? 'text-[var(--color-positive)]'
                          : 'text-[var(--color-negative)]'
                      }`}>
                        {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => { setEditingTx(tx); setShowForm(true); }}
                          className="rounded px-2 py-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/10 transition-all"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                  {transactions.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-xs text-[var(--color-text-muted)]">
                        {total === 0
                          ? 'All transactions are reconciled.'
                          : 'No unreconciled transactions.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {loadingMore && (
                <div className="py-3 text-center text-xs text-[var(--color-text-muted)]">
                  Loading more…
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Transaction form modal */}
      {showForm && accountId && (
        <TransactionForm
          accountId={accountId}
          categories={categories}
          transaction={editingTx}
          onSave={handleFormSave}
          onDelete={handleFormDelete}
          onClose={() => { setShowForm(false); setEditingTx(null); }}
        />
      )}
    </div>
  );
}
