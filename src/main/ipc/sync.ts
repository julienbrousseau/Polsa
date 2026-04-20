// src/main/ipc/sync.ts

import { ipcMain } from 'electron';
import {
  importMobileTransactions,
  generateDesktopPayload,
  type MobileSyncPayload,
} from '../services/sync-service';
import { createSyncServer, stopSyncServer } from '../services/sync-server';
import { startCompanionServer, stopCompanionServer } from '../services/companion-server';

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:startCompanion', () => {
    return startCompanionServer();
  });

  ipcMain.handle('sync:stopCompanion', () => {
    stopCompanionServer();
  });

  ipcMain.handle('sync:importMobile', (_event, payload: MobileSyncPayload) => {
    return importMobileTransactions(payload);
  });

  ipcMain.handle('sync:generatePayload', () => {
    return generateDesktopPayload([]);
  });

  ipcMain.handle('sync:startServer', () => {
    return createSyncServer();
  });

  ipcMain.handle('sync:stopServer', () => {
    stopSyncServer();
  });
}
