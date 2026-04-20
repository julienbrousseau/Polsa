// src/main/services/transaction-service.ts

import { getDb } from '../database';
import type {
  Transaction,
  TransactionDisplay,
  TransactionListResult,
  TransactionListInput,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../../shared/types';
import { isValidInteger, validateTransactionAmount, validateTransactionDate } from '../../shared/validation';

export function listTransactions(input: TransactionListInput): TransactionListResult {
  if (!isValidInteger(input.accountId)) throw new Error('Invalid account ID');
  if (!isValidInteger(input.offset) || input.offset < 0) throw new Error('Invalid offset');
  if (!isValidInteger(input.limit) || input.limit < 1) throw new Error('Invalid limit');

  const db = getDb();

  // Get total count
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total FROM transactions WHERE account_id = ?
  `).get(input.accountId) as { total: number };

  // Get account starting balance
  const accountRow = db.prepare(`
    SELECT starting_balance FROM accounts WHERE id = ?
  `).get(input.accountId) as { starting_balance: number } | undefined;

  if (!accountRow) throw new Error(`Account ${input.accountId} not found`);

  // Balance at offset: starting_balance + SUM of all transactions - SUM of transactions before offset
  // Transactions are ordered by date DESC, id DESC (newest first)
  // balanceAtOffset = starting_balance + SUM(all amounts) - SUM(amounts of first `offset` transactions)
  // This gives us the running balance just before the first row on this page
  const balanceAtOffsetRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_sum FROM transactions WHERE account_id = ?
  `).get(input.accountId) as { total_sum: number };

  const skippedSumRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as skipped_sum
    FROM (
      SELECT amount FROM transactions
      WHERE account_id = ?
      ORDER BY date DESC, id DESC
      LIMIT ?
    )
  `).get(input.accountId, input.offset) as { skipped_sum: number };

  const balanceAtOffset = accountRow.starting_balance + balanceAtOffsetRow.total_sum - skippedSumRow.skipped_sum;

  // Get page of transactions with category info
  const rows = db.prepare(`
    SELECT t.id, t.account_id, t.date, t.amount, t.category_id, t.subcategory_id, t.description, t.reconciled,
           s.name as subcategory_name,
           COALESCE(c_sub.name, c_dir.name) as category_name
    FROM transactions t
    LEFT JOIN subcategories s ON s.id = t.subcategory_id
    LEFT JOIN categories c_sub ON c_sub.id = s.category_id
    LEFT JOIN categories c_dir ON c_dir.id = t.category_id
    WHERE t.account_id = ?
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(input.accountId, input.limit, input.offset) as Array<{
    id: number;
    account_id: number;
    date: string;
    amount: number;
    category_id: number | null;
    subcategory_id: number | null;
    description: string;
    reconciled: number;
    subcategory_name: string | null;
    category_name: string | null;
  }>;

  // Compute running balances for this page
  // The first row has balanceAtOffset, each subsequent row subtracts the previous row's amount
  let runningBalance = balanceAtOffset;
  const transactions: TransactionDisplay[] = rows.map((r) => {
    const tx: TransactionDisplay = {
      id: r.id,
      accountId: r.account_id,
      date: r.date,
      amount: r.amount,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id,
      description: r.description,
      reconciled: r.reconciled === 1,
      categoryName: r.category_name,
      subcategoryName: r.subcategory_name,
      runningBalance,
    };
    runningBalance -= r.amount;
    return tx;
  });

  return {
    transactions,
    total: totalRow.total,
    balanceAtOffset,
  };
}

