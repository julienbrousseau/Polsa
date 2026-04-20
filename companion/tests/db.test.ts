// companion/tests/db.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import {
  getDB,
  resetDB,
  getAllAccounts,
  replaceAllAccounts,
  getAllCategories,
  getAllSubcategories,
  replaceAllCategories,
  getAllPendingTransactions,
  addPendingTransaction,
  updatePendingTransaction,
  deletePendingTransaction,
  markTransactionsSynced,
  deleteSyncedTransactions,
  getUnsyncedCount,
  getPendingCount,
} from '../src/db';
import type { MobileAccount, PendingTransaction } from '../src/lib/types';

beforeEach(async () => {
  // Clear all stores between tests to avoid data leakage
  const db = await getDB();
  const stores = ['accounts', 'categories', 'subcategories', 'pendingTransactions'] as const;
  for (const store of stores) {
    await db.clear(store);
  }
});

describe('db - accounts', () => {
  it('stores and retrieves accounts', async () => {
    const accounts: MobileAccount[] = [
      { id: 1, name: 'Current', type: 'checking', currentBalance: 100000 },
      { id: 2, name: 'Wallet', type: 'cash', currentBalance: 500000 },
    ];

    await replaceAllAccounts(accounts);
    const result = await getAllAccounts();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Current');
    expect(result[0].currentBalance).toBe(100000);
  });

  it('replaces all accounts on sync', async () => {
    await replaceAllAccounts([
      { id: 1, name: 'Old', type: 'cash', currentBalance: 0 },
    ]);
    await replaceAllAccounts([
      { id: 2, name: 'New', type: 'checking', currentBalance: 5000 },
    ]);

    const result = await getAllAccounts();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('New');
  });
});

describe('db - categories', () => {
  it('stores and retrieves categories and subcategories', async () => {
    await replaceAllCategories(
      [{ id: 1, name: 'Food' }],
      [
        { id: 1, categoryId: 1, name: 'Groceries' },
        { id: 2, categoryId: 1, name: 'Eating Out' },
      ],
    );

    const cats = await getAllCategories();
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe('Food');

    const subs = await getAllSubcategories();
    expect(subs).toHaveLength(2);
  });

  it('replaces all categories on sync', async () => {
    await replaceAllCategories(
      [{ id: 1, name: 'Old' }],
      [],
    );
    await replaceAllCategories(
      [{ id: 2, name: 'New' }],
      [{ id: 3, categoryId: 2, name: 'Sub' }],
    );

    const cats = await getAllCategories();
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe('New');
  });
});

describe('db - pending transactions', () => {
  const makeTx = (overrides?: Partial<PendingTransaction>): PendingTransaction => ({
    id: crypto.randomUUID(),
    accountId: 1,
    date: '2026-04-20',
    amount: -4520,
    subcategoryId: null,
    description: 'Test',
    createdAt: new Date().toISOString(),
    synced: false,
    ...overrides,
  });

  it('adds and retrieves transactions', async () => {
    const tx = makeTx();
    await addPendingTransaction(tx);

    const all = await getAllPendingTransactions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(tx.id);
    expect(all[0].amount).toBe(-4520);
  });

  it('deletes a transaction', async () => {
    const tx = makeTx();
    await addPendingTransaction(tx);
    await deletePendingTransaction(tx.id);

    const all = await getAllPendingTransactions();
    expect(all).toHaveLength(0);
  });

  it('updates a transaction', async () => {
    const tx = makeTx();
    await addPendingTransaction(tx);

    tx.description = 'Updated';
    tx.amount = -9999;
    await updatePendingTransaction(tx);

    const all = await getAllPendingTransactions();
    expect(all[0].description).toBe('Updated');
    expect(all[0].amount).toBe(-9999);
  });

  it('marks transactions as synced', async () => {
    const tx1 = makeTx({ id: 'tx-1' });
    const tx2 = makeTx({ id: 'tx-2' });
    await addPendingTransaction(tx1);
    await addPendingTransaction(tx2);

    await markTransactionsSynced(['tx-1']);

    const all = await getAllPendingTransactions();
    const synced = all.find(t => t.id === 'tx-1');
    const unsynced = all.find(t => t.id === 'tx-2');
    expect(synced!.synced).toBe(true);
    expect(unsynced!.synced).toBe(false);
  });

  it('deletes synced transactions', async () => {
    const tx1 = makeTx({ id: 'tx-1' });
    const tx2 = makeTx({ id: 'tx-2' });
    await addPendingTransaction(tx1);
    await addPendingTransaction(tx2);
    await markTransactionsSynced(['tx-1']);
    await deleteSyncedTransactions();

    const all = await getAllPendingTransactions();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('tx-2');
  });

  it('counts pending and unsynced', async () => {
    await addPendingTransaction(makeTx({ id: 'tx-1' }));
    await addPendingTransaction(makeTx({ id: 'tx-2' }));
    await markTransactionsSynced(['tx-1']);

    expect(await getPendingCount()).toBe(2);
    expect(await getUnsyncedCount()).toBe(1);
  });

  it('stores amounts as integers (cents)', async () => {
    await addPendingTransaction(makeTx({ amount: -99 }));
    await addPendingTransaction(makeTx({ amount: 1200 }));

    const all = await getAllPendingTransactions();
    const amounts = all.map(t => t.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([-99, 1200]);
  });
});
