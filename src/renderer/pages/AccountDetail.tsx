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
  const [transactions, setTransactions] = useState<TransactionDisplay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [editingTx, setEditingTx] = useState<TransactionDisplay | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
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

  const loadTransactions = useCallback(async (offset = 0, append = false) => {
    try {
      const result = await window.polsa.transactions.list({
        accountId,
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
  }, [accountId]);

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
    Promise.all([loadAccount(), loadTransactions(), loadCategories()]).finally(() =>
      setLoading(false)
    );
  }, [id, loadAccount, loadTransactions, loadCategories]);

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

  const handleInlineAdd = async (tx: { date: string; amount: number; subcategoryId: number | null; description: string }) => {
    await window.polsa.transactions.create({
      accountId,
      ...tx,
    });
    await refreshAll();
  };

  const handleFormSave = async (tx: { id?: number; date: string; amount: number; subcategoryId: number | null; description: string }) => {
    if (tx.id) {
      await window.polsa.transactions.update(tx);
    } else {
      await window.polsa.transactions.create({ accountId, ...tx });
    }
    await refreshAll();
  };

  const handleFormDelete = async (txId: number) => {
    await window.polsa.transactions.delete(txId);
    await refreshAll();
  };

  const handleImport = async (dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY') => {
    try {
      const filePath = await window.polsa.qif.pickImportFile();
      if (!filePath) return;
      setImportStatus('Importing…');
      const result = await window.polsa.qif.import({ accountId, filePath, dateFormat });
      setImportStatus(`Imported ${result.imported} transaction${result.imported !== 1 ? 's' : ''}`);
      await refreshAll();
      await loadCategories();
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e: any) {
      setImportStatus(`Error: ${e.message}`);
      setTimeout(() => setImportStatus(null), 5000);
    }
    setShowImport(false);
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
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {account.name}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <span className="capitalize">{account.type}</span>
            <span>·</span>
            <span
              className={
                account.currentBalance >= 0
                  ? 'text-[var(--color-positive)]'
                  : 'text-[var(--color-negative)]'
              }
            >
              {formatMoney(account.currentBalance)}
            </span>
            <span className="text-xs">({total} transactions)</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="rounded-lg bg-[var(--color-bg-surface-hover)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border-glass)]"
          >
            Import
          </button>
          <button
            onClick={handleExport}
            className="rounded-lg bg-[var(--color-bg-surface-hover)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border-glass)]"
          >
            Export
          </button>
          <button
            onClick={() => { setEditingTx(null); setShowForm(true); }}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            + Transaction
          </button>
          <button
            onClick={() => navigate(`/accounts/${id}/edit`)}
            className="rounded-lg bg-[var(--color-bg-surface-hover)] px-4 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border-glass)]"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Status message */}
      {importStatus && (
        <div className={`mb-3 rounded-lg px-4 py-2 text-sm flex-shrink-0 ${
          importStatus.startsWith('Error') 
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)]'
        }`}>
          {importStatus}
        </div>
      )}

      {/* Import date format picker modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowImport(false)}>
          <div className="glass-strong w-full max-w-sm rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">Import QIF</h2>
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
              Select the date format used in the QIF file:
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleImport('DD/MM/YYYY')}
                className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                DD/MM/YYYY
              </button>
              <button
                onClick={() => handleImport('MM/DD/YYYY')}
                className="flex-1 rounded-lg bg-[var(--color-bg-surface-hover)] px-4 py-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-glass)] transition-colors"
              >
                MM/DD/YYYY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction table */}
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
              <th className="px-3 py-3 w-44">Category</th>
              <th className="px-3 py-3 w-28 text-right">Amount</th>
              <th className="px-3 py-3 w-28 text-right">Balance</th>
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
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  No transactions yet. Use the row above to add your first transaction.
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

      {/* Transaction form modal */}
      {showForm && (
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
