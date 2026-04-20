import { useState, useRef, useEffect, useCallback } from 'react';
import type { CategoryWithSubs } from '../lib/types';

export interface CategoryValue {
  categoryId: number | null;
  subcategoryId: number | null;
}

type Option =
  | { kind: 'category'; categoryId: number; label: string; searchKey: string }
  | { kind: 'subcategory'; categoryId: number; subcategoryId: number; label: string; searchKey: string };

interface Props {
  categories: CategoryWithSubs[];
  value: CategoryValue;
  onChange: (v: CategoryValue) => void;
  /** Extra keydown handler (e.g. to submit on Enter when no dropdown open) */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

function buildOptions(categories: CategoryWithSubs[]): Option[] {
  const opts: Option[] = [];
  for (const cat of categories) {
    // Parent category as a selectable option
    opts.push({
      kind: 'category',
      categoryId: cat.id,
      label: cat.name,
      searchKey: cat.name.toLowerCase(),
    });
    for (const sub of cat.subcategories) {
      opts.push({
        kind: 'subcategory',
        categoryId: cat.id,
        subcategoryId: sub.id,
        label: `${cat.name} › ${sub.name}`,
        searchKey: `${cat.name.toLowerCase()} ${sub.name.toLowerCase()}`,
      });
    }
  }
  return opts;
}

function labelForValue(options: Option[], value: CategoryValue): string {
  if (value.subcategoryId !== null) {
    return options.find((o) => o.kind === 'subcategory' && o.subcategoryId === value.subcategoryId)?.label ?? '';
  }
  if (value.categoryId !== null) {
    return options.find((o) => o.kind === 'category' && o.categoryId === value.categoryId)?.label ?? '';
  }
  return '';
}

const EMPTY: CategoryValue = { categoryId: null, subcategoryId: null };

export default function CategoryAutocomplete({
  categories,
  value,
  onChange,
  onKeyDown,
  placeholder = 'Category',
  className = '',
}: Props) {
  const options = buildOptions(categories);
  const [inputText, setInputText] = useState(() => labelForValue(options, value));
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = value.categoryId !== null || value.subcategoryId !== null;

  // Sync inputText when value changes from outside (e.g. on reset)
  useEffect(() => {
    setInputText(labelForValue(options, value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.categoryId, value.subcategoryId, categories]);

  const filtered = inputText
    ? options.filter((o) => {
        const q = inputText.toLowerCase();
        return o.searchKey.includes(q) || o.label.toLowerCase().includes(q);
      })
    : options;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setOpen(true);
    setHighlighted(0);
    if (hasValue) onChange(EMPTY);
  };

  const select = useCallback(
    (opt: Option) => {
      if (opt.kind === 'category') {
        onChange({ categoryId: opt.categoryId, subcategoryId: null });
      } else {
        onChange({ categoryId: null, subcategoryId: opt.subcategoryId });
      }
      setInputText(opt.label);
      setOpen(false);
    },
    [onChange],
  );

  const clear = () => {
    onChange(EMPTY);
    setInputText('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        select(filtered[highlighted]);
        return;
      }
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setInputText(labelForValue(options, value));
      return;
    }
    onKeyDown?.(e);
  };

  const handleFocus = () => {
    setOpen(true);
    setHighlighted(0);
    inputRef.current?.select();
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setOpen(false);
        // Try to match what was typed; if no match, clear
        const q = inputText.toLowerCase();
        const exact = options.find((o) => o.label.toLowerCase() === q);
        if (exact) {
          select(exact);
        } else if (!hasValue) {
          setInputText('');
        } else {
          // Revert to the committed value's label
          setInputText(labelForValue(options, value));
        }
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        className="input-cyber w-full rounded-lg px-2 py-1.5 text-xs"
      />
      {hasValue && (
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); clear(); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs leading-none"
          aria-label="Clear category"
        >
          ×
        </button>
      )}
      {open && filtered.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-surface)]/95 shadow-lg backdrop-blur-md"
          style={{ minWidth: '180px' }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.map((opt, idx) => (
            <li
              key={opt.kind === 'category' ? `cat-${opt.categoryId}` : `sub-${opt.subcategoryId}`}
              onMouseDown={() => select(opt)}
              className={`cursor-pointer px-3 py-1.5 text-xs transition-colors ${
                idx === highlighted
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent-light)]'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-accent)]/10'
              }`}
            >
              {opt.kind === 'category' ? (
                <span className="font-semibold">{opt.label}</span>
              ) : (
                <>
                  <span className="opacity-50 text-[10px]">{opt.label.split(' › ')[0]} ›</span>{' '}
                  {opt.label.split(' › ')[1]}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
