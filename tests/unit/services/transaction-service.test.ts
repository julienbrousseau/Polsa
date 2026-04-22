// tests/unit/services/transaction-service.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

import {
  listTransactions,
  createTransaction,
  createTransfer,
  updateTransfer,
  updateTransaction,
  deleteTransfer,
  deleteTransaction,
} from '../../../src/main/services/transaction-service';

function setupTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const migrationsDir = path.join(__dirname, '../../../src/main/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
  }
  return db;
}

function createTestAccount(db: Database.Database, name = 'Test', startingBalance = 10000): number {
  db.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run(name, 'checking', startingBalance);
  return (db.prepare("SELECT last_insert_rowid() as id").get() as any).id;
}

describe('transaction-service', () => {
  let accountId: number;

  beforeEach(() => {
    testDb = setupTestDb();
    accountId = createTestAccount(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('listTransactions', () => {
    it('returns empty result for account with no transactions', () => {
      const result = listTransactions({ accountId, offset: 0, limit: 50 });
      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.balanceAtOffset).toBe(10000); // starting balance
    });

    it('returns transactions ordered newest first', () => {
      createTransaction({ accountId, date: '2024-01-10', amount: 5000, description: 'First' });
      createTransaction({ accountId, date: '2024-01-20', amount: -2000, description: 'Second' });
      createTransaction({ accountId, date: '2024-01-15', amount: 3000, description: 'Middle' });

      const result = listTransactions({ accountId, offset: 0, limit: 50 });
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].date).toBe('2024-01-20');
      expect(result.transactions[1].date).toBe('2024-01-15');
      expect(result.transactions[2].date).toBe('2024-01-10');
    });

    it('computes running balance correctly', () => {
      createTransaction({ accountId, date: '2024-01-10', amount: 5000, description: 'Income' });
      createTransaction({ accountId, date: '2024-01-20', amount: -2000, description: 'Expense' });

      const result = listTransactions({ accountId, offset: 0, limit: 50 });
      // Current balance = 10000 + 5000 - 2000 = 13000
      expect(result.balanceAtOffset).toBe(13000);
      // First row (newest): running balance = 13000
      expect(result.transactions[0].runningBalance).toBe(13000);
      expect(result.transactions[0].amount).toBe(-2000);
      // Second row: running balance = 13000 - (-2000) = 15000
      expect(result.transactions[1].runningBalance).toBe(15000);
      expect(result.transactions[1].amount).toBe(5000);
    });

    it('paginates correctly', () => {
      // Create 3 transactions
      createTransaction({ accountId, date: '2024-01-10', amount: 1000, description: 'A' });
      createTransaction({ accountId, date: '2024-01-15', amount: 2000, description: 'B' });
      createTransaction({ accountId, date: '2024-01-20', amount: 3000, description: 'C' });

      const page1 = listTransactions({ accountId, offset: 0, limit: 2 });
      expect(page1.transactions).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.transactions[0].description).toBe('C');
      expect(page1.transactions[1].description).toBe('B');

      const page2 = listTransactions({ accountId, offset: 2, limit: 2 });
      expect(page2.transactions).toHaveLength(1);
      expect(page2.transactions[0].description).toBe('A');
    });

    it('includes category info when subcategory assigned', () => {
      testDb.prepare("INSERT INTO categories (name) VALUES (?)").run('Food');
      const catId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;
      testDb.prepare("INSERT INTO subcategories (category_id, name) VALUES (?, ?)").run(catId, 'Groceries');
      const subId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;

      createTransaction({ accountId, date: '2024-01-10', amount: -5000, subcategoryId: subId, description: 'Shop' });

      const result = listTransactions({ accountId, offset: 0, limit: 50 });
      expect(result.transactions[0].categoryName).toBe('Food');
      expect(result.transactions[0].subcategoryName).toBe('Groceries');
    });

    it('includes category info when transaction is assigned directly to parent category', () => {
      testDb.prepare("INSERT INTO categories (name) VALUES (?)").run('Sports');
      const categoryId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;
      testDb.prepare(
        "INSERT INTO transactions (account_id, date, amount, category_id, subcategory_id, description) VALUES (?, ?, ?, ?, NULL, ?)"
      ).run(accountId, '2024-01-11', -3990, categoryId, 'Gym');

      const result = listTransactions({ accountId, offset: 0, limit: 50 });
      expect(result.transactions[0].categoryName).toBe('Sports');
      expect(result.transactions[0].subcategoryName).toBeNull();
    });

    it('hides reconciled transactions by default', () => {
      const tx1 = createTransaction({ accountId, date: '2024-01-10', amount: -1000, description: 'Visible' });
      createTransaction({ accountId, date: '2024-01-11', amount: -2000, description: 'Hidden' });
      testDb.prepare('UPDATE transactions SET reconciled = 1 WHERE id != ?').run(tx1.id);

      const result = listTransactions({ accountId, offset: 0, limit: 50 });
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Visible');
      expect(result.total).toBe(1);
    });

    it('returns reconciled transactions when includeReconciled is true', () => {
      const tx1 = createTransaction({ accountId, date: '2024-01-10', amount: -1000, description: 'Visible' });
      createTransaction({ accountId, date: '2024-01-11', amount: -2000, description: 'Also visible' });
      testDb.prepare('UPDATE transactions SET reconciled = 1 WHERE id != ?').run(tx1.id);

      const result = listTransactions({ accountId, offset: 0, limit: 50, includeReconciled: true });
      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('keeps running balance correct when reconciled rows are hidden', () => {
      const newest = createTransaction({ accountId, date: '2024-01-20', amount: -2000, description: 'Newest hidden' });
      createTransaction({ accountId, date: '2024-01-15', amount: -3000, description: 'Visible middle' });
      createTransaction({ accountId, date: '2024-01-10', amount: 5000, description: 'Visible oldest' });
      testDb.prepare('UPDATE transactions SET reconciled = 1 WHERE id = ?').run(newest.id);

      const result = listTransactions({ accountId, offset: 0, limit: 50 });

      // Account current balance includes all rows: 10000 - 2000 - 3000 + 5000 = 10000
      // Visible middle row should still include the hidden newer reconciled row in its balance.
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].description).toBe('Visible middle');
      expect(result.transactions[0].runningBalance).toBe(12000);
      expect(result.transactions[1].description).toBe('Visible oldest');
      expect(result.transactions[1].runningBalance).toBe(15000);
    });
  });

  describe('createTransaction', () => {
    it('creates a transaction', () => {
      const tx = createTransaction({ accountId, date: '2024-01-15', amount: -5000, description: 'Coffee' });
      expect(tx.id).toBeGreaterThan(0);
      expect(tx.accountId).toBe(accountId);
      expect(tx.date).toBe('2024-01-15');
      expect(tx.amount).toBe(-5000);
      expect(tx.description).toBe('Coffee');
      expect(tx.subcategoryId).toBeNull();
    });

    it('rejects invalid amount', () => {
      expect(() => createTransaction({ accountId, date: '2024-01-15', amount: 10.5, description: '' }))
        .toThrow('Amount must be an integer');
    });

    it('rejects invalid date', () => {
      expect(() => createTransaction({ accountId, date: 'not-a-date', amount: 1000, description: '' }))
        .toThrow('Date must be a valid ISO date');
    });

    it('rejects non-existent account', () => {
      expect(() => createTransaction({ accountId: 999, date: '2024-01-15', amount: 1000, description: '' }))
        .toThrow('Account 999 not found');
    });
  });

  describe('createTransfer', () => {
    it('creates paired transfer transactions across accounts', () => {
      const savingsId = createTestAccount(testDb, 'Savings', 50000);

      const result = createTransfer({
        fromAccountId: accountId,
        toAccountId: savingsId,
        date: '2024-01-20',
        amount: 2500,
        description: 'Move to savings',
      });

      expect(result.outgoing.accountId).toBe(accountId);
      expect(result.outgoing.amount).toBe(-2500);
      expect(result.outgoing.transactionType).toBe('transfer');
      expect(result.outgoing.transferAccountId).toBe(savingsId);

      expect(result.incoming.accountId).toBe(savingsId);
      expect(result.incoming.amount).toBe(2500);
      expect(result.incoming.transactionType).toBe('transfer');
      expect(result.incoming.transferAccountId).toBe(accountId);

      const fromList = listTransactions({ accountId, offset: 0, limit: 50, includeReconciled: true });
      expect(fromList.transactions).toHaveLength(1);
      expect(fromList.transactions[0].transferAccountName).toBe('Savings');

      const toList = listTransactions({ accountId: savingsId, offset: 0, limit: 50, includeReconciled: true });
      expect(toList.transactions).toHaveLength(1);
      expect(toList.transactions[0].transferAccountName).toBe('Test');
    });

    it('rejects transfers to the same account', () => {
      expect(() => createTransfer({
        fromAccountId: accountId,
        toAccountId: accountId,
        date: '2024-01-20',
        amount: 500,
      })).toThrow('Source and destination accounts must be different');
    });
  });

  describe('updateTransaction', () => {
    it('updates a transaction', () => {
      const tx = createTransaction({ accountId, date: '2024-01-15', amount: -1000, description: 'Old' });
      const updated = updateTransaction({ id: tx.id, date: '2024-02-01', amount: -2000, description: 'New' });
      expect(updated.date).toBe('2024-02-01');
      expect(updated.amount).toBe(-2000);
      expect(updated.description).toBe('New');
    });

    it('throws for non-existent transaction', () => {
      expect(() => updateTransaction({ id: 999, date: '2024-01-15', amount: 1000, description: '' }))
        .toThrow('Transaction 999 not found');
    });

    it('rejects updating a transfer transaction', () => {
      const savingsId = createTestAccount(testDb, 'Savings', 0);
      const transfer = createTransfer({
        fromAccountId: accountId,
        toAccountId: savingsId,
        date: '2024-01-20',
        amount: 1000,
      });

      expect(() => updateTransaction({
        id: transfer.outgoing.id,
        date: '2024-01-21',
        amount: -1000,
        description: 'Edited',
      })).toThrow('Transfer transactions cannot be edited individually');
    });
  });

  describe('updateTransfer', () => {
    it('updates both sides of a transfer', () => {
      const savingsId = createTestAccount(testDb, 'Savings', 50000);
      const transfer = createTransfer({
        fromAccountId: accountId,
        toAccountId: savingsId,
        date: '2024-01-20',
        amount: 2500,
        description: 'Move to savings',
      });
      const groupRow = testDb.prepare('SELECT transfer_group_id FROM transactions WHERE id = ?').get(transfer.outgoing.id) as { transfer_group_id: string };
      const updated = updateTransfer({
        groupId: groupRow.transfer_group_id,
        date: '2024-02-01',
        amount: 3000,
        description: 'Updated transfer',
      });
      expect(updated.outgoing.date).toBe('2024-02-01');
      expect(updated.outgoing.amount).toBe(-3000);
      expect(updated.outgoing.description).toBe('Updated transfer');
      expect(updated.incoming.amount).toBe(3000);
      expect(updated.incoming.description).toBe('Updated transfer');
    });

    it('throws for missing or incomplete group', () => {
      expect(() => updateTransfer({
        groupId: 'not-a-real-group',
        date: '2024-01-01',
        amount: 1000,
      })).toThrow('Transfer group not found or incomplete');
    });
  });

  describe('deleteTransfer', () => {
    it('deletes both sides of a transfer', () => {
      const savingsId = createTestAccount(testDb, 'Savings', 50000);
      const transfer = createTransfer({
        fromAccountId: accountId,
        toAccountId: savingsId,
        date: '2024-01-20',
        amount: 2500,
        description: 'Move to savings',
      });
      const groupRow = testDb.prepare('SELECT transfer_group_id FROM transactions WHERE id = ?').get(transfer.outgoing.id) as { transfer_group_id: string };
      deleteTransfer(groupRow.transfer_group_id);
      const fromList = listTransactions({ accountId, offset: 0, limit: 50, includeReconciled: true });
      const toList = listTransactions({ accountId: savingsId, offset: 0, limit: 50, includeReconciled: true });
      expect(fromList.transactions).toHaveLength(0);
      expect(toList.transactions).toHaveLength(0);
    });

    it('throws for missing or incomplete group', () => {
      expect(() => deleteTransfer('not-a-real-group')).toThrow('Transfer group not found or incomplete');
    });
  });

  describe('deleteTransaction', () => {
    it('deletes a transaction', () => {
      const tx = createTransaction({ accountId, date: '2024-01-15', amount: -1000, description: 'Del' });
      deleteTransaction(tx.id);
      const result = listTransactions({ accountId, offset: 0, limit: 50 });
      expect(result.transactions).toHaveLength(0);
    });

    it('throws for non-existent transaction', () => {
      expect(() => deleteTransaction(999)).toThrow('Transaction 999 not found');
    });

    it('rejects deleting a transfer transaction individually', () => {
      const savingsId = createTestAccount(testDb, 'Savings', 0);
      const transfer = createTransfer({
        fromAccountId: accountId,
        toAccountId: savingsId,
        date: '2024-01-20',
        amount: 1200,
      });

      expect(() => deleteTransaction(transfer.outgoing.id))
        .toThrow('Transfer transactions cannot be deleted individually');
    });
  });
});
