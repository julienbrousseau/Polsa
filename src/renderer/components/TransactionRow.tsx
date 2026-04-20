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
      className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
    >
      <td className="whitespace-nowrap px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
        {formatDate(tx.date)}
      </td>
      <td className="px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
        {tx.description || <span className="italic text-[var(--color-text-secondary)]">—</span>}
      </td>
      <td className="px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
        {tx.categoryName && tx.subcategoryName
          ? `${tx.categoryName} › ${tx.subcategoryName}`
          : tx.categoryName || tx.subcategoryName || ''}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium ${
          tx.amount >= 0
            ? 'text-[var(--color-positive)]'
            : 'text-[var(--color-negative)]'
        }`}
      >
        {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2.5 text-right text-sm ${
          tx.runningBalance >= 0
            ? 'text-[var(--color-text-primary)]'
            : 'text-[var(--color-negative)]'
        }`}
      >
        {formatMoney(tx.runningBalance)}
      </td>
    </tr>
  );
}
