// src/main/services/reconcile-service.ts

import { getDb } from '../database';
import type {
  TransactionDisplay,
  ReconcileBalanceResult,
  ReconcileConfirmResult,
} from '../../shared/types';
import { isValidInteger } from '../../shared/validation';

export function getReconciledBalance(accountId: number): ReconcileBalanceResult {
  if (!isValidInteger(accountId)) throw new Error('Invalid account ID');

  const db = getDb();

  const row = db.prepare(`
    SELECT a.starting_balance + COALESCE(SUM(t.amount), 0) AS reconciled_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id AND t.reconciled = 1
    WHERE a.id = ?
  `).get(accountId) as { reconciled_balance: number } | undefined;

  if (!row || row.reconciled_balance === null) {
    throw new Error(`Account ${accountId} not found`);
  }

  return { reconciledBalance: row.reconciled_balance };
}

export function getUnreconciledTransactions(
  accountId: number,
  offset: number,
  limit: number,
): { transactions: TransactionDisplay[]; total: number } {
  if (!isValidInteger(accountId)) throw new Error('Invalid account ID');
  if (!isValidInteger(offset) || offset < 0) throw new Error('Invalid offset');
  if (!isValidInteger(limit) || limit < 1) throw new Error('Invalid limit');

  const db = getDb();

  // Verify account exists
  const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const totalRow = db.prepare(`
    SELECT COUNT(*) as total FROM transactions WHERE account_id = ? AND reconciled = 0
  `).get(accountId) as { total: number };

  const rows = db.prepare(`
    SELECT t.id, t.account_id, t.date, t.amount, t.subcategory_id, t.description, t.reconciled,
        s.name AS subcategory_name,
        COALESCE(c_sub.name, c_dir.name) AS category_name
    FROM transactions t
    LEFT JOIN subcategories s ON t.subcategory_id = s.id
      LEFT JOIN categories c_sub ON c_sub.id = s.category_id
      LEFT JOIN categories c_dir ON c_dir.id = t.category_id
    WHERE t.account_id = ? AND t.reconciled = 0
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(accountId, limit, offset) as Array<{
    id: number;
    account_id: number;
    date: string;
    amount: number;
    subcategory_id: number | null;
    description: string;
    reconciled: number;
    subcategory_name: string | null;
    category_name: string | null;
  }>;

  const transactions: TransactionDisplay[] = rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    date: r.date,
    amount: r.amount,
    subcategoryId: r.subcategory_id,
    description: r.description,
    reconciled: r.reconciled === 1,
    categoryName: r.category_name,
    subcategoryName: r.subcategory_name,
    runningBalance: 0, // Not relevant in reconciliation context
  }));

  return { transactions, total: totalRow.total };
}

export function confirmReconciliation(transactionIds: number[]): ReconcileConfirmResult {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    throw new Error('At least one transaction ID is required');
  }

  for (const id of transactionIds) {
    if (!isValidInteger(id)) throw new Error(`Invalid transaction ID: ${id}`);
  }

  const db = getDb();

  const result = db.transaction(() => {
    // Verify all transactions exist and belong to the same account
    const placeholders = transactionIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT id, account_id, reconciled FROM transactions WHERE id IN (${placeholders})
    `).all(...transactionIds) as Array<{ id: number; account_id: number; reconciled: number }>;

    if (rows.length !== transactionIds.length) {
      const found = new Set(rows.map(r => r.id));
      const missing = transactionIds.filter(id => !found.has(id));
      throw new Error(`Transaction(s) not found: ${missing.join(', ')}`);
    }

    // Verify all belong to the same account
    const accountIds = new Set(rows.map(r => r.account_id));
    if (accountIds.size > 1) {
      throw new Error('All transactions must belong to the same account');
    }

    // Verify none are already reconciled
    const alreadyReconciled = rows.filter(r => r.reconciled === 1);
    if (alreadyReconciled.length > 0) {
      throw new Error(`Transaction(s) already reconciled: ${alreadyReconciled.map(r => r.id).join(', ')}`);
    }

    // Mark all as reconciled
    const updateStmt = db.prepare('UPDATE transactions SET reconciled = 1 WHERE id = ?');
    for (const id of transactionIds) {
      updateStmt.run(id);
    }

    return transactionIds.length;
  })();

  return { reconciled: result };
}
