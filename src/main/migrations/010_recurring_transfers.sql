ALTER TABLE recurring_transactions ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'standard' CHECK (transaction_type IN ('standard', 'transfer'));
ALTER TABLE recurring_transactions ADD COLUMN transfer_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_recurring_type ON recurring_transactions(transaction_type);
CREATE INDEX idx_recurring_transfer_account ON recurring_transactions(transfer_account_id);
