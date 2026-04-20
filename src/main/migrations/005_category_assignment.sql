ALTER TABLE transactions
ADD category_id INTEGER;

CREATE INDEX idx_transactions_category ON transactions(category_id);