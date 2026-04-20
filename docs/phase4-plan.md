# Phase 4 — Budgets

> **Scope:** Monthly budget envelopes per category/subcategory, with intra-year rollover.
> **Prerequisite:** Phases 1–3 complete (accounts, transactions, categories, reconciliation).
> Source requirements: [spec.md](../spec.md) § Budgets

---

## 1. Overview

Users allocate a monthly budget amount to each category or subcategory using an **envelope model**. Each month, the unspent (or overspent) amount rolls forward into the next month within the same calendar year. Rollovers reset at the start of each new year.

Monthly allocations default to the previous month's values but can be overridden — with the choice of updating just that month or all subsequent months too.

---

## 2. Core Concepts

### Envelope model

Each budget envelope tracks:

| Field | Description |
|-------|-------------|
| **Allocated** | The amount budgeted for this month (set by the user) |
| **Spent** | Sum of negative transaction amounts in this category/subcategory for this month |
| **Remaining** | `allocated - spent` (can be negative if overspent) |
| **Rollover** | Carried from the previous month's remaining (positive = surplus, negative = deficit) |
| **Available** | `allocated + rollover - spent` — the true amount left to spend |

### Rollover rules

- **Within a year:** each month's rollover = previous month's `remaining` (i.e. `allocated + rollover - spent`)
- **Year boundary:** rollover resets to 0 on January. Each year starts fresh.
- **Cascade:** changing a past month's allocation retroactively affects all subsequent months' rollovers in that year.

### Allocation defaults

- When a new month begins and no allocation has been set, it **inherits the most recent explicitly set allocation** for that category/subcategory.
- When the user changes an allocation, they are prompted: "Update just this month, or this month and all future months?" If "all future", the new value becomes the default going forward.

---

## 3. Database Schema

### Migration `004_budgets.sql`

```sql
-- Monthly budget allocation per subcategory (or category-level if subcategory_id is NULL)
CREATE TABLE budget_allocations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    subcategory_id  INTEGER REFERENCES subcategories(id) ON DELETE CASCADE,
    category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount          INTEGER NOT NULL DEFAULT 0,    -- cents, monthly allocation
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (subcategory_id, year, month),
    UNIQUE (category_id, year, month, subcategory_id)
);

-- The "template" allocation: what new months default to
-- Updated when user chooses "all future months"
CREATE TABLE budget_defaults (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    subcategory_id  INTEGER REFERENCES subcategories(id) ON DELETE CASCADE,
    category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL DEFAULT 0,    -- cents
    effective_from  TEXT    NOT NULL,               -- YYYY-MM, the month this default starts applying
    UNIQUE (subcategory_id, effective_from),
    UNIQUE (category_id, effective_from, subcategory_id)
);

CREATE INDEX idx_budget_alloc_period ON budget_allocations(year, month);
CREATE INDEX idx_budget_alloc_subcat ON budget_allocations(subcategory_id);
CREATE INDEX idx_budget_defaults_subcat ON budget_defaults(subcategory_id);
```

### Design notes

- **`budget_allocations`** stores explicit per-month overrides. If no row exists for a given month, the system falls back to `budget_defaults`.
- **`budget_defaults`** captures the user's "all future months" choice. Multiple rows per subcategory allow the default to change over time (e.g. "from March onwards, allocate £200 instead of £150").
- **Category-level budgets:** when `subcategory_id IS NULL`, the budget applies to the entire category. The `category_id` is always set for grouping and cascade deletion.
- **`ON DELETE CASCADE`** on both tables — deleting a category or subcategory removes its budget data.
- No rollover is stored — it's **computed** from previous months' allocations and actual spending. This avoids stale data and keeps the schema simple.

### Why compute rollover instead of storing it?

Storing rollover would create a cascade problem: editing a past allocation or re-categorising a transaction would require updating every subsequent month. Computing on-the-fly from allocations + transaction sums for 12 months is fast enough — it's at most 12 aggregation queries per category per year.

