// src/main/ipc/qif.ts

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { importQif, exportQif } from '../services/qif-service';
import type { QifImportInput, QifExportInput } from '../../shared/types';

export function registerQifHandlers(): void {
  ipcMain.handle('qif:import', (_event, input: QifImportInput) => {
    return importQif(input);
  });

  ipcMain.handle('qif:export', (_event, input: QifExportInput) => {
    return exportQif(input);
  });

  ipcMain.handle('qif:pick-import-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: 'Import QIF File',
      filters: [{ name: 'QIF Files', extensions: ['qif'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('qif:pick-export-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      title: 'Export QIF File',
      filters: [{ name: 'QIF Files', extensions: ['qif'] }],
      defaultPath: 'transactions.qif',
    });
    return result.canceled ? null : result.filePath;
  });
}
