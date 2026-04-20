// src/shared/validation.ts

import { ACCOUNT_TYPES } from './constants';
import type { AccountType } from './types';

export function isValidAccountType(value: string): value is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value);
}

export function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

export function isValidInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function validateAccountName(name: unknown): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return 'Account name is required';
  }
  if (name.trim().length > 100) {
    return 'Account name must be 100 characters or fewer';
  }
  return null;
}

export function validateCategoryName(name: unknown): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return 'Category name is required';
  }
  if (name.trim().length > 100) {
    return 'Category name must be 100 characters or fewer';
  }
  return null;
}

export function validateTransactionAmount(amount: unknown): string | null {
  if (!isValidInteger(amount)) {
    return 'Amount must be an integer (cents)';
  }
  return null;
}

export function validateTransactionDate(date: unknown): string | null {
  if (typeof date !== 'string' || !isValidISODate(date)) {
    return 'Date must be a valid ISO date (YYYY-MM-DD)';
  }
  return null;
}
