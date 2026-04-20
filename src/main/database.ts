// src/main/database.ts

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'polsa.db');
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialised. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? getDbPath();

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Read migration files
  const migrationsDir = path.join(__dirname, 'migrations');

  // In development, migrations are in src/main/migrations
  // In production, they're bundled alongside the compiled JS
  let resolvedDir = migrationsDir;
  if (!fs.existsSync(resolvedDir)) {
    // Fallback: try relative to this file's source location
    resolvedDir = path.join(__dirname, '..', '..', 'src', 'main', 'migrations');
  }

  if (!fs.existsSync(resolvedDir)) {
    console.warn('No migrations directory found');
    return;
  }

  const files = fs.readdirSync(resolvedDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    database.prepare('SELECT name FROM _migrations').all()
      .map((row: any) => row.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(resolvedDir, file), 'utf-8');

    database.transaction(() => {
      // Split by semicolon and execute each statement
      // (PRAGMA statements can't be inside transactions in some cases,
      //  so we handle them separately)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        database.exec(stmt);
      }

      database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();

    console.log(`Applied migration: ${file}`);
  }
}
