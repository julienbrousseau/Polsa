import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatMoney } from '../lib/format';
import type { Account } from '../lib/types';

declare global {
  interface Window {
    polsa: any;
  }
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const loadAccounts = async () => {
    try {
      const list = await window.polsa.accounts.list();
      setAccounts(list);
    } catch {
      // API not available yet (dev without electron)
      setAccounts([]);
    }
  };

  useEffect(() => {
    loadAccounts();

    // Re-fetch when navigating
    const interval = setInterval(loadAccounts, 2000);
    return () => clearInterval(interval);
  }, []);

  const isActiveAccount = (id: number) =>
    location.pathname === `/accounts/${id}`;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg-base)]">
      {/* Sidebar */}
      <aside className={`glass flex shrink-0 flex-col border-r border-[var(--color-border-glass)] transition-all duration-200 ${collapsed ? 'w-14' : 'w-60'}`}>
        {/* App title / drag region */}
        <div
          className="flex h-14 items-center justify-between px-3 font-semibold tracking-wide text-[var(--color-accent-light)]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {!collapsed && <span className="px-2">POLSA</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {collapsed
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              }
            </svg>
          </button>
        </div>

        {/* Accounts */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {!collapsed && (
            <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
              Accounts
            </div>
          )}

          {accounts.length === 0 && !collapsed ? (
            <div className="px-2 text-sm text-[var(--color-text-secondary)]">
              No accounts yet
            </div>
          ) : (
            <ul className="space-y-0.5">
              {accounts.map((account) => (
                <li key={account.id}>
                  <Link
                    to={`/accounts/${account.id}`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActiveAccount(account.id)
                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent-light)]'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]'
                    }`}
                    title={collapsed ? `${account.name}: ${formatMoney(account.currentBalance)}` : undefined}
                  >
                    {collapsed ? (
                      <span className="mx-auto text-xs font-medium">
                        {account.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <>
                        <span className="truncate">{account.name}</span>
                        <span
                          className={`ml-2 text-xs tabular-nums ${
                            account.currentBalance >= 0
                              ? 'text-[var(--color-positive)]'
                              : 'text-[var(--color-negative)]'
                          }`}
                        >
                          {formatMoney(account.currentBalance)}
                        </span>
                      </>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Separator */}
          <div className="my-3 border-t border-[var(--color-border-glass)]" />

          {/* Categories link */}
          <Link
            to="/categories"
            className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
              location.pathname.startsWith('/categories')
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent-light)]'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]'
            }`}
            title={collapsed ? 'Categories' : undefined}
          >
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            ) : (
              'Categories'
            )}
          </Link>

          {/* Separator */}
          <div className="my-3 border-t border-[var(--color-border-glass)]" />

          {/* New account button */}
          <button
            onClick={() => navigate('/accounts/new')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]"
            title={collapsed ? 'New account' : undefined}
          >
            <span className="text-lg leading-none">+</span>
            {!collapsed && <span>New account</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {children}
      </main>
    </div>
  );
}
