# Phase 1 — Implementation Plan

> **Scope:** Accounts, transactions, categories, QIF import/export.
> Source requirements: [spec.md](../spec.md)

---

## 1. Technical Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Shell | Electron (latest stable) | Desktop, local-only, full Node access |
| Renderer | React 18 + Vite | Fast HMR, modern tooling |
| Styling | Tailwind CSS | Rapid dark-theme development, utility-first |
| Database | SQLite via `better-sqlite3` | Synchronous, no native async overhead, no ORM |
| IPC | `contextBridge` + `preload.ts` | Secure bridge — renderer never touches Node directly |
| Testing | Vitest (unit) + Playwright (E2E) | Fast unit tests, Electron E2E support |
| Language | TypeScript throughout | Shared types across main/renderer |
| Packaging | `electron-builder` | Produces `.dmg` / `.app` for macOS, `.exe` / installer for Windows, `.AppImage` / `.deb` for Linux |

### Packaging & installation

The app is packaged via `electron-builder` into a native installer. On macOS this produces a `.dmg` containing `Polsa.app` — drag to Applications and launch like any other app. The SQLite database file is created automatically in the OS-standard user data directory (`~/Library/Application Support/Polsa/` on macOS).

```bash
npm run build          # Build renderer + main
npm run package        # Package into distributable
npm run package:mac    # macOS .dmg specifically
```

### Security baseline

- `nodeIntegration: false`, `contextIsolation: true` in `BrowserWindow`
- Preload script exposes a narrow typed API via `contextBridge`
- All SQL uses parameterised statements
- IPC handlers validate inputs before touching the DB

---

## 2. Project Structure

```
polsa/
├── electron-builder.yml        # Packaging config
├── package.json
├── tsconfig.json
├── vite.config.ts               # Renderer bundling
├── tailwind.config.ts
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry, window creation
│   │   ├── database.ts          # DB connection, migration runner
│   │   ├── migrations/          # Numbered SQL files
│   │   │   └── 001_initial.sql
│   │   ├── ipc/                 # IPC handler modules
│   │   │   ├── accounts.ts
│   │   │   ├── categories.ts
│   │   │   ├── transactions.ts
│   │   │   └── qif.ts
│   │   └── services/            # Business logic (testable without IPC)
│   │       ├── account-service.ts
│   │       ├── category-service.ts
│   │       ├── transaction-service.ts
│   │       └── qif-service.ts
│   ├── preload/
│   │   └── index.ts             # contextBridge exposing typed API
│   ├── renderer/                # React app
│   │   ├── index.html
│   │   ├── main.tsx             # React entry
│   │   ├── App.tsx              # Router + layout shell
│   │   ├── components/          # Shared UI components
│   │   │   ├── Layout.tsx       # Sidebar + main area shell
│   │   │   ├── TransactionRow.tsx
│   │   │   ├── InlineTransactionInput.tsx
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── InfiniteScroll.tsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── AccountList.tsx
│   │   │   ├── AccountDetail.tsx    # Transaction list + input
│   │   │   ├── AccountForm.tsx      # Create / edit account
│   │   │   ├── Categories.tsx       # Category management
│   │   │   └── CategoryDetail.tsx   # Transactions for a category
│   │   ├── hooks/               # React hooks (useTransactions, etc.)
│   │   └── lib/                 # Formatters, constants
│   │       ├── format.ts        # Money display, date display
│   │       └── types.ts         # Renderer-side type re-exports
│   └── shared/                  # Types & validation shared across processes
│       ├── types.ts
│       ├── validation.ts
│       └── constants.ts
└── tests/
    ├── unit/                    # Vitest unit tests
    │   ├── services/
    │   │   ├── account-service.test.ts
    │   │   ├── category-service.test.ts
    │   │   ├── transaction-service.test.ts
    │   │   └── qif-service.test.ts
    │   └── shared/
    │       ├── format.test.ts
    │       └── validation.test.ts
    └── e2e/                     # Playwright E2E tests
        ├── accounts.spec.ts
        ├── transactions.spec.ts
        ├── categories.spec.ts
        └── qif.spec.ts
```

---

## 3. Database Schema

