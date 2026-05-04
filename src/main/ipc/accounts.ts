import { ipcMain } from 'electron';
import { listAccounts, listOpenAccounts, getAccount, createAccount, updateAccount, deleteAccount, closeAccount, reopenAccount } from '../services/account-service';

export function registerAccountHandlers(): void {
  ipcMain.handle('accounts:list', () => {
    return listAccounts();
  });

  ipcMain.handle('accounts:listOpen', () => {
    return listOpenAccounts();
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

  ipcMain.handle('accounts:close', (_event, id: number) => {
    return closeAccount(id);
  });

  ipcMain.handle('accounts:reopen', (_event, id: number) => {
    return reopenAccount(id);
  });
}
