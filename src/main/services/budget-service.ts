// src/main/services/budget-service.ts

import { getDb } from '../database';
import type {
  BudgetOverview,
  BudgetCategoryRow,
  BudgetSubcategoryRow,
  BudgetAllocation,
  SetAllocationInput,
  SetAllocationsInput,
  BudgetDefault,
} from '../../shared/types';
import { isValidInteger } from '../../shared/validation';

function monthBounds(year: number, month: number): { firstDay: string; nextFirstDay: string } {
  const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextFirstDay = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
  return { firstDay, nextFirstDay };
}

/**
 * Get the allocation for a subcategory (or category when subcategoryId is null) in a given month.
 * Falls back to budget_defaults if no explicit allocation exists.
 * Returns 0 if nothing is configured.
 */
export function getAllocation(subcategoryId: number | null, categoryId: number, year: number, month: number): number {
  const db = getDb();
  const ym = `${year}-${month.toString().padStart(2, '0')}`;

  if (subcategoryId === null) {
    // Category-level budget
    const row = db.prepare(`
      SELECT amount FROM budget_allocations
      WHERE subcategory_id IS NULL AND category_id = ? AND year = ? AND month = ?
    `).get(categoryId, year, month) as { amount: number } | undefined;

    if (row) return row.amount;

    const defaultRow = db.prepare(`
      SELECT amount FROM budget_defaults
      WHERE subcategory_id IS NULL AND category_id = ? AND effective_from <= ?
      ORDER BY effective_from DESC
      LIMIT 1
    `).get(categoryId, ym) as { amount: number } | undefined;

    return defaultRow ? defaultRow.amount : 0;
  }

  // Subcategory-level budget
  const row = db.prepare(`
    SELECT amount FROM budget_allocations
    WHERE subcategory_id = ? AND category_id = ? AND year = ? AND month = ?
  `).get(subcategoryId, categoryId, year, month) as { amount: number } | undefined;

  if (row) return row.amount;

  const defaultRow = db.prepare(`
    SELECT amount FROM budget_defaults
    WHERE subcategory_id = ? AND category_id = ? AND effective_from <= ?
    ORDER BY effective_from DESC
    LIMIT 1
  `).get(subcategoryId, categoryId, ym) as { amount: number } | undefined;

  return defaultRow ? defaultRow.amount : 0;
}

/**
 * Net spending for a subcategory (or entire category when subcategoryId is null) in a month.
 * spent = -SUM(amount). Refunds (positive amounts) reduce spending.
 */
export function getSpent(subcategoryId: number | null, categoryId: number, year: number, month: number): number {
  const db = getDb();
  const { firstDay, nextFirstDay } = monthBounds(year, month);

  if (subcategoryId === null) {
    // Category-level: sum across all subcategories in this category
    const row = db.prepare(`
      SELECT COALESCE(-SUM(t.amount), 0) AS spent
      FROM transactions t
      JOIN subcategories s ON t.subcategory_id = s.id
      WHERE s.category_id = ?
        AND t.date >= ?
        AND t.date < ?
    `).get(categoryId, firstDay, nextFirstDay) as { spent: number };
    return row.spent;
  }

  const row = db.prepare(`
    SELECT COALESCE(-SUM(t.amount), 0) AS spent
    FROM transactions t
    WHERE t.subcategory_id = ?
      AND t.date >= ?
      AND t.date < ?
  `).get(subcategoryId, firstDay, nextFirstDay) as { spent: number };

  return row.spent;
}

/**
 * Compute rollover for a subcategory/category-level budget in a given month.
 * Recursive within the year, 0 for January.
 */
export function getRollover(
  subcategoryId: number | null,
  categoryId: number,
  year: number,
  month: number,
  cache?: Map<string, number>,
): number {
  if (month <= 1) return 0;

  const cacheKey = `${subcategoryId ?? `cat${categoryId}`}:${year}:${month}`;
  if (cache?.has(cacheKey)) return cache.get(cacheKey)!;

  const prevMonth = month - 1;
  const prevAllocated = getAllocation(subcategoryId, categoryId, year, prevMonth);
  const prevRollover = getRollover(subcategoryId, categoryId, year, prevMonth, cache);
  const prevSpent = getSpent(subcategoryId, categoryId, year, prevMonth);
  const rollover = prevAllocated + prevRollover - prevSpent;

  cache?.set(cacheKey, rollover);
  return rollover;
}

