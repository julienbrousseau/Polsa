// Shared formatting utilities — same logic as desktop

export function formatMoney(cents: number): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const formatted = `${whole.toLocaleString('en-GB')}.${frac.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}
