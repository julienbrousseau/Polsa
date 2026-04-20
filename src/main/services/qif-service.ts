// src/main/services/qif-service.ts

import { getDb } from '../database';
import fs from 'fs';
import type {
  QifImportInput,
  QifImportResult,
  QifExportInput,
  QifExportResult,
  QifDateFormat,
} from '../../shared/types';
import { isValidInteger } from '../../shared/validation';

// QIF account type mapping
const ACCOUNT_TYPE_TO_QIF: Record<string, string> = {
  checking: 'Bank',
  savings: 'Bank',
  cash: 'Cash',
  investments: 'Invst',
};

// ---- QIF Parsing ----

interface QifTransaction {
  date: string;       // ISO YYYY-MM-DD
  amount: number;     // cents
  description: string;
  category: string | null;
  subcategory: string | null;
}

function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function parseQifDate(raw: string, format: QifDateFormat): string {
  // Accept ISO 8601 dates directly (e.g. 2025-12-13).
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Normalise separators
  const cleaned = raw.replace(/[/\-.']/g, '/');
  const parts = cleaned.split('/');
  if (parts.length !== 3) throw new Error(`Invalid date: ${raw}`);

  let year: string, month: string, day: string;

  if (format === 'MM/DD/YYYY') {
    [month, day, year] = parts;
  } else {
    [day, month, year] = parts;
  }

  // Handle 2-digit year
  if (year.length === 2) {
    const y = parseInt(year, 10);
    year = (y < 50 ? '20' : '19') + year;
  }

  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseQifAmount(raw: string): number {
  // Remove commas and whitespace
  const cleaned = raw.replace(/[,\s]/g, '');
  const value = parseFloat(cleaned);
  if (isNaN(value)) throw new Error(`Invalid amount: ${raw}`);
  return Math.round(value * 100);
}

function parseQifFile(content: string, dateFormat: QifDateFormat = 'MM/DD/YYYY'): QifTransaction[] {
  const lines = content.split(/\r?\n/);
  const transactions: QifTransaction[] = [];
  let current: Partial<QifTransaction> = {};

  for (const line of lines) {
    if (line.startsWith('!') || line.trim() === '') continue;

    const code = line[0];
    const value = line.slice(1).trim();

    switch (code) {
      case 'D': // Date
        current.date = parseQifDate(value, dateFormat);
        break;
      case 'T': // Amount
      case 'U': // Amount (alternate)
        current.amount = parseQifAmount(value);
        break;
      case 'P': // Payee / description
      case 'M': // Memo (fallback for description)
        if (!current.description) {
          current.description = value;
        }
        break;
      case 'L': // Category
        if (value.includes(':')) {
          const [cat, sub] = value.split(':', 2);
          current.category = normalizeCategoryName(cat);
          current.subcategory = normalizeCategoryName(sub) || null;
        } else if (value.includes('/')) {
          const [cat, ...subParts] = value.split('/');
          const sub = normalizeCategoryName(subParts.join('/'));
          current.category = normalizeCategoryName(cat);
          current.subcategory = sub || null;
        } else {
          current.category = normalizeCategoryName(value);
          current.subcategory = null;
        }
        break;
      case '^': // End of record
        if (current.date && current.amount !== undefined) {
          transactions.push({
            date: current.date,
            amount: current.amount,
            description: current.description || '',
            category: current.category || null,
            subcategory: current.subcategory || null,
          });
        }
        current = {};
        break;
      // Ignore other fields (N, C, A, etc.)
    }
  }

  return transactions;
}

// ---- Import ----

export function importQif(input: QifImportInput): QifImportResult {
  if (!isValidInteger(input.accountId)) throw new Error('Invalid account ID');

  const db = getDb();

  // Verify account exists
  const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(input.accountId);
  if (!account) throw new Error(`Account ${input.accountId} not found`);

  // Read and parse file
  const content = fs.readFileSync(input.filePath, 'utf-8');
  const parsed = parseQifFile(content);

  const createdCategoriesSet = new Set<string>();

  // Use a transaction for atomicity
  const insertMany = db.transaction(() => {
    let imported = 0;

    for (const tx of parsed) {
      let categoryId: number | null = null;
      let subcategoryId: number | null = null;

      if (tx.category) {
        // Find or create category
        let catRow = db.prepare('SELECT id FROM categories WHERE name = ?').get(tx.category) as { id: number } | undefined;
        if (!catRow) {
          const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(tx.category);
          catRow = { id: result.lastInsertRowid as number };
          createdCategoriesSet.add(tx.category);
        }
        categoryId = catRow.id;

        if (tx.subcategory) {
          // Find or create subcategory
          let subRow = db.prepare('SELECT id FROM subcategories WHERE category_id = ? AND name = ?').get(catRow.id, tx.subcategory) as { id: number } | undefined;
          if (!subRow) {
            const result = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)').run(catRow.id, tx.subcategory);
            subRow = { id: result.lastInsertRowid as number };
            createdCategoriesSet.add(`${tx.category}:${tx.subcategory}`);
          }
          subcategoryId = subRow.id;
          categoryId = null;
        }
      }

      db.prepare(`
        INSERT INTO transactions (account_id, date, amount, category_id, subcategory_id, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(input.accountId, tx.date, tx.amount, categoryId, subcategoryId, tx.description);

      imported++;
    }

    return imported;
  });

  const imported = insertMany();

  return {
    imported,
    createdCategories: Array.from(createdCategoriesSet),
  };
}

// ---- Export ----

function formatQifDate(isoDate: string): string {
  // Export as MM/DD/YYYY
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

function formatQifAmount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}.${frac.toString().padStart(2, '0')}`;
}

export function exportQif(input: QifExportInput): QifExportResult {
  if (!isValidInteger(input.accountId)) throw new Error('Invalid account ID');

  const db = getDb();

  const account = db.prepare('SELECT id, type FROM accounts WHERE id = ?').get(input.accountId) as { id: number; type: string } | undefined;
  if (!account) throw new Error(`Account ${input.accountId} not found`);

  // Build query with optional date range
  let whereClause = 'WHERE t.account_id = ?';
  const params: any[] = [input.accountId];

  if (input.dateFrom) {
    whereClause += ' AND t.date >= ?';
    params.push(input.dateFrom);
  }
  if (input.dateTo) {
    whereClause += ' AND t.date <= ?';
    params.push(input.dateTo);
  }

  const rows = db.prepare(`
    SELECT t.date, t.amount, t.description,
           s.name as subcategory_name,
           COALESCE(c_sub.name, c_dir.name) as category_name
    FROM transactions t
    LEFT JOIN subcategories s ON s.id = t.subcategory_id
    LEFT JOIN categories c_sub ON c_sub.id = s.category_id
    LEFT JOIN categories c_dir ON c_dir.id = t.category_id
    ${whereClause}
    ORDER BY t.date ASC, t.id ASC
  `).all(...params) as Array<{
    date: string;
    amount: number;
    description: string;
    subcategory_name: string | null;
    category_name: string | null;
  }>;

  const qifType = ACCOUNT_TYPE_TO_QIF[account.type] || 'Bank';
  const lines: string[] = [`!Type:${qifType}`];

  for (const row of rows) {
    lines.push(`D${formatQifDate(row.date)}`);
    lines.push(`T${formatQifAmount(row.amount)}`);
    if (row.description) {
      lines.push(`P${row.description}`);
    }
    if (row.category_name) {
      if (row.subcategory_name) {
        lines.push(`L${row.category_name}:${row.subcategory_name}`);
      } else {
        lines.push(`L${row.category_name}`);
      }
    }
    lines.push('^');
  }

  fs.writeFileSync(input.filePath, lines.join('\n') + '\n', 'utf-8');

  return { exported: rows.length };
}

// Exported for testing
export { parseQifFile, parseQifDate, parseQifAmount, formatQifDate, formatQifAmount };