All monetary values are **integers in cents/pence**. Dates are **ISO 8601 strings** (`YYYY-MM-DD`).

### Migration `001_initial.sql`

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    type            TEXT    NOT NULL CHECK (type IN ('cash', 'checking', 'savings', 'investments')),
    starting_balance INTEGER NOT NULL DEFAULT 0,   -- cents
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE
);

CREATE TABLE subcategories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    UNIQUE (category_id, name)
);

CREATE TABLE transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date            TEXT    NOT NULL,                -- YYYY-MM-DD
    amount          INTEGER NOT NULL,                -- cents, positive or negative
    subcategory_id  INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
    description     TEXT    NOT NULL DEFAULT '',
    reconciled      INTEGER NOT NULL DEFAULT 0,      -- 0 = no, 1 = yes (hidden in Phase 1 UI)
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transactions_account_date ON transactions(account_id, date DESC);
CREATE INDEX idx_transactions_subcategory  ON transactions(subcategory_id);
```

### Design notes

- **`ON DELETE CASCADE`** on `transactions.account_id`: deleting an account removes its transactions.
- **`ON DELETE SET NULL`** on `transactions.subcategory_id`: deleting a subcategory orphans transactions rather than deleting them. They remain visible as "uncategorised".
- **`ON DELETE CASCADE`** on `subcategories.category_id`: deleting a category removes its subcategories (and by the rule above, those transactions become uncategorised).
- `reconciled` column exists from day one but the UI ignores it until Phase 3.

---

## 4. Navigation & Screens

### Layout

```
┌──────────────────────────────────────────────────┐
│  POLSA                                    [gear] │
├────────────┬─────────────────────────────────────┤
│            │                                     │
│  ACCOUNTS  │         Main content area           │
│  ────────  │                                     │
│  > Current │   (AccountDetail, Categories, etc.) │
│    Savings │                                     │
│    Cash    │                                     │
│            │                                     │
│  ────────  │                                     │
│  Categories│                                     │
│            │                                     │
│  ────────  │                                     │
│  + New     │                                     │
│    account │                                     │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

- **Sidebar** (always visible): lists accounts by name with current balance, links to Categories page, and a "New account" action.
- **Main area**: renders the active page.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Account list | `/` | Default landing — redirects to first account, or shows an empty state with "Create your first account" |
| Account detail | `/accounts/:id` | Transaction list with infinite scroll, running balance, inline quick-add row, and button to open full transaction form |
| Account form | `/accounts/new`, `/accounts/:id/edit` | Create or edit account (name, type, starting balance) |
| Categories | `/categories` | Two-level list with create/rename/delete. Expandable categories showing subcategories |
| Category detail | `/categories/:id` | Recent transactions for a category or subcategory, infinite scroll |

---

## 5. Key Behaviours

### 5.1 Transaction List (Account Detail)

- Transactions ordered **newest first** (most recent at the top).
- Each row shows: **date** (dd/MM/yyyy) · **description** · **category > subcategory** · **amount** (formatted with sign, colour-coded: green positive, red negative) · **running balance**.
- **Running balance** is computed top-down: start from current balance at the top, subtract as you scroll down into history. The DB query returns transactions paginated; the balance for the first row of each page is computed by the backend as `starting_balance + SUM(all amounts) - SUM(amounts after this page)`.
- **Infinite scroll** loads pages of 50 transactions at a time.
- Clicking a transaction row opens it for inline editing or in the transaction form.

### 5.2 Transaction Input

Two modes of entry:

1. **Inline quick-add** — A always-visible row pinned at the top of the transaction list with fields: date (defaults to today), amount, category/subcategory dropdown (optional), description. Press Enter or Tab through to submit and immediately start a new entry. Optimised for rapid sequential input.

2. **Full form** — A modal/panel accessible via a "+" button. Same fields but with more space, validation feedback, and a date picker. Used for single careful entries or editing existing transactions.

**Category is optional.** Transactions can be saved without a category — they appear as "uncategorised" in the list and category views.

### 5.3 Category Management

