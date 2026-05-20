import { ipcMain, BrowserWindow } from 'electron';
import * as claudeManager from '../claude-manager';
import * as configStore from '../config-store';

export function register() {
  ipcMain.handle('claude:spawn', (event, projectId: string, cwd: string, sessionId?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');
    return claudeManager.spawnClaude(projectId, cwd, win, sessionId);
  });

  ipcMain.on('claude:send', (_event, terminalId: string, message: string) => {
    claudeManager.sendMessage(terminalId, message);
  });

  ipcMain.on('claude:abort', (_event, terminalId: string) => {
    claudeManager.abort(terminalId);
  });

  ipcMain.on('claude:kill', (_event, terminalId: string) => {
    claudeManager.kill(terminalId);
  });

  ipcMain.handle('claude:session:load', (_event, projectId: string, terminalId: string) => {
    return configStore.readClaudeSession(projectId, terminalId);
  });

  ipcMain.handle('claude:session:save', (_event, projectId: string, terminalId: string, session: unknown) => {
    configStore.writeClaudeSession(projectId, terminalId, session);
  });
}
