/// <reference types="node" />
import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  shell,
  Notification,
} from 'electron';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ServerHandle, StartServerOptions } from '../local-server';

const PREFERRED_PORT = Number(process.env.PORT) || 3887;
const APP_USER_MODEL_ID = 'com.zuoya.gmk87.studio';
const START_HIDDEN = process.argv.includes('--hidden') || process.argv.includes('--autostart');

interface DesktopSettings {
  autoSyncClock15Min: boolean;
  hasShownTrayNotice: boolean;
}

const DEFAULT_SETTINGS: DesktopSettings = {
  autoSyncClock15Min: true,
  hasShownTrayNotice: false,
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverHandle: ServerHandle | null = null;
let activePort = PREFERRED_PORT;
let isQuitting = false;
let clockSyncTimer: ReturnType<typeof setInterval> | null = null;
let usbMonitorTimer: ReturnType<typeof setTimeout> | null = null;
let trayRefreshTimer: ReturnType<typeof setInterval> | null = null;
let settings: DesktopSettings = { ...DEFAULT_SETTINGS };
let lastClockSyncLabel = 'Pending';
let lastClockSyncOkAt = 0;
let lastSyncedHardwareSession = false;
let lastDetectedState: boolean | null = null;
let lastTraySignature = '';

function logMain(message: string): void {
  try {
    const logPath = path.join(app.getPath('userData'), 'main.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    try {
      const stat = fs.statSync(logPath);
      if (stat.size > 512 * 1024) {
        fs.writeFileSync(logPath, '', 'utf8');
      }
    } catch {
      // ignore if log file doesn't exist yet
    }
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {
    // ignore file logging errors
  }
}

function getAppRoot(): string {
  return app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..');
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'gmk87-desktop-settings.json');
}

function loadSettings(): DesktopSettings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(next: DesktopSettings): void {
  settings = next;
  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
    fs.writeFileSync(getSettingsPath(), JSON.stringify(next, null, 2), 'utf8');
  } catch {
    // ignore settings write errors
  }
}

const WIN_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const WIN_RUN_VALUE = 'GMK87MasterControlCenter';

