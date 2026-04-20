// src/main/ipc/sync.ts

import { ipcMain } from 'electron';
import {
  importMobileTransactions,
  generateDesktopPayload,
  type MobileSyncPayload,
} from '../services/sync-service';
import { createSyncServer, stopSyncServer } from '../services/sync-server';

export function registerSyncHandlers(): void {
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
