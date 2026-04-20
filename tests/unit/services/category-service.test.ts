// tests/unit/services/category-service.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
} from '../../../src/main/services/category-service';

function setupTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrationPath = path.join(__dirname, '../../../src/main/migrations/001_initial.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  db.exec(sql);

  return db;
}

describe('category-service', () => {
  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('listCategories', () => {
    it('returns empty array when no categories', () => {
      expect(listCategories()).toEqual([]);
    });

    it('returns categories sorted by name with subcategories', () => {
      testDb.prepare("INSERT INTO categories (name) VALUES (?)").run('Food');
      testDb.prepare("INSERT INTO categories (name) VALUES (?)").run('Bills');
      const foodId = (testDb.prepare("SELECT id FROM categories WHERE name = 'Food'").get() as any).id;
      testDb.prepare("INSERT INTO subcategories (category_id, name) VALUES (?, ?)").run(foodId, 'Groceries');
      testDb.prepare("INSERT INTO subcategories (category_id, name) VALUES (?, ?)").run(foodId, 'Dining Out');

      const cats = listCategories();
      expect(cats).toHaveLength(2);
      expect(cats[0].name).toBe('Bills');
      expect(cats[0].subcategories).toHaveLength(0);
      expect(cats[1].name).toBe('Food');
      expect(cats[1].subcategories).toHaveLength(2);
      expect(cats[1].subcategories[0].name).toBe('Dining Out');
      expect(cats[1].subcategories[1].name).toBe('Groceries');
    });
  });

  describe('createCategory', () => {
    it('creates a category', () => {
      const cat = createCategory({ name: 'Transport' });
      expect(cat.id).toBeGreaterThan(0);
      expect(cat.name).toBe('Transport');
    });

    it('trims whitespace', () => {
      const cat = createCategory({ name: '  Utilities  ' });
      expect(cat.name).toBe('Utilities');
    });

    it('rejects empty name', () => {
      expect(() => createCategory({ name: '' })).toThrow('Category name is required');
    });
  });

  describe('renameCategory', () => {
    it('renames a category', () => {
      const cat = createCategory({ name: 'Old' });
      const renamed = renameCategory({ id: cat.id, name: 'New' });
      expect(renamed.id).toBe(cat.id);
      expect(renamed.name).toBe('New');
    });

    it('throws for non-existent category', () => {
      expect(() => renameCategory({ id: 999, name: 'New' })).toThrow('Category 999 not found');
    });
  });

  describe('deleteCategory', () => {
    it('deletes a category', () => {
      const cat = createCategory({ name: 'ToDelete' });
      deleteCategory(cat.id);
      expect(listCategories()).toHaveLength(0);
    });

    it('cascades subcategory deletion', () => {
      const cat = createCategory({ name: 'Food' });
      createSubcategory({ categoryId: cat.id, name: 'Groceries' });
      deleteCategory(cat.id);

      const count = (testDb.prepare("SELECT COUNT(*) as c FROM subcategories").get() as any).c;
      expect(count).toBe(0);
    });

    it('transactions become uncategorised when category deleted', () => {
      const cat = createCategory({ name: 'Food' });
      const sub = createSubcategory({ categoryId: cat.id, name: 'Groceries' });

      // Create an account and a transaction with this subcategory
      testDb.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run('Test', 'checking', 0);
      const accountId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;
      testDb.prepare("INSERT INTO transactions (account_id, date, amount, subcategory_id, description) VALUES (?, ?, ?, ?, ?)").run(accountId, '2024-01-15', -1000, sub.id, 'Grocery shop');

      deleteCategory(cat.id);

      const tx = testDb.prepare("SELECT subcategory_id FROM transactions").get() as any;
      expect(tx.subcategory_id).toBeNull();
    });

    it('throws for non-existent category', () => {
      expect(() => deleteCategory(999)).toThrow('Category 999 not found');
    });
  });

  describe('createSubcategory', () => {
    it('creates a subcategory', () => {
      const cat = createCategory({ name: 'Food' });
      const sub = createSubcategory({ categoryId: cat.id, name: 'Groceries' });
      expect(sub.id).toBeGreaterThan(0);
      expect(sub.categoryId).toBe(cat.id);
      expect(sub.name).toBe('Groceries');
    });

    it('throws for non-existent category', () => {
      expect(() => createSubcategory({ categoryId: 999, name: 'Sub' })).toThrow('Category 999 not found');
    });

    it('rejects empty name', () => {
      const cat = createCategory({ name: 'Food' });
      expect(() => createSubcategory({ categoryId: cat.id, name: '' })).toThrow('Category name is required');
    });
  });

  describe('renameSubcategory', () => {
    it('renames a subcategory', () => {
      const cat = createCategory({ name: 'Food' });
      const sub = createSubcategory({ categoryId: cat.id, name: 'Old' });
      const renamed = renameSubcategory({ id: sub.id, name: 'New' });
      expect(renamed.id).toBe(sub.id);
      expect(renamed.name).toBe('New');
      expect(renamed.categoryId).toBe(cat.id);
    });

    it('throws for non-existent subcategory', () => {
      expect(() => renameSubcategory({ id: 999, name: 'New' })).toThrow('Subcategory 999 not found');
    });
  });

  describe('deleteSubcategory', () => {
    it('deletes a subcategory', () => {
      const cat = createCategory({ name: 'Food' });
      const sub = createSubcategory({ categoryId: cat.id, name: 'Groceries' });
      deleteSubcategory(sub.id);

      const cats = listCategories();
      expect(cats[0].subcategories).toHaveLength(0);
    });

    it('throws for non-existent subcategory', () => {
      expect(() => deleteSubcategory(999)).toThrow('Subcategory 999 not found');
    });
  });
});