/**
 * Build the full budget overview for a month.
 * For each category: if it has a category-level allocation, use that.
 * Otherwise, aggregate subcategory-level allocations.
 */
export function getOverview(year: number, month: number): BudgetOverview {
  if (!isValidInteger(year) || !isValidInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid year or month');
  }

  const db = getDb();
  const cache = new Map<string, number>();

  const categories = db.prepare(`
    SELECT c.id AS category_id, c.name AS category_name,
           s.id AS subcategory_id, s.name AS subcategory_name
    FROM categories c
    LEFT JOIN subcategories s ON s.category_id = c.id
    ORDER BY c.name, s.name
  `).all() as Array<{
    category_id: number;
    category_name: string;
    subcategory_id: number | null;
    subcategory_name: string | null;
  }>;

  // Group subcategories by category
  const catMap = new Map<number, {
    categoryId: number;
    categoryName: string;
    subs: Array<{ subcategoryId: number; subcategoryName: string }>;
  }>();

  for (const row of categories) {
    if (!catMap.has(row.category_id)) {
      catMap.set(row.category_id, {
        categoryId: row.category_id,
        categoryName: row.category_name,
        subs: [],
      });
    }
    if (row.subcategory_id != null) {
      catMap.get(row.category_id)!.subs.push({
        subcategoryId: row.subcategory_id,
        subcategoryName: row.subcategory_name!,
      });
    }
  }

  let totalAllocated = 0;
  let totalSpent = 0;
  let totalAvailable = 0;
  const budgetCategories: BudgetCategoryRow[] = [];

  for (const cat of catMap.values()) {
    // Determine if this category uses category-level or subcategory-level budgeting
    const catLevelAlloc = getAllocation(null, cat.categoryId, year, month);
    const hasCatLevelBudget = catLevelAlloc > 0 || hasCatLevelDefault(cat.categoryId);
    const hasSubcatBudgets = cat.subs.some(
      s => getAllocation(s.subcategoryId, cat.categoryId, year, month) > 0
    );

    // Use category-level if there's a category-level budget set,
    // OR if there are no subcategory budgets but there IS a category-level allocation
    const useCategoryLevel = hasCatLevelBudget && !hasSubcatBudgets;

    if (useCategoryLevel) {
      const allocated = catLevelAlloc;
      const rollover = getRollover(null, cat.categoryId, year, month, cache);
      const spent = getSpent(null, cat.categoryId, year, month);
      const available = allocated + rollover - spent;

      if (allocated > 0 || spent > 0 || rollover !== 0) {
        budgetCategories.push({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          allocated,
          rollover,
          spent,
          available,
          subcategories: [], // category-level: no sub breakdown
        });
        totalAllocated += allocated;
        totalSpent += spent;
        totalAvailable += available;
      }
    } else {
      // Subcategory-level
      let catAllocated = 0;
      let catRollover = 0;
      let catSpent = 0;
      const subcategoryRows: BudgetSubcategoryRow[] = [];

      for (const sub of cat.subs) {
        const allocated = getAllocation(sub.subcategoryId, cat.categoryId, year, month);
        const rollover = getRollover(sub.subcategoryId, cat.categoryId, year, month, cache);
        const spent = getSpent(sub.subcategoryId, cat.categoryId, year, month);
        const available = allocated + rollover - spent;

        catAllocated += allocated;
        catRollover += rollover;
        catSpent += spent;

        if (allocated > 0 || spent > 0 || rollover !== 0) {
          subcategoryRows.push({
            subcategoryId: sub.subcategoryId,
            subcategoryName: sub.subcategoryName,
            allocated,
            rollover,
            spent,
            available,
          });
        }
      }

      const catAvailable = catAllocated + catRollover - catSpent;

      if (catAllocated > 0 || catSpent > 0 || catRollover !== 0) {
        budgetCategories.push({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          allocated: catAllocated,
          rollover: catRollover,
          spent: catSpent,
          available: catAvailable,
          subcategories: subcategoryRows,
        });
        totalAllocated += catAllocated;
        totalSpent += catSpent;
        totalAvailable += catAvailable;
      }
    }
  }

  return {
    year,
    month,
    totalAllocated,
    totalSpent,
    totalAvailable,
    categories: budgetCategories,
  };
}