- Left column: list of categories, each expandable to show subcategories.
- Inline rename (double-click or edit icon).
- Delete with confirmation — warns if transactions exist under that category.
- Right column: when a category or subcategory is selected, show its recent transactions (infinite scroll), pulled from all accounts.

### 5.4 QIF Import/Export

- **Import**: From account detail, "Import QIF" button → file picker → parse and preview transactions → confirm to insert.
  - Map QIF date format (`MM/DD/YYYY` or `DD/MM/YYYY` — allow user to pick) to ISO 8601.
  - Parse `L` field as `Category:Subcategory` — create categories/subcategories if they don't exist.
  - Duplicate detection: warn if transactions with same date + amount + description already exist.
- **Export**: From account detail, "Export QIF" button → choose date range (optional, default all) → save file.
  - Map account type to QIF type header (`!Type:Bank`, `!Type:Cash`, etc.).

### 5.5 Account Balance Computation

The **current balance** shown in the sidebar is:

```
current_balance = starting_balance + SUM(all transaction amounts)
```

This is computed via a single SQL query and cached/refreshed when transactions change:

```sql
SELECT a.starting_balance + COALESCE(SUM(t.amount), 0) AS current_balance
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
WHERE a.id = ?;
```

---

## 6. IPC API

All database access happens in the **main process**. The renderer calls these via the preload bridge.

| Channel | Args | Returns | Notes |
|---------|------|---------|-------|
| `accounts:list` | — | `Account[]` | With computed current balance |
| `accounts:get` | `id` | `Account` | |
| `accounts:create` | `{name, type, startingBalance}` | `Account` | Balance in cents |
| `accounts:update` | `{id, name, type, startingBalance}` | `Account` | |
| `accounts:delete` | `id` | `void` | Cascades transactions |
| `transactions:list` | `{accountId, offset, limit}` | `{transactions, total, balanceAtOffset}` | Paginated, with running balance anchor |
| `transactions:create` | `{accountId, date, amount, subcategoryId?, description}` | `Transaction` | |
| `transactions:update` | `{id, date, amount, subcategoryId?, description}` | `Transaction` | |
| `transactions:delete` | `id` | `void` | |
| `categories:list` | — | `CategoryWithSubs[]` | Categories with nested subcategories |
| `categories:create` | `{name}` | `Category` | |
| `categories:rename` | `{id, name}` | `Category` | |
| `categories:delete` | `id` | `void` | Cascades subcategories |
| `subcategories:create` | `{categoryId, name}` | `Subcategory` | |
| `subcategories:rename` | `{id, name}` | `Subcategory` | |
| `subcategories:delete` | `id` | `void` | Transactions become uncategorised |
| `categories:transactions` | `{categoryId?, subcategoryId?, offset, limit}` | `{transactions, total}` | Cross-account |
| `qif:import` | `{accountId, filePath, dateFormat}` | `{imported: number, created_categories: string[]}` | |
| `qif:export` | `{accountId, filePath, dateFrom?, dateTo?}` | `{exported: number}` | |

---

## 7. Shared Types

```typescript
// src/shared/types.ts

type AccountType = 'cash' | 'checking' | 'savings' | 'investments';

interface Account {
  id: number;
  name: string;
  type: AccountType;
  startingBalance: number;  // cents
  currentBalance: number;   // cents — computed, not stored
}

interface Category {
  id: number;
  name: string;
}

interface CategoryWithSubs extends Category {
  subcategories: Subcategory[];
}

interface Subcategory {
  id: number;
  categoryId: number;
  name: string;
}

interface Transaction {
  id: number;
  accountId: number;
  date: string;             // YYYY-MM-DD
  amount: number;           // cents
  subcategoryId: number | null;
  description: string;
  reconciled: boolean;
}

interface TransactionDisplay extends Transaction {
  categoryName: string | null;
  subcategoryName: string | null;
  runningBalance: number;   // cents
}
```

---

## 8. Implementation Milestones

Each milestone is a working increment. Tests are written alongside each milestone.

### M1 — Project Scaffolding
- Initialise Electron + Vite + React + TypeScript project
- Configure Tailwind with liquid glass theme (dark base, translucent surfaces, blur effects)
- Set up `better-sqlite3` connection with migration runner
- Create `001_initial.sql` migration
- Set up Vitest and Playwright configs
- Implement the sidebar + main area layout shell (empty states)
- **Deliverable:** App launches, shows empty dark UI, DB is created on first run

