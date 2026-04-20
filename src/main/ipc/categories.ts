// src/main/ipc/categories.ts

import { ipcMain } from 'electron';
import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  createSubcategory,
  renameSubcategory,
  deleteSubcategory,
  listCategoryTransactions,
} from '../services/category-service';

export function registerCategoryHandlers(): void {
  ipcMain.handle('categories:list', () => {
    return listCategories();
  });

  ipcMain.handle('categories:create', (_event, input: { name: string }) => {
    return createCategory(input);
  });

  ipcMain.handle('categories:rename', (_event, input: { id: number; name: string }) => {
    return renameCategory(input);
  });

  ipcMain.handle('categories:delete', (_event, id: number) => {
    return deleteCategory(id);
  });

  ipcMain.handle('subcategories:create', (_event, input: { categoryId: number; name: string }) => {
    return createSubcategory(input);
  });

  ipcMain.handle('subcategories:rename', (_event, input: { id: number; name: string }) => {
    return renameSubcategory(input);
  });

  ipcMain.handle('subcategories:delete', (_event, id: number) => {
    return deleteSubcategory(id);
  });

  ipcMain.handle('categories:transactions', (_event, input: any) => {
    return listCategoryTransactions(input);
  });
}
