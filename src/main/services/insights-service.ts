import { getDb } from '../database';
import type { InsightsMonth } from '../../shared/types';
import { isValidInteger } from '../../shared/validation';

function monthBounds(year: number, month: number): { firstDay: string; nextFirstDay: string } {
  const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextFirstDay = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
  return { firstDay, nextFirstDay };
}

function validateMonthInput(year: number, month: number): void {
  if (!isValidInteger(year) || year < 1900 || year > 3000) {
    throw new Error('Invalid year');
  }
  if (!isValidInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid month');
  }
}

export function getMonthInsights(year: number, month: number): InsightsMonth {
  validateMonthInput(year, month);

  const db = getDb();
  const { firstDay, nextFirstDay } = monthBounds(year, month);

  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS total_earned,
      COALESCE(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 0) AS total_spent
    FROM transactions t
    WHERE t.date >= ?
      AND t.date < ?
      AND t.transaction_type = 'standard'
  `).get(firstDay, nextFirstDay) as { total_earned: number; total_spent: number };

  const rows = db.prepare(`
    SELECT
      COALESCE(c_sub.id, c_dir.id) AS category_id,
      COALESCE(c_sub.name, c_dir.name) AS category_name,
      COALESCE(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 0) AS expense_amount,
      COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS income_amount
    FROM transactions t
    LEFT JOIN subcategories s ON s.id = t.subcategory_id
    LEFT JOIN categories c_sub ON c_sub.id = s.category_id
    LEFT JOIN categories c_dir ON c_dir.id = t.category_id
    WHERE t.date >= ?
      AND t.date < ?
      AND t.transaction_type = 'standard'
      AND COALESCE(c_sub.name, c_dir.name) IS NOT NULL
    GROUP BY COALESCE(c_sub.id, c_dir.id), COALESCE(c_sub.name, c_dir.name)
    ORDER BY COALESCE(c_sub.name, c_dir.name) COLLATE NOCASE ASC
  `).all(firstDay, nextFirstDay) as Array<{
    category_id: number;
    category_name: string;
    expense_amount: number;
    income_amount: number;
  }>;

  const expenseCategories = rows
    .filter((row) => row.expense_amount > 0)
    .map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      amount: row.expense_amount,
    }));

  const incomeCategories = rows
    .filter((row) => row.income_amount > 0)
    .map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      amount: row.income_amount,
    }));

  return {
    year,
    month,
    totalEarned: summary.total_earned,
    totalSpent: summary.total_spent,
    balance: summary.total_earned - summary.total_spent,
    expenseCategories,
    incomeCategories,
  };
}