# Phase 3 — Reconciliation

> **Scope:** Reconciliation workflow for matching account balances against bank statements.
> **Prerequisite:** Phase 1 (accounts, transactions) and Phase 2 (recurring payments) complete.
> Source requirements: [spec.md](../spec.md) § Reconciliation

---

## 1. Overview

Reconciliation lets users verify their Polsa account balances match their real bank statements. The user enters a target balance from their statement, then selects unreconciled transactions until the running reconciled balance matches. When it does, they confirm and those transactions are permanently marked as reconciled.

Critically, users often discover missing or incorrect transactions during reconciliation, so the screen must also support **adding and editing transactions inline** without leaving the reconciliation flow.

---

## 2. Database Schema

No new tables are needed — the `reconciled` column already exists on `transactions` from Phase 1's `001_initial.sql`:

```sql
reconciled INTEGER NOT NULL DEFAULT 0  -- 0 = no, 1 = yes
```

### Migration `003_reconciliation.sql`

An index to speed up reconciliation queries:

```sql
CREATE INDEX idx_transactions_account_reconciled 
    ON transactions(account_id, reconciled, date DESC);
```

### Design notes

- **No separate reconciliation history table.** The reconciliation state is stored directly on each transaction. This keeps things simple — a transaction is either reconciled or not.
- The index covers the key query pattern: "give me all unreconciled transactions for an account, sorted by date".
- Reconciliation is **irreversible by default** — once marked, transactions stay reconciled. An "undo last reconciliation" could be added later but is out of scope for Phase 3.

---

## 3. Reconciliation Concepts

| Term | Definition |
|------|-----------|
| **Reconciled balance** | `starting_balance + SUM(amount) WHERE reconciled = 1` — the sum of all transactions already confirmed against a bank statement |
| **Target balance** | The balance shown on the user's bank statement — entered manually |
| **Difference** | `target_balance - reconciled_balance` (updated live as transactions are selected) |
| **Working balance** | `reconciled_balance + SUM(selected but not yet confirmed)` — shown live during the process |

The goal: select unreconciled transactions until **working balance = target balance** (difference = 0).

---

## 4. Navigation & Screens

### Sidebar addition

Add a "Reconcile" link below Recurring:

```
│  ACCOUNTS  │
│  ────────  │
│  > Current │
│    Savings │
│            │
│  ────────  │
│  Categories│
│  Recurring │
│  Reconcile │    ← new
│            │
```

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Reconciliation | `/reconcile` | Account picker + reconciliation workflow |

### Reconciliation Screen Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Reconcile Account                                          │
│                                                             │
│  Account: [ Current Account  ▼]                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Reconciled balance:          £1,245.50             │    │
│  │  Target balance:              [£ 1,380.00    ]      │    │
│  │  ──────────────────────────────────────────         │    │
│  │  Difference:                  £134.50               │    │
│  │                                                     │    │
│  │  [Reconcile Selected]  (disabled until diff = 0)    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Unreconciled Transactions              [+ Add transaction] │
│  ┌───┬────────────┬──────────────────┬──────────┬─────────┐ │
│  │ ☐ │ 18/04/2026 │ Tesco groceries  │ -£45.20  │ [Edit]  │ │
│  │ ☑ │ 15/04/2026 │ Monthly salary   │+£2500.00 │ [Edit]  │ │
│  │ ☐ │ 14/04/2026 │ Amazon purchase  │ -£29.99  │ [Edit]  │ │
│  │ ☑ │ 12/04/2026 │ Electric bill    │ -£85.00  │ [Edit]  │ │
│  │ ☐ │ 10/04/2026 │ Cash withdrawal  │-£100.00  │ [Edit]  │ │
│  └───┴────────────┴──────────────────┴──────────┴─────────┘ │
│                                                             │
│  ☑ = selected for reconciliation                            │
│  Working balance: £1,380.00   Difference: £0.00  ✓          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Workflow

