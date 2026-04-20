// src/main/ipc/reconcile.ts

import { ipcMain } from 'electron';
import {
  getReconciledBalance,
  getUnreconciledTransactions,
  confirmReconciliation,
} from '../services/reconcile-service';
import type { ReconcileUnreconciledInput, ReconcileConfirmInput } from '../../shared/types';

export function registerReconcileHandlers(): void {
  ipcMain.handle('reconcile:getBalance', (_event, accountId: number) => {
    return getReconciledBalance(accountId);
  });

  ipcMain.handle('reconcile:getUnreconciled', (_event, input: ReconcileUnreconciledInput) => {
    return getUnreconciledTransactions(input.accountId, input.offset, input.limit);
  });

  ipcMain.handle('reconcile:confirm', (_event, input: ReconcileConfirmInput) => {
    return confirmReconciliation(input.transactionIds);
  });
}
