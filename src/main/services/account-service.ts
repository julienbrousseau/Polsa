// src/main/services/account-service.ts

import { getDb } from '../database';
import type { Account, CreateAccountInput, UpdateAccountInput } from '../../shared/types';
import { validateAccountName, isValidAccountType, isValidInteger } from '../../shared/validation';

export function listAccounts(): Account[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.id, a.name, a.type, a.starting_balance,
           a.starting_balance + COALESCE(SUM(t.amount), 0) AS current_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    GROUP BY a.id
    ORDER BY a.name COLLATE NOCASE
  `).all() as Array<{ id: number; name: string; type: string; starting_balance: number; current_balance: number }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as Account['type'],
    startingBalance: r.starting_balance,
    currentBalance: r.current_balance,
  }));
}

export function getAccount(id: number): Account {
  const db = getDb();
  const row = db.prepare(`
    SELECT a.id, a.name, a.type, a.starting_balance,
           a.starting_balance + COALESCE(SUM(t.amount), 0) AS current_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    WHERE a.id = ?
    GROUP BY a.id
  `).get(id) as { id: number; name: string; type: string; starting_balance: number; current_balance: number } | undefined;

  if (!row) {
    throw new Error(`Account ${id} not found`);
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type as Account['type'],
    startingBalance: row.starting_balance,
    currentBalance: row.current_balance,
  };
}

export function createAccount(input: CreateAccountInput): Account {
  const nameError = validateAccountName(input.name);
  if (nameError) throw new Error(nameError);
  if (!isValidAccountType(input.type)) throw new Error('Invalid account type');
  if (!isValidInteger(input.startingBalance)) throw new Error('Starting balance must be an integer (cents)');

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)
  `).run(input.name.trim(), input.type, input.startingBalance);

  return getAccount(result.lastInsertRowid as number);
}

export function updateAccount(input: UpdateAccountInput): Account {
  const nameError = validateAccountName(input.name);
  if (nameError) throw new Error(nameError);
  if (!isValidAccountType(input.type)) throw new Error('Invalid account type');
  if (!isValidInteger(input.startingBalance)) throw new Error('Starting balance must be an integer (cents)');
  if (!isValidInteger(input.id)) throw new Error('Invalid account ID');

  const db = getDb();
  const changes = db.prepare(`
    UPDATE accounts SET name = ?, type = ?, starting_balance = ? WHERE id = ?
  `).run(input.name.trim(), input.type, input.startingBalance, input.id);

  if (changes.changes === 0) {
    throw new Error(`Account ${input.id} not found`);
  }

  return getAccount(input.id);
}

export function deleteAccount(id: number): void {
  if (!isValidInteger(id)) throw new Error('Invalid account ID');

  const db = getDb();
  const changes = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);

  if (changes.changes === 0) {
    throw new Error(`Account ${id} not found`);
  }
}