1. **Pick an account** from the dropdown.
2. **Reconciled balance** is computed and displayed automatically.
3. **Enter the target balance** from the bank statement.
4. **Difference** is calculated: `target - reconciled balance`.
5. **Unreconciled transactions** are listed below, sorted newest first, with checkboxes.
6. **Select transactions** — as each is ticked, the working balance updates and the difference recalculates in real time.
7. **When difference = 0**, the "Reconcile Selected" button becomes enabled.
8. **Click "Reconcile Selected"** — all selected transactions are marked `reconciled = 1`. The screen resets.

### Inline transaction management

Since users often find discrepancies during reconciliation:

- **[+ Add transaction]** button opens a transaction form (same as in Account Detail) pre-filled with the current account. The new transaction appears in the unreconciled list immediately.
- **[Edit] button** on each row opens an inline edit form or the standard transaction form modal. Changes to amount or date update the working balance in real time.
- **Delete** — transactions can be deleted from this screen (with confirmation). The list and balance update accordingly.

---

## 5. IPC API

| Channel | Args | Returns | Notes |
|---------|------|---------|-------|
| `reconcile:getBalance` | `accountId` | `{ reconciledBalance: number }` | `starting_balance + SUM(reconciled amounts)` in cents |
| `reconcile:getUnreconciled` | `{ accountId, offset, limit }` | `{ transactions: Transaction[], total: number }` | Paginated unreconciled transactions |
| `reconcile:confirm` | `{ transactionIds: number[] }` | `{ reconciled: number }` | Mark selected transactions as reconciled |

Existing IPC channels used during reconciliation (no changes needed):
- `transactions:create` — for adding missing transactions
- `transactions:update` — for correcting amounts/dates
- `transactions:delete` — for removing incorrect entries

---

## 6. Shared Types

```typescript
// Additions to src/shared/types.ts

interface ReconcileBalanceResult {
  reconciledBalance: number;    // cents
}

interface ReconcileUnreconciledInput {
  accountId: number;
  offset: number;
  limit: number;
}

interface ReconcileConfirmInput {
  transactionIds: number[];
}

interface ReconcileConfirmResult {
  reconciled: number;           // count of transactions marked
}
```

---

## 7. Service Layer

### `reconcile-service.ts`

```typescript
class ReconcileService {
  /** 
   * Compute the reconciled balance for an account:
   * starting_balance + SUM(amount WHERE reconciled = 1)
   */
  getReconciledBalance(accountId: number): number;

  /**
   * Get unreconciled transactions for an account, paginated.
   * Sorted by date DESC (newest first).
   */
  getUnreconciledTransactions(accountId: number, offset: number, limit: number): {
    transactions: Transaction[];
    total: number;
  };

  /**
   * Mark the given transactions as reconciled.
   * Validates all transaction IDs belong to the same account.
   * Wrapped in a single DB transaction.
   */
  confirmReconciliation(transactionIds: number[]): number;
}
```

### Key SQL queries

**Reconciled balance:**
```sql
SELECT a.starting_balance + COALESCE(SUM(t.amount), 0) AS reconciled_balance
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id AND t.reconciled = 1
WHERE a.id = ?;
```

**Unreconciled transactions (paginated):**
```sql
SELECT t.*, s.name AS subcategory_name, c.name AS category_name
FROM transactions t
LEFT JOIN subcategories s ON t.subcategory_id = s.id
LEFT JOIN categories c ON s.category_id = c.id
WHERE t.account_id = ? AND t.reconciled = 0
ORDER BY t.date DESC, t.id DESC
LIMIT ? OFFSET ?;
```

**Confirm reconciliation:**
```sql
UPDATE transactions SET reconciled = 1 WHERE id IN (?, ?, ?, ...);
```

---

## 8. New Files

