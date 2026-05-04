import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDate, formatMoney } from '../lib/format';
import type {
  Account,
  TransactionDisplay,
  CategoryWithSubs,
  ImportFormat,
  ImportPreviewResult,
} from '../lib/types';
import { TRANSACTIONS_PAGE_SIZE } from '@shared/constants';
import TransactionRow from '../components/TransactionRow';
import InlineTransactionInput from '../components/InlineTransactionInput';
import TransactionForm from '../components/TransactionForm';

interface PendingImportPreview extends ImportPreviewResult {
  filePath: string;
}

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
  const [showImportChooser, setShowImportChooser] = useState(false);
  const [pendingImportPreview, setPendingImportPreview] = useState<PendingImportPreview | null>(null);
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<string | null>(null);
  const [isCommittingImport, setIsCommittingImport] = useState(false);
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

  const handleFormDelete = async (txId: number, tx?: TransactionDisplay) => {
    if (tx && tx.transactionType === 'transfer' && tx.transferGroupId) {
      await window.polsa.transactions.deleteTransfer(tx.transferGroupId);
    } else {
      await window.polsa.transactions.delete(txId);
    }
    await refreshAll();
  };

  const handleImport = () => {
    setShowImportChooser(true);
  };

  const handleImportFormatSelect = async (format: ImportFormat) => {
    try {
      const filePath = await window.polsa.imports.pickFile(format);
      if (!filePath) return;

      setShowImportChooser(false);
      setImportStatus('Parsing import…');
      const preview = await window.polsa.imports.preview({ accountId, filePath, format });
      setPendingImportPreview({ ...preview, filePath });
      // If CSV has multiple accounts, require user to choose; otherwise auto-select
      if (format === 'csv' && preview.sourceAccounts && preview.sourceAccounts.length > 1) {
        setSelectedSourceAccount(null);
      } else {
        setSelectedSourceAccount(preview.sourceAccounts?.[0] ?? '');
      }
      setImportStatus(null);
    } catch (e: any) {
      setImportStatus(`Error: ${e.message}`);
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportPreview) return;

    try {
      setIsCommittingImport(true);
      setImportStatus('Importing…');
      const result = await window.polsa.imports.commit({
        accountId,
        filePath: pendingImportPreview.filePath,
        format: pendingImportPreview.format,
        sourceAccount: selectedSourceAccount || undefined,
      });
      setPendingImportPreview(null);
      setSelectedSourceAccount(null);
      setImportStatus(`Imported ${result.imported} transaction${result.imported !== 1 ? 's' : ''}`);
      await refreshAll();
      await loadCategories();
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e: any) {
      setImportStatus(`Error: ${e.message}`);
      setTimeout(() => setImportStatus(null), 5000);
    } finally {
      setIsCommittingImport(false);
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

  // Filter preview transactions by the chosen source account (for CSV multi-account files)
  const filteredPreviewTransactions = pendingImportPreview
    ? (selectedSourceAccount
        ? pendingImportPreview.transactions.filter((t) => t.sourceAccount === selectedSourceAccount)
        : pendingImportPreview.transactions)
    : [];
  const previewRows = filteredPreviewTransactions.slice(0, 50);
  const remainingPreviewCount = Math.max(0, filteredPreviewTransactions.length - previewRows.length);
  const reconciledPreviewCount = filteredPreviewTransactions.filter((t) => t.reconciled).length;
  const netTotal = filteredPreviewTransactions.reduce((sum, t) => sum + t.amount, 0);
  const uncategorisedCount = filteredPreviewTransactions.filter((t) => !t.categoryName).length;

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
          {!account.isClosed && (
            <button
              onClick={handleImport}
              className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
            >
              Import
            </button>
          )}
          <button
            onClick={handleExport}
            className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
          >
            Export
          </button>
          {!account.isClosed && (
            <button
              onClick={() => { setEditingTx(null); setShowForm(true); }}
              className="btn-neon rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide"
            >
              + Transaction
            </button>
          )}
          <button
            onClick={() => navigate(`/accounts/${id}/edit`)}
            className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Closed account banner */}
      {account.isClosed && (
        <div className="mb-3 rounded-lg px-4 py-2 text-xs flex-shrink-0 bg-[var(--color-text-muted)]/10 border border-[var(--color-text-muted)]/20 text-[var(--color-text-muted)]">
          This account is closed. Transactions are read-only. Go to{' '}
          <button
            onClick={() => navigate(`/accounts/${id}/edit`)}
            className="underline hover:text-[var(--color-accent-light)] transition-colors"
          >
            Edit
          </button>{' '}
          to reopen it.
        </div>
      )}

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
            {/* Inline quick-add row — hidden for closed accounts */}
            {!account.isClosed && (
              <InlineTransactionInput
                accountId={accountId}
                categories={categories}
                onSave={handleInlineAdd}
              />
            )}

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
                  {account.isClosed ? 'No transactions.' : 'No transactions yet. Use the row above to add your first.'}
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

      {showImportChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-xl border border-[var(--color-border-glass)] p-6 max-w-md w-full mx-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Choose import format</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Select the file type to import into {account.name}.
              </p>
            </div>
            <div className="grid gap-3">
              <button
                onClick={() => handleImportFormatSelect('qif')}
                className="rounded-lg border border-[var(--color-border-glass)] px-4 py-3 text-left transition-all hover:bg-white/5"
              >
                <div className="text-sm font-medium text-[var(--color-text-primary)]">QIF import</div>
                <div className="text-xs text-[var(--color-text-muted)]">Import transactions from a Quicken Interchange Format file.</div>
              </button>
              <button
                onClick={() => handleImportFormatSelect('csv')}
                className="rounded-lg border border-[var(--color-border-glass)] px-4 py-3 text-left transition-all hover:bg-white/5"
              >
                <div className="text-sm font-medium text-[var(--color-text-primary)]">CSV import</div>
                <div className="text-xs text-[var(--color-text-muted)]">Import Date, Description, Amount, Tags, and Status from the fixed Buxfer CSV format.</div>
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowImportChooser(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border-glass)] hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account picker — shown when CSV has multiple source accounts */}
      {pendingImportPreview && pendingImportPreview.sourceAccounts && pendingImportPreview.sourceAccounts.length > 1 && selectedSourceAccount === null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-xl border border-[var(--color-border-glass)] p-6 max-w-md w-full mx-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Choose source account</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                This file contains transactions from {pendingImportPreview.sourceAccounts.length} accounts.
                Select which account to import into {account.name}.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-2">Source account</label>
              <select
                onChange={(e) => setSelectedSourceAccount(e.currentTarget.value)}
                className="w-full rounded-lg border border-[var(--color-border-glass)] bg-white/5 px-4 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                <option value="">— Select an account —</option>
                {pendingImportPreview.sourceAccounts.map((src) => {
                  const count = pendingImportPreview.transactions.filter((t) => t.sourceAccount === src).length;
                  return (
                    <option key={src} value={src}>
                      {src} ({count} transaction{count !== 1 ? 's' : ''})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPendingImportPreview(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border-glass)] hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImportPreview && selectedSourceAccount !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6">
          <div className="glass rounded-xl border border-[var(--color-border-glass)] w-full max-w-5xl max-h-full overflow-hidden flex flex-col">
            <div className="border-b border-[var(--color-border-glass)] px-6 py-4">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Review import</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Confirm these {filteredPreviewTransactions.length} {pendingImportPreview.format.toUpperCase()} transaction{filteredPreviewTransactions.length !== 1 ? 's' : ''}
                {selectedSourceAccount ? <> from <span className="font-medium text-[var(--color-text-primary)]">{selectedSourceAccount}</span></> : null}
                {' '}before saving them into {account.name}.
              </p>
            </div>

            <div className="grid gap-3 border-b border-[var(--color-border-glass)] px-6 py-4 md:grid-cols-5">
              <div className="rounded-lg border border-[var(--color-border-glass)] bg-white/5 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Transactions</div>
                <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{filteredPreviewTransactions.length}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border-glass)] bg-white/5 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Net total</div>
                <div className={`mt-1 text-lg font-semibold font-mono ${netTotal >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{formatMoney(netTotal)}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border-glass)] bg-white/5 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Reconciled</div>
                <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{reconciledPreviewCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border-glass)] bg-white/5 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Uncategorised</div>
                <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{uncategorisedCount}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border-glass)] bg-white/5 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Categories to create</div>
                <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{pendingImportPreview.createdCategories.length}</div>
              </div>
            </div>

            {pendingImportPreview.createdCategories.length > 0 && (
              <div className="border-b border-[var(--color-border-glass)] px-6 py-3 text-sm text-[var(--color-text-muted)]">
                Creating: {pendingImportPreview.createdCategories.join(', ')}
              </div>
            )}

            <div className="overflow-auto px-6 py-4">
              {pendingImportPreview.transactions.length === 0 || filteredPreviewTransactions.length === 0 ? (
                <div className="rounded-lg border border-[var(--color-border-glass)] bg-white/5 px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  No transactions were found in this file.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border-glass)] text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((transaction, index) => {
                      const categoryLabel = transaction.categoryName
                        ? transaction.subcategoryName
                          ? `${transaction.categoryName} / ${transaction.subcategoryName}`
                          : transaction.categoryName
                        : 'Uncategorised';

                      return (
                        <tr key={`${transaction.date}-${transaction.description}-${transaction.amount}-${index}`} className="border-b border-[var(--color-border-glass)]/60 text-[var(--color-text-primary)] last:border-b-0">
                          <td className="px-3 py-2 align-top text-[var(--color-text-muted)]">{formatDate(transaction.date)}</td>
                          <td className="px-3 py-2 align-top">{transaction.description || ' '}</td>
                          <td className="px-3 py-2 align-top text-[var(--color-text-muted)]">{categoryLabel}</td>
                          <td className="px-3 py-2 align-top text-[var(--color-text-muted)]">{transaction.reconciled ? 'Reconciled' : 'Pending'}</td>
                          <td className={`px-3 py-2 text-right font-mono ${transaction.amount >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                            {formatMoney(transaction.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {remainingPreviewCount > 0 && (
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  Showing the first {previewRows.length} rows. {remainingPreviewCount} more will be imported after confirmation.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--color-border-glass)] px-6 py-4">
              <button
                onClick={() => { setPendingImportPreview(null); setSelectedSourceAccount(null); }}
                disabled={isCommittingImport}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border-glass)] hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isCommittingImport || filteredPreviewTransactions.length === 0}
                className="btn-neon rounded-lg px-4 py-2 text-sm font-semibold tracking-wide disabled:opacity-50"
              >
                {isCommittingImport ? 'Importing…' : 'Confirm import'}
              </button>
            </div>
          </div>
        </div>
      )}

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
