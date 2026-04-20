// IndexedDB schema and operations for the companion app

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  MobileAccount,
  MobileCategory,
  MobileSubcategory,
  PendingTransaction,
} from './lib/types';

interface PolsaCompanionDB extends DBSchema {
  accounts: {
    key: number;
    value: MobileAccount;
  };
  categories: {
    key: number;
    value: MobileCategory;
  };
  subcategories: {
    key: number;
    value: MobileSubcategory;
    indexes: { byCategory: number };
  };
  pendingTransactions: {
    key: string;
    value: PendingTransaction;
    indexes: { byAccount: number; bySynced: number };
  };
}

const DB_NAME = 'polsa-companion';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PolsaCompanionDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PolsaCompanionDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PolsaCompanionDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Accounts store (read-only mirror from desktop)
        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts', { keyPath: 'id' });
        }

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

        // Subcategories store
        if (!db.objectStoreNames.contains('subcategories')) {
          const subStore = db.createObjectStore('subcategories', { keyPath: 'id' });
          subStore.createIndex('byCategory', 'categoryId');
        }

        // Pending transactions store
        if (!db.objectStoreNames.contains('pendingTransactions')) {
          const txStore = db.createObjectStore('pendingTransactions', { keyPath: 'id' });
          txStore.createIndex('byAccount', 'accountId');
          txStore.createIndex('bySynced', 'synced');
        }
      },
    });
  }
  return dbPromise;
}

// For testing — allows injecting a fake DB
export function setDB(db: IDBPDatabase<PolsaCompanionDB>): void {
  dbPromise = Promise.resolve(db);
}

export function resetDB(): void {
  dbPromise = null;
}

// ── Account operations ──

// Only expose checking and cash accounts in the companion app
const COMPANION_ACCOUNT_TYPES: ReadonlySet<string> = new Set(['checking', 'cash']);

export async function getAllAccounts(): Promise<MobileAccount[]> {
  const db = await getDB();
  const all = await db.getAll('accounts');
  return all.filter(a => COMPANION_ACCOUNT_TYPES.has(a.type));
}

export async function getAccount(id: number): Promise<MobileAccount | undefined> {
  const db = await getDB();
  return db.get('accounts', id);
}

export async function replaceAllAccounts(accounts: MobileAccount[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('accounts', 'readwrite');
  await tx.store.clear();
  for (const account of accounts) {
    await tx.store.put(account);
  }
  await tx.done;
}

// ── Category operations ──

export async function getAllCategories(): Promise<MobileCategory[]> {
  const db = await getDB();
  return db.getAll('categories');
}

export async function getAllSubcategories(): Promise<MobileSubcategory[]> {
  const db = await getDB();
  return db.getAll('subcategories');
}

export async function getSubcategoriesByCategory(categoryId: number): Promise<MobileSubcategory[]> {
  const db = await getDB();
  return db.getAllFromIndex('subcategories', 'byCategory', categoryId);
}

export async function replaceAllCategories(
  categories: MobileCategory[],
  subcategories: MobileSubcategory[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'subcategories'], 'readwrite');
  const catStore = tx.objectStore('categories');
  const subStore = tx.objectStore('subcategories');
  await catStore.clear();
  await subStore.clear();
  for (const cat of categories) {
    await catStore.put(cat);
  }
  for (const sub of subcategories) {
    await subStore.put(sub);
  }
  await tx.done;
}

// ── Pending transaction operations ──

export async function getAllPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await getDB();
  return db.getAll('pendingTransactions');
}

export async function getUnsyncedTransactions(): Promise<PendingTransaction[]> {
  const db = await getDB();
  // bySynced index: 0 = false (not synced)
  return db.getAllFromIndex('pendingTransactions', 'bySynced', 0);
}

export async function addPendingTransaction(tx: PendingTransaction): Promise<void> {
  const db = await getDB();
  await db.put('pendingTransactions', {
    ...tx,
    // IndexedDB can't index booleans, store as 0/1 in the index
    synced: tx.synced,
  });
}

export async function updatePendingTransaction(tx: PendingTransaction): Promise<void> {
  const db = await getDB();
  await db.put('pendingTransactions', tx);
}

export async function deletePendingTransaction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingTransactions', id);
}

export async function markTransactionsSynced(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('pendingTransactions', 'readwrite');
  for (const id of ids) {
    const existing = await tx.store.get(id);
    if (existing) {
      existing.synced = true;
      await tx.store.put(existing);
    }
  }
  await tx.done;
}

export async function deleteSyncedTransactions(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('pendingTransactions', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.synced) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count('pendingTransactions');
}

export async function getUnsyncedCount(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('pendingTransactions');
  return all.filter(t => !t.synced).length;
}
