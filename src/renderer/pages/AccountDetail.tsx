import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { Account, TransactionDisplay, CategoryWithSubs } from '../lib/types';
import { TRANSACTIONS_PAGE_SIZE } from '@shared/constants';
import TransactionRow from '../components/TransactionRow';
import InlineTransactionInput from '../components/InlineTransactionInput';
import TransactionForm from '../components/TransactionForm';

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<TransactionDisplay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [editingTx, setEditingTx] = useState<TransactionDisplay | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showReconciled, setShowReconciled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const accountId = Number(id);

  const loadAccount = useCallback(async () => {
    try {
      const acc = await window.polsa.accounts.get(accountId);
      setAccount(acc);
    } catch {
      setAccount(null);
    }
  }, [accountId]);

  const loadAccounts = useCallback(async () => {
    try {
      const all = await window.polsa.accounts.list();
      setAccounts(all);
    } catch {
      setAccounts([]);
    }
  }, []);

  const loadTransactions = useCallback(async (offset = 0, append = false) => {
    try {
      const result = await window.polsa.transactions.list({
        accountId,
        offset,
        limit: TRANSACTIONS_PAGE_SIZE,
        includeReconciled: showReconciled,
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
  }, [accountId, showReconciled]);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await window.polsa.categories.list();
      setCategories(cats);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([loadAccount(), loadAccounts(), loadTransactions(), loadCategories()]).finally(() =>
      setLoading(false)
    );
  }, [id, loadAccount, loadAccounts, loadTransactions, loadCategories]);

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

  const refreshAll = async () => {
    await Promise.all([loadAccount(), loadTransactions()]);
  };

  const handleInlineAdd = async (tx: { date: string; amount: number; categoryId: number | null; subcategoryId: number | null; description: string }) => {
    await window.polsa.transactions.create({
      accountId,
      ...tx,
    });
    await refreshAll();
  };

  const handleFormSave = async (tx:
    | { id?: number; type: 'standard'; date: string; amount: number; categoryId: number | null; subcategoryId: number | null; description: string }
    | { type: 'transfer'; date: string; amount: number; toAccountId: number; description: string }
  ) => {
    if (tx.type === 'transfer') {
      await window.polsa.transactions.createTransfer({
        fromAccountId: accountId,
        toAccountId: tx.toAccountId,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
      });
    } else if (tx.id) {
      await window.polsa.transactions.update({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        categoryId: tx.categoryId,
        subcategoryId: tx.subcategoryId,
        description: tx.description,
      });
    } else {
      await window.polsa.transactions.create({
        accountId,
        date: tx.date,
        amount: tx.amount,
        categoryId: tx.categoryId,
        subcategoryId: tx.subcategoryId,
        description: tx.description,
      });
    }
    await refreshAll();
  };

  const handleFormDelete = async (txId: number) => {
    await window.polsa.transactions.delete(txId);
    await refreshAll();
  };

  const handleImport = async () => {
    try {
      const filePath = await window.polsa.qif.pickImportFile();
      if (!filePath) return;
      setImportStatus('Importing…');
      const result = await window.polsa.qif.import({ accountId, filePath });
      setImportStatus(`Imported ${result.imported} transaction${result.imported !== 1 ? 's' : ''}`);
      await refreshAll();
      await loadCategories();
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e: any) {
      setImportStatus(`Error: ${e.message}`);
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  const handleExport = async () => {
    try {
      const filePath = await window.polsa.qif.pickExportFile();
      if (!filePath) return;
      const result = await window.polsa.qif.export({ accountId, filePath });
      setImportStatus(`Exported ${result.exported} transaction${result.exported !== 1 ? 's' : ''}`);
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e: any) {
      setImportStatus(`Error: ${e.message}`);
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Loading…</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Account not found</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold tracking-wide uppercase neon-text-subtle text-[var(--color-accent-light)]">
            {account.name}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span className="capitalize">{account.type}</span>
            <span className="text-[var(--color-accent)]/30">·</span>
            <span
              className={`font-mono font-medium ${
                account.currentBalance >= 0
                  ? 'text-[var(--color-positive)]'
                  : 'text-[var(--color-negative)]'
              }`}
            >
              {formatMoney(account.currentBalance)}
            </span>
            <span className="text-[10px]">({total} txns)</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleImport}
            className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
          >
            Import
          </button>
          <button
            onClick={handleExport}
            className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
          >
            Export
          </button>
          <button
            onClick={() => { setEditingTx(null); setShowForm(true); }}
            className="btn-neon rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide"
          >
            + Transaction
          </button>
          <button
            onClick={() => navigate(`/accounts/${id}/edit`)}
            className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-end flex-shrink-0">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-accent)]"
            checked={showReconciled}
            onChange={(e) => setShowReconciled(e.target.checked)}
          />
          Show reconciled transactions
        </label>
      </div>

      {/* Status message */}
      {importStatus && (
        <div className={`mb-3 rounded-lg px-4 py-2 text-xs flex-shrink-0 ${
          importStatus.startsWith('Error') 
            ? 'bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 text-[var(--color-negative)]'
            : 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent-light)]'
        }`}>
          {importStatus}
        </div>
      )}

      {/* Transaction table */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="glass-strong flex-1 overflow-auto rounded-2xl"
      >
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-[var(--color-bg-deep)]/90 backdrop-blur-md">
            <tr className="border-b border-[var(--color-accent)]/10 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
              <th className="px-3 py-2.5 w-6" title="Reconciled"></th>
              <th className="px-3 py-2.5 w-24">Date</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5 w-40">Category</th>
              <th className="px-3 py-2.5 w-24 text-right">Amount</th>
              <th className="px-3 py-2.5 w-24 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {/* Inline quick-add row */}
            <InlineTransactionInput
              accountId={accountId}
              categories={categories}
              onSave={handleInlineAdd}
            />

            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onEdit={(t) => { setEditingTx(t); setShowForm(true); }}
              />
            ))}

            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-[var(--color-text-muted)]">
                  No transactions yet. Use the row above to add your first.
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

      {/* Transaction form modal */}
      {showForm && (
        <TransactionForm
          accountId={accountId}
          accounts={accounts}
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
