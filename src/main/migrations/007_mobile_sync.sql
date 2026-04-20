-- Mobile sync: add mobile_id column for dedup
ALTER TABLE transactions ADD COLUMN mobile_id TEXT;
CREATE UNIQUE INDEX idx_transactions_mobile_id ON transactions(mobile_id) WHERE mobile_id IS NOT NULL;
