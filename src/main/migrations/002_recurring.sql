CREATE TABLE recurring_transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    description     TEXT    NOT NULL DEFAULT '',
    amount          INTEGER NOT NULL,
    subcategory_id  INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
    frequency       TEXT    NOT NULL CHECK (frequency IN ('daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
    next_date       TEXT    NOT NULL,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_recurring_active_next ON recurring_transactions(active, next_date);
CREATE INDEX idx_recurring_account     ON recurring_transactions(account_id);
