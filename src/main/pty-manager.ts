import fs from 'fs';
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

function findPwsh(): string | null {
  if (shellPaths['pwsh']) return shellPaths['pwsh'];
  const candidates = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      shellPaths['pwsh'] = p;
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

export function getAvailableShells(): ShellType[] {
  const shells: ShellType[] = [];
  if (findPwsh()) shells.push('pwsh');
  shells.push('cmd');
  if (hasWsl()) shells.push('wsl');
  return shells;
}

function resolveShell(shellType: ShellType): { exe: string; args: string[] } {
  switch (shellType) {
    case 'pwsh': {
      const p = findPwsh();
      return { exe: p || 'cmd.exe', args: [] };
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

  const proc = pty.spawn(exe, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: process.env as Record<string, string>,
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
