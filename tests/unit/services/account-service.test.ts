// tests/unit/services/account-service.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// We need to mock the database module before importing the service
import { vi } from 'vitest';

let testDb: Database.Database;

vi.mock('../../../src/main/database', () => ({
  getDb: () => testDb,
}));

// Import after mock setup
import {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../../../src/main/services/account-service';

function setupTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrationPath = path.join(__dirname, '../../../src/main/migrations/001_initial.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  db.exec(sql);

  return db;
}

describe('account-service', () => {
  beforeEach(() => {
    testDb = setupTestDb();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('listAccounts', () => {
    it('returns empty array when no accounts', () => {
      expect(listAccounts()).toEqual([]);
    });

    it('returns accounts sorted by name', () => {
      testDb.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run('Savings', 'savings', 10000);
      testDb.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run('Cash', 'cash', 5000);
      testDb.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run('Current', 'checking', 25000);

      const accounts = listAccounts();
      expect(accounts).toHaveLength(3);
      expect(accounts[0].name).toBe('Cash');
      expect(accounts[1].name).toBe('Current');
      expect(accounts[2].name).toBe('Savings');
    });

    it('computes current balance including transactions', () => {
      testDb.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run('Test', 'checking', 10000);
      const accountId = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;
      testDb.prepare("INSERT INTO transactions (account_id, date, amount, description) VALUES (?, ?, ?, ?)").run(accountId, '2024-01-15', 5000, 'Income');
      testDb.prepare("INSERT INTO transactions (account_id, date, amount, description) VALUES (?, ?, ?, ?)").run(accountId, '2024-01-20', -2000, 'Expense');

      const accounts = listAccounts();
      expect(accounts[0].startingBalance).toBe(10000);
      expect(accounts[0].currentBalance).toBe(13000); // 10000 + 5000 - 2000
    });
  });

  describe('getAccount', () => {
    it('returns account by id', () => {
      testDb.prepare("INSERT INTO accounts (name, type, starting_balance) VALUES (?, ?, ?)").run('Test', 'savings', 5000);
      const id = (testDb.prepare("SELECT last_insert_rowid() as id").get() as any).id;

      const account = getAccount(id);
      expect(account.id).toBe(id);
      expect(account.name).toBe('Test');
      expect(account.type).toBe('savings');
      expect(account.startingBalance).toBe(5000);
      expect(account.currentBalance).toBe(5000);
    });

    it('throws for non-existent account', () => {
      expect(() => getAccount(999)).toThrow('Account 999 not found');
    });
  });

  describe('createAccount', () => {
    it('creates an account and returns it', () => {
      const account = createAccount({ name: 'My Account', type: 'checking', startingBalance: 15000 });
      expect(account.id).toBeGreaterThan(0);
      expect(account.name).toBe('My Account');
      expect(account.type).toBe('checking');
      expect(account.startingBalance).toBe(15000);
      expect(account.currentBalance).toBe(15000);
    });

    it('trims whitespace from name', () => {
      const account = createAccount({ name: '  Padded Name  ', type: 'cash', startingBalance: 0 });
      expect(account.name).toBe('Padded Name');
    });

    it('rejects empty name', () => {
      expect(() => createAccount({ name: '', type: 'cash', startingBalance: 0 })).toThrow('Account name is required');
    });

    it('rejects invalid account type', () => {
      expect(() => createAccount({ name: 'Test', type: 'bitcoin' as any, startingBalance: 0 })).toThrow('Invalid account type');
    });

    it('rejects non-integer starting balance', () => {
      expect(() => createAccount({ name: 'Test', type: 'cash', startingBalance: 10.5 })).toThrow('Starting balance must be an integer');
    });
  });

  describe('updateAccount', () => {
    it('updates account fields', () => {
      const created = createAccount({ name: 'Original', type: 'cash', startingBalance: 0 });
      const updated = updateAccount({ id: created.id, name: 'Renamed', type: 'savings', startingBalance: 5000 });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Renamed');
      expect(updated.type).toBe('savings');
      expect(updated.startingBalance).toBe(5000);
    });

    it('throws for non-existent account', () => {
      expect(() => updateAccount({ id: 999, name: 'Test', type: 'cash', startingBalance: 0 })).toThrow('Account 999 not found');
    });
  });

  describe('deleteAccount', () => {
    it('deletes an account', () => {
      const created = createAccount({ name: 'To Delete', type: 'cash', startingBalance: 0 });
      deleteAccount(created.id);
      expect(listAccounts()).toHaveLength(0);
    });

    it('cascades transaction deletion', () => {
      const created = createAccount({ name: 'Test', type: 'checking', startingBalance: 0 });
      testDb.prepare("INSERT INTO transactions (account_id, date, amount, description) VALUES (?, ?, ?, ?)").run(created.id, '2024-01-15', 5000, 'Income');

      deleteAccount(created.id);

      const count = (testDb.prepare("SELECT COUNT(*) as c FROM transactions").get() as any).c;
      expect(count).toBe(0);
    });

    it('throws for non-existent account', () => {
      expect(() => deleteAccount(999)).toThrow('Account 999 not found');
    });
  });
});
