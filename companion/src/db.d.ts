import { type DBSchema, type IDBPDatabase } from 'idb';
import type { MobileAccount, MobileCategory, MobileSubcategory, PendingTransaction } from './lib/types';
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
        indexes: {
            byCategory: number;
        };
    };
    pendingTransactions: {
        key: string;
        value: PendingTransaction;
        indexes: {
            byAccount: number;
            bySynced: number;
        };
    };
}
export declare function getDB(): Promise<IDBPDatabase<PolsaCompanionDB>>;
export declare function setDB(db: IDBPDatabase<PolsaCompanionDB>): void;
export declare function resetDB(): void;
export declare function getAllAccounts(): Promise<MobileAccount[]>;
export declare function getAccount(id: number): Promise<MobileAccount | undefined>;
export declare function replaceAllAccounts(accounts: MobileAccount[]): Promise<void>;
export declare function getAllCategories(): Promise<MobileCategory[]>;
export declare function getAllSubcategories(): Promise<MobileSubcategory[]>;
export declare function getSubcategoriesByCategory(categoryId: number): Promise<MobileSubcategory[]>;
export declare function replaceAllCategories(categories: MobileCategory[], subcategories: MobileSubcategory[]): Promise<void>;
export declare function getAllPendingTransactions(): Promise<PendingTransaction[]>;
export declare function getUnsyncedTransactions(): Promise<PendingTransaction[]>;
export declare function addPendingTransaction(tx: PendingTransaction): Promise<void>;
export declare function updatePendingTransaction(tx: PendingTransaction): Promise<void>;
export declare function deletePendingTransaction(id: string): Promise<void>;
export declare function markTransactionsSynced(ids: string[]): Promise<void>;
export declare function deleteSyncedTransactions(): Promise<void>;
export declare function getPendingCount(): Promise<number>;
export declare function getUnsyncedCount(): Promise<number>;
export {};
