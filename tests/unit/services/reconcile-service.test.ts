// tests/unit/services/reconcile-service.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

import {
  getReconciledBalance,
  getUnreconciledTransactions,
  confirmReconciliation,
} from '../../../src/main/services/reconcile-service';

function setupTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Apply migrations
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

function createTestTransaction(
  db: Database.Database,
  accountId: number,
  amount: number,
  date = '2024-01-15',
  reconciled = 0,
): number {
  db.prepare(
    "INSERT INTO transactions (account_id, date, amount, description, reconciled) VALUES (?, ?, ?, ?, ?)"
  ).run(accountId, date, amount, 'Test tx', reconciled);
  return (db.prepare("SELECT last_insert_rowid() as id").get() as any).id;
}

describe('reconcile-service', () => {
  let accountId: number;

  beforeEach(() => {
    testDb = setupTestDb();
    accountId = createTestAccount(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('getReconciledBalance', () => {
    it('returns starting balance when no transactions', () => {
      const result = getReconciledBalance(accountId);
      expect(result.reconciledBalance).toBe(10000);
    });

    it('returns starting balance when no reconciled transactions', () => {
      createTestTransaction(testDb, accountId, 5000, '2024-01-10', 0);
      createTestTransaction(testDb, accountId, -2000, '2024-01-11', 0);

      const result = getReconciledBalance(accountId);
      expect(result.reconciledBalance).toBe(10000); // Only starting_balance
    });

    it('includes reconciled transactions in balance', () => {
      createTestTransaction(testDb, accountId, 5000, '2024-01-10', 1);
      createTestTransaction(testDb, accountId, -2000, '2024-01-11', 1);
      createTestTransaction(testDb, accountId, 3000, '2024-01-12', 0); // unreconciled

      const result = getReconciledBalance(accountId);
      // 10000 + 5000 - 2000 = 13000 (ignores unreconciled 3000)
      expect(result.reconciledBalance).toBe(13000);
    });

    it('handles all transactions reconciled', () => {
      createTestTransaction(testDb, accountId, 5000, '2024-01-10', 1);
      createTestTransaction(testDb, accountId, -2000, '2024-01-11', 1);

      const result = getReconciledBalance(accountId);
      expect(result.reconciledBalance).toBe(13000);
    });

    it('throws for non-existent account', () => {
      expect(() => getReconciledBalance(999)).toThrow('Account 999 not found');
    });

    it('handles negative starting balance', () => {
      const accId = createTestAccount(testDb, 'Negative', -5000);
      createTestTransaction(testDb, accId, 2000, '2024-01-10', 1);

      const result = getReconciledBalance(accId);
      expect(result.reconciledBalance).toBe(-3000);
    });

    it('handles zero starting balance', () => {
      const accId = createTestAccount(testDb, 'Zero', 0);

      const result = getReconciledBalance(accId);
      expect(result.reconciledBalance).toBe(0);
    });
  });

  describe('getUnreconciledTransactions', () => {
    it('returns empty list when no transactions', () => {
      const result = getUnreconciledTransactions(accountId, 0, 50);
      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns only unreconciled transactions', () => {
      createTestTransaction(testDb, accountId, 5000, '2024-01-10', 1);
      createTestTransaction(testDb, accountId, -2000, '2024-01-11', 0);
      createTestTransaction(testDb, accountId, 3000, '2024-01-12', 0);

      const result = getUnreconciledTransactions(accountId, 0, 50);
      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
      // All should be unreconciled
      expect(result.transactions.every((t) => !t.reconciled)).toBe(true);
    });

    it('returns transactions sorted by date descending', () => {
      createTestTransaction(testDb, accountId, 1000, '2024-01-10', 0);
      createTestTransaction(testDb, accountId, 2000, '2024-01-20', 0);
      createTestTransaction(testDb, accountId, 3000, '2024-01-15', 0);

      const result = getUnreconciledTransactions(accountId, 0, 50);
      expect(result.transactions[0].date).toBe('2024-01-20');
      expect(result.transactions[1].date).toBe('2024-01-15');
      expect(result.transactions[2].date).toBe('2024-01-10');
    });

    it('paginates correctly', () => {
      createTestTransaction(testDb, accountId, 1000, '2024-01-10', 0);
      createTestTransaction(testDb, accountId, 2000, '2024-01-15', 0);
      createTestTransaction(testDb, accountId, 3000, '2024-01-20', 0);

      const page1 = getUnreconciledTransactions(accountId, 0, 2);
      expect(page1.transactions).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = getUnreconciledTransactions(accountId, 2, 2);
      expect(page2.transactions).toHaveLength(1);
      expect(page2.total).toBe(3);
    });

    it('returns empty when all transactions are reconciled', () => {
      createTestTransaction(testDb, accountId, 5000, '2024-01-10', 1);
      createTestTransaction(testDb, accountId, -2000, '2024-01-11', 1);

      const result = getUnreconciledTransactions(accountId, 0, 50);
      expect(result.transactions).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('throws for non-existent account', () => {
      expect(() => getUnreconciledTransactions(999, 0, 50)).toThrow('Account 999 not found');
    });

    it('includes category info', () => {
      testDb.prepare("INSERT INTO categories (name) VALUES (?)").run('Food');
      const catId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;
      testDb.prepare("INSERT INTO subcategories (category_id, name) VALUES (?, ?)").run(catId, 'Groceries');
      const subId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;

      testDb.prepare(
        "INSERT INTO transactions (account_id, date, amount, subcategory_id, description, reconciled) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(accountId, '2024-01-10', -5000, subId, 'Shop', 0);

      const result = getUnreconciledTransactions(accountId, 0, 50);
      expect(result.transactions[0].categoryName).toBe('Food');
      expect(result.transactions[0].subcategoryName).toBe('Groceries');
    });
  });

  describe('confirmReconciliation', () => {
    it('marks transactions as reconciled', () => {
      const tx1 = createTestTransaction(testDb, accountId, 5000, '2024-01-10', 0);
      const tx2 = createTestTransaction(testDb, accountId, -2000, '2024-01-11', 0);

      const result = confirmReconciliation([tx1, tx2]);
      expect(result.reconciled).toBe(2);

      // Verify they're reconciled in DB
      const rows = testDb.prepare(
        'SELECT reconciled FROM transactions WHERE id IN (?, ?)'
      ).all(tx1, tx2) as Array<{ reconciled: number }>;
      expect(rows.every((r) => r.reconciled === 1)).toBe(true);
    });

    it('does not affect other transactions', () => {
      const tx1 = createTestTransaction(testDb, accountId, 5000, '2024-01-10', 0);
      const tx2 = createTestTransaction(testDb, accountId, -2000, '2024-01-11', 0);
      const tx3 = createTestTransaction(testDb, accountId, 3000, '2024-01-12', 0);

      confirmReconciliation([tx1]);

      const row = testDb.prepare('SELECT reconciled FROM transactions WHERE id = ?').get(tx3) as { reconciled: number };
      expect(row.reconciled).toBe(0);
    });

    it('rejects empty array', () => {
      expect(() => confirmReconciliation([])).toThrow('At least one transaction ID is required');
    });

    it('rejects non-existent transactions', () => {
      expect(() => confirmReconciliation([999])).toThrow('Transaction(s) not found: 999');
    });

    it('rejects already reconciled transactions', () => {
      const tx = createTestTransaction(testDb, accountId, 5000, '2024-01-10', 1);
      expect(() => confirmReconciliation([tx])).toThrow('already reconciled');
    });

    it('rejects transactions from different accounts', () => {
      const acc2 = createTestAccount(testDb, 'Other', 5000);
      const tx1 = createTestTransaction(testDb, accountId, 5000, '2024-01-10', 0);
      const tx2 = createTestTransaction(testDb, acc2, -2000, '2024-01-11', 0);

      expect(() => confirmReconciliation([tx1, tx2])).toThrow('same account');
    });

    it('reconciles a single transaction', () => {
      const tx = createTestTransaction(testDb, accountId, 5000, '2024-01-10', 0);
      const result = confirmReconciliation([tx]);
      expect(result.reconciled).toBe(1);
    });

    it('updates reconciled balance after confirmation', () => {
      const tx = createTestTransaction(testDb, accountId, 5000, '2024-01-10', 0);

      // Before
      expect(getReconciledBalance(accountId).reconciledBalance).toBe(10000);

      confirmReconciliation([tx]);

      // After
      expect(getReconciledBalance(accountId).reconciledBalance).toBe(15000);
    });

    it('is atomic — rolls back on error', () => {
      const tx1 = createTestTransaction(testDb, accountId, 5000, '2024-01-10', 0);

      // Include a non-existent ID to force error
      expect(() => confirmReconciliation([tx1, 999])).toThrow();

      // tx1 should NOT be reconciled (rollback)
      const row = testDb.prepare('SELECT reconciled FROM transactions WHERE id = ?').get(tx1) as { reconciled: number };
      expect(row.reconciled).toBe(0);
    });
  });
});
