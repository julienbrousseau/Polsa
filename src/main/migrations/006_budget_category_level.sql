-- Proper unique indexes for budget_allocations to handle NULL subcategory_id
-- SQLite treats NULLs as distinct in UNIQUE constraints, so we need partial indexes.

-- Subcategory-level uniqueness (subcategory_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_alloc_subcat_unique
    ON budget_allocations(subcategory_id, year, month)
    WHERE subcategory_id IS NOT NULL;

-- Category-level uniqueness (subcategory_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_alloc_cat_unique
    ON budget_allocations(category_id, year, month)
    WHERE subcategory_id IS NULL;

-- Same for budget_defaults
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_defaults_subcat_unique
    ON budget_defaults(subcategory_id, effective_from)
    WHERE subcategory_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_defaults_cat_unique
    ON budget_defaults(category_id, effective_from)
    WHERE subcategory_id IS NULL;
