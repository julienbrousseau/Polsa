// tests/unit/services/sync-service.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { vi } from 'vitest';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

import {
  importMobileTransactions,
  generateDesktopPayload,
  type MobileSyncPayload,
} from '../../../src/main/services/sync-service';

function setupTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Apply all migrations in order
  const migrationsDir = path.join(__dirname, '../../../src/main/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      db.exec(stmt);
    }
  }

  return db;
}

function seedData(db: Database.Database) {
  db.prepare(`INSERT INTO accounts (id, name, type, starting_balance) VALUES (1, 'Current', 'checking', 100000)`).run();
  db.prepare(`INSERT INTO accounts (id, name, type, starting_balance) VALUES (2, 'Savings', 'savings', 500000)`).run();
  db.prepare(`INSERT INTO categories (id, name) VALUES (1, 'Food')`).run();
  db.prepare(`INSERT INTO subcategories (id, category_id, name) VALUES (1, 1, 'Groceries')`).run();
  db.prepare(`INSERT INTO subcategories (id, category_id, name) VALUES (2, 1, 'Eating Out')`).run();
}

describe('sync-service', () => {
  beforeEach(() => {
    testDb = setupTestDb();
    seedData(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('importMobileTransactions', () => {
    it('imports valid transactions', () => {
      const payload: MobileSyncPayload = {
        version: 1,
        transactions: [
          {
            id: 'uuid-001',
            accountId: 1,
            date: '2026-04-20',
            amount: -4520,
            subcategoryId: 1,
            description: 'Tesco',
          },
          {
            id: 'uuid-002',
            accountId: 1,
            date: '2026-04-19',
            amount: -380,
            subcategoryId: null,
            description: 'Coffee',
          },
        ],
      };

      const result = importMobileTransactions(payload);
      expect(result.imported).toBe(2);
      expect(result.duplicates).toBe(0);

      // Verify transactions were inserted
      const txs = testDb.prepare('SELECT * FROM transactions ORDER BY id').all() as any[];
      expect(txs).toHaveLength(2);
      expect(txs[0].mobile_id).toBe('uuid-001');
      expect(txs[0].amount).toBe(-4520);
      expect(txs[0].subcategory_id).toBe(1);
      expect(txs[1].mobile_id).toBe('uuid-002');
      expect(txs[1].subcategory_id).toBe(null);
    });

    it('skips duplicate transactions by mobile_id', () => {
      const payload: MobileSyncPayload = {
        version: 1,
        transactions: [
          { id: 'uuid-001', accountId: 1, date: '2026-04-20', amount: -4520, subcategoryId: null, description: 'Tesco' },
        ],
      };

      // Import once
      importMobileTransactions(payload);
      // Import same again
      const result = importMobileTransactions(payload);
      expect(result.imported).toBe(0);
      expect(result.duplicates).toBe(1);

      const txs = testDb.prepare('SELECT * FROM transactions').all();
      expect(txs).toHaveLength(1);
    });

    it('skips transactions for non-existent accounts', () => {
      const payload: MobileSyncPayload = {
        version: 1,
        transactions: [
          { id: 'uuid-001', accountId: 999, date: '2026-04-20', amount: -100, subcategoryId: null, description: 'Test' },
        ],
      };

      const result = importMobileTransactions(payload);
      expect(result.imported).toBe(0);
      expect(result.duplicates).toBe(0);
    });

    it('imports with null subcategory when subcategory not found', () => {
      const payload: MobileSyncPayload = {
        version: 1,
        transactions: [
          { id: 'uuid-001', accountId: 1, date: '2026-04-20', amount: -100, subcategoryId: 999, description: 'Deleted cat' },
        ],
      };

      const result = importMobileTransactions(payload);
      expect(result.imported).toBe(1);

      const tx = testDb.prepare('SELECT subcategory_id FROM transactions WHERE mobile_id = ?').get('uuid-001') as any;
      expect(tx.subcategory_id).toBe(null);
    });

    it('handles empty transaction list', () => {
      const payload: MobileSyncPayload = {
        version: 1,
        transactions: [],
      };

      const result = importMobileTransactions(payload);
      expect(result.imported).toBe(0);
      expect(result.duplicates).toBe(0);
    });

    it('stores amounts as integers (cents)', () => {
      const payload: MobileSyncPayload = {
        version: 1,
        transactions: [
          { id: 'uuid-001', accountId: 1, date: '2026-04-20', amount: -99, subcategoryId: null, description: 'Test' },
          { id: 'uuid-002', accountId: 1, date: '2026-04-20', amount: 1200, subcategoryId: null, description: 'Refund' },
        ],
      };

      importMobileTransactions(payload);

      const txs = testDb.prepare('SELECT amount FROM transactions ORDER BY mobile_id').all() as any[];
      expect(txs[0].amount).toBe(-99);
      expect(txs[1].amount).toBe(1200);
    });

    it('rejects unsupported version', () => {
      const payload = { version: 2, transactions: [] } as any;
      expect(() => importMobileTransactions(payload)).toThrow('Unsupported sync payload version');
    });
  });

  describe('generateDesktopPayload', () => {
    it('returns all accounts with balances', () => {
      // Add a transaction to affect balance
      testDb.prepare(`INSERT INTO transactions (account_id, date, amount, description) VALUES (1, '2026-04-20', -5000, 'Test')`).run();

      const payload = generateDesktopPayload([]);
      expect(payload.version).toBe(1);
      expect(payload.accounts).toHaveLength(2);

      const current = payload.accounts.find(a => a.id === 1)!;
      expect(current.name).toBe('Current');
      expect(current.currentBalance).toBe(95000); // 100000 - 5000
    });

    it('returns all categories and subcategories', () => {
      const payload = generateDesktopPayload([]);
      expect(payload.categories).toHaveLength(1);
      expect(payload.categories[0].name).toBe('Food');
      expect(payload.subcategories).toHaveLength(2);
      expect(payload.subcategories.map(s => s.name).sort()).toEqual(['Eating Out', 'Groceries']);
    });

    it('includes synced IDs', () => {
      const payload = generateDesktopPayload(['uuid-001', 'uuid-002']);
      expect(payload.syncedIds).toEqual(['uuid-001', 'uuid-002']);
    });
  });
});
