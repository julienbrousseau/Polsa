// src/main/services/sync-service.ts

import { getDb } from '../database';
import { listAccounts } from './account-service';
import { listCategories } from './category-service';

export interface MobileSyncPayload {
  version: 1;
  transactions: {
    id: string;
    accountId: number;
    date: string;
    amount: number;
    subcategoryId: number | null;
    description: string;
  }[];
}

export interface DesktopSetupPayload {
  version: 1;
  accounts: { id: number; name: string; type: string }[];
  categories: { id: number; name: string }[];
  subcategories: { id: number; categoryId: number; name: string }[];
}

export interface DesktopSyncPayload {
  version: 1;
  syncedIds: string[];
  accounts: { id: number; name: string; type: string; currentBalance: number }[];
  categories: { id: number; name: string }[];
  subcategories: { id: number; categoryId: number; name: string }[];
}

export interface MobileImportResult {
  imported: number;
  duplicates: number;
}

export function importMobileTransactions(payload: MobileSyncPayload): MobileImportResult {
  if (payload.version !== 1) {
    throw new Error(`Unsupported sync payload version: ${payload.version}`);
  }

  const db = getDb();
  let imported = 0;
  let duplicates = 0;

  const insertStmt = db.prepare(`
    INSERT INTO transactions (account_id, date, amount, subcategory_id, description, mobile_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const checkDupStmt = db.prepare(`
    SELECT id FROM transactions WHERE mobile_id = ?
  `);

  const checkAccountStmt = db.prepare(`
    SELECT id FROM accounts WHERE id = ?
  `);

  const checkSubcatStmt = db.prepare(`
    SELECT id FROM subcategories WHERE id = ?
  `);

  db.transaction(() => {
    for (const tx of payload.transactions) {
      // Validate mobile_id
      if (!tx.id || typeof tx.id !== 'string') continue;

      // Check for duplicate
      const existing = checkDupStmt.get(tx.id);
      if (existing) {
        duplicates++;
        continue;
      }

      // Validate account exists
      const account = checkAccountStmt.get(tx.accountId);
      if (!account) continue;

      // Validate subcategory exists if provided
      if (tx.subcategoryId != null) {
        const sub = checkSubcatStmt.get(tx.subcategoryId);
        if (!sub) {
          // Subcategory doesn't exist (may have been deleted) — import without category
          insertStmt.run(tx.accountId, tx.date, tx.amount, null, tx.description || '', tx.id);
          imported++;
          continue;
        }
      }

      insertStmt.run(
        tx.accountId,
        tx.date,
        tx.amount,
        tx.subcategoryId ?? null,
        tx.description || '',
        tx.id,
      );
      imported++;
    }
  })();

  return { imported, duplicates };
}

/**
 * Slim payload for initial "Send to Mobile" — no balances, no syncedIds.
 * accountIds: if non-empty, only those accounts are included.
 */
export function generateSetupPayload(accountIds: number[]): DesktopSetupPayload {
  const allAccounts = listAccounts();
  const filtered = accountIds.length > 0
    ? allAccounts.filter(a => accountIds.includes(a.id))
    : allAccounts;

  const accounts = filtered.map(a => ({ id: a.id, name: a.name, type: a.type }));

  const categoriesWithSubs = listCategories();
  const categories = categoriesWithSubs.map(c => ({ id: c.id, name: c.name }));
  const subcategories = categoriesWithSubs.flatMap(c =>
    c.subcategories.map(s => ({ id: s.id, categoryId: s.categoryId, name: s.name }))
  );

  return { version: 1, accounts, categories, subcategories };
}

export function generateDesktopPayload(syncedIds: string[], accountIds: number[] = []): DesktopSyncPayload {
  const allAccounts = listAccounts();
  const accountsFiltered = accountIds.length > 0
    ? allAccounts.filter(a => accountIds.includes(a.id))
    : allAccounts;
  const accounts = accountsFiltered.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currentBalance: a.currentBalance,
  }));

  const categoriesWithSubs = listCategories();
  const categories = categoriesWithSubs.map(c => ({ id: c.id, name: c.name }));
  const subcategories = categoriesWithSubs.flatMap(c =>
    c.subcategories.map(s => ({
      id: s.id,
      categoryId: s.categoryId,
      name: s.name,
    })),
  );

  return {
    version: 1,
    syncedIds,
    accounts,
    categories,
    subcategories,
  };
}
