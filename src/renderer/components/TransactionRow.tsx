import { formatMoney, formatDate } from '../lib/format';
import type { TransactionDisplay } from '../lib/types';

interface Props {
  transaction: TransactionDisplay;
  onEdit: (tx: TransactionDisplay) => void;
}

export default function TransactionRow({ transaction: tx, onEdit }: Props) {
  return (
    <tr
      onClick={() => onEdit(tx)}
      className="cursor-pointer border-b border-[var(--color-border-glass)] transition-all duration-200 hover:bg-[var(--color-accent)]/5"
    >
      <td className="px-3 py-2 text-center" title={tx.reconciled ? 'Reconciled' : undefined}>
        {tx.reconciled && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-positive)] opacity-70" />
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs font-mono text-[var(--color-text-muted)]">
        {formatDate(tx.date)}
      </td>
      <td className="px-3 py-2 text-xs text-[var(--color-text-primary)]">
        {tx.description || <span className="italic text-[var(--color-text-muted)]">—</span>}
      </td>
      <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
        {tx.categoryName && tx.subcategoryName
          ? <>{tx.categoryName} <span className="text-[var(--color-accent)]/40">›</span> {tx.subcategoryName}</>
          : tx.categoryName || tx.subcategoryName || ''}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2 text-right text-xs font-mono font-medium ${
          tx.amount >= 0
            ? 'text-[var(--color-positive)]'
            : 'text-[var(--color-negative)]'
        }`}
      >
        {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2 text-right text-xs font-mono ${
          tx.runningBalance >= 0
            ? 'text-[var(--color-text-secondary)]'
            : 'text-[var(--color-negative)]'
        }`}
      >
        {formatMoney(tx.runningBalance)}
      </td>
    </tr>
  );
}
