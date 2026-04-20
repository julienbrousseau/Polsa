import { describe, it, expect } from 'vitest';
import {
  isValidAccountType,
  isValidISODate,
  isValidInteger,
  validateAccountName,
  validateCategoryName,
  validateTransactionAmount,
  validateTransactionDate,
} from '../../../src/shared/validation';

describe('isValidAccountType', () => {
  it('accepts valid types', () => {
    expect(isValidAccountType('cash')).toBe(true);
    expect(isValidAccountType('checking')).toBe(true);
    expect(isValidAccountType('savings')).toBe(true);
    expect(isValidAccountType('investments')).toBe(true);
  });

  it('rejects invalid types', () => {
    expect(isValidAccountType('credit')).toBe(false);
    expect(isValidAccountType('')).toBe(false);
  });
});

describe('isValidISODate', () => {
  it('accepts valid ISO dates', () => {
    expect(isValidISODate('2024-01-15')).toBe(true);
    expect(isValidISODate('2024-12-31')).toBe(true);
  });

  it('rejects invalid dates', () => {
    expect(isValidISODate('15/01/2024')).toBe(false);
    expect(isValidISODate('not-a-date')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });
});

describe('isValidInteger', () => {
  it('accepts integers', () => {
    expect(isValidInteger(0)).toBe(true);
    expect(isValidInteger(-100)).toBe(true);
    expect(isValidInteger(999999)).toBe(true);
  });

  it('rejects non-integers', () => {
    expect(isValidInteger(1.5)).toBe(false);
    expect(isValidInteger('100')).toBe(false);
    expect(isValidInteger(null)).toBe(false);
  });
});

describe('validateAccountName', () => {
  it('returns null for valid names', () => {
    expect(validateAccountName('Current')).toBeNull();
    expect(validateAccountName('My Savings')).toBeNull();
  });

  it('returns error for empty or missing', () => {
    expect(validateAccountName('')).toBeTruthy();
    expect(validateAccountName('  ')).toBeTruthy();
    expect(validateAccountName(null)).toBeTruthy();
  });

  it('returns error for names over 100 chars', () => {
    expect(validateAccountName('a'.repeat(101))).toBeTruthy();
  });
});

describe('validateCategoryName', () => {
  it('returns null for valid names', () => {
    expect(validateCategoryName('Food')).toBeNull();
  });

  it('returns error for empty', () => {
    expect(validateCategoryName('')).toBeTruthy();
  });
});

describe('validateTransactionAmount', () => {
  it('returns null for valid integer amounts', () => {
    expect(validateTransactionAmount(100)).toBeNull();
    expect(validateTransactionAmount(-500)).toBeNull();
    expect(validateTransactionAmount(0)).toBeNull();
  });

  it('returns error for floats', () => {
    expect(validateTransactionAmount(10.5)).toBeTruthy();
  });

  it('returns error for non-numbers', () => {
    expect(validateTransactionAmount('100')).toBeTruthy();
  });
});

describe('validateTransactionDate', () => {
  it('returns null for valid ISO dates', () => {
    expect(validateTransactionDate('2024-03-15')).toBeNull();
  });

  it('returns error for invalid dates', () => {
    expect(validateTransactionDate('15/03/2024')).toBeTruthy();
    expect(validateTransactionDate(123)).toBeTruthy();
  });
});
