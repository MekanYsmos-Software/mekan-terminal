import { ipcMain, clipboard } from 'electron';
import fs from 'fs';
import path from 'path';
import * as ptyManager from '../pty-manager';
import { toShellPath } from './clipboard-path';

function ensureGitignored(cwd: string) {
  try {
    const gitignorePath = path.join(cwd, '.gitignore');
    const existing = fs.existsSync(gitignorePath)
      ? fs.readFileSync(gitignorePath, 'utf-8')
      : '';
    const hasEntry = existing
      .split(/\r?\n/)
      .some((line) => line.trim() === '.mekan/' || line.trim() === '.mekan');
    if (hasEntry) return;
    const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(gitignorePath, `${prefix}.mekan/\n`);
  } catch {
    // best effort — never block the paste
  }
}

export function register() {
  ipcMain.handle('clipboard:paste-image', async (_event, terminalId: string) => {
    try {
      const info = ptyManager.getTerminalInfo(terminalId);
      if (!info) return null;

      const image = clipboard.readImage();
      if (image.isEmpty()) {
        return { kind: 'text' as const, text: clipboard.readText() };
      }

      const tmpDir = path.join(info.cwd, '.mekan', 'tmp');
      fs.mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, `paste-${Date.now()}.png`);
      fs.writeFileSync(filePath, image.toPNG());
      ensureGitignored(info.cwd);
      return { kind: 'image' as const, text: `${toShellPath(filePath, info.shellType)} ` };
    } catch {
      return { kind: 'text' as const, text: clipboard.readText() };
    }
  });
}
