import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronBridgeApi {
  isDesktopApp: boolean;
  getDesktopStatus: () => Promise<{
    isPackaged: boolean;
    port: number;
    openAtLogin: boolean;
    autoSyncClock: boolean;
  }>;
  minimizeToTray: () => Promise<void>;
  setOpenAtLogin: (enabled: boolean) => Promise<boolean>;
  setAutoSyncClock: (enabled: boolean) => Promise<boolean>;
  syncClockNow: () => Promise<{ success: boolean; time?: string; error?: string }>;
}

const api: ElectronBridgeApi = {
  isDesktopApp: true,
  getDesktopStatus: () => ipcRenderer.invoke('gmk87:desktop-status'),
  minimizeToTray: () => ipcRenderer.invoke('gmk87:minimize-to-tray'),
  setOpenAtLogin: (enabled: boolean) => ipcRenderer.invoke('gmk87:set-open-at-login', enabled),
  setAutoSyncClock: (enabled: boolean) => ipcRenderer.invoke('gmk87:set-auto-sync-clock', enabled),
  syncClockNow: () => ipcRenderer.invoke('gmk87:sync-clock-now'),
};

contextBridge.exposeInMainWorld('gmk87Electron', api);
