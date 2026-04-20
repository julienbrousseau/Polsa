// src/renderer/lib/format.ts

/**
 * Format cents as a currency display string (e.g. 12345 → "123.45")
 * Uses 2 decimal places, no currency symbol (user can mentally apply their own).
 */
export function formatMoney(cents: number): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const formatted = `${whole.toLocaleString('en-GB')}.${frac.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Convert ISO date (YYYY-MM-DD) to GB short format (dd/MM/yyyy)
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}
