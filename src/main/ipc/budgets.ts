// src/main/ipc/budgets.ts

import { ipcMain } from 'electron';
import {
  getOverview,
  getAllocations,
  setAllocation,
  setAllocations,
  getDefaults,
} from '../services/budget-service';
import type { BudgetOverviewInput, SetAllocationInput, SetAllocationsInput } from '../../shared/types';

export function registerBudgetHandlers(): void {
  ipcMain.handle('budgets:overview', (_event, input: BudgetOverviewInput) => {
    return getOverview(input.year, input.month);
  });

  ipcMain.handle('budgets:getAllocations', (_event, input: BudgetOverviewInput) => {
    return getAllocations(input.year, input.month);
  });

  ipcMain.handle('budgets:setAllocation', (_event, input: SetAllocationInput) => {
    return setAllocation(input);
  });

  ipcMain.handle('budgets:setAllocations', (_event, input: SetAllocationsInput) => {
    return setAllocations(input);
  });

  ipcMain.handle('budgets:getDefaults', () => {
    return getDefaults();
  });
}