---

## 4. Navigation & Screens

### Sidebar addition

```
│  ACCOUNTS  │
│  ────────  │
│  > Current │
│    Savings │
│            │
│  ────────  │
│  Categories│
│  Recurring │
│  Reconcile │
│  Budgets   │    ← new
│            │
```

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Budget overview | `/budgets` | Monthly budget dashboard |
| Budget setup | `/budgets/setup` | Allocate amounts per category/subcategory |

### Budget Overview Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Budgets                            [◀ Mar 2026] April 2026 [▶]│
│                                                                 │
│  Total allocated: £2,350.00    Total spent: £1,840.00           │
│  Total available: £510.00                     [Setup Budgets]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Housing                                                │    │
│  │  Allocated: £1,000  Rollover: +£50  Spent: £950         │    │
│  │  Available: £100.00                                     │    │
│  │  ████████████████████████████████████████░░░░  95%      │    │
│  │                                                         │    │
│  │    ├─ Rent           £850 / £850     ████████████ 100%  │    │
│  │    └─ Utilities      £100 / £150     ██████░░░░░  67%   │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Food & Drink                                           │    │
│  │  Allocated: £500   Rollover: -£30   Spent: £420         │    │
│  │  Available: £50.00                                      │    │
│  │  █████████████████████████████████░░░░░░░  84%          │    │
│  │                                                         │    │
│  │    ├─ Groceries      £350 / £400     ████████░░░  88%   │    │
│  │    └─ Eating out      £70 / £100     ███████░░░░  70%   │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  Uncategorised                                          │    │
│  │  No budget set — £120.00 spent                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **Month navigation** arrows to move between months (within the current year and recent history).
- **Summary bar** at the top: total allocated, total spent, total available.
- **Category cards** showing each budgeted category with:
  - Allocated amount, rollover from previous month, spent this month
  - Available = allocated + rollover - spent
  - Progress bar (colour shifts: green → amber → red as spending increases)
  - Expandable subcategory breakdown
- **Uncategorised section** at the bottom: spending on transactions without a budget (informational, not editable here).
- Categories/subcategories with no budget set and no spending are hidden.

### Budget Setup Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Budget Setup                       April 2026         [Save]  │
│                                                                 │
│  ┌────────────────────────────────┬───────────┐                 │
│  │ Category / Subcategory         │ Allocated │                 │
│  ├────────────────────────────────┼───────────┤                 │
│  │ ▼ Housing                      │           │                 │
│  │     Rent                       │ [£850.00] │                 │
│  │     Utilities                  │ [£150.00] │                 │
│  │ ▼ Food & Drink                 │           │                 │
│  │     Groceries                  │ [£400.00] │                 │
│  │     Eating out                 │ [£100.00] │                 │
│  │ ▼ Transport                    │           │                 │
│  │     Fuel                       │ [£200.00] │                 │
│  │     Parking                    │ [  £0.00] │                 │
│  └────────────────────────────────┴───────────┘                 │
│                                                                 │
│  Categories without budgets:                                    │
│  [+ Add budget for "Entertainment"]                             │
│  [+ Add budget for "Shopping"]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Editable allocation amounts per subcategory.
- On save, if any value changed, prompt: **"Update just April, or April and all future months?"**
- Unbudgeted categories listed at the bottom with an "Add budget" action.
- Category-level rows are read-only summaries (sum of subcategory allocations). Budgets are set at the subcategory level.

---

## 5. Spending Computation

Spending for a given category/subcategory in a month is computed from transactions:

```sql
-- Net spending for a subcategory in a given month
-- Negative amounts = spending, positive amounts = refunds (reduce spending)
SELECT COALESCE(SUM(ABS(t.amount)), 0) AS spent
FROM transactions t
WHERE t.subcategory_id = ?
  AND t.date >= ? -- first day of month (YYYY-MM-01)
  AND t.date < ?  -- first day of next month;
```

