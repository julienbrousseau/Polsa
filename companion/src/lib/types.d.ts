export type AccountType = 'cash' | 'checking' | 'savings' | 'investments';
export interface MobileAccount {
    id: number;
    name: string;
    type: AccountType;
    currentBalance: number;
}
export interface MobileCategory {
    id: number;
    name: string;
}
export interface MobileSubcategory {
    id: number;
    categoryId: number;
    name: string;
}
export interface PendingTransaction {
    id: string;
    accountId: number;
    date: string;
    amount: number;
    subcategoryId: number | null;
    description: string;
    createdAt: string;
    synced: boolean;
}
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
export interface DesktopSyncPayload {
    version: 1;
    syncedIds: string[];
    accounts: {
        id: number;
        name: string;
        type: string;
        currentBalance: number;
    }[];
    categories: {
        id: number;
        name: string;
    }[];
    subcategories: {
        id: number;
        categoryId: number;
        name: string;
    }[];
}
