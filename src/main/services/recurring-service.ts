// src/main/services/recurring-service.ts

import { getDb } from '../database';
import type {
  RecurringTransaction,
  CreateRecurringInput,
  UpdateRecurringInput,
} from '../../shared/types';
import {
  isValidInteger,
  isValidFrequency,
  validateTransactionAmount,
  validateTransactionDate,
} from '../../shared/validation';

// ── Date advancement ────────────────────────────────────────

export function advanceDate(dateStr: string, frequency: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);

  switch (frequency) {
    case 'daily':
      return addDays(y, m, d, 1);
    case 'weekly':
      return addDays(y, m, d, 7);
    case 'fortnightly':
      return addDays(y, m, d, 14);
    case 'monthly':
      return addMonths(y, m, d, 1);
    case 'quarterly':
      return addMonths(y, m, d, 3);
    case 'yearly':
      return addMonths(y, m, d, 12);
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

function addDays(y: number, m: number, d: number, days: number): string {
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return formatISO(date);
}

function addMonths(y: number, m: number, d: number, months: number): string {
  let newMonth = m - 1 + months;
  let newYear = y + Math.floor(newMonth / 12);
  newMonth = newMonth % 12;
  // Clamp day to last day of target month
  const maxDay = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, maxDay);
  return formatISO(new Date(Date.UTC(newYear, newMonth, clampedDay)));
}

function formatISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Queries ────────────────────────────────────────────────

function mapRow(r: any): RecurringTransaction {
  return {
    id: r.id,
    accountId: r.account_id,
    accountName: r.account_name ?? '',
    description: r.description,
    amount: r.amount,
    subcategoryId: r.subcategory_id,
    categoryName: r.category_name ?? null,
    subcategoryName: r.subcategory_name ?? null,
    frequency: r.frequency,
    nextDate: r.next_date,
    active: r.active === 1,
  };
}

const SELECT_RECURRING = `
  SELECT rt.*, a.name AS account_name,
         s.name AS subcategory_name, c.name AS category_name
  FROM recurring_transactions rt
  JOIN accounts a ON a.id = rt.account_id
  LEFT JOIN subcategories s ON s.id = rt.subcategory_id
  LEFT JOIN categories c ON c.id = s.category_id
`;

export function listRecurring(): RecurringTransaction[] {
  const db = getDb();
  const rows = db.prepare(`${SELECT_RECURRING} ORDER BY rt.active DESC, rt.next_date ASC`).all();
  return rows.map(mapRow);
}

export function getRecurring(id: number): RecurringTransaction {
  if (!isValidInteger(id)) throw new Error('Invalid recurring ID');
  const db = getDb();
  const row = db.prepare(`${SELECT_RECURRING} WHERE rt.id = ?`).get(id);
  if (!row) throw new Error(`Recurring transaction ${id} not found`);
  return mapRow(row);
}