/**
 * Check whether a category has any category-level default configured.
 */
function hasCatLevelDefault(categoryId: number): boolean {
  const db = getDb();
  const row = db.prepare(`
    SELECT 1 FROM budget_defaults WHERE subcategory_id IS NULL AND category_id = ? LIMIT 1
  `).get(categoryId);
  return row != null;
}

/**
 * Get all allocations for the setup screen.
 * Returns one entry per subcategory (for subcategory-level mode) plus
 * one entry per category with subcategory_id = null (for category-level mode).
 */
export function getAllocations(year: number, month: number): BudgetAllocation[] {
  if (!isValidInteger(year) || !isValidInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid year or month');
  }

  const db = getDb();

  const subs = db.prepare(`
    SELECT s.id AS subcategory_id, s.name AS subcategory_name,
           c.id AS category_id, c.name AS category_name
    FROM subcategories s
    JOIN categories c ON s.category_id = c.id
    ORDER BY c.name, s.name
  `).all() as Array<{
    subcategory_id: number;
    subcategory_name: string;
    category_id: number;
    category_name: string;
  }>;

  // Also include category-level entries for each category that has one
  const cats = db.prepare(`SELECT id, name FROM categories ORDER BY name`).all() as Array<{ id: number; name: string }>;

  const result: BudgetAllocation[] = [];

  for (const cat of cats) {
    const catAmount = getAllocation(null, cat.id, year, month);
    result.push({
      subcategoryId: null,
      categoryId: cat.id,
      categoryName: cat.name,
      subcategoryName: null,
      amount: catAmount,
    });
  }

  for (const sub of subs) {
    result.push({
      subcategoryId: sub.subcategory_id,
      categoryId: sub.category_id,
      categoryName: sub.category_name,
      subcategoryName: sub.subcategory_name,
      amount: getAllocation(sub.subcategory_id, sub.category_id, year, month),
    });
  }

  return result;
}

/**
 * Set allocation for a subcategory or category (when subcategoryId is null).
 * Uses DELETE+INSERT for category-level (NULL) to avoid SQLite NULL uniqueness issue.
 */
export function setAllocation(input: SetAllocationInput): void {
  if (!isValidInteger(input.categoryId)) throw new Error('Invalid category ID');
  if (input.subcategoryId !== null && !isValidInteger(input.subcategoryId)) throw new Error('Invalid subcategory ID');
  if (!isValidInteger(input.year)) throw new Error('Invalid year');
  if (!isValidInteger(input.month) || input.month < 1 || input.month > 12) throw new Error('Invalid month');
  if (!isValidInteger(input.amount) || input.amount < 0) throw new Error('Invalid amount');

  const db = getDb();
  const ym = `${input.year}-${input.month.toString().padStart(2, '0')}`;

  db.transaction(() => {
    if (input.subcategoryId === null) {
      // Category-level: DELETE + INSERT (NULL uniqueness workaround)
      db.prepare(`
        DELETE FROM budget_allocations
        WHERE subcategory_id IS NULL AND category_id = ? AND year = ? AND month = ?
      `).run(input.categoryId, input.year, input.month);

      db.prepare(`
        INSERT INTO budget_allocations (subcategory_id, category_id, year, month, amount)
        VALUES (NULL, ?, ?, ?, ?)
      `).run(input.categoryId, input.year, input.month, input.amount);

      if (input.applyToFutureMonths) {
        db.prepare(`
          DELETE FROM budget_defaults
          WHERE subcategory_id IS NULL AND category_id = ? AND effective_from = ?
        `).run(input.categoryId, ym);

        db.prepare(`
          INSERT INTO budget_defaults (subcategory_id, category_id, amount, effective_from)
          VALUES (NULL, ?, ?, ?)
        `).run(input.categoryId, input.amount, ym);

        db.prepare(`
          DELETE FROM budget_allocations
          WHERE subcategory_id IS NULL AND category_id = ? AND year = ? AND month > ?
        `).run(input.categoryId, input.year, input.month);
      }
    } else {
      // Subcategory-level: upsert
      db.prepare(`
        INSERT INTO budget_allocations (subcategory_id, category_id, year, month, amount)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (category_id, year, month, subcategory_id)
        DO UPDATE SET amount = excluded.amount
      `).run(input.subcategoryId, input.categoryId, input.year, input.month, input.amount);

      if (input.applyToFutureMonths) {
        db.prepare(`
          INSERT INTO budget_defaults (subcategory_id, category_id, amount, effective_from)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (category_id, effective_from, subcategory_id)
          DO UPDATE SET amount = excluded.amount
        `).run(input.subcategoryId, input.categoryId, input.amount, ym);

        db.prepare(`
          DELETE FROM budget_allocations
          WHERE subcategory_id = ? AND category_id = ? AND year = ? AND month > ?
        `).run(input.subcategoryId, input.categoryId, input.year, input.month);
      }
    }
  })();
}

