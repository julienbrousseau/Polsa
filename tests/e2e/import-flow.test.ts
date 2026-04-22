/**
 * E2E test for the CSV import flow:
 *   Import button → format chooser → account picker (multi-account CSV) → preview modal
 *
 * Requires a pre-built main process (dist/main/index.js).
 * Run: npm run test:e2e
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

const ROOT = path.join(__dirname, '..', '..');
const SAMPLE_CSV = path.join(ROOT, 'sampledata', 'buxfer-transactions-2023.csv');

let electronApp: ElectronApplication;
let page: Page;
let tempDbPath: string;

test.beforeAll(async () => {
  // Isolated temp DB so the test does not touch dev/prod data
  tempDbPath = path.join(os.tmpdir(), `polsa-e2e-${Date.now()}.db`);

  electronApp = await electron.launch({
    args: ['.'],
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      POLSA_DB_PATH: tempDbPath,
    },
  });

  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp.close();
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }
});

/**
 * Helper: create an account via IPC and return its id.
 */
async function createTestAccount(): Promise<number> {
  return page.evaluate(async () => {
    const acc = await (window as any).polsa.accounts.create({
      name: 'Test Account',
      type: 'checking',
      startingBalance: 0,
    });
    return acc.id as number;
  });
}

test('Import button shows format chooser with QIF and CSV options', async () => {
  const accountId = await createTestAccount();
  await page.goto(`#/accounts/${accountId}`);
  await page.waitForSelector('button', { timeout: 5000 });

  const importBtn = page.getByRole('button', { name: /import/i }).first();
  await importBtn.click();

  await expect(page.getByText('Choose import format')).toBeVisible();
  await expect(page.getByText('QIF import')).toBeVisible();
  await expect(page.getByText('CSV import')).toBeVisible();
});

test('Format chooser Cancel closes the modal', async () => {
  // Modal should still be open from previous test if run in sequence, but open fresh
  const importBtn = page.getByRole('button', { name: /import/i }).first();
  await importBtn.click();
  await expect(page.getByText('Choose import format')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Choose import format')).not.toBeVisible();
});

test('CSV import with multi-account file shows account picker', async () => {
  // Mock window.polsa.imports.pickFile to return the sample CSV path without opening the OS dialog
  await page.evaluate((csvPath: string) => {
    const orig = (window as any).polsa.imports;
    (window as any).polsa.imports = {
      ...orig,
      pickFile: async () => csvPath,
    };
  }, SAMPLE_CSV);

  const importBtn = page.getByRole('button', { name: /import/i }).first();
  await importBtn.click();
  await expect(page.getByText('Choose import format')).toBeVisible();

  // Select CSV
  await page.getByText('CSV import').click();

  // Wait for the account picker to appear (sample CSV has multiple accounts)
  await expect(page.getByText('Choose source account')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/This file contains transactions from/)).toBeVisible();

  // Restore
  await page.evaluate(() => {
    (window as any).polsa.imports.pickFile = async () => null;
  });
});

test('Selecting a source account shows the preview modal with stats', async () => {
  // Inject mock again since page state may have been reset
  await page.evaluate((csvPath: string) => {
    const orig = (window as any).polsa.imports;
    (window as any).polsa.imports = {
      ...orig,
      pickFile: async () => csvPath,
    };
  }, SAMPLE_CSV);

  const importBtn = page.getByRole('button', { name: /import/i }).first();
  await importBtn.click();
  await page.getByText('CSV import').click();

  // Wait for account picker
  await expect(page.getByText('Choose source account')).toBeVisible({ timeout: 10000 });

  // Click the first source account
  const accountButtons = page.locator('.glass button').filter({ hasText: /transaction/ });
  await accountButtons.first().click();

  // Preview modal should appear
  await expect(page.getByText('Review import')).toBeVisible({ timeout: 5000 });

  // Stats cards should be visible
  await expect(page.getByText('Net total')).toBeVisible();
  await expect(page.getByText('Uncategorised')).toBeVisible();
  await expect(page.getByText('Reconciled')).toBeVisible();
  await expect(page.getByText('Transactions')).toBeVisible();

  // Confirm button should be present
  await expect(page.getByRole('button', { name: 'Confirm import' })).toBeVisible();

  // Cancel and restore
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.evaluate(() => {
    (window as any).polsa.imports.pickFile = async () => null;
  });
});

test('Preview modal Cancel clears both modals', async () => {
  // Trigger the full flow again
  await page.evaluate((csvPath: string) => {
    const orig = (window as any).polsa.imports;
    (window as any).polsa.imports = {
      ...orig,
      pickFile: async () => csvPath,
    };
  }, SAMPLE_CSV);

  const importBtn = page.getByRole('button', { name: /import/i }).first();
  await importBtn.click();
  await page.getByText('CSV import').click();
  await expect(page.getByText('Choose source account')).toBeVisible({ timeout: 10000 });

  const accountButtons = page.locator('.glass button').filter({ hasText: /transaction/ });
  await accountButtons.first().click();
  await expect(page.getByText('Review import')).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByText('Review import')).not.toBeVisible();
  await expect(page.getByText('Choose source account')).not.toBeVisible();
});
