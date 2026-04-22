import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

import {
  commitImport,
  parseCsvFile,
  previewImport,
} from '../../../src/main/services/import-service';

function setupTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const migrationsDir = path.join(__dirname, '../../../src/main/migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
  }
  return db;
}

function createTestAccount(db: Database.Database): number {
  db.prepare('INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)').run('Current account', 'checking', 0);
  return (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
}

describe('import-service', () => {
  describe('parseCsvFile', () => {
    it('parses the fixed Buxfer CSV format', () => {
      const transactions = parseCsvFile([
        'ID,Date,Description,Currency,Amount,Type,Tags,Account,Status,Memo,IOU',
        '1,2023-12-31,"Location Frozen II Apple TV",GBP,-4.99,Expense,"Loisirs / Cinema","Current account",Reconciled," ",',
        '2,2023-12-30,Cashback,GBP,12.5,Income,,"Current account",Cleared," ",',
      ].join('\n'));

      expect(transactions).toHaveLength(2);
      expect(transactions[0]).toMatchObject({
        date: '2023-12-31',
        description: 'Location Frozen II Apple TV',
        amount: -499,
        categoryName: 'Loisirs',
        subcategoryName: 'Cinema',
        reconciled: true,
      });
      expect(transactions[1]).toMatchObject({
        date: '2023-12-30',
        description: 'Cashback',
        amount: 1250,
        categoryName: null,
        subcategoryName: null,
        reconciled: false,
      });
    });

    it('handles category-only tags and quoted commas', () => {
      const transactions = parseCsvFile([
        'ID,Date,Description,Currency,Amount,Type,Tags,Account,Status,Memo,IOU',
        '1,2023-12-29,"Dinner, airport",GBP,-30,Expense,Alimentation,"Current account",Reconciled," ",',
      ].join('\n'));

      expect(transactions[0]).toMatchObject({
        description: 'Dinner, airport',
        categoryName: 'Alimentation',
        subcategoryName: null,
      });
    });
  });

  describe('previewImport and commitImport', () => {
    let accountId: number;
    let tmpFile: string;

    beforeEach(() => {
      testDb = setupTestDb();
      accountId = createTestAccount(testDb);
      tmpFile = path.join(os.tmpdir(), `polsa-import-${Date.now()}.csv`);
    });

    afterEach(() => {
      if (testDb) {
        testDb.close();
      }
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // ignore cleanup failures
      }
    });

    it('previews CSV imports and reports categories that will be created', () => {
      fs.writeFileSync(tmpFile, [
        'ID,Date,Description,Currency,Amount,Type,Tags,Account,Status,Memo,IOU',
        '1,2023-12-31,"Location Frozen II Apple TV",GBP,-4.99,Expense,"Loisirs / Cinema","Current account",Reconciled," ",',
        '2,2023-12-30,Cashback,GBP,12.5,Income,,"Current account",Cleared," ",',
      ].join('\n'));

      const preview = previewImport({ accountId, filePath: tmpFile, format: 'csv' });
      expect(preview.transactions).toHaveLength(2);
      expect(preview.transactions[0].reconciled).toBe(true);
      expect(preview.createdCategories).toEqual(['Loisirs', 'Loisirs:Cinema']);
    });

    it('previewImport returns sourceAccounts list from the Account column', () => {
      fs.writeFileSync(tmpFile, [
        'ID,Date,Description,Currency,Amount,Type,Tags,Account,Status,Memo,IOU',
        '1,2023-12-31,Foo,GBP,-10,Expense,,"Savings",Cleared," ",',
        '2,2023-12-30,Bar,GBP,5,Income,,"Checking",Cleared," ",',
        '3,2023-12-29,Baz,GBP,-3,Expense,,"Savings",Cleared," ",',
      ].join('\n'));

      const preview = previewImport({ accountId, filePath: tmpFile, format: 'csv' });
      expect(preview.sourceAccounts).toEqual(['Checking', 'Savings']);
      expect(preview.transactions).toHaveLength(3);
      expect(preview.transactions[0].sourceAccount).toBe('Savings');
    });

    it('commitImport filters by sourceAccount when provided', () => {
      fs.writeFileSync(tmpFile, [
        'ID,Date,Description,Currency,Amount,Type,Tags,Account,Status,Memo,IOU',
        '1,2023-12-31,From Savings,GBP,-10,Expense,,"Savings",Cleared," ",',
        '2,2023-12-30,From Checking,GBP,5,Income,,"Checking",Cleared," ",',
      ].join('\n'));

      const result = commitImport({ accountId, filePath: tmpFile, format: 'csv', sourceAccount: 'Savings' });
      expect(result.imported).toBe(1);

      const rows = testDb.prepare('SELECT description FROM transactions WHERE account_id = ?').all(accountId) as Array<{ description: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe('From Savings');
    });

    it('commits CSV imports with category assignment and reconciled status', () => {
      fs.writeFileSync(tmpFile, [
        'ID,Date,Description,Currency,Amount,Type,Tags,Account,Status,Memo,IOU',
        '1,2023-12-31,"Location Frozen II Apple TV",GBP,-4.99,Expense,"Loisirs / Cinema","Current account",Reconciled," ",',
        '2,2023-12-30,Cashback,GBP,12.5,Income,Alimentation,"Current account",Cleared," ",',
      ].join('\n'));

      const result = commitImport({ accountId, filePath: tmpFile, format: 'csv' });
      expect(result.imported).toBe(2);
      expect(result.createdCategories).toEqual(['Loisirs', 'Loisirs:Cinema', 'Alimentation']);

      const importedRows = testDb.prepare(`
        SELECT t.date, t.amount, t.description, t.category_id, t.subcategory_id, t.reconciled,
               c.name as category_name, s.name as subcategory_name
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN subcategories s ON s.id = t.subcategory_id
        WHERE t.account_id = ?
        ORDER BY t.date DESC, t.id DESC
      `).all(accountId) as Array<{
        date: string;
        amount: number;
        description: string;
        category_id: number | null;
        subcategory_id: number | null;
        reconciled: number;
        category_name: string | null;
        subcategory_name: string | null;
      }>;

      expect(importedRows).toHaveLength(2);
      expect(importedRows[0]).toMatchObject({
        date: '2023-12-31',
        amount: -499,
        description: 'Location Frozen II Apple TV',
        category_id: null,
        subcategory_name: 'Cinema',
        reconciled: 1,
      });
      expect(importedRows[1]).toMatchObject({
        date: '2023-12-30',
        amount: 1250,
        category_name: 'Alimentation',
        subcategory_id: null,
        reconciled: 0,
      });
    });
  });
});