### M2 — Account Management
- Implement account CRUD (service → IPC → UI)
- Account list in sidebar with balances (initially just starting balance)
- Account create/edit form
- Account delete with confirmation
- **Deliverable:** Can create, edit, delete accounts. Accounts appear in sidebar

### M3 — Category Management
- Implement category and subcategory CRUD
- Categories page with two-level expandable list
- Inline rename, delete with confirmation
- **Deliverable:** Full category/subcategory management

### M4 — Transactions
- Transaction service with paginated queries
- Running balance computation
- Account detail page with infinite scroll
- Inline quick-add row (date, amount, category picker, description)
- Full transaction form (modal) for create/edit
- Transaction deletion
- Current balance in sidebar updates live
- **Deliverable:** Full transaction entry and browsing with running balances

### M5 — Category Transaction View
- Category detail page showing transactions across all accounts
- Infinite scroll for category/subcategory transactions
- **Deliverable:** Can browse transactions by category

### M6 — QIF Import/Export
- QIF parser (read) and serialiser (write) in `qif-service.ts`
- Import flow: file picker → preview → confirm
- Export flow: date range selection → file save dialog
- Category auto-creation on import
- Duplicate detection warnings
- **Deliverable:** Can import/export QIF files

### M7 — Polish & Testing
- Keyboard navigation for transaction entry (Tab to move between fields, Enter to submit)
- Responsive sidebar (collapsible on narrow windows)
- Loading states and error handling
- Full test pass: unit + E2E
- **Deliverable:** Phase 1 feature-complete and tested

---

## 9. Testing Strategy

### Unit tests (Vitest)

| Area | Key test cases |
|------|---------------|
| `transaction-service` | Running balance computation, pagination boundaries, empty account |
| `account-service` | Balance = starting + sum(transactions), delete cascades |
| `category-service` | Delete category → subcategories removed, transactions uncategorised |
| `qif-service` | Parse valid QIF, handle date formats, category extraction, malformed input |
| `format.ts` | Cents → display string, date ISO → dd/MM/yyyy, edge cases (0, negative, large amounts) |
| `validation.ts` | Account name required, amount is integer, date is valid ISO |

### E2E tests (Playwright)

| Flow | Scenario |
|------|----------|
| Account lifecycle | Create account → appears in sidebar → edit name → delete → gone |
| Transaction entry | Add via inline → appears in list → balance updates → edit → delete |
| Categories | Create category + subcategory → assign to transaction → delete category → transaction shows uncategorised |
| QIF round-trip | Export account → import into new account → transactions match |

---

## 10. Theme & Styling Notes

The UI follows a **liquid glass** aesthetic — modern, translucent, with depth and soft light:

- **Background:** deep dark base (`#0b0f1a`) with subtle gradient
- **Glass surfaces:** semi-transparent panels using `backdrop-filter: blur()` + `background: rgba(255, 255, 255, 0.04–0.08)`. Cards, sidebar, and modals feel like frosted glass floating over the background
- **Borders:** 1px `rgba(255, 255, 255, 0.08–0.12)` to define glass edges, no hard lines
- **Primary accent:** electric blue (`#3b82f6` / `#60a5fa`) for interactive elements and focus states
- **Text:** white (`#f1f5f9`) primary, muted blue-grey (`#94a3b8`) secondary
- **Positive amounts:** soft teal (`#34d399`)
- **Negative amounts:** soft red (`#f87171`)
- **Shadows:** layered `box-shadow` with blue-tinted dark shadows to create floating depth
- **Font:** Inter or system sans-serif — clean, modern, readable
- **Hover/focus:** subtle glow or increased opacity on glass surfaces
- **Scrollbars:** thin, translucent, matching the glass theme

Use Tailwind's `backdrop-blur`, `bg-white/5`, `border-white/10` utilities. For Electron, enable `vibrancy` or `backgroundMaterial` on `BrowserWindow` where supported to get native OS-level translucency.
