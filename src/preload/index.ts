// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron';

export interface PolsaAPI {
  // Accounts
  accounts: {
    list: () => Promise<any[]>;
    get: (id: number) => Promise<any>;
    create: (input: any) => Promise<any>;
    update: (input: any) => Promise<any>;
    delete: (id: number) => Promise<void>;
  };
  // Transactions
  transactions: {
    list: (input: any) => Promise<any>;
    create: (input: any) => Promise<any>;
    update: (input: any) => Promise<any>;
    delete: (id: number) => Promise<void>;
  };
  // Categories
  categories: {
    list: () => Promise<any[]>;
    create: (input: any) => Promise<any>;
    rename: (input: any) => Promise<any>;
    delete: (id: number) => Promise<void>;
    transactions: (input: any) => Promise<any>;
  };
  // Subcategories
  subcategories: {
    create: (input: any) => Promise<any>;
    rename: (input: any) => Promise<any>;
    delete: (id: number) => Promise<void>;
  };
  // QIF
  qif: {
    import: (input: any) => Promise<any>;
    export: (input: any) => Promise<any>;
    pickImportFile: () => Promise<string | null>;
    pickExportFile: () => Promise<string | null>;
  };
}

const api: PolsaAPI = {
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    get: (id) => ipcRenderer.invoke('accounts:get', id),
    create: (input) => ipcRenderer.invoke('accounts:create', input),
    update: (input) => ipcRenderer.invoke('accounts:update', input),
    delete: (id) => ipcRenderer.invoke('accounts:delete', id),
  },
  transactions: {
    list: (input) => ipcRenderer.invoke('transactions:list', input),
    create: (input) => ipcRenderer.invoke('transactions:create', input),
    update: (input) => ipcRenderer.invoke('transactions:update', input),
    delete: (id) => ipcRenderer.invoke('transactions:delete', id),
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (input) => ipcRenderer.invoke('categories:create', input),
    rename: (input) => ipcRenderer.invoke('categories:rename', input),
    delete: (id) => ipcRenderer.invoke('categories:delete', id),
    transactions: (input) => ipcRenderer.invoke('categories:transactions', input),
  },
  subcategories: {
    create: (input) => ipcRenderer.invoke('subcategories:create', input),
    rename: (input) => ipcRenderer.invoke('subcategories:rename', input),
    delete: (id) => ipcRenderer.invoke('subcategories:delete', id),
  },
  qif: {
    import: (input) => ipcRenderer.invoke('qif:import', input),
    export: (input) => ipcRenderer.invoke('qif:export', input),
    pickImportFile: () => ipcRenderer.invoke('qif:pick-import-file'),
    pickExportFile: () => ipcRenderer.invoke('qif:pick-export-file'),
  },
};

contextBridge.exposeInMainWorld('polsa', api);
