// src/main/ipc/recurring.ts

import { ipcMain } from 'electron';
import {
  listRecurring,
  getRecurring,
  createRecurring,
  updateRecurring,
  cancelRecurring,
  reactivateRecurring,
  deleteRecurring,
  applyOverdue,
} from '../services/recurring-service';

export function registerRecurringHandlers(): void {
  ipcMain.handle('recurring:list', () => {
    return listRecurring();
  });

  ipcMain.handle('recurring:get', (_event, id: number) => {
    return getRecurring(id);
  });

  ipcMain.handle('recurring:create', (_event, input) => {
    return createRecurring(input);
  });

  ipcMain.handle('recurring:update', (_event, input) => {
    return updateRecurring(input);
  });

  ipcMain.handle('recurring:cancel', (_event, id: number) => {
    return cancelRecurring(id);
  });

  ipcMain.handle('recurring:reactivate', (_event, id: number) => {
    return reactivateRecurring(id);
  });

  ipcMain.handle('recurring:delete', (_event, id: number) => {
    return deleteRecurring(id);
  });

  ipcMain.handle('recurring:applyOverdue', () => {
    return applyOverdue();
  });
}
