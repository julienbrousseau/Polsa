// src/main/ipc/transactions.ts

import {
  listTransactions,
  searchTransactions,
  createTransaction,
  createTransfer,
  updateTransfer,
  updateTransaction,
  deleteTransfer,
  deleteTransaction,
} from '../services/transaction-service';
import type {
  TransactionListInput,
  TransactionSearchInput,
  CreateTransactionInput,
  CreateTransferInput,
  UpdateTransactionInput,
} from '../../shared/types';

export function registerTransactionHandlers(): void {
  // Lazily resolve ipcMain to avoid module-init order issues in packaged builds.
  const { ipcMain } = require('electron') as typeof import('electron');

  ipcMain.handle('transactions:list', (_event, input: TransactionListInput) => {
    return listTransactions(input);
  });

  ipcMain.handle('transactions:search', (_event, input: TransactionSearchInput) => {
    return searchTransactions(input);
  });

  ipcMain.handle('transactions:create', (_event, input: CreateTransactionInput) => {
    return createTransaction(input);
  });

  ipcMain.handle('transactions:createTransfer', (_event, input: CreateTransferInput) => {
    return createTransfer(input);
  });

  ipcMain.handle('transactions:update', (_event, input: UpdateTransactionInput) => {
    return updateTransaction(input);
  });

  ipcMain.handle('transactions:updateTransfer', (_event, input) => {
    return updateTransfer(input);
  });

  ipcMain.handle('transactions:deleteTransfer', (_event, groupId: string) => {
    return deleteTransfer(groupId);
  });

  ipcMain.handle('transactions:delete', (_event, id: number) => {
    return deleteTransaction(id);
  });
}
