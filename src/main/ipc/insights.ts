import { ipcMain } from 'electron';
import { getMonthInsights } from '../services/insights-service';
import type { InsightsMonthInput } from '../../shared/types';

export function registerInsightsHandlers(): void {
  ipcMain.handle('insights:month', (_event, input: InsightsMonthInput) => {
    return getMonthInsights(input.year, input.month);
  });
}