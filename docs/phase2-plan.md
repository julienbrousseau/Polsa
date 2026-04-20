# Phase 2 — Recurring Payments

> **Scope:** Recurring transaction setup, automatic application on launch, management screen.
> **Prerequisite:** Phase 1 complete (accounts, transactions, categories).
> Source requirements: [spec.md](../spec.md) § Recurring payments

---

## 1. Overview

Users can define recurring transactions that repeat on a schedule. When the app launches, any overdue recurring payments are automatically and silently applied as real transactions. A dedicated management screen lets users view upcoming payments, create new ones, edit amounts, or cancel them.

---

## 2. Database Schema

### Migration `002_recurring.sql`

```sql
CREATE TABLE recurring_transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    description     TEXT    NOT NULL DEFAULT '',
    amount          INTEGER NOT NULL,                -- cents, positive or negative
    subcategory_id  INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
    frequency       TEXT    NOT NULL CHECK (frequency IN ('daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
    next_date       TEXT    NOT NULL,                -- YYYY-MM-DD, the next date this should fire
    active          INTEGER NOT NULL DEFAULT 1,      -- 0 = cancelled, 1 = active
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_recurring_active_next ON recurring_transactions(active, next_date);
CREATE INDEX idx_recurring_account     ON recurring_transactions(account_id);
```

### Design notes

- **`next_date`** is the key scheduling field. After each application, it advances to the next occurrence based on `frequency`.
- **`active`** flag instead of deletion — preserves history. "Cancel" sets `active = 0`.
- **`ON DELETE CASCADE`** on `account_id` — deleting an account removes its recurring payments.
- **`ON DELETE SET NULL`** on `subcategory_id` — deleting a subcategory doesn't break recurring payments, they just become uncategorised.
- **No `end_date`** — recurring payments run indefinitely until cancelled. Can be added later if needed.

---

## 3. Automatic Application on Launch

This is the core behaviour: when the app starts, apply all overdue recurring transactions.

### Algorithm (`recurring-service.ts → applyOverdue()`)

```
1. SELECT all recurring_transactions WHERE active = 1 AND next_date <= today
2. For each overdue recurring transaction:
   a. While next_date <= today:
      - INSERT a transaction (account_id, next_date, amount, subcategory_id, description)
      - Advance next_date to the next occurrence
   b. UPDATE recurring_transactions SET next_date = <advanced date>
3. Return count of transactions created
```

### Date advancement logic

| Frequency | Advancement |
|-----------|-------------|
| `daily` | +1 day |
| `weekly` | +7 days |
| `fortnightly` | +14 days |
| `monthly` | +1 month (same day, clamped to month-end: e.g. Jan 31 → Feb 28) |
| `quarterly` | +3 months (same clamping) |
| `yearly` | +1 year (handles leap years: Feb 29 → Feb 28 in non-leap) |

### Key constraints

- **Wrap in a single DB transaction** — all inserts + next_date updates are atomic. If anything fails, nothing is applied.
- **Idempotent** — running `applyOverdue()` multiple times on the same day produces no duplicate transactions (because `next_date` is advanced past today on first run).
- **Silent** — no user interaction required. Applied before the UI renders. Optionally show a brief toast: "3 recurring payments applied".
- **Multiple overdue periods** — if the app hasn't been opened for weeks, all missed occurrences are created (e.g. a weekly payment with `next_date` 3 weeks ago produces 3 transactions).

### Integration point

In `src/main/index.ts`, after DB initialisation and migration, call:

```typescript
const applied = recurringService.applyOverdue();
// Optionally send count to renderer for a toast notification
```

---

## 4. Navigation & Screens

### Sidebar addition

Add a "Recurring" link in the sidebar, below Categories:

```
│  ACCOUNTS  │
│  ────────  │
│  > Current │
│    Savings │
│            │
│  ────────  │
│  Categories│
│  Recurring │    ← new
│            │
```

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Recurring list | `/recurring` | All recurring payments — active and cancelled |
| Recurring form | `/recurring/new`, `/recurring/:id/edit` | Create or edit a recurring payment |

### Recurring List Screen

```
┌─────────────────────────────────────────────────────────┐
│  Recurring Payments                         [+ New]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ACTIVE                                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Rent          Monthly    -£850.00   → Current      │ │
│  │ Next: 01/05/2026                        [Edit][✕]  │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Salary        Monthly    +£2,500.00 → Current      │ │
│  │ Next: 28/04/2026                        [Edit][✕]  │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Netflix       Monthly    -£15.99    → Current      │ │
│  │ Next: 15/05/2026                        [Edit][✕]  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  CANCELLED                                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Gym           Monthly    -£30.00    → Current      │ │
│  │ Cancelled                              [Reactivate]│ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Active section:** sorted by `next_date` ascending (soonest first). Shows description, frequency, amount (colour-coded), target account name, next date.
- **Cancelled section:** collapsed by default, expandable. Shows cancelled payments with a "Reactivate" option.
- **[✕] button:** cancels (sets `active = 0`), with confirmation.
- **[Edit] button:** opens the edit form.

### Recurring Form

Fields:
- **Description** (text, required)
- **Amount** (number, required, in display currency — converted to cents on save)
- **Account** (dropdown of existing accounts, required)
- **Category / Subcategory** (dropdown, optional)
- **Frequency** (dropdown: Daily, Weekly, Fortnightly, Monthly, Quarterly, Yearly)
- **Next date** (date picker, required, defaults to today)

---

## 5. IPC API

| Channel | Args | Returns | Notes |
|---------|------|---------|-------|
| `recurring:list` | — | `RecurringTransaction[]` | All (active + cancelled), with account name |
| `recurring:get` | `id` | `RecurringTransaction` | |
| `recurring:create` | `CreateRecurringInput` | `RecurringTransaction` | |
| `recurring:update` | `UpdateRecurringInput` | `RecurringTransaction` | Amount, description, frequency, next_date, subcategory |
| `recurring:cancel` | `id` | `void` | Sets `active = 0` |
| `recurring:reactivate` | `id` | `RecurringTransaction` | Sets `active = 1`, may need next_date adjustment |
| `recurring:delete` | `id` | `void` | Permanent delete (only for cancelled items) |
| `recurring:applyOverdue` | — | `{ applied: number }` | Called on startup, can also be triggered manually |

---

## 6. Shared Types

```typescript
// Additions to src/shared/types.ts

type RecurrenceFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

interface RecurringTransaction {
  id: number;
  accountId: number;
  accountName: string;          // joined from accounts table
  description: string;
  amount: number;               // cents
  subcategoryId: number | null;
  categoryName: string | null;  // joined
  subcategoryName: string | null; // joined
  frequency: RecurrenceFrequency;
  nextDate: string;             // YYYY-MM-DD
  active: boolean;
}

interface CreateRecurringInput {
  accountId: number;
  description: string;
  amount: number;               // cents
  subcategoryId?: number;
  frequency: RecurrenceFrequency;
  nextDate: string;             // YYYY-MM-DD
}

interface UpdateRecurringInput {
  id: number;
  description?: string;
  amount?: number;
  subcategoryId?: number | null;
  frequency?: RecurrenceFrequency;
  nextDate?: string;
}
```

---

## 7. New Files

```
src/
  main/
    migrations/
      002_recurring.sql          # New table
    ipc/
      recurring.ts               # IPC handlers
    services/
      recurring-service.ts       # Business logic + applyOverdue()
  renderer/
    pages/
      RecurringList.tsx           # Management screen
      RecurringForm.tsx           # Create/edit form
    components/
      RecurringCard.tsx           # Single recurring payment card
tests/
  unit/
    services/
      recurring-service.test.ts  # Core logic tests
  e2e/
    recurring.spec.ts            # E2E flow
```

---

## 8. Implementation Milestones

### M1 — Schema & Service
- Create `002_recurring.sql` migration
- Add shared types for recurring transactions
- Implement `recurring-service.ts`:
  - CRUD operations
  - `applyOverdue()` with date advancement logic
  - All wrapped in DB transactions
- Unit tests for date advancement (month clamping, leap years, multi-period catch-up)
- **Deliverable:** Service layer fully tested

### M2 — Startup Integration
- Call `applyOverdue()` in `src/main/index.ts` after DB init
- Wire IPC handlers in `recurring.ts`
- Update preload API
- Test: create a recurring with past `next_date`, restart app, verify transactions created
- **Deliverable:** Recurring payments auto-applied on launch

### M3 — Management UI
- Recurring list page with active/cancelled sections
- Create/edit form with all fields
- Cancel, reactivate, delete actions
- Add "Recurring" link to sidebar
- **Deliverable:** Full recurring payment management

### M4 — Polish
- Toast notification after auto-apply ("3 recurring payments applied")
- Validation: prevent `next_date` in the past for new recurring payments
- Handle edge case: account deleted while recurring exists (cascade handles it, but UI should reflect)
- E2E test: full lifecycle
- **Deliverable:** Phase 2 complete

---

## 9. Testing Strategy

### Unit tests

| Area | Key test cases |
|------|---------------|
| Date advancement | Monthly: Jan 31 → Feb 28; Mar 31 → Apr 30. Yearly: Feb 29 → Feb 28 in non-leap. Daily/weekly/fortnightly: straightforward addition |
| `applyOverdue()` | No overdue → 0 applied. One day late → 1 transaction. 3 weeks late on weekly → 3 transactions. Cancelled recurring → skipped. Already applied today → idempotent |
| Multi-recurring | Multiple recurring payments overdue simultaneously, all applied atomically |
| Reactivation | Reactivate cancelled → next_date stays as-is (user may need to adjust) |
| Edge cases | Amount = 0 (valid?), very old next_date (years of backlog), account with no transactions yet |

### E2E tests

| Flow | Scenario |
|------|----------|
| Create & trigger | Create recurring → close app → reopen → transaction appears in account |
| Cancel | Cancel recurring → reopen app → no new transactions |
| Edit | Change amount → reopen → new transaction uses updated amount |
| Multi-period catch-up | Set next_date 3 months ago with monthly frequency → reopen → 3 transactions created |

---

## 10. Interaction with Phase 1

- Transactions created by recurring payments are **normal transactions** — they appear in account detail, count toward balances, can be edited/deleted, and show in category views.
- The only new DB table is `recurring_transactions`. The `transactions` table is unchanged.
- Recurring-generated transactions have no special flag distinguishing them from manually entered ones. They're regular rows once inserted.
