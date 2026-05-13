import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import * as configStore from './config-store';
import * as projectsIpc from './ipc/projects';
import * as terminalIpc from './ipc/terminal';
import * as gitIpc from './ipc/git';
import * as ptyManager from './pty-manager';

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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#18181b',
      symbolColor: '#e4e4e7',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update disponível',
      message: `Versão ${info.version} foi baixada. O app será atualizado ao reiniciar.`,
      buttons: ['Reiniciar agora', 'Depois'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  configStore.init();
  projectsIpc.register();
  terminalIpc.register();
  gitIpc.register();

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
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
