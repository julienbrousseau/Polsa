// src/main/index.ts

import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from './database';
import { registerAccountHandlers } from './ipc/accounts';
import { registerCategoryHandlers } from './ipc/categories';
import { registerTransactionHandlers } from './ipc/transactions';
import { registerQifHandlers } from './ipc/qif';
import { registerRecurringHandlers } from './ipc/recurring';
import { applyOverdue } from './services/recurring-service';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0f1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase();
  registerAccountHandlers();
  registerCategoryHandlers();
  registerTransactionHandlers();
  registerQifHandlers();
  registerRecurringHandlers();

  // Apply overdue recurring payments before showing UI
  const { applied } = applyOverdue();
  if (applied > 0) {
    console.log(`Applied ${applied} overdue recurring payment(s)`);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  closeDatabase();
});
