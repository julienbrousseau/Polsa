import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

import { getMonthInsights } from '../../../src/main/services/insights-service';

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

function createAccount(db: Database.Database): number {
  db.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run('Main', 'checking', 0);
  return (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
}

function createCategory(db: Database.Database, name: string): number {
  db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  return (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
}

function createSubcategory(db: Database.Database, categoryId: number, name: string): number {
  db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)').run(categoryId, name);
  return (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
}

describe('insights-service', () => {
  let accountId: number;

  beforeEach(() => {
    testDb = setupTestDb();
    accountId = createAccount(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  it('returns month summary totals for standard transactions only', () => {
    const salaryCategory = createCategory(testDb, 'Salary');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, description)
       VALUES (?, ?, ?, 'standard', ?, ?)`
    ).run(accountId, '2026-05-01', 300000, salaryCategory, 'Salary');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, description)
       VALUES (?, ?, ?, 'standard', ?, ?)`
    ).run(accountId, '2026-05-02', -75000, salaryCategory, 'Tax');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, description)
       VALUES (?, ?, ?, 'transfer', ?, ?)`
    ).run(accountId, '2026-05-03', 999999, salaryCategory, 'Transfer should be ignored');

    const insights = getMonthInsights(2026, 5);

    expect(insights.totalEarned).toBe(300000);
    expect(insights.totalSpent).toBe(75000);
    expect(insights.balance).toBe(225000);
  });

  it('aggregates direct-category and subcategory amounts by top-level category', () => {
    const groceries = createCategory(testDb, 'Groceries');
    const foodSub = createSubcategory(testDb, groceries, 'Weekly shop');
    const salary = createCategory(testDb, 'Salary');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, subcategory_id, description)
       VALUES (?, ?, ?, 'standard', ?, ?)`
    ).run(accountId, '2026-05-10', -3500, foodSub, 'Apples');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, subcategory_id, description)
       VALUES (?, ?, ?, 'standard', ?, NULL, ?)`
    ).run(accountId, '2026-05-11', -2500, groceries, 'Bakery');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, description)
       VALUES (?, ?, ?, 'standard', ?, ?)`
    ).run(accountId, '2026-05-12', 120000, salary, 'Monthly pay');

    const insights = getMonthInsights(2026, 5);

    expect(insights.expenseCategories).toEqual([
      { categoryId: groceries, categoryName: 'Groceries', amount: 6000 },
    ]);
    expect(insights.incomeCategories).toEqual([
      { categoryId: salary, categoryName: 'Salary', amount: 120000 },
    ]);
  });

  it('keeps each mode alphabetically ordered and allows same category in both lists', () => {
    const alpha = createCategory(testDb, 'Alpha');
    const zeta = createCategory(testDb, 'Zeta');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, description)
       VALUES (?, ?, ?, 'standard', ?, ?)`
    ).run(accountId, '2026-05-04', -500, zeta, 'Expense Zeta');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, description)
       VALUES (?, ?, ?, 'standard', ?, ?)`
    ).run(accountId, '2026-05-05', -300, alpha, 'Expense Alpha');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, description)
       VALUES (?, ?, ?, 'standard', ?, ?)`
    ).run(accountId, '2026-05-06', 1000, zeta, 'Income Zeta');

    testDb.prepare(
      `INSERT INTO transactions (account_id, date, amount, transaction_type, category_id, description)
       VALUES (?, ?, ?, 'standard', ?, ?)`
    ).run(accountId, '2026-05-07', 2000, alpha, 'Income Alpha');

    const insights = getMonthInsights(2026, 5);

    expect(insights.expenseCategories.map((row) => row.categoryName)).toEqual(['Alpha', 'Zeta']);
    expect(insights.incomeCategories.map((row) => row.categoryName)).toEqual(['Alpha', 'Zeta']);
    expect(insights.expenseCategories.map((row) => row.amount)).toEqual([300, 500]);
    expect(insights.incomeCategories.map((row) => row.amount)).toEqual([2000, 1000]);
  });

  it('validates month input', () => {
    expect(() => getMonthInsights(2026, 0)).toThrow('Invalid month');
    expect(() => getMonthInsights(2026, 13)).toThrow('Invalid month');
    expect(() => getMonthInsights(1500, 5)).toThrow('Invalid year');
  });
});