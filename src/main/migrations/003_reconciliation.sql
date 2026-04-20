CREATE INDEX idx_transactions_account_reconciled 
    ON transactions(account_id, reconciled, date DESC);
