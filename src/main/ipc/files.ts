import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import * as configStore from '../config-store';
import type { Project } from '@shared/types';

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.cache', '__pycache__']);

function isUnderProjectPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const projects = configStore.readProjects() as Project[];
  return projects.some((p) => resolved.startsWith(path.resolve(p.path) + path.sep) || resolved === path.resolve(p.path));
}

export function register() {
  ipcMain.handle('fs:readdir', async (_event, dirPath: string) => {
    if (!isUnderProjectPath(dirPath)) throw new Error('Access denied: path is outside project directories');
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
    if (!isUnderProjectPath(filePath)) throw new Error('Access denied: path is outside project directories');
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('fs:write-file', async (_event, filePath: string, content: string) => {
    if (!isUnderProjectPath(filePath)) throw new Error('Access denied: path is outside project directories');
    await fs.promises.writeFile(filePath, content, 'utf-8');
  });
}
