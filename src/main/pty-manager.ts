import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { BrowserWindow } from 'electron';
import type { TerminalStatus, ShellType } from '@shared/types';

const pty = require('node-pty');

interface PtyEntry {
  id: string;
  projectId: string;
  process: ReturnType<typeof pty.spawn>;
  status: TerminalStatus;
  exitCode: number | null;
  cwd: string;
  shellType: ShellType;
}

const instances = new Map<string, PtyEntry>();
let counter = 0;

const shellPaths: Record<string, string> = {};
let pwshProfilePath: string | null = null;
let userPath: string | null = null;

function findPwsh(): string | null {
  if (shellPaths['pwsh']) return shellPaths['pwsh'];
  const candidates = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      shellPaths['pwsh'] = p;
      try {
        const info = execSync(`"${p}" -NoProfile -Command "$PROFILE + '|' + $env:PATH"`, { encoding: 'utf-8', timeout: 5000 }).trim();
        const sepIdx = info.indexOf('|');
        if (sepIdx > 0) {
          const profile = info.substring(0, sepIdx);
          const fullPath = info.substring(sepIdx + 1);
          if (profile && fs.existsSync(profile)) {
            pwshProfilePath = profile;
          }
          if (fullPath) {
            userPath = fullPath;
          }
        }
      } catch {}
      try {
        const wp5Profile = execSync(`"${p}" -NoProfile -Command "$PROFILE.CurrentUserCurrentHost -replace 'PowerShell\\\\', 'WindowsPowerShell\\\\'"`, { encoding: 'utf-8', timeout: 5000 }).trim();
        if (wp5Profile && fs.existsSync(wp5Profile) && wp5Profile !== pwshProfilePath) {
          pwshProfilePath = pwshProfilePath
            ? `${pwshProfilePath}|${wp5Profile}`
            : wp5Profile;
        }
      } catch {}
      return p;
    }
  }
  return null;
}

function hasWsl(): boolean {
  if (shellPaths['wsl'] !== undefined) return shellPaths['wsl'] !== '';
  try {
    execSync('where wsl.exe', { stdio: 'ignore' });
    shellPaths['wsl'] = 'wsl.exe';
    return true;
  } catch {
    shellPaths['wsl'] = '';
    return false;
  }
}

export function findClaude(): string | null {
  if (shellPaths['claude']) return shellPaths['claude'];
  try {
    const result = execSync('where.exe claude', { encoding: 'utf-8', timeout: 5000 }).trim();
    const exePath = result.split('\n').find((l) => l.trim().endsWith('.exe'))?.trim();
    if (exePath && fs.existsSync(exePath)) {
      shellPaths['claude'] = exePath;
      return exePath;
    }
  } catch {}
  shellPaths['claude'] = '';
  return null;
}

export function getAvailableShells(): ShellType[] {
  const shells: ShellType[] = [];
  if (findPwsh()) shells.push('pwsh');
  shells.push('cmd');
  if (hasWsl()) shells.push('wsl');
  if (findClaude()) shells.push('claude');
  return shells;
}

function resolveShell(shellType: ShellType): { exe: string; args: string[] } {
  switch (shellType) {
    case 'pwsh': {
      const p = findPwsh();
      if (!p) return { exe: 'cmd.exe', args: [] };
      const parts: string[] = [];
      if (pwshProfilePath) {
        for (const prof of pwshProfilePath.split('|')) {
          parts.push(`. '${prof.replace(/'/g, "''")}'`);
        }
      }
      parts.push(
        'Set-PSReadLineKeyHandler -Key Tab -Function MenuComplete',
        'Set-PSReadLineOption -PredictionSource History',
        'Set-PSReadLineOption -PredictionViewStyle ListView',
        'Clear-Host',
      );
      return { exe: p, args: ['-NoLogo', '-NoExit', '-Command', parts.join('; ')] };
    }
    case 'claude': {
      const c = findClaude();
      if (!c) return { exe: 'cmd.exe', args: [] };
      return { exe: c, args: [] };
    }
    case 'wsl':
      return { exe: 'wsl.exe', args: [] };
    case 'cmd':
    default:
      return { exe: 'cmd.exe', args: [] };
  }
}

export function spawn(projectId: string, cwd: string, win: BrowserWindow, shellType?: ShellType): string {
  const id = `term-${++counter}`;
  const type = shellType || (findPwsh() ? 'pwsh' : 'cmd');
  const { exe, args } = resolveShell(type);

  const env = { ...process.env } as Record<string, string>;
  if (!env.USERPROFILE && env.HOME) env.USERPROFILE = env.HOME;
  if (!env.HOME && env.USERPROFILE) env.HOME = env.USERPROFILE;
  if (userPath) env.PATH = userPath;

  const proc = pty.spawn(exe, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env,
    useConpty: true,
  });

  const entry: PtyEntry = {
    id,
    projectId,
    process: proc,
    status: 'running',
    exitCode: null,
    cwd,
    shellType: type,
  };

  proc.onData((data: string) => {
    if (!win.isDestroyed()) {
      win.webContents.send(`pty:data:${id}`, data);
    }
  });

  proc.onExit(({ exitCode }: { exitCode: number }) => {
    entry.status = 'exited';
    entry.exitCode = exitCode;
    if (!win.isDestroyed()) {
      win.webContents.send(`pty:status:${id}`, 'exited', exitCode);
    }
  });

  instances.set(id, entry);

  if (!win.isDestroyed()) {
    win.webContents.send(`pty:status:${id}`, 'running', null);
  }

  return id;
}

export function write(id: string, data: string) {
  const entry = instances.get(id);
  if (entry && entry.status === 'running') {
    try {
      entry.process.write(data);
    } catch {
      // PTY already exited
    }
  }
}

export function resize(id: string, cols: number, rows: number) {
  const entry = instances.get(id);
  if (entry && entry.status === 'running') {
    try {
      entry.process.resize(cols, rows);
    } catch {
      // PTY already exited between status check and resize call
    }
  }
}

export function kill(id: string) {
  const entry = instances.get(id);
  if (entry) {
    try {
      entry.process.kill();
    } catch {
      // already dead
    }
  }
  instances.delete(id);
}

export function restart(id: string, win: BrowserWindow): string | null {
  const entry = instances.get(id);
  if (!entry) return null;
  const { projectId, cwd, shellType } = entry;
  kill(id);
  return spawn(projectId, cwd, win, shellType);
}

export function killAll() {
  for (const [id] of instances) {
    kill(id);
  }
}
