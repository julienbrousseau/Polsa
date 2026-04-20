// companion/tests/sync.test.ts

import { describe, it, expect } from 'vitest';
import { buildSyncPayloads, parseDesktopPayload } from '../src/sync';
import type { PendingTransaction, DesktopSyncPayload } from '../src/lib/types';

function makeTx(overrides?: Partial<PendingTransaction>): PendingTransaction {
  return {
    id: crypto.randomUUID(),
    accountId: 1,
    date: '2026-04-20',
    amount: -4520,
    subcategoryId: null,
    description: 'Test',
    createdAt: new Date().toISOString(),
    synced: false,
    ...overrides,
  };
}

describe('buildSyncPayloads', () => {
  it('returns single payload for empty list', () => {
    const payloads = buildSyncPayloads([]);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].version).toBe(1);
    expect(payloads[0].transactions).toHaveLength(0);
  });

  it('returns single payload for small transaction list', () => {
    const txs = [makeTx(), makeTx(), makeTx()];
    const payloads = buildSyncPayloads(txs);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].transactions).toHaveLength(3);
  });

  it('preserves transaction data in payload', () => {
    const tx = makeTx({ description: 'Coffee', amount: -380, subcategoryId: 5 });
    const payloads = buildSyncPayloads([tx]);
    const item = payloads[0].transactions[0];
    expect(item.id).toBe(tx.id);
    expect(item.amount).toBe(-380);
    expect(item.subcategoryId).toBe(5);
    expect(item.description).toBe('Coffee');
  });

  it('splits into multiple payloads when data exceeds QR limit', () => {
    // Create many transactions with long descriptions to exceed ~2800 bytes
    const txs = Array.from({ length: 50 }, (_, i) =>
      makeTx({ description: `Transaction number ${i} with a reasonably long description text` })
    );
    const payloads = buildSyncPayloads(txs);
    expect(payloads.length).toBeGreaterThan(1);

    // All transactions should be accounted for
    const totalTxCount = payloads.reduce((sum, p) => sum + p.transactions.length, 0);
    expect(totalTxCount).toBe(50);

    // Each payload should be under the size limit
    for (const payload of payloads) {
      expect(JSON.stringify(payload).length).toBeLessThanOrEqual(2800);
    }
  });

  it('all payloads have version 1', () => {
    const txs = Array.from({ length: 50 }, () =>
      makeTx({ description: 'A long description to fill up bytes quickly and test splitting logic' })
    );
    const payloads = buildSyncPayloads(txs);
    for (const p of payloads) {
      expect(p.version).toBe(1);
    }
  });
});

describe('parseDesktopPayload', () => {
  it('parses valid payload', () => {
    const payload: DesktopSyncPayload = {
      version: 1,
      syncedIds: ['uuid-001'],
      accounts: [{ id: 1, name: 'Current', type: 'checking', currentBalance: 100000 }],
      categories: [{ id: 1, name: 'Food' }],
      subcategories: [{ id: 1, categoryId: 1, name: 'Groceries' }],
    };

    const result = parseDesktopPayload(JSON.stringify(payload));
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.syncedIds).toEqual(['uuid-001']);
    expect(result!.accounts).toHaveLength(1);
  });

  it('returns null for invalid JSON', () => {
    expect(parseDesktopPayload('not json')).toBeNull();
  });

  it('returns null for wrong version', () => {
    expect(parseDesktopPayload(JSON.stringify({ version: 2, syncedIds: [], accounts: [], categories: [], subcategories: [] }))).toBeNull();
  });

  it('returns null for missing fields', () => {
    expect(parseDesktopPayload(JSON.stringify({ version: 1 }))).toBeNull();
    expect(parseDesktopPayload(JSON.stringify({ version: 1, syncedIds: [] }))).toBeNull();
  });
});
