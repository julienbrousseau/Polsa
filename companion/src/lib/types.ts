// Types used by the companion app — subset of desktop shared types

export type AccountType = 'cash' | 'checking' | 'savings' | 'investments';

export interface MobileAccount {
  id: number;
  name: string;
  type: AccountType;
  currentBalance: number; // cents, 0 when received from setup payload
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
  id: string;           // UUID generated on mobile
  accountId: number;
  date: string;         // YYYY-MM-DD
  amount: number;       // cents
  subcategoryId: number | null;
  description: string;
  createdAt: string;    // ISO timestamp
  synced: boolean;
}

// Sync payloads

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

/** Slim payload sent by desktop "Send to Mobile" — no balances, no syncedIds */
export interface DesktopSetupPayload {
  version: 1;
  accounts: { id: number; name: string; type: string }[];
  categories: { id: number; name: string }[];
  subcategories: { id: number; categoryId: number; name: string }[];
}

/** Full payload returned after a POST /sync (transaction import) */
export interface DesktopSyncPayload {
  version: 1;
  syncedIds: string[];
  accounts: { id: number; name: string; type: string; currentBalance: number }[];
  categories: { id: number; name: string }[];
  subcategories: { id: number; categoryId: number; name: string }[];
}
