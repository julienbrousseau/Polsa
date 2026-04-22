// src/main/services/transaction-service.ts

import { getDb } from '../database';
import { randomUUID } from 'crypto';
import type {
  Transaction,
  TransactionDisplay,
  TransactionListResult,
  TransactionListInput,
  CreateTransactionInput,
  CreateTransferInput,
  UpdateTransactionInput,
} from '../../shared/types';
import { isValidInteger, validateTransactionAmount, validateTransactionDate } from '../../shared/validation';

export function listTransactions(input: TransactionListInput): TransactionListResult {
  if (!isValidInteger(input.accountId)) throw new Error('Invalid account ID');
  if (!isValidInteger(input.offset) || input.offset < 0) throw new Error('Invalid offset');
  if (!isValidInteger(input.limit) || input.limit < 1) throw new Error('Invalid limit');
  if (input.includeReconciled != null && typeof input.includeReconciled !== 'boolean') {
    throw new Error('Invalid includeReconciled flag');
  }

  const db = getDb();
  const includeReconciled = input.includeReconciled === true;

  // Get total count
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM transactions
    WHERE account_id = ?
      AND (? = 1 OR reconciled = 0)
  `).get(input.accountId, includeReconciled ? 1 : 0) as { total: number };

  // Get account starting balance
  const accountRow = db.prepare(`
    SELECT starting_balance FROM accounts WHERE id = ?
  `).get(input.accountId) as { starting_balance: number } | undefined;

  if (!accountRow) throw new Error(`Account ${input.accountId} not found`);

  // Running balances must always include every transaction in the account, even when
  // reconciled rows are hidden from the list.
  const currentBalanceRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_sum
    FROM transactions
    WHERE account_id = ?
  `).get(input.accountId) as { total_sum: number };

  const currentBalance = accountRow.starting_balance + currentBalanceRow.total_sum;

  // Get page of transactions with category info
  const rows = db.prepare(`
    SELECT t.id, t.account_id, t.date, t.amount, t.transaction_type, t.transfer_account_id, t.category_id, t.subcategory_id, t.description, t.reconciled,
           s.name as subcategory_name,
           COALESCE(c_sub.name, c_dir.name) as category_name,
           ta.name as transfer_account_name,
           (
             ? - COALESCE((
               SELECT SUM(t2.amount)
               FROM transactions t2
               WHERE t2.account_id = t.account_id
                 AND (
                   t2.date > t.date
                   OR (t2.date = t.date AND t2.id > t.id)
                 )
             ), 0)
           ) as running_balance
    FROM transactions t
    LEFT JOIN subcategories s ON s.id = t.subcategory_id
    LEFT JOIN categories c_sub ON c_sub.id = s.category_id
    LEFT JOIN categories c_dir ON c_dir.id = t.category_id
    LEFT JOIN accounts ta ON ta.id = t.transfer_account_id
    WHERE t.account_id = ?
      AND (? = 1 OR t.reconciled = 0)
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(currentBalance, input.accountId, includeReconciled ? 1 : 0, input.limit, input.offset) as Array<{
    id: number;
    account_id: number;
    date: string;
    amount: number;
    transaction_type: 'standard' | 'transfer';
    transfer_account_id: number | null;
    category_id: number | null;
    subcategory_id: number | null;
    description: string;
    reconciled: number;
    subcategory_name: string | null;
    category_name: string | null;
    transfer_account_name: string | null;
    running_balance: number;
  }>;

  const transactions: TransactionDisplay[] = rows.map((r) => {
    return {
      id: r.id,
      accountId: r.account_id,
      date: r.date,
      amount: r.amount,
      transactionType: r.transaction_type,
      transferAccountId: r.transfer_account_id,
      categoryId: r.category_id,
      subcategoryId: r.subcategory_id,
      description: r.description,
      reconciled: r.reconciled === 1,
      categoryName: r.category_name,
      subcategoryName: r.subcategory_name,
      transferAccountName: r.transfer_account_name,
      runningBalance: r.running_balance,
    };
  });

  const balanceAtOffset = transactions.length > 0 ? transactions[0].runningBalance : currentBalance;

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
    INSERT INTO transactions (
      account_id, date, amount, transaction_type, transfer_account_id, transfer_group_id,
      category_id, subcategory_id, description
    )
    VALUES (?, ?, ?, 'standard', NULL, NULL, ?, ?, ?)
  `).run(input.accountId, input.date, input.amount, resolvedCategoryId, input.subcategoryId ?? null, input.description || '');

  return getTransaction(result.lastInsertRowid as number);
}