**Net spending** includes all transactions in the category — both debits and credits. A refund (positive amount) in a budgeted category reduces spending for that month. For example, £400 of groceries minus a £20 refund = £380 net spent against the Groceries budget.

### Rollover computation

For a given subcategory in month M of year Y:

```
if M == 1 (January):
    rollover = 0
else:
    prev_allocated = getAllocation(subcategory, Y, M-1)
    prev_rollover  = getRollover(subcategory, Y, M-1)   -- recursive
    prev_spent     = getSpent(subcategory, Y, M-1)
    rollover       = prev_allocated + prev_rollover - prev_spent
```

This is recursive but bounded (max 11 steps back to January). Cache intermediate results for performance.

---

## 6. IPC API

| Channel | Args | Returns | Notes |
|---------|------|---------|-------|
| `budgets:overview` | `{ year, month }` | `BudgetOverview` | Full month summary with all categories |
| `budgets:getAllocations` | `{ year, month }` | `BudgetAllocation[]` | All allocations for setup screen |
| `budgets:setAllocation` | `SetAllocationInput` | `void` | Set allocation for one subcategory |
| `budgets:setAllocations` | `SetAllocationsInput` | `void` | Batch update (setup screen save) |
| `budgets:getDefaults` | — | `BudgetDefault[]` | Current default allocations |

---

## 7. Shared Types

```typescript
// Additions to src/shared/types.ts

interface BudgetOverview {
  year: number;
  month: number;
  totalAllocated: number;       // cents
  totalSpent: number;           // cents
  totalAvailable: number;       // cents
  categories: BudgetCategoryRow[];
}

interface BudgetCategoryRow {
  categoryId: number;
  categoryName: string;
  allocated: number;            // cents — sum of subcategory allocations
  rollover: number;             // cents
  spent: number;                // cents
  available: number;            // cents
  subcategories: BudgetSubcategoryRow[];
}

interface BudgetSubcategoryRow {
  subcategoryId: number;
  subcategoryName: string;
  allocated: number;            // cents
  rollover: number;             // cents
  spent: number;                // cents
  available: number;            // cents
}

interface BudgetAllocation {
  subcategoryId: number;
  categoryId: number;
  categoryName: string;
  subcategoryName: string;
  amount: number;               // cents
}

interface SetAllocationInput {
  subcategoryId: number;
  categoryId: number;
  year: number;
  month: number;
  amount: number;               // cents
  applyToFutureMonths: boolean; // if true, also updates budget_defaults
}

interface SetAllocationsInput {
  year: number;
  month: number;
  allocations: {
    subcategoryId: number;
    categoryId: number;
    amount: number;
  }[];
  applyToFutureMonths: boolean;
}

interface BudgetDefault {
  subcategoryId: number;
  categoryId: number;
  amount: number;               // cents
  effectiveFrom: string;        // YYYY-MM
}
```

---

## 8. Service Layer

### `budget-service.ts`

```typescript
class BudgetService {
  /**
   * Get the allocation for a subcategory in a given month.
   * Falls back to budget_defaults if no explicit allocation exists.
   * Returns 0 if nothing is configured.
   */
  getAllocation(subcategoryId: number, year: number, month: number): number;

  /**
   * Compute rollover for a subcategory in a given month.
   * Recursive within the year, 0 for January.
   */
  getRollover(subcategoryId: number, year: number, month: number): number;

  /**
   * Get total spending (sum of negative amounts) for a subcategory in a month.
   */
  getSpent(subcategoryId: number, year: number, month: number): number;

  /**
   * Build the full budget overview for a month.
   * Aggregates allocations, spending, and rollovers for all budgeted categories.
   */
  getOverview(year: number, month: number): BudgetOverview;

  /**
   * Set allocation for a subcategory in a specific month.
   * If applyToFutureMonths, also inserts/updates budget_defaults.
   */
  setAllocation(input: SetAllocationInput): void;

  /**
   * Batch-set allocations (setup screen save).
   * Wrapped in a single DB transaction.
   */
  setAllocations(input: SetAllocationsInput): void;
}
```

