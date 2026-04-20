-- Monthly budget allocation per subcategory (or category-level if subcategory_id is NULL)
CREATE TABLE budget_allocations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    subcategory_id  INTEGER REFERENCES subcategories(id) ON DELETE CASCADE,
    category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount          INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (category_id, year, month, subcategory_id)
);

-- The "template" allocation: what new months default to
-- Updated when user chooses "all future months"
CREATE TABLE budget_defaults (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    subcategory_id  INTEGER REFERENCES subcategories(id) ON DELETE CASCADE,
    category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL DEFAULT 0,
    effective_from  TEXT    NOT NULL,
    UNIQUE (category_id, effective_from, subcategory_id)
);

CREATE INDEX idx_budget_alloc_period ON budget_allocations(year, month);
CREATE INDEX idx_budget_alloc_subcat ON budget_allocations(subcategory_id);
CREATE INDEX idx_budget_defaults_subcat ON budget_defaults(subcategory_id);