export function createRecurring(input: CreateRecurringInput): RecurringTransaction {
  if (!isValidInteger(input.accountId)) throw new Error('Invalid account ID');
  const amtErr = validateTransactionAmount(input.amount);
  if (amtErr) throw new Error(amtErr);
  const dateErr = validateTransactionDate(input.nextDate);
  if (dateErr) throw new Error(dateErr);
  if (!isValidFrequency(input.frequency)) throw new Error('Invalid frequency');
  if (typeof input.description !== 'string') throw new Error('Description is required');

  const db = getDb();

  // Verify account exists
  const acct = db.prepare('SELECT id FROM accounts WHERE id = ?').get(input.accountId);
  if (!acct) throw new Error(`Account ${input.accountId} not found`);

  // Verify subcategory if provided
  if (input.subcategoryId != null) {
    if (!isValidInteger(input.subcategoryId)) throw new Error('Invalid subcategory ID');
    const sub = db.prepare('SELECT id FROM subcategories WHERE id = ?').get(input.subcategoryId);
    if (!sub) throw new Error(`Subcategory ${input.subcategoryId} not found`);
  }

  const result = db.prepare(`
    INSERT INTO recurring_transactions (account_id, description, amount, subcategory_id, frequency, next_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.accountId,
    input.description.trim(),
    input.amount,
    input.subcategoryId ?? null,
    input.frequency,
    input.nextDate,
  );

  return getRecurring(result.lastInsertRowid as number);
}

export function updateRecurring(input: UpdateRecurringInput): RecurringTransaction {
  if (!isValidInteger(input.id)) throw new Error('Invalid recurring ID');

  const db = getDb();
  const existing = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(input.id) as any;
  if (!existing) throw new Error(`Recurring transaction ${input.id} not found`);

  const description = input.description !== undefined ? input.description.trim() : existing.description;
  const amount = input.amount !== undefined ? input.amount : existing.amount;
  const subcategoryId = input.subcategoryId !== undefined ? input.subcategoryId : existing.subcategory_id;
  const frequency = input.frequency !== undefined ? input.frequency : existing.frequency;
  const nextDate = input.nextDate !== undefined ? input.nextDate : existing.next_date;

  if (input.amount !== undefined) {
    const amtErr = validateTransactionAmount(input.amount);
    if (amtErr) throw new Error(amtErr);
  }
  if (input.nextDate !== undefined) {
    const dateErr = validateTransactionDate(input.nextDate);
    if (dateErr) throw new Error(dateErr);
  }
  if (input.frequency !== undefined && !isValidFrequency(input.frequency)) {
    throw new Error('Invalid frequency');
  }
  if (input.subcategoryId !== undefined && input.subcategoryId !== null) {
    if (!isValidInteger(input.subcategoryId)) throw new Error('Invalid subcategory ID');
    const sub = db.prepare('SELECT id FROM subcategories WHERE id = ?').get(input.subcategoryId);
    if (!sub) throw new Error(`Subcategory ${input.subcategoryId} not found`);
  }

  db.prepare(`
    UPDATE recurring_transactions
    SET description = ?, amount = ?, subcategory_id = ?, frequency = ?, next_date = ?
    WHERE id = ?
  `).run(description, amount, subcategoryId, frequency, nextDate, input.id);

  return getRecurring(input.id);
}

export function cancelRecurring(id: number): void {
  if (!isValidInteger(id)) throw new Error('Invalid recurring ID');
  const db = getDb();
  const changes = db.prepare('UPDATE recurring_transactions SET active = 0 WHERE id = ?').run(id);
  if (changes.changes === 0) throw new Error(`Recurring transaction ${id} not found`);
}

export function reactivateRecurring(id: number): RecurringTransaction {
  if (!isValidInteger(id)) throw new Error('Invalid recurring ID');
  const db = getDb();
  const changes = db.prepare('UPDATE recurring_transactions SET active = 1 WHERE id = ?').run(id);
  if (changes.changes === 0) throw new Error(`Recurring transaction ${id} not found`);
  return getRecurring(id);
}

export function deleteRecurring(id: number): void {
  if (!isValidInteger(id)) throw new Error('Invalid recurring ID');
  const db = getDb();
  const changes = db.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(id);
  if (changes.changes === 0) throw new Error(`Recurring transaction ${id} not found`);
}

// ── Apply overdue ──────────────────────────────────────────

export function applyOverdue(today?: string): { applied: number } {
  const db = getDb();
  const todayStr = today ?? formatISO(new Date());

  let applied = 0;

  const applyAll = db.transaction(() => {
    const rows = db.prepare(`
      SELECT * FROM recurring_transactions WHERE active = 1 AND next_date <= ?
    `).all(todayStr) as any[];

    const insertTx = db.prepare(`
      INSERT INTO transactions (account_id, date, amount, subcategory_id, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateNext = db.prepare(`
      UPDATE recurring_transactions SET next_date = ? WHERE id = ?
    `);

    for (const row of rows) {
      let nextDate = row.next_date;
      while (nextDate <= todayStr) {
        insertTx.run(row.account_id, nextDate, row.amount, row.subcategory_id, row.description);
        applied++;
        nextDate = advanceDate(nextDate, row.frequency);
      }
      updateNext.run(nextDate, row.id);
    }
  });

  applyAll();

  return { applied };
}