---

## 9. New Files

```
src/
  main/
    migrations/
      004_budgets.sql              # New tables
    ipc/
      budgets.ts                   # IPC handlers
    services/
      budget-service.ts            # Business logic, rollover computation
  renderer/
    pages/
      BudgetOverview.tsx           # Monthly dashboard
      BudgetSetup.tsx              # Allocation editor
    components/
      BudgetCategoryCard.tsx       # Category envelope card with progress bar
      BudgetProgressBar.tsx        # Colour-shifting progress bar
      AllocationInput.tsx          # Editable allocation field
tests/
  unit/
    services/
      budget-service.test.ts
  e2e/
    budgets.spec.ts
```

---

## 10. Implementation Milestones

### M1 — Schema & Core Service
- Create `004_budgets.sql` migration
- Add shared types
- Implement `budget-service.ts`:
  - Allocation get/set with fallback to defaults
  - Spending computation from transactions
  - Rollover computation (recursive within year, cached)
- Unit tests for rollover: basic flow, year boundary reset, overspend rollover, multi-month cascade
- **Deliverable:** Service layer fully tested

### M2 — IPC & Budget Overview
- Wire IPC handlers
- Update preload API
- Build the budget overview page:
  - Month navigation
  - Summary totals
  - Category cards with progress bars
  - Expandable subcategory breakdown
- **Deliverable:** Can view budget status for any month

### M3 — Budget Setup
- Budget setup page with editable allocation table
- "Update just this month / all future months" prompt on save
- Add budget for unbudgeted categories
- **Deliverable:** Can configure and modify budget allocations

### M4 — Polish & Testing
- Progress bar colour transitions (green → amber → red)
- Handle edge cases: category deleted mid-year, subcategory moved between categories
- Empty states: no budgets configured yet
- E2E test: full budget lifecycle
- **Deliverable:** Phase 4 complete

---

## 11. Testing Strategy

### Unit tests

| Area | Key test cases |
|------|---------------|
| Allocation fallback | Explicit allocation exists → use it. No explicit → fall back to default. No default → 0 |
| Rollover | Jan → always 0. Feb with £100 allocated, £80 spent in Jan → rollover = £20. Overspend: £100 allocated, £120 spent → rollover = -£20. Chain: multiple months accumulate correctly |
| Year boundary | Dec surplus does NOT roll into next Jan. Jan always starts clean |
| Spending | Net of refunds: £400 spent - £20 refund = £380. Empty month → 0. Positive-only month (all refunds) → negative spending (adds to available) |
| Defaults | "All future months" updates default. New month inherits latest default. Multiple defaults: correct one selected by effective_from |
| Edge cases | Budget set for subcategory that has no transactions. Category deleted → budget data cascades. Amount = 0 is valid (explicitly no budget) |

### E2E tests

| Flow | Scenario |
|------|----------|
| Setup & view | Set budgets → navigate to overview → values match |
| Spending tracking | Add transactions → overview shows spending against budget |
| Rollover | Underspend in month 1 → month 2 shows positive rollover |
| Month change | Change allocation for "this month only" → next month still uses old value |
| Future months | Change allocation for "all future" → next month uses new value |

---

## 12. Interaction with Earlier Phases

- **Phase 1 (Categories):** Budgets attach to existing categories/subcategories. If a category or subcategory is deleted, its budget data is cascade-deleted.
- **Phase 1 (Transactions):** Spending is derived from transaction amounts. Re-categorising a transaction affects the budget for both the old and new category in that month.
- **Phase 2 (Recurring):** Recurring transactions contribute to spending like any other transaction — no special handling.
- **Phase 3 (Reconciliation):** Reconciled status is irrelevant to budgets. Both reconciled and unreconciled transactions count toward spending.