/**
 * Batch-set allocations (setup screen save).
 */
export function setAllocations(input: SetAllocationsInput): void {
  if (!isValidInteger(input.year)) throw new Error('Invalid year');
  if (!isValidInteger(input.month) || input.month < 1 || input.month > 12) throw new Error('Invalid month');

  const db = getDb();

  db.transaction(() => {
    for (const alloc of input.allocations) {
      if (!isValidInteger(alloc.categoryId)) throw new Error('Invalid category ID');
      if (alloc.subcategoryId !== null && !isValidInteger(alloc.subcategoryId)) throw new Error('Invalid subcategory ID');
      if (!isValidInteger(alloc.amount) || alloc.amount < 0) throw new Error('Invalid amount');

      const ym = `${input.year}-${input.month.toString().padStart(2, '0')}`;

      if (alloc.subcategoryId === null) {
        db.prepare(`
          DELETE FROM budget_allocations
          WHERE subcategory_id IS NULL AND category_id = ? AND year = ? AND month = ?
        `).run(alloc.categoryId, input.year, input.month);

        db.prepare(`
          INSERT INTO budget_allocations (subcategory_id, category_id, year, month, amount)
          VALUES (NULL, ?, ?, ?, ?)
        `).run(alloc.categoryId, input.year, input.month, alloc.amount);

        if (input.applyToFutureMonths) {
          db.prepare(`
            DELETE FROM budget_defaults
            WHERE subcategory_id IS NULL AND category_id = ? AND effective_from = ?
          `).run(alloc.categoryId, ym);

          db.prepare(`
            INSERT INTO budget_defaults (subcategory_id, category_id, amount, effective_from)
            VALUES (NULL, ?, ?, ?)
          `).run(alloc.categoryId, alloc.amount, ym);

          db.prepare(`
            DELETE FROM budget_allocations
            WHERE subcategory_id IS NULL AND category_id = ? AND year = ? AND month > ?
          `).run(alloc.categoryId, input.year, input.month);
        }
      } else {
        db.prepare(`
          INSERT INTO budget_allocations (subcategory_id, category_id, year, month, amount)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (category_id, year, month, subcategory_id)
          DO UPDATE SET amount = excluded.amount
        `).run(alloc.subcategoryId, alloc.categoryId, input.year, input.month, alloc.amount);

        if (input.applyToFutureMonths) {
          db.prepare(`
            INSERT INTO budget_defaults (subcategory_id, category_id, amount, effective_from)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (category_id, effective_from, subcategory_id)
            DO UPDATE SET amount = excluded.amount
          `).run(alloc.subcategoryId, alloc.categoryId, alloc.amount, ym);

          db.prepare(`
            DELETE FROM budget_allocations
            WHERE subcategory_id = ? AND category_id = ? AND year = ? AND month > ?
          `).run(alloc.subcategoryId, alloc.categoryId, input.year, input.month);
        }
      }
    }
  })();
}

/**
 * Get current budget defaults.
 */
export function getDefaults(): BudgetDefault[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT subcategory_id, category_id, amount, effective_from
    FROM budget_defaults
    ORDER BY effective_from DESC
  `).all() as Array<{
    subcategory_id: number | null;
    category_id: number;
    amount: number;
    effective_from: string;
  }>;

  return rows.map((r) => ({
    subcategoryId: r.subcategory_id,
    categoryId: r.category_id,
    amount: r.amount,
    effectiveFrom: r.effective_from,
  }));
}