export function createTransfer(input: CreateTransferInput): { outgoing: Transaction; incoming: Transaction } {
  if (!isValidInteger(input.fromAccountId)) throw new Error('Invalid source account ID');
  if (!isValidInteger(input.toAccountId)) throw new Error('Invalid destination account ID');
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('Source and destination accounts must be different');
  }

  const amountError = validateTransactionAmount(input.amount);
  if (amountError) throw new Error(amountError);
  if (input.amount <= 0) throw new Error('Transfer amount must be greater than zero');

  const dateError = validateTransactionDate(input.date);
  if (dateError) throw new Error(dateError);

  const db = getDb();
  const fromAccount = db.prepare('SELECT id, name FROM accounts WHERE id = ?').get(input.fromAccountId) as { id: number; name: string } | undefined;
  if (!fromAccount) throw new Error(`Account ${input.fromAccountId} not found`);

  const toAccount = db.prepare('SELECT id, name FROM accounts WHERE id = ?').get(input.toAccountId) as { id: number; name: string } | undefined;
  if (!toAccount) throw new Error(`Account ${input.toAccountId} not found`);

  const groupId = randomUUID();
  const customDescription = input.description?.trim();
  const outgoingDescription = customDescription && customDescription.length > 0
    ? customDescription
    : `Transfer to ${toAccount.name}`;
  const incomingDescription = customDescription && customDescription.length > 0
    ? customDescription
    : `Transfer from ${fromAccount.name}`;

  const insertTransfer = db.prepare(`
    INSERT INTO transactions (
      account_id, date, amount, transaction_type, transfer_account_id, transfer_group_id,
      category_id, subcategory_id, description
    )
    VALUES (?, ?, ?, 'transfer', ?, ?, NULL, NULL, ?)
  `);

  const result = db.transaction(() => {
    const outgoingResult = insertTransfer.run(
      input.fromAccountId,
      input.date,
      -input.amount,
      input.toAccountId,
      groupId,
      outgoingDescription,
    );
    const incomingResult = insertTransfer.run(
      input.toAccountId,
      input.date,
      input.amount,
      input.fromAccountId,
      groupId,
      incomingDescription,
    );

    return {
      outgoingId: outgoingResult.lastInsertRowid as number,
      incomingId: incomingResult.lastInsertRowid as number,
    };
  })();

  return {
    outgoing: getTransaction(result.outgoingId),
    incoming: getTransaction(result.incomingId),
  };
}

export interface UpdateTransferInput {
  groupId: string;
  date: string;
  amount: number;
  description?: string;
}

export function updateTransfer(input: UpdateTransferInput): { outgoing: Transaction; incoming: Transaction } {
  if (!input.groupId) throw new Error('Transfer groupId required');
  const dateError = validateTransactionDate(input.date);
  if (dateError) throw new Error(dateError);
  const amountError = validateTransactionAmount(input.amount);
  if (amountError) throw new Error(amountError);
  if (input.amount <= 0) throw new Error('Transfer amount must be greater than zero');

  const db = getDb();
  const txs = db.prepare('SELECT id, amount FROM transactions WHERE transfer_group_id = ? ORDER BY amount').all(input.groupId) as Array<{ id: number; amount: number }>;
  if (txs.length !== 2) throw new Error('Transfer group not found or incomplete');

  const [outgoing, incoming] = txs[0].amount < 0 ? [txs[0], txs[1]] : [txs[1], txs[0]];
  if (!outgoing || !incoming) throw new Error('Transfer group not found or incomplete');

  db.transaction(() => {
    db.prepare('UPDATE transactions SET date = ?, amount = ?, description = ? WHERE id = ?')
      .run(input.date, -Math.abs(input.amount), input.description ?? '', outgoing.id);
    db.prepare('UPDATE transactions SET date = ?, amount = ?, description = ? WHERE id = ?')
      .run(input.date, Math.abs(input.amount), input.description ?? '', incoming.id);
  })();

  return {
    outgoing: getTransaction(outgoing.id),
    incoming: getTransaction(incoming.id),
  };
}

export function deleteTransfer(groupId: string): void {
  if (!groupId) throw new Error('Transfer groupId required');
  const db = getDb();
  const txs = db.prepare('SELECT id FROM transactions WHERE transfer_group_id = ?').all(groupId) as Array<{ id: number }>;
  if (txs.length !== 2) throw new Error('Transfer group not found or incomplete');

  db.transaction(() => {
    for (const tx of txs) {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
    }
  })();
}

export function updateTransaction(input: UpdateTransactionInput): Transaction {
  if (!isValidInteger(input.id)) throw new Error('Invalid transaction ID');
  const amountError = validateTransactionAmount(input.amount);
  if (amountError) throw new Error(amountError);
  const dateError = validateTransactionDate(input.date);
  if (dateError) throw new Error(dateError);

  const db = getDb();

  const existing = db.prepare('SELECT transaction_type FROM transactions WHERE id = ?').get(input.id) as {
    transaction_type: 'standard' | 'transfer';
  } | undefined;
  if (!existing) throw new Error(`Transaction ${input.id} not found`);
  if (existing.transaction_type === 'transfer') {
    throw new Error('Transfer transactions cannot be edited individually');
  }

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

  return getTransaction(input.id);
}

export function deleteTransaction(id: number): void {
  if (!isValidInteger(id)) throw new Error('Invalid transaction ID');
  const db = getDb();

  const existing = db.prepare('SELECT transaction_type FROM transactions WHERE id = ?').get(id) as {
    transaction_type: 'standard' | 'transfer';
  } | undefined;
  if (!existing) throw new Error(`Transaction ${id} not found`);
  if (existing.transaction_type === 'transfer') {
    throw new Error('Transfer transactions cannot be deleted individually');
  }

  const changes = db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
  if (changes.changes === 0) throw new Error(`Transaction ${id} not found`);
}

function getTransaction(id: number): Transaction {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, account_id, date, amount, transaction_type, transfer_account_id, category_id, subcategory_id, description, reconciled
    FROM transactions WHERE id = ?
  `).get(id) as {
    id: number;
    account_id: number;
    date: string;
    amount: number;
    transaction_type: 'standard' | 'transfer';
    transfer_account_id: number | null;
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
    transactionType: row.transaction_type,
    transferAccountId: row.transfer_account_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    description: row.description,
    reconciled: row.reconciled === 1,
  };
}
