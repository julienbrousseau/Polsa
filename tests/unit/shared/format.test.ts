import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, todayISO } from '../../../src/renderer/lib/format';

describe('formatMoney', () => {
  it('formats zero', () => {
    expect(formatMoney(0)).toBe('0.00');
  });

  it('formats positive cents', () => {
    expect(formatMoney(12345)).toBe('123.45');
  });

  it('formats negative cents', () => {
    expect(formatMoney(-12345)).toBe('-123.45');
  });

  it('formats single-digit cents', () => {
    expect(formatMoney(5)).toBe('0.05');
  });

  it('formats large amounts with thousands separator', () => {
    expect(formatMoney(1234567)).toBe('12,345.67');
  });

  it('formats exactly one pound', () => {
    expect(formatMoney(100)).toBe('1.00');
  });

  it('formats negative one cent', () => {
    expect(formatMoney(-1)).toBe('-0.01');
  });
});

describe('formatDate', () => {
  it('converts ISO to GB short format', () => {
    expect(formatDate('2024-03-15')).toBe('15/03/2024');
  });

  it('handles start of year', () => {
    expect(formatDate('2024-01-01')).toBe('01/01/2024');
  });

  it('handles end of year', () => {
    expect(formatDate('2024-12-31')).toBe('31/12/2024');
  });

  it('returns invalid input unchanged', () => {
    expect(formatDate('bad')).toBe('bad');
  });
});

describe('todayISO', () => {
  it('returns a valid ISO date string', () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
