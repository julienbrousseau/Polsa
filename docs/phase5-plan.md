# Phase 5 — Companion Mobile App

> **Scope:** Lightweight PWA for capturing transactions on the go, with offline-first storage and local sync to the desktop app.
> **Prerequisite:** Phases 1–4 complete (full desktop feature set).
> Source requirements: [spec.md](../spec.md) § Companion mobile app

---

## 1. Overview

A minimal Progressive Web App (PWA) that runs on a phone. Its sole purpose is to **capture transactions while away from the desktop** — e.g. recording a coffee purchase while out. It stores entries locally on the phone with no server or internet connectivity required.

When the user is near the desktop, they sync accumulated mobile transactions into the main Polsa database. The mobile app is **not** a full replica of the desktop — it holds only what's needed for quick data entry.

---

## 2. What the Mobile App Does (and Doesn't)

### In scope

- View list of accounts (names, types, current balances — synced from desktop)
- View list of categories/subcategories (synced from desktop)
- Create new transactions (date, amount, account, category, description)
- Store transactions locally in the browser (IndexedDB)
- Sync pending transactions to the desktop app
- Work fully offline — no network required

### Out of scope

- Editing/deleting transactions already on the desktop
- Viewing transaction history
- Recurring payments, reconciliation, budgets
- Account/category management (done on desktop, synced down)

---

## 3. Technical Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React (same as desktop renderer) | Code sharing, familiar tooling |
| Build | Vite | Fast, PWA plugin available |
| PWA | `vite-plugin-pwa` + service worker | Offline support, installable on phone |
| Local storage | IndexedDB via `idb` | Structured storage, good capacity, async-friendly |
| Styling | Tailwind CSS | Consistent with desktop theme |
| Sync | QR code (primary), local network (secondary) | No cloud, no accounts, works offline |

### Why PWA over a native app?

- No app store submission or review process
- Same React/TypeScript stack as the desktop renderer
- Install directly from the desktop app or a local URL
- Works on both iOS and Android

---

## 4. Mobile App Structure

```
companion/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── index.html
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── icons/                  # App icons (various sizes)
│   └── sw.js                   # Service worker (generated)
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Router + layout
│   ├── db.ts                   # IndexedDB schema + operations
│   ├── sync.ts                 # Sync logic (QR + local network)
│   ├── pages/
│   │   ├── Home.tsx            # Account list with balances
│   │   ├── AddTransaction.tsx  # Quick-add form
│   │   ├── PendingList.tsx     # Queued transactions awaiting sync
│   │   └── Sync.tsx            # Sync screen (QR scanner / network)
│   ├── components/
│   │   ├── AccountCard.tsx
│   │   ├── TransactionForm.tsx
│   │   └── QRScanner.tsx
│   └── lib/
│       ├── format.ts           # Shared with desktop (money, dates)
│       └── types.ts            # Subset of desktop shared types
└── tests/
    ├── db.test.ts
    └── sync.test.ts
```

The companion app lives in a separate `companion/` directory at the project root — it's a standalone Vite project with its own `package.json`, not bundled into the Electron app.

---

## 5. IndexedDB Schema

```typescript
// companion/src/db.ts

interface MobileDB {
  accounts: {
    key: number;          // account ID from desktop
    value: {
      id: number;
      name: string;
      type: AccountType;
      currentBalance: number;  // cents, snapshot from last sync
    };
  };
  categories: {
    key: number;
    value: {
      id: number;
      name: string;
    };
  };
  subcategories: {
    key: number;
    value: {
      id: number;
      categoryId: number;
      name: string;
    };
  };
  pendingTransactions: {
    key: string;          // UUID generated on mobile
    value: {
      id: string;         // local UUID
      accountId: number;
      date: string;       // YYYY-MM-DD
      amount: number;     // cents
      subcategoryId: number | null;
      description: string;
      createdAt: string;  // ISO timestamp
      synced: boolean;    // false until confirmed synced
    };
    indexes: {
      byAccount: number;
      bySynced: boolean;
    };
  };
}
```

### Design notes

- **`accounts`, `categories`, `subcategories`** are read-only mirrors of the desktop data, refreshed on each sync.
- **`pendingTransactions`** are locally created entries waiting to be pushed to the desktop. Each has a UUID so duplicates can be detected.
- **`synced` flag** remains `false` until the desktop confirms receipt. Synced transactions can be purged after confirmation.

---

## 6. Mobile Screens

### Home (Account List)

```
┌──────────────────────────┐
│  POLSA                   │
│                          │
│  Current Account         │
│  £1,245.50               │
│                          │
│  Savings                 │
│  £5,320.00               │
│                          │
│  Cash                    │
│  £85.20                  │
│                          │
│  ──────────────────────  │
│  3 pending transactions  │
│                          │
│  [+ Add]        [Sync]   │
└──────────────────────────┘
```

