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

const ACCOUNT_TYPE_ORDER: string[] = ['cash', 'checking', 'savings', 'investments'];
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  cash: 'Cash', checking: 'Checking', savings: 'Savings', investments: 'Investments',
};
const ACCOUNT_TYPE_COLOR: Record<string, string> = {
  cash:        '#f472b6',
  checking:    '#22d3ee',
  savings:     '#818cf8',
  investments: '#4ade80',
};

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
          className="flex h-14 items-center justify-between pl-[74px] pr-3"
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

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {/* Dashboard home link */}
          <Link
            to="/"
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-all duration-200 mb-2 ${
              location.pathname === '/'
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent-light)] neon-border'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent-light)]'
            }`}
            title={collapsed ? 'Dashboard' : undefined}
          >
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="font-medium">Dashboard</span>
              </>
            )}
          </Link>

          {/* Accounts section */}
          {!collapsed && (
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Accounts
            </div>
          )}

          {accounts.length === 0 && !collapsed ? (
            <div className="px-2 text-sm text-[var(--color-text-muted)] italic">
              No accounts yet
            </div>
          ) : collapsed ? (
            /* Collapsed: flat sorted list with coloured initials */
            <ul className="space-y-0.5">
              {[...accounts]
                .sort((a, b) => ACCOUNT_TYPE_ORDER.indexOf(a.type) - ACCOUNT_TYPE_ORDER.indexOf(b.type))
                .map((account) => (
                  <li key={account.id}>
                    <Link
                      to={`/accounts/${account.id}`}
                      className={`flex items-center justify-center rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
                        isActiveAccount(account.id)
                          ? 'bg-[var(--color-accent)]/10 neon-border'
                          : 'hover:bg-[var(--color-accent)]/5'
                      }`}
                      title={`${account.name}: ${formatMoney(account.currentBalance)}`}
                    >
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: isActiveAccount(account.id)
                            ? 'var(--color-accent-light)'
                            : ACCOUNT_TYPE_COLOR[account.type],
                        }}
                      >
                        {account.name.charAt(0).toUpperCase()}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            /* Expanded: grouped by account type */
            <div className="space-y-3">
              {ACCOUNT_TYPE_ORDER.map(type => {
                const group = accounts.filter(a => a.type === type);
                if (group.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="flex items-center gap-1.5 px-2.5 mb-0.5">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: ACCOUNT_TYPE_COLOR[type],
                          boxShadow: `0 0 4px ${ACCOUNT_TYPE_COLOR[type]}`,
                        }}
                      />
                      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                        {ACCOUNT_TYPE_LABEL[type]}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {group.map(account => (
                        <li key={account.id}>
                          <Link
                            to={`/accounts/${account.id}`}
                            className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
                              isActiveAccount(account.id)
                                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent-light)] neon-border'
                                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent-light)]'
                            }`}
                          >
                            <span className="truncate font-medium">{account.name}</span>
                            <span
                              className={`ml-2 text-xs tabular-nums font-mono shrink-0 ${
                                account.currentBalance >= 0
                                  ? 'text-[var(--color-positive)]'
                                  : 'text-[var(--color-negative)]'
                              }`}
                            >
                              {formatMoney(account.currentBalance)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
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

          {/* Recurring link */}
          <Link
            to="/recurring"
            className={`mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
              location.pathname.startsWith('/recurring')
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent-light)] neon-border'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent-light)]'
            }`}
            title={collapsed ? 'Recurring' : undefined}
          >
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="font-medium">Recurring</span>
              </>
            )}
          </Link>

          {/* Reconcile link */}
          <Link
            to="/reconcile"
            className={`mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
              location.pathname === '/reconcile'
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent-light)] neon-border'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent-light)]'
            }`}
            title={collapsed ? 'Reconcile' : undefined}
          >
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Reconcile</span>
              </>
            )}
          </Link>

          {/* Budgets link */}
          <Link
            to="/budgets"
            className={`mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
              location.pathname.startsWith('/budgets')
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent-light)] neon-border'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent-light)]'
            }`}
            title={collapsed ? 'Budgets' : undefined}
          >
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="font-medium">Budgets</span>
              </>
            )}
          </Link>

          {/* Neon separator */}
          <div className="my-4 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/20 to-transparent" />

          {/* Mobile Sync link */}
          <Link
            to="/sync"
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-all duration-200 ${
              location.pathname === '/sync'
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent-light)] neon-border'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent-light)]'
            }`}
            title={collapsed ? 'Mobile Sync' : undefined}
          >
            {collapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Mobile Sync</span>
              </>
            )}
          </Link>

          {/* Separator — neon line */}
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
