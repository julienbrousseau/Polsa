// tests/unit/services/qif-service.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

import {
  parseQifDate,
  parseQifAmount,
  parseQifFile,
  formatQifDate,
  formatQifAmount,
  importQif,
  exportQif,
} from '../../../src/main/services/qif-service';

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

function createTestAccount(db: Database.Database): number {
  db.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run('Test', 'checking', 0);
  return (db.prepare("SELECT last_insert_rowid() as id").get() as any).id;
}

describe('qif-service', () => {
  describe('parseQifDate', () => {
    it('parses ISO YYYY-MM-DD', () => {
      expect(parseQifDate('2025-12-13', 'MM/DD/YYYY')).toBe('2025-12-13');
    });

    it('parses MM/DD/YYYY', () => {
      expect(parseQifDate('01/15/2024', 'MM/DD/YYYY')).toBe('2024-01-15');
    });

    it('parses DD/MM/YYYY', () => {
      expect(parseQifDate('15/01/2024', 'DD/MM/YYYY')).toBe('2024-01-15');
    });

    it('handles 2-digit year (20xx)', () => {
      expect(parseQifDate('01/15/24', 'MM/DD/YYYY')).toBe('2024-01-15');
    });

    it('handles 2-digit year (19xx)', () => {
      expect(parseQifDate('01/15/99', 'MM/DD/YYYY')).toBe('1999-01-15');
    });

    it('handles dot separators', () => {
      expect(parseQifDate('15.01.2024', 'DD/MM/YYYY')).toBe('2024-01-15');
    });
  });

  describe('parseQifAmount', () => {
    it('parses positive amount', () => {
      expect(parseQifAmount('123.45')).toBe(12345);
    });

    it('parses negative amount', () => {
      expect(parseQifAmount('-50.00')).toBe(-5000);
    });

    it('handles commas', () => {
      expect(parseQifAmount('1,234.56')).toBe(123456);
    });
  });

  describe('formatQifDate', () => {
    it('formats ISO to MM/DD/YYYY', () => {
      expect(formatQifDate('2024-01-15')).toBe('01/15/2024');
    });
  });

  describe('formatQifAmount', () => {
    it('formats positive', () => {
      expect(formatQifAmount(12345)).toBe('123.45');
    });

    it('formats negative', () => {
      expect(formatQifAmount(-5000)).toBe('-50.00');
    });

    it('formats zero', () => {
      expect(formatQifAmount(0)).toBe('0.00');
    });
  });

  describe('parseQifFile', () => {
    it('parses valid QIF content', () => {
      const content = [
        '!Type:Bank',
        'D01/15/2024',
        'T-50.00',
        'PGrocery Store',
        'LFood:Groceries',
        '^',
        'D01/20/2024',
        'T100.00',
        'PSalary',
        '^',
      ].join('\n');

      const txs = parseQifFile(content, 'MM/DD/YYYY');
      expect(txs).toHaveLength(2);
      expect(txs[0].date).toBe('2024-01-15');
      expect(txs[0].amount).toBe(-5000);
      expect(txs[0].description).toBe('Grocery Store');
      expect(txs[0].category).toBe('Food');
      expect(txs[0].subcategory).toBe('Groceries');
      expect(txs[1].date).toBe('2024-01-20');
      expect(txs[1].amount).toBe(10000);
      expect(txs[1].description).toBe('Salary');
      expect(txs[1].category).toBeNull();
    });

    it('handles empty file', () => {
      expect(parseQifFile('', 'MM/DD/YYYY')).toEqual([]);
    });

    it('parses slash-separated category and ISO date', () => {
      const content = [
        '!Type:Bank',
        'D2025-12-13',
        'T-45.20',
        'PPharmacy',
        'LSoins / Habillement',
        '^',
      ].join('\n');

      const txs = parseQifFile(content);
      expect(txs).toHaveLength(1);
      expect(txs[0].date).toBe('2025-12-13');
      expect(txs[0].category).toBe('Soins');
      expect(txs[0].subcategory).toBe('Habillement');
    });

    it('normalizes extra spaces in category and subcategory names', () => {
      const content = [
        '!Type:Bank',
        'D2025-12-13',
        'T-45.20',
        'L  Soins   /   Habillement   ',
        '^',
      ].join('\n');

      const txs = parseQifFile(content);
      expect(txs).toHaveLength(1);
      expect(txs[0].category).toBe('Soins');
      expect(txs[0].subcategory).toBe('Habillement');
    });
  });

  describe('importQif', () => {
    let accountId: number;
    let tmpFile: string;

    beforeEach(() => {
      testDb = setupTestDb();
      accountId = createTestAccount(testDb);
      tmpFile = path.join(os.tmpdir(), `polsa-test-${Date.now()}.qif`);
    });

    afterEach(() => {
      testDb.close();
      try { fs.unlinkSync(tmpFile); } catch {}
    });

    it('imports transactions and creates categories', () => {
      fs.writeFileSync(tmpFile, [
        '!Type:Bank',
        'D2024-01-15',
        'T-25.50',
        'PCoffee Shop',
        'LFood / Coffee',
        '^',
      ].join('\n'));

      const result = importQif({ accountId, filePath: tmpFile });
      expect(result.imported).toBe(1);
      expect(result.createdCategories).toContain('Food');
      expect(result.createdCategories).toContain('Food:Coffee');

      // Verify transaction exists
      const tx = testDb.prepare('SELECT * FROM transactions WHERE account_id = ?').get(accountId) as any;
      expect(tx.amount).toBe(-2550);
      expect(tx.date).toBe('2024-01-15');

      // Verify category/subcategory created
      const cat = testDb.prepare("SELECT id FROM categories WHERE name = 'Food'").get() as any;
      expect(cat).toBeDefined();
      const sub = testDb.prepare("SELECT id FROM subcategories WHERE name = 'Coffee'").get() as any;
      expect(sub).toBeDefined();
    });

    it('assigns parent-only category without creating a subcategory', () => {
      fs.writeFileSync(tmpFile, [
        '!Type:Bank',
        'D2024-01-16',
        'T-19.90',
        'PSports Shop',
        'LSports',
        '^',
      ].join('\n'));

      const result = importQif({ accountId, filePath: tmpFile });
      expect(result.imported).toBe(1);
      expect(result.createdCategories).toContain('Sports');
      expect(result.createdCategories).not.toContain('Sports:Sports');

      const tx = testDb.prepare('SELECT * FROM transactions WHERE account_id = ?').get(accountId) as any;
      expect(tx.category_id).not.toBeNull();
      expect(tx.subcategory_id).toBeNull();

      const cat = testDb.prepare("SELECT id FROM categories WHERE name = 'Sports'").get() as any;
      expect(cat).toBeDefined();
      const subCount = (testDb.prepare("SELECT COUNT(*) as c FROM subcategories WHERE category_id = ?").get(cat.id) as any).c;
      expect(subCount).toBe(0);
      expect(tx.category_id).toBe(cat.id);
    });
  });

  describe('exportQif', () => {
    let accountId: number;
    let tmpFile: string;

    beforeEach(() => {
      testDb = setupTestDb();
      accountId = createTestAccount(testDb);
      tmpFile = path.join(os.tmpdir(), `polsa-test-export-${Date.now()}.qif`);
    });

    afterEach(() => {
      testDb.close();
      try { fs.unlinkSync(tmpFile); } catch {}
    });

    it('exports transactions to QIF format', () => {
      // Add a transaction
      testDb.prepare("INSERT INTO transactions (account_id, date, amount, description) VALUES (?, ?, ?, ?)").run(accountId, '2024-01-15', -5000, 'Test');

      const result = exportQif({ accountId, filePath: tmpFile });
      expect(result.exported).toBe(1);

      const content = fs.readFileSync(tmpFile, 'utf-8');
      expect(content).toContain('!Type:Bank');
      expect(content).toContain('D01/15/2024');
      expect(content).toContain('T-50.00');
      expect(content).toContain('PTest');
    });

    it('filters by date range', () => {
      testDb.prepare("INSERT INTO transactions (account_id, date, amount, description) VALUES (?, ?, ?, ?)").run(accountId, '2024-01-10', -1000, 'A');
      testDb.prepare("INSERT INTO transactions (account_id, date, amount, description) VALUES (?, ?, ?, ?)").run(accountId, '2024-01-20', -2000, 'B');
      testDb.prepare("INSERT INTO transactions (account_id, date, amount, description) VALUES (?, ?, ?, ?)").run(accountId, '2024-01-30', -3000, 'C');

      const result = exportQif({ accountId, filePath: tmpFile, dateFrom: '2024-01-15', dateTo: '2024-01-25' });
      expect(result.exported).toBe(1);
    });

    it('includes category info', () => {
      testDb.prepare("INSERT INTO categories (name) VALUES (?)").run('Food');
      const catId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;
      testDb.prepare("INSERT INTO subcategories (category_id, name) VALUES (?, ?)").run(catId, 'Groceries');
      const subId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;

      testDb.prepare("INSERT INTO transactions (account_id, date, amount, subcategory_id, description) VALUES (?, ?, ?, ?, ?)").run(accountId, '2024-01-15', -5000, subId, 'Shop');

      exportQif({ accountId, filePath: tmpFile });
      const content = fs.readFileSync(tmpFile, 'utf-8');
      expect(content).toContain('LFood:Groceries');
    });
  });
});