- Tap an account → goes to Add Transaction with that account pre-selected
- Pending count shown as a badge/summary
- Balances are **snapshots** from last sync — they don't update with pending transactions (to avoid confusion between confirmed and unconfirmed data)

### Add Transaction

```
┌──────────────────────────┐
│  ← New Transaction       │
│                          │
│  Account: [Current  ▼]   │
│                          │
│  Date:    [20/04/2026]   │
│  Amount:  [£ _______ ]   │
│  Category:[Select...  ▼]  │
│  Note:    [____________] │
│                          │
│        [Save]            │
└──────────────────────────┘
```

- Date defaults to today
- Large amount input field for easy thumb typing
- Category is optional (same as desktop)
- Amount toggle: expense (-) / income (+), default to expense
- After save, return to Home or offer "Add another"

### Pending Transactions

```
┌──────────────────────────┐
│  ← Pending (3)           │
│                          │
│  20/04  Tesco    -£45.20 │
│         Current          │
│                          │
│  19/04  Coffee    -£3.80 │
│         Cash             │
│                          │
│  18/04  Refund   +£12.00 │
│         Current          │
│                          │
│  [Sync All]              │
└──────────────────────────┘
```

- List of transactions waiting to sync
- Swipe to delete (if entered by mistake)
- Tap to edit before sync

### Sync Screen

```
┌──────────────────────────┐
│  ← Sync                  │
│                          │
│  ┌────────────────────┐  │
│  │                    │  │
│  │   [QR CODE HERE]   │  │
│  │                    │  │
│  └────────────────────┘  │
│                          │
│  Show this QR code to    │
│  your desktop app        │
│                          │
│  ── or ──                │
│                          │
│  [Scan QR from desktop]  │
│                          │
│  3 transactions to send  │
│  Last sync: 18/04/2026   │
│                          │
└──────────────────────────┘
```

---

## 7. Sync Mechanism

Sync is **bidirectional** but asymmetric:
- **Desktop → Mobile:** accounts, categories, subcategories, current balances (reference data)
- **Mobile → Desktop:** pending transactions (new data)

### Primary method: QR codes

QR codes work with zero network setup — just a camera. The flow:

#### Sending transactions (mobile → desktop)

1. Mobile generates a QR code containing the pending transactions as a compact JSON payload.
2. Desktop app opens a "Scan mobile" dialog using the webcam.
3. Desktop scans the QR, parses the transactions, shows a preview, and confirms import.
4. Desktop shows a confirmation QR code (containing receipt + updated account/category data).
5. Mobile scans the confirmation QR to mark transactions as synced and refresh its reference data.

#### Data format

```typescript
// Mobile → Desktop QR payload
interface MobileSyncPayload {
  version: 1;
  transactions: {
    id: string;           // mobile UUID for dedup
    accountId: number;
    date: string;
    amount: number;       // cents
    subcategoryId: number | null;
    description: string;
  }[];
}

// Desktop → Mobile QR payload (confirmation)
interface DesktopSyncPayload {
  version: 1;
  syncedIds: string[];    // mobile UUIDs confirmed received
  accounts: { id: number; name: string; type: string; currentBalance: number }[];
  categories: { id: number; name: string }[];
  subcategories: { id: number; categoryId: number; name: string }[];
}
```

#### QR size constraints

A single QR code holds ~3KB of data comfortably. For typical transactions (~100 bytes each), that's ~30 transactions per QR. If more, split into multiple QR codes scanned sequentially, with a counter ("QR 1/3", "QR 2/3", "QR 3/3").

### Secondary method: Local network

For larger syncs or when QR is inconvenient:

1. Desktop app starts a temporary HTTP server on a local port (e.g. `http://192.168.x.x:9876`).
2. Desktop displays the URL and a QR code pointing to it.
3. Mobile scans the QR or enters the URL → connects to the desktop over local WiFi.
4. Sync happens via HTTP POST/GET — same payloads as QR, but no size limit.
5. Server shuts down after sync completes.

This requires both devices on the same network but handles any payload size.

---

## 8. Desktop-Side Sync Integration

### New files in the Electron app

```
src/
  main/
    ipc/
      sync.ts                    # IPC handlers for sync operations
    services/
      sync-service.ts            # Import mobile transactions, generate payloads
  renderer/
    pages/
      MobileSync.tsx             # QR scanner + sync status
    components/
      QRCodeDisplay.tsx          # Show QR for mobile to scan
      QRScanner.tsx              # Webcam QR scanner
```

### IPC API (desktop)

| Channel | Args | Returns | Notes |
|---------|------|---------|-------|
| `sync:importMobile` | `MobileSyncPayload` | `{ imported: number, duplicates: number }` | Insert mobile transactions, skip duplicates by UUID |
| `sync:generatePayload` | — | `DesktopSyncPayload` | Current accounts, categories, balances for mobile |
| `sync:startServer` | — | `{ url: string, port: number }` | Start local sync HTTP server |
| `sync:stopServer` | — | `void` | Stop local sync server |

