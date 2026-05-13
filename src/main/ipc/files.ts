import { ipcMain } from 'electron';
import fs from 'fs';

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.cache', '__pycache__']);

export function register() {
  ipcMain.handle('fs:readdir', async (_event, dirPath: string) => {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const result: { name: string; type: 'file' | 'directory' }[] = [];
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;
      result.push({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      });
    }
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return result;
  });

  ipcMain.handle('fs:read-file', async (_event, filePath: string) => {
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('fs:write-file', async (_event, filePath: string, content: string) => {
    await fs.promises.writeFile(filePath, content, 'utf-8');
  });
}