function hasCustomWinRunEntry(): boolean {
  if (process.platform !== 'win32') return false;
  try {
    execFileSync('reg.exe', ['query', WIN_RUN_KEY, '/v', WIN_RUN_VALUE], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function clearCustomWinRunEntry(): void {
  if (process.platform !== 'win32') return;
  try {
    execFileSync('reg.exe', ['delete', WIN_RUN_KEY, '/v', WIN_RUN_VALUE, '/f'], {
      stdio: 'ignore',
    });
  } catch {
    // ignore if absent
  }
}

function getLoginItemArgs(): string[] {
  return app.isPackaged ? ['--hidden'] : [getAppRoot(), '--hidden'];
}

function getOpenAtLogin(): boolean {
  try {
    if (hasCustomWinRunEntry()) return true;
    const login = app.getLoginItemSettings({
      path: process.execPath,
      args: getLoginItemArgs(),
    });
    if (login.openAtLogin) return true;
    const bare = app.getLoginItemSettings();
    return Boolean(bare.openAtLogin);
  } catch {
    return false;
  }
}

function setOpenAtLogin(enabled: boolean): boolean {
  try {
    clearCustomWinRunEntry();
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: getLoginItemArgs(),
    });
    return getOpenAtLogin();
  } catch {
    return false;
  }
}

function resolveIconPath(filename: string): string {
  const candidates = [
    path.join(getAppRoot(), 'electron', 'icons', filename),
    path.join(process.resourcesPath || '', 'icons', filename),
    path.join(__dirname, '..', 'electron', 'icons', filename),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function showBalloonNotice(title: string, content: string): void {
  try {
    if (process.platform === 'win32' && tray) {
      tray.displayBalloon({
        title,
        content,
        iconType: 'info',
      });
      return;
    }
    if (Notification.isSupported()) {
      new Notification({ title, body: content }).show();
    }
  } catch {
    // ignore OS notification failure
  }
}

async function triggerClockSync(showFeedback: boolean): Promise<{ success: boolean; time?: string; error?: string }> {
  let res: { success: boolean; time?: string; error?: string };

  if (serverHandle) {
    res = await serverHandle.syncClock();
  } else {
    try {
      const resp = await fetch(`http://127.0.0.1:${activePort}/api/hid/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clockTimestampMs: Date.now() }),
        signal: AbortSignal.timeout(4000),
      });
      const data: any = await resp.json();
      res = { success: Boolean(resp.ok && data?.success), time: data?.config?.clockIso, error: data?.error };
    } catch (err: any) {
      res = { success: false, error: err?.message || 'Local server unreachable' };
    }
  }

  if (res.success) {
    lastClockSyncLabel = res.time || new Date().toLocaleTimeString();
    lastClockSyncOkAt = Date.now();
    lastSyncedHardwareSession = true;
    logMain(`Hardware RTC clock synced -> ${lastClockSyncLabel}`);
    if (showFeedback) {
      showBalloonNotice('GMK87 Clock Synchronized', `Hardware RTC synced to ${res.time || 'PC Clock'}`);
    }
    rebuildTrayMenu().catch(() => {});
  } else {
    logMain(`Hardware clock sync failed/skipped: ${res.error || 'Unknown error'}`);
    if (showFeedback) {
      showBalloonNotice('GMK87 Not Connected', res.error || 'Connect keyboard via wired USB-C.');
    }
  }

  return res;
}

function restartAutoClockSyncTimer(): void {
  if (clockSyncTimer) {
    clearInterval(clockSyncTimer);
    clockSyncTimer = null;
  }
  if (settings.autoSyncClock15Min) {
    clockSyncTimer = setInterval(() => {
      triggerClockSync(false).catch(() => {});
    }, 15 * 60 * 1000);
  }
}

interface UsbProbeSummary {
  detected: boolean;
  lcdDetected: boolean;
  viaConnected: boolean;
  deviceName: string;
  firmwareVersion: string;
}

async function probeHardwareState(): Promise<UsbProbeSummary> {
  if (serverHandle) {
    const s = await serverHandle.probeHardwareSummary();
    return {
      detected: s.detected,
      lcdDetected: s.lcdDetected,
      viaConnected: s.viaConnected,
      deviceName: s.deviceName,
      firmwareVersion: s.firmwareVersion,
    };
  }
  try {
    const resp = await fetch(`http://127.0.0.1:${activePort}/api/health`, {
      signal: AbortSignal.timeout(900),
    });
    if (resp.ok) {
      const data: any = await resp.json();
      return {
        detected: Boolean(data?.hardwareDetected),
        lcdDetected: Boolean(data?.lcdDetected ?? data?.hardwareDetected),
        viaConnected: Boolean(data?.viaDetected),
        deviceName: data?.deviceName || 'Zuoya GMK87',
        firmwareVersion: data?.firmwareVersion || 'Offline',
      };
    }
  } catch {
    // ignore probe error
  }
  return {
    detected: false,
    lcdDetected: false,
    viaConnected: false,
    deviceName: 'Zuoya GMK87',
    firmwareVersion: 'Offline',
  };
}

function showMainWindow(): void {
  if (!mainWindow) {
    createMainWindow(false);
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

async function queryLiveHardwareLabel(): Promise<string> {
  if (serverHandle) {
    const summary = serverHandle.getHardwareSummary();
    return summary.detected ? `Hardware: ${summary.deviceName}` : 'Hardware: Standby (USB-C Detached)';
  }
  try {
    const resp = await fetch(`http://127.0.0.1:${activePort}/api/health`, {
      signal: AbortSignal.timeout(800),
    });
    if (resp.ok) {
      const data: any = await resp.json();
      return data.hardwareDetected
        ? `Hardware: ${data.deviceName || 'Zuoya GMK87'}`
        : 'Hardware: Standby (USB-C Detached)';
    }
  } catch {
    // ignore
  }
  return 'Hardware: Probing USB...';
}

async function rebuildTrayMenu(force = true): Promise<void> {
  if (!tray) return;
  const hwLabel = await queryLiveHardwareLabel();
  const openAtLogin = getOpenAtLogin();
  const signature = `${activePort}|${hwLabel}|${lastClockSyncLabel}|${settings.autoSyncClock15Min}|${openAtLogin}`;
  if (!force && signature === lastTraySignature) {
    return;
  }
  lastTraySignature = signature;

  const menu = Menu.buildFromTemplate([
    {
      label: `GMK87 Master Control Center · :${activePort}`,
      enabled: false,
    },
    {
      label: hwLabel,
      enabled: false,
    },
    {
      label: `Last Clock Sync: ${lastClockSyncLabel}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Control Center',
      click: () => showMainWindow(),
    },
    {
      label: 'Open in Default Browser',
      click: () => {
        shell.openExternal(`http://localhost:${activePort}`).catch(() => {});
      },
    },
    { type: 'separator' },
    {
      label: 'Sync Keyboard Clock to PC Now',
      click: () => {
        triggerClockSync(true).catch(() => {});
      },
    },
    {
      label: '15-Min Auto Clock Sync (Background)',
      type: 'checkbox',
      checked: settings.autoSyncClock15Min,
      click: (item) => {
        saveSettings({ ...settings, autoSyncClock15Min: item.checked });
        restartAutoClockSyncTimer();
        rebuildTrayMenu(true).catch(() => {});
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => {
        setOpenAtLogin(item.checked);
        rebuildTrayMenu(true).catch(() => {});
      },
    },
    { type: 'separator' },
    {
      label: 'Quit GMK87 Studio',
      click: async () => {
        isQuitting = true;
        if (clockSyncTimer) clearInterval(clockSyncTimer);
        if (usbMonitorTimer) clearTimeout(usbMonitorTimer);
        if (trayRefreshTimer) clearInterval(trayRefreshTimer);
        await serverHandle?.stop().catch(() => {});
        tray?.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip(
    `GMK87 Master Control Center (http://localhost:${activePort})\n${hwLabel}\nLast Clock Sync: ${lastClockSyncLabel}`
  );
}

function createTray(): void {
  const trayPath = resolveIconPath('tray.png');
  const icoPath = resolveIconPath('icon.ico');
  let icon = nativeImage.createFromPath(trayPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(icoPath);
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
  tray.on('right-click', () => {
    rebuildTrayMenu().catch(() => {});
  });
  rebuildTrayMenu().catch(() => {});
}

function createMainWindow(startHidden: boolean): void {
  const iconPath = resolveIconPath('icon.ico');
  const winIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: !startHidden,
    backgroundColor: '#0b0f19',
    title: 'GMK87 Master Control Center',
    autoHideMenuBar: true,
    icon: winIcon.isEmpty() ? undefined : winIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('http://localhost:') ||
      url.startsWith('http://127.0.0.1:') ||
      url.startsWith('http://[::1]:')
    ) {
      return { action: 'allow' };
    }
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      if (!settings.hasShownTrayNotice) {
        saveSettings({ ...settings, hasShownTrayNotice: true });
        showBalloonNotice(
          'GMK87 Running in System Tray',
          'Background USB bridge & 15-min clock sync stay active. Right-click tray icon to quit.'
        );
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (!startHidden) {
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  }

  let loadAttempts = 0;
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logMain(`did-fail-load (${errorCode}: ${errorDescription}) URL=${validatedURL}`);
    if (loadAttempts < 3 && mainWindow && !mainWindow.isDestroyed()) {
      loadAttempts++;
      const fallbackUrl =
        loadAttempts >= 2 ? `http://127.0.0.1:${activePort}` : `http://localhost:${activePort}`;
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          logMain(`Retrying window load (${loadAttempts}/3): ${fallbackUrl}`);
          mainWindow
            .loadURL(fallbackUrl)
            .catch((err) => logMain(`loadURL retry failed: ${err?.message || err}`));
        }
      }, 900);
    }
  });

  mainWindow
    .loadURL(`http://localhost:${activePort}`)
    .catch((err) => logMain(`Initial loadURL failed: ${err?.message || err}`));
}

async function probeHealthUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(1200) });
    if (!resp.ok) return false;
    const data: any = await resp.json();
    return Boolean(data?.ok && data?.app === 'gmk87-master-control-center');
  } catch {
    return false;
  }
}

async function checkExistingGmk87Server(port: number): Promise<boolean> {
  const [ipv6Ok, ipv4Ok] = await Promise.all([
    probeHealthUrl(`http://[::1]:${port}/api/health`),
    probeHealthUrl(`http://127.0.0.1:${port}/api/health`),
  ]);
  if (ipv6Ok || ipv4Ok) {
    logMain(`Detected existing GMK87 backend on :${port} (ipv6=${ipv6Ok}, ipv4=${ipv4Ok})`);
    return true;
  }
  return false;
}

async function startEmbeddedBackend(): Promise<void> {
  if (await checkExistingGmk87Server(PREFERRED_PORT)) {
    activePort = PREFERRED_PORT;
    serverHandle = null;
    logMain(`Attached to existing backend on :${activePort}`);
    return;
  }

  process.env.GMK87_NO_AUTOSTART = '1';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const serverModule = require(path.join(__dirname, 'server.cjs')) as {
    startServer: (opts: StartServerOptions) => Promise<ServerHandle>;
  };

  const appRoot = getAppRoot();
  const distDir = path.join(appRoot, 'dist');
  const mediaScriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'get_media.ps1')
    : path.join(appRoot, 'get_media.ps1');

  const opts: StartServerOptions = {
    port: PREFERRED_PORT,
    isProd: true,
    distDir,
    mediaScriptPath,
    dataDir: app.getPath('userData'),
  };

  try {
    serverHandle = await serverModule.startServer(opts);
    activePort = serverHandle.port;
    logMain(`Started embedded dual-stack backend on :${activePort}`);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      const isOurs = await checkExistingGmk87Server(PREFERRED_PORT);
      if (isOurs) {
        activePort = PREFERRED_PORT;
        serverHandle = null;
        logMain(`EADDRINUSE resolved by attaching to existing GMK87 backend on :${activePort}`);
        return;
      }
      serverHandle = await serverModule.startServer({ ...opts, port: 0 });
      activePort = serverHandle.port;
      logMain(`Preferred port ${PREFERRED_PORT} in use by another app; bound fallback :${activePort}`);
      return;
    }
    logMain(`Embedded backend failed to start: ${err?.stack || err?.message || err}`);
    throw err;
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.setAppUserModelId(APP_USER_MODEL_ID);

  app.on('second-instance', (_event, argv) => {
    const secondWantsHidden = argv.includes('--hidden') || argv.includes('--autostart');
    logMain(`Second instance signaled (hidden=${secondWantsHidden})`);
    if (!secondWantsHidden) {
      showMainWindow();
    }
  });

  app.whenReady().then(async () => {
    settings = loadSettings();
    logMain(`App ready (packaged=${app.isPackaged}, hidden=${START_HIDDEN})`);

    ipcMain.handle('gmk87:desktop-status', () => ({
      isPackaged: app.isPackaged,
      port: activePort,
      openAtLogin: getOpenAtLogin(),
      autoSyncClock: settings.autoSyncClock15Min,
    }));

    ipcMain.handle('gmk87:minimize-to-tray', () => {
      mainWindow?.hide();
    });

    ipcMain.handle('gmk87:set-open-at-login', (_event, enabled: boolean) => {
      const next = setOpenAtLogin(Boolean(enabled));
      rebuildTrayMenu().catch(() => {});
      return next;
    });

    ipcMain.handle('gmk87:set-auto-sync-clock', (_event, enabled: boolean) => {
      saveSettings({ ...settings, autoSyncClock15Min: Boolean(enabled) });
      restartAutoClockSyncTimer();
      rebuildTrayMenu().catch(() => {});
      return settings.autoSyncClock15Min;
    });

    ipcMain.handle('gmk87:sync-clock-now', async () => triggerClockSync(false));

    await startEmbeddedBackend();
    if (settings.autoSyncClock15Min) {
      triggerClockSync(false).catch(() => {});
    }
    createTray();
    createMainWindow(START_HIDDEN);
    restartAutoClockSyncTimer();

    const runUsbMonitorTick = async () => {
      try {
        const summary = await probeHardwareState();
        if (!summary.detected) {
          lastSyncedHardwareSession = false;
        } else if (
          !lastSyncedHardwareSession &&
          settings.autoSyncClock15Min &&
          Date.now() - lastClockSyncOkAt > 5000
        ) {
          logMain('USB GMK87 detected/reattached — syncing RTC clock automatically');
          await new Promise((r) => setTimeout(r, 400));
          await triggerClockSync(false);
        }
        if (summary.detected !== lastDetectedState) {
          lastDetectedState = summary.detected;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('gmk87:usb-state', summary);
          }
          await rebuildTrayMenu(true);
        }
      } catch {
        // ignore periodic monitor errors
      }
    };

    const scheduleNextUsbCheck = (delayOverride?: number) => {
      if (isQuitting) return;
      if (usbMonitorTimer) {
        clearTimeout(usbMonitorTimer);
        usbMonitorTimer = null;
      }
      const isVisible = Boolean(mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized());
      const waitMs = delayOverride ?? (isVisible ? 2500 : 10000);
      usbMonitorTimer = setTimeout(async () => {
        await runUsbMonitorTick();
        scheduleNextUsbCheck();
      }, waitMs);
      usbMonitorTimer.unref();
    };

    if (mainWindow) {
      const wakeMonitor = () => scheduleNextUsbCheck(250);
      mainWindow.on('show', wakeMonitor);
      mainWindow.on('restore', wakeMonitor);
      mainWindow.on('hide', () => scheduleNextUsbCheck(10000));
      mainWindow.on('minimize', () => scheduleNextUsbCheck(10000));
    }

    scheduleNextUsbCheck(600);

    trayRefreshTimer = setInterval(() => {
      rebuildTrayMenu(false).catch(() => {});
    }, 30000);
    trayRefreshTimer.unref();
  });

  app.on('window-all-closed', () => {
    // Keep Tray & USB background service alive on Windows/Linux
  });

  app.on('before-quit', async () => {
    isQuitting = true;
    if (clockSyncTimer) clearInterval(clockSyncTimer);
    if (usbMonitorTimer) clearTimeout(usbMonitorTimer);
    if (trayRefreshTimer) clearInterval(trayRefreshTimer);
    await serverHandle?.stop().catch(() => {});
  });
}
