# Polsa — Agent Instructions

Personal finance desktop app. See [spec.md](spec.md) for full requirements.

## Architecture

- **Electron** desktop app (main + renderer processes)
- **No authentication** — single-user, local-only
- **Local storage** — SQLite via `better-sqlite3` (synchronous, no ORM overhead)
- **UI** — liquid glass theme (dark base, translucent surfaces, blur/frosted-glass effects, blue accents)

### Key directories (planned)

```
src/
  main/          # Electron main process, DB access, IPC handlers
  renderer/      # UI (React or similar), pages, components
  shared/        # Types, constants, validation shared across processes
  __tests__/     # Tests mirror src/ structure
```

## Development phases

The project follows phased delivery — see spec.md § Development phases. Only implement features belonging to the current phase unless told otherwise.

## Monetary values

**Always store and compute money as integers (cents/pence).** Never use floating-point for currency. Convert to decimal only for display. Two-decimal precision throughout.

## Dates

- Store as ISO 8601 (`YYYY-MM-DD`)
- Display in GB short format: `dd/MM/yyyy`

## Categories

Two-level hierarchy: category → subcategory. Both free-text. Every transaction has exactly one subcategory (which implies its parent category).

## Database conventions

- Use SQLite migrations (numbered: `001_initial.sql`, `002_recurring.sql`, …)
- Indexes on `transactions(account_id, date)` and `transactions(subcategory_id)`
- Foreign keys enabled (`PRAGMA foreign_keys = ON`)
- Use `INTEGER` for monetary amounts (cents)

## Testing

- Unit tests with **Vitest** (or Jest). Run: `npm test`
- E2E tests with **Playwright** for Electron. Run: `npm run test:e2e`
- Always run `npm test` before committing
- Test monetary calculations with edge cases (rounding, negative amounts, zero)

## Code review checklist

When reviewing changes, verify:
1. Money is never stored/computed as float
2. SQL migrations are additive (no destructive changes to existing migrations)
3. All DB queries use parameterised statements (no string interpolation)
4. IPC handlers validate input on the main-process side
5. New features include tests
6. Performance: transaction queries are paginated, not loaded all at once

## Build & run

```bash
npm install
npm run dev        # Start Electron in dev mode
npm run build      # Package for distribution
npm test           # Run unit tests
npm run test:e2e   # Run E2E tests
```

## Git workflow

- Create a feature branch before making changes (`feat/…`, `fix/…`)
- Never commit directly to `main`
- Verb-prefix commit messages: `Add …`, `Fix …`, `Refactor …`
- Run tests before merging

## QIF import/export

QIF is a plain-text format for financial data interchange. When implementing (Phase 1), handle:
- Account type mapping (cash/checking/savings/investments)
- Date format differences (QIF uses `MM/DD/YYYY`)
- Category parsing from the `L` field (supports `Category:Subcategory`)

## Performance

- Transactions use infinite-scroll pagination (not full-table loads)
- Running balance is computed incrementally, not by summing from the start each time
- Consider WAL mode for SQLite (`PRAGMA journal_mode = WAL`)
