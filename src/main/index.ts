// src/main/index.ts

import { app, BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from './database';
import { registerAccountHandlers } from './ipc/accounts';
import { registerCategoryHandlers } from './ipc/categories';
import { registerTransactionHandlers } from './ipc/transactions';
import { registerImportHandlers } from './ipc/imports';
import { registerQifHandlers } from './ipc/qif';
import { registerRecurringHandlers } from './ipc/recurring';
import { registerReconcileHandlers } from './ipc/reconcile';
import { registerBudgetHandlers } from './ipc/budgets';
import { registerSyncHandlers } from './ipc/sync';
import { registerInsightsHandlers } from './ipc/insights';
import { applyOverdue } from './services/recurring-service';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

// Resolve the app icon (PNG works on all platforms in dev; .icns is picked up
// by electron-builder at package time via buildResources)
const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashFile = isDev
    ? path.join(__dirname, '..', '..', 'src', 'renderer', 'public', 'splash.html')
    : path.join(__dirname, '..', 'renderer', 'splash.html');

  splashWindow.loadFile(splashFile);
  splashWindow.once('ready-to-show', () => {
    splashWindow?.show();
  });
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0f1a',
    show: false,
    icon: iconPath,
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

  mainWindow.once('ready-to-show', () => {
    // Brief delay so the splash is visible for at least a moment
    setTimeout(() => {
      splashWindow?.close();
      mainWindow?.show();
    }, 600);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Set dock icon on macOS (dev mode — in prod it's set by the .icns bundle)
  if (process.platform === 'darwin' && isDev) {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  }

  createSplashWindow();

  try {
    initDatabase();
    registerAccountHandlers();
    registerCategoryHandlers();
    registerTransactionHandlers();
    registerImportHandlers();
    registerQifHandlers();
    registerRecurringHandlers();
    registerReconcileHandlers();
    registerBudgetHandlers();
    registerSyncHandlers();
    registerInsightsHandlers();

    // Apply overdue recurring payments before showing UI
    const { applied } = applyOverdue();
    if (applied > 0) {
      console.log(`Applied ${applied} overdue recurring payment(s)`);
    }
  } catch (err) {
    console.error('Startup error:', err);
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
