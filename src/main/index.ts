import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as configStore from './config-store';
import * as projectsIpc from './ipc/projects';
import * as terminalIpc from './ipc/terminal';
import * as gitIpc from './ipc/git';
import * as filesIpc from './ipc/files';
import * as ptyManager from './pty-manager';

autoUpdater.logger = log;
if (log.transports.file) {
  log.transports.file.level = 'info';
}

process.on('uncaughtException', (err) => {
  if (err.message?.includes('Cannot resize a pty that has already exited')) return;
  console.error('Uncaught exception:', err);
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: 'Mekan Terminal',
    backgroundColor: '#0e0e10',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('Auto-updater: checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Auto-updater: update available', info.version);
    mainWindow?.webContents.send('updater:available', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Auto-updater: up to date', info.version);
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Auto-updater: downloading ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Auto-updater: update downloaded', info.version);
    mainWindow?.webContents.send('updater:downloaded', info.version);
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
  });

  ipcMain.on('updater:install', () => {
    autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  configStore.init();
  projectsIpc.register();
  terminalIpc.register();
  gitIpc.register();
  filesIpc.register();

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
  });

  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.on('window:flash-if-blurred', () => {
    if (mainWindow && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true);
    }
  });

  createWindow();
  setupAutoUpdater();
});

app.on('before-quit', () => {
  ptyManager.killAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
