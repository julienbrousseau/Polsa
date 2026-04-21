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
    createTransfer: (input: any) => Promise<any>;
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
  // Reconcile
  reconcile: {
    getBalance: (accountId: number) => Promise<any>;
    getUnreconciled: (input: any) => Promise<any>;
    confirm: (input: any) => Promise<any>;
  };
  // Recurring
  recurring: {
    list: () => Promise<any[]>;
    get: (id: number) => Promise<any>;
    create: (input: any) => Promise<any>;
    update: (input: any) => Promise<any>;
    cancel: (id: number) => Promise<void>;
    reactivate: (id: number) => Promise<any>;
    delete: (id: number) => Promise<void>;
    applyOverdue: () => Promise<{ applied: number }>;
  };
  // Budgets
  budgets: {
    overview: (input: any) => Promise<any>;
    getAllocations: (input: any) => Promise<any>;
    setAllocation: (input: any) => Promise<void>;
    setAllocations: (input: any) => Promise<void>;
    getDefaults: () => Promise<any[]>;
  };
  // Mobile Sync
  sync: {
    importMobile: (payload: any) => Promise<any>;
    generatePayload: () => Promise<any>;
    startServer: () => Promise<any>;
    stopServer: () => Promise<void>;
    startCompanion: () => Promise<{ url: string; port: number } | null>;
    stopCompanion: () => Promise<void>;
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
    createTransfer: (input) => ipcRenderer.invoke('transactions:createTransfer', input),
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
  reconcile: {
    getBalance: (accountId) => ipcRenderer.invoke('reconcile:getBalance', accountId),
    getUnreconciled: (input) => ipcRenderer.invoke('reconcile:getUnreconciled', input),
    confirm: (input) => ipcRenderer.invoke('reconcile:confirm', input),
  },
  recurring: {
    list: () => ipcRenderer.invoke('recurring:list'),
    get: (id) => ipcRenderer.invoke('recurring:get', id),
    create: (input) => ipcRenderer.invoke('recurring:create', input),
    update: (input) => ipcRenderer.invoke('recurring:update', input),
    cancel: (id) => ipcRenderer.invoke('recurring:cancel', id),
    reactivate: (id) => ipcRenderer.invoke('recurring:reactivate', id),
    delete: (id) => ipcRenderer.invoke('recurring:delete', id),
    applyOverdue: () => ipcRenderer.invoke('recurring:applyOverdue'),
  },
  budgets: {
    overview: (input) => ipcRenderer.invoke('budgets:overview', input),
    getAllocations: (input) => ipcRenderer.invoke('budgets:getAllocations', input),
    setAllocation: (input) => ipcRenderer.invoke('budgets:setAllocation', input),
    setAllocations: (input) => ipcRenderer.invoke('budgets:setAllocations', input),
    getDefaults: () => ipcRenderer.invoke('budgets:getDefaults'),
  },
  sync: {
    importMobile: (payload) => ipcRenderer.invoke('sync:importMobile', payload),
    generatePayload: () => ipcRenderer.invoke('sync:generatePayload'),
    startServer: () => ipcRenderer.invoke('sync:startServer'),
    stopServer: () => ipcRenderer.invoke('sync:stopServer'),
    startCompanion: () => ipcRenderer.invoke('sync:startCompanion'),
    stopCompanion: () => ipcRenderer.invoke('sync:stopCompanion'),
  },
};

contextBridge.exposeInMainWorld('polsa', api);
