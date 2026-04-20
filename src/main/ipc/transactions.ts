// src/main/ipc/transactions.ts

import { ipcMain } from 'electron';
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../services/transaction-service';
import type {
  TransactionListInput,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../../shared/types';

export function registerTransactionHandlers(): void {
  ipcMain.handle('transactions:list', (_event, input: TransactionListInput) => {
    return listTransactions(input);
  });

  ipcMain.handle('transactions:create', (_event, input: CreateTransactionInput) => {
    return createTransaction(input);
  });

  ipcMain.handle('transactions:update', (_event, input: UpdateTransactionInput) => {
    return updateTransaction(input);
  });

  ipcMain.handle('transactions:delete', (_event, id: number) => {
    return deleteTransaction(id);
  });
}