### Sidebar addition

```
│  Categories│
│  Recurring │
│  Reconcile │
│  Budgets   │
│  ────────  │
│  📱 Sync   │    ← new
│            │
```

---

## 9. Duplicate Detection

Every transaction created on mobile has a UUID (`pendingTransactions.id`). When imported to the desktop:

1. Store the mobile UUID in a new column on the transactions table.
2. Before inserting, check if a transaction with that UUID already exists.
3. Skip duplicates silently.

### Migration `005_mobile_sync.sql`

```sql
ALTER TABLE transactions ADD COLUMN mobile_id TEXT;
CREATE UNIQUE INDEX idx_transactions_mobile_id ON transactions(mobile_id) WHERE mobile_id IS NOT NULL;
```

This ensures sync is **idempotent** — scanning the same QR twice won't create duplicate transactions.

---

## 10. PWA Configuration

### `manifest.json`

```json
{
  "name": "Polsa Companion",
  "short_name": "Polsa",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b0f1a",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service worker

- Cache all app assets (HTML, JS, CSS, icons) for offline use
- No API caching — all data is in IndexedDB
- Update strategy: check for new version on each launch, prompt to refresh

### How to install

The companion PWA is served from the desktop app:

1. Desktop starts a local HTTP server (same infrastructure as network sync).
2. Mobile navigates to the local URL.
3. Browser prompts "Add to Home Screen".
4. After installation, the PWA works fully offline — the server can be stopped.

Alternatively, the PWA can be hosted on a simple static file server (GitHub Pages, Netlify) for easier initial installation, then operates offline.

---

## 11. Implementation Milestones

### M1 — PWA Scaffold & Local Storage
- Set up `companion/` project with Vite + React + Tailwind + PWA plugin
- Configure service worker for offline support
- Implement IndexedDB schema and operations (`db.ts`)
- Home screen with hardcoded test data
- **Deliverable:** Installable PWA shell that works offline

### M2 — Transaction Entry
- Add Transaction page with full form
- Pending Transactions list with edit/delete
- Store in IndexedDB
- Test offline: turn off network, add transactions, verify they persist
- **Deliverable:** Can capture transactions on phone without network

### M3 — QR Code Sync
- Mobile: generate QR payload from pending transactions
- Mobile: scan QR from desktop (confirmation payload)
- Desktop: QR scanner page using webcam
- Desktop: `sync-service.ts` with import + dedup logic
- Desktop: generate confirmation QR payload
- Migration `005_mobile_sync.sql`
- **Deliverable:** Full QR-based sync working between devices

### M4 — Local Network Sync
- Desktop: temporary HTTP server for sync
- Mobile: detect and connect to local sync server
- Same payloads as QR, transferred over HTTP
- Auto-discovery via QR code containing the URL
- **Deliverable:** Network sync as alternative to QR

### M5 — Polish & Testing
- Mobile: liquid glass theme matching desktop
- Mobile: touch-optimised inputs (large tap targets, native date/number pickers)
- Handle edge cases: account deleted on desktop between syncs, category removed
- Unit tests for sync logic (dedup, payload generation/parsing)
- E2E test: add on mobile → sync → appears on desktop
- **Deliverable:** Phase 5 complete

---

## 12. Testing Strategy

### Unit tests

| Area | Key test cases |
|------|---------------|
| IndexedDB ops | Store/retrieve/delete pending transactions. Update reference data on sync |
| Sync payload | Generate valid QR payload. Parse desktop confirmation. Handle empty pending list |
| Dedup | Same UUID not imported twice. Different UUID with same data is imported (legitimate duplicate) |
| QR size | Payload fits in single QR for ≤30 transactions. Multi-QR split for larger batches |
| Date/money | Amounts stored as cents throughout. Dates in ISO format. Display in GB format |

### E2E tests

| Flow | Scenario |
|------|----------|
| Offline entry | Install PWA → go offline → add 3 transactions → go online → all 3 still present |
| QR sync | Add on mobile → generate QR → scan on desktop → transactions imported → scan confirmation → mobile marks synced |
| Dedup | Sync same QR twice → no duplicates on desktop |
| Reference data | Add new account on desktop → sync → new account appears on mobile |

---

## 13. Interaction with Earlier Phases

- **Phase 1 (Transactions):** Mobile-created transactions become normal transactions on the desktop after sync. They appear in account detail, affect balances, and can be edited/deleted.
- **Phase 1 (Categories):** Category/subcategory list is synced to mobile as read-only reference data. Mobile can't create new categories — if a purchase doesn't fit existing categories, leave it uncategorised and fix on desktop.
- **Phase 2 (Recurring):** No interaction — recurring payments are desktop-only.
- **Phase 3 (Reconciliation):** Mobile-synced transactions start as `reconciled = 0`, eligible for reconciliation like any other.
- **Phase 4 (Budgets):** Mobile transactions count toward budget spending once synced to desktop.
