// Sync logic — QR code + local network
import { getUnsyncedTransactions, markTransactionsSynced, deleteSyncedTransactions, replaceAllAccounts, replaceAllCategories, } from './db';
// ── QR Payload Generation ──
const MAX_QR_BYTES = 2800; // conservative limit for a single QR code
export function buildSyncPayloads(transactions) {
    const items = transactions.map(t => ({
        id: t.id,
        accountId: t.accountId,
        date: t.date,
        amount: t.amount,
        subcategoryId: t.subcategoryId,
        description: t.description,
    }));
    if (items.length === 0) {
        return [{ version: 1, transactions: [] }];
    }
    // Try to fit into a single payload first
    const single = { version: 1, transactions: items };
    if (JSON.stringify(single).length <= MAX_QR_BYTES) {
        return [single];
    }
    // Split into chunks that fit
    const payloads = [];
    let chunk = [];
    for (const item of items) {
        chunk.push(item);
        const candidate = { version: 1, transactions: chunk };
        if (JSON.stringify(candidate).length > MAX_QR_BYTES) {
            // Remove last item and finalize this chunk
            chunk.pop();
            if (chunk.length > 0) {
                payloads.push({ version: 1, transactions: [...chunk] });
            }
            chunk = [item];
        }
    }
    if (chunk.length > 0) {
        payloads.push({ version: 1, transactions: chunk });
    }
    return payloads;
}
// ── Desktop Confirmation Processing ──
export async function processDesktopPayload(payload) {
    // Mark synced transactions
    if (payload.syncedIds.length > 0) {
        await markTransactionsSynced(payload.syncedIds);
        await deleteSyncedTransactions();
    }
    // Update reference data
    const accounts = payload.accounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currentBalance: a.currentBalance,
    }));
    await replaceAllAccounts(accounts);
    const categories = payload.categories.map(c => ({
        id: c.id,
        name: c.name,
    }));
    const subcategories = payload.subcategories.map(s => ({
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
    }));
    await replaceAllCategories(categories, subcategories);
    return {
        syncedCount: payload.syncedIds.length,
        accountsUpdated: accounts.length,
        categoriesUpdated: categories.length + subcategories.length,
    };
}
// ── Local Network Sync ──
export async function syncViaNetwork(serverUrl) {
    const unsynced = await getUnsyncedTransactions();
    const payload = {
        version: 1,
        transactions: unsynced.map(t => ({
            id: t.id,
            accountId: t.accountId,
            date: t.date,
            amount: t.amount,
            subcategoryId: t.subcategoryId,
            description: t.description,
        })),
    };
    const response = await fetch(`${serverUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }
    const desktopPayload = await response.json();
    return processDesktopPayload(desktopPayload);
}
// ── Payload parsing & validation ──
export function parseDesktopPayload(data) {
    try {
        const parsed = JSON.parse(data);
        if (parsed &&
            parsed.version === 1 &&
            Array.isArray(parsed.syncedIds) &&
            Array.isArray(parsed.accounts) &&
            Array.isArray(parsed.categories) &&
            Array.isArray(parsed.subcategories)) {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=sync.js.map