```
src/
  main/
    migrations/
      003_reconciliation.sql       # Index for reconciliation queries
    ipc/
      reconcile.ts                 # IPC handlers
    services/
      reconcile-service.ts         # Business logic
  renderer/
    pages/
      Reconcile.tsx                # Reconciliation screen
    components/
      ReconcileHeader.tsx          # Balance summary panel
      ReconcileTransactionRow.tsx  # Row with checkbox + edit
tests/
  unit/
    services/
      reconcile-service.test.ts
  e2e/
    reconcile.spec.ts
```

---

## 9. Implementation Milestones

### M1 — Schema & Service
- Create `003_reconciliation.sql` migration (index only)
- Add shared types for reconciliation
- Implement `reconcile-service.ts`:
  - `getReconciledBalance()` query
  - `getUnreconciledTransactions()` paginated query
  - `confirmReconciliation()` batch update in a DB transaction
- Unit tests for balance computation and confirmation
- **Deliverable:** Service layer fully tested

### M2 — IPC & Basic UI
- Wire IPC handlers in `reconcile.ts`
- Update preload API
- Build the reconciliation page:
  - Account picker dropdown
  - Reconciled balance display
  - Target balance input
  - Difference calculation (live)
  - Unreconciled transaction list with checkboxes
  - "Reconcile Selected" button (disabled until diff = 0)
- **Deliverable:** Basic reconciliation workflow functional

### M3 — Inline Transaction Management
- Add transaction button on reconciliation screen (reuses existing transaction form)
- Edit button on each transaction row
- Delete with confirmation
- All actions update the unreconciled list and working balance in real time
- **Deliverable:** Can add/edit/delete transactions during reconciliation

### M4 — Polish & Testing
- Keyboard shortcuts: Space to toggle checkbox, Enter to confirm when ready
- Visual feedback: green highlight when difference = 0
- Handle edge cases: no unreconciled transactions, account with no transactions
- Confirmation dialog before reconciliation ("You are about to reconcile N transactions. This cannot be undone.")
- E2E test: full reconciliation flow
- **Deliverable:** Phase 3 complete

---

## 10. Testing Strategy

### Unit tests

| Area | Key test cases |
|------|---------------|
| Reconciled balance | No reconciled transactions → equals starting_balance. Mix of reconciled/unreconciled → correct sum. All reconciled → equals current_balance |
| Unreconciled list | Returns only unreconciled, respects pagination, sorted by date desc |
| Confirm | Marks correct transactions, doesn't affect others. Validates IDs exist. Rejects empty array. All-or-nothing (DB transaction) |
| Edge cases | Account with 0 transactions, all transactions already reconciled, reconciling a single transaction |

### E2E tests

| Flow | Scenario |
|------|----------|
| Full reconciliation | Pick account → enter target → select transactions → difference hits 0 → confirm → transactions now reconciled |
| Partial reconciliation | Select some transactions, difference ≠ 0, button stays disabled |
| Add during reconciliation | Click add → enter new transaction → appears in unreconciled list → select it → reconcile |
| Edit during reconciliation | Edit an amount → difference updates → re-select → reconcile |

---

## 11. Performance Considerations

Reconciliation creates a natural performance boundary:

- **Reconciled transactions are "settled"** — they never change. Future phases can leverage this:
  - Cache reconciled balance per account (updated only on reconciliation)
  - Skip reconciled transactions when computing running balances for display (start from reconciled balance, then apply only unreconciled transactions)
  - Potentially archive reconciled transactions to a separate table for very old data

- For Phase 3, the simple approach (query each time) is sufficient. Optimisation deferred to when/if performance data demands it.

---

## 12. Interaction with Earlier Phases

- **Phase 1:** The `reconciled` column is already in the schema. The account detail page already displays transactions — after Phase 3, transactions marked as reconciled could optionally show a small "✓" indicator in the transaction list, but this is cosmetic and optional.
- **Phase 2:** Transactions created by recurring payments start as `reconciled = 0` like any other transaction. They appear in the reconciliation screen and can be reconciled normally.
