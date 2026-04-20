// src/main/ipc/accounts.ts

import { ipcMain } from 'electron';
import { listAccounts, getAccount, createAccount, updateAccount, deleteAccount } from '../services/account-service';

export function registerAccountHandlers(): void {
  ipcMain.handle('accounts:list', () => {
    return listAccounts();
  });

  ipcMain.handle('accounts:get', (_event, id: number) => {
    return getAccount(id);
  });

  ipcMain.handle('accounts:create', (_event, input) => {
    return createAccount(input);
  });

  ipcMain.handle('accounts:update', (_event, input) => {
    return updateAccount(input);
  });

  ipcMain.handle('accounts:delete', (_event, id: number) => {
    return deleteAccount(id);
  });
}
