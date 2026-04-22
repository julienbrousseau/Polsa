import fs from 'fs';
import { getDb } from '../database';
import type {
  ImportCommitInput,
  ImportCommitResult,
  ImportPreviewInput,
  ImportPreviewResult,
  ImportPreviewTransaction,
  QifDateFormat,
} from '../../shared/types';
import { isValidInteger } from '../../shared/validation';
import { parseQifFile } from './qif-service';

interface ParsedImportTransaction {
  date: string;
  description: string;
  amount: number;
  categoryName: string | null;
  subcategoryName: string | null;
  reconciled: boolean;
  sourceAccount?: string;
}

function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function parseAmountToCents(raw: string, rowNumber: number): number {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) {
    throw new Error(`Missing amount on row ${rowNumber}`);
  }

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount on row ${rowNumber}: ${raw}`);
  }

  return Math.round(value * 100);
}

function parseCsvRecords(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseCsvTags(raw: string): { categoryName: string | null; subcategoryName: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { categoryName: null, subcategoryName: null };
  }

  const parts = trimmed.split('/').map((part) => normalizeCategoryName(part)).filter(Boolean);
  if (parts.length === 0) {
    return { categoryName: null, subcategoryName: null };
  }

  return {
    categoryName: parts[0],
    subcategoryName: parts.length > 1 ? parts.slice(1).join(' / ') : null,
  };
}

function parseCsvFile(content: string): ParsedImportTransaction[] {
  const rows = parseCsvRecords(content.replace(/^\uFEFF/, ''));
  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((value) => value.trim());
  const dateIndex = header.indexOf('Date');
  const descriptionIndex = header.indexOf('Description');
  const amountIndex = header.indexOf('Amount');
  const tagsIndex = header.indexOf('Tags');
  const statusIndex = header.indexOf('Status');
  const accountIndex = header.indexOf('Account');

  if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1 || tagsIndex === -1 || statusIndex === -1) {
    throw new Error('CSV file is missing one or more required columns');
  }

  return rows.slice(1)
    .filter((row) => row.some((value) => value.trim() !== ''))
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const date = (row[dateIndex] ?? '').trim();
      if (!date) {
        throw new Error(`Missing date on row ${rowNumber}`);
      }

      const { categoryName, subcategoryName } = parseCsvTags(row[tagsIndex] ?? '');
      const sourceAccount = accountIndex !== -1 ? (row[accountIndex] ?? '').trim() || undefined : undefined;
      return {
        date,
        description: (row[descriptionIndex] ?? '').trim(),
        amount: parseAmountToCents(row[amountIndex] ?? '', rowNumber),
        categoryName,
        subcategoryName,
        reconciled: (row[statusIndex] ?? '').trim().toLowerCase() === 'reconciled',
        sourceAccount,
      };
    });
}

function parseImportFile(content: string, format: ImportPreviewInput['format'], dateFormat: QifDateFormat): ParsedImportTransaction[] {
  if (format === 'csv') {
    return parseCsvFile(content);
  }

  return parseQifFile(content, dateFormat).map((transaction) => ({
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    categoryName: transaction.category,
    subcategoryName: transaction.subcategory,
    reconciled: false,
  }));
}

function assertAccountExists(accountId: number): void {
  if (!isValidInteger(accountId)) {
    throw new Error('Invalid account ID');
  }

  const db = getDb();
  const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }
}

function readParsedTransactions(input: ImportPreviewInput | ImportCommitInput): ParsedImportTransaction[] {
  assertAccountExists(input.accountId);
  const content = fs.readFileSync(input.filePath, 'utf-8');
  return parseImportFile(content, input.format, input.dateFormat ?? 'MM/DD/YYYY');
}

function collectCreatedCategories(transactions: ParsedImportTransaction[]): string[] {
  const db = getDb();
  const created = new Set<string>();

  for (const transaction of transactions) {
    if (!transaction.categoryName) {
      continue;
    }

    const categoryRow = db.prepare('SELECT id FROM categories WHERE name = ?').get(transaction.categoryName) as { id: number } | undefined;
    if (!categoryRow) {
      created.add(transaction.categoryName);
      if (transaction.subcategoryName) {
        created.add(`${transaction.categoryName}:${transaction.subcategoryName}`);
      }
      continue;
    }

    if (!transaction.subcategoryName) {
      continue;
    }

    const subcategoryRow = db.prepare('SELECT id FROM subcategories WHERE category_id = ? AND name = ?').get(categoryRow.id, transaction.subcategoryName) as { id: number } | undefined;
    if (!subcategoryRow) {
      created.add(`${transaction.categoryName}:${transaction.subcategoryName}`);
    }
  }

  return Array.from(created);
}

function insertImportedTransactions(accountId: number, transactions: ParsedImportTransaction[]): ImportCommitResult {
  const db = getDb();
  const created = new Set<string>();

  const imported = db.transaction(() => {
    let count = 0;

    for (const transaction of transactions) {
      let categoryId: number | null = null;
      let subcategoryId: number | null = null;

      if (transaction.categoryName) {
        let categoryRow = db.prepare('SELECT id FROM categories WHERE name = ?').get(transaction.categoryName) as { id: number } | undefined;
        if (!categoryRow) {
          const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(transaction.categoryName);
          categoryRow = { id: result.lastInsertRowid as number };
          created.add(transaction.categoryName);
        }

        if (transaction.subcategoryName) {
          let subcategoryRow = db.prepare('SELECT id FROM subcategories WHERE category_id = ? AND name = ?').get(categoryRow.id, transaction.subcategoryName) as { id: number } | undefined;
          if (!subcategoryRow) {
            const result = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)').run(categoryRow.id, transaction.subcategoryName);
            subcategoryRow = { id: result.lastInsertRowid as number };
            created.add(`${transaction.categoryName}:${transaction.subcategoryName}`);
          }
          subcategoryId = subcategoryRow.id;
        } else {
          categoryId = categoryRow.id;
        }
      }

      db.prepare(`
        INSERT INTO transactions (account_id, date, amount, category_id, subcategory_id, description, reconciled)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        accountId,
        transaction.date,
        transaction.amount,
        categoryId,
        subcategoryId,
        transaction.description,
        transaction.reconciled ? 1 : 0,
      );

      count++;
    }

    return count;
  })();

  return {
    imported,
    createdCategories: Array.from(created),
  };
}

export function previewImport(input: ImportPreviewInput): ImportPreviewResult {
  const transactions = readParsedTransactions(input);

  const sourceAccountsSet = new Set<string>();
  for (const t of transactions) {
    if (t.sourceAccount) {
      sourceAccountsSet.add(t.sourceAccount);
    }
  }
  const sourceAccounts = sourceAccountsSet.size > 0 ? Array.from(sourceAccountsSet).sort() : undefined;

  return {
    format: input.format,
    transactions: transactions.map((transaction): ImportPreviewTransaction => ({
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      categoryName: transaction.categoryName,
      subcategoryName: transaction.subcategoryName,
      reconciled: transaction.reconciled,
      sourceAccount: transaction.sourceAccount,
    })),
    createdCategories: collectCreatedCategories(transactions),
    sourceAccounts,
  };
}

export function commitImport(input: ImportCommitInput): ImportCommitResult {
  let transactions = readParsedTransactions(input);
  if (input.sourceAccount) {
    transactions = transactions.filter((t) => t.sourceAccount === input.sourceAccount);
  }
  return insertImportedTransactions(input.accountId, transactions);
}

export { parseCsvFile };