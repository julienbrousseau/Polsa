-- Migration 009: add is_closed flag to accounts
ALTER TABLE accounts ADD COLUMN is_closed INTEGER NOT NULL DEFAULT 0;
