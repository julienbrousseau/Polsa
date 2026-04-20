// src/shared/types.ts

export type AccountType = 'cash' | 'checking' | 'savings' | 'investments';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  startingBalance: number;  // cents
  currentBalance: number;   // cents — computed, not stored
}

export interface Category {
  id: number;
  name: string;
}

export interface CategoryWithSubs extends Category {
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: number;
  categoryId: number;
  name: string;
}

export interface Transaction {
  id: number;
  accountId: number;
  date: string;             // YYYY-MM-DD
  amount: number;           // cents
  categoryId?: number | null;   // direct category (when no subcategory)
  subcategoryId: number | null;
  description: string;
  reconciled: boolean;
}

export interface TransactionDisplay extends Transaction {
  categoryName: string | null;
  subcategoryName: string | null;
  runningBalance: number;   // cents
}

export interface TransactionListResult {
  transactions: TransactionDisplay[];
  total: number;
  balanceAtOffset: number;  // cents
}

export interface CategoryTransactionListResult {
  transactions: TransactionDisplay[];
  total: number;
}

// IPC API types
export interface CreateAccountInput {
  name: string;
  type: AccountType;
  startingBalance: number;
}

export interface UpdateAccountInput {
  id: number;
  name: string;
  type: AccountType;
  startingBalance: number;
}

export interface TransactionListInput {
  accountId: number;
  offset: number;
  limit: number;
}

export interface CreateTransactionInput {
  accountId: number;
  date: string;
  amount: number;
  categoryId?: number | null;
  subcategoryId?: number | null;
  description: string;
}

export interface UpdateTransactionInput {
  id: number;
  date: string;
  amount: number;
  categoryId?: number | null;
  subcategoryId?: number | null;
  description: string;
}

export interface CategoryTransactionInput {
  categoryId?: number;
  subcategoryId?: number;
  offset: number;
  limit: number;
}

export type QifDateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY';

export interface QifImportInput {
  accountId: number;
  filePath: string;
  dateFormat: QifDateFormat;
}

export interface QifImportResult {
  imported: number;
  createdCategories: string[];
}

export interface QifExportInput {
  accountId: number;
  filePath: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface QifExportResult {
  exported: number;
}

// Recurring transactions

export type RecurrenceFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringTransaction {
  id: number;
  accountId: number;
  accountName: string;
  description: string;
  amount: number;
  subcategoryId: number | null;
  categoryName: string | null;
  subcategoryName: string | null;
  frequency: RecurrenceFrequency;
  nextDate: string;
  active: boolean;
}

export interface CreateRecurringInput {
  accountId: number;
  description: string;
  amount: number;
  subcategoryId?: number;
  frequency: RecurrenceFrequency;
  nextDate: string;
}

export interface UpdateRecurringInput {
  id: number;
  description?: string;
  amount?: number;
  subcategoryId?: number | null;
  frequency?: RecurrenceFrequency;
  nextDate?: string;
}

// Reconciliation

export interface ReconcileUnreconciledInput {
  accountId: number;
  offset: number;
  limit: number;
}

export interface ReconcileConfirmInput {
  transactionIds: number[];
}

export interface ReconcileBalanceResult {
  reconciledBalance: number;
}

export interface ReconcileConfirmResult {
  reconciled: number;
}

// Budgets

export interface BudgetOverviewInput {
  year: number;
  month: number;
}

export interface BudgetSubcategoryRow {
  subcategoryId: number;
  subcategoryName: string;
  allocated: number;
  rollover: number;
  spent: number;
  available: number;
}

export interface BudgetCategoryRow {
  categoryId: number;
  categoryName: string;
  allocated: number;
  rollover: number;
  spent: number;
  available: number;
  subcategories: BudgetSubcategoryRow[];
}

export interface BudgetOverview {
  year: number;
  month: number;
  totalAllocated: number;
  totalSpent: number;
  totalAvailable: number;
  categories: BudgetCategoryRow[];
}

export interface BudgetAllocation {
  subcategoryId: number | null;
  categoryId: number;
  categoryName: string;
  subcategoryName: string | null;
  amount: number;
}

export interface SetAllocationInput {
  categoryId: number;
  subcategoryId: number | null;
  year: number;
  month: number;
  amount: number;
  applyToFutureMonths?: boolean;
}

export interface SetAllocationsInput {
  year: number;
  month: number;
  allocations: Array<{
    categoryId: number;
    subcategoryId: number | null;
    amount: number;
  }>;
  applyToFutureMonths?: boolean;
}

export interface BudgetDefault {
  subcategoryId: number | null;
  categoryId: number;
  amount: number;
  effectiveFrom: string;
}
