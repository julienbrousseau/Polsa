// IndexedDB schema and operations for the companion app
import { openDB } from 'idb';
const DB_NAME = 'polsa-companion';
const DB_VERSION = 1;
let dbPromise = null;
export function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
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
export function setDB(db) {
    dbPromise = Promise.resolve(db);
}
export function resetDB() {
    dbPromise = null;
}
// ── Account operations ──
// Only expose checking and cash accounts in the companion app
const COMPANION_ACCOUNT_TYPES = new Set(['checking', 'cash']);
export async function getAllAccounts() {
    const db = await getDB();
    const all = await db.getAll('accounts');
    return all.filter(a => COMPANION_ACCOUNT_TYPES.has(a.type));
}
export async function getAccount(id) {
    const db = await getDB();
    return db.get('accounts', id);
}
export async function replaceAllAccounts(accounts) {
    const db = await getDB();
    const tx = db.transaction('accounts', 'readwrite');
    await tx.store.clear();
    for (const account of accounts) {
        await tx.store.put(account);
    }
    await tx.done;
}
// ── Category operations ──
export async function getAllCategories() {
    const db = await getDB();
    return db.getAll('categories');
}
export async function getAllSubcategories() {
    const db = await getDB();
    return db.getAll('subcategories');
}
export async function getSubcategoriesByCategory(categoryId) {
    const db = await getDB();
    return db.getAllFromIndex('subcategories', 'byCategory', categoryId);
}
export async function replaceAllCategories(categories, subcategories) {
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
export async function getAllPendingTransactions() {
    const db = await getDB();
    return db.getAll('pendingTransactions');
}
export async function getUnsyncedTransactions() {
    const db = await getDB();
    // bySynced index: 0 = false (not synced)
    return db.getAllFromIndex('pendingTransactions', 'bySynced', 0);
}
export async function addPendingTransaction(tx) {
    const db = await getDB();
    await db.put('pendingTransactions', {
        ...tx,
        // IndexedDB can't index booleans, store as 0/1 in the index
        synced: tx.synced,
    });
}
export async function updatePendingTransaction(tx) {
    const db = await getDB();
    await db.put('pendingTransactions', tx);
}
export async function deletePendingTransaction(id) {
    const db = await getDB();
    await db.delete('pendingTransactions', id);
}
export async function markTransactionsSynced(ids) {
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
export async function deleteSyncedTransactions() {
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
export async function getPendingCount() {
    const db = await getDB();
    return db.count('pendingTransactions');
}
export async function getUnsyncedCount() {
    const db = await getDB();
    const all = await db.getAll('pendingTransactions');
    return all.filter(t => !t.synced).length;
}
//# sourceMappingURL=db.js.map