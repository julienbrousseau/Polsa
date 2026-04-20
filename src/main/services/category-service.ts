// src/main/services/category-service.ts

import { getDb } from '../database';
import type { Category, CategoryWithSubs, Subcategory, CategoryTransactionInput, CategoryTransactionListResult, TransactionDisplay } from '../../shared/types';
import { validateCategoryName, isValidInteger } from '../../shared/validation';

export function listCategories(): CategoryWithSubs[] {
  const db = getDb();
  const cats = db.prepare(`
    SELECT id, name FROM categories ORDER BY name COLLATE NOCASE
  `).all() as Array<{ id: number; name: string }>;

  const subs = db.prepare(`
    SELECT id, category_id, name FROM subcategories ORDER BY name COLLATE NOCASE
  `).all() as Array<{ id: number; category_id: number; name: string }>;

  const subsByCategory = new Map<number, Subcategory[]>();
  for (const s of subs) {
    const list = subsByCategory.get(s.category_id) || [];
    list.push({ id: s.id, categoryId: s.category_id, name: s.name });
    subsByCategory.set(s.category_id, list);
  }

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    subcategories: subsByCategory.get(c.id) || [],
  }));
}

export function createCategory(input: { name: string }): Category {
  const nameError = validateCategoryName(input.name);
  if (nameError) throw new Error(nameError);

  const db = getDb();
  const result = db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(input.name.trim());
  return { id: result.lastInsertRowid as number, name: input.name.trim() };
}

export function renameCategory(input: { id: number; name: string }): Category {
  if (!isValidInteger(input.id)) throw new Error('Invalid category ID');
  const nameError = validateCategoryName(input.name);
  if (nameError) throw new Error(nameError);

  const db = getDb();
  const changes = db.prepare(`UPDATE categories SET name = ? WHERE id = ?`).run(input.name.trim(), input.id);
  if (changes.changes === 0) throw new Error(`Category ${input.id} not found`);
  return { id: input.id, name: input.name.trim() };
}

export function deleteCategory(id: number): void {
  if (!isValidInteger(id)) throw new Error('Invalid category ID');
  const db = getDb();
  const changes = db.transaction(() => {
    db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(id);
    return db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  })();
  if (changes.changes === 0) throw new Error(`Category ${id} not found`);
}

export function createSubcategory(input: { categoryId: number; name: string }): Subcategory {
  if (!isValidInteger(input.categoryId)) throw new Error('Invalid category ID');
  const nameError = validateCategoryName(input.name);
  if (nameError) throw new Error(nameError);

  const db = getDb();
  // Check category exists
  const cat = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(input.categoryId);
  if (!cat) throw new Error(`Category ${input.categoryId} not found`);

  const result = db.prepare(`INSERT INTO subcategories (category_id, name) VALUES (?, ?)`).run(input.categoryId, input.name.trim());
  return { id: result.lastInsertRowid as number, categoryId: input.categoryId, name: input.name.trim() };
}

export function renameSubcategory(input: { id: number; name: string }): Subcategory {
  if (!isValidInteger(input.id)) throw new Error('Invalid subcategory ID');
  const nameError = validateCategoryName(input.name);
  if (nameError) throw new Error(nameError);

  const db = getDb();
  const row = db.prepare(`SELECT id, category_id, name FROM subcategories WHERE id = ?`).get(input.id) as { id: number; category_id: number; name: string } | undefined;
  if (!row) throw new Error(`Subcategory ${input.id} not found`);

  db.prepare(`UPDATE subcategories SET name = ? WHERE id = ?`).run(input.name.trim(), input.id);
  return { id: input.id, categoryId: row.category_id, name: input.name.trim() };
}

export function deleteSubcategory(id: number): void {
  if (!isValidInteger(id)) throw new Error('Invalid subcategory ID');
  const db = getDb();
  const changes = db.prepare(`DELETE FROM subcategories WHERE id = ?`).run(id);
  if (changes.changes === 0) throw new Error(`Subcategory ${id} not found`);
}

export function listCategoryTransactions(input: CategoryTransactionInput): CategoryTransactionListResult {
  if (!isValidInteger(input.offset) || input.offset < 0) throw new Error('Invalid offset');
  if (!isValidInteger(input.limit) || input.limit < 1) throw new Error('Invalid limit');

  const db = getDb();

  let whereClause: string;
  let params: any[];

  if (input.subcategoryId != null) {
    // Specific subcategory
    whereClause = 't.subcategory_id = ?';
    params = [input.subcategoryId];
  } else if (input.categoryId != null) {
    // Category-level transactions + all subcategories of a category
    whereClause = '(s.category_id = ? OR t.category_id = ?)';
    params = [input.categoryId, input.categoryId];
  } else {
    throw new Error('Either categoryId or subcategoryId is required');
  }

  const totalRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM transactions t
    LEFT JOIN subcategories s ON s.id = t.subcategory_id
    WHERE ${whereClause}
  `).get(...params) as { total: number };

  const rows = db.prepare(`
    SELECT t.id, t.account_id, t.date, t.amount, t.category_id, t.subcategory_id, t.description, t.reconciled,
        s.name as subcategory_name,
        COALESCE(c_sub.name, c_dir.name) as category_name,
           a.name as account_name
    FROM transactions t
    LEFT JOIN subcategories s ON s.id = t.subcategory_id
      LEFT JOIN categories c_sub ON c_sub.id = s.category_id
      LEFT JOIN categories c_dir ON c_dir.id = t.category_id
    LEFT JOIN accounts a ON a.id = t.account_id
    WHERE ${whereClause}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, input.limit, input.offset) as Array<{
    id: number;
    account_id: number;
    date: string;
    amount: number;
    category_id: number | null;
    subcategory_id: number | null;
    description: string;
    reconciled: number;
    subcategory_name: string | null;
    category_name: string | null;
    account_name: string;
  }>;

  const transactions: TransactionDisplay[] = rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    date: r.date,
    amount: r.amount,
    categoryId: r.category_id,
    subcategoryId: r.subcategory_id,
    description: r.description,
    reconciled: r.reconciled === 1,
    categoryName: r.category_name,
    subcategoryName: r.subcategory_name,
    runningBalance: 0, // Not meaningful in cross-account view
  }));

  return { transactions, total: totalRow.total };
}
