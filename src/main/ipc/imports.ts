import { BrowserWindow, dialog, ipcMain } from 'electron';
import { commitImport, previewImport } from '../services/import-service';
import type { ImportCommitInput, ImportFormat, ImportPreviewInput } from '../../shared/types';

function getImportDialogOptions(format: ImportFormat) {
  if (format === 'csv') {
    return {
      title: 'Import CSV File',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    };
  }

  return {
    title: 'Import QIF File',
    filters: [{ name: 'QIF Files', extensions: ['qif'] }],
  };
}

export function registerImportHandlers(): void {
  ipcMain.handle('imports:preview', (_event, input: ImportPreviewInput) => {
    return previewImport(input);
  });

  ipcMain.handle('imports:commit', (_event, input: ImportCommitInput) => {
    return commitImport(input);
  });

  ipcMain.handle('imports:pick-file', async (event, format: ImportFormat) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return null;
    }

    const result = await dialog.showOpenDialog(win, {
      ...getImportDialogOptions(format),
      properties: ['openFile'],
    });

    return result.canceled ? null : result.filePaths[0];
  });
}