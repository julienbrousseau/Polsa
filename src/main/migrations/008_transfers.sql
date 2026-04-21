ALTER TABLE transactions ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'standard' CHECK (transaction_type IN ('standard', 'transfer'));
ALTER TABLE transactions ADD COLUMN transfer_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN transfer_group_id TEXT;

CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_transfer_group ON transactions(transfer_group_id);
