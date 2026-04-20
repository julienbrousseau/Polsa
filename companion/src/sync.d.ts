import type { MobileSyncPayload, DesktopSyncPayload, PendingTransaction } from './lib/types';
export declare function buildSyncPayloads(transactions: PendingTransaction[]): MobileSyncPayload[];
export declare function processDesktopPayload(payload: DesktopSyncPayload): Promise<{
    syncedCount: number;
    accountsUpdated: number;
    categoriesUpdated: number;
}>;
export declare function syncViaNetwork(serverUrl: string): Promise<{
    syncedCount: number;
    accountsUpdated: number;
    categoriesUpdated: number;
}>;
export declare function parseDesktopPayload(data: string): DesktopSyncPayload | null;
