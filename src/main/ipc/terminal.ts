import { ipcMain, BrowserWindow } from 'electron';
import * as ptyManager from '../pty-manager';

export function register() {
  ipcMain.handle('pty:spawn', (event, projectId: string, cwd: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return ptyManager.spawn(projectId, cwd, win);
  });

  ipcMain.on('pty:write', (_event, terminalId: string, data: string) => {
    ptyManager.write(terminalId, data);
  });

  ipcMain.on('pty:resize', (_event, terminalId: string, cols: number, rows: number) => {
    ptyManager.resize(terminalId, cols, rows);
  });

  ipcMain.on('pty:kill', (_event, terminalId: string) => {
    ptyManager.kill(terminalId);
  });

  ipcMain.handle('pty:restart', (event, terminalId: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return ptyManager.restart(terminalId, win);
  });
}
