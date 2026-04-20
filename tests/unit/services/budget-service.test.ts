// tests/unit/services/budget-service.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

import {
  getAllocation,
  getSpent,
  getRollover,
  getOverview,
  getAllocations,
  setAllocation,
  setAllocations,
  getDefaults,
} from '../../../src/main/services/budget-service';

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

function createCategory(db: Database.Database, name: string): number {
  db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  return (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
}

function createSubcategory(db: Database.Database, categoryId: number, name: string): number {
  db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)').run(categoryId, name);
  return (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
}

function createAccount(db: Database.Database, name = 'Test', startingBalance = 0): number {
  db.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run(name, 'checking', startingBalance);
  return (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
}

function createTransaction(
  db: Database.Database,
  accountId: number,
  amount: number,
  date: string,
  subcategoryId?: number,
): number {
  db.prepare(
    'INSERT INTO transactions (account_id, date, amount, description, subcategory_id) VALUES (?, ?, ?, ?, ?)'
  ).run(accountId, date, amount, 'Test', subcategoryId ?? null);
  return (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
}

describe('budget-service', () => {
  let catId: number;
  let subId: number;
  let accountId: number;

  beforeEach(() => {
    testDb = setupTestDb();
    catId = createCategory(testDb, 'Housing');
    subId = createSubcategory(testDb, catId, 'Rent');
    accountId = createAccount(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('getAllocation', () => {
    it('returns 0 when no allocation or default exists', () => {
      expect(getAllocation(subId, catId, 2026, 4)).toBe(0);
    });

    it('returns explicit subcategory allocation when set', () => {
      setAllocation({
        subcategoryId: subId, categoryId: catId,
        year: 2026, month: 4, amount: 50000, applyToFutureMonths: false,
      });
      expect(getAllocation(subId, catId, 2026, 4)).toBe(50000);
    });

    it('returns explicit category-level allocation when subcategoryId is null', () => {
      setAllocation({
        subcategoryId: null, categoryId: catId,
        year: 2026, month: 4, amount: 100000, applyToFutureMonths: false,
      });
      expect(getAllocation(null, catId, 2026, 4)).toBe(100000);
    });

    it('falls back to default when no explicit allocation', () => {
      setAllocation({
        subcategoryId: subId, categoryId: catId,
        year: 2026, month: 3, amount: 50000, applyToFutureMonths: true,
      });
      expect(getAllocation(subId, catId, 2026, 4)).toBe(50000);
    });

    it('falls back to category-level default when subcategoryId is null', () => {
      setAllocation({
        subcategoryId: null, categoryId: catId,
        year: 2026, month: 3, amount: 80000, applyToFutureMonths: true,
      });
      expect(getAllocation(null, catId, 2026, 4)).toBe(80000);
    });

    it('uses most recent default', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 1, amount: 30000, applyToFutureMonths: true });
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 3, amount: 50000, applyToFutureMonths: true });
      expect(getAllocation(subId, catId, 2026, 4)).toBe(50000);
      expect(getAllocation(subId, catId, 2026, 2)).toBe(30000);
    });
  });

  describe('getSpent', () => {
    it('returns 0 when no transactions', () => {
      expect(getSpent(subId, catId, 2026, 4)).toBe(0);
    });

    it('returns sum of spending (negative amounts become positive spent)', () => {
      createTransaction(testDb, accountId, -20000, '2026-04-10', subId);
      createTransaction(testDb, accountId, -15000, '2026-04-20', subId);
      expect(getSpent(subId, catId, 2026, 4)).toBe(35000);
    });

    it('refunds reduce spending', () => {
      createTransaction(testDb, accountId, -40000, '2026-04-05', subId);
      createTransaction(testDb, accountId, 5000, '2026-04-15', subId); // refund
      expect(getSpent(subId, catId, 2026, 4)).toBe(35000);
    });

    it('only includes transactions from the specified month', () => {
      createTransaction(testDb, accountId, -10000, '2026-03-31', subId);
      createTransaction(testDb, accountId, -20000, '2026-04-01', subId);
      createTransaction(testDb, accountId, -30000, '2026-05-01', subId);
      expect(getSpent(subId, catId, 2026, 4)).toBe(20000);
    });

    it('category-level getSpent sums all subcategories', () => {
      const sub2 = createSubcategory(testDb, catId, 'Utilities');
      createTransaction(testDb, accountId, -20000, '2026-04-10', subId);
      createTransaction(testDb, accountId, -15000, '2026-04-15', sub2);
      expect(getSpent(null, catId, 2026, 4)).toBe(35000);
    });
  });

  describe('getRollover', () => {
    it('returns 0 for January', () => {
      expect(getRollover(subId, catId, 2026, 1)).toBe(0);
    });

    it('computes rollover from previous month surplus', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 1, amount: 10000, applyToFutureMonths: false });
      createTransaction(testDb, accountId, -8000, '2026-01-15', subId);
      expect(getRollover(subId, catId, 2026, 2)).toBe(2000);
    });

    it('carries negative rollover when overspent', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 1, amount: 10000, applyToFutureMonths: false });
      createTransaction(testDb, accountId, -12000, '2026-01-15', subId);
      expect(getRollover(subId, catId, 2026, 2)).toBe(-2000);
    });

    it('chains rollovers across multiple months', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 1, amount: 10000, applyToFutureMonths: true });
      createTransaction(testDb, accountId, -8000, '2026-01-15', subId);
      createTransaction(testDb, accountId, -11000, '2026-02-15', subId);
      expect(getRollover(subId, catId, 2026, 3)).toBe(1000);
    });

    it('returns 0 for January for category-level budget', () => {
      expect(getRollover(null, catId, 2026, 1)).toBe(0);
    });

    it('computes category-level rollover correctly', () => {
      setAllocation({ subcategoryId: null, categoryId: catId, year: 2026, month: 1, amount: 10000, applyToFutureMonths: false });
      createTransaction(testDb, accountId, -7000, '2026-01-15', subId);
      expect(getRollover(null, catId, 2026, 2)).toBe(3000);
    });

    it('uses cache for intermediate results', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 1, amount: 10000, applyToFutureMonths: true });
      const cache = new Map<string, number>();
      getRollover(subId, catId, 2026, 4, cache);
      expect(cache.size).toBeGreaterThan(0);
    });
  });

  describe('setAllocation', () => {
    it('sets explicit subcategory allocation for a month', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: 50000, applyToFutureMonths: false });
      expect(getAllocation(subId, catId, 2026, 4)).toBe(50000);
    });

    it('sets category-level allocation (subcategoryId null)', () => {
      setAllocation({ subcategoryId: null, categoryId: catId, year: 2026, month: 4, amount: 100000, applyToFutureMonths: false });
      expect(getAllocation(null, catId, 2026, 4)).toBe(100000);
    });

    it('updates existing subcategory allocation', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: 50000, applyToFutureMonths: false });
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: 60000, applyToFutureMonths: false });
      expect(getAllocation(subId, catId, 2026, 4)).toBe(60000);
    });

    it('updates existing category-level allocation', () => {
      setAllocation({ subcategoryId: null, categoryId: catId, year: 2026, month: 4, amount: 100000, applyToFutureMonths: false });
      setAllocation({ subcategoryId: null, categoryId: catId, year: 2026, month: 4, amount: 120000, applyToFutureMonths: false });
      expect(getAllocation(null, catId, 2026, 4)).toBe(120000);
    });

    it('when applyToFutureMonths, sets default and removes future explicit allocations', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: 40000, applyToFutureMonths: false });
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 5, amount: 50000, applyToFutureMonths: false });
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: 45000, applyToFutureMonths: true });
      expect(getAllocation(subId, catId, 2026, 4)).toBe(45000);
      expect(getAllocation(subId, catId, 2026, 5)).toBe(45000);
    });

    it('rejects negative amount', () => {
      expect(() => setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: -100, applyToFutureMonths: false })).toThrow('Invalid amount');
    });
  });

  describe('setAllocations', () => {
    it('batch sets allocations in a single transaction', () => {
      const sub2 = createSubcategory(testDb, catId, 'Utilities');
      setAllocations({
        year: 2026, month: 4,
        allocations: [
          { subcategoryId: subId, categoryId: catId, amount: 85000 },
          { subcategoryId: sub2, categoryId: catId, amount: 15000 },
        ],
        applyToFutureMonths: false,
      });
      expect(getAllocation(subId, catId, 2026, 4)).toBe(85000);
      expect(getAllocation(sub2, catId, 2026, 4)).toBe(15000);
    });
  });

  describe('getOverview', () => {
    it('returns empty overview when no budgets or spending', () => {
      const overview = getOverview(2026, 4);
      expect(overview.year).toBe(2026);
      expect(overview.month).toBe(4);
      expect(overview.totalAllocated).toBe(0);
      expect(overview.totalSpent).toBe(0);
      expect(overview.categories).toHaveLength(0);
    });

    it('includes categories with subcategory-level budgets', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: 85000, applyToFutureMonths: false });
      createTransaction(testDb, accountId, -50000, '2026-04-10', subId);

      const overview = getOverview(2026, 4);
      expect(overview.totalAllocated).toBe(85000);
      expect(overview.totalSpent).toBe(50000);
      expect(overview.categories).toHaveLength(1);
      expect(overview.categories[0].subcategories).toHaveLength(1);
    });

    it('includes categories with category-level budgets (no subcategory breakdown)', () => {
      setAllocation({ subcategoryId: null, categoryId: catId, year: 2026, month: 4, amount: 100000, applyToFutureMonths: false });
      createTransaction(testDb, accountId, -60000, '2026-04-10', subId);

      const overview = getOverview(2026, 4);
      expect(overview.categories).toHaveLength(1);
      expect(overview.categories[0].allocated).toBe(100000);
      expect(overview.categories[0].spent).toBe(60000);
      expect(overview.categories[0].subcategories).toHaveLength(0);
    });

    it('includes categories with spending but no budget', () => {
      createTransaction(testDb, accountId, -10000, '2026-04-10', subId);
      const overview = getOverview(2026, 4);
      expect(overview.categories).toHaveLength(1);
      expect(overview.categories[0].spent).toBe(10000);
      expect(overview.categories[0].allocated).toBe(0);
    });

    it('includes rollover in available calculation', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 3, amount: 10000, applyToFutureMonths: true });
      createTransaction(testDb, accountId, -7000, '2026-03-15', subId);
      const overview = getOverview(2026, 4);
      expect(overview.categories[0].rollover).toBe(3000);
      expect(overview.categories[0].available).toBe(13000);
    });

    it('rejects invalid month', () => {
      expect(() => getOverview(2026, 13)).toThrow('Invalid year or month');
    });
  });

  describe('getAllocations', () => {
    it('returns category-level and subcategory-level entries', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: 85000, applyToFutureMonths: false });

      const allocs = getAllocations(2026, 4);
      // Should include the category-level entry (amount 0, subcategoryId null)
      expect(allocs.some(a => a.subcategoryId === null && a.categoryId === catId)).toBe(true);
      // And the subcategory entry
      expect(allocs.find(a => a.subcategoryId === subId)?.amount).toBe(85000);
    });
  });

  describe('getDefaults', () => {
    it('returns budget defaults including category-level ones', () => {
      setAllocation({ subcategoryId: subId, categoryId: catId, year: 2026, month: 4, amount: 50000, applyToFutureMonths: true });
      setAllocation({ subcategoryId: null, categoryId: catId, year: 2026, month: 4, amount: 80000, applyToFutureMonths: true });
      const defaults = getDefaults();
      expect(defaults.some(d => d.subcategoryId === subId && d.amount === 50000)).toBe(true);
      expect(defaults.some(d => d.subcategoryId === null && d.categoryId === catId && d.amount === 80000)).toBe(true);
    });
  });

  describe('year boundary', () => {
    it('rollover resets to 0 in January of new year', () => {
      setAllocation({
        subcategoryId: subId, categoryId: catId,
        year: 2025, month: 12, amount: 10000, applyToFutureMonths: true,
      });
      createTransaction(testDb, accountId, -5000, '2025-12-15', subId);
      // Dec 2025: remaining = 5000, but Jan 2026 should NOT carry this over

      expect(getRollover(subId, catId, 2026, 1)).toBe(0);
    });
  });
});
