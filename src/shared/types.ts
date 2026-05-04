// src/shared/types.ts

export type AccountType = 'cash' | 'checking' | 'savings' | 'investments';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  startingBalance: number;  // cents
  currentBalance: number;   // cents — computed, not stored
  isClosed: boolean;
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
  transactionType: 'standard' | 'transfer';
  transferAccountId: number | null;
  categoryId?: number | null;   // direct category (when no subcategory)
  subcategoryId: number | null;
  description: string;
  reconciled: boolean;
}

export interface TransactionDisplay extends Transaction {
  categoryName: string | null;
  subcategoryName: string | null;
  transferAccountName: string | null;
  runningBalance: number;   // cents
}

export interface TransactionListResult {
  transactions: TransactionDisplay[];
  total: number;
  balanceAtOffset: number;  // cents
}

export interface TransactionSearchResult {
  transactions: TransactionDisplay[];
  total: number;
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

export interface CloseAccountInput {
  id: number;
}

export interface TransactionListInput {
  accountId: number;
  offset: number;
  limit: number;
  includeReconciled?: boolean;
}

export interface TransactionSearchInput {
  searchText?: string;
  accountIds?: number[];
  dateFrom?: string;
  dateTo?: string;
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

export interface CreateTransferInput {
  fromAccountId: number;
  toAccountId: number;
  date: string;
  amount: number;
  description?: string;
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
  dateFrom?: string;
  dateTo?: string;
  offset: number;
  limit: number;
}

export type QifDateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY';

export type ImportFormat = 'qif' | 'csv';

export interface ImportPreviewTransaction {
  date: string;
  description: string;
  amount: number;
  categoryName: string | null;
  subcategoryName: string | null;
  reconciled: boolean;
  /** Source account name from the CSV Account column (CSV format only) */
  sourceAccount?: string;
}

export interface ImportPreviewInput {
  accountId: number;
  filePath: string;
  format: ImportFormat;
  dateFormat?: QifDateFormat;
}

export interface ImportPreviewResult {
  format: ImportFormat;
  transactions: ImportPreviewTransaction[];
  createdCategories: string[];
  /** Unique account names found in the CSV Account column (CSV format only) */
  sourceAccounts?: string[];
}

export interface ImportCommitInput {
  accountId: number;
  filePath: string;
  format: ImportFormat;
  dateFormat?: QifDateFormat;
  /** Filter to only import transactions from this source account (CSV format only) */
  sourceAccount?: string;
}

export interface ImportCommitResult {
  imported: number;
  createdCategories: string[];
}

export interface QifImportInput {
  accountId: number;
  filePath: string;
  dateFormat?: QifDateFormat;
}

export type QifImportResult = ImportCommitResult;

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
export type RecurringTransactionType = 'standard' | 'transfer';

export interface RecurringTransaction {
  id: number;
  accountId: number;
  accountName: string;
  transactionType: RecurringTransactionType;
  transferAccountId: number | null;
  transferAccountName: string | null;
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
  transactionType?: RecurringTransactionType;
  transferAccountId?: number;
  description: string;
  amount: number;
  subcategoryId?: number;
  frequency: RecurrenceFrequency;
  nextDate: string;
}

export interface UpdateRecurringInput {
  id: number;
  accountId?: number;
  transactionType?: RecurringTransactionType;
  transferAccountId?: number | null;
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

// Insights

export interface InsightsMonthInput {
  year: number;
  month: number;
}

export interface InsightsCategoryAmount {
  categoryId: number;
  categoryName: string;
  amount: number;
}

export interface InsightsMonth {
  year: number;
  month: number;
  totalEarned: number;
  totalSpent: number;
  balance: number;
  expenseCategories: InsightsCategoryAmount[];
  incomeCategories: InsightsCategoryAmount[];
}
