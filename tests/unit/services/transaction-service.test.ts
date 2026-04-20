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
  updateTransaction,
  deleteTransaction,
} from '../../../src/main/services/transaction-service';

function setupTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const sql = fs.readFileSync(path.join(__dirname, '../../../src/main/migrations/001_initial.sql'), 'utf-8');
  db.exec(sql);
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
  });
});