export function createTransaction(input: CreateTransactionInput): Transaction {
  if (!isValidInteger(input.accountId)) throw new Error('Invalid account ID');
  const amountError = validateTransactionAmount(input.amount);
  if (amountError) throw new Error(amountError);
  const dateError = validateTransactionDate(input.date);
  if (dateError) throw new Error(dateError);

  const db = getDb();

  // Verify account exists
  const account = db.prepare(`SELECT id FROM accounts WHERE id = ?`).get(input.accountId);
  if (!account) throw new Error(`Account ${input.accountId} not found`);

  // Verify subcategory exists if provided
  if (input.subcategoryId != null) {
    if (!isValidInteger(input.subcategoryId)) throw new Error('Invalid subcategory ID');
    const sub = db.prepare(`SELECT id FROM subcategories WHERE id = ?`).get(input.subcategoryId);
    if (!sub) throw new Error(`Subcategory ${input.subcategoryId} not found`);
  }

  // Verify category exists if provided (and subcategory not set)
  if (input.categoryId != null && input.subcategoryId == null) {
    if (!isValidInteger(input.categoryId)) throw new Error('Invalid category ID');
    const cat = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(input.categoryId);
    if (!cat) throw new Error(`Category ${input.categoryId} not found`);
  }

  // subcategoryId takes precedence; when set, derive category from it
  const resolvedCategoryId = input.subcategoryId != null ? null : (input.categoryId ?? null);

  const result = db.prepare(`
    INSERT INTO transactions (account_id, date, amount, category_id, subcategory_id, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.accountId, input.date, input.amount, resolvedCategoryId, input.subcategoryId ?? null, input.description || '');

  return getTransaction(result.lastInsertRowid as number);
}

export function updateTransaction(input: UpdateTransactionInput): Transaction {
  if (!isValidInteger(input.id)) throw new Error('Invalid transaction ID');
  const amountError = validateTransactionAmount(input.amount);
  if (amountError) throw new Error(amountError);
  const dateError = validateTransactionDate(input.date);
  if (dateError) throw new Error(dateError);

  const db = getDb();

  // Verify subcategory exists if provided
  if (input.subcategoryId != null) {
    if (!isValidInteger(input.subcategoryId)) throw new Error('Invalid subcategory ID');
    const sub = db.prepare(`SELECT id FROM subcategories WHERE id = ?`).get(input.subcategoryId);
    if (!sub) throw new Error(`Subcategory ${input.subcategoryId} not found`);
  }

  // Verify category exists if provided (and subcategory not set)
  if (input.categoryId != null && input.subcategoryId == null) {
    if (!isValidInteger(input.categoryId)) throw new Error('Invalid category ID');
    const cat = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(input.categoryId);
    if (!cat) throw new Error(`Category ${input.categoryId} not found`);
  }

  // subcategoryId takes precedence; when set, category_id is NULL
  const resolvedCategoryId = input.subcategoryId != null ? null : (input.categoryId ?? null);

  const changes = db.prepare(`
    UPDATE transactions
    SET date = ?, amount = ?, subcategory_id = ?, category_id = ?, description = ?
    WHERE id = ?
  `).run(input.date, input.amount, input.subcategoryId ?? null, resolvedCategoryId, input.description || '', input.id);

  if (changes.changes === 0) throw new Error(`Transaction ${input.id} not found`);

  return getTransaction(input.id);
}

export function deleteTransaction(id: number): void {
  if (!isValidInteger(id)) throw new Error('Invalid transaction ID');
  const db = getDb();
  const changes = db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
  if (changes.changes === 0) throw new Error(`Transaction ${id} not found`);
}

function getTransaction(id: number): Transaction {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, account_id, date, amount, category_id, subcategory_id, description, reconciled
    FROM transactions WHERE id = ?
  `).get(id) as {
    id: number;
    account_id: number;
    date: string;
    amount: number;
    category_id: number | null;
    subcategory_id: number | null;
    description: string;
    reconciled: number;
  } | undefined;

  if (!row) throw new Error(`Transaction ${id} not found`);

  return {
    id: row.id,
    accountId: row.account_id,
    date: row.date,
    amount: row.amount,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    description: row.description,
    reconciled: row.reconciled === 1,
  };
}
