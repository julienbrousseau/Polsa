import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
  },
}));

import { initDatabase, closeDatabase } from '../../../src/main/database';

describe('database backups', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'polsa-db-backup-test-'));
    dbPath = path.join(tempDir, 'polsa.db');
  });

  afterEach(() => {
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('creates a backup on database init', () => {
    initDatabase(dbPath);
    closeDatabase();

    const backupsDir = path.join(tempDir, 'backups');
    const backups = fs.readdirSync(backupsDir).filter((name) => name.endsWith('.db'));

    expect(backups.length).toBe(1);
  });

  it('keeps only the 4 most recent backups', () => {
    let tick = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000 + tick++);

    for (let i = 0; i < 6; i += 1) {
      initDatabase(dbPath);
      closeDatabase();
    }

    const backupsDir = path.join(tempDir, 'backups');
    const backups = fs.readdirSync(backupsDir).filter((name) => name.endsWith('.db'));

    expect(backups.length).toBe(4);
  });
});
