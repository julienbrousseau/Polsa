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
      <aside className={`glass flex shrink-0 flex-col border-r border-[var(--color-border-glass)] transition-all duration-300 ${collapsed ? 'w-14' : 'w-64'}`}>
        {/* App title / drag region */}
        <div
          className="flex h-14 items-center justify-between px-3"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          {!collapsed && (
            <span className="px-2 text-sm font-bold tracking-[0.3em] uppercase neon-text-subtle text-[var(--color-accent-light)]">
              Polsa
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-accent)]/10 transition-all duration-200"
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
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Accounts
            </div>
          )}

          {accounts.length === 0 && !collapsed ? (
            <div className="px-2 text-sm text-[var(--color-text-muted)] italic">
              No accounts yet
            </div>
          ) : (
            <ul className="space-y-0.5">
              {accounts.map((account) => (
                <li key={account.id}>
                  <Link
                    to={`/accounts/${account.id}`}
                    className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
                      isActiveAccount(account.id)
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent-light)] neon-border'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent-light)]'
                    }`}
                    title={collapsed ? `${account.name}: ${formatMoney(account.currentBalance)}` : undefined}
                  >
                    {collapsed ? (
                      <span className={`mx-auto text-xs font-bold ${isActiveAccount(account.id) ? 'text-[var(--color-accent-light)] neon-text' : ''}`}>
                        {account.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <>
                        <span className="truncate font-medium">{account.name}</span>
                        <span
                          className={`ml-2 text-xs tabular-nums font-mono ${
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

          {/* Separator — neon line */}
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/20 to-transparent" />

          {/* Categories link */}
          <Link
            to="/categories"
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
              location.pathname.startsWith('/categories')
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent-light)] neon-border'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent-light)]'
            }`}
            title={collapsed ? 'Categories' : undefined}
          >
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="font-medium">Categories</span>
              </>
            )}
          </Link>

          {/* Separator — neon line */}
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/20 to-transparent" />

          {/* New account button */}
          <button
            onClick={() => navigate('/accounts/new')}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--color-text-muted)] transition-all duration-200 hover:bg-[var(--color-neon-pink)]/5 hover:text-[var(--color-neon-pink)]"
            title={collapsed ? 'New account' : undefined}
          >
            <span className="text-lg leading-none font-light">+</span>
            {!collapsed && <span className="font-medium">New account</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {children}
      </main>
    </div>
  );
}
