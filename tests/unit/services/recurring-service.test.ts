// tests/unit/services/recurring-service.test.ts

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
  listRecurring,
  getRecurring,
  createRecurring,
  updateRecurring,
  cancelRecurring,
  reactivateRecurring,
  deleteRecurring,
  applyOverdue,
  advanceDate,
} from '../../../src/main/services/recurring-service';

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

function seedAccount(db: Database.Database, name = 'Current', balance = 0): number {
  return db.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, 'checking', ?)").run(name, balance).lastInsertRowid as number;
}

function seedCategory(db: Database.Database): { categoryId: number; subcategoryId: number } {
  const catId = db.prepare("INSERT INTO categories (name) VALUES ('Bills')").run().lastInsertRowid as number;
  const subId = db.prepare("INSERT INTO subcategories (category_id, name) VALUES (?, 'Rent')").run(catId).lastInsertRowid as number;
  return { categoryId: catId, subcategoryId: subId };
}

describe('recurring-service', () => {
  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.close();
  });

  // ── advanceDate ───────────────────────────────────────────

  describe('advanceDate', () => {
    it('daily: +1 day', () => {
      expect(advanceDate('2026-04-20', 'daily')).toBe('2026-04-21');
    });

    it('weekly: +7 days', () => {
      expect(advanceDate('2026-04-20', 'weekly')).toBe('2026-04-27');
    });

    it('fortnightly: +14 days', () => {
      expect(advanceDate('2026-04-20', 'fortnightly')).toBe('2026-05-04');
    });

    it('monthly: standard', () => {
      expect(advanceDate('2026-04-15', 'monthly')).toBe('2026-05-15');
    });

    it('monthly: Jan 31 → Feb 28 (clamp)', () => {
      expect(advanceDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    });

    it('monthly: Mar 31 → Apr 30 (clamp)', () => {
      expect(advanceDate('2026-03-31', 'monthly')).toBe('2026-04-30');
    });

    it('monthly: Jan 31 → Feb 29 in leap year', () => {
      expect(advanceDate('2028-01-31', 'monthly')).toBe('2028-02-29');
    });

    it('quarterly: +3 months', () => {
      expect(advanceDate('2026-01-15', 'quarterly')).toBe('2026-04-15');
    });

    it('quarterly: Jan 31 → Apr 30 (clamp)', () => {
      expect(advanceDate('2026-01-31', 'quarterly')).toBe('2026-04-30');
    });

    it('yearly: standard', () => {
      expect(advanceDate('2026-04-20', 'yearly')).toBe('2027-04-20');
    });

    it('yearly: Feb 29 → Feb 28 in non-leap year', () => {
      expect(advanceDate('2028-02-29', 'yearly')).toBe('2029-02-28');
    });

    it('daily: crossing month boundary', () => {
      expect(advanceDate('2026-04-30', 'daily')).toBe('2026-05-01');
    });

    it('daily: crossing year boundary', () => {
      expect(advanceDate('2026-12-31', 'daily')).toBe('2027-01-01');
    });

    it('monthly: December → January (year roll)', () => {
      expect(advanceDate('2026-12-15', 'monthly')).toBe('2027-01-15');
    });
  });

  // ── CRUD ──────────────────────────────────────────────────

  describe('CRUD', () => {
    it('creates and lists recurring transactions', () => {
      const acctId = seedAccount(testDb);
      const rec = createRecurring({
        accountId: acctId,
        description: 'Rent',
        amount: -85000,
        frequency: 'monthly',
        nextDate: '2026-05-01',
      });

      expect(rec.id).toBeDefined();
      expect(rec.description).toBe('Rent');
      expect(rec.amount).toBe(-85000);
      expect(rec.frequency).toBe('monthly');
      expect(rec.nextDate).toBe('2026-05-01');
      expect(rec.active).toBe(true);
      expect(rec.accountName).toBe('Current');

      const list = listRecurring();
      expect(list).toHaveLength(1);
      expect(list[0].description).toBe('Rent');
    });

    it('creates with subcategory', () => {
      const acctId = seedAccount(testDb);
      const { subcategoryId } = seedCategory(testDb);

      const rec = createRecurring({
        accountId: acctId,
        description: 'Rent',
        amount: -85000,
        subcategoryId,
        frequency: 'monthly',
        nextDate: '2026-05-01',
      });

      expect(rec.subcategoryId).toBe(subcategoryId);
      expect(rec.subcategoryName).toBe('Rent');
      expect(rec.categoryName).toBe('Bills');
    });

    it('gets by id', () => {
      const acctId = seedAccount(testDb);
      const created = createRecurring({
        accountId: acctId,
        description: 'Salary',
        amount: 250000,
        frequency: 'monthly',
        nextDate: '2026-04-28',
      });

      const fetched = getRecurring(created.id);
      expect(fetched.description).toBe('Salary');
      expect(fetched.amount).toBe(250000);
    });

    it('throws on get nonexistent', () => {
      expect(() => getRecurring(999)).toThrow('not found');
    });

    it('updates fields', () => {
      const acctId = seedAccount(testDb);
      const rec = createRecurring({
        accountId: acctId,
        description: 'Netflix',
        amount: -1599,
        frequency: 'monthly',
        nextDate: '2026-05-15',
      });

      const updated = updateRecurring({
        id: rec.id,
        amount: -1799,
        description: 'Netflix Premium',
      });

      expect(updated.amount).toBe(-1799);
      expect(updated.description).toBe('Netflix Premium');
      // Unchanged fields preserved
      expect(updated.frequency).toBe('monthly');
      expect(updated.nextDate).toBe('2026-05-15');
    });

    it('cancels and reactivates', () => {
      const acctId = seedAccount(testDb);
      const rec = createRecurring({
        accountId: acctId,
        description: 'Gym',
        amount: -3000,
        frequency: 'monthly',
        nextDate: '2026-05-01',
      });

      cancelRecurring(rec.id);
      const cancelled = getRecurring(rec.id);
      expect(cancelled.active).toBe(false);

      const reactivated = reactivateRecurring(rec.id);
      expect(reactivated.active).toBe(true);
    });

    it('deletes', () => {
      const acctId = seedAccount(testDb);
      const rec = createRecurring({
        accountId: acctId,
        description: 'Test',
        amount: -100,
        frequency: 'daily',
        nextDate: '2026-05-01',
      });

      deleteRecurring(rec.id);
      expect(() => getRecurring(rec.id)).toThrow('not found');
    });
  });

  // ── Validation ────────────────────────────────────────────

  describe('validation', () => {
    it('rejects invalid account', () => {
      expect(() => createRecurring({
        accountId: 999,
        description: 'test',
        amount: -100,
        frequency: 'monthly',
        nextDate: '2026-05-01',
      })).toThrow('not found');
    });

    it('rejects invalid frequency', () => {
      const acctId = seedAccount(testDb);
      expect(() => createRecurring({
        accountId: acctId,
        description: 'test',
        amount: -100,
        frequency: 'biweekly' as any,
        nextDate: '2026-05-01',
      })).toThrow('Invalid frequency');
    });

    it('rejects invalid date', () => {
      const acctId = seedAccount(testDb);
      expect(() => createRecurring({
        accountId: acctId,
        description: 'test',
        amount: -100,
        frequency: 'monthly',
        nextDate: 'not-a-date',
      })).toThrow();
    });

    it('rejects float amount', () => {
      const acctId = seedAccount(testDb);
      expect(() => createRecurring({
        accountId: acctId,
        description: 'test',
        amount: 10.5,
        frequency: 'monthly',
        nextDate: '2026-05-01',
      })).toThrow();
    });
  });

  // ── applyOverdue ──────────────────────────────────────────

  describe('applyOverdue', () => {
    it('returns 0 when no overdue', () => {
      const acctId = seedAccount(testDb);
      createRecurring({
        accountId: acctId,
        description: 'Future',
        amount: -100,
        frequency: 'monthly',
        nextDate: '2099-01-01',
      });

      const result = applyOverdue('2026-04-20');
      expect(result.applied).toBe(0);
    });

    it('applies one overdue transaction', () => {
      const acctId = seedAccount(testDb);
      createRecurring({
        accountId: acctId,
        description: 'Rent',
        amount: -85000,
        frequency: 'monthly',
        nextDate: '2026-04-01',
      });

      const result = applyOverdue('2026-04-20');
      expect(result.applied).toBe(1);

      // Verify transaction was created
      const txs = testDb.prepare('SELECT * FROM transactions WHERE account_id = ?').all(acctId) as any[];
      expect(txs).toHaveLength(1);
      expect(txs[0].amount).toBe(-85000);
      expect(txs[0].date).toBe('2026-04-01');
      expect(txs[0].description).toBe('Rent');

      // Verify next_date advanced
      const rec = getRecurring(1);
      expect(rec.nextDate).toBe('2026-05-01');
    });

    it('applies multiple overdue periods (weekly, 3 weeks late)', () => {
      const acctId = seedAccount(testDb);
      createRecurring({
        accountId: acctId,
        description: 'Pocket money',
        amount: -2000,
        frequency: 'weekly',
        nextDate: '2026-03-30',
      });

      const result = applyOverdue('2026-04-20');
      expect(result.applied).toBe(4); // Mar 30, Apr 6, Apr 13, Apr 20

      const txs = testDb.prepare('SELECT date FROM transactions ORDER BY date').all() as any[];
      expect(txs.map((t: any) => t.date)).toEqual(['2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20']);

      const rec = getRecurring(1);
      expect(rec.nextDate).toBe('2026-04-27');
    });

    it('skips cancelled recurring', () => {
      const acctId = seedAccount(testDb);
      const rec = createRecurring({
        accountId: acctId,
        description: 'Cancelled',
        amount: -100,
        frequency: 'daily',
        nextDate: '2026-04-01',
      });

      cancelRecurring(rec.id);
      const result = applyOverdue('2026-04-20');
      expect(result.applied).toBe(0);
    });

    it('is idempotent — second call applies nothing', () => {
      const acctId = seedAccount(testDb);
      createRecurring({
        accountId: acctId,
        description: 'Rent',
        amount: -85000,
        frequency: 'monthly',
        nextDate: '2026-04-01',
      });

      applyOverdue('2026-04-20');
      const result2 = applyOverdue('2026-04-20');
      expect(result2.applied).toBe(0);

      const txs = testDb.prepare('SELECT * FROM transactions').all();
      expect(txs).toHaveLength(1);
    });

    it('handles exact next_date == today', () => {
      const acctId = seedAccount(testDb);
      createRecurring({
        accountId: acctId,
        description: 'Today',
        amount: -500,
        frequency: 'monthly',
        nextDate: '2026-04-20',
      });

      const result = applyOverdue('2026-04-20');
      expect(result.applied).toBe(1);
    });

    it('applies multiple recurring atomically', () => {
      const acctId = seedAccount(testDb);
      createRecurring({
        accountId: acctId,
        description: 'Rent',
        amount: -85000,
        frequency: 'monthly',
        nextDate: '2026-04-01',
      });
      createRecurring({
        accountId: acctId,
        description: 'Netflix',
        amount: -1599,
        frequency: 'monthly',
        nextDate: '2026-04-15',
      });

      const result = applyOverdue('2026-04-20');
      expect(result.applied).toBe(2);

      const txs = testDb.prepare('SELECT * FROM transactions ORDER BY date').all();
      expect(txs).toHaveLength(2);
    });

    it('preserves subcategory on applied transactions', () => {
      const acctId = seedAccount(testDb);
      const { subcategoryId } = seedCategory(testDb);

      createRecurring({
        accountId: acctId,
        description: 'Rent',
        amount: -85000,
        subcategoryId,
        frequency: 'monthly',
        nextDate: '2026-04-01',
      });

      applyOverdue('2026-04-20');

      const tx = testDb.prepare('SELECT subcategory_id FROM transactions').get() as any;
      expect(tx.subcategory_id).toBe(subcategoryId);
    });

    it('handles daily recurring over many days', () => {
      const acctId = seedAccount(testDb);
      createRecurring({
        accountId: acctId,
        description: 'Daily coffee',
        amount: -350,
        frequency: 'daily',
        nextDate: '2026-04-15',
      });

      const result = applyOverdue('2026-04-20');
      expect(result.applied).toBe(6); // 15, 16, 17, 18, 19, 20
    });
  });
});